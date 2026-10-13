package dev.mote.collector

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.TextView
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/** Generated evidence from this process's actual windows, never the device display. */
internal object GeneratedWindowRendering {
    private fun views(root: View): List<View> = buildList {
        add(root)
        if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
    }
    fun hasNoPendingLabels(root: View): Boolean {
        val pending = listOf("正在读取…", "正在检查…", "正在读取统计…", "正在读取同步状态…", "正在读取保存的连接与同步状态…",
            "正在读取草稿…", "正在连接本机存储，文件整理将在后台继续…", "正在读取来源…", "正在读取内容…",
            "正在读取详情…", "记录已读取，正在加载图片…", "正在读取 App 与时间…", "加载预览…").map { MoteI18n.text(it) }.toSet() +
            listOf("本机记录", "中央归档").map { MoteI18n.text("正在读取{0}…", MoteI18n.text(it)) }
        return views(root).filterIsInstance<TextView>().none { it.isShown && it.text.toString() in pending }
    }
    fun save(activity: Activity, directory: File, name: String, overlays: List<View> = emptyList()) {
        require(activity.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        require(InstrumentationRegistry.getArguments().getString("uiIterationFixture") == "true")
        require(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
        val base = activity.window.decorView
        require(base.width > 0 && base.height > 0 && base.isShown)
        check(hasNoPendingLabels(base) && overlays.all(::hasNoPendingLabels)) { "An unfinished native surface cannot be a ready scene: $name" }
        val (page, state, marker) = when (name) {
            "home" -> Triple("home", "empty", "还没有内容。选一个动作，留下第一份资料。")
            "home-sync-details" -> Triple("home", "content", "本机保存、中央接收与整理完成分别显示；接收确认不代表已经可以搜索。")
            "home-collection" -> Triple("home", "content", "采集状态")
            "home-populated" -> Triple("home", "content", "最近内容")
            "content" -> Triple("content", "empty", "这里还没有内容。点击添加，选择文件、屏幕或随手记。")
            "content-populated" -> Triple("content", "content", "本机保留")
            "note", "note-keyboard" -> Triple("note", "empty", "草稿已载入")
            "home-note-original", "note-detail-english" -> Triple("reader", "content", "原文")
            "note-return-list" -> Triple("records", "content", "按日期浏览记录，点开查看原文。")
            "note-empty-list" -> Triple("records", "empty", "当天没有随手记。选择其他日期，或添加一条随手记。")
            "settings" -> Triple("settings", "content", "连接与同步")
            "connection" -> Triple("connection", "content", "连接与同步")
            "add" -> Triple("add", "content", "添加内容")
            "sources" -> Triple("sources", "empty", "尚未连接来源。权限只在点击连接时申请。")
            "import-local-task" -> Triple("import", "restriction", "未连接中央：先保存本机任务，连接时确认发送范围。")
            "ask" -> Triple("ask", "restriction", "中央问答暂不可用。连接中央后，可以根据已整理的内容提问；文件和随手记仍可在本机保存。")
            "screen-scope" -> Triple("screen-scope", "content", "保存范围并开始记录")
            "feature-guide", "feature-guide-english" -> Triple("guide", "restriction", "此客户端支持的中央功能")
            "feature-guide-content" -> Triple("guide", "restriction", "记忆")
            else -> error("A new generated scene needs an explicit readiness contract: $name")
        }
        val shownText = (listOf(base) + overlays).flatMap(::views).filterIsInstance<TextView>().filter { it.isShown }.map { it.text.toString() }
        val actualMarker = MoteI18n.text(marker)
        check(actualMarker in shownText) { "The ready scene has not reached its actual target marker: $name / $actualMarker" }
        val origin = IntArray(2); base.getLocationOnScreen(origin)
        fun bounds(view: View): JSONObject {
            val location = IntArray(2); view.getLocationOnScreen(location)
            return JSONObject().put("left", location[0]).put("top", location[1])
                .put("width", view.width).put("height", view.height)
        }
        val bitmap = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888)
        try {
            val canvas = Canvas(bitmap)
            base.draw(canvas)
            val windows = JSONArray()
            for (overlay in overlays) {
                require(overlay !== base && overlay.isShown && overlay.width > 0 && overlay.height > 0)
                val attributes = requireNotNull(overlay.layoutParams as? WindowManager.LayoutParams)
                val rectangle = bounds(overlay)
                val dim = if (attributes.flags and WindowManager.LayoutParams.FLAG_DIM_BEHIND != 0) attributes.dimAmount else 0f
                if (dim > 0f) canvas.drawColor(Color.argb((dim.coerceIn(0f, 1f) * 255).toInt(), 0, 0, 0))
                canvas.save()
                canvas.translate((rectangle.getInt("left") - origin[0]).toFloat(), (rectangle.getInt("top") - origin[1]).toFloat())
                overlay.draw(canvas)
                canvas.restore()
                windows.put(rectangle.put("dimAmount", dim).put("flags", attributes.flags))
            }
            File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val configuration = activity.resources.configuration
            val metadata = JSONObject().put("captureKind", "application-windows-own-view")
                .put("generatedOnly", true).put("secureWindow", true)
                .put("readiness", JSONObject().put("ready", true).put("page", page).put("state", state).put("marker", actualMarker))
                .put("baseWindow", bounds(base)).put("overlayWindows", windows)
                .put("language", MoteI18n.language()).put("screenWidthDp", configuration.screenWidthDp)
                .put("densityDpi", configuration.densityDpi).put("fontScale", configuration.fontScale)
                .put("actualIme", base.rootWindowInsets?.isVisible(android.view.WindowInsets.Type.ime()) == true)
            File(directory, "$name.json").writeText(metadata.toString(2))
        } finally { bitmap.recycle() }
    }
}
