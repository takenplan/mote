package dev.mote.collector

import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.KeyStore
import java.util.UUID

/** Generated state in an isolated context. Never captures a screen or contacts a server. */
@RunWith(AndroidJUnit4::class)
class ProfileCredentialInstrumentedTest {
    @Test fun devDownloadOpensWorkflowArtifactsWithoutOpeningABrowser() {
        assumeTrue(RuntimeProfile.current == RuntimeProfile.DEV)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val opened = java.util.concurrent.atomic.AtomicReference<String>()
        val monitor = object : android.app.Instrumentation.ActivityMonitor() {
            override fun onStartActivity(intent: Intent): android.app.Instrumentation.ActivityResult? {
                if (intent.action != Intent.ACTION_VIEW) return null
                opened.set(intent.dataString)
                return android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_CANCELED, null)
            }
        }
        instrumentation.addMonitor(monitor)
        try {
            ActivityScenario.launch(AppUpdatesActivity::class.java).use { scenario -> scenario.onActivity { activity ->
                fun buttons(view: android.view.View): List<android.widget.Button> =
                    (if (view is android.widget.Button) listOf(view) else emptyList()) +
                        if (view is android.view.ViewGroup) (0 until view.childCount).flatMap { buttons(view.getChildAt(it)) } else emptyList()
                buttons(activity.window.decorView).single { it.text.toString() == MoteI18n.text("下载 DEV 安装包") }.performClick()
            } }
            assertEquals("https://github.com/utopiafar/mote/actions/workflows/release-android.yml", opened.get())
        } finally { instrumentation.removeMonitor(monitor) }
    }

    @Test fun freshDevSettingsAndEncryptedDraftsUseJsonKeysWithoutCreatingKeystoreEntries() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assumeTrue(RuntimeProfile.current == RuntimeProfile.DEV && Build.FINGERPRINT.contains("/emu64a:"))
        val name = "generated-profile-${UUID.randomUUID()}"
        val directory = File(context.cacheDir, name).apply { mkdirs() }
        val generated = object : ContextWrapper(context) {
            override fun getApplicationContext(): Context = this
            override fun getNoBackupFilesDir(): File = directory
            override fun getSharedPreferences(ignored: String, mode: Int): SharedPreferences = context.getSharedPreferences(name, mode)
        }
        fun aliases() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.aliases().toList().toSet()
        val before = aliases()
        try {
            val settings = Settings(generated)
            val config = settings.read()
            assertTrue(config.diagnosticsEnabled)
            assertFalse(config.imageDedupeDiagnosticsEnabled)
            assertEquals("", JSONObject(generated.getSharedPreferences("mote", 0).getString("token", null)!!).getString("token"))
            settings.save(config.copy(deviceName = "Generated Dev settings"))
            assertEquals("Generated Dev settings", Settings(generated).read().deviceName)
            val draft = JSONObject().put("note", "generated private draft only")
            CentralStateFile(directory, "draft", generated.secretBox()).write(draft)
            val ciphertext = File(directory, "draft.enc").readBytes()
            assertFalse(String(ciphertext).contains("generated private draft only"))
            assertEquals(draft.toString(), CentralStateFile(directory, "draft", generated.secretBox()).read().toString())
            val keyFile = DevCredentialFormat.keyFile(directory)
            assertEquals("AES-256-GCM", JSONObject(keyFile.readText()).getString("algorithm"))
            val tampered = ciphertext.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
            assertThrows(javax.crypto.AEADBadTagException::class.java) { generated.secretBox().open(tampered) }
            val savedKey = keyFile.readBytes()
            assertTrue(keyFile.delete())
            assertThrows(IllegalStateException::class.java) { Settings(generated) }
            assertFalse(keyFile.exists())
            assertArrayEquals(ciphertext, File(directory, "draft.enc").readBytes())
            keyFile.writeBytes(savedKey)
            java.nio.file.Files.setPosixFilePermissions(keyFile.toPath(), setOf(java.nio.file.attribute.PosixFilePermission.OWNER_READ, java.nio.file.attribute.PosixFilePermission.OWNER_WRITE))
            assertEquals(draft.toString(), CentralStateFile(directory, "draft", generated.secretBox()).read().toString())
            assertEquals(before, aliases())
        } finally {
            context.deleteSharedPreferences(name)
            directory.deleteRecursively()
        }
    }
}
