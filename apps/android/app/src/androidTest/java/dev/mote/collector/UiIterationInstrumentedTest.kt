package dev.mote.collector

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Explicit generated-only visual evidence plus real navigation through the native app. */
@RunWith(AndroidJUnit4::class)
class UiIterationInstrumentedTest {
    private fun views(root: View): List<View> = buildList {
        add(root)
        if (root is ViewGroup) for (index in 0 until root.childCount) addAll(views(root.getChildAt(index)))
    }

    @Test fun generatedPlainNoteDetailKeepsItsOriginalAndUsesActionClose() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        org.junit.Assume.assumeTrue("Explicit generated-only iteration fixture required", InstrumentationRegistry.getArguments().getString("uiIterationFixture") == "true")
        val context = instrumentation.targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        require(!Settings(context).enabled && Settings(context).read().token.isBlank() && context.queue().depth() == 0)
        require(QuickNotes.draft(context).read().text.isEmpty() && context.localSources().sources().isEmpty())
        val previous = MoteI18n.preference()
        MoteI18n.select(context, "en")
        val text = "Generated note reader regression · 原文 🐾"
        val id = QuickNotes.save(context, text, "")
        try {
            ActivityScenario.launch<CaptureRecordsActivity>(android.content.Intent(context, CaptureRecordsActivity::class.java)
                .putExtra("recordId", id).putExtra("recordSource", "note").putExtra("recordDate", java.time.LocalDate.now().toString())).use { scenario ->
                val deadline = SystemClock.elapsedRealtime() + 10000
                var ready = false
                fun dialogRoot() = android.view.inspector.WindowInspector.getGlobalWindowViews().lastOrNull { it.findViewById<View>(android.R.id.button1)?.isShown == true }
                while (!ready && SystemClock.elapsedRealtime() < deadline) {
                    instrumentation.runOnMainSync { ready = dialogRoot()?.let { root -> views(root).filterIsInstance<TextView>().any { it.text.toString() == text } } == true }
                    if (!ready) Thread.sleep(25)
                }
                assertTrue("The native reader loads the original saved note", ready)
                instrumentation.runOnMainSync {
                    val root = requireNotNull(dialogRoot())
                    val labels = views(root).filterIsInstance<TextView>().filter { it.isShown }.map { it.text.toString() }
                    assertTrue(labels.contains("Close details")); assertFalse(labels.contains("Off"))
                    assertFalse(labels.contains("Media collection not enabled"))
                    val directory = File(context.filesDir, "ui-iterations/round-5").apply { mkdirs() }
                    val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
                    root.draw(Canvas(bitmap))
                    File(directory, "note-detail-english.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }; bitmap.recycle()
                    File(directory, "note-detail-english.txt").writeText(labels.joinToString("\n"))
                    assertTrue(root.findViewById<View>(android.R.id.button1).performClick())
                }
                scenario.onActivity { assertTrue(it.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0) }
            }
        } finally {
            context.queue().acknowledge(id)
            MoteI18n.select(context, previous)
        }
    }

