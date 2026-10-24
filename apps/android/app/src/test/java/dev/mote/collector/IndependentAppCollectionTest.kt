package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/** Prevent selecting one capture channel from implicitly authorizing another. */
class IndependentAppCollectionTest {
    private val app = "generated.app"
    private fun windows(vararg auxiliary: String) = WindowSnapshot(setOf(app, *auxiliary), app, true)

    @Test fun allEightSelectionsRoundTripAndAuthorizeOnlySelectedChannels() {
        val expected = listOf(
            Triple(false, false, false) to "off", Triple(true, false, false) to "activity",
            Triple(false, true, false) to "screenshot", Triple(false, false, true) to "structured",
            Triple(true, true, false) to "duration_screenshot", Triple(true, false, true) to "duration_structured",
            Triple(false, true, true) to "screenshot_structured", Triple(true, true, true) to "content")
        assertEquals(8, AppCollectionMode.entries.size)
        for ((flags, wire) in expected) {
            val mode = AppCollectionMode.fromChoices(flags.first, flags.second, flags.third)
            assertEquals(wire, mode.wire)
            val rules = AppCollectionRules.fromLines(AppCollectionMode.OFF, "$app=$wire")
            val restored = AppCollectionRules.parse(rules.json())
            assertEquals(mode, restored.selection(windows(), emptySet()))
            assertEquals(flags.first, restored.allows(windows(), emptySet(), AppCollectionChannel.DURATION))
            assertEquals(flags.second, restored.allows(windows(), emptySet(), AppCollectionChannel.SCREENSHOT))
            assertEquals(flags.third, restored.allows(windows(), emptySet(), AppCollectionChannel.STRUCTURED))
            assertEquals(flags.third, restored.allows(windows(), emptySet(), AppCollectionChannel.OCR))
        }
    }

    @Test fun overlayPermissionBlocksOnlyItsContentChannelAndNeverCreatesDuration() {
        val rules = AppCollectionRules.fromLines(AppCollectionMode.OFF, "$app=content\ngenerated.overlay=screenshot")
        val visible = windows("generated.overlay")
        assertTrue(rules.allows(visible, emptySet(), AppCollectionChannel.DURATION))
        assertTrue(rules.allows(visible, emptySet(), AppCollectionChannel.SCREENSHOT))
        assertFalse(rules.allows(visible, emptySet(), AppCollectionChannel.STRUCTURED))
        assertFalse(rules.allows(visible, emptySet(), AppCollectionChannel.OCR))
        assertEquals(AppCollectionMode.DURATION_SCREENSHOT, rules.selection(visible, emptySet()))
        val noDuration = AppCollectionRules.fromLines(AppCollectionMode.OFF, "$app=screenshot\ngenerated.overlay=content")
        assertEquals(AppCollectionMode.SCREENSHOT, noDuration.selection(visible, emptySet()))
    }

    @Test fun excludedOrUnidentifiedAuxiliaryWindowCannotLeakEitherContentChannel() {
        val rules = AppCollectionRules.fromLines(AppCollectionMode.ACTIVITY, "$app=content")
        for (channel in AppCollectionChannel.entries) {
            assertFalse(rules.allows(windows("generated.private"), setOf("generated.private"), channel))
            assertFalse(rules.allows(WindowSnapshot(setOf(app), app, false), emptySet(), channel))
        }
        val unidentified = WindowSnapshot(emptySet(), null, false)
        assertEquals(AppCollectionMode.OFF, rules.selection(unidentified, emptySet()))
    }

    @Test fun defaultAppliesToNewAppsWithoutChangingExplicitSelections() {
        val rules = AppCollectionRules.fromLines(AppCollectionMode.STRUCTURED, "$app=screenshot")
        assertEquals(AppCollectionMode.SCREENSHOT, rules.selection(windows(), emptySet()))
        assertEquals(AppCollectionMode.STRUCTURED, rules.selection(WindowSnapshot(setOf("generated.new"), "generated.new", true), emptySet()))
    }

    @Test fun localOcrRequiresExplicitSelectionAndPortableConfigurationPreservesIt() {
        val fresh = CollectorConfig(deviceName = "Generated phone")
        assertFalse(fresh.localContentOcr)
        val selected = fresh.copy(localContentOcr = true, appCollectionRules = AppCollectionRules.fromLines(AppCollectionMode.OFF, "$app=structured").json())
        val exported = JSONObject(ConfigurationArchive.encode(selected))
        assertFalse(exported.getJSONObject("settings").has("enabled"))
        val restored = ConfigurationArchive.decode(exported.toString(), fresh)
        assertTrue(restored.localContentOcr)
        assertEquals(AppCollectionMode.STRUCTURED, restored.collectionRules.apps[app])
        val settings = exported.getJSONObject("settings")
        settings.put("localContentOcr", "true")
        assertThrows(IllegalStateException::class.java) { ConfigurationArchive.decode(exported.toString(), fresh) }
    }

    @Test fun projectionDoesNotPretendStructuredSelectionWillExecute() {
        val fresh = CollectorConfig(deviceName = "Generated phone", mode = "projection", appCollectionRules = AppCollectionRules.fromLines(AppCollectionMode.SCREENSHOT, "").json())
        fresh.validate()
        assertThrows(IllegalArgumentException::class.java) {
            fresh.copy(appCollectionRules = AppCollectionRules.fromLines(AppCollectionMode.STRUCTURED, "").json()).validate()
        }
    }

    @Test fun arbitraryNamedFieldImportRequiresExactInstalledAppVersionWithoutChangingPolicy() {
        val rule = JSONObject().put("formatVersion", 3).put("id", "generated.app.control")
            .put("version", "1").put("platform", "android").put("appId", app).put("appVersion", "2.5").put("kind", "control")
            .put("fields", JSONObject().put("selected_state", JSONObject().put("select", JSONObject().put("resourceId", "$app:id/switch"))
                .put("source", "state").put("required", true)))
        val raw = JSONArray().put(rule).toString()
        val draft = CollectorConfig(deviceName = "Generated phone")
        val merged = AppPageSetup.merge(draft.uiPageRules, raw, app, "2.5")
        assertEquals(setOf("selected_state"), AppPageSetup.adapters(merged, app, "2.5").single().fields)
        assertEquals(AppCollectionMode.ACTIVITY, draft.copy(uiPageRules = merged).collectionRules.defaultMode)
        assertThrows(IllegalArgumentException::class.java) { AppPageSetup.merge("[]", raw, app, "2.6") }
        assertThrows(IllegalArgumentException::class.java) { AppPageSetup.merge("[]", raw, "generated.other", "2.5") }
    }
}
