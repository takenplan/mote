package dev.mote.collector

import android.app.Activity
import android.media.MediaPlayer
import android.widget.ImageView
import android.widget.TextView
import org.json.JSONObject
import java.io.File

internal object RecordOriginalPreview {
    fun open(activity: Activity, item: JSONObject) {
        val bytes = activity.recordDraftStore().bytes(item.getString("id"))
        val mime = item.getString("mime")
        if (mime.startsWith("image/")) {
            val bitmap = CapturePreview.decode(bytes, 1600)
            val view = ImageView(activity).apply { setImageBitmap(bitmap); adjustViewBounds = true }
            MoteDialogBuilder(activity).setTitle(item.getString("name")).setView(view).setPositiveButton(MoteI18n.text("关闭详情"), null).create().apply { setOnDismissListener { bitmap?.recycle() }; show() }
        } else if (mime.startsWith("audio/")) {
            val temp = File.createTempFile("record-listen-", ".audio", activity.cacheDir)
            try {
                temp.writeBytes(bytes)
                val player = MediaPlayer().apply { setDataSource(temp.absolutePath); prepare(); start() }
                MoteDialogBuilder(activity).setTitle(item.getString("name")).setPositiveButton(MoteI18n.text("停止"), null).create().apply { setOnDismissListener { player.release(); temp.delete() }; show() }
            } catch (error: Exception) { temp.delete(); throw error }
        } else {
            // Native read-only text preview never executes the captured file.
            MoteDialogBuilder(activity).setTitle(item.getString("name")).setView(TextView(activity).apply { text = if (mime.startsWith("text/")) bytes.toString(Charsets.UTF_8).take(100000) else item.getString("name"); setTextIsSelectable(true) }).setPositiveButton(MoteI18n.text("关闭详情"), null).show()
        }
    }
}
