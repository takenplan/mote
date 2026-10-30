package dev.mote.collector

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Explicitly selected generated emulator only. No network, invitation redemption or capture. */
@RunWith(AndroidJUnit4::class)
class ConnectionHierarchyInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun views(view: View): List<View> = listOf(view) + if(view is ViewGroup) (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()
    private fun shown(activity: MainActivity) = views(activity.window.decorView).filter { it.isShown }
    private fun guard() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("uiFinalFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        require(!Settings(context).enabled && !ProjectionService.running)
    }
    private fun await(scenario: ActivityScenario<MainActivity>, label: String, predicate: (MainActivity)->Boolean) {
        val deadline=SystemClock.elapsedRealtime()+15000
        while(SystemClock.elapsedRealtime()<deadline) { var ready=false;scenario.onActivity { ready=predicate(it) };if(ready)return;Thread.sleep(40) }
        fail(label)
    }
    private fun screenshot(scenario: ActivityScenario<MainActivity>, name: String) {
        val frames=CountDownLatch(1)
        scenario.onActivity { it.window.decorView.postOnAnimation { it.window.decorView.postOnAnimation { frames.countDown() } } }
        assertTrue(frames.await(5,TimeUnit.SECONDS))
        scenario.onActivity { GeneratedWindowRendering.save(it, File(context.filesDir,"connection-hierarchy-final").apply { mkdirs() },name) }
    }
    private fun selectTheme(theme: AppearancePreference) { instrumentation.runOnMainSync { MoteAppearance.select(context,theme) };instrumentation.waitForIdleSync() }

    @Test fun invitationAndSavedStatusArePrimaryWhileManualDraftSurvivesCollapseRecreationAndTheme() {
        guard();val before=Settings(context).read();val language=MoteI18n.preference();val appearance=MoteAppearance.preference()
        require(!before.hasSyncConnection())
        try {
            MoteI18n.select(context,"zh-CN");selectTheme(AppearancePreference.LIGHT)
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","CONNECTION")).awaitMainUi().use { scenario ->
                await(scenario,"Default invitation/status ready") { shown(it).any { view->view.tag=="connection-settings-toggle" } }
                scenario.onActivity { a->
                    assertEquals(View.GONE,a.window.decorView.findViewWithTag<View>("connection-settings-panel").visibility)
                    assertTrue(shown(a).any { it.tag=="menu:扫码或导入邀请" })
                    assertTrue(shown(a).any { it.tag=="connection-current-status" })
                    assertFalse(shown(a).any { it is EditText })
                }
                screenshot(scenario,"connection-default-light");selectTheme(AppearancePreference.DARK);screenshot(scenario,"connection-default-dark")
                scenario.onActivity { a->
                    shown(a).single { it.tag=="connection-settings-toggle" }.performClick()
                    val fields=shown(a).filterIsInstance<EditText>()
                    fields.single { it.hint.toString()=="https://mote.example.com" }.setText("https://generated-draft.invalid")
                    fields.single { it.hint.toString()==MoteI18n.text("建议通过邀请获取本设备凭据") }.apply { setText("generated-private-unsaved-token-1234567890");requestFocus();setSelection(3,8) }
                    fields.single { it.tag=="设备名称" }.setText("Generated unsaved connection name")
                    assertEquals(before,Settings(context).read())
                    shown(a).single { it.tag=="connection-settings-toggle" }.performClick()
                    assertFalse(shown(a).any { it is EditText })
                    shown(a).single { it.tag=="connection-settings-toggle" }.performClick()
                    assertEquals("generated-private-unsaved-token-1234567890",shown(a).filterIsInstance<EditText>().single { it.hint.toString()==MoteI18n.text("建议通过邀请获取本设备凭据") }.text.toString())
                }
                scenario.recreate();scenario.awaitMainUi()
                await(scenario,"Expanded private draft restored") { shown(it).filterIsInstance<EditText>().any { field->field.tag=="设备名称"&&field.text.toString()=="Generated unsaved connection name" } }
                scenario.onActivity { a->
                    val token=shown(a).filterIsInstance<EditText>().single { it.hint.toString()==MoteI18n.text("建议通过邀请获取本设备凭据") }
                    assertEquals("generated-private-unsaved-token-1234567890",token.text.toString());assertTrue(token.requestFocus());token.setSelection(3,8)
                    assertEquals(View.VISIBLE,a.window.decorView.findViewWithTag<View>("connection-settings-panel").visibility)
                    assertEquals(before,Settings(context).read())
                }
                screenshot(scenario,"connection-manual-draft-dark");selectTheme(AppearancePreference.LIGHT)
                scenario.onActivity { a->
                    val token=shown(a).filterIsInstance<EditText>().single { it.hint.toString()==MoteI18n.text("建议通过邀请获取本设备凭据") }
                    assertEquals(3,token.selectionStart);assertEquals(8,token.selectionEnd);assertTrue(token.hasFocus())
                    assertEquals(before,Settings(context).read())
                    shown(a).single { it.tag=="connection-settings-toggle" }.performClick()
                    assertFalse(shown(a).any { it is EditText })
                }
                screenshot(scenario,"connection-collapsed-draft-light")
            }
            assertEquals(before,Settings(context).read());assertFalse(Settings(context).enabled)
        } finally { MoteI18n.select(context,language);selectTheme(appearance) }
    }

    @Test fun aboutShowsTheActualBuildProfileAndVersionAcrossThemesLanguageAndReturn() {
        guard();val before=Settings(context).read();val language=MoteI18n.preference();val appearance=MoteAppearance.preference()
        try {
            MoteI18n.select(context,"zh-CN");selectTheme(AppearancePreference.LIGHT)
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","ABOUT")).awaitMainUi().use { scenario ->
                fun actual(a:MainActivity) {
                    val title=shown(a).single { it.tag=="about-build-profile" } as TextView
                    assertEquals("Mote · ${RuntimeProfile.current.name}",title.text.toString())
                    assertEquals("The current theme must reach the actual About card",NativeColorRole.TINT.color(),((title.parent as View).background as android.graphics.drawable.GradientDrawable).color!!.defaultColor)
                    assertEquals(NativeColorRole.INK.color(),title.currentTextColor)
                    assertTrue(shown(a).filterIsInstance<TextView>().any { it.text.toString()==MoteI18n.text("版本 {0}",BuildConfig.VERSION_NAME) })
                    assertEquals(before,Settings(context).read())
                }
                scenario.onActivity(::actual);screenshot(scenario,"about-profile-light")
                selectTheme(AppearancePreference.DARK);scenario.onActivity(::actual);screenshot(scenario,"about-profile-dark")
                scenario.onActivity { it.onBackPressed() }
                await(scenario,"Return to this-device settings") { shown(it).any { view->view.tag=="menu:关于、更新与反馈" } }
                scenario.onActivity { shown(it).single { view->view.tag=="menu:关于、更新与反馈" }.performClick();actual(it) }
                MoteI18n.select(context,"en");scenario.recreate();scenario.awaitMainUi();scenario.onActivity(::actual);screenshot(scenario,"about-profile-english-dark")
                scenario.onActivity { it.onBackPressed() }
                await(scenario,"Return to device options in English") { shown(it).any { view->view.tag=="menu:"+MoteI18n.text("系统权限与后台运行") } }
                scenario.onActivity { a->shown(a).single { it.tag=="menu:"+MoteI18n.text("系统权限与后台运行") }.performClick() }
                await(scenario,"Actual permission state ready") { a->shown(a).filterIsInstance<TextView>().any { it.tag=="permission-detail"&&!it.text.toString().startsWith(MoteI18n.text("正在检查系统权限…")) } }
                fun permissionCard(a:MainActivity) {
                    val detail=shown(a).filterIsInstance<TextView>().single { it.tag=="permission-detail" && ((it.parent as? ViewGroup)?.getChildAt(0) as? TextView)?.text?.toString()==MoteI18n.text("投屏会话") }
                    assertEquals("The shared role reaches the Projection permission card",NativeColorRole.TINT.color(),((detail.parent as View).background as android.graphics.drawable.GradientDrawable).color!!.defaultColor)
                    assertFalse(Settings(context).enabled);assertFalse(ProjectionService.running)
                }
                scenario.onActivity(::permissionCard);screenshot(scenario,"permissions-live-tint-dark")
                selectTheme(AppearancePreference.LIGHT);scenario.onActivity(::permissionCard);screenshot(scenario,"permissions-live-tint-light")
            }
            assertEquals(before,Settings(context).read())
        } finally { MoteI18n.select(context,language);selectTheme(appearance) }
    }

    @Test fun aNewCommittedConnectionWithdrawsThePreviousManualDisclosureAndPrivateDraft() {
        guard();val settings=Settings(context);val before=settings.read();val language=MoteI18n.preference()
        require(!before.hasSyncConnection() && context.queue().depth()==0)
        try {
            MoteI18n.select(context,"zh-CN")
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","CONNECTION")).awaitMainUi().use { scenario ->
                scenario.onActivity { a->
                    shown(a).single { it.tag=="connection-settings-toggle" }.performClick()
                    shown(a).filterIsInstance<EditText>().single { it.hint.toString()=="https://mote.example.com" }.setText("https://previous-private-draft.invalid")
                    shown(a).filterIsInstance<EditText>().single { it.hint.toString()==MoteI18n.text("建议通过邀请获取本设备凭据") }.setText("previous-private-unsaved-token-1234567890")
                }
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
                // The normal committed producer, as when the separate invitation screen returns.
                // Only loopback is used; this test does not redeem an invitation or contact a node.
                settings.saveConnection("https://127.0.0.1:1","generated-current-token-12345678901234567890","Generated current device",false)
                scenario.resumeGeneratedTask()
                await(scenario,"Changed connection returns to the default surface") { a->
                    a.window.decorView.findViewWithTag<View>("connection-settings-panel")?.visibility==View.GONE &&
                        views(a.window.decorView).filterIsInstance<EditText>().any { it.hint.toString()=="https://mote.example.com"&&it.text.toString()=="https://127.0.0.1:1" }
                }
                scenario.onActivity { a->
                    assertFalse(shown(a).any { it is EditText })
                    assertFalse(shown(a).filterIsInstance<TextView>().any { it.text.toString().contains("最近一次验证成功") })
                    shown(a).single { it.tag=="connection-settings-toggle" }.performClick()
                    assertEquals("",shown(a).filterIsInstance<EditText>().firstOrNull { it.hint.toString()==MoteI18n.text("建议通过邀请获取本设备凭据") }?.text?.toString().orEmpty())
                    assertFalse(views(a.window.decorView).filterIsInstance<EditText>().any { it.text.toString().contains("previous-private") })
                    shown(a).single { it.tag=="connection-settings-toggle" }.performClick()
                }
                screenshot(scenario,"connection-new-owner-default")
                assertFalse(settings.enabled);assertEquals(0,context.queue().depth())
            }
        } finally { settings.save(before,confirmCentralEndpoint=true);MoteI18n.select(context,language) }
    }
}
