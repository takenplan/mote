package dev.mote.collector

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.TextView
import android.widget.CompoundButton
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
            "正在读取详情…", "记录已读取，正在加载图片…", "正在读取 App 与时间…", "加载预览…",
            "正在读取运行状态…", "正在读取已保存连接…", "正在读取存储位置…", "正在读取日志…",
            "正在读取本机同步状态…", "正在读取本机统计…", "正在生成压缩预览…", "正在读取日程建议…").map { MoteI18n.text(it) }.toSet() +
            listOf("本机记录", "中央归档").map { MoteI18n.text("正在读取{0}…", MoteI18n.text(it)) }
        return views(root).filterIsInstance<TextView>().none { it.isShown && it.text.toString() in pending }
    }

    private fun rectangle(rect: Rect) = JSONObject().put("left", rect.left).put("top", rect.top)
        .put("right", rect.right).put("bottom", rect.bottom).put("width", rect.width()).put("height", rect.height())

    private fun fullBounds(view: View): Rect {
        val position = IntArray(2); view.getLocationOnScreen(position)
        return Rect(position[0], position[1], position[0] + view.width, position[1] + view.height)
    }

    private fun viewGeometry(view: View): JSONObject {
        val visible = Rect()
        val hasVisibleRect = view.getGlobalVisibleRect(visible)
        val params = view.layoutParams
        return JSONObject().put("class", view.javaClass.name).put("id", view.id)
            .put("resourceId", if (view.id == View.NO_ID) JSONObject.NULL else runCatching { view.resources.getResourceName(view.id) }.getOrNull() ?: JSONObject.NULL)
            .put("fullBoundsScreen", rectangle(fullBounds(view))).put("globalVisibleRect", rectangle(visible))
            .put("hasGlobalVisibleRect", hasVisibleRect).put("isShown", view.isShown).put("isLaidOut", view.isLaidOut)
            .put("isLayoutRequested", view.isLayoutRequested)
            .put("layoutBounds", rectangle(Rect(view.left, view.top, view.right, view.bottom)))
            .put("scrollX", view.scrollX).put("scrollY", view.scrollY)
            .put("translationX", view.translationX).put("translationY", view.translationY)
            .put("padding", JSONObject().put("left", view.paddingLeft).put("top", view.paddingTop)
                .put("right", view.paddingRight).put("bottom", view.paddingBottom))
            .put("layoutParams", if (params == null) JSONObject.NULL else JSONObject().put("class", params.javaClass.name)
                .put("width", params.width).put("height", params.height).apply {
                    if (params is ViewGroup.MarginLayoutParams) put("margins", JSONObject().put("left", params.leftMargin)
                        .put("top", params.topMargin).put("right", params.rightMargin).put("bottom", params.bottomMargin))
                })
            .apply {
                if (view is ViewGroup) {
                    put("layoutMode", view.layoutMode).put("clipChildren", view.clipChildren).put("clipToPadding", view.clipToPadding)
                }
                if (view is android.widget.LinearLayout) put("baselineAligned", view.isBaselineAligned)
            }
    }

    private fun rgba(pixel: Int) = JSONObject().put("argbHex", String.format("#%08x", pixel))
        .put("red", Color.red(pixel)).put("green", Color.green(pixel)).put("blue", Color.blue(pixel)).put("alpha", Color.alpha(pixel))

    private fun colorDistance(first: Int, second: Int) = maxOf(kotlin.math.abs(Color.red(first) - Color.red(second)),
        kotlin.math.abs(Color.green(first) - Color.green(second)), kotlin.math.abs(Color.blue(first) - Color.blue(second)))

    /** Compare actual child pixels with the same overlay draw; property-only checks miss parent clipping. */
    private fun dialogButtons(overlay: View, appBitmap: Bitmap, origin: IntArray, failures: MutableList<String>): JSONArray {
        val evidence = JSONArray()
        val actionIds = setOf(android.R.id.button1, android.R.id.button2, android.R.id.button3)
        for (button in views(overlay).filter { it.isShown && it.id in actionIds && it !is CompoundButton }) {
            val full = fullBounds(button)
            val visible = Rect()
            val hasVisibleRect = button.getGlobalVisibleRect(visible)
            val errors = mutableListOf<String>()
            val geometry = viewGeometry(button)
            val ancestors = JSONArray()
            var ancestor = button.parent
            while (ancestor is View) {
                ancestors.put(viewGeometry(ancestor))
                ancestor = ancestor.parent
            }
            val background = button.background
            geometry.put("label", (button as? TextView)?.text?.toString() ?: "")
                .put("ancestors", ancestors)
                .put("background", if (background == null) JSONObject.NULL else JSONObject()
                    .put("class", background.javaClass.name).put("bounds", rectangle(background.bounds))
                    .put("currentClass", background.current.javaClass.name).put("currentBounds", rectangle(background.current.bounds))
                    .put("opticalInsets", JSONObject().put("left", background.opticalInsets.left).put("top", background.opticalInsets.top)
                        .put("right", background.opticalInsets.right).put("bottom", background.opticalInsets.bottom)))
            if (!hasVisibleRect || visible.width() != button.width || visible.height() != button.height) {
                errors += "Button is clipped: actual=${button.width}x${button.height}, globalVisible=$visible, fullScreen=$full"
            }
            if (!button.isLaidOut || button.width <= 0 || button.height <= 0) {
                errors += "Button has not completed real layout: laidOut=${button.isLaidOut}, requested=${button.isLayoutRequested}, size=${button.width}x${button.height}"
            } else {
                val isolated = Bitmap.createBitmap(button.width, button.height, Bitmap.Config.ARGB_8888)
                try {
                    button.draw(Canvas(isolated))
                    val expectedBorder = MoteUi.controlBorder
                    val tolerance = 32 // Allows edge anti-aliasing while separating #8090a5 from the white surface.
                    val rows = minOf(button.height, maxOf(4, button.context.moteDp(2) + 1))
                    val center = button.width / 2
                    val offset = maxOf(1, button.context.moteDp(2))
                    val columns = listOf((center - offset).coerceAtLeast(0), center, (center + offset).coerceAtMost(button.width - 1)).distinct()
                    val samples = JSONArray()
                    var expectedSamples = 0
                    var matchedSamples = 0
                    for (x in columns) {
                        var columnBorderSamples = 0
                        for (y in 0 until rows) {
                            val childPixel = isolated.getPixel(x, y)
                            val appX = full.left - origin[0] + x
                            val appY = full.top - origin[1] + y
                            val inBitmap = appX in 0 until appBitmap.width && appY in 0 until appBitmap.height
                            val appPixel = if (inBitmap) appBitmap.getPixel(appX, appY) else null
                            val childIsBorder = Color.alpha(childPixel) >= 192 && colorDistance(childPixel, expectedBorder) <= tolerance
                            val appIsBorder = appPixel != null && Color.alpha(appPixel) >= 192 && colorDistance(appPixel, expectedBorder) <= tolerance
                            val difference = appPixel?.let { colorDistance(childPixel, it) }
                            val preserved = childIsBorder && appIsBorder && difference != null && difference <= tolerance
                            samples.put(JSONObject().put("buttonX", x).put("buttonY", y).put("appBitmapX", appX).put("appBitmapY", appY)
                                .put("overlayX", full.left - fullBounds(overlay).left + x).put("overlayY", full.top - fullBounds(overlay).top + y)
                                .put("isolatedButtonDraw", rgba(childPixel)).put("actualOverlayDraw", appPixel?.let(::rgba) ?: JSONObject.NULL)
                                .put("isolatedIsControlBorder", childIsBorder).put("overlayIsControlBorder", appIsBorder)
                                .put("maxRgbDifference", difference ?: JSONObject.NULL).put("preserved", preserved))
                            if (childIsBorder) {
                                columnBorderSamples++; expectedSamples++
                                if (preserved) matchedSamples++
                                else errors += "Top border lost at button($x,$y)/app($appX,$appY): child=${rgba(childPixel)}, overlay=${appPixel?.let(::rgba)}, maxRgbDifference=$difference"
                            }
                        }
                        if (columnBorderSamples == 0) errors += "Isolated button.draw has no control border in top $rows rows at x=$x"
                    }
                    geometry.put("topEdgePixels", JSONObject().put("comparison", "button.draw versus actual overlay.draw in the application window bitmap")
                        .put("expectedControlBorder", rgba(expectedBorder)).put("rgbTolerance", tolerance).put("minimumAlpha", 192)
                        .put("topRows", rows).put("columns", JSONArray(columns)).put("expectedBorderSamples", expectedSamples)
                        .put("preservedBorderSamples", matchedSamples).put("samples", samples))
                } finally { isolated.recycle() }
            }
            geometry.put("passed", errors.isEmpty()).put("errors", JSONArray(errors))
            evidence.put(geometry)
            failures.addAll(errors.map { "${button.javaClass.simpleName}#${button.id} ${(button as? TextView)?.text}: $it" })
        }
        return evidence
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
            "note-return-list" -> Triple("records", "content", "查看记录说明")
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
            "rollout-permissions" -> Triple("rollout-permissions", "content", "权限与后台运行")
            "rollout-about" -> Triple("rollout-about", "content", "关于与更新")
            "rollout-developer" -> Triple("rollout-developer", "content", "开发者选项")
            "rollout-diagnostics" -> Triple("rollout-diagnostics", "content", "诊断与支持")
            "rollout-capture" -> Triple("rollout-capture", "content", "采集与存储")
            "rollout-processing" -> Triple("rollout-processing", "content", "图像质量与去重")
            "rollout-storage-settings" -> Triple("rollout-storage-settings", "content", "本机存储")
            "rollout-updates" -> Triple("rollout-updates", "content", "应用更新")
            "rollout-backup" -> Triple("rollout-backup", "content", "导入与导出")
            "rollout-queue" -> Triple("rollout-queue", "content", "待上传队列")
            "rollout-recovery" -> Triple("rollout-recovery", "content", "同步与恢复")
            "rollout-storage-location" -> Triple("rollout-storage-location", "content", "图片保存位置")
            "rollout-statistics" -> Triple("rollout-statistics", "content", "统计中心")
            "rollout-activity-statistics" -> Triple("rollout-activity-statistics", "content", "采集与存储详情")
            "rollout-logs" -> Triple("rollout-logs", "content", "日志中心")
            "rollout-dedupe" -> Triple("rollout-dedupe", "content", "图片去重诊断")
            "rollout-compression" -> Triple("rollout-compression", "content", "图片压缩预览")
            "rollout-bulk-dedupe" -> Triple("rollout-bulk-dedupe", "content", "本机图片批量去重")
            "rollout-legacy-sources" -> Triple("rollout-legacy-sources", "content", "已支持的来源")
            "rollout-folder-task" -> Triple("rollout-folder-task", "restriction", "收集哪些文件")
            "rollout-file-task-settings" -> Triple("rollout-file-task-settings", "content", "文件来源设置")
            "rollout-folder-task-settings" -> Triple("rollout-folder-task-settings", "content", "文件来源设置")
            "rollout-populated-sources" -> Triple("rollout-populated-sources", "content", "Generated file source")
            "rollout-file-original" -> Triple("rollout-file-original", "content", "原文与出处")
            "rollout-file-unavailable" -> Triple("rollout-file-unavailable", "error", "内容暂不可读取，原数据保留。")
            "rollout-app-rule-detail" -> Triple("rollout-app-rule-detail", "restriction", "规则配置与应用内容授权分开。修改只形成草稿，返回后保存生效；保存不会开始采集。")
            "rollout-app-rule-edit" -> Triple("rollout-app-rule-edit", "restriction", "配置此版本字段")
            "rollout-scanner" -> Triple("scanner", "content", "扫描连接二维码")
            "rollout-calendar" -> Triple("calendar", "restriction", "日程建议")
            "rollout-pairing" -> Triple("rollout-pairing", "content", "连接中央节点")
            else -> if (name.startsWith("rollout-central-")) {
                val centralPage = name.removePrefix("rollout-central-")
                val title = CentralScreens.pages.single { it.first == centralPage }.second
                when (centralPage) {
                    "overview" -> Triple(centralPage, "content", "模型已配置")
                    "files" -> Triple(centralPage, "empty", "当前范围内暂无条目。没有列出不代表不存在。")
                    "notes" -> Triple(centralPage, "restriction", "图片和录音会先归档。是否提取文字或转写录音取决于中央处理设置；请在资料库查看状态。每个附件最多 50 MiB。")
                    else -> Triple(centralPage, "content", title)
                }
            } else error("A new generated scene needs an explicit readiness contract: $name")
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
            val geometryFailures = mutableListOf<String>()
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
                windows.put(rectangle.put("dimAmount", dim).put("flags", attributes.flags)
                    .put("dialogButtons", dialogButtons(overlay, bitmap, origin, geometryFailures)))
            }
            File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val configuration = activity.resources.configuration
            val metadata = JSONObject().put("captureKind", "application-windows-own-view")
                .put("generatedOnly", true).put("secureWindow", true)
                .put("readiness", JSONObject().put("ready", geometryFailures.isEmpty()).put("page", page).put("state", state).put("marker", actualMarker))
                .put("baseWindow", bounds(base)).put("overlayWindows", windows)
                .put("dialogButtonGeometry", JSONObject().put("passed", geometryFailures.isEmpty()).put("errors", JSONArray(geometryFailures)))
                .put("language", MoteI18n.language()).put("screenWidthDp", configuration.screenWidthDp)
                .put("densityDpi", configuration.densityDpi).put("fontScale", configuration.fontScale)
                .put("actualIme", base.rootWindowInsets?.isVisible(android.view.WindowInsets.Type.ime()) == true)
            if (name == "rollout-scanner") {
                val preview = views(base).filterIsInstance<com.journeyapps.barcodescanner.DecoratedBarcodeView>().single()
                metadata.put("scannerPreview", viewGeometry(preview).put("cameraBackend", "host-verified-emulated")
                    .put("minimumTestSizeDp", 160).put("cameraImagePixelsClaimed", false))
            }
            File(directory, "$name.json").writeText(metadata.toString(2))
            check(geometryFailures.isEmpty()) { "Real dialog button geometry failed for $name; evidence saved in ${File(directory, "$name.json")}: ${geometryFailures.joinToString("; ")}" }
        } finally { bitmap.recycle() }
    }
}
