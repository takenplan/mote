package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class UiPageRulesTest {
    private fun canonical(value: Any?): String = when (value) {
        is JSONObject -> value.keys().asSequence().toList().sorted().joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canonical(value.get(it)) }
        is JSONArray -> (0 until value.length()).joinToString(",", "[", "]") { canonical(value.get(it)) }
        is String -> JSONObject.quote(value)
        else -> value.toString()
    }
    @Test fun structuredSharedConformance() {
        val cases = JSONArray(javaClass.getResource("/structured-conformance.json")!!.readText())
        for (i in 0 until cases.length()) {
            val fixture = cases.getJSONObject(i)
            if (fixture.getString("platform") != "android") continue
            val pages = UiPageRules.extractAll(fixture.getJSONObject("snapshot"), UiPageRules.parse(fixture.getJSONArray("rules").toString()))
            assertEquals(fixture.getString("name"), canonical(fixture.getJSONArray("expected")), canonical(JSONArray(pages)))
        }
    }
    @Test fun androidSelectedNodeFixturesCannotPublishRawNodeObservations() {
        for(path in listOf("/conformance.json","/builtin-coverage.json")) {
            val cases=JSONArray(javaClass.getResource(path)!!.readText())
            for(i in 0 until cases.length()) {
                val fixture=cases.getJSONObject(i);if(fixture.getString("platform")!="android")continue
                val snapshot=fixture.getJSONObject("snapshot").put("observedAt","2026-10-24T00:00:00Z")
                assertTrue(fixture.getString("name"),UiPageRules.extractAll(snapshot,UiPageRules.parse(fixture.getJSONArray("rules").toString())).isEmpty())
            }
        }
    }
    @Test fun namedFieldSharedConformanceMatchesReviewedStructureAndExactVersion() {
        val cases=JSONObject(javaClass.getResource("/named-field-conformance.json")!!.readText()).getJSONArray("cases")
        for(i in 0 until cases.length()) {
            val fixture=cases.getJSONObject(i);val snapshot=fixture.getJSONObject("snapshot");val rule=fixture.getJSONObject("rule")
            val rules=UiPageRules.parse(JSONArray().put(rule).toString());val pages=UiPageRules.extractAll(snapshot,rules)
            val expected=fixture.getJSONArray("expectedFields")
            if(expected.length()==0)assertTrue(fixture.getString("name"),pages.isEmpty())
            else {assertEquals(fixture.getString("name"),1,pages.size);assertEquals(canonical(expected),canonical(pages.single().getJSONArray("objects").getJSONObject(0).getJSONArray("fields")))}
            snapshot.put("appVersion",snapshot.getString("appVersion")+"-changed")
            assertTrue(fixture.getString("name"),UiPageRules.extractAll(snapshot,rules).isEmpty())
        }
    }
    @Test fun aLongRepeatedFieldCannotConsumeItsRequiredHeaderOrExceedThePerFieldLimit() {
        val nodes=JSONArray((0 until 70).map {JSONObject().put("id","p$it").put("resourceId","generated:id/paragraph").put("role","Text").put("text","Generated paragraph $it")})
        nodes.put(JSONObject().put("id","header").put("resourceId","generated:id/header").put("role","Text").put("text","Generated required header"))
        val snapshot=JSONObject().put("appId","generated").put("appVersion","1").put("activity","generated.Page").put("observedAt","2026-10-24T00:00:00Z").put("truncated",false).put("nodes",nodes)
        fun field(id:String,many:Boolean)=JSONObject().put("select",JSONObject().put("resourceId",id)).put("required",true).put("cardinality",if(many)"many" else "one")
        val rule=JSONObject().put("formatVersion",3).put("id","generated.repeat").put("version","1").put("platform","android").put("appId","generated").put("appVersion","1").put("kind","article")
            .put("fields",JSONObject().put("body",field("generated:id/paragraph",true)).put("z_header",field("generated:id/header",false)))
        val page=UiPageRules.extractAll(snapshot,UiPageRules.parse(JSONArray().put(rule).toString())).single()
        NamedPageRules.validatePage(page)
        assertTrue(page.getBoolean("truncated"));assertEquals("partial",page.getString("status"))
        val fields=page.getJSONArray("objects").getJSONObject(0).getJSONArray("fields")
        assertEquals(64,fields.getJSONObject(0).getJSONArray("values").length())
        assertEquals("Generated paragraph 63",fields.getJSONObject(0).getJSONArray("values").getJSONObject(63).getString("text"))
        assertEquals("Generated required header",fields.getJSONObject(1).getJSONArray("values").getJSONObject(0).getString("text"))
    }
    @Test fun aggregateTextClippingNeverEmitsAHalfSurrogateOrAnEmptyRequiredField() {
        val nodes=JSONArray().put(JSONObject().put("id","long").put("resourceId","generated:id/long").put("role","Text").put("text","x".repeat(21333)))
            .put(JSONObject().put("id","emoji").put("resourceId","generated:id/emoji").put("role","Text").put("text","\uD83D\uDE00"))
        val snapshot=JSONObject().put("appId","generated").put("appVersion","1").put("activity","generated.Page").put("observedAt","2026-10-24T00:00:00Z").put("truncated",false).put("nodes",nodes)
        val fields=JSONObject()
        for(name in listOf("a","b","c"))fields.put(name,JSONObject().put("select",JSONObject().put("resourceId","generated:id/long")).put("required",true))
        fields.put("z",JSONObject().put("select",JSONObject().put("resourceId","generated:id/emoji")))
        val rule=JSONObject().put("formatVersion",3).put("id","generated.unicode").put("version","1").put("platform","android").put("appId","generated").put("appVersion","1").put("kind","visible_text").put("fields",fields)
        val page=UiPageRules.extractAll(snapshot,UiPageRules.parse(JSONArray().put(rule).toString())).single()
        NamedPageRules.validatePage(page)
        assertTrue(page.getBoolean("truncated"));assertEquals(3,page.getJSONArray("objects").getJSONObject(0).getJSONArray("fields").length())
        assertEquals(64001,UiPageRules.text(page).length) // 63999 original units plus two separators.
        fields.getJSONObject("z").put("required",true)
        assertTrue(UiPageRules.extractAll(snapshot,UiPageRules.parse(JSONArray().put(rule).toString())).isEmpty())
    }
    @Test fun rejectsExecutableAndUnboundedRules() {
        val rule=JSONObject("""{"id":"fixture","version":"1","platform":"android","appId":"fixture","select":{"role":"Text"}}""")
        for(key in listOf("script","action","fetch")) {val invalid=JSONObject(rule.toString()).put(key,"evil");try{UiPageRules.parse(JSONArray().put(invalid).toString());fail(key)}catch(_:IllegalArgumentException){}}
        try{UiPageRules.parse(JSONArray().put(rule).put(rule).toString());fail("duplicate")}catch(_:IllegalArgumentException){}
    }
    @Test fun configRoundTrip() {
        val config=CollectorConfig(deviceName="Generated",uiPageMode="hybrid",uiPageRules="[]")
        val restored=ConfigurationArchive.decode(ConfigurationArchive.encode(config),CollectorConfig(deviceName="Generated"))
        assertEquals(config.uiPageMode,restored.uiPageMode);assertEquals(config.uiPageRules,restored.uiPageRules)
    }
}
