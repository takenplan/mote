package dev.mote.collector

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView

/** Secondary in-page choices. Selection is presentation only; the host owns routes and data. */
internal class NativeSectionTabs(context: Context, choices: List<Pair<String, String>>, identity: String, private val changed: (String) -> Unit) : LinearLayout(context) {
    private val entries = choices.map { (id, label) -> id to object : TextView(context) {
        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            if (isSelected) canvas.drawRect(0f, height - context.moteDp(2).toFloat(), width.toFloat(), height.toFloat(), Paint().apply { color = MoteTheme.accent })
        }
    }.apply {
        text = MoteI18n.text(label); contentDescription = text; tag = identity + ":" + id
        gravity = Gravity.CENTER; minHeight = context.moteDp(42); isFocusable = true
        setPadding(context.moteDp(8), context.moteDp(10), context.moteDp(8), context.moteDp(12))
        MoteUi.type(this, NativeFontRole.BODY, medium = true)
        setOnClickListener { changed(id) }
    } }
    init {
        orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; tag = identity
        entries.forEach { (_, view) -> addView(view, LayoutParams(0, -2, 1f)) }
    }
    fun select(value: String) {
        entries.forEach { (id, view) -> view.isSelected = id == value; MoteUi.textColor(view, if(view.isSelected)NativeColorRole.INK else NativeColorRole.MUTED); view.invalidate() }
    }
}
