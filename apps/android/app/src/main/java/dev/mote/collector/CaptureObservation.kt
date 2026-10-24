package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

data class CaptureObservation(val id:String=UUID.randomUUID().toString(), val at:String=Instant.now().toString(), val elapsed:Long=android.os.SystemClock.elapsedRealtime(), val nodes:JSONObject?=null, val fieldsSaved:Boolean=false, val contentCurrent:()->Boolean={true}) {
    fun metadata(config:CollectorConfig,windows:WindowSnapshot):JSONObject {
        val choice=config.collectionRules.selection(windows,PrivacyRules.exclusions(config.excludedPackages))
        return JSONObject().put("id",id).put("selected",JSONObject().put("duration",choice.duration).put("screenshots",choice.screenshots).put("structured",choice.structured))
    }
    fun ocrPage(text:String,appVersion:String,activity:String):JSONObject {
        val snapshot=JSONObject().put("appVersion",appVersion).put("activity",activity).put("truncated",false)
        val rule=JSONObject().put("id","mote.local-visible-ocr").put("version","1").put("kind","page")
        return NamedPageRules.page(snapshot,rule,JSONArray().put(JSONObject().put("name","visible_text").put("values",JSONArray().put(JSONObject().put("text",text.take(32000)).put("source","ocr")))),at,text.length>32000)
    }
}
