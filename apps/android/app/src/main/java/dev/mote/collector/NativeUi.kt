package dev.mote.collector

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*

/** Shared, native presentation for the collector and its detail screens. */
object MoteUi {
    val background = DesignTokens.background
    val ink = DesignTokens.ink
    val muted = DesignTokens.muted
    val accent = DesignTokens.accent
    val tint = DesignTokens.tint
    val border = DesignTokens.border
    val controlBorder = DesignTokens.controlBorder
    val divider = DesignTokens.divider

    const val containerRadius = DesignTokens.radiusContainer
    const val readingRadius = DesignTokens.radiusReading
    const val actionRadius = DesignTokens.radiusControl

    /** Role sizes scale with the system font; callers choose meaning, never fit-to-space. */
    fun type(view: TextView, size: Int = DesignTokens.fontBody, medium: Boolean = false) = view.apply {
        textSize = size.toFloat()
        typeface = Typeface.create(if (medium) "sans-serif-medium" else "sans-serif", Typeface.NORMAL)
        setLineSpacing(0f, 1.25f)
        setTag(R.id.mote_type, size)
    }

    fun shape(context: Context, fill: Int = DesignTokens.surface, radius: Int = containerRadius, outline: Boolean = true, strokeColor: Int = border) = GradientDrawable().apply {
        setColor(fill); cornerRadius = context.moteDp(radius).toFloat()
        if (outline) setStroke(context.moteDp(DesignTokens.borderWidth), strokeColor)
    }

    fun clickable(context: Context, fill: Int = DesignTokens.surface, radius: Int = containerRadius, outline: Boolean = true, strokeColor: Int = border) = RippleDrawable(
        ColorStateList.valueOf(Color.argb(24, Color.red(accent), Color.green(accent), Color.blue(accent))), shape(context, fill, radius, outline, strokeColor), shape(context, Color.WHITE, radius, false)
    )

    enum class ButtonRole { PRIMARY, SECONDARY, TEXT }

    fun button(button: Button, primary: Boolean = false, radius: Int = actionRadius) = action(button, if (primary) ButtonRole.PRIMARY else ButtonRole.SECONDARY, radius)

    fun action(button: Button, role: ButtonRole = ButtonRole.SECONDARY, radius: Int = actionRadius) = button.apply {
        val primary = role == ButtonRole.PRIMARY
        isAllCaps = false; type(this, DesignTokens.fontAction, medium = true); minHeight = context.moteDp(DesignTokens.controlHeight)
        setTextColor(ColorStateList(arrayOf(intArrayOf(-android.R.attr.state_enabled), intArrayOf()), intArrayOf(muted, if (primary) Color.WHITE else accent)))
        setTag(R.id.mote_primary, primary)
        setTag(R.id.mote_button_role, role)
        backgroundTintList = null; background = android.graphics.drawable.StateListDrawable().apply {
            addState(intArrayOf(-android.R.attr.state_enabled), shape(context, if (role == ButtonRole.TEXT) Color.TRANSPARENT else MoteUi.background, radius, role != ButtonRole.TEXT, controlBorder))
            addState(intArrayOf(), clickable(context, when (role) { ButtonRole.PRIMARY -> accent; ButtonRole.SECONDARY -> DesignTokens.surface; ButtonRole.TEXT -> Color.TRANSPARENT }, radius, role == ButtonRole.SECONDARY, controlBorder))
        }
        setPadding(context.moteDp(DesignTokens.spacePanel), context.moteDp(DesignTokens.spaceInline), context.moteDp(DesignTokens.spacePanel), context.moteDp(DesignTokens.spaceInline))
    }

    fun field(field: EditText) = field.apply {
        setTextColor(ink); setHintTextColor(muted); type(this, DesignTokens.fontBody)
        backgroundTintList = null
        background = shape(context, DesignTokens.surface, DesignTokens.radiusControl, true, controlBorder)
        setPadding(context.moteDp(DesignTokens.spacePanel), context.moteDp(DesignTokens.spaceItem), context.moteDp(DesignTokens.spacePanel), context.moteDp(DesignTokens.spaceItem))
        minHeight = context.moteDp(DesignTokens.controlHeight)
    }

