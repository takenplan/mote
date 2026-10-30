package dev.mote.collector

import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

/** A read of existing conversation summaries; it never submits a question or starts capture. */
internal class HomeConversationView(private val activity: MoteActivity, private val archiveEmpty: (Boolean) -> Unit = {}, private val open: (String) -> Unit) : LinearLayout(activity) {
    private val task = UiTask(activity)
    private var generation = -1L
    private var origin = ""
    private var nextRead = 0L
    private var epoch = 0L
    private var closed = false
    private var active = false
    private var rendered = ""

    init { orientation = VERTICAL; tag = "home-recent-conversations" }

    fun pause() { active = false; epoch++; nextRead = 0L }
    fun close() { closed = true; pause(); task.close() }

    fun refresh() {
        if (closed) return
        active = true
        val access = runCatching { CentralAccess.resolve(activity) }.getOrElse {
            clear(); label(MoteI18n.text("对话暂不可读取，请稍后重试。")); return
        }
        if (access.generation != generation || access.server != origin) {
            epoch++; clear(); archiveEmpty(false); nextRead = 0L; generation = access.generation; origin = access.server
        }
        if (access.client == null) {
            message(if (access.server.isBlank()) MoteI18n.text("连接中央后查看对话。") else MoteI18n.text("登录中央后查看对话。"))
            return
        }
        if (task.busy || SystemClock.elapsedRealtime() < nextRead) return
        val stamp = epoch
        nextRead = SystemClock.elapsedRealtime() + 5000
        if (childCount == 0) label(MoteI18n.text("正在读取对话…"))
        task.start("", {}, {
            val page = access.client.get("/api/conversations?limit=5")
            val after = CentralAccess.resolve(activity)
            check(after.generation == access.generation && after.server == access.server && after.client != null)
            val rows = page.getJSONArray("items")
            for (index in 0 until rows.length()) {
                val item = rows.getJSONObject(index)
                val id = item.getString("id")
                require(java.util.UUID.fromString(id).toString() == id)
                require(item.get("title") is String && item.get("updatedAt") is String)
                java.time.Instant.parse(item.getString("updatedAt"))
                require(item.get("turnCount") is Number && item.getInt("turnCount") >= 0)
            }
            val emptyArchive = rows.length() == 0 && runCatching {
                val storage = access.client.get("/api/status").getJSONObject("storage")
                storage.has("captures") && storage.get("captures") is Number && storage.getLong("captures") == 0L &&
                    access.client.get("/api/library/catalog?limit=1").getJSONArray("items").length() == 0 &&
                    access.client.get("/api/files?limit=1").getJSONArray("items").length() == 0
            }.getOrDefault(false)
            rows to emptyArchive
        }) { outcome ->
            if (closed || !active || stamp != epoch || activity.isDestroyed || activity.isFinishing) return@start
            val current = runCatching { CentralAccess.resolve(activity) }.getOrNull()
            if (current == null || current.generation != generation || current.server != origin || current.client == null) { clear(); nextRead = 0L; return@start }
            outcome.onSuccess { (rows, emptyArchive) ->
                archiveEmpty(emptyArchive)
                if (rendered == rows.toString()) return@onSuccess
                clear(); rendered = rows.toString()
                if (rows.length() == 0) label(MoteI18n.text("还没有对话。"))
                for (index in 0 until rows.length()) {
                    val item = rows.getJSONObject(index)
                    val id = item.optString("id")
                    val title = item.optString("title").ifBlank { MoteI18n.text("问一问") }
                    val date = runCatching {
                        java.time.Instant.parse(item.optString("updatedAt")).atZone(java.time.ZoneId.systemDefault())
                            .format(if (MoteI18n.locale().language == "zh") java.time.format.DateTimeFormatter.ofPattern("M 月 d 日 HH:mm", MoteI18n.locale()) else java.time.format.DateTimeFormatter.ofLocalizedDateTime(java.time.format.FormatStyle.SHORT).withLocale(MoteI18n.locale()))
                    }.getOrDefault(item.optString("updatedAt"))
                    val detail = MoteI18n.text("{0} 轮对话", item.optInt("turnCount")) + " · " + date
                    val row = LinearLayout(activity).apply {
                        gravity = Gravity.CENTER_VERTICAL; tag = "home-conversation:$id"
                        minimumHeight = activity.moteDp(78); setPadding(0, activity.moteDp(18), 0, activity.moteDp(18))
                        background = MoteUi.clickable(activity, NativeColorRole.BACKGROUND, 0, false)
                        isFocusable = true; contentDescription = "$title，$detail"
                        setOnClickListener {
                            val selected = runCatching { CentralAccess.resolve(activity) }.getOrNull()
                            if (selected?.client != null && selected.generation == access.generation && selected.server == access.server) open(id)
                            else { clear(); nextRead = 0L; refresh() }
                        }
                    }
                    row.addView(TextView(activity).apply { text = "◌"; textSize = 23f; MoteUi.textColor(this, NativeColorRole.ACCENT) }, LayoutParams(activity.moteDp(24), -2).apply { marginEnd = activity.moteDp(13) })
                    val text = LinearLayout(activity).apply {
                        orientation = VERTICAL
                        addView(TextView(activity).apply { this.text = title; MoteUi.type(this, NativeFontRole.ACTION, medium = true); MoteUi.textColor(this, NativeColorRole.INK) })
                        addView(TextView(activity).apply { this.text = detail; MoteUi.type(this, NativeFontRole.META); NativePresentationStyles.bind(this, "home-date") { (it as TextView).textSize = 10f }; MoteUi.textColor(this, NativeColorRole.MUTED); setPadding(0, activity.moteDp(6), 0, 0) })
                    }
                    row.addView(text, LayoutParams(0, -2, 1f))
                    row.addView(TextView(activity).apply { this.text = "›"; textSize = 17f; MoteUi.textColor(this, NativeColorRole.MUTED) })
                    addView(row); divider()
                }
            }.onFailure {
                // A failed or revoked read is not an empty history, and must not expose old-target rows.
                archiveEmpty(false)
                message(MoteI18n.text("对话暂不可读取，请稍后重试。"))
            }
        }
    }
    private fun clear() { removeAllViews(); rendered = "" }
    private fun message(value: String) { if (rendered == value) return; clear(); rendered = value; label(value) }
    private fun label(value: String) { addView(TextView(activity).apply { text = value; MoteUi.type(this, NativeFontRole.SUPPORT); MoteUi.textColor(this, NativeColorRole.MUTED); setPadding(0, activity.moteDp(16), 0, activity.moteDp(16)) }) }
    private fun divider() { addView(View(activity).apply { MoteUi.backgroundColor(this, NativeColorRole.DIVIDER) }, LayoutParams(-1, activity.moteDp(1))) }
}
