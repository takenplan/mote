package dev.mote.collector

import android.content.Context
import android.graphics.Color
import org.json.JSONObject
import kotlin.math.roundToInt

/** Only app-bundled providers may register code. Evidence and server catalogues never register UI. */
internal data class NativeUiIdentity(val id: String, val version: String) {
    init { require(Regex("[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}").matches(id) && Regex("[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}").matches(version)) { "Invalid native UI provider identity" } }
}
internal data class NativeUiBinding(val theme: NativeUiIdentity, val layout: NativeUiIdentity)
internal data class NativeUiNotificationError(val observer: Int, val code: String = "observer-failed")
internal data class NativeThemeSnapshot(val identity: NativeUiIdentity, val tokens: Map<String, String>, val schemes: Map<String, Map<String, String>> = emptyMap()) {
    fun value(key: String): String = requireNotNull(tokens[key]) { "Missing native theme token: $key" }
    fun number(key: String): Double = value(key).removeSuffix("px").removeSuffix("em").toDouble()
    fun dimension(key: String): Int = number(key).roundToInt()
}
internal data class NativeLayoutSnapshot(
    val identity: NativeUiIdentity,
    val primary: List<String>,
    val initial: String,
    val navigation: String,
    val detail: String,
) { fun usesDetailPane(widthDp: Int): Boolean = detail == "split" && widthDp >= 840 }
internal interface NativeThemeProvider { val snapshot: NativeThemeSnapshot }
internal interface NativeLayoutProvider { val snapshot: NativeLayoutSnapshot }

