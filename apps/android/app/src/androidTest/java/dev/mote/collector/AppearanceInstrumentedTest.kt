package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Opt-in only, clean fixture package on this run's dedicated headless emulator. */
@RunWith(AndroidJUnit4::class)
class AppearanceInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private var original = AppearancePreference.AUTO
    private var systemWasDark = false
    private var language = "system"
    @Before fun fixture() {
        org.junit.Assume.assumeTrue(InstrumentationRegistry.getArguments().getString("appearanceFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        require(!Settings(context).enabled && Settings(context).read().token.isBlank() && context.queue().depth() == 0 && context.localSources().sources().isEmpty() && QuickNotes.draft(context).read() == NoteDraft())
        original = MoteAppearance.preference(); systemWasDark = MoteAppearance.systemDark(); language = MoteI18n.preference()
        MoteI18n.select(context,"zh-CN")
    }
    @After fun cleanup() {
        if(InstrumentationRegistry.getArguments().getString("appearanceFixture") != "true")return
        instrumentation.runOnMainSync { MoteAppearance.select(context,original) }
        system(systemWasDark); MoteI18n.select(context,language)
        QuickNotes.draft(context).clear()
    }
    private fun views(root: View): List<View> = buildList { add(root); if(root is ViewGroup)repeat(root.childCount){addAll(views(root.getChildAt(it)))} }
    private fun visible(activity: Activity) = views(activity.window.decorView).filter { it.isShown }
    private fun waitFor(description:String,check:()->Boolean) {
        val end=SystemClock.elapsedRealtime()+10000
        while(SystemClock.elapsedRealtime()<end){if(check())return;Thread.sleep(30)}
        fail(description)
    }
    private fun system(dark:Boolean) {
        instrumentation.uiAutomation.executeShellCommand("cmd uimode night "+if(dark)"yes" else "no").use { descriptor -> java.io.FileInputStream(descriptor.fileDescriptor).readBytes() }
        waitFor("Auto receives OS appearance") { MoteAppearance.preference()!=AppearancePreference.AUTO || MoteAppearance.systemDark()==dark }
        instrumentation.waitForIdleSync()
    }
    private fun screenshot(activity:Activity,name:String) {
        val view=activity.window.decorView
        val bitmap=Bitmap.createBitmap(view.width,view.height,Bitmap.Config.ARGB_8888)
        try { view.draw(Canvas(bitmap)); File(context.getExternalFilesDir(null),"appearance/$name.png").apply { parentFile!!.mkdirs();outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) } } }
        finally { bitmap.recycle() }
    }
    @Test fun sixSelectionOsPairsColdActivityRecreationAndNativeChrome() {
        for(preference in AppearancePreference.entries)for(osDark in listOf(false,true)) {
            system(osDark);instrumentation.runOnMainSync { MoteAppearance.select(context,preference) }
            ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                lateinit var previousActivity:MainActivity
                scenario.onActivity { activity ->
                    previousActivity=activity
                    val expected=if(preference.dark(osDark))"#1c1b1a" else "#f7f5f1"
                    assertEquals(android.graphics.Color.parseColor(expected),MoteTheme.background)
                    assertEquals(preference.value,context.getSharedPreferences("mote.appearance",0).getString("appearance",null))
                    val flags=activity.window.insetsController!!.systemBarsAppearance
                    assertEquals(!preference.dark(osDark),flags and android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS != 0)
                    screenshot(activity,"${preference.value}-os-${if(osDark)"dark" else "light"}-cold")
                }
                scenario.recreate();scenario.awaitMainUi()
                scenario.onActivity { activity -> assertNotSame(previousActivity,activity);assertEquals(preference,MoteAppearance.preference());screenshot(activity,"${preference.value}-os-${if(osDark)"dark" else "light"}-restart") }
            }
        }
    }
    @Test fun liveSystemChangesAndReturnFromBackgroundKeepActualNoteAndOpenDialog() {
        for(preference in AppearancePreference.entries) {
            system(false);instrumentation.runOnMainSync { MoteAppearance.select(context,preference) }
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","NOTES")).awaitMainUi().use { scenario ->
                lateinit var activity:MainActivity;lateinit var root:View;lateinit var note:EditText
                lateinit var modal:android.app.AlertDialog;lateinit var modalField:EditText
                waitFor("Actual note editor ready") { var ready=false;scenario.onActivity { ready=visible(it).filterIsInstance<EditText>().any { field -> field.contentDescription==MoteI18n.text("正在想什么") && field.isEnabled } };ready }
                scenario.onActivity {
                    activity=it;root=it.window.decorView;note=visible(it).filterIsInstance<EditText>().single { field -> field.contentDescription==MoteI18n.text("正在想什么") }
                    note.setText("Generated theme draft");note.setSelection(4,12)
                    modalField=MoteUi.field(EditText(it)).apply { setText("Generated unsaved modal");setSelection(3,9) }
                    modal=MoteDialogBuilder(it).setTitle("Generated fixture modal").setView(modalField).setNegativeButton(android.R.string.ok,null).show()
                    modalField.requestFocus();modalField.setSelection(3,9)
                }
                system(true)
                waitFor("Theme settled") { MoteTheme.background==android.graphics.Color.parseColor(if(preference.dark(true))"#1c1b1a" else "#f7f5f1") }
                scenario.onActivity {
                    assertSame(activity,it);assertSame(root,it.window.decorView);assertTrue(modal.isShowing)
                    assertEquals("Generated theme draft",note.text.toString());assertEquals("Generated unsaved modal",modalField.text.toString())
                    assertEquals(3,modalField.selectionStart);assertEquals(9,modalField.selectionEnd);assertTrue(modalField.hasFocus())
                    assertEquals(MoteTheme.ink,modalField.currentTextColor)
                    modalField.isEnabled=false;assertEquals(MoteTheme.muted,modalField.currentTextColor);modalField.isEnabled=true
                    modalField.requestFocus();modalField.setSelection(3,9);assertNotNull(modalField.textCursorDrawable)
                    screenshot(it,"${preference.value}-live-modal-host")
                    MoteAppearance.select(it,AppearancePreference.AUTO)
                }
                waitFor("Auto clears the package override and resolves the current OS") { MoteTheme.background==android.graphics.Color.parseColor("#1c1b1a") }
                instrumentation.waitForIdleSync()
                scenario.onActivity { assertEquals(android.graphics.Color.parseColor("#1c1b1a"),MoteTheme.background);assertSame(activity,it);modal.dismiss() }
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
                system(false);scenario.resumeGeneratedTask()
                scenario.onActivity { assertSame(activity,it);assertEquals(android.graphics.Color.parseColor("#f7f5f1"),MoteTheme.background);assertEquals("Generated theme draft",note.text.toString()) }
            }
        }
    }
    @Test fun alreadyOpenNativeSpinnerPopupRefreshesWithoutLosingChoiceState() {
        system(false);instrumentation.runOnMainSync { MoteAppearance.select(context,AppearancePreference.AUTO) }
        ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","PRIVACY")).awaitMainUi().use { scenario ->
            lateinit var spinner:android.widget.Spinner
            lateinit var popup:View
            scenario.onActivity { activity -> spinner=visible(activity).filterIsInstance<android.widget.Spinner>().first();spinner.performClick() }
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                popup=android.view.inspector.WindowInspector.getGlobalWindowViews().first { it !== activity.window.decorView && views(it).any { child -> child is android.widget.ListView } }
            }
            for(preference in listOf(AppearancePreference.DARK,AppearancePreference.LIGHT,AppearancePreference.AUTO)) {
                scenario.onActivity { MoteAppearance.select(it,preference) };instrumentation.waitForIdleSync()
                scenario.onActivity {
                    assertTrue("Open popup window survives appearance changes",popup.isAttachedToWindow)
                    val rows=views(popup).filterIsInstance<TextView>().filter { row -> row.isShown && row.text.isNotEmpty() }
                    assertTrue(rows.isNotEmpty());rows.forEach { row -> assertEquals(MoteTheme.ink,row.currentTextColor) }
                    assertTrue(spinner.selectedItemPosition>=0)
                }
            }
            system(true);instrumentation.waitForIdleSync()
            scenario.onActivity { assertTrue(popup.isAttachedToWindow);views(popup).filterIsInstance<TextView>().filter { row -> row.isShown && row.text.isNotEmpty() }.forEach { row -> assertEquals(MoteTheme.ink,row.currentTextColor) } }
            instrumentation.uiAutomation.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
        }
    }
    @Test fun actualSettingsSingleChoiceChangesImmediatelyWithoutReplacingWindow() {
        ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","SETTINGS")).awaitMainUi().use { scenario ->
            lateinit var activity:MainActivity;lateinit var root:View
            scenario.onActivity {
                activity=it;root=it.window.decorView
                visible(it).single { view -> view.tag == "menu:" + MoteI18n.text("外观") }.performClick()
            }
            instrumentation.waitForIdleSync()
            // Use the app's registered owned dialogs, with a test-only handle supplied by their native window.
            val field=instrumentation.uiAutomation.rootInActiveWindow
            assertNotNull(field)
            for(preference in AppearancePreference.entries) {
                val text=MoteI18n.text(when(preference){AppearancePreference.LIGHT->"浅色";AppearancePreference.DARK->"深色";AppearancePreference.AUTO->"跟随系统"})
                val nodes=instrumentation.uiAutomation.rootInActiveWindow.findAccessibilityNodeInfosByText(text)
                assertTrue("Native choice available: $text",nodes.isNotEmpty());assertTrue(nodes.first().performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK))
                instrumentation.waitForIdleSync()
                waitFor("Settings choice persisted") { MoteAppearance.preference()==preference }
                scenario.onActivity { assertSame(activity,it);assertSame(root,it.window.decorView);screenshot(it,"settings-${preference.value}") }
            }
        }
    }
}