    @Test fun generatedHomeContentAskJourney() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val args = InstrumentationRegistry.getArguments()
        org.junit.Assume.assumeTrue("Explicit generated-only iteration fixture required", args.getString("uiIterationFixture") == "true")
        val context = instrumentation.targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        require(!Settings(context).enabled && Settings(context).read().token.isBlank() && context.queue().depth() == 0)
        require(QuickNotes.draft(context).read().text.isEmpty())
        require(context.localSources().sources().isEmpty())
        val round = args.getString("uiIterationRound", "baseline").also { require(it.matches(Regex("baseline|[1-5]"))) }
        val variant = args.getString("uiIterationVariant", "default").also { require(it.matches(Regex("default|compact|english|compact-english"))) }
        val directory = File(context.filesDir, "ui-iterations/round-$round" + if (variant == "default") "" else "/$variant").apply { mkdirs() }
        val previous = MoteI18n.preference()
        MoteI18n.select(context, if (variant.contains("english")) "en" else "zh-CN")
        try {
            ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                fun settle() {
                    val ready = java.util.concurrent.CountDownLatch(1)
                    scenario.onActivity { activity -> activity.window.decorView.postOnAnimation {
                        activity.window.decorView.postOnAnimation { ready.countDown() }
                    } }
                    assertTrue("The real layout traversal must complete", ready.await(5, java.util.concurrent.TimeUnit.SECONDS))
                    instrumentation.waitForIdleSync()
                }
                fun render(name: String) {
                    settle()
                    scenario.onActivity { activity ->
                        assertTrue("Secure window remains enabled", activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                        val root = activity.window.decorView
                        val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
                        // Draw only this fresh fixture app's views, never capture the device display.
                        root.draw(Canvas(bitmap))
                        File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                        bitmap.recycle()
                        File(directory, "$name.txt").writeText(views(root).filterIsInstance<TextView>().filter { it.isShown }.joinToString("\n") { it.text.toString() })
                    }
                }
                fun tab(identity: String) {
                    scenario.onActivity { activity -> views(activity.window.decorView).single { it.isShown && it.tag == "primary:$identity" }.performClick() }
                }
                render("home")
                scenario.onActivity { activity ->
                    assertEquals(4, views(activity.window.decorView).count { it.tag?.toString()?.startsWith("add:") == true })
                    assertEquals(3, views(activity.window.decorView).count { it.tag?.toString()?.startsWith("primary:") == true })
                    assertFalse(Settings(activity).enabled)
                }
                tab("LIBRARY"); render("content")
                tab("ASK")
                val deadline = SystemClock.elapsedRealtime() + 10000
                var loaded = false
                while (!loaded && SystemClock.elapsedRealtime() < deadline) {
                    scenario.onActivity { activity -> loaded = views(activity.window.decorView).any { it.tag == "central-title" && (it as TextView).text.isNotBlank() } }
                    if (!loaded) Thread.sleep(25)
                }
                assertTrue("Ask uses the real embedded native central page", loaded)
                render("ask")
                scenario.onActivity { activity ->
                    val header = views(activity.window.decorView).single { it.isShown && it.tag == "central-header" }
                    val settings = views(header).filterIsInstance<TextView>().single { it.text.toString() == MoteI18n.text("设置") }
                    assertEquals("The header action stays readable at narrow widths and large fonts", 1, settings.lineCount)
                }
                tab("TODAY")
                scenario.onActivity { activity -> activity.openGeneratedAdd(MoteAddAction.NOTE) }
                render("note")
                if (args.getString("uiIterationKeyboard") == "true") {
                    val deadline = SystemClock.elapsedRealtime() + 10000
                    var ready = false
                    while (!ready && SystemClock.elapsedRealtime() < deadline) {
                        scenario.onActivity { activity -> ready = views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any { it.isShown && it.isEnabled } }
                        if (!ready) Thread.sleep(25)
                    }
                    assertTrue("The real note draft must load before keyboard input", ready)
                    scenario.onActivity { activity ->
                        val field = views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single { it.isShown }
                        assertTrue(field.requestFocus())
                        activity.getSystemService(android.view.inputmethod.InputMethodManager::class.java).showSoftInput(field, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
                    }
                    var shown = false
                    while (!shown && SystemClock.elapsedRealtime() < deadline) {
                        scenario.onActivity { shown = it.window.decorView.rootWindowInsets?.isVisible(android.view.WindowInsets.Type.ime()) == true }
                        if (!shown) Thread.sleep(25)
                    }
                    assertTrue("Generated note keyboard must actually open", shown)
                    render("note-keyboard")
                    scenario.onActivity { activity ->
                        val root = activity.window.decorView
                        val availableBottom = root.height - root.rootWindowInsets.getInsets(android.view.WindowInsets.Type.ime()).bottom
                        for (item in views(root).filter { it.tag?.toString()?.startsWith("primary:") == true }) {
                            val bounds = android.graphics.Rect(); assertTrue(item.getGlobalVisibleRect(bounds))
                            assertTrue("Navigation stays above the keyboard", bounds.height() == item.height && bounds.bottom <= availableBottom + 2)
                        }
                        activity.getSystemService(android.view.inputmethod.InputMethodManager::class.java).hideSoftInputFromWindow(root.windowToken, 0)
                        root.clearFocus()
                    }
                }
                scenario.onActivity { activity -> views(activity.window.decorView).single { it.isShown && it.contentDescription == MoteI18n.text("返回{0}", MoteI18n.text("内容")) }.performClick() }
                tab("TODAY")
                scenario.onActivity { activity -> activity.openGeneratedAdd(MoteAddAction.SCREEN) }
                render("screen-scope")
                assertFalse(Settings(context).enabled)
            }
            ActivityScenario.launch<CentralActivity>(android.content.Intent(context, CentralActivity::class.java).putExtra("page", "archive")).use { scenario ->
                val deadline = SystemClock.elapsedRealtime() + 10000
                var ready = false
                while (!ready && SystemClock.elapsedRealtime() < deadline) {
                    scenario.onActivity { activity -> ready = views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.toString() == MoteI18n.text("中央资料库暂不可用。连接中央后，可浏览已归档的资料；文件和随手记仍可在本机保存和查看。") } }
                    if (!ready) Thread.sleep(25)
                }
                assertTrue("Offline archive must explain browsing instead of questioning", ready)
                scenario.onActivity { activity ->
                    val title = views(activity.window.decorView).single { it.tag == "central-title" } as TextView
                    assertEquals(MoteI18n.text("中央资料库"), title.text.toString())
                    activity.navigate("ask")
                    assertEquals(MoteI18n.text("问一问"), title.text.toString())
                    assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.toString() == MoteI18n.text("中央问答暂不可用。连接中央后，可以根据已整理的内容提问；文件和随手记仍可在本机保存。") })
                    activity.navigate("archive")
                    assertEquals(MoteI18n.text("中央资料库"), title.text.toString())
                    assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().none { it.text.toString() == MoteI18n.text("中央问答暂不可用。连接中央后，可以根据已整理的内容提问；文件和随手记仍可在本机保存。") })
                }
            }
            ActivityScenario.launch<FileTaskActivity>(android.content.Intent(context, FileTaskActivity::class.java).putExtra("addAction", "FILE")).awaitUiText(MoteI18n.text("未连接中央：先保存本机任务，连接时确认发送范围。")).use { scenario ->
                scenario.onActivity { activity ->
                    assertFalse(Settings(activity).read().hasSyncConnection())
                    val labels = views(activity.window.decorView).filterIsInstance<TextView>().map { it.text.toString() }
                    if (Settings(activity).read().server.isNotBlank()) assertTrue(labels.contains(MoteI18n.text("已填写的中央地址：{0}；连接并确认后才会发送。", Settings(activity).read().server)))
                    assertTrue(labels.none { it.startsWith(MoteI18n.text("完整文件的发送目的地：{0}", Settings(activity).read().server)) })
                    val root = activity.window.decorView
                    val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
                    root.draw(Canvas(bitmap))
                    File(directory, "import-local-task.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }; bitmap.recycle()
                    File(directory, "import-local-task.txt").writeText(labels.joinToString("\n"))
                }
            }
            fun dialogRoot(): View? = android.view.inspector.WindowInspector.getGlobalWindowViews().lastOrNull { root ->
                root.findViewById<View>(android.R.id.button2)?.isShown == true
            }
            fun dialogViews(): List<View> = dialogRoot()?.let(::views).orEmpty()
            fun tapDialog(label: String) {
                instrumentation.waitForIdleSync()
                instrumentation.runOnMainSync {
                    val target = dialogViews().filterIsInstance<TextView>().single { it.isShown && it.text.toString() == MoteI18n.text(label) }
                    assertTrue("Dialog action must actually be visible", target.getGlobalVisibleRect(android.graphics.Rect()))
                    var row: View = target
                    while (row.parent is View && row.parent !is android.widget.ListView) row = row.parent as View
                    val list = row.parent as? android.widget.ListView
                    if (list != null) {
                        val position = list.getPositionForView(row)
                        assertTrue(list.performItemClick(row, position, list.getItemIdAtPosition(position)))
                    } else assertTrue(target.performClick())
                }
                instrumentation.waitForIdleSync()
            }
            fun drawDialog(name: String) {
                instrumentation.waitForIdleSync()
                instrumentation.runOnMainSync {
                    File(directory, "$name-roots.txt").writeText(android.view.inspector.WindowInspector.getGlobalWindowViews().joinToString("\n\n") { root -> views(root).filterIsInstance<TextView>().joinToString("\n") { "${it.id} shown=${it.isShown} text=${it.text}" } })
                    val root = requireNotNull(dialogRoot())
                    val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
                    root.draw(Canvas(bitmap))
                    File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }; bitmap.recycle()
                    File(directory, "$name.txt").writeText(views(root).filterIsInstance<TextView>().filter { it.isShown }.joinToString("\n") { it.text.toString() })
                }
            }
            val guide = android.content.Intent(context, CentralActivity::class.java).putExtra("page", "overview").putExtra("featureGuide", true)
            ActivityScenario.launch<CentralActivity>(guide).use { scenario ->
                drawDialog("feature-guide")
                tapDialog("内容"); drawDialog("feature-guide-content")
                instrumentation.runOnMainSync {
                    assertTrue(dialogViews().filterIsInstance<TextView>().any { it.text.toString() == MoteI18n.text("记忆") })
                    assertTrue(dialogViews().filterIsInstance<TextView>().none { it.text.toString() in listOf(MoteI18n.text("Coding Agent 上传"), MoteI18n.text("Coding 会话同步状态")) })
                }
                tapDialog("记忆")
                scenario.onActivity { activity -> assertEquals(MoteI18n.text("记忆"), (views(activity.window.decorView).single { it.tag == "central-title" } as TextView).text.toString()) }
                scenario.recreate()
                instrumentation.waitForIdleSync()
                scenario.onActivity { activity ->
                    assertEquals(MoteI18n.text("记忆"), (views(activity.window.decorView).single { it.tag == "central-title" } as TextView).text.toString())
                    assertTrue(dialogViews().filterIsInstance<TextView>().none { it.text.toString() == MoteI18n.text("此客户端支持的中央功能") })
                    activity.navigate("coding")
                    assertEquals(MoteI18n.text("Coding 会话同步状态"), (views(activity.window.decorView).single { it.tag == "central-title" } as TextView).text.toString())
                }
            }
            MoteI18n.select(context, "en")
            ActivityScenario.launch<CentralActivity>(guide).use {
                drawDialog("feature-guide-english")
                instrumentation.runOnMainSync {
                    assertTrue("Dialog close uses an action translation", dialogViews().filterIsInstance<TextView>().any { it.text.toString() == "Cancel" })
                    assertTrue(dialogViews().filterIsInstance<TextView>().none { it.text.toString() == "Off" })
                }
                tapDialog("Cancel")
            }
        } finally { MoteI18n.select(context, previous) }
    }
}
