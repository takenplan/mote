package dev.mote.collector

import android.content.Context
import android.os.Build
import android.provider.DocumentsContract
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.OneTimeWorkRequest
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.Base64
import java.util.UUID
import java.util.concurrent.TimeUnit

/** Generated DocumentsProvider bytes, real production Central and persisted WorkManager jobs.
 * Requires the isolated multiuserFixture APK and multiuser-backend.ts control server.
 * Upload expiry is injected into the generated server's clock-dependent journal;
 * no real personal data, device capture, model or provider is used.
 */
@RunWith(AndroidJUnit4::class)
class AndroidIngressParityInstrumentedTest {
    private fun app(): Context = InstrumentationRegistry.getInstrumentation().targetContext.also {
        require(it.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
    }
    private fun fixture() = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText())
    private fun endpoint() = fixture().getString("androidAddress")
    private fun token(actor: String) = fixture().getJSONObject(actor).getString("token")
    private fun control(path: String): JSONObject {
        val (status, body) = HttpJson.post(fixture().getString("androidControlAddress") + path, JSONObject())
        check(status == 200) { "Generated control $path failed: $status $body" }
        return body!!
    }
    private fun waitFor(description: String, predicate: () -> Boolean) {
        val end = android.os.SystemClock.elapsedRealtime() + 90000
        while (!predicate()) {
            check(android.os.SystemClock.elapsedRealtime() < end) { "Generated parity timeout: $description" }
            Thread.sleep(40)
        }
    }
    private fun cancel(app: Context) {
        WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
        waitFor("workers retired") { !ConnectionGuard.changing() && ConnectionGuard.processing.get() == 0 }
    }
    private fun login(app: Context, actor: String) {
        RuntimeSettings.replaceAccount(app) { Settings(app).signIn(endpoint(), token(actor), 2592000000) }
        // Test configuration is explicit for each account; no shared privacy policy.
        Settings(app).let { it.save(it.read().copy(syncMode = "manual", wifiOnly = false, metadataEnabled = false)) }
    }
    private fun setup(): Context = app().also { app ->
        waitFor("storage recovery") { !QueueStorage.recovering && QueueStorage.recoveryFailure == null }
        cancel(app)
        val settings = Settings(app)
        settings.save(settings.read().copy(server = "", token = "", debugHttp = true, wifiOnly = false,
            syncMode = "manual", syncPaused = false, metadataEnabled = false, uploadedRetentionDays = 7))
        login(app, "a")
    }
    private fun enqueue(app: Context, request: OneTimeWorkRequest): UUID {
        WorkManager.getInstance(app).enqueue(request).result.get(15, TimeUnit.SECONDS)
        return request.id
    }
    private fun awaitResult(app: Context, id: UUID): WorkInfo {
        val manager = WorkManager.getInstance(app)
        waitFor("worker $id terminal or scheduled retry") {
            manager.getWorkInfoById(id).get()!!.let { it.state.isFinished || (it.state == WorkInfo.State.ENQUEUED && it.runAttemptCount > 0) }
        }
        return manager.getWorkInfoById(id).get()!!
    }
    private fun upload(app: Context, config: CollectorConfig = Settings(app).read(), manual: Boolean = true): UUID =
        enqueue(app, OneTimeWorkRequestBuilder<SourceUploadWorker>().setInputData(workDataOf(
            "manual" to manual, "syncStamp" to SyncSchedule.stamp(config))).build())
    private fun assertPrivateCapture(actor: String, id: String, status: Int = 200) {
        assertEquals(status, HttpJson.get(endpoint() + "/api/captures/$id", token(actor)).first)
        assertEquals(404, HttpJson.get(endpoint() + "/api/captures/$id", token(if (actor == "a") "b" else "a")).first)
    }
    private fun generatedSource(app: Context, id: String = "parity-" + UUID.randomUUID(), bytes: Int = 4096): LocalSource {
        val file = File(app.filesDir, "generated-file-sync/$id.bin").apply { parentFile!!.mkdirs() }
        file.outputStream().use { output ->
            val chunk = ByteArray(65536) { ((it * 17 + 23) % 251).toByte() }
            var remaining = bytes
            while (remaining > 0) { val size = minOf(remaining, chunk.size); output.write(chunk, 0, size); remaining -= size }
        }
        return LocalSource(id = id, name = "Generated ingress parity", kind = "local-files", retention = "archive",
            uri = DocumentsContract.buildDocumentUri(app.packageName + ".file-fixtures", file.name).toString(),
            extensions = "bin", syncContinuously = false)
    }
    private fun scan(app: Context, source: LocalSource): JSONObject {
        // Offer a real persistable grant from the generated app-owned provider
        // through an Activity Intent, then exercise the actual scan Worker.
        val uri = android.net.Uri.parse(source.uri)
        androidx.test.core.app.ActivityScenario.launch<FixtureActivity>(android.content.Intent(app, FixtureActivity::class.java)
            .setData(uri).addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION or android.content.Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)).use {
            app.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        assertTrue(app.contentResolver.persistedUriPermissions.any { it.uri == uri && it.isReadPermission })
        app.localSources().save(source)
        val request = OneTimeWorkRequestBuilder<SourceScanWorker>().setInputData(workDataOf(
            "owner" to Settings(app).read().ownerKey(), "manual" to true, "sourceId" to source.id)).build()
        assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, enqueue(app, request)).state)
        assertEquals("Generated provider must produce a durable pending original", 1, app.fileArchives().pendingCount(source.id))
        return app.fileArchives().next(source.id)!!.getJSONObject("pending").getJSONObject("manifest")
    }
    private fun requests() = control("/state").getJSONArray("ingressRequests").let { rows -> (0 until rows.length()).map(rows::getJSONObject) }
    private fun uploadState(id: String) = control("/uploads/state").getJSONArray("uploads").let { rows ->
        (0 until rows.length()).map(rows::getJSONObject).single { it.getString("id") == id }
    }
    private fun assertForeignUploadRejected(id: String, bytes: ByteArray) {
        val (status, _) = HttpJson.request("PUT", endpoint() + "/api/ingress/uploads/$id/parts/0",
            JSONObject().put("bytes", Base64.getEncoder().encodeToString(bytes)).put("checksum", Ingress3Client.hash(bytes)), token("b"))
        assertEquals("An equal-ID B source must not acquire A's transport session", 404, status)
    }

    @Test fun captureConflictIsVisibleAndLaterNotesSettleInPackedAndIndividualModes() {
        val app = setup(); val settings = Settings(app)
        try {
            for (packed in listOf(true, false)) {
                settings.save(settings.read().copy(packedUpload = packed))
                val first = QuickNotes.save(app, "Generated valid note before conflict $packed", "")
                val conflict = QuickNotes.save(app, "Generated local immutable conflict $packed", "")
                val last = QuickNotes.save(app, "Generated valid note after conflict $packed", "")
                val original = app.queue().peekBatch(maxCount = 32).single { it.getString("id") == conflict }
                app.ingress3(settings.read()).captures(listOf(JSONObject(original.toString()).put("ocrText", "Generated different accepted content $packed")))
                val request = OneTimeWorkRequestBuilder<UploadWorker>().setInputData(workDataOf(
                    "manual" to true, "syncStamp" to SyncSchedule.stamp(settings.read()))).build()
                assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, enqueue(app, request)).state)
                assertEquals("Only the conflicting record is quarantined", 0, app.queue().pendingSync().count)
                assertTrue(app.queue().syncIssues().any { it.getString("id") == conflict && it.getBoolean("retryable") })
                for (id in listOf(first, conflict, last)) assertPrivateCapture("a", id)
                assertEquals("Generated different accepted content $packed", HttpJson.get(endpoint() + "/api/captures/$conflict", token("a")).second!!.getString("ocrText"))
            }
        } finally { cancel(app) }
    }

    @Test fun disabledSourcePausesWhileNetworkFailuresKeepAutomaticAndManualRetrySemantics() {
        val app = setup(); val settings = Settings(app); val source = generatedSource(app)
        try {
            scan(app, source)
            app.ingress3(settings.read()).register(source.registration(settings.deviceId))
            CentralAccess.requireClient(app).patch("/api/sources/${source.id}", JSONObject().put("enabled", false))
            control("/ingress/reset")
            assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, upload(app)).state)
            assertEquals("paused", app.localSources().state(source.id).getString("status"))
            assertEquals(1, app.fileArchives().pendingCount(source.id))
            assertFalse(app.fileArchives().rows(source.id).single().optJSONObject("syncFailure")?.optBoolean("blocked") == true)
            assertFalse("Pause detection must stay inside the narrow device ingress", requests().any { it.getString("path") == "/api/sources" })
            CentralAccess.requireClient(app).patch("/api/sources/${source.id}", JSONObject().put("enabled", true))
            for (manual in listOf(false, true)) {
                settings.save(settings.read().copy(syncMode = if (manual) "manual" else "realtime"))
                control("/network/off")
                try {
                    val info = awaitResult(app, upload(app, manual = manual))
                    assertEquals(if (manual) WorkInfo.State.FAILED else WorkInfo.State.ENQUEUED, info.state)
                    if (!manual) assertTrue(info.runAttemptCount > 0)
                    assertEquals("offline", app.localSources().state(source.id).getString("status"))
                    assertEquals(1, app.fileArchives().pendingCount(source.id))
                    assertFalse(app.fileArchives().rows(source.id).single().optJSONObject("syncFailure")?.optBoolean("blocked") == true)
                } finally { control("/network/on"); cancel(app) }
            }
            assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, upload(app)).state)
            assertEquals(0, app.fileArchives().pendingCount(source.id))
        } finally { cancel(app); app.localSources().remove(source.id) }
    }

    @Test fun forgottenOriginalRejectsDurablePendingRevisionAndStopsAutomaticRetry() {
        val app = setup(); val settings = Settings(app); val source = generatedSource(app)
        try {
            val manifest = scan(app, source)
            val id = Ingress3Receipt.captureId(source.id, manifest.getJSONObject("item"))
            control("/uploads/drop-commit")
            assertEquals(WorkInfo.State.FAILED, awaitResult(app, upload(app)).state)
            assertEquals(1, app.fileArchives().pendingCount(source.id))
            val api = CentralAccess.requireClient(app); val detail = api.get("/api/files/$id")
            api.delete("/api/files/$id", JSONObject().put("operationId", "generated-parity-forget-$id").put("originalGeneration", detail.getLong("originalGeneration")))
            settings.save(settings.read().copy(syncMode = "realtime"))
            assertEquals("A permanent 410 must terminate the automatic job", WorkInfo.State.FAILED, awaitResult(app, upload(app, manual = false)).state)
            assertEquals("ack", app.localSources().state(source.id).getString("status"))
            val failure = app.fileArchives().rows(source.id).single().getJSONObject("syncFailure")
            assertTrue(failure.getBoolean("blocked")); assertEquals(410, failure.getInt("httpStatus"))
            assertEquals(1, app.fileArchives().pendingCount(source.id)); assertPrivateCapture("a", id, 404)
            control("/ingress/reset")
            assertEquals(WorkInfo.State.FAILED, awaitResult(app, upload(app, manual = false)).state)
            assertFalse("Later automatic jobs must not retry a permanently rejected revision", requests().any { it.getString("path").endsWith("/uploads") })
            assertEquals(WorkInfo.State.FAILED, awaitResult(app, upload(app, manual = true)).state)
            assertTrue("The existing explicit retry control may recheck the retained revision", requests().any { it.getString("path").endsWith("/uploads") })
        } finally { cancel(app); app.localSources().remove(source.id) }
    }

    @Test fun halfUploadedExpiredSessionRestartsFromTheSameProviderSpoolWithoutBTakingOver() {
        val app = setup(); val settings = Settings(app)
        val source = generatedSource(app, bytes = FileArchiveQueue.PART_BYTES + 4096)
        try {
            val manifest = scan(app, source); val configA = settings.read()
            val originalDirectory = app.accountDirectory().absolutePath
            val part = app.fileArchives().part(source.id, 0)
            control("/uploads/hold-part"); upload(app)
            waitFor("first multipart response held after durable acceptance") { control("/state").optBoolean("held") }
            val uploadId = control("/state").getString("heldUploadId")
            val half = uploadState(uploadId)
            assertEquals(0, half.getInt("committed")); assertEquals(1, half.getJSONArray("parts").length())
            assertEquals(FileArchiveQueue.PART_BYTES, half.getJSONArray("parts").getJSONObject(0).getInt("bytes"))
            settings.save(settings.read().copy(syncPaused = true))
            WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
            control("/uploads/expire/$uploadId"); control("/release"); cancel(app)
            assertEquals(1, app.fileArchives().pendingCount(source.id))
            assertEquals(manifest.toString(), app.fileArchives().next(source.id)!!.getJSONObject("pending").getJSONObject("manifest").toString())
            login(app, "b"); settings.save(settings.read().copy(syncPaused = false))
            val bManifest = scan(app, source)
            assertEquals(manifest.getJSONObject("item").getString("externalId"), bManifest.getJSONObject("item").getString("externalId"))
            assertForeignUploadRejected(uploadId, part)
            assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, upload(app, configA)).state)
            assertEquals("An old A job must leave equal-ID B pending bytes untouched", 1, app.fileArchives().pendingCount(source.id))
            assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, upload(app)).state)
            waitFor("B multipart continuation") { app.fileArchives().pendingCount(source.id) == 0 }
            val bCapture = Ingress3Receipt.captureId(source.id, bManifest.getJSONObject("item")); assertPrivateCapture("b", bCapture)
            login(app, "a"); assertEquals(originalDirectory, app.accountDirectory().absolutePath)
            assertArrayEquals(part, app.fileArchives().part(source.id, 0))
            control("/ingress/reset")
            assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, upload(app)).state)
            waitFor("A expired multipart continuation") { app.fileArchives().pendingCount(source.id) == 0 }
            val id = Ingress3Receipt.captureId(source.id, manifest.getJSONObject("item"))
            assertEquals(200, HttpJson.get(endpoint() + "/api/captures/$id", token("a")).first)
            assertEquals(200, HttpJson.get(endpoint() + "/api/captures/$bCapture", token("b")).first)
            if (id != bCapture) {
                assertEquals(404, HttpJson.get(endpoint() + "/api/captures/$id", token("b")).first)
                assertEquals(404, HttpJson.get(endpoint() + "/api/captures/$bCapture", token("a")).first)
            }
            assertEquals(1, CentralAccess.requireClient(app).get("/api/sources/${source.id}/history?externalId=" + java.net.URLEncoder.encode(source.uri, "UTF-8")).getJSONArray("items").length())
        } finally { control("/release"); cancel(app); app.localSources().remove(source.id) }
    }

    @Test fun expiryBetweenAcceptedBeginOrPartAndTheNextRequestRetriesTheSamePendingRevisionAutomatically() {
        val app = setup(); val settings = Settings(app)
        try {
            // One small original lets these two real lifecycle boundaries cover
            // both an expired part and an expired commit without another spool.
            for (boundary in listOf("begin", "part")) {
                settings.save(settings.read().copy(syncMode = "manual"))
                val source = generatedSource(app)
                try {
                    val manifest = scan(app, source)
                    control("/uploads/hold-$boundary")
                    settings.save(settings.read().copy(syncMode = "realtime"))
                    val request = upload(app, manual = false)
                    waitFor("accepted $boundary response held") { control("/state").optBoolean("held") }
                    val uploadId = control("/state").getString("heldUploadId")
                    assertEquals(if (boundary == "begin") 0 else 1, uploadState(uploadId).getJSONArray("parts").length())
                    control("/uploads/expire/$uploadId"); control("/release")
                    val retry = awaitResult(app, request)
                    assertEquals("An expired transport attempt must keep the automatic retry", WorkInfo.State.ENQUEUED, retry.state)
                    assertEquals("offline", app.localSources().state(source.id).getString("status"))
                    val pending = app.fileArchives().rows(source.id).single()
                    assertFalse("Transport expiry must not quarantine an immutable revision", pending.getJSONObject("syncFailure").getBoolean("blocked"))
                    assertEquals(manifest.toString(), pending.getJSONObject("pending").getJSONObject("manifest").toString())
                    waitFor("automatic WorkManager retry of expired $boundary") { app.fileArchives().pendingCount(source.id) == 0 }
                    waitFor("automatic retry terminal state") { WorkManager.getInstance(app).getWorkInfoById(request).get()!!.state.isFinished }
                    assertEquals(WorkInfo.State.SUCCEEDED, WorkManager.getInstance(app).getWorkInfoById(request).get()!!.state)
                    assertPrivateCapture("a", Ingress3Receipt.captureId(source.id, manifest.getJSONObject("item")))
                } finally { control("/release"); cancel(app); app.localSources().remove(source.id) }
            }
        } finally { cancel(app) }
    }

    @Test fun commitAckLostThenExpiredReusesDurableReceiptAfterSameAccountRelogin() {
        val app = setup(); val settings = Settings(app); val source = generatedSource(app)
        try {
            val manifest = scan(app, source); val owner = settings.read().ownerKey()
            val id = Ingress3Receipt.captureId(source.id, manifest.getJSONObject("item"))
            control("/uploads/drop-commit")
            assertEquals(WorkInfo.State.FAILED, awaitResult(app, upload(app)).state)
            val uploadId = control("/state").getString("droppedCommitId")
            assertEquals(1, uploadState(uploadId).getInt("committed"))
            assertEquals(1, app.fileArchives().pendingCount(source.id)); assertPrivateCapture("a", id)
            control("/uploads/expire/$uploadId")
            login(app, "b"); app.localSources().save(source)
            assertForeignUploadRejected(uploadId, ByteArray(4) { it.toByte() })
            assertEquals(0, app.fileArchives().pendingCount(source.id))
            login(app, "a"); assertEquals(owner, settings.read().ownerKey())
            assertEquals(1, app.fileArchives().pendingCount(source.id)); control("/ingress/reset")
            assertEquals(WorkInfo.State.SUCCEEDED, awaitResult(app, upload(app)).state)
            assertEquals(0, app.fileArchives().pendingCount(source.id))
            val recovery = requests().filter { it.getString("owner") == "a" }
            assertTrue(recovery.any { it.getString("path") == "/api/ingress/sources/${source.id}/uploads" && it.getInt("status") == 200 })
            assertFalse("A durable received ACK must settle without uploading bytes or committing again", recovery.any { it.getString("path").startsWith("/api/ingress/uploads/") })
            assertPrivateCapture("a", id)
        } finally { cancel(app); app.localSources().remove(source.id) }
    }
}
