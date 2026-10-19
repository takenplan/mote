package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CentralFileViewTest {
    private val id = "3435b8a3-d3a1-5dfc-a819-8379d1d97b01"
    private val original = "original:" + "a".repeat(64)
    private val artifact = "b".repeat(64)
    private fun metadata() = JSONObject().put("captureId", id).put("sourceId", "same-source").put("originalGeneration", 2)
        .put("item", JSONObject().put("externalId", "same-file").put("title", "Generated reference").put("mimeType", "text/plain"))
        .put("hasOriginal", false).put("processing", JSONObject().put("current", true)).put("artifacts", JSONArray())
    private fun archived(current: Boolean) = metadata().put("hasOriginal", true).put("originalRef", original)
        .put("processing", JSONObject().put("current", current).put("artifactId", artifact))
        .put("artifacts", JSONArray().put(JSONObject().put("id", artifact).put("kind", "transcript")))

    @Test fun metadataCatalogHasNoChunkByteExportOrProcessingCapability() {
        // Metadata carries no original/hash, even if unknown metadata fields exist.
        val row = metadata().put("sha256", JSONObject().put("untrusted", true))
        val view = CentralFileView.read(row)
        assertNull(view.originalRef); assertNull(view.artifactId); assertFalse(view.hasOriginal)
        assertFalse(view.canEdit); assertFalse(view.canProcess); assertFalse(view.canExport)
    }

    @Test fun historicalTranscriptKeepsReadsAndExportsWithoutGrantingEditsOrRetry() {
        val view = CentralFileView.read(archived(false))
        assertEquals(original, view.originalRef); assertEquals(artifact, view.artifactId)
        assertTrue(view.hasOriginal); assertTrue(view.canExport)
        assertFalse(view.canEdit); assertFalse(view.canProcess)
        val current = CentralFileView.read(archived(true))
        assertTrue(current.canEdit); assertTrue(current.canProcess)
    }

    @Test fun deletionDescriptorUsesSameGenerationForMetadataAndKeepsItsOptionalOriginalAnchor() {
        val row = metadata(); val descriptor = CentralFileView.deleteDescriptor(row)
        assertEquals(id, descriptor.getString("captureId")); assertEquals(2, descriptor.getInt("originalGeneration"))
        assertEquals("same-source", descriptor.getString("sourceId")); assertEquals("same-file", descriptor.getString("externalId"))
        assertFalse(descriptor.has("originalRef"))
        row.put("originalGeneration", 3); row.getJSONObject("item").put("externalId", "replacement")
        assertEquals(2, descriptor.getInt("originalGeneration")); assertEquals("same-file", descriptor.getString("externalId"))
        val archived = CentralFileView.deleteDescriptor(archived(true))
        assertEquals(original, archived.getString("originalRef")); assertEquals(2, archived.getInt("originalGeneration"))
    }

    @Test fun claimedCapabilitiesAndDeleteGenerationsRequireTheirActualProtocolAnchors() {
        assertThrows(Exception::class.java) { CentralFileView.read(metadata().put("hasOriginal", true)) }
        assertThrows(Exception::class.java) { CentralFileView.read(metadata().put("originalRef", "other-account-selector")) }
        assertThrows(Exception::class.java) { CentralFileView.read(metadata().put("processing", JSONObject().put("current", true).put("artifactId", "not-an-artifact"))) }
        for (invalid in listOf<Any>(-1, 0.5, "2", 9007199254740991.0))
            assertThrows(Exception::class.java) { CentralFileView.deleteDescriptor(metadata().put("originalGeneration", invalid)) }
    }
}
