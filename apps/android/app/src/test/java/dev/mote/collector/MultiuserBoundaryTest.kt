package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class MultiuserBoundaryTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun `M01 Wire2 is accepted by the production handshake consumer`() {
        assertEquals(ProtocolRange(2, 2), ProtocolCompatibility.requireCompatible(JSONObject().put("min", 2).put("max", 2)))
        assertEquals("2", ProtocolCompatibility.headers[ProtocolCompatibility.HEADER])
    }

    @Test fun `unbound format3 is rejected before any old file changes`() {
        val root = temporary.newFolder()
        val marker = File(root, ".mote-local-format").apply { writeText("3") }
        val queue = File(root, "queue").apply { mkdirs() }
        val bytes = File(queue, "generated-original").apply { writeText("synthetic A only") }
        assertThrows(IllegalStateException::class.java) { LocalDataFormat.requireCurrent(root) }
        assertEquals("3", marker.readText())
        assertEquals("synthetic A only", bytes.readText())
        assertEquals(setOf(".mote-local-format", "queue"), root.list()!!.toSet())
    }
}
