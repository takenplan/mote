package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Parcel
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant
import java.util.UUID

/** Generated invitations only; no camera, screenshot, network or model is used. */
@RunWith(AndroidJUnit4::class)
class ConnectionPickerStateInstrumentedTest {
    @Test fun pendingScanStaysOutOfSavedStateAndSurvivesNativeRecreation() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val before = Settings(context).read()
        require(!before.enabled)
        val node = "https://generated-picker.invalid"
        val code = "P".repeat(43)
        val invitation = JSONObject().put("format", "mote.connection").put("version", 2)
            .put("deploymentId", UUID.randomUUID().toString()).put("userId", UUID.randomUUID().toString())
            .put("purpose", "device").put("serverUrl", node).put("code", code)
            .put("expiresAt", Instant.ofEpochMilli(System.currentTimeMillis() + 600_000).toString()).toString()
        ActivityScenario.launch(ConnectionActivity::class.java).awaitUiText(MoteI18n.text("确认连接此节点")).use { scenario ->
            scenario.onActivity { activity ->
                // Arm the real fencing state and hold the result at the existing busy boundary.
                val selection = ConnectionActivity::class.java.declaredClasses.single { it.simpleName == "PickerSelection" }
                    .getDeclaredConstructor(String::class.java, String::class.java).apply { isAccessible = true }
                    .newInstance(SourceRules.hash(before.toString()), before.ownerKey())
                ConnectionActivity::class.java.getDeclaredField("selection").apply { isAccessible = true }.set(activity, selection)
                ConnectionActivity::class.java.getDeclaredField("working").apply { isAccessible = true }.setBoolean(activity, true)
                ConnectionActivity::class.java.getDeclaredMethod("onActivityResult", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, Intent::class.java)
                    .apply { isAccessible = true }.invoke(activity, 1, Activity.RESULT_OK, Intent().putExtra("invitation", invitation))
                assertNotNull(ConnectionActivity::class.java.getDeclaredField("pendingPicker").apply { isAccessible = true }.get(activity))
                val saved = Bundle()
                ConnectionActivity::class.java.getDeclaredMethod("onSaveInstanceState", Bundle::class.java).apply { isAccessible = true }.invoke(activity, saved)
                assertEquals(SourceRules.hash(before.toString()), saved.getString("pickerSelectionStamp"))
                assertEquals(before.ownerKey(), saved.getString("pickerSelectionOwner"))
                assertFalse(saved.containsKey("pendingPickerPayload"))
                assertFalse(saved.containsKey("pendingPickerRequest"))
                val parcel = Parcel.obtain()
                try {
                    saved.writeToParcel(parcel, 0)
                    val bytes = parcel.marshall()
                    assertFalse(String(bytes, Charsets.UTF_8).contains(code))
                    assertFalse(String(bytes, Charsets.UTF_16LE).contains(code))
                } finally { parcel.recycle() }
            }
            // Android must transfer the pending result in memory while retaining
            // only fencing metadata in the Bundle. The refreshed page consumes it.
            scenario.recreate()
            scenario.awaitUiText(MoteI18n.text("将连接：{0}\n有效至：{1}\n请确认后连接。", node, "").substringBefore('\n'))
            scenario.onActivity { activity ->
                assertNull(ConnectionActivity::class.java.getDeclaredField("pendingPicker").apply { isAccessible = true }.get(activity))
                assertNull(ConnectionActivity::class.java.getDeclaredField("selection").apply { isAccessible = true }.get(activity))
            }
        }
        assertEquals(before, Settings(context).read())
    }
}
