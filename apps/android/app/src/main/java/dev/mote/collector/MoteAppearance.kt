package dev.mote.collector

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.os.Build

/** Native Activity/Material themes, without replacing the existing View tree or draft closures. */
internal object MoteAppearance {
    private var selected = AppearancePreference.AUTO
    fun preference() = selected
    fun systemDark() = Resources.getSystem().configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    fun dark() = selected.dark(systemDark())
    fun initialize(context: Context) {
        selected = AppearancePreference.parse(runCatching { context.getSharedPreferences("mote.appearance", Context.MODE_PRIVATE).getString("appearance", "auto") }.getOrNull())
        applyPlatform(context)
        refresh()
    }
    fun select(context: Context, value: AppearancePreference) {
        check(context.getSharedPreferences("mote.appearance", Context.MODE_PRIVATE).edit().putString("appearance", value.value).commit())
        selected = value
        applyPlatform(context)
        refresh()
    }
    private fun applyPlatform(context: Context) {
        if (Build.VERSION.SDK_INT >= 31) {
            // App-local AUTO clears the package night override (UI_MODE_NIGHT_UNDEFINED),
            // so the system resolves its own appearance. It does not change the global mode.
            context.getSystemService(UiModeManager::class.java).setApplicationNightMode(when (selected) {
                AppearancePreference.LIGHT -> UiModeManager.MODE_NIGHT_NO
                AppearancePreference.DARK -> UiModeManager.MODE_NIGHT_YES
                AppearancePreference.AUTO -> UiModeManager.MODE_NIGHT_AUTO
            })
        }
    }
    fun refresh() { NativeUiPacks.registry.colorScheme(if (dark()) "dark" else "light") }
    fun wrap(context: Context): Context {
        val configuration = Configuration(context.resources.configuration)
        configuration.uiMode = (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
            if (dark()) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
        return context.createConfigurationContext(configuration)
    }
}
