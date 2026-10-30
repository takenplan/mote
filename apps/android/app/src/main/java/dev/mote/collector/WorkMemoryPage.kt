package dev.mote.collector

import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject

/** A receipt identifies results; each Memory body still needs its own owner read. */
internal data class WorkMemoryPage(val ids: List<String>, val total: Int, val next: String?) {
    companion object {
        private val uuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        fun validId(id: String) = uuid.matches(id)
        fun read(value: JSONObject, cursor: String?): WorkMemoryPage {
            val items=value.getJSONArray("ids");require(items.length()<=20 && value.has("nextCursor"))
            val ids=(0 until items.length()).map{items.get(it) as? String ?: error("Invalid result ID")}
            val total=value.get("total") as? Number ?: error("Invalid result count")
            val count=total.toLong();require(count in 0..Int.MAX_VALUE && total.toDouble()==count.toDouble() && count>=ids.size)
            require(ids.all(::validId) && ids.distinct().size==ids.size && ids.zipWithNext().all { (a,b)->a<b })
            require(cursor==null || validId(cursor) && ids.all { it>cursor })
            val next=if(value.isNull("nextCursor")) null else value.get("nextCursor") as? String ?: error("Invalid result cursor")
            require(next==null || ids.isNotEmpty() && next==ids.last())
            return WorkMemoryPage(ids,count.toInt(),next)
        }
    }
}

/** A selector is never authority: both the receipt and exact Memory are re-read by the current owner. */
internal data class WorkMemoryReference(val work: String, val cursor: String?, val memory: String, val snapshot: String) {
    init {
        require(work.isNotBlank() && work.length<=512 && (cursor==null || WorkMemoryPage.validId(cursor)))
        require(WorkMemoryPage.validId(memory) && snapshot.matches(Regex("^[a-f0-9]{64}$")))
    }
    fun put(intent: Intent): Intent = intent.putExtra("workMemoryWork",work).putExtra("workMemoryCursor",cursor)
        .putExtra("workMemoryId",memory).putExtra("workMemorySnapshot",snapshot)

    fun verify(api: CentralClient, evidence: String) {
        if(!WorkMemoryPage.validId(evidence))throw WorkMemoryUnavailable()
        fun member(): Boolean {
            val path="/api/work-activity/"+CentralScreens.encode(work)+"/memory-results?limit=20"+(cursor?.let{"&cursor="+CentralScreens.encode(it)}?:"")
            return memory in WorkMemoryPage.read(api.get(path),cursor).ids
        }
        if(!member())throw WorkMemoryUnavailable()
        val row=api.get("/api/memories/"+CentralScreens.encode(memory))
        if(identity(memory,row)!=snapshot || evidence !in evidenceIds(row))throw WorkMemoryUnavailable()
        if(!member())throw WorkMemoryUnavailable()
    }

    companion object {
        fun from(intent: Intent): WorkMemoryReference? {
            if(!intent.hasExtra("workMemoryWork"))return null
            return WorkMemoryReference(requireNotNull(intent.getStringExtra("workMemoryWork")),intent.getStringExtra("workMemoryCursor"),requireNotNull(intent.getStringExtra("workMemoryId")),requireNotNull(intent.getStringExtra("workMemorySnapshot")))
        }
        private fun evidenceIds(row: JSONObject): List<String> = runCatching {
            val values=row.getJSONArray("evidenceIds")
            require(values.length() in 1..30)
            (0 until values.length()).map { values.get(it) as String }.also { require(it.all(WorkMemoryPage::validId)) }
        }.getOrDefault(emptyList())
        fun identity(id: String, row: JSONObject): String? = runCatching {
            require(WorkMemoryPage.validId(id) && row.get("id") == id)
            val version=row.get("version") as Number
            require(version.toDouble()==version.toInt().toDouble() && version.toInt()>0)
            val fingerprint=row.get("fingerprint") as String
            require(fingerprint.matches(Regex("^[a-f0-9]{64}$")))
            val status=row.get("status") as String
            require(status in setOf("proposed","published","stale"))
            val title=row.get("title") as String; val statement=row.get("statement") as String; val uncertainty=row.get("uncertainty") as String
            require(title.length<=160 && statement.length<=6000 && uncertainty.length<=2000)
            val evidence=evidenceIds(row);require(evidence.isNotEmpty())
            SourceRules.hash(JSONArray().put(id).put(version.toInt()).put(status).put(fingerprint).put(title).put(statement).put(uncertainty).put(JSONArray(evidence)).toString())
        }.getOrNull()
    }
}

internal class WorkMemoryUnavailable : IllegalStateException(MoteI18n.text("请求的资源不存在或已删除。"))
internal object WorkMemoryProcess { val nonce: String = java.util.UUID.randomUUID().toString() }

/** Unsaved text is process-only; saved state contains only its owner-scoped selector and snapshot hash. */
internal object WorkMemoryDrafts {
    data class Key(val origin: String, val generation: Long, val work: String, val memory: String, val snapshot: String)
    data class Draft(val edits: Map<String,String>, val scroll: Int)
    private val values=mutableMapOf<Key,Draft>()
    @Synchronized fun remember(key: Key, edits: Map<String,String>, scroll: Int) { if(edits.isEmpty())values.remove(key) else values[key]=Draft(edits.toMap(),scroll) }
    @Synchronized fun take(key: Key): Draft? = values.remove(key)
    @Synchronized fun clear() = values.clear()
}
