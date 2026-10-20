package dev.mote.collector

import org.json.JSONObject

/** Presents the current scoped recording receipts without merging sibling failures. */
internal object CentralRecordingPresentation {
    data class Phase(val key: String, val title: String, val state: String, val attempts: Int, val error: String?, val nextAttemptAt: Long?) {
        val stateLabel: String get() = when (state) {
            "waiting" -> "等待处理"
            "running" -> "正在处理…"
            "succeeded" -> "已完成"
            "failed" -> "未完成"
            "blocked" -> "需要处理"
            "cancelled" -> "已取消"
            "stale" -> "已过期"
            "skipped" -> "已跳过"
            else -> state
        }
    }
    fun phases(row: JSONObject, now: Long): List<Phase> = listOf("metadata" to "读取信息", "transcript" to "归档转写", "audio" to "备份音频").mapNotNull { (key, title) ->
        val receipt = row.getJSONObject(key)
        if (key == "audio" && !receipt.getBoolean("required")) return@mapNotNull null
        val state = receipt.getString("state")
        Phase(key, title, state, receipt.getInt("attempts"), receipt.optString("error").takeIf(String::isNotBlank),
            receipt.optLong("nextAttemptAt").takeIf { state == "waiting" && it > now })
    }
}