    fun select(spinner: Spinner) = spinner.apply {
        backgroundTintList = null
        background = android.graphics.drawable.LayerDrawable(arrayOf(
            shape(context, DesignTokens.surface, actionRadius, true, controlBorder),
            MoteNavigationIcon(context, "dropdown", false)
        )).apply {
            setLayerSize(1, context.moteDp(20), context.moteDp(20))
            setLayerGravity(1, Gravity.END or Gravity.CENTER_VERTICAL)
            setLayerInset(1, 0, 0, context.moteDp(DesignTokens.spaceInline), 0)
        }
        setPadding(context.moteDp(DesignTokens.spaceInline), 0, context.moteDp(36), 0)
        minimumHeight = context.moteDp(DesignTokens.controlHeight)
    }

    fun styleSelects(view: View) {
        if (view is Spinner) select(view)
        else if (view is ViewGroup) for (index in 0 until view.childCount) styleSelects(view.getChildAt(index))
    }

    /** A selected scope or retention choice must remain fully readable, including at 130%. */
    fun choiceAdapter(context: Context, labels: List<String>) = object : ArrayAdapter<String>(context, android.R.layout.simple_spinner_dropdown_item, labels) {
        private fun present(view: View): View = view.apply {
            (this as? TextView)?.let {
                type(it, DesignTokens.fontBody); it.setTextColor(ink)
                it.isSingleLine = false; it.maxLines = Int.MAX_VALUE; it.ellipsize = null
                it.gravity = Gravity.CENTER_VERTICAL; it.minHeight = context.moteDp(DesignTokens.controlHeight)
                it.setPadding(context.moteDp(DesignTokens.spaceInline), context.moteDp(DesignTokens.spaceInline), context.moteDp(DesignTokens.spaceInline), context.moteDp(DesignTokens.spaceInline))
            }
        }
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View = present(super.getView(position, convertView, parent))
        override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View = present(super.getDropDownView(position, convertView, parent))
    }

    /** Set line behavior before inputType: setSingleLine replaces password transformation. */
    fun textInput(field: EditText, type: Int, multiline: Boolean = false) = field.apply {
        setSingleLine(!multiline)
        if (multiline) { minLines = 2; gravity = Gravity.TOP }
        inputType = if (multiline) android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE else type
        // Password input applies a platform monospace face; retain masking and the shared type face.
        typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    }

    /** Apply the same controls to dynamic native lists and dialog forms. */
    fun styleTree(view: View) {
        when (view) {
            is Spinner -> select(view)
            is Button -> if (view !is CompoundButton) {
                action(view, view.getTag(R.id.mote_button_role) as? ButtonRole ?: if (view.getTag(R.id.mote_primary) == true) ButtonRole.PRIMARY else ButtonRole.SECONDARY)
                (view.layoutParams as? LinearLayout.LayoutParams)?.let { it.bottomMargin = view.context.moteDp(8) }
                // The native dialog bar bottom-aligns actions. Baseline alignment also
                // subtracts the custom bottom margin, moving their top into its padding.
                if (view.id in setOf(android.R.id.button1, android.R.id.button2, android.R.id.button3))
                    (view.parent as? LinearLayout)?.isBaselineAligned = false
            }
            is EditText -> field(view)
            is TextView -> if (view.getTag(R.id.mote_type) == null) {
                val dialogTitle = view.resources.getIdentifier("alertTitle", "id", "android")
                type(view, if (view.id == dialogTitle) DesignTokens.fontTitleMobile else DesignTokens.fontBody, view.id == dialogTitle)
                view.setTextColor(ink)
            }
        }
        if (view is CompoundButton) { view.setTextColor(ink); type(view, DesignTokens.fontBody); view.buttonTintList = ColorStateList.valueOf(accent); view.minHeight = view.context.moteDp(DesignTokens.controlHeight) }
        if (view is ViewGroup) for (index in 0 until view.childCount) styleTree(view.getChildAt(index))
    }
}

fun Context.moteDp(value: Int) = (value * resources.displayMetrics.density).toInt()

