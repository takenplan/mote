package dev.mote.collector

import android.graphics.Bitmap
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import android.widget.Button
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Existing TEST build runs the production update renderer. Synthetic states are never claimed as trusted releases. */
class FinalUpdateUiInstrumentedTest {
 private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
 private val context get()=instrumentation.targetContext
 private fun <T> main(block:()->T):T{val value=AtomicReference<Result<T>>();instrumentation.runOnMainSync{value.set(runCatching(block))};return value.get().getOrThrow()}
 private fun views(v:View):List<View> = listOf(v)+if(v is ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList()
 private fun shown()=WindowInspector.getGlobalWindowViews().filter{it.isShown&&it.hasWindowFocus()}.flatMap(::views).filter{it.isShown}
 private fun until(label:String,check:()->Boolean){val end=SystemClock.elapsedRealtime()+25_000;while(SystemClock.elapsedRealtime()<end){if(check())return;Thread.sleep(50)};fail(label)}
 private fun has(text:String)=main{shown().filterIsInstance<TextView>().any{it.text.toString().contains(text)}}
 private fun picture(name:String){instrumentation.waitForIdleSync();val frame=CountDownLatch(1);main{WindowInspector.getGlobalWindowViews().last{it.isShown&&it.hasWindowFocus()}.postOnAnimation{frame.countDown()}};check(frame.await(5,TimeUnit.SECONDS));main{val root=WindowInspector.getGlobalWindowViews().last{it.isShown&&it.hasWindowFocus()};val image=Bitmap.createBitmap(root.width,root.height,Bitmap.Config.ARGB_8888);try{File(context.filesDir,"final-update-ui").apply{mkdirs()}.resolve("$name.png").outputStream().use{root.draw(android.graphics.Canvas(image));image.compress(Bitmap.CompressFormat.PNG,100,it)}}finally{image.recycle()}}}
 @Test fun testProfileUpdateStatesDeleteOnlyGeneratedPackagesWithoutAnInstallRequest(){
  assumeTrue(InstrumentationRegistry.getArguments().getString("nativeFinalUpdateUi")=="true")
  require(context.packageName=="dev.mote.collector.test"&&RuntimeProfile.current==RuntimeProfile.TEST&&Build.FINGERPRINT.contains("emu64a"))
  val settings=Settings(context);require(!settings.enabled&&!ProjectionService.running&&!CaptureAccessibilityService.connected&&settings.read().token.isBlank()&&context.queue().dedupeIds().isEmpty())
  val before=settings.read();val beforePermission=context.packageManager.canRequestPackageInstalls();val sessions=context.packageManager.packageInstaller.mySessions.map{it.sessionId}.toSet();val store=AppUpdateStore(context);require(!store.prefs.getBoolean("installRequestActive",false)&&store.candidate()==null);val preferences=store.prefs.all.toMap();val language=MoteI18n.preference();val appearance=MoteAppearance.preference()
  val bytes=File(context.applicationInfo.sourceDir).readBytes();val hash=java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)};val apk=File(store.directory,"$hash.apk");val partial=File(store.directory,"${"e".repeat(64)}.part");require(!apk.exists()&&!partial.exists());val states=JSONArray()
  try{
   MoteI18n.select(context,"zh-CN");main{MoteAppearance.select(context,AppearancePreference.LIGHT)}
   ActivityScenario.launch(AppUpdatesActivity::class.java).awaitUiText("检查更新").use{
    until("Initial current-format renderer settled"){has("尚未检查更新")}
    for(state in listOf("current","available","downloading","checksum","ready")){
     val available=if(state=="current")BuildConfig.VERSION_CODE.toLong() else BuildConfig.VERSION_CODE.toLong()+1
     if(state=="downloading")partial.writeBytes(bytes.copyOf(bytes.size/2));if(state=="ready")apk.writeBytes(bytes)
     store.prefs.edit().putString("state",state).putString("availableVersion",if(state=="current")BuildConfig.VERSION_NAME else "99.0.0").putLong("availableCode",available).putLong("size",bytes.size.toLong()).putLong("bytes",if(state=="downloading")partial.length()else if(state=="ready")apk.length()else 0).commit()
     until("Actual renderer reflects controlled $state"){has(AppUpdatesActivity.message(state))};assertEquals(sessions,context.packageManager.packageInstaller.mySessions.map{it.sessionId}.toSet());assertFalse(store.prefs.getBoolean("installRequestActive",false));assertEquals(beforePermission,context.packageManager.canRequestPackageInstalls());assertEquals(before,settings.read());picture("update-synthetic-$state")
     if(state=="ready"){
      main{val install=shown().filterIsInstance<Button>().single{it.text.toString()=="安装更新"};val delete=shown().filterIsInstance<Button>().single{it.tag=="update-delete-package"};assertSame(install.parent,delete.parent);assertTrue(delete.isEnabled&&delete.isShown);assertFalse(shown().any{it.tag=="app-update-settings:content"});delete.performClick()}
      until("Real generated files deleted with no installation"){!apk.exists()&&!partial.exists()&&has("发现已验证发布，可下载")};picture("update-real-generated-file-deleted")
     }
     states.put(state)
    }
   }
   assertEquals(sessions,context.packageManager.packageInstaller.mySessions.map{it.sessionId}.toSet());assertFalse(store.prefs.getBoolean("installRequestActive",false));assertEquals(beforePermission,context.packageManager.canRequestPackageInstalls());assertEquals(before,settings.read())
   File(context.filesDir,"final-update-ui/result.json").writeText(JSONObject().put("generatedOnly",true).put("profile","test").put("productionRendererBranch",true).put("syntheticStateOnly",true).put("canonicalManifestOrDownloadVerified",false).put("canonicalTrustKeyUnchanged",true).put("states",states).put("actualGeneratedPackageDeletion",true).put("packageInstallerInvoked",false).put("installPermissionUnchanged",true).put("modelCalls",0).toString())
  }finally{apk.delete();partial.delete();val editor=store.prefs.edit().clear();preferences.forEach{(key,value)->when(value){is String->editor.putString(key,value);is Boolean->editor.putBoolean(key,value);is Long->editor.putLong(key,value);is Int->editor.putInt(key,value);is Float->editor.putFloat(key,value);is Set<*>->editor.putStringSet(key,value.filterIsInstance<String>().toSet())}};check(editor.commit());MoteI18n.select(context,language);main{MoteAppearance.select(context,appearance)}}
 }
}
