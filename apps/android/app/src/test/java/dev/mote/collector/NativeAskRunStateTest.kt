package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class NativeAskRunStateTest {
    private fun request(id:String)=JSONObject().put("id",id).put("input",JSONObject().put("question","Generated admitted question").put("attachmentIds",JSONArray().put("generated-image")))
    @Test fun `a newer unresolved admission takes precedence over a prior completed run`() {
        val old=UUID.randomUUID().toString();val next=UUID.randomUUID().toString()
        val state=JSONObject().put("runId",old).put("runStatus","completed").put("pending",request(next))
        assertEquals(next,NativeAskRunState.currentId(state))
        assertThrows(IllegalStateException::class.java) { NativeAskRunState.validate(JSONObject().put("id",old).put("status","completed"),next) }
        assertEquals(next,state.getJSONObject("pending").getString("id"))
    }
    @Test fun `missing accepted receipt retains exact body and adopted runs never invent one`() {
        val id=UUID.randomUUID().toString();val body=request(id)
        val state=JSONObject().put("runId",id).put("runStatus","running").put("activeRequest",body).put("question","Generated later draft")
        assertTrue(NativeAskRunState.missing(state));assertEquals(body.toString(),state.getJSONObject("pending").toString());assertEquals("running",state.getString("runStatus"));assertEquals("Generated later draft",state.getString("question"))
        val adopted=JSONObject().put("runId",id).put("runStatus","running");val before=adopted.toString()
        assertFalse(NativeAskRunState.missing(adopted));assertEquals(before,adopted.toString())
    }
    @Test fun `unknown or mismatched server states cannot release the admission`() {
        val id=UUID.randomUUID().toString()
        for(status in listOf("missing","unknown","","stopped"))assertThrows(IllegalStateException::class.java) { NativeAskRunState.validate(JSONObject().put("id",id).put("status",status),id) }
        for(status in NativeAskRunState.terminal+"running")NativeAskRunState.validate(JSONObject().put("id",id).put("status",status),id)
    }
    @Test fun `completion clears only its own unchanged composer draft and images`() {
        val id=UUID.randomUUID().toString()
        val state=JSONObject().put("activeRequest",request(id)).put("question","Generated admitted question").put("attachments",JSONArray().put(JSONObject().put("id","generated-image")))
        assertTrue(NativeAskRunState.completesCurrentDraft(state,id))
        state.put("question","Generated later draft");assertFalse(NativeAskRunState.completesCurrentDraft(state,id))
        state.put("question","Generated admitted question").put("attachments",JSONArray().put(JSONObject().put("id","generated-later-image")));assertFalse(NativeAskRunState.completesCurrentDraft(state,id))
        state.remove("activeRequest");assertFalse(NativeAskRunState.completesCurrentDraft(state,id))
    }
}
