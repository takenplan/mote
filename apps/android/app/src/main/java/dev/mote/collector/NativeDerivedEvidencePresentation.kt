package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.time.Instant
import java.util.concurrent.CancellationException

/** Only organizer-declared, exact pinned speech-text can hide its structural prefix. */
internal object NativeDerivedEvidencePresentation {
    data class Projection(val text: String, val speaker: String?, val canonical: String, val locator: JSONObject)
    private val pin = Regex("^material:(mat_[a-f0-9]{64})@([a-f0-9]{64})#(chunk:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))$")
    private fun selection(row: JSONObject): MatchResult? {
        if (row.optString("source") != "file" || row.optJSONObject("provenance")?.optString("layer") != "derived") return null
        val uri = row.getJSONObject("provenance").optString("uri")
        if (row.optString("libraryVersion") != uri) return null
        return pin.matchEntire(uri)
    }
    private fun integer(value: Any?): Int? = (value as? Number)?.takeIf { it.toDouble().isFinite() && it.toDouble() in 0.0..Int.MAX_VALUE.toDouble() && it.toDouble() == it.toInt().toDouble() }?.toInt()
    private fun keys(value: JSONObject) = value.keys().asSequence().toSet()
    private fun validImage(value: JSONObject): Boolean {
        if (keys(value) != setOf("width", "height", "polygon")) return false
        if (integer(value.opt("width")) !in 1..1_000_000 || integer(value.opt("height")) !in 1..1_000_000) return false
        val polygon=value.optJSONArray("polygon") ?: return false
        return polygon.length() in 3..16 && (0 until polygon.length()).all { i ->
            val pair=polygon.optJSONArray(i)
            pair != null && pair.length()==2 && (0..1).all { n -> (pair.opt(n) as? Number)?.toDouble()?.let { it.isFinite() && it in -1_000_000.0..1_000_000.0 } == true }
        }
    }
    private fun validAttribution(value: JSONObject): Boolean = keys(value)==setOf("name","confirmedBy","confirmationId","confirmedAt") &&
        (value.opt("name") as? String)?.let { it.trim().isNotEmpty() && it.length<=100 }==true && value.optString("confirmedBy")=="owner" &&
        runCatching { java.util.UUID.fromString(value.getString("confirmationId")); Instant.parse(value.getString("confirmedAt")); true }.getOrDefault(false)

    /** Read only this immutable revision, stop at the first target span, and honor the UI visit between requests. */
    fun load(row: JSONObject, active: () -> Boolean, read: (String) -> JSONObject): Projection? {
        val match=selection(row) ?: return null
        var offset=0; var total:Int?=null; var blocks:Int?=null
        while (true) {
            if (!active()) throw CancellationException()
            val page=read("/api/materials/${match.groupValues[1]}/read?revision=${match.groupValues[2]}&offset=$offset&length=12000")
            if (!active()) throw CancellationException()
            val material=page.optJSONObject("material") ?: return null
            val range=page.optJSONObject("textRange") ?: return null
            val size=integer(range.opt("total")) ?: return null
            val count=integer(material.opt("blockCount")) ?: return null
            if (material.optString("kind")!="mote.file" || integer(material.opt("schemaVersion"))!=2 || material.optString("id")!=match.groupValues[1] || material.optString("revision")!=match.groupValues[2] || material.optString("ref")!=match.value.substringBefore('#') ||
                integer(material.opt("textLength"))!=size || integer(range.opt("offset"))!=offset || total!=null && total!=size || blocks!=null && blocks!=count) return null
            total=size; blocks=count
            val spans=page.optJSONArray("spans") ?: return null
            val candidates=(0 until spans.length()).mapNotNull(spans::optJSONObject).filter { it.optString("evidenceId")==row.optString("id") || it.optString("blockId")==match.groupValues[3] }
            if (candidates.isNotEmpty()) return if(candidates.size==1) project(row,page,candidates.single(),match) else null
            if (range.isNull("nextOffset")) return null
            val next=integer(range.opt("nextOffset")) ?: return null
            if (next<=offset || next>size) return null
            offset=next
        }
    }
    private fun project(row:JSONObject,page:JSONObject,span:JSONObject,match:MatchResult):Projection? = runCatching {
        if(span.optString("kind")!="text" || span.optString("format")!="speech-text" || span.optString("evidenceId")!=row.optString("id") || span.optString("blockId")!=match.groupValues[3])return null
        val locator=span.optJSONObject("locator") ?: return null
        val canonical=row.getString("ocrText")
        // Continued >250k parts do not repeat the structural prefix. Never decode their first prose line.
        if(locator.optString("chunkId")!=match.groupValues[4] || integer(locator.opt("textStart"))!=0 || integer(locator.opt("textEnd"))!=canonical.length)return null
        val pageText=page.getString("text");val p=span.getJSONObject("pageRange");val m=span.getJSONObject("materialRange")
        val start=integer(p.opt("start")) ?: return null;val end=integer(p.opt("end")) ?: return null
        val materialStart=integer(m.opt("start")) ?: return null;val materialEnd=integer(m.opt("end")) ?: return null
        val pageOffset=integer(page.getJSONObject("textRange").opt("offset")) ?: return null
        val evidenceOffset=integer(span.opt("evidenceOffset")) ?: return null
        if(start>=end || end>pageText.length || materialStart!=pageOffset+start || materialEnd!=pageOffset+end || evidenceOffset>canonical.length)return null
        val fragment=pageText.substring(start,end);val rendered=canonical+"\n"
        if(fragment.length>rendered.length-evidenceOffset || fragment!=rendered.substring(evidenceOffset,evidenceOffset+fragment.length))return null
        val newline=canonical.indexOf('\n');if(newline<0)return null
        val input=JSONTokener(canonical.substring(0,newline));val metadata=input.nextValue() as? JSONObject ?: return null
        if(input.nextClean()!='\u0000' || keys(metadata).any { it !in setOf("speaker","speakerAttribution","imageLocation") })return null
        if(!metadata.has("speaker")&&!metadata.has("imageLocation"))return null
        if(metadata.has("speaker") && (metadata.opt("speaker") !is String || metadata.getString("speaker").length>100))return null
        if(metadata.has("speakerAttribution") && (metadata.optJSONObject("speakerAttribution")?.let(::validAttribution)!=true))return null
        if(metadata.has("imageLocation")) {
            val image=metadata.optJSONObject("imageLocation") ?: return null
            if(!validImage(image) || SourceRules.canonical(image)!=SourceRules.canonical(locator.optJSONObject("imageLocation")))return null
        }
        Projection(canonical.substring(newline+1),metadata.optJSONObject("speakerAttribution")?.getString("name") ?: (metadata.opt("speaker") as? String)?.takeIf(String::isNotBlank),canonical,JSONObject(locator.toString()))
    }.getOrNull()
}