/** Exact binding is deliberately separate from installation. No fuzzy version or unknown-route dispatch. */
internal class NativeUiPackRegistry {
    private val themes = linkedMapOf<NativeUiIdentity, NativeThemeSnapshot>()
    private val layouts = linkedMapOf<NativeUiIdentity, NativeLayoutSnapshot>()
    private val observers = java.util.concurrent.CopyOnWriteArrayList<(Long) -> Unit>()
    private var colorScheme = "dark"
    private var binding: NativeUiBinding? = null
    private var builtin: NativeUiBinding? = null
    private var removalReason: String? = null
    private var notificationErrors: List<NativeUiNotificationError> = emptyList()
    @Volatile var revision = 0L; private set
    @Synchronized fun register(provider: NativeThemeProvider) {
        val supplied = provider.snapshot
        val snapshot = supplied.copy(tokens = java.util.Collections.unmodifiableMap(supplied.tokens.toMap()), schemes = java.util.Collections.unmodifiableMap(supplied.schemes.mapValues { java.util.Collections.unmodifiableMap(it.value.toMap()) }))
        require(snapshot.identity !in themes) { "Duplicate native theme provider" }
        listOf("background", "surface", "sidebar", "ink", "muted", "accent", "accent-hover", "tint", "border", "control-border", "divider", "success", "warning", "danger", "success-tint", "warning-tint", "danger-tint", "primary-background", "primary-ink", "surface-raised").forEach {
            require(Regex("#[a-fA-F0-9]{6}").matches(snapshot.value(it))) { "Unsupported native color token: $it" }
        }
        listOf("radius", "radius-container", "radius-control", "radius-reading", "radius-indicator", "border-width", "panel-border-width").forEach { require(snapshot.number(it).isFinite() && snapshot.number(it) >= 0) }
        listOf("font-title", "font-title-mobile", "font-appbar", "font-section", "font-row", "font-body", "font-support", "font-meta", "font-action", "space-page", "space-panel", "space-group", "space-item", "space-inline", "control-height-mobile").forEach { require(snapshot.number(it).isFinite() && snapshot.number(it) > 0) }
        require(snapshot.number("control-height-mobile") >= 48) { "Native controls require the phone touch-target contract" }
        listOf("weight-title", "weight-section", "weight-body").forEach { require(snapshot.number(it) in 100.0..900.0) }
        require(snapshot.number("line-body").isFinite() && snapshot.number("line-body") > 0)
        require(snapshot.number("letter-title").isFinite())
        listOf("font", "font-heading").forEach { require(snapshot.value(it).isNotBlank()) }
        require(snapshot.schemes.isEmpty() || snapshot.schemes.keys == setOf("light", "dark")) { "Native appearance requires both color schemes" }
        snapshot.schemes.forEach { (scheme, values) ->
            require(scheme in setOf("light", "dark") && values.keys == snapshot.tokens.keys) { "Incompatible native color schemes" }
            values.forEach { (key, value) -> if (snapshot.value(key).startsWith("#")) require(Regex("#[a-fA-F0-9]{6}").matches(value)) }
        }
        themes[snapshot.identity] = snapshot
    }
    @Synchronized fun register(provider: NativeLayoutProvider) {
        val supplied = provider.snapshot
        val value = supplied.copy(primary = java.util.Collections.unmodifiableList(supplied.primary.toList()))
        require(value.identity !in layouts) { "Duplicate native layout provider" }
        require(value.primary.size == 4 && value.primary.toSet() == setOf("library", "ask", "sources", "activity")) { "Native layout must preserve all four primary destinations exactly once" }
        require(value.initial in value.primary && value.navigation in setOf("adaptive", "bottom") && value.detail in setOf("split", "stack")) { "Unsupported native layout capability" }
        layouts[value.identity] = value
    }
    @Synchronized fun bind(value: NativeUiBinding, fallbackReason: String? = null) {
        require(value.theme in themes && value.layout in layouts) { "Native UI binding requires exact installed providers" }
        if (binding != value) {
            binding = value; removalReason = fallbackReason; revision++
            val failures = mutableListOf<NativeUiNotificationError>()
            observers.forEachIndexed { index, observer -> try { observer(revision) } catch (_: Throwable) { failures.add(NativeUiNotificationError(index)) } }
            notificationErrors = java.util.Collections.unmodifiableList(failures.toList())
        }
    }
    @Synchronized fun setBuiltin(value: NativeUiBinding) {
        require(builtin == null) { "Native builtin binding is immutable" }
        bind(value); builtin = value
    }
    @Synchronized fun removeTheme(identity: NativeUiIdentity) {
        require(identity != builtin?.theme) { "Cannot remove the native builtin theme" }
        if (activeBinding().theme == identity) bind(activeBinding().copy(theme = requireNotNull(builtin).theme), "theme_removed")
        themes.remove(identity)
    }
    @Synchronized fun removeLayout(identity: NativeUiIdentity) {
        require(identity != builtin?.layout) { "Cannot remove the native builtin layout" }
        if (activeBinding().layout == identity) bind(activeBinding().copy(layout = requireNotNull(builtin).layout), "layout_removed")
        layouts.remove(identity)
    }
    fun observe(observer: (Long) -> Unit): () -> Unit { observers.add(observer); return { observers.remove(observer) } }
    @Synchronized fun fallbackReason(): String? = removalReason
    @Synchronized fun getNotificationErrors(): List<NativeUiNotificationError> = notificationErrors
    @Synchronized fun activeBinding(): NativeUiBinding = requireNotNull(binding) { "Native UI has no active binding" }
    @Synchronized fun colorScheme(value: String) {
        require(value in setOf("light", "dark"))
        if (colorScheme == value) return
        colorScheme = value; revision++
        val failures = mutableListOf<NativeUiNotificationError>()
        observers.forEachIndexed { index, observer -> try { observer(revision) } catch (_: Throwable) { failures.add(NativeUiNotificationError(index)) } }
        notificationErrors = java.util.Collections.unmodifiableList(failures)
    }
    @Synchronized fun theme(): NativeThemeSnapshot {
        val snapshot = themes.getValue(activeBinding().theme)
        return snapshot.schemes[colorScheme]?.let { snapshot.copy(tokens = it) } ?: snapshot
    }
    @Synchronized fun layout(): NativeLayoutSnapshot = layouts.getValue(activeBinding().layout)
}

