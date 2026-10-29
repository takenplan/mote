package dev.mote.collector

import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Presentation only: secondary screens keep their existing stores, task owners and callbacks. */
internal object SecondaryUi {
    fun column(parent: LinearLayout, card: Boolean = false): LinearLayout = LinearLayout(parent.context).apply {
        orientation = LinearLayout.VERTICAL
        if (card) {
            background = MoteUi.shape(context)
            val inset = context.moteDp(MoteTheme.spacePanel)
            setPadding(inset, inset, inset, inset)
        }
        parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = context.moteDp(MoteTheme.spaceItem) })
    }

    fun text(parent: LinearLayout, value: String, heading: Boolean = false, muted: Boolean = false): TextView = TextView(parent.context).apply {
        text = value
        MoteUi.type(this, if (heading) NativeFontRole.SECTION else if (muted) NativeFontRole.SUPPORT else NativeFontRole.BODY, medium = heading)
        MoteUi.textColor(this, if (muted) NativeColorRole.MUTED else NativeColorRole.INK)
        parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = context.moteDp(MoteTheme.spaceInline) })
    }

    fun action(parent: LinearLayout, label: String, primary: Boolean = false, action: () -> Unit): Button = MoteUi.button(Button(parent.context).apply {
        text = label; setOnClickListener { action() }
    }, primary).also { parent.addView(it, LinearLayout.LayoutParams(-1, -2).apply { topMargin = parent.context.moteDp(MoteTheme.spaceInline) }) }

    fun row(parent: LinearLayout, label: String, detail: String = "", action: () -> Unit): LinearLayout = LinearLayout(parent.context).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
        val inset = context.moteDp(MoteTheme.spacePanel)
        setPadding(inset, inset, inset, inset); minimumHeight = context.moteDp(64)
        background = MoteUi.clickable(context); isFocusable = true; isClickable = true
        val words = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        addView(words, LinearLayout.LayoutParams(0, -2, 1f))
        text(words, label, heading = true)
        if (detail.isNotBlank()) text(words, detail, muted = true)
        addView(TextView(context).apply {
            text = "›"; MoteUi.type(this, NativeFontRole.SECTION); MoteUi.textColor(this, NativeColorRole.MUTED)
            setPadding(context.moteDp(MoteTheme.spaceInline), 0, 0, 0); importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        })
        setOnClickListener { action() }
        parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = context.moteDp(MoteTheme.spaceInline) })
    }

    fun disclosure(parent: LinearLayout, label: String, key: String, expanded: Boolean = false): LinearLayout {
        val content = LinearLayout(parent.context).apply { orientation = LinearLayout.VERTICAL; visibility = if (expanded) View.VISIBLE else View.GONE; tag = "$key:content" }
        val toggle = MoteUi.action(Button(parent.context).apply {
            text = label; tag = key; gravity = Gravity.START or Gravity.CENTER_VERTICAL
            isSelected = expanded; accessibilityState(expanded)
            setOnClickListener {
                val show = content.visibility != View.VISIBLE
                content.visibility = if (show) View.VISIBLE else View.GONE
                isSelected = show; accessibilityState(show)
            }
        }, MoteUi.ButtonRole.TEXT)
        parent.addView(toggle, LinearLayout.LayoutParams(-1, -2))
        parent.addView(content, LinearLayout.LayoutParams(-1, -2))
        return content
    }

    private fun View.accessibilityState(expanded: Boolean) {
        if (android.os.Build.VERSION.SDK_INT >= 30) stateDescription = MoteI18n.text(if (expanded) "已展开" else "已收起")
    }

    fun fact(parent: LinearLayout, label: String, value: String) {
        val row = LinearLayout(parent.context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.TOP }
        row.addView(TextView(parent.context).apply { text = label; MoteUi.type(this, NativeFontRole.BODY); MoteUi.textColor(this, NativeColorRole.MUTED) }, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(TextView(parent.context).apply { text = value; MoteUi.type(this, NativeFontRole.BODY); MoteUi.textColor(this, NativeColorRole.INK); gravity = Gravity.END }, LinearLayout.LayoutParams(0, -2, 1f))
        parent.addView(row, LinearLayout.LayoutParams(-1, -2).apply { topMargin = parent.context.moteDp(MoteTheme.spaceInline); bottomMargin = parent.context.moteDp(MoteTheme.spaceInline) })
    }
}
