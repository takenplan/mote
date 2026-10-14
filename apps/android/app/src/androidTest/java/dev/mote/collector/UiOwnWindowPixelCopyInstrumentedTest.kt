package dev.mote.collector

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Wait for actual hardware submissions and verify the owned buffer's measured native footer. */
internal fun saveGeneratedOwnedWindowBuffer(activity: android.app.Activity, directory: File, name: String) {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    require(InstrumentationRegistry.getArguments().getString("uiIterationFixture") == "true")
    require(activity.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
    val callbacks = HandlerThread("generated-owned-window-buffer").apply { start() }
    directory.mkdirs()
    val deadline = android.os.SystemClock.elapsedRealtime() + 5_000
    var attempt = 0
    var footerReady = false
    try {
        while (!footerReady && android.os.SystemClock.elapsedRealtime() < deadline) {
            attempt++
            val committed = CountDownLatch(1)
            instrumentation.runOnMainSync {
                val base = activity.window.decorView
                require(base.isAttachedToWindow && base.isShown && base.isLaidOut && base.isHardwareAccelerated)
                require(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                fun invalidateVisible(view: View) {
                    if (!view.isShown) return
                    view.invalidate()
                    if (view is ViewGroup) repeat(view.childCount) { invalidateVisible(view.getChildAt(it)) }
                }
                base.viewTreeObserver.registerFrameCommitCallback { committed.countDown() }
                invalidateVisible(base)
            }
            assertTrue("The generated Activity must submit its current hardware frame: $name", committed.await(5, TimeUnit.SECONDS))
            instrumentation.waitForIdleSync()
            val copied = CountDownLatch(1)
            var copyStatus = -1
            lateinit var buffer: Bitmap
            instrumentation.runOnMainSync {
                val base = activity.window.decorView
                buffer = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888)
                PixelCopy.request(activity.window, buffer, { status -> copyStatus = status; copied.countDown() }, Handler(callbacks.looper))
            }
            try {
                assertTrue("The generated owned-window copy must finish: $name", copied.await(5, TimeUnit.SECONDS))
                val evidence = JSONArray()
                instrumentation.runOnMainSync {
                    val base = activity.window.decorView
                    val origin = IntArray(2); base.getLocationOnScreen(origin)
                    fun views(root: View): List<View> = buildList {
                        add(root); if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
                    }
                    val navigation = views(base).filterIsInstance<TextView>().filter { it.tag?.toString()?.startsWith("primary:") == true && it.isShown }
                    footerReady = copyStatus == PixelCopy.SUCCESS && navigation.size == 3
                    for (view in navigation) {
                        val location = IntArray(2); view.getLocationOnScreen(location)
                        val expected = if (view.isSelected) MoteUi.accent else MoteUi.muted
                        fun pixels(top: Int, bottom: Int): Int {
                            var count = 0
                            for (y in top until bottom) for (x in location[0] - origin[0] until location[0] - origin[0] + view.width) {
                                if (x !in 0 until buffer.width || y !in 0 until buffer.height) continue
                                val color = buffer.getPixel(x, y)
                                if (android.graphics.Color.alpha(color) >= 192 && listOf(
                                        kotlin.math.abs(android.graphics.Color.red(color) - android.graphics.Color.red(expected)),
                                        kotlin.math.abs(android.graphics.Color.green(color) - android.graphics.Color.green(expected)),
                                        kotlin.math.abs(android.graphics.Color.blue(color) - android.graphics.Color.blue(expected))).all { it <= 24 }) count++
                            }
                            return count
                        }
                        val top = location[1] - origin[1]; val middle = top + view.height / 2
                        val iconPixels = if (copyStatus == PixelCopy.SUCCESS) pixels(top, middle) else 0
                        val labelPixels = if (copyStatus == PixelCopy.SUCCESS) pixels(middle, top + view.height) else 0
                        val ready = iconPixels >= 16 && labelPixels >= 16
                        evidence.put(JSONObject().put("tag", view.tag).put("selected", view.isSelected).put("expectedColor", expected)
                            .put("iconRegionRolePixels", iconPixels).put("labelRegionRolePixels", labelPixels).put("ready", ready))
                        footerReady = footerReady && ready
                    }
                    var guideAddEvidence: JSONObject? = null
                    if (name in setOf("feature-guide", "feature-guide-content", "feature-guide-english")) {
                        val add = views(base).filterIsInstance<TextView>().single { it.contentDescription == MoteI18n.text("添加内容") && it.isShown }
                        val location = IntArray(2); add.getLocationOnScreen(location)
                        val visible = android.graphics.Rect(); val hasVisibleRect = add.getGlobalVisibleRect(visible)
                        val x = location[0] - origin[0]; val y = location[1] - origin[1]
                        val fullGeometry = hasVisibleRect && visible.width() == add.width && visible.height() == add.height &&
                            add.isLaidOut && add.width > 0 && add.height >= add.minimumHeight &&
                            x >= 0 && y >= 0 && x + add.width <= buffer.width && y + add.height <= buffer.height
                        val rows = minOf(add.height, maxOf(4, activity.moteDp(2) + 1))
                        val center = add.width / 2; val offset = maxOf(1, activity.moteDp(2))
                        val columns = listOf(center - offset, center, center + offset).distinct()
                        var borderPixels = 0
                        if (copyStatus == PixelCopy.SUCCESS && fullGeometry) for (column in columns) for (row in 0 until rows) {
                            val color = buffer.getPixel(x + column, y + row)
                            if (android.graphics.Color.alpha(color) >= 192 && listOf(
                                    kotlin.math.abs(android.graphics.Color.red(color) - android.graphics.Color.red(MoteUi.controlBorder)),
                                    kotlin.math.abs(android.graphics.Color.green(color) - android.graphics.Color.green(MoteUi.controlBorder)),
                                    kotlin.math.abs(android.graphics.Color.blue(color) - android.graphics.Color.blue(MoteUi.controlBorder))).all { it <= 32 }) borderPixels++
                        }
                        val ready = fullGeometry && borderPixels >= columns.size
                        guideAddEvidence = JSONObject().put("fullGeometry", fullGeometry).put("left", x).put("top", y)
                            .put("width", add.width).put("height", add.height).put("minimumHeight", add.minimumHeight)
                            .put("expectedRole", "secondary-chooser").put("actualBufferTopBorderPixels", borderPixels).put("ready", ready)
                        footerReady = footerReady && ready
                    }
                    val secure = activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0
                    val stem = if (footerReady) name else "$name-unready-attempt-$attempt"
                    File(directory, "$stem.json").writeText(JSONObject().put("generatedOnly", true).put("secureWindow", secure)
                        .put("captureKind", "owned-activity-window-surface-pixelcopy").put("pixelCopyStatus", copyStatus)
                        .put("nativeFrameCommitObserved", true).put("nativeFrameCommitCount", attempt).put("footerPixelReady", footerReady)
                        .put("footerPixelEvidence", evidence).put("guideAddEvidence", guideAddEvidence ?: JSONObject.NULL).put("automaticVisualAcceptance", false).put("page", "guide-backdrop")
                        .put("scene", name).put("width", base.width).put("height", base.height).put("language", MoteI18n.preference())
                        .put("screenWidthDp", activity.resources.configuration.screenWidthDp).put("fontScale", activity.resources.configuration.fontScale.toDouble())
                        .put("fingerprint", Build.FINGERPRINT).put("systemCompositorPixelsCaptured", false).toString(2))
                    assertTrue("The secure flag remains enabled after owned-window capture", secure)
                }
                if (copyStatus == PixelCopy.SUCCESS) {
                    val stem = if (footerReady) name else "$name-unready-attempt-$attempt"
                    File(directory, "$stem.png").outputStream().use { assertTrue(buffer.compress(Bitmap.CompressFormat.PNG, 100, it)) }
                }
                assertEquals("The copy must use this generated owned Window: $name", PixelCopy.SUCCESS, copyStatus)
            } finally { buffer.recycle() }
        }
        assertTrue("The owned buffer must draw all native footer glyphs/labels and the Guide Add outline: $name", footerReady)
    } finally { callbacks.quitSafely() }
}

/** Opt-in diagnosis of this generated Activity's own Surface; never the device display. */
@RunWith(AndroidJUnit4::class)
class UiOwnWindowPixelCopyInstrumentedTest {
    private fun views(root: View): List<View> = buildList {
        add(root)
        if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
    }

    @Test fun generatedFreshDetailPagesComparePublishedBufferAndSoftwareFooter() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val args = InstrumentationRegistry.getArguments()
        org.junit.Assume.assumeTrue("Explicit owned-window diagnostic required", args.getString("uiOwnWindowPixelCopyFixture") == "true")
        require(args.getString("uiIterationFixture") == "true")
        val context = instrumentation.targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        require(!Settings(context).enabled && Settings(context).read().token.isBlank() && context.queue().depth() == 0)
        require(QuickNotes.draft(context).read() == NoteDraft() && context.localSources().sources().isEmpty())
        val previous = MoteI18n.preference()
        MoteI18n.select(context, "en")
        try {
            val scenes = listOf("NOTES", "SETTINGS", "PROCESSING", "STORAGE", "DEVELOPER", "PRIVACY", "CONNECTION").map { page ->
                page.lowercase() to android.content.Intent(context, MainActivity::class.java).putExtra("page", page)
            } + listOf(
                "storage-location" to android.content.Intent(context, StorageActivity::class.java),
                "dedupe" to android.content.Intent(context, ImageDedupeDiagnosticsActivity::class.java),
                "import-local-task" to android.content.Intent(context, FileTaskActivity::class.java).putExtra("addAction", "FILE"))
            for ((name, intent) in scenes) ActivityScenario.launch<android.app.Activity>(intent).use { scenario ->
                val deadline = android.os.SystemClock.elapsedRealtime() + 10_000
                var ready = false
                while (!ready && android.os.SystemClock.elapsedRealtime() < deadline) {
                    scenario.onActivity { activity ->
                        val base = activity.window.decorView
                        ready = GeneratedWindowRendering.hasNoPendingLabels(base) && views(base).count { it.tag?.toString()?.startsWith("primary:") == true } == 3
                    }
                    if (!ready) Thread.sleep(25)
                }
                assertTrue("The actual generated page and navigation inventory must load: $name", ready)
                instrumentation.waitForIdleSync()
                val directory = File(context.filesDir, "ui-owned-footer-diagnostic/$name").apply { mkdirs() }
                lateinit var ownedActivity: android.app.Activity
                fun softwareDraw(label: String) = scenario.onActivity { activity ->
                    ownedActivity = activity
                    val base = activity.window.decorView
                    assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                    val bitmap = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888)
                    try {
                        base.draw(Canvas(bitmap))
                        File(directory, "$label.png").outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
                    } finally { bitmap.recycle() }
                    val navigation = JSONArray()
                    for (view in views(base).filter { it.tag?.toString()?.startsWith("primary:") == true }) {
                        val rect = android.graphics.Rect(); val visible = view.getGlobalVisibleRect(rect)
                        navigation.put(JSONObject().put("tag", view.tag).put("attached", view.isAttachedToWindow)
                            .put("shown", view.isShown).put("hasGlobalVisibleRect", visible).put("bounds", rect.toShortString())
                            .put("width", view.width).put("height", view.height))
                    }
                    File(directory, "$label.json").writeText(JSONObject().put("generatedOnly", true).put("secureWindow", true)
                        .put("captureKind", "actual-owned-activity-view-draw-diagnostic").put("page", name).put("navigation", navigation).toString(2))
                }
                scenario.onActivity { ownedActivity = it }
                saveGeneratedOwnedWindowBuffer(ownedActivity, directory, "published-window-buffer")
                instrumentation.waitForIdleSync()
                softwareDraw("after-native-frame-commit")
            }
        } finally { MoteI18n.select(context, previous) }
    }

    @Test fun generatedGuideComparesItsActualWindowBufferWithSoftwareDraw() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val args = InstrumentationRegistry.getArguments()
        org.junit.Assume.assumeTrue("Explicit owned-window diagnostic required", args.getString("uiOwnWindowPixelCopyFixture") == "true")
        require(args.getString("uiIterationFixture") == "true")
        val context = instrumentation.targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        require(!Settings(context).enabled && Settings(context).read().token.isBlank() && context.queue().depth() == 0)
        require(QuickNotes.draft(context).read() == NoteDraft() && context.localSources().sources().isEmpty())
        val previous = MoteI18n.preference()
        val callbacks = HandlerThread("generated-own-window-copy").apply { start() }
        try {
            for (language in listOf("zh-CN", "en")) {
                MoteI18n.select(context, language)
                val directory = File(context.filesDir, "ui-owned-window-diagnostic/$language").apply { mkdirs() }
                val intent = android.content.Intent(context, CentralActivity::class.java)
                    .putExtra("page", "overview").putExtra("featureGuide", true)
                ActivityScenario.launch<CentralActivity>(intent).use { scenario ->
                    val drawn = CountDownLatch(1)
                    scenario.onActivity { activity ->
                        val base = activity.window.decorView
                        assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                        val listener = object : android.view.ViewTreeObserver.OnDrawListener {
                            override fun onDraw() {
                                drawn.countDown()
                                base.post { if (base.viewTreeObserver.isAlive) base.viewTreeObserver.removeOnDrawListener(this) }
                            }
                        }
                        base.viewTreeObserver.addOnDrawListener(listener)
                        base.invalidate()
                    }
                    assertTrue("The actual owned Activity must draw", drawn.await(5, TimeUnit.SECONDS))
                    instrumentation.waitForIdleSync()
                    val copied = CountDownLatch(1)
                    var copyStatus = -1
                    lateinit var actualWindowBuffer: Bitmap
                    scenario.onActivity { activity ->
                        val base = activity.window.decorView
                        assertTrue(base.isAttachedToWindow && base.isShown && base.isLaidOut)
                        assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                        actualWindowBuffer = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888)
                        // This API reads only this Activity Window's Surface, not a compositor screenshot.
                        PixelCopy.request(activity.window, actualWindowBuffer, { status ->
                            copyStatus = status
                            copied.countDown()
                        }, Handler(callbacks.looper))
                    }
                    assertTrue("The owned-window copy returns an explicit result", copied.await(5, TimeUnit.SECONDS))
                    try {
                        if (copyStatus == PixelCopy.SUCCESS) File(directory, "activity-window-buffer.png").outputStream().use {
                            assertTrue(actualWindowBuffer.compress(Bitmap.CompressFormat.PNG, 100, it))
                        }
                        scenario.onActivity { activity ->
                            val base = activity.window.decorView
                            val software = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888)
                            try {
                                base.draw(Canvas(software))
                                File(directory, "activity-view-draw.png").outputStream().use {
                                    assertTrue(software.compress(Bitmap.CompressFormat.PNG, 100, it))
                                }
                            } finally { software.recycle() }
                            val elements = JSONArray()
                            for (view in views(base).filter { it.isShown && (it.tag?.toString()?.startsWith("primary:") == true || it.contentDescription == MoteI18n.text("添加内容")) }) {
                                val bounds = android.graphics.Rect(); view.getGlobalVisibleRect(bounds)
                                elements.put(JSONObject().put("class", view.javaClass.name).put("tag", view.tag ?: JSONObject.NULL)
                                    .put("contentDescription", view.contentDescription ?: JSONObject.NULL).put("text", (view as? TextView)?.text ?: JSONObject.NULL)
                                    .put("attached", view.isAttachedToWindow).put("hardwareAccelerated", view.isHardwareAccelerated)
                                    .put("bounds", bounds.toShortString()).put("backgroundClass", view.background?.javaClass?.name ?: JSONObject.NULL)
                                    .put("backgroundBounds", view.background?.bounds?.toShortString() ?: JSONObject.NULL))
                            }
                            File(directory, "diagnostic.json").writeText(JSONObject().put("generatedOnly", true)
                                .put("captureScope", "this generated Activity Window Surface only; no system/compositor/physical capture")
                                .put("secureWindow", activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                                .put("pixelCopyStatus", copyStatus).put("pixelCopySuccess", copyStatus == PixelCopy.SUCCESS)
                                .put("width", base.width).put("height", base.height).put("language", language)
                                .put("elements", elements).toString(2))
                        }
                    } finally { actualWindowBuffer.recycle() }
                }
            }
        } finally {
            callbacks.quitSafely()
            MoteI18n.select(context, previous)
        }
    }
}
