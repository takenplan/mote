package dev.mote.collector

import org.json.JSONObject
import java.util.UUID

/** Local drafts own metadata; a Central reader consumes only the returned, declared record context. */
internal object NativeRecordDescription {
    fun read(record:JSONObject,remote:Boolean):List<String> {
        if(!remote)return record.optJSONObject("metadata")?.opt("ownerDescription")?.let{it as? String}?.takeIf{it.isNotBlank()}?.let(::listOf)?:emptyList()
        val context=record.optJSONObject("attributionContext")?:return emptyList()
        fun key(value:JSONObject):Pair<String,Int>? {
            val id=value.opt("captureId") as? String?:return null
            if(runCatching{UUID.fromString(id)}.isFailure || (value.opt("version") as? Number)?.toDouble()!=1.0)return null
            return id to 1
        }
        val declarations=context.optJSONArray("recordContextDeclarations")?:return emptyList()
        val declared=(0 until declarations.length()).mapNotNull{index->declarations.optJSONObject(index)?.let{row->key(row)?.takeIf{(row.opt("fingerprint") as? String)?.matches(Regex("[a-f0-9]{64}"))==true}}}.toSet()
        val statements=context.optJSONArray("recordContextStatements")?:return emptyList()
        return (0 until statements.length()).mapNotNull{index->statements.optJSONObject(index)?.let{row->
            val pin=key(row)?.takeIf{it in declared}?:return@let null
            val text=(row.opt("description") as? String)?.takeIf{it.isNotBlank()&&it.length<=12000}?:return@let null
            pin to text
        }}.groupBy{it.first}.values.mapNotNull{rows->rows.map{it.second}.distinct().singleOrNull()}
    }
}
