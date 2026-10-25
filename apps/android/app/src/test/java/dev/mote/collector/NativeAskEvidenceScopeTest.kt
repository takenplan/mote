package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class NativeAskEvidenceScopeTest {
    @Test fun `record navigation cannot alter retryable question or accepted scope`() {
        val first = UUID.randomUUID().toString(); val other = UUID.randomUUID().toString()
        val pending = JSONObject().put("id", UUID.randomUUID().toString()).put("input", JSONObject().put("question", "Generated exact question").put("evidenceIds", JSONArray().put(first)))
        val state = JSONObject().put("pending", pending).put("question", "Generated exact question").put("evidenceIds", JSONArray().put(first))
        val before = state.toString()
        assertFalse(NativeAskEvidenceScope.selectOnly(state, other)); assertEquals(before, state.toString())
        assertTrue(NativeAskEvidenceScope.selectOnly(state, first)); assertEquals(before, state.toString())
    }
    @Test fun `running question stays scoped and completed composer accepts a new explicit record`() {
        val first = UUID.randomUUID().toString(); val other = UUID.randomUUID().toString()
        val state = JSONObject().put("runStatus", "running").put("evidenceIds", JSONArray().put(first))
        assertFalse(NativeAskEvidenceScope.selectOnly(state, other)); assertEquals(first, state.getJSONArray("evidenceIds").getString(0))
        state.put("runStatus", "completed")
        assertTrue(NativeAskEvidenceScope.selectOnly(state, other)); assertEquals(other, state.getJSONArray("evidenceIds").getString(0))
    }
    @Test fun `wire distinguishes inherited scope from explicit clear and selected record`() {
        val state = JSONObject(); val inherited = JSONObject()
        NativeAskEvidenceScope.writeInput(state, inherited); assertFalse(inherited.has("evidenceIds"))
        val id = UUID.randomUUID().toString(); NativeAskEvidenceScope.selectOnly(state, id)
        val selected = JSONObject(); NativeAskEvidenceScope.writeInput(state, selected); assertEquals(id, selected.getJSONArray("evidenceIds").getString(0))
        assertTrue(NativeAskEvidenceScope.clear(state))
        val cleared = JSONObject(); NativeAskEvidenceScope.writeInput(state, cleared); assertTrue(cleared.has("evidenceIds")); assertTrue(cleared.isNull("evidenceIds"))
    }
    @Test fun `history restores accepted selection without undoing a local explicit clear`() {
        val id = UUID.randomUUID().toString(); val conversation = JSONObject().put("scope", JSONObject().put("evidenceIds", JSONArray().put(id)))
        val state = JSONObject(); NativeAskEvidenceScope.restore(state, conversation); assertEquals(id, state.getJSONArray("evidenceIds").getString(0))
        NativeAskEvidenceScope.clear(state); NativeAskEvidenceScope.restore(state, conversation); assertTrue(state.isNull("evidenceIds"))
        state.remove("scopeDirty"); NativeAskEvidenceScope.restore(state, conversation); assertEquals(id, state.getJSONArray("evidenceIds").getString(0))
    }
    @Test fun `clear while answering leaves accepted request and scope untouched`() {
        val state = JSONObject().put("runStatus", "running").put("evidenceIds", JSONArray().put(UUID.randomUUID().toString()))
        val before = state.toString(); assertFalse(NativeAskEvidenceScope.clear(state)); assertEquals(before, state.toString())
    }

    @Test fun `record entry is a reference and explicit strict mode stays distinct through restore`() {
        val id = UUID.randomUUID().toString(); val state = JSONObject()
        assertTrue(NativeAskEvidenceScope.select(state, id))
        val input = JSONObject(); NativeAskEvidenceScope.writeInput(state, input)
        assertEquals(id, input.getJSONArray("anchorEvidenceIds").getString(0)); assertTrue(input.isNull("evidenceIds"))
        val restored = JSONObject(); NativeAskEvidenceScope.restore(restored, JSONObject().put("scope", input))
        assertEquals(id, restored.getJSONArray("anchorEvidenceIds").getString(0))
        assertTrue(NativeAskEvidenceScope.selectOnly(restored, id)); assertTrue(restored.isNull("anchorEvidenceIds"))
        assertEquals(id, restored.getJSONArray("evidenceIds").getString(0))
        restored.put("pending", JSONObject().put("input", input)); val before = restored.toString()
        assertFalse(NativeAskEvidenceScope.selectOnly(restored, id)); assertEquals(before, restored.toString())
        assertTrue(NativeAskEvidenceScope.select(restored, id)); assertEquals(before, restored.toString())
    }
}
