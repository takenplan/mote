package dev.mote.collector

import android.content.Context
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Generated identities and privacy strings only; never starts a platform capture. */
@RunWith(AndroidJUnit4::class)
class AccountCapturePreferencesInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun fixture() = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText())
    private fun waitFor(predicate: () -> Boolean) {
        val end = android.os.SystemClock.elapsedRealtime() + 45000
        while (!predicate()) { check(android.os.SystemClock.elapsedRealtime() < end); Thread.sleep(40) }
    }
    private fun ready(): Context = instrumentation.targetContext.also {
        require(it.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
        waitFor { !QueueStorage.recovering && !ConnectionGuard.changing() && QueueStorage.recoveryFailure == null }
        WorkManager.getInstance(it).cancelAllWork().result.get(15, TimeUnit.SECONDS)
    }
    private fun login(app: Context, actor: String, endpoint: String = fixture().getString("androidAddress"), token: String = fixture().getJSONObject(actor).getString("token")) {
        RuntimeSettings.replaceAccount(app) { Settings(app).signIn(endpoint, token, 2592000000) }
    }
    private fun policy(config: CollectorConfig) = listOf(config.uiPageMode, config.uiPageRules, config.uploadGate,
        config.intervalSeconds, config.wifiOnly, config.excludedPackages, config.masks, config.mode, config.jpegQuality,
        config.captureMaxSide, config.chargingOnly, config.batteryPauseBelowPct, config.appCollectionRules, config.metadataEnabled,
        config.syncPaused, config.syncMode, config.packedUpload, config.syncIntervalMinutes, config.syncBatchSize,
        config.jsonlWindowMinutes, config.mediaCollectionEnabled, config.screenCollectionEnabled, config.notificationCollectionEnabled,
        config.deviceEventCollectionEnabled, config.syncChargingOnly, config.syncBatteryNotLow, config.imageDedupeMode,
        config.ocrMode, config.ocrAppModes, config.uploadedRetentionDays)
    private fun aPolicy(config: CollectorConfig) = config.copy(excludedPackages = "generated.private.a", masks = "0,0,1,0.1",
        appCollectionRules = AppCollectionRules(AppCollectionMode.ACTIVITY, mapOf("generated.private.a" to AppCollectionMode.OFF)).json(),
        uploadGate = UploadGateConfig(true, "GENERATED_A_PRIVATE_FILTER", "hold"), intervalSeconds = 47,
        jpegQuality = 81, wifiOnly = false, syncMode = "manual", syncBatchSize = 73, syncIntervalMinutes = 7,
        notificationCollectionEnabled = true, metadataEnabled = false, imageDedupeMode = "exact", uploadedRetentionDays = 13)
    private fun bPolicy(config: CollectorConfig) = config.copy(excludedPackages = "generated.private.b", masks = "0,0.8,1,0.2",
        syncMode = "manual", wifiOnly = true, intervalSeconds = 61, uploadedRetentionDays = 3,
        uploadGate = UploadGateConfig(true, "GENERATED_B_PRIVATE_FILTER", "hold"))

    @Test fun missingAccountSnapshotKeepsHistoricalGlobalsUnassignedAndUsesStoppedDefaults() {
        val app = ready(); login(app, "a"); val settings = Settings(app)
        val account = settings.read().account()!!; val global = app.getSharedPreferences("mote", Context.MODE_PRIVATE)
        val key = "collectorPreferences.${account.preferenceKey}"
        check(global.edit().remove(key).putString("excluded", "GENERATED_UNKNOWN_OLD_PRIVATE_FILTER")
            .putString("masks", "0,0,1,1").putString("syncMode", "manual").putBoolean("capturePreviewSeen", true)
            .putBoolean("enabled", true).commit())
        val fresh = Settings(app).read()
        assertEquals(policy(CollectorConfig()), policy(fresh)); assertFalse(settings.enabled); assertFalse(settings.capturePreviewSeen())
        assertEquals("GENERATED_UNKNOWN_OLD_PRIVATE_FILTER", global.getString("excluded", ""))
        assertTrue(global.getBoolean("capturePreviewSeen", false)); assertTrue(global.contains(key))
        assertFalse(global.getString(key, "")!!.contains("GENERATED_UNKNOWN_OLD_PRIVATE_FILTER"))
    }

    @Test fun actualAccountSwitchRotationAndVerifiedUrlChangeRestoreOnlyTheOwnersPolicyAndPreview() {
        val app = ready(); login(app, "a"); val settings = Settings(app)
        val a = aPolicy(settings.read()); settings.save(a); settings.capturePreviewAccepted(a)
        val deviceId = settings.deviceId; val capacity = a.maxQueueMiB; val aKey = a.account()!!.preferenceKey
        settings.enabled = true // Generated running intent; no capture service is connected.
        val bIdentity = settings.verifyAccount(fixture().getString("androidAddress"), fixture().getJSONObject("b").getString("token"))
        check(app.getSharedPreferences("mote", Context.MODE_PRIVATE).edit().remove("collectorPreferences.${bIdentity.preferenceKey}").commit())
        login(app, "b")
        assertEquals(policy(CollectorConfig()), policy(settings.read())); assertFalse(settings.enabled); assertFalse(settings.capturePreviewSeen())
        assertFalse(settings.read().toString().contains("GENERATED_A_PRIVATE_FILTER"))
        val b = bPolicy(settings.read()); settings.save(b)
        login(app, "a")
        assertEquals(policy(a), policy(settings.read())); assertTrue(settings.capturePreviewSeen()); assertFalse(settings.enabled)
        assertEquals(deviceId, settings.deviceId); assertEquals(capacity, settings.read().maxQueueMiB)
        val f = fixture(); val (status, next) = HttpJson.post(f.getString("androidAddress") + "/api/auth/login", JSONObject()
            .put("username", "generated-a").put("password", f.getString("password")).put("mode", "client"))
        assertEquals(200, status)
        val newToken = next!!.getString("token"); assertNotEquals(a.token, newToken)
        login(app, "a", token = newToken)
        assertEquals(aKey, settings.read().account()!!.preferenceKey); assertEquals(policy(a), policy(settings.read()))
        val alias = f.getString("androidAddress").replace("127.0.0.1", "localhost")
        login(app, "a", endpoint = alias, token = newToken)
        assertEquals(aKey, settings.read().account()!!.preferenceKey); assertEquals(policy(a), policy(settings.read()))
        assertTrue(settings.capturePreviewSeen()); assertFalse(settings.enabled)
        login(app, "b"); assertEquals(policy(b), policy(settings.read())); assertFalse(settings.capturePreviewSeen()); assertFalse(settings.enabled)
    }

    @Test fun retiredSettingsAndPreviewCallbacksCannotChangeTheNewAccountsPreferences() {
        val app = ready(); login(app, "a"); val settings = Settings(app)
        settings.save(aPolicy(settings.read())); val a = settings.read()
        login(app, "b"); settings.save(bPolicy(settings.read())); val b = settings.read()
        assertThrows(SettingsChangedFailure::class.java) { settings.save(a.copy(excludedPackages = "GENERATED_LATE_A"), expected = a) }
        assertThrows(SettingsChangedFailure::class.java) { settings.capturePreviewAccepted(a) }
        val completed = CountDownLatch(1); val result = AtomicReference<kotlin.Result<RuntimeSettings.Applied>>()
        instrumentation.runOnMainSync {
            RuntimeSettings.apply(app, a.copy(intervalSeconds = 59), expected = a) { result.set(it); completed.countDown() }
        }
        check(completed.await(60, TimeUnit.SECONDS)); assertTrue(result.get().isFailure)
        assertEquals(b, settings.read()); assertFalse(settings.capturePreviewSeen()); assertFalse(settings.enabled)
        login(app, "a"); assertEquals(policy(a), policy(settings.read()))
    }

    /** Host must force-stop between these methods, retaining this generated app's data. */
    @Test fun preferenceCheckpointBeforeActualProcessDeath() {
        val app = ready(); val settings = Settings(app)
        login(app, "a"); settings.save(aPolicy(settings.read())); settings.capturePreviewAccepted(settings.read())
        login(app, "b"); settings.save(bPolicy(settings.read()))
        check(app.getSharedPreferences("preference-parity-checkpoint", Context.MODE_PRIVATE).edit()
            .putString("owner", settings.read().account()!!.preferenceKey).putBoolean("ready", true).commit())
        assertFalse(settings.enabled)
    }
    @Test fun actualProcessRestartRestoresSavedPolicyAndKeepsCollectionStopped() {
        val app = ready(); val settings = Settings(app)
        val checkpoint = app.getSharedPreferences("preference-parity-checkpoint", Context.MODE_PRIVATE)
        require(checkpoint.getBoolean("ready", false)) { "Run the checkpoint method and force-stop before this method" }
        assertEquals(checkpoint.getString("owner", ""), settings.read().account()!!.preferenceKey)
        assertEquals("generated.private.b", settings.read().excludedPackages); assertEquals("manual", settings.read().syncMode)
        assertFalse(settings.capturePreviewSeen()); assertFalse(settings.enabled)
        login(app, "a"); assertEquals("generated.private.a", settings.read().excludedPackages)
        assertEquals("GENERATED_A_PRIVATE_FILTER", settings.read().uploadGate.blockedText); assertTrue(settings.capturePreviewSeen()); assertFalse(settings.enabled)
        checkpoint.edit().clear().commit()
    }
}
