package dev.mote.collector

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView

/** Secondary in-page choices. Selection is presentation only; the host owns routes and data. */
internal class NativeSectionTabs(context: Context, choices: List<Pair<String, String>>, identity: String, private val changed: (String) -> Unit, private val choiceStyle:Boolean=false) : LinearLayout(context) {
    private val entries = choices.map { (id, label) -> id to object : TextView(context) {
        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            if (isSelected&&!choiceStyle) canvas.drawRect(0f, height - context.moteDp(2).toFloat(), width.toFloat(), height.toFloat(), Paint().apply { color = MoteTheme.accent })
        }
    }.apply {
        text = MoteI18n.text(label); contentDescription = text; tag = identity + ":" + id
        gravity = Gravity.CENTER; minHeight = context.moteDp(42); isFocusable = true
        setPadding(context.moteDp(if(choiceStyle)11 else 0),context.moteDp(if(choiceStyle)7 else 8),context.moteDp(if(choiceStyle)11 else 0),context.moteDp(if(choiceStyle)7 else 11))
        MoteUi.type(this,if(choiceStyle)11 else 13,medium=true)
        setOnClickListener { changed(id) }
    } }
    init {
        orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; tag = identity
        setWillNotDraw(false)
        entries.forEachIndexed { index, (_, view) -> addView(view,LayoutParams(-2,-2).apply { if(index<entries.lastIndex)marginEnd=context.moteDp(if(choiceStyle)6 else 22) }) }
    }
    override fun onDraw(canvas:Canvas){super.onDraw(canvas);if(!choiceStyle)canvas.drawRect(0f,height-context.moteDp(1).toFloat(),width.toFloat(),height.toFloat(),Paint().apply{color=MoteTheme.divider})}
    fun select(value: String) {
        entries.forEach { (id, view) ->
            view.isSelected=id==value
            MoteUi.textColor(view,if(choiceStyle&&view.isSelected)NativeColorRole.ACCENT else if(view.isSelected)NativeColorRole.INK else NativeColorRole.MUTED)
            if(choiceStyle)NativePresentationStyles.bind(view,"location-choice"){node->node.background=MoteUi.shape(context,if(node.isSelected)NativeColorRole.TINT else NativeColorRole.SURFACE,5,true,if(node.isSelected)NativeColorRole.ACCENT else NativeColorRole.BORDER)}
            view.invalidate()
        }
    }
}