internal object NativeUiPacks {
    val registry = NativeUiPackRegistry()
    fun initialize(context: Context) {
        val manifest = JSONObject(context.assets.open("ui-presentation.json").bufferedReader().use { it.readText() })
        require(manifest.getInt("schemaVersion") == 1) { "Unsupported native UI presentation schema" }
        val theme = manifest.getJSONObject("theme")
        val layout = manifest.getJSONObject("layout")
        fun identity(value: JSONObject) = NativeUiIdentity(value.getString("id"), value.getString("version"))
        val tokenJson = theme.getJSONObject("tokens")
        val tokens = tokenJson.keys().asSequence().associateWith { tokenJson.getString(it) }
        val schemes = theme.optJSONObject("schemes")
        val variants = schemes?.keys()?.asSequence()?.associateWith { scheme ->
            val values = schemes.getJSONObject(scheme)
            values.keys().asSequence().associateWith { values.getString(it) }
        } ?: emptyMap()
        val snapshot = NativeThemeSnapshot(identity(theme), tokens, variants)
        // Validate every core role before the first native window is created.
        listOf("background", "surface", "ink", "muted", "accent", "primary-background", "primary-ink", "surface-raised", "success-tint", "warning-tint", "danger-tint").forEach { Color.parseColor(snapshot.value(it)) }
        listOf("font-body", "space-page", "control-height-mobile", "radius-control").forEach { require(snapshot.number(it) > 0) }
        registry.register(object : NativeThemeProvider { override val snapshot = snapshot })
        val primary = layout.getJSONArray("primary")
        val layoutSnapshot = NativeLayoutSnapshot(identity(layout), (0 until primary.length()).map(primary::getString), layout.getString("initial"), layout.getString("navigation"), layout.getString("detail"))
        registry.register(object : NativeLayoutProvider { override val snapshot = layoutSnapshot })
        registry.setBuiltin(NativeUiBinding(snapshot.identity, layoutSnapshot.identity))
    }
}

/** All native renderers read the active provider, including native dialogs and platform chrome. */
internal object MoteTheme {
    private fun color(key: String) = Color.parseColor(NativeUiPacks.registry.theme().value(key))
    private fun dimension(key: String) = NativeUiPacks.registry.theme().dimension(key)
    val background get() = color("background")
    val surface get() = color("surface")
    val sidebar get() = color("sidebar")
    val ink get() = color("ink")
    val muted get() = color("muted")
    val accent get() = color("accent")
    val accentHover get() = color("accent-hover")
    val tint get() = color("tint")
    val border get() = color("border")
    val controlBorder get() = color("control-border")
    val divider get() = color("divider")
    val success get() = color("success")
    val warning get() = color("warning")
    val danger get() = color("danger")
    val successTint get() = color("success-tint")
    val warningTint get() = color("warning-tint")
    val dangerTint get() = color("danger-tint")
    val primaryBackground get() = color("primary-background")
    val primaryInk get() = color("primary-ink")
    val surfaceRaised get() = color("surface-raised")
    val radius get() = dimension("radius")
    val radiusContainer get() = dimension("radius-container")
    val radiusControl get() = dimension("radius-control")
    val radiusReading get() = dimension("radius-reading")
    val radiusIndicator get() = dimension("radius-indicator")
    val fontTitle get() = dimension("font-title")
    val fontTitleMobile get() = dimension("font-title-mobile")
    val fontAppbar get() = dimension("font-appbar")
    val fontSection get() = dimension("font-section")
    val fontRow get() = dimension("font-row")
    val fontBody get() = dimension("font-body")
    val fontSupport get() = dimension("font-support")
    val fontMeta get() = dimension("font-meta")
    val fontAction get() = dimension("font-action")
    val spacePage get() = dimension("space-page")
    val spacePanel get() = dimension("space-panel")
    val spaceGroup get() = dimension("space-group")
    val spaceItem get() = dimension("space-item")
    val spaceInline get() = dimension("space-inline")
    val controlHeight get() = dimension("control-height-mobile")
    val borderWidth get() = dimension("border-width")
    val panelBorderWidth get() = dimension("panel-border-width")
    val bodyWeight get() = dimension("weight-body")
    val titleWeight get() = dimension("weight-title")
    val sectionWeight get() = dimension("weight-section")
    val lineBody get() = NativeUiPacks.registry.theme().number("line-body").toFloat()
    val letterTitle get() = NativeUiPacks.registry.theme().number("letter-title").toFloat()
    fun fontFamily(heading: Boolean): String = when (NativeUiPacks.registry.theme().value(if (heading) "font-heading" else "font")) {
        "serif" -> "serif"
        "monospace" -> "monospace"
        else -> "sans-serif" // Platform system font mapping for the shared browser font stack.
    }
}
