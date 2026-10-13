package dev.mote.collector

/** Protocol state/reason projection only; never interprets captured content. */
object CentralProcessingPresentation {
    fun stateKey(state: String, reason: String = "", notScheduled: Boolean = false): String? = when {
        notScheduled -> "未安排"
        state == "blocked" && reason == "awaiting_confirmation" -> "等待你确认"
        state == "blocked" && reason == "processor_response_unknown" -> "处理结果未知"
        else -> null
    }
}
