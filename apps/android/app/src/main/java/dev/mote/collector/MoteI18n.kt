package dev.mote.collector

import android.app.Activity
import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.os.Bundle
import java.util.Locale
import org.json.JSONObject

/** Localizes authored UI messages only. Arguments and captured content remain verbatim. */
object MoteI18n {
    @Volatile private var application: Context? = null
    @Volatile private var english: Map<String, String> = emptyMap()
    @Volatile private var selected = "system"
    private val argument = Regex("\\{(\\d+)\\}")
    fun initialize(context: Context) {
        application = context.applicationContext
        selected = context.getSharedPreferences("mote.language", Context.MODE_PRIVATE).getString("language", "system") ?: "system"
        val json = context.assets.open("i18n-en.json").bufferedReader().use { JSONObject(it.readText()) }
        english = json.keys().asSequence().associateWith { json.getString(it) }
    }
    fun preference() = selected
    fun language(): String {
        if (selected == "en" || selected == "zh-CN") return selected
        if (application == null) return "zh-CN" // Headless unit fixtures retain the protocol default.
        val languages = Resources.getSystem().configuration.locales
        for (i in 0 until languages.size()) {
            if (languages[i].language == "zh") return "zh-CN"
            if (languages[i].language == "en") return "en"
        }
        return "en"
    }
    fun locale(): Locale = Locale.forLanguageTag(language())
    fun select(context: Context, value: String) {
        require(value in listOf("system", "zh-CN", "en"))
        check(context.getSharedPreferences("mote.language", Context.MODE_PRIVATE).edit().putString("language", value).commit())
        selected = value
        Notifications.create(context)
    }
    fun wrap(context: Context): Context {
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale())
        config.setLayoutDirection(Locale.ENGLISH)
        return context.createConfigurationContext(config)
    }
    fun text(source: String, vararg values: Any?): String {
        val template = if (language() == "en") english[source] ?: source else source
        return argument.replace(template) { match ->
            val index = match.groupValues[1].toIntOrNull()
            if (index != null && index < values.size) values[index]?.toString() ?: "" else match.value
        }
    }
}

/** Recreate stale screens after returning from an app-language change. */
open class MoteActivity : Activity() {
    private var displayedLanguage = ""
    private var displayedUiRevision = -1L
    private var uiResumed = false
    private var stopUiObservation: (() -> Unit)? = null
    private val uiHandler = android.os.Handler(android.os.Looper.getMainLooper())
    override fun attachBaseContext(newBase: Context) { super.attachBaseContext(MoteAppearance.wrap(MoteI18n.wrap(newBase))) }
    override fun onCreate(savedInstanceState: Bundle?) {
        displayedLanguage = MoteI18n.language()
        displayedUiRevision = NativeUiPacks.registry.revision
        setTheme(if (lightSurface()) R.style.AppThemeLight else R.style.AppThemeDark)
        super.onCreate(savedInstanceState)
        stopUiObservation = NativeUiPacks.registry.observe { uiHandler.post { applyUiRevision() } }
        window.decorView.layoutDirection = android.view.View.LAYOUT_DIRECTION_LTR
        applyWindowPresentation()
    }
    private fun lightSurface(): Boolean {
        val color = MoteTheme.background
        return (android.graphics.Color.red(color) * 299 + android.graphics.Color.green(color) * 587 + android.graphics.Color.blue(color) * 114) >= 128000
    }
    private fun applyWindowPresentation() {
        val light = lightSurface()
        val appearanceConfig = Configuration(resources.configuration)
        appearanceConfig.uiMode = (appearanceConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
            if (light) Configuration.UI_MODE_NIGHT_NO else Configuration.UI_MODE_NIGHT_YES
        @Suppress("DEPRECATION")
        resources.updateConfiguration(appearanceConfig, resources.displayMetrics)
        setTheme(if (light) R.style.AppThemeLight else R.style.AppThemeDark)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(MoteTheme.background))
        @Suppress("DEPRECATION")
        window.statusBarColor = MoteTheme.background
        @Suppress("DEPRECATION")
        window.navigationBarColor = MoteTheme.background
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            val appearance = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (light) appearance else 0, appearance)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (light) android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else 0
        }
    }
    override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
        if (event.action == android.view.MotionEvent.ACTION_DOWN) {
            val field = currentFocus as? android.widget.EditText
            if (field != null) {
                val bounds = android.graphics.Rect()
                field.getGlobalVisibleRect(bounds)
                if (!bounds.contains(event.rawX.toInt(), event.rawY.toInt())) {
                    field.clearFocus()
                    getSystemService(android.view.inputmethod.InputMethodManager::class.java)
                        .hideSoftInputFromWindow(field.windowToken, 0)
                }
            }
        }
        return super.dispatchTouchEvent(event)
    }
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        MoteAppearance.refresh()
        // Handle uiMode in place: editors, open sheets and navigation keep their identity.
        applyWindowPresentation()
        NativePresentationStyles.refreshOwnedWindows(this)
        MoteDialogBuilder.refreshOwned(this)
    }
    override fun onResume() {
        super.onResume()
        MoteAppearance.refresh()
        uiResumed = true
        if (displayedLanguage != MoteI18n.language()) recreate() else applyUiRevision()
    }
    private fun applyUiRevision() {
        if (uiResumed && !isFinishing && !isDestroyed && displayedUiRevision != NativeUiPacks.registry.revision) {
            displayedUiRevision = NativeUiPacks.registry.revision
            applyWindowPresentation()
            NativePresentationStyles.refreshOwnedWindows(this)
            MoteDialogBuilder.refreshOwned(this)
        }
    }
    override fun onPause() { uiResumed = false; super.onPause() }
    override fun onDestroy() { stopUiObservation?.invoke(); uiHandler.removeCallbacksAndMessages(null); super.onDestroy() }
}
