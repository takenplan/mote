package dev.mote.collector

import android.content.ContentUris
import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.CalendarContract
import android.system.Os
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Explicitly selected generated-only final acceptance. No fixture proposals or model calls.
 * Root supplies real, already authorized action IDs between these three separate invocations.
 * Calendar completion is a Mote resolution; this test never describes it as an OS mutation.
 */
@RunWith(AndroidJUnit4::class)
class FinalCalendarJourneyInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val settings get() = Settings(context)
    private val stateFile get() = File(context.noBackupFilesDir, "final-calendar-journey-state.json")
    private val resultDirectory get() = File(context.filesDir, "final-calendar-results").apply { mkdirs(); Os.chmod(path, 448) }

    private fun privateJson(file: File): JSONObject {
        require(file.isFile && file.length() in 1..1_048_576)
        require(Os.stat(file.path).st_mode and 63 == 0) { "Private acceptance files must be owner-only" }
        return JSONObject(file.readText())
    }
    private fun writePrivate(file: File, value: JSONObject) {
        file.parentFile!!.mkdirs()
        val temporary = File(file.parentFile, file.name + ".tmp")
        FileOutputStream(temporary).use { output -> Os.chmod(temporary.path, 384); output.write(value.toString(2).toByteArray()); output.fd.sync() }
        check(temporary.renameTo(file)); Os.chmod(file.path, 384)
    }
    private fun configuration(): JSONObject {
        assumeTrue(InstrumentationRegistry.getArguments().getString("nativeFinalCalendar") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        require(!settings.enabled && !ProjectionService.running && !CaptureAccessibilityService.connected)
        val config = privateJson(File(context.filesDir, "final-calendar-journey.json"))
        require(config.getInt("schema") == 1 && config.getBoolean("generatedOnly"))
        UUID.fromString(config.getString("sessionId"))
        val origin = java.net.URI(config.getString("origin"))
        require(origin.scheme == "http" && origin.host in setOf("127.0.0.1", "localhost") && origin.port > 0 && origin.path.orEmpty().isEmpty() && origin.userInfo == null && origin.query == null && origin.fragment == null)
        require(config.getString("ownerToken").length >= 32 && config.getString("collectorToken").length >= 32)
        require(config.getString("deviceId") == settings.deviceId) { "Use a connection paired to this actual generated device; never rewrite its identity" }
        require(settings.read().server.isBlank() || settings.read().server.trimEnd('/') == config.getString("origin"))
        return config
    }
    private fun owner(config: JSONObject) = CentralClient(config.getString("origin"), config.getString("ownerToken"))
    private fun device(config: JSONObject) = CentralClient(config.getString("origin"), config.getString("collectorToken"))
    private fun verifyIdentities(config: JSONObject) {
        assertEquals("owner", owner(config).get("/api/connections/self").getJSONObject("credential").getString("scope"))
        val credential = device(config).get("/api/connections/self").getJSONObject("credential")
        assertEquals("collector", credential.getString("scope")); assertEquals(settings.deviceId, credential.getString("deviceId"))
    }
    private fun bind(config: JSONObject) {
        verifyIdentities(config)
        ConnectionGuard.change(context, config.getString("origin"), bindLocal = true) {
            val before = settings.read()
            settings.save(before.copy(server = config.getString("origin"), token = config.getString("collectorToken"), deviceName = "Generated final Android calendar", debugHttp = true,
                authSignedOut = false, authExpiresAt = 0, authProcess = "", syncMode = "manual", syncPaused = true), confirmCentralEndpoint = true)
        }
        assertTrue(CalendarActions(context).permissions())
    }
    private fun state(config: JSONObject): JSONObject = privateJson(stateFile).also {
        require(it.getInt("schema") == 1 && it.getString("sessionId") == config.getString("sessionId") && it.getString("origin") == config.getString("origin") && it.getString("deviceId") == config.getString("deviceId"))
    }
    private fun calendarUri(state: JSONObject): Uri = CalendarContract.Calendars.CONTENT_URI.buildUpon()
        .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
        .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, state.getString("account"))
        .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
        .appendPath(state.getString("calendarId")).build()
    private fun verifyOwnedCalendar(state: JSONObject, allowMissing: Boolean = false): Boolean {
        val id = state.getString("calendarId").toLong()
        val uri = ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, id)
        return requireNotNull(context.contentResolver.query(uri, arrayOf(CalendarContract.Calendars.ACCOUNT_NAME, CalendarContract.Calendars.ACCOUNT_TYPE), null, null, null)).use { cursor ->
            if (!cursor.moveToFirst()) { require(allowMissing) { "The prepared local calendar is no longer available" }; false }
            else { require(cursor.getString(0) == state.getString("account") && cursor.getString(1) == CalendarContract.ACCOUNT_TYPE_LOCAL); true }
        }
    }
    private fun writeResult(phase: String, config: JSONObject, result: JSONObject): Unit = writePrivate(File(resultDirectory, phase + ".json"), result
        .put("schema", 1).put("generatedOnly", true).put("sessionId", config.getString("sessionId")).put("deviceId", config.getString("deviceId")))

    @Test fun prepare() {
        val config = configuration(); verifyIdentities(config)
        if (stateFile.exists()) {
            val existing = state(config); require(!existing.optBoolean("cleaned")); verifyOwnedCalendar(existing); bind(config)
            val current = CalendarActions(context).calendars(); require(current.length() == 1 && current.getJSONObject(0).getString("id") == existing.getString("calendarId")); CalendarActions(context).connect()
            writeResult("prepare", config, JSONObject().put("calendarId", existing.getString("calendarId")).put("reusedPreparedCalendar", true)); return
        }
        val previous = settings.read()
        require(CalendarActions(context).permissions()) { "Explicitly grant calendar permission to this generated Dev package before prepare" }
        requireNotNull(context.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, arrayOf("_id"), null, null, null)).use { require(it.count == 0) { "A dedicated empty generated CalendarProvider is required; never publish unrelated calendars" } }
        require(CalendarActions(context).calendars().length() == 0)
        val record = JSONObject().put("schema", 1).put("sessionId", config.getString("sessionId")).put("origin", config.getString("origin")).put("deviceId", settings.deviceId)
            .put("account", "generated-final-calendar-" + UUID.randomUUID()).put("priorConfiguration", ConfigurationArchive.encode(previous, true))
            .put("priorAuthSignedOut", previous.authSignedOut).put("priorAuthExpiresAt", previous.authExpiresAt).put("priorAuthProcess", previous.authProcess)
            .put("executed", JSONArray()).put("cleaned", false)
        var inserted: Uri? = null
        try {
            val base = CalendarContract.Calendars.CONTENT_URI.buildUpon().appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, record.getString("account")).appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL).build()
            inserted = requireNotNull(context.contentResolver.insert(base, ContentValues().apply {
                put(CalendarContract.Calendars.ACCOUNT_NAME, record.getString("account")); put(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
                put(CalendarContract.Calendars.NAME, record.getString("account")); put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, "Generated final acceptance calendar")
                put(CalendarContract.Calendars.OWNER_ACCOUNT, record.getString("account")); put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER)
                put(CalendarContract.Calendars.VISIBLE, 1); put(CalendarContract.Calendars.SYNC_EVENTS, 1); put(CalendarContract.Calendars.CALENDAR_TIME_ZONE, "UTC")
            }))
            record.put("calendarId", ContentUris.parseId(inserted).toString()); writePrivate(stateFile, record)
            bind(config); val available = CalendarActions(context).calendars(); require(available.length() == 1 && available.getJSONObject(0).getString("id") == record.getString("calendarId"))
            val calendars = CalendarActions(context).connect()
            assertEquals(1, calendars.length()); assertEquals(record.getString("calendarId"), calendars.getJSONObject(0).getString("id"))
            val declaration = device(config).get("/api/device-action-capabilities").getJSONObject("declaration")
            assertEquals("granted", declaration.getString("permission")); assertEquals(record.getString("calendarId"), declaration.getJSONArray("calendars").getJSONObject(0).getString("id"))
            writeResult("prepare", config, JSONObject().put("calendarId", record.getString("calendarId")).put("declarationRevision", declaration.getLong("revision")).put("connectionId", declaration.getString("connectionId")).put("localOnly", true).put("calendarPermissionPromptProven", false))
        } catch (error: Throwable) {
            if (inserted != null) { verifyOwnedCalendar(record); assertEquals(1, context.contentResolver.delete(calendarUri(record), null, null)) }
            restore(record); stateFile.delete(); throw error
        }
    }

    private fun event(id: String, state: JSONObject): JSONObject? {
        require(id.toLong() > 0)
        return requireNotNull(context.contentResolver.query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id.toLong()),
            arrayOf("_id", "calendar_id", "title", "description", "dtstart", "dtend", "allDay", "eventLocation", "eventTimezone"), "deleted=0", null, null)).use { cursor ->
            if (!cursor.moveToFirst()) null else JSONObject().put("id", cursor.getString(0)).put("calendarId", cursor.getString(1)).put("title", cursor.getString(2))
                .put("description", cursor.getString(3)).put("start", cursor.getLong(4)).put("end", cursor.getLong(5)).put("allDay", cursor.getInt(6)).put("location", cursor.getString(7)).put("timeZone", cursor.getString(8)).also { assertEquals(state.getString("calendarId"), it.getString("calendarId")) }
        }
    }
    private fun target(action: JSONObject, state: JSONObject) {
        assertEquals(state.getString("deviceId"), action.getJSONObject("target").getString("deviceId"))
        assertEquals(state.getString("calendarId"), action.getJSONObject("target").getString("calendarId"))
        action.optJSONObject("related")?.optJSONObject("target")?.let { assertEquals(state.getString("deviceId"), it.getString("deviceId")); assertEquals(state.getString("calendarId"), it.getString("calendarId")) }
    }
    private fun grant(config: JSONObject, state: JSONObject): JSONObject {
        val id = UUID.fromString(config.getString("grantId")).toString(); val source = config.getString("sourceId"); require(source.isNotBlank())
        val grants = owner(config).get("/api/action-capabilities").getJSONArray("grants")
        val selected = (0 until grants.length()).map { grants.getJSONObject(it) }.single { it.getString("id") == id }
        require(selected.getBoolean("available") && selected.getString("state") == "active" && selected.getBoolean("executionEnabled")); target(selected, state)
        val sources = selected.getJSONObject("inputs").getJSONArray("sources")
        require(sources.length() == 1 && sources.getJSONObject(0).getString("sourceId") == source) { "Final acceptance uses only the root-selected generated input source" }
        return selected
    }
    private fun receipt(config: JSONObject, id: String) = owner(config).get("/api/actions/" + UUID.fromString(id))

    @Test fun executeSelected() {
        val config = configuration(); val record = state(config); require(!record.optBoolean("cleaned")); verifyOwnedCalendar(record); bind(config)
        val selection = config.getJSONArray("selectedActions"); require(selection.length() in 1..8)
        val seen = mutableSetOf<String>(); val results = JSONArray()
        for (index in 0 until selection.length()) {
            val selected = selection.getJSONObject(index); val id = UUID.fromString(selected.getString("id")).toString(); require(seen.add(id))
            val kind = selected.getString("kind"); require(kind in setOf("calendar.create", "calendar.update", "calendar.cancel", "calendar.complete"))
            val allowed = grant(config, record); var action = receipt(config, id); assertEquals(id, action.getString("id")); assertEquals(kind, action.getString("kind")); target(action, record)
            assertEquals(allowed.getString("id"), action.getJSONObject("managed").getString("grantId")); assertEquals(allowed.getLong("revision"), action.getJSONObject("managed").getLong("grantRevision"))
            val deadline = SystemClock.elapsedRealtime() + 120_000
            var executorTriggeredByTest = false
            if (kind != "calendar.complete" && action.getString("status") != "succeeded") {
                var delivery: JSONObject? = null
                while (delivery == null && SystemClock.elapsedRealtime() < deadline) {
                    val rows = device(config).get("/api/managed-calendar-deliveries").getJSONArray("items")
                    delivery = (0 until rows.length()).map { rows.getJSONObject(it) }.singleOrNull { it.getString("id") == id }
                    if (delivery == null) { action = receipt(config, id); if (action.getString("status") == "succeeded") break; require(action.getString("status") !in setOf("stale", "dismissed", "uncertain")); Thread.sleep(100) }
                }
                if (action.getString("status") != "succeeded") {
                    val current = requireNotNull(delivery) { "The exact selected action has no authorized delivery" }
                    val operationId = UUID.fromString(current.getString("operationId")).toString()
                    action = receipt(config, id); target(action, record); assertEquals(operationId, action.getString("operationId")); grant(config, record)
                    // Exact same production executor used inside deliver/worker; no blanket queue consumption.
                    // Any lost/uncertain receipt propagates. This test never automatically repeats a write.
                    record.put("pending", JSONObject().put("id", id).put("kind", kind).put("operationId", operationId)); writePrivate(stateFile, record)
                    executorTriggeredByTest = true
                    CalendarActions(context).execute(id, operationId)
                }
            }
            do { action = receipt(config, id); if (action.getString("status") == "succeeded") break; require(action.getString("status") !in setOf("stale", "dismissed", "uncertain")); Thread.sleep(100) } while (SystemClock.elapsedRealtime() < deadline)
            assertEquals("succeeded", action.getString("status")); target(action, record)
            val related = action.optJSONObject("related")
            val nativeId = if (kind == "calendar.complete") requireNotNull(related).getString("externalId") else action.getString("externalId")
            val actual = event(nativeId, record)
            if (kind == "calendar.cancel") {
                assertNull(actual); assertEquals("cancelled", receipt(config, requireNotNull(related).getString("actionId")).getString("resolution"))
            } else {
                assertNotNull(actual)
                if (kind == "calendar.complete") assertEquals("completed", receipt(config, requireNotNull(related).getString("actionId")).getString("resolution"))
                val expected = action.getJSONObject("event"); val times = CalendarActionRules.times(expected)
                assertEquals(expected.getString("title"), actual!!.getString("title")); assertEquals(times.first, actual.getLong("start")); assertEquals(times.second, actual.getLong("end")); assertEquals(if(expected.getBoolean("allDay"))1 else 0, actual.getInt("allDay")); assertEquals(expected.getString("location"), actual.optString("location")); assertEquals(if(expected.getBoolean("allDay"))"UTC" else expected.getString("timeZone"), actual.getString("timeZone"))
                assertTrue(actual.getString("description").contains(CalendarActionRules.marker(related?.getString("actionId") ?: id)))
            }
            val result = JSONObject().put("id", id).put("kind", kind).put("receipt", action).put("nativeEventPresent", actual != null).put("nativeExternalId", nativeId)
                .put("calendarId", record.getString("calendarId")).put("osMutationClaimed", kind != "calendar.complete").put("executorTriggeredByTest", executorTriggeredByTest).put("unattendedWorkerScheduleProven", false)
            record.remove("pending"); record.getJSONArray("executed").put(result); writePrivate(stateFile, record); results.put(result)
        }
        writeResult("execute-selected", config, JSONObject().put("results", results).put("onlySelectedIds", true).put("realModelInvokedByTest", false))
    }

    private fun restore(record: JSONObject) {
        val restored = ConfigurationArchive.decode(record.getString("priorConfiguration"), settings.read()).copy(authSignedOut = record.getBoolean("priorAuthSignedOut"), authExpiresAt = record.getLong("priorAuthExpiresAt"), authProcess = record.getString("priorAuthProcess"))
        settings.save(restored, confirmCentralEndpoint = true)
    }
    @Test fun cleanup() {
        val config = configuration(); val record = state(config)
        if (!record.optBoolean("cleaned")) {
            require(CalendarActions(context).permissions())
            if (verifyOwnedCalendar(record, allowMissing = true)) assertEquals("Delete only the prepared unique local calendar ID", 1, context.contentResolver.delete(calendarUri(record), null, null))
            assertFalse(verifyOwnedCalendar(record, allowMissing = true)); restore(record)
            record.put("cleaned", true).remove("priorConfiguration"); record.remove("priorAuthProcess"); writePrivate(stateFile, record)
        }
        writeResult("cleanup", config, JSONObject().put("calendarId", record.getString("calendarId")).put("cleaned", true).put("rootMustRevokeGeneratedGrant", true))
        assertFalse(settings.enabled)
    }
}
