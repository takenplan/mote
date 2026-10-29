package dev.mote.collector

import android.app.Activity
import android.view.View
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/** UI state only; every result and action comes from the existing archive operation. */
internal class BackupOperationView(private val activity: Activity, private val body: LinearLayout,
    private val landing: LinearLayout, private val onReturn: () -> Unit) {
    private val page = SecondaryUi.column(body).apply { visibility = View.GONE }
    private var progress: TextView? = null
    var showing = false; private set

    fun show(title: String, state: String, heading: String, message: String = "", loading: Boolean = false,
        content: (LinearLayout) -> Unit = {}, actions: List<Triple<String, Boolean, () -> Unit>> = emptyList()) {
        showing = true; landing.visibility = View.GONE; page.visibility = View.VISIBLE
        (activity.window.decorView.findViewWithTag<View>("detail-title") as? TextView)?.text = title
        page.removeAllViews()
        MoteUi.action(SecondaryUi.action(page, "← " + MoteI18n.text("备份与恢复")) { onReturn() }, MoteUi.ButtonRole.TEXT)
        val card = SecondaryUi.column(page, card = true)
        if (state.isNotBlank()) SecondaryUi.text(card, state, muted = true)
        SecondaryUi.text(card, heading, heading = true)
        content(card)
        if (loading) card.addView(ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply { isIndeterminate = true }, LinearLayout.LayoutParams(-1, activity.moteDp(4)).apply { topMargin = activity.moteDp(16); bottomMargin = activity.moteDp(16) })
        progress = SecondaryUi.text(card, message, muted = true).apply { visibility = if (message.isBlank()) View.GONE else View.VISIBLE; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        if (actions.isNotEmpty()) {
            val row = SecondaryUi.actions(card)
            actions.forEach { (label, primary, action) -> SecondaryUi.action(row, label, primary, action) }
        }
        MoteUi.styleTree(page)
    }

    fun updateProgress(message: String) { progress?.apply { text = message; visibility = View.VISIBLE } }
    fun landing() {
        showing = false; page.visibility = View.GONE; landing.visibility = View.VISIBLE
        (activity.window.decorView.findViewWithTag<View>("detail-title") as? TextView)?.text = MoteI18n.text("备份与恢复")
    }
}
