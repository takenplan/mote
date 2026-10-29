package dev.mote.collector

/** Labels describe received action facts; they never authorize a calendar write. */
internal object CalendarActionPresentation {
    fun stateKey(kind: String, status: String, resolution: String = "", managedState: String = ""): String? {
        if (managedState == "cancel_requested") return "已请求取消，写入结果仍待核实"
        if (managedState == "cancelled") return "已取消等待执行"
        if (resolution == "cancelled") return "已取消"
        if (resolution == "completed") return "已标记完成"
        if (status == "succeeded") return when (kind) {
            "calendar.create" -> "已写入日历"
            "calendar.update" -> "已更新日历"
            "calendar.cancel" -> "已取消日程"
            "calendar.complete" -> "已标记完成"
            else -> "已完成"
        }
        return when (status) {
            "proposed" -> "待确认"
            "approved" -> "等待客户端写入"
            "executing" -> "等待保存回执"
            "uncertain" -> "保存结果待核实"
            "dismissed" -> "已忽略"
            "stale" -> "原文已更新或删除"
            else -> null
        }
    }
}
