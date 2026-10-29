package dev.mote.collector

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView

/** Installation guidance is read or copied explicitly; this page never installs a service. */
class StartUsingActivity : MoteActivity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val body = moteDetailPage(title = MoteI18n.text("开始使用"))
        fun text(value: String, role: NativeFontRole = NativeFontRole.BODY) = TextView(this).apply {
            text = value; MoteUi.type(this,role); MoteUi.textColor(this,NativeColorRole.INK); setPadding(0,moteDp(12),0,moteDp(12))
        }.also(body::addView)
        fun button(value: String, primary: Boolean = false, run: () -> Unit) = MoteUi.button(Button(this).apply { text = value; setOnClickListener { run() } },primary).also(body::addView)
        text(MoteI18n.text("先准备你的中央档案"),NativeFontRole.TITLE_MOBILE)
        text(MoteI18n.text("在电脑上请安装助手准备 Central。完成后，用它给出的地址打开工作台，再生成设备连接邀请。"))
        button(MoteI18n.text("复制给安装助手"),true) {
            getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Mote",INSTALL_PROMPT))
            android.widget.Toast.makeText(this,MoteI18n.text("已复制"),android.widget.Toast.LENGTH_SHORT).show()
        }
        val prompt = TextView(this).apply { text = INSTALL_PROMPT; visibility = View.GONE; setTextIsSelectable(true); MoteUi.type(this,NativeFontRole.SUPPORT); MoteUi.textColor(this,NativeColorRole.MUTED) }
        button(MoteI18n.text("查看安装提示词")) { prompt.visibility = if (prompt.visibility == View.VISIBLE) View.GONE else View.VISIBLE }
        body.addView(prompt)
        button(MoteI18n.text("查看安装文档")) { startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://github.com/utopiafar/mote/blob/main/docs/agent-install.md"))) }
        button(MoteI18n.text("现在先记下来")) { openRecordEditor(); finish() }
    }
    companion object {
        internal val INSTALL_PROMPT = """Help me install Mote from https://github.com/utopiafar/mote.
Read docs/agent-install.md and the linked deployment instructions first.
Inspect my environment and any existing Mote installation without changing it.
Use the project's CLI to create an isolated local trial, or reuse the installation
I explicitly choose. Preserve existing archives, profiles, credentials and settings.
Verify authenticated health and give me the actual Central address, then guide me
through connecting a collector and opening its first received original in Central.
Ask before changing network exposure, installing a persistent service, granting
new permissions, using a paid model, or changing existing data. Keep secrets out
of output and Git. Stop at an unavailable requirement and report what remains."""
    }
}