/** Small stroke icons keep the navigation legible across system font and emoji versions. */
class MoteNavigationIcon(context: Context, private val kind: String, active: Boolean) : Drawable() {
    private val size = context.moteDp(23)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = if (active) MoteUi.accent else MoteUi.muted
        style = Paint.Style.STROKE; strokeWidth = 1.65f; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    override fun getIntrinsicWidth() = size
    override fun getIntrinsicHeight() = size
    override fun draw(canvas: Canvas) {
        canvas.save(); canvas.translate(bounds.left.toFloat(), bounds.top.toFloat()); canvas.scale(bounds.width() / 24f, bounds.height() / 24f)
        fun line(x: Float, y: Float, xx: Float, yy: Float) = canvas.drawLine(x, y, xx, yy, paint)
        fun path(vararg points: Float) {
            val p = Path(); p.moveTo(points[0], points[1]); var i = 2
            while (i < points.size) { p.lineTo(points[i], points[i + 1]); i += 2 }; canvas.drawPath(p, paint)
        }
        when (kind) {
            "dropdown" -> path(6f, 9f, 12f, 15f, 18f, 9f)
            "overview" -> { path(3f, 11f, 12f, 3f, 21f, 11f); path(5f, 10f, 5f, 21f, 19f, 21f, 19f, 10f); path(10f, 21f, 10f, 14f, 14f, 14f, 14f, 21f) }
            "notes", "note" -> { canvas.drawRoundRect(4f, 3f, 20f, 21f, 3f, 3f, paint); line(8f, 8f, 16f, 8f); line(8f, 12f, 16f, 12f); line(8f, 16f, 13f, 16f) }
            "import" -> { path(13f, 3f, 5f, 3f, 5f, 21f, 19f, 21f, 19f, 9f, 13f, 3f, 13f, 9f, 19f, 9f); line(8f, 14f, 16f, 14f); path(13f, 11f, 16f, 14f, 13f, 17f) }
            "library", "sources", "folder" -> { path(3f, 7f, 3f, 20f, 21f, 20f, 21f, 7f, 3f, 7f, 3f, 4f, 10f, 4f, 13f, 7f) }
            "ask" -> { canvas.drawRoundRect(3f, 3f, 21f, 18f, 4f, 4f, paint); path(7f, 18f, 7f, 22f, 12f, 18f); line(7f, 8f, 17f, 8f); line(7f, 12f, 14f, 12f) }
            "capture" -> { canvas.drawRoundRect(4f, 3f, 20f, 21f, 3f, 3f, paint); canvas.drawCircle(12f, 12f, 4f, paint); line(10f, 18f, 14f, 18f) }
            "chart" -> { path(4f, 4f, 4f, 20f, 21f, 20f); path(8f, 15f, 12f, 10f, 16f, 13f, 21f, 5f) }
            "shield" -> { path(12f, 2f, 21f, 6f, 20f, 15f, 17f, 19f, 12f, 22f, 7f, 19f, 4f, 15f, 3f, 6f, 12f, 2f); path(8f, 12f, 11f, 15f, 16f, 9f) }
            "language" -> {
                canvas.drawCircle(12f, 12f, 9f, paint); canvas.drawOval(8f, 3f, 16f, 21f, paint)
                line(4f, 9f, 20f, 9f); line(4f, 15f, 20f, 15f)
            }
            "plugin" -> {
                val p = Path().apply {
                    moveTo(4f, 4f); lineTo(10f, 4f); cubicTo(10f, 1f, 15f, 1f, 15f, 4f)
                    lineTo(20f, 4f); lineTo(20f, 10f); cubicTo(23f, 10f, 23f, 15f, 20f, 15f)
                    lineTo(20f, 20f); lineTo(14f, 20f); cubicTo(14f, 17f, 9f, 17f, 9f, 20f)
                    lineTo(4f, 20f); lineTo(4f, 14f); cubicTo(7f, 14f, 7f, 9f, 4f, 9f); close()
                }; canvas.drawPath(p, paint)
            }
            "code" -> { path(7f, 6f, 2f, 12f, 7f, 18f); path(17f, 6f, 22f, 12f, 17f, 18f); line(14f, 4f, 10f, 20f) }
            "sync" -> { canvas.drawArc(4f, 4f, 20f, 20f, 210f, 145f, false, paint); path(16f, 4f, 20f, 8f, 21f, 3f); canvas.drawArc(4f, 4f, 20f, 20f, 30f, 145f, false, paint); path(3f, 21f, 4f, 16f, 8f, 20f) }
            "info" -> { canvas.drawCircle(12f, 12f, 9f, paint); line(12f, 11f, 12f, 17f); canvas.drawPoint(12f, 7f, paint) }
            else -> { line(4f, 6f, 20f, 6f); line(4f, 12f, 20f, 12f); line(4f, 18f, 20f, 18f); line(9f, 3f, 9f, 9f); line(16f, 9f, 16f, 15f); line(10f, 15f, 10f, 21f) }
        }
        canvas.restore()
    }
    override fun setAlpha(alpha: Int) { paint.alpha = alpha }
    override fun setColorFilter(colorFilter: ColorFilter?) { paint.colorFilter = colorFilter }
    @Deprecated("Drawable opacity") override fun getOpacity() = PixelFormat.TRANSLUCENT
}

