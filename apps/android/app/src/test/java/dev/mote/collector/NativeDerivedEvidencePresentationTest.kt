package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CancellationException

class NativeDerivedEvidencePresentationTest {
    private val id="5469611e-ea55-5e4e-acd0-9924840b7427"
    private val chunk="d78f66ea-b068-4747-a305-53c21c9b9cbf"
    private val material="mat_"+"a".repeat(64)
    private val revision="b".repeat(64)
    private val ref="material:$material@$revision"
    private val canonical="{\"speaker\":\"SPEAKER_0\"}\n {\"speaker\":\"literal user JSON\"}\nemoji 😀 and trailing space "
    private fun row()=JSONObject().put("id",id).put("source","file").put("libraryVersion","$ref#chunk:$chunk").put("ocrText",canonical).put("provenance",JSONObject().put("layer","derived").put("uri","$ref#chunk:$chunk"))
    private fun page(offset:Int=0,found:Boolean=true,next:Int?=null,partial:Boolean=false):JSONObject {
        val text=if(found)if(partial)canonical.take(12)else canonical+"\n" else "preceding block\n"
        val span=JSONObject().put("kind","text").put("format","speech-text").put("blockId","chunk:$chunk").put("evidenceId",id).put("evidenceOffset",0)
            .put("locator",JSONObject().put("chunkId",chunk).put("textStart",0).put("textEnd",canonical.length))
            .put("pageRange",JSONObject().put("start",0).put("end",text.length)).put("materialRange",JSONObject().put("start",offset).put("end",offset+text.length))
        return JSONObject().put("material",JSONObject().put("id",material).put("revision",revision).put("ref",ref).put("textLength",1000).put("blockCount",3).put("kind","mote.file").put("schemaVersion",2))
            .put("text",text).put("textRange",JSONObject().put("offset",offset).put("total",1000).put("nextOffset",next?:JSONObject.NULL)).put("spans",if(found)JSONArray().put(span)else JSONArray())
    }
    @Test fun exactTypedSpeechShowsWholeLiteralBodyAndPreservesCanonical(){
        val value=NativeDerivedEvidencePresentation.load(row(),{true}){page()}!!
        assertEquals(canonical.substringAfter('\n'),value.text);assertEquals("SPEAKER_0",value.speaker);assertEquals(canonical,value.canonical)
    }
    @Test fun laterPageUsesOnlyReturnedOffsetStopsAtTargetAndDoesNotReadCurrentOrFollowingText(){
        val paths=mutableListOf<String>();val value=NativeDerivedEvidencePresentation.load(row(),{true}){path->paths.add(path);if(paths.size==1)page(found=false,next=15)else page(offset=15,partial=true,next=500)}!!
        assertEquals(2,paths.size);assertTrue(paths.all{it.contains("revision=$revision")});assertTrue(paths[1].contains("offset=15"));assertEquals(canonical.substringAfter('\n'),value.text)
    }
    @Test fun plainJsonNotesAndUntrustedOrContinuedChunksRemainLiteral(){
        for(record in listOf(row().put("source","note"),row().put("libraryVersion","changed"),row().apply{getJSONObject("provenance").put("uri","$ref#chunk:$chunk:1")}))assertNull(NativeDerivedEvidencePresentation.load(record,{true}){error("No guessed read")})
        for(change in listOf<(JSONObject)->Unit>({it.put("format","plain")},{it.getJSONObject("locator").put("textStart",1)},{it.getJSONObject("locator").put("chunkId","wrong")},{it.put("evidenceId","wrong")},{it.put("evidenceOffset",1)})){
            val p=page();change(p.getJSONArray("spans").getJSONObject(0));assertNull(NativeDerivedEvidencePresentation.load(row(),{true}){p})
        }
    }
    @Test fun wrongRevisionChangedSnapshotOrWrongCanonicalNeverSelectsANewerPayload(){
        for(change in listOf<(JSONObject)->Unit>({it.put("kind","mote.note")},{it.put("schemaVersion",1)},{it.put("schemaVersion",2.5)})){val p=page();change(p.getJSONObject("material"));assertNull(NativeDerivedEvidencePresentation.load(row(),{true}){p})}
        val wrong=page().apply{getJSONObject("material").put("ref",ref+"wrong")};assertNull(NativeDerivedEvidencePresentation.load(row(),{true}){wrong})
        assertNull(NativeDerivedEvidencePresentation.load(row(),{true}){page().put("text","different current text")})
        var reads=0;assertNull(NativeDerivedEvidencePresentation.load(row(),{true}){if(reads++==0)page(found=false,next=15)else page(offset=15).apply{getJSONObject("material").put("blockCount",4)}})
    }
    @Test fun malformedMetadataAndOwnerOrVisitCancellationCannotBeConsumed(){
        val record=row().put("ocrText","{\"speaker\":\"SPEAKER_0\",\"invented\":true}\nOriginal")
        val aligned=page().put("text",record.getString("ocrText")+"\n");aligned.getJSONArray("spans").getJSONObject(0).apply { getJSONObject("pageRange").put("end",record.getString("ocrText").length+1);getJSONObject("materialRange").put("end",record.getString("ocrText").length+1);getJSONObject("locator").put("textEnd",record.getString("ocrText").length) }
        assertNull(NativeDerivedEvidencePresentation.load(record,{true}){aligned})
        var reads=0;assertThrows(CancellationException::class.java){NativeDerivedEvidencePresentation.load(row(),{reads==0}){reads++;page(found=false,next=15)}};assertEquals(1,reads)
        assertNull(NativeDerivedEvidencePresentation.load(row(),{true}){page(found=false,next=0)})
    }
}
