package dev.mote.collector

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.CalendarContract
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Real WorkManager, settings/account entry points and CalendarProvider on an
 * isolated emulator. Only generated LOCAL calendars and synthetic host accounts.
 * Run after denied-calendar tests: grants remain until fixture package cleanup. */
@RunWith(AndroidJUnit4::class)
class CalendarRecoveryLifecycleInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun context(): Context = instrumentation.targetContext.also {
        require(it.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
    }
    private fun fixture() = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText())
    private fun waitFor(predicate: () -> Boolean) {
        val deadline = android.os.SystemClock.elapsedRealtime() + 60000
        while (!predicate()) {
            check(android.os.SystemClock.elapsedRealtime() < deadline) { "Generated calendar/recovery lifecycle deadline exceeded" }
            Thread.sleep(40)
        }
    }
    private fun ready(): Context = context().also { app ->
        waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null && !ConnectionGuard.changing() }
        WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
        MoteI18n.select(app, "zh-CN")
    }
    private fun login(app: Context, name: String) {
        val f = fixture()
        RuntimeSettings.replaceAccount(app) { Settings(app).signIn(f.getString("androidAddress"), f.getJSONObject(name).getString("token"), 2592000000) }
    }
    private fun apply(app: Context, next: CollectorConfig) {
        val previous = Settings(app).read()
        val done = CountDownLatch(1)
        val result = AtomicReference<kotlin.Result<RuntimeSettings.Applied>>()
        instrumentation.runOnMainSync { RuntimeSettings.apply(app, next, expected = previous) { result.set(it); done.countDown() } }
        check(done.await(150, TimeUnit.SECONDS)) { "Generated settings apply timed out" }
        result.get().getOrThrow()
    }
    private fun calendarWork(app: Context): WorkInfo? = WorkManager.getInstance(app)
        .getWorkInfosForUniqueWork("mote-calendar-delivery").get(10, TimeUnit.SECONDS).singleOrNull { !it.state.isFinished }
    private fun awaitCalendarWork(app: Context, previous: java.util.UUID? = null): WorkInfo {
        waitFor { calendarWork(app)?.id?.let { it != previous } == true }
        return calendarWork(app)!!
    }
    private fun setupAccount(app: Context) {
        val settings = Settings(app)
        settings.save(settings.read().copy(server = "", token = "", debugHttp = true, wifiOnly = false,
            syncMode = "manual", syncPaused = false, metadataEnabled = false, uploadedRetentionDays = 7))
        check(app.getSharedPreferences("mote", Context.MODE_PRIVATE).edit().putString("deviceId", "same-device").commit())
        login(app, "a")
        settings.save(settings.read().copy(syncMode = "manual", wifiOnly = false, metadataEnabled = false))
    }
    private fun createCalendar(app: Context): Long {
        instrumentation.uiAutomation.grantRuntimePermission(app.packageName, Manifest.permission.READ_CALENDAR)
        instrumentation.uiAutomation.grantRuntimePermission(app.packageName, Manifest.permission.WRITE_CALENDAR)
        val name = "generated-mote-parity-${java.util.UUID.randomUUID()}"
        val uri = CalendarContract.Calendars.CONTENT_URI.buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, name)
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, "LOCAL").build()
        val values = ContentValues().apply {
            put(CalendarContract.Calendars.ACCOUNT_NAME, name); put(CalendarContract.Calendars.ACCOUNT_TYPE, "LOCAL")
            put(CalendarContract.Calendars.NAME, name); put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, "Generated parity calendar")
            put(CalendarContract.Calendars.OWNER_ACCOUNT, name); put(CalendarContract.Calendars.CALENDAR_COLOR, 0xff336699.toInt())
            put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER)
            put(CalendarContract.Calendars.CALENDAR_TIME_ZONE, "UTC"); put(CalendarContract.Calendars.VISIBLE, 1)
            put(CalendarContract.Calendars.SYNC_EVENTS, 1)
        }
        return ContentUris.parseId(requireNotNull(app.contentResolver.insert(uri, values)))
    }
    private fun removeCalendar(app: Context, id: Long) {
        app.contentResolver.delete(ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, id), null, null)
    }
    private fun approve(app: Context, calendarId: Long): JSONObject {
        val client = CalendarActions(app, foreground = true)
        val rows = client.list().getJSONArray("items")
        val proposal = (0 until rows.length()).map(rows::getJSONObject).first { it.getString("status") == "proposed" }
        return client.confirm(proposal, proposal.getJSONObject("event"), calendarId.toString())
    }
    private fun action(app: Context, id: String): JSONObject {
        val rows = CentralAccess.requireClient(app).get("/api/actions?limit=100").getJSONArray("items")
        return (0 until rows.length()).map(rows::getJSONObject).single { it.getString("id") == id }
    }
    private fun eventCount(app: Context, calendarId: Long): Int = app.contentResolver.query(CalendarContract.Events.CONTENT_URI,
        arrayOf("_id"), "calendar_id=? AND deleted=0", arrayOf(calendarId.toString()), null)!!.use { it.count }

    @Test fun realCalendarRegistrationRestoresAfterSettingsAndSameAccountReloginWithoutBAdoption() {
        val app = ready(); setupAccount(app)
        val settings = Settings(app); val ownerA = settings.read().ownerKey()
        app.accountPreferences("calendar-actions").edit().clear().commit()
        val calendarId = createCalendar(app)
        try {
            CalendarActions(app, foreground = true).connect()
            assertTrue(app.accountPreferences("calendar-actions").getBoolean("connected", false))
            val connected = awaitCalendarWork(app)
            val initial = settings.read()
            apply(app, initial.copy(jpegQuality = if (initial.jpegQuality == 75) 76 else 75))
            val saved = awaitCalendarWork(app, connected.id)
            RuntimeSettings.replaceAccount(app) { settings.signOut() }
            waitFor { calendarWork(app) == null }
            login(app, "a")
            val relogged = awaitCalendarWork(app, saved.id)
            assertEquals(ownerA, settings.read().ownerKey())
            login(app, "b")
            assertNotEquals(ownerA, settings.read().ownerKey())
            assertFalse(app.accountPreferences("calendar-actions").getBoolean("connected", false))
            waitFor { calendarWork(app) == null }
            login(app, "a")
            awaitCalendarWork(app, relogged.id)
            val approved = approve(app, calendarId)
            assertEquals(0, eventCount(app, calendarId))
            // The settings entry point must restore and execute the actual
            // periodic WorkRequest; no direct Worker or internal delivery call.
            apply(app, settings.read().copy(syncMode = "realtime"))
            waitFor { action(app, approved.getString("id")).getString("status") == "succeeded" }
            assertEquals(1, eventCount(app, calendarId))
            val eventId = action(app, approved.getString("id")).getString("externalId")
            assertTrue(app.contentResolver.query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId.toLong()),
                arrayOf("description"), null, null, null)!!.use { it.moveToFirst() && it.getString(0).contains(CalendarActionRules.marker(approved.getString("id"))) })
        } finally {
            WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
            removeCalendar(app, calendarId)
        }
    }

    private fun views(root: View): List<View> = listOf(root) + if (root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()

    @Test fun realRecoveryPageReadsWorkerReportsAndRetiresOldControlsAndWorkOnSwitch() {
        val app = ready(); setupAccount(app)
        val settings = Settings(app)
        val originalGlobal = "Generated obsolete global report must never be rendered"
        app.getSharedPreferences("sync-recovery", Context.MODE_PRIVATE).edit().putString("message", originalGlobal).commit()
        QuickNotes.save(app, "Generated parity recovery note", "")
        val aState = app.accountPreferences("sync-recovery")
        ActivityScenario.launch<SyncRecoveryActivity>(Intent(app, SyncRecoveryActivity::class.java)).use { scenario ->
            fun shown(value: String): Boolean { var found = false; scenario.onActivity { found = views(it.window.decorView).filterIsInstance<TextView>().any { view -> view.text.toString() == value } }; return found }
            fun click(label: String): Button {
                lateinit var button: Button
                scenario.onActivity { activity -> button = views(activity.window.decorView).filterIsInstance<Button>().single { it.text.toString() == label }; button.performClick() }
                return button
            }
            click("检查两端记录状态")
            waitFor { aState.getString("message", "")!!.startsWith("检查完成：") }
            val checked = aState.getString("message", "")!!
            waitFor { shown(checked) }
            assertFalse(shown(originalGlobal))
            scenario.recreate(); waitFor { shown(checked) }
            click("全量补传 · 本机保留的记录")
            scenario.onActivity { activity ->
                val field = SyncRecoveryActivity::class.java.getDeclaredField("confirmation").apply { isAccessible = true }
                (field.get(activity) as android.app.AlertDialog).getButton(android.content.DialogInterface.BUTTON_POSITIVE).performClick()
            }
            waitFor { aState.getString("message", "")!!.startsWith("已安排补传 ") }
            val replayed = aState.getString("message", "")!!
            waitFor { shown(replayed) }
            val oldStop = click("停止本次检查 / 准备补传")
            waitFor { aState.getString("message", "")!!.startsWith("已请求停止检查") }
            val stopped = aState.getString("message", "")!!
            waitFor { shown(stopped) }
            val stale = OneTimeWorkRequestBuilder<SyncRecoveryWorker>()
                .setInputData(workDataOf("replay" to false, "syncStamp" to SyncSchedule.stamp(settings.read()))).build()
            scenario.moveToState(Lifecycle.State.CREATED)
            login(app, "b")
            val bState = app.accountPreferences("sync-recovery")
            val bReport = "Generated B recovery report"
            bState.edit().putString("message", bReport).commit()
            scenario.moveToState(Lifecycle.State.RESUMED)
            waitFor { shown(bReport) }
            assertFalse(shown(stopped)); assertFalse(shown(originalGlobal))
            instrumentation.runOnMainSync { oldStop.performClick() }
            WorkManager.getInstance(app).enqueue(stale).result.get(15, TimeUnit.SECONDS)
            waitFor { WorkManager.getInstance(app).getWorkInfoById(stale.id).get()!!.state.isFinished }
            assertEquals(WorkInfo.State.FAILED, WorkManager.getInstance(app).getWorkInfoById(stale.id).get()!!.state)
            assertEquals(bReport, bState.getString("message", ""))
            assertEquals(stopped, aState.getString("message", ""))
            assertEquals(originalGlobal, app.getSharedPreferences("sync-recovery", Context.MODE_PRIVATE).getString("message", ""))
            scenario.moveToState(Lifecycle.State.CREATED); login(app, "a"); scenario.moveToState(Lifecycle.State.RESUMED)
            waitFor { shown(stopped) }; assertFalse(shown(bReport))
        }
    }

    /** Driver runs force-stop between these two named methods, without clearing
     * data. Deliberately interrupt the settings cancel→restore boundary. */
    @Test fun calendarCheckpointBeforeActualProcessDeath() {
        val app = ready(); setupAccount(app)
        val calendarId = createCalendar(app)
        CalendarActions(app, foreground = true).connect(); awaitCalendarWork(app)
        val approved = approve(app, calendarId)
        check(app.getSharedPreferences("calendar-parity-checkpoint", Context.MODE_PRIVATE).edit()
            .putString("owner", Settings(app).read().ownerKey()).putLong("calendar", calendarId)
            .putString("action", approved.getString("id")).commit())
        WorkManager.getInstance(app).cancelUniqueWork("mote-calendar-delivery").result.get(15, TimeUnit.SECONDS)
        assertNull(calendarWork(app)); assertEquals(0, eventCount(app, calendarId))
    }

    @Test fun actualProcessRestartRestoresCurrentOwnerCalendarWithoutReconnect() {
        val app = context()
        waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null && !ConnectionGuard.changing() }
        val saved = app.getSharedPreferences("calendar-parity-checkpoint", Context.MODE_PRIVATE)
        val calendarId = saved.getLong("calendar", -1)
        require(calendarId >= 0) { "Run calendarCheckpointBeforeActualProcessDeath, then force-stop the fixture package first" }
        try {
            assertEquals(saved.getString("owner", null), Settings(app).read().ownerKey())
            awaitCalendarWork(app)
            assertEquals(0, eventCount(app, calendarId))
            apply(app, Settings(app).read().copy(syncMode = "realtime"))
            waitFor { action(app, saved.getString("action", null)!!).getString("status") == "succeeded" }
            assertEquals(1, eventCount(app, calendarId))
        } finally {
            WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
            removeCalendar(app, calendarId); saved.edit().clear().commit()
        }
    }
}