/** One primary navigation, including while login or a detail screen is visible. */
class MotePrimaryNavigation(private val activity: Activity, onSelect: (MotePrimaryTab) -> Unit) : LinearLayout(activity) {
    private val items = linkedMapOf<MotePrimaryTab, TextView>()
    init {
        orientation = HORIZONTAL; setPadding(activity.moteDp(10), activity.moteDp(7), activity.moteDp(10), activity.moteDp(9))
        setBackgroundColor(Color.WHITE)
        contentDescription = MoteI18n.text("主导航")
        MotePrimaryTab.entries.forEach { tab ->
            val item = TextView(activity).apply {
                text = MoteI18n.text(tab.titleKey); MoteUi.type(this, DesignTokens.fontMeta); gravity = Gravity.CENTER; minHeight = activity.moteDp(58)
                compoundDrawablePadding = activity.moteDp(5); isFocusable = true; tag = "primary:${tab.name}"
                contentDescription = MoteI18n.text(tab.titleKey); setOnClickListener { onSelect(tab) }
            }
            items[tab] = item
            addView(item, LayoutParams(0, -2, 1f).apply { marginStart = activity.moteDp(2); marginEnd = activity.moteDp(2) })
        }
    }
    fun select(tab: MotePrimaryTab) {
        items.forEach { (destination, view) ->
            val active = destination == tab
            view.isSelected = active; view.setTextColor(if (active) MoteUi.accent else MoteUi.muted)
            view.background = MoteUi.clickable(activity, DesignTokens.surface, outline = false)
            view.setCompoundDrawablesWithIntrinsicBounds(null, MoteNavigationIndicator(activity, destination.icon, active), null, null)
        }
    }
}

/** The selected destination is indicated at its icon; the entire item remains one touch target. */
private class MoteNavigationIndicator(context: Context, kind: String, private val active: Boolean) : Drawable() {
    private val width = context.moteDp(64)
    private val height = context.moteDp(32)
    private val glyphSize = context.moteDp(23)
    private val glyph = MoteNavigationIcon(context, kind, active)
    private val indicator = MoteUi.shape(context, MoteUi.tint, DesignTokens.radiusIndicator, false)
    override fun getIntrinsicWidth() = width
    override fun getIntrinsicHeight() = height
    override fun draw(canvas: Canvas) {
        if (active) { indicator.bounds = bounds; indicator.draw(canvas) }
        val left = bounds.centerX() - glyphSize / 2
        val top = bounds.centerY() - glyphSize / 2
        glyph.setBounds(left, top, left + glyphSize, top + glyphSize); glyph.draw(canvas)
    }
    override fun setAlpha(alpha: Int) { indicator.alpha = alpha; glyph.alpha = alpha }
    override fun setColorFilter(colorFilter: ColorFilter?) { glyph.colorFilter = colorFilter }
    @Deprecated("Drawable opacity") override fun getOpacity() = PixelFormat.TRANSLUCENT
}

