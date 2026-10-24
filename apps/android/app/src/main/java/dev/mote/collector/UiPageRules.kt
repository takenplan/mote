package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject

/** Pure bounded structural rules. No executable code, network, actions, or semantic classification. */
object UiPageRules {
    val modes = listOf("screen_only", "hybrid", "ui_preferred", "page_only")
    private val selectorKeys = setOf("resourceId", "role", "textEquals")
    fun parse(raw: String): List<JSONObject> {
        require(raw.toByteArray().size <= 1048576); StrictJson.validate(raw)
        val array = JSONArray(raw); require(array.length() <= 512)
        val ids = mutableSetOf<String>()
        return (0 until array.length()).map { i ->
            array.getJSONObject(i).also { r ->
                if (r.optInt("formatVersion") == 3) { NamedPageRules.validate(r); require(ids.add(r.getString("id"))); return@also }
                val structured = r.optInt("formatVersion", 1) == 2
                require(r.keys().asSequence().all { it in if (structured) setOf("formatVersion", "id", "version", "platform", "appId", "activity", "appVersion", "required", "region", "repeat", "repeatParent", "kind", "fields") else setOf("id", "version", "platform", "appId", "activity", "appVersion", "required", "select", "ancestor", "complete") })
                for (key in listOf("id", "version", "platform", "appId")) require(r.get(key) is String && r.getString(key).length in 1..300)
                require(ids.add(r.getString("id")) && r.getString("platform") in setOf("android", "macos"))
                for (key in listOf("activity", "appVersion")) if (r.has(key)) require(r.get(key) is String && r.getString(key).length in 1..300)
                if (r.has("complete")) require(r.get("complete") is Boolean)
                if (structured) {
                    require(r.get("formatVersion") is Number && r.getInt("formatVersion") == 2 && r.getDouble("formatVersion") == 2.0)
                    require(r.has("appVersion") && r.getString("appVersion").isNotBlank())
                    require(r.getString("kind") in setOf("article", "product"))
                    for (key in listOf("region", "repeat", "repeatParent")) if (r.has(key)) selector(r.getJSONObject(key))
                    if (r.has("repeatParent")) require(r.has("repeat"))
                    val fields = r.getJSONObject("fields")
                    require(fields.keys().asSequence().all { it in setOf("title", "author", "url", "itemId", "body") })
                    require(fields.has("title") && fields.getJSONObject("title").optBoolean("required"))
                    if (r.getString("kind") == "article") require(fields.has("body") && fields.getJSONObject("body").optBoolean("required"))
                    for (key in fields.keys()) {
                        val field = fields.getJSONObject(key)
                        require(field.keys().asSequence().all { it in setOf("select", "ancestor", "required", "childPath") })
                        selector(field.getJSONObject("select"))
                        if (field.has("ancestor")) selector(field.getJSONObject("ancestor"))
                        if (field.has("required")) require(field.get("required") is Boolean)
                        if (field.has("childPath")) {
                            require(r.has("repeat") || r.has("region"))
                            val path = field.getJSONArray("childPath"); require(path.length() in 1..24)
                            for (j in 0 until path.length()) require(path.get(j) is Number && path.getDouble(j) == path.getInt(j).toDouble() && path.getInt(j) in 0..4095)
                        }
                    }
                } else {
                    selector(r.getJSONObject("select")); if (r.has("ancestor")) selector(r.getJSONObject("ancestor"))
                }
                if (r.has("required")) { val required = r.getJSONArray("required"); require(required.length() <= 8); for (j in 0 until required.length()) selector(required.getJSONObject(j)) }
            }
        }
    }
    private fun selector(s: JSONObject) {
        require(s.length() in 1..3 && s.keys().asSequence().all { it in selectorKeys })
        for (key in s.keys()) require(s.get(key) is String && s.getString(key).length in (if (key == "textEquals") 0..500 else 1..300))
    }
    private fun matches(n: JSONObject, s: JSONObject) = s.keys().asSequence().all { n.optString(if (it == "textEquals") "text" else it) == s.getString(it) }
    fun extract(snapshot: JSONObject, rules: List<JSONObject>): JSONObject? = extractAll(snapshot,rules).firstOrNull()
    /** New collection never publishes the local tree. Each object has an immutable queue record. */
    fun extractAll(snapshot: JSONObject, rules: List<JSONObject>, observedAt: String = snapshot.optString("observedAt")): List<JSONObject> {
        if (runCatching { java.time.Instant.parse(observedAt) }.isFailure) return emptyList()
        val all = snapshot.getJSONArray("nodes"); require(all.length() <= 256)
        val nodes = (0 until all.length()).map(all::getJSONObject)
        val byId = nodes.associateBy { it.getString("id") }
        fun under(node: JSONObject, id: String): Boolean {
            if (node.getString("id") == id) return true
            var parent = node.optString("parentId")
            val visited = mutableSetOf<String>()
            for (depth in 0 until 256) {
                if (!visited.add(parent)) return false
                if (parent == id) return true
                parent = byId[parent]?.optString("parentId") ?: return false
            }
            return false
        }
        fun ancestor(node: JSONObject, select: JSONObject, rootId: String?): Boolean {
            var parent = node.optString("parentId")
            val visited = mutableSetOf<String>()
            for (depth in 0 until 256) {
                if (!visited.add(parent)) return false
                val p = byId[parent] ?: return false
                if (matches(p, select)) return true
                if (parent == rootId) return false
                parent = p.optString("parentId")
            }
            return false
        }
        val allPages=mutableListOf<JSONObject>()
        for (rule in rules) {
            if(rule.optInt("formatVersion")==3 && rule.getString("platform")=="android" && rule.getString("appId")==snapshot.getString("appId") && rule.getString("appVersion")==snapshot.optString("appVersion") && (!rule.has("activity")||rule.getString("activity")==snapshot.optString("activity"))){
                val required=rule.optJSONArray("required")?:JSONArray();if((0 until required.length()).all {j->nodes.any{matches(it,required.getJSONObject(j))}})allPages+=NamedPageRules.extract(snapshot,rule,observedAt)
                if(allPages.size>=64)break;continue
            }
            if (rule.optInt("formatVersion", 1) != 2 || rule.getString("platform") != "android" || rule.getString("appId") != snapshot.getString("appId")) continue
            if (rule.getString("appVersion") != snapshot.optString("appVersion") || rule.has("activity") && rule.getString("activity") != snapshot.optString("activity")) continue
            val required = rule.optJSONArray("required") ?: JSONArray()
            if ((0 until required.length()).any { j -> nodes.none { matches(it, required.getJSONObject(j)) } }) continue
            val regions = rule.optJSONObject("region")?.let { select -> nodes.filter { matches(it, select) } }
            if (regions != null && regions.size != 1) continue
            val regionId = regions?.single()?.getString("id")
            val regionNodes = nodes.filter { regionId == null || under(it, regionId) }
            val repeats = rule.optJSONObject("repeat")?.let { select -> regionNodes.filter { matches(it, select) &&
                (!rule.has("repeatParent") || byId[it.optString("parentId")]?.let { parent -> matches(parent, rule.getJSONObject("repeatParent")) } == true) } }
            val roots: List<String?> = repeats?.map { it.getString("id") } ?: listOf(regionId)
            val pages = mutableListOf<JSONObject>()
            for (rootId in roots.take(16)) {
                val fields = rule.getJSONObject("fields")
                val objectValue = JSONObject().put("kind", rule.getString("kind"))
                var failed = false
                var clipped = false
                for (key in fields.keys()) {
                    val field = fields.getJSONObject(key)
                    var pathNode = rootId?.let(byId::get)
                    val path = field.optJSONArray("childPath")
                    if (path != null) for (j in 0 until path.length()) {
                        val parentId = pathNode?.getString("id")
                        pathNode = regionNodes.filter { it.optString("parentId") == parentId && it.has("childIndex") && it.optInt("childIndex", -1) == path.getInt(j) }.singleOrNull()
                        if (pathNode == null) break
                    }
                    val selected = regionNodes.filter { node ->
                        (rootId == null || under(node, rootId)) && node.optString("text").isNotBlank() && matches(node, field.getJSONObject("select")) &&
                            (path == null || pathNode?.getString("id") == node.getString("id")) &&
                            (!field.has("ancestor") || ancestor(node, field.getJSONObject("ancestor"), rootId))
                    }.map { it.getString("text") }
                    if (key == "body") {
                        val blocks = JSONArray()
                        for (value in selected.take(64)) { require(value.length <= 32000); blocks.put(JSONObject().put("text", value)) }
                        if (selected.size > 64) clipped = true
                        objectValue.put("body", blocks)
                        if (field.optBoolean("required") && blocks.length() == 0) failed = true
                    } else {
                        val limit = when (key) { "title", "url" -> 2000; else -> 1000 }
                        val value = selected.singleOrNull()?.takeIf { it.length <= limit && (key != "url" || validUrl(it)) }
                        if (value != null) objectValue.put(key, value)
                        if (field.optBoolean("required") && value == null) failed = true
                    }
                }
                if (failed || objectValue.optString("title").isBlank() || rule.getString("kind") == "article" && (objectValue.optJSONArray("body")?.length() ?: 0) == 0) continue
                if (!objectValue.has("body")) objectValue.put("body", JSONArray())
                when {
                    objectValue.has("itemId") -> objectValue.put("identity", JSONObject().put("type", "source_id").put("value", objectValue.getString("itemId")))
                    objectValue.has("url") -> objectValue.put("identity", JSONObject().put("type", "url").put("value", objectValue.getString("url")))
                }
                val truncated = snapshot.optBoolean("truncated") || clipped || roots.size > 16
                pages += JSONObject().put("version", 2).put("scope", "visible_window").put("adapterId", rule.getString("id")).put("adapterVersion", rule.getString("version"))
                    .put("appVersion", snapshot.optString("appVersion")).put("activity", snapshot.optString("activity")).put("status", if (truncated) "partial" else "ok").put("truncated", truncated)
                    .put("observations", JSONObject().put("firstAt", observedAt).put("lastAt", observedAt).put("count", 1)).put("objects", JSONArray().put(objectValue))
            }
            allPages += pages.map(NamedPageRules::fromArticle)
            if(allPages.size>=64)break
        }
        if(allPages.size>=64)allPages.take(64).forEach{it.put("truncated",true).put("status","partial")}
        return allPages.take(64)
    }
    private fun validUrl(value: String): Boolean = runCatching {
        Regex("""^https?://[A-Za-z0-9.\[\]:-]+(?:[/?#]|$)""").containsMatchIn(value) &&
            value.none { it.isWhitespace() || Character.isSpaceChar(it) || it == '\uFEFF' } &&
            java.net.URI(value).let { it.scheme in setOf("http", "https") && !it.host.isNullOrBlank() && it.userInfo == null && it.port <= 65535 }
    }.getOrDefault(false)
    fun text(page: JSONObject): String = NamedPageRules.text(page)
    fun validateEvent(event:JSONObject){
        require(event.getString("source")=="ui_page"&&event.getLong("durationMs")==0L&&event.getJSONObject("privacy").getString("collection")=="content")
        require(listOf("imageMime","imageBase64","ocr","mood","provenance").none(event::has))
        val m=event.getJSONObject("metadata");require(m.getJSONObject("collector").getString("method")=="accessibility")
        val p=m.getJSONObject("uiPage");NamedPageRules.validatePage(p)
        require(p.keys().asSequence().toSet()==setOf("version","scope","adapterId","adapterVersion","activity","appVersion","status","truncated","observations","objects"))
        require(p.getString("scope")=="visible_window"&&p.getString("status") in setOf("ok","partial")&&!(p.getBoolean("truncated")&&p.getString("status")=="ok"))
        val times=p.getJSONObject("observations");require(times.keys().asSequence().toSet()==setOf("firstAt","lastAt","count")&&times.getInt("count") in 1..256&&times.getDouble("count")==times.getInt("count").toDouble())
        require(times.getString("lastAt")==event.getString("capturedAt")&&m.getString("observedAt")==event.getString("capturedAt")&&!java.time.Instant.parse(times.getString("firstAt")).isAfter(java.time.Instant.parse(times.getString("lastAt"))))
        require(event.getString("ocrText")==text(p))
    }
}
