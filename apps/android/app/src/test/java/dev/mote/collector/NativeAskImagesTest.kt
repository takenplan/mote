package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeAskImagesTest {
    private fun selection(id:String)=JSONObject().put("selectionId",id).put("uri","content://generated/$id").put("name","Generated image").put("status","uploading")
    @Test fun `mixed invalid picker references cannot partially append to a preexisting image draft`() {
        val state=JSONObject().put("question","Generated later private draft").put("imageUploads",JSONArray().put(selection("generated-existing")))
        val before=state.toString()
        assertThrows(IllegalArgumentException::class.java) { NativeAskImages.stageReferences(state,listOf("content://generated/valid","file:///generated/invalid")) }
        assertEquals(before,state.toString())
    }
    @Test fun `late upload never restores removed images or overwrites later text and model`() {
        val item=selection("generated-one");val state=JSONObject().put("question","Generated later text").put("modelOverride","generated-later-model").put("imageUploads",JSONArray().put(item))
        val result=JSONObject(item.toString()).put("status","ready").put("id","00000000-0000-4000-8000-000000000001")
        NativeAskImages.merge(state,result);assertEquals("Generated later text",state.getString("question"));assertEquals("generated-later-model",state.getString("modelOverride"));assertEquals(1,state.getJSONArray("attachments").length())
        state.put("imageUploads",JSONArray().put(selection("generated-removed")));NativeAskImages.remove(state,"generated-removed")
        NativeAskImages.merge(state,selection("generated-removed").put("status","ready").put("id","00000000-0000-4000-8000-000000000002"));assertEquals(1,state.getJSONArray("attachments").length())
    }
    @Test fun `unknown question body and private image references are fenced independently`() {
        val item=selection("generated-held");val pending=JSONObject().put("id","00000000-0000-4000-8000-000000000001").put("input",JSONObject().put("question","Generated exact request").put("attachmentIds",JSONArray().put("accepted-image")))
        val state=JSONObject().put("pending",pending).put("imageUploads",JSONArray().put(item));val before=pending.toString()
        NativeAskImages.merge(state,JSONObject(item.toString()).put("status","ready").put("id","late-image"));assertFalse(state.has("attachments"));assertEquals(before,state.getJSONObject("pending").toString())
        NativeAskImages.recover(state);assertEquals("unconfirmed",state.getJSONArray("imageUploads").getJSONObject(0).getString("status"))
        NativeAskImages.clearReferences(state);assertFalse(state.has("imageUploads"));assertEquals(before,state.getJSONObject("pending").toString())
    }
}