fun Activity.openMoteLocalPage(page: String) {
    startActivity(Intent(this, MainActivity::class.java).putExtra("page", page)
        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
}

fun Activity.openMotePrimary(tab: MotePrimaryTab) {
    openMoteLocalPage(tab.localPage)
}

private fun Activity.detailTab(): MotePrimaryTab? = when (this) {
    is MainActivity, is CentralActivity -> null
    is CaptureRecordsActivity, is FileContentActivity -> MotePrimaryTab.LIBRARY
    is CalendarActionsActivity -> MotePrimaryTab.TODAY
    else -> MotePrimaryTab.TODAY
}

fun Activity.moteDetailPage(primary: MotePrimaryTab? = detailTab(), title: String? = null, onBack: () -> Unit = { finish() }): LinearLayout {
    val body = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(moteDp(DesignTokens.spacePage), moteDp(DesignTokens.spaceItem), moteDp(DesignTokens.spacePage), moteDp(DesignTokens.spaceGroup))
    }
    val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(MoteUi.background); moteInsets() }
    val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
    header.addView(TextView(this).apply {
        text = if (title == null) "‹  " + MoteI18n.text("返回上级") else "‹"
        MoteUi.type(this, DesignTokens.fontAction); setTextColor(MoteUi.accent)
        gravity = Gravity.CENTER_VERTICAL; minHeight = moteDp(48)
        setPadding(moteDp(16), moteDp(4), moteDp(16), moteDp(4))
        contentDescription = MoteI18n.text("返回上一页"); isFocusable = true; setOnClickListener { onBack() }
    }, if (title == null) LinearLayout.LayoutParams(0, -2, 1f) else LinearLayout.LayoutParams(moteDp(48), -2))
    if (title != null) header.addView(TextView(this).apply {
        text = title; tag = "detail-title"; MoteUi.type(this, DesignTokens.fontAppbar, medium = true); setTextColor(MoteUi.ink)
        setPadding(0, moteDp(DesignTokens.spaceInline), moteDp(DesignTokens.spaceInline), moteDp(DesignTokens.spaceInline))
    }, LinearLayout.LayoutParams(0, -2, 1f))
    if (primary != null) header.addView(MoteUi.button(Button(this).apply {
        text = MoteI18n.text("添加"); contentDescription = MoteI18n.text("添加内容")
        setOnClickListener { showMoteAddActions() }
    }), LinearLayout.LayoutParams(-2, -2).apply { marginEnd = moteDp(14) })
    root.addView(header)
    root.addView(ScrollView(this).apply { isFillViewport = true; addView(body) }, LinearLayout.LayoutParams(-1, 0, 1f))
    if (primary != null) root.addView(MotePrimaryNavigation(this) { openMotePrimary(it) }.apply { select(primary) })
    setContentView(root)
    return body
}

/** Dynamic dialogs use the same fields/buttons and outside-field keyboard dismissal. */
class MoteDialogBuilder(context: Context) : android.app.AlertDialog.Builder(context) {
    override fun create(): android.app.AlertDialog = super.create().also { dialog ->
        val window = dialog.window ?: return@also
        window.decorView.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
        override fun onViewDetachedFromWindow(view: View) = Unit
        override fun onViewAttachedToWindow(view: View) {
        window.setBackgroundDrawable(MoteUi.shape(context, Color.WHITE, MoteUi.readingRadius))
        MoteUi.styleTree(window.decorView)
        val original = window.callback
        window.callback = object : android.view.Window.Callback by original {
            override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
                if (event.action == android.view.MotionEvent.ACTION_DOWN) {
                    val field = window.currentFocus as? EditText
                    if (field != null) {
                        val bounds = android.graphics.Rect(); field.getGlobalVisibleRect(bounds)
                        if (!bounds.contains(event.rawX.toInt(), event.rawY.toInt())) {
                            field.clearFocus()
                            context.getSystemService(android.view.inputmethod.InputMethodManager::class.java).hideSoftInputFromWindow(field.windowToken, 0)
                        }
                    }
                }
                return original.dispatchTouchEvent(event)
            }
        }
        }
        })
    }
}

/** Every Add entry uses this same action set and real native flows. */
enum class MoteAddAction(val titleKey: String, val subtitleKey: String, val icon: String) {
    FOLDER("同步文件夹", "持续收集文件夹里的新内容与修改", "folder"),
    FILE("导入文件", "导入一次，不跟踪后续修改。", "import"),
    SCREEN("记录屏幕", "先选择应用范围，再按需授权", "capture"),
    NOTE("随手记", "离线也能留下想法与片段", "notes")
}
fun Activity.openMoteAdd(action: MoteAddAction) {
    if (this is MainActivity) { addContent(action); return }
    when (action) {
        MoteAddAction.FOLDER, MoteAddAction.FILE -> startActivity(Intent(this, FileTaskActivity::class.java).putExtra("addAction", action.name))
        MoteAddAction.SCREEN -> openMoteLocalPage("PRIVACY")
        MoteAddAction.NOTE -> openMoteLocalPage("NOTES")
    }
}
fun Activity.showMoteAddActions() {
    MoteDialogBuilder(this).setTitle(MoteI18n.text("添加内容"))
        .setItems(MoteAddAction.entries.map { MoteI18n.text(it.titleKey) }.toTypedArray()) { _, index -> openMoteAdd(MoteAddAction.entries[index]) }
        .setNegativeButton(MoteI18n.text("取消"), null).show()
}
