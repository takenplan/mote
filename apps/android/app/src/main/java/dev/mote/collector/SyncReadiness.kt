package dev.mote.collector

internal data class StoredSyncStatus(val state: String, val message: String)

internal sealed interface VisibleSyncStatus {
    data class Message(val text: String) : VisibleSyncStatus
    data object Loading : VisibleSyncStatus
    data object Unavailable : VisibleSyncStatus
    data class Disconnected(val detail: VisibleSyncStatus? = null) : VisibleSyncStatus
    data object SendAsConfigured : VisibleSyncStatus
    data class NeedsAttention(val blocked: Int, val pending: Int) : VisibleSyncStatus
    data class NeedsSourceAttention(val sources: Int, val pending: Int) : VisibleSyncStatus
    data class Messages(val first: String, val second: String) : VisibleSyncStatus
}

/** Projects known stale configuration labels; never changes stored state or receipts. */
internal object SyncReadiness {
    const val NOT_CONFIGURED = "仅保存在本机 · 连接节点后可同步"
    const val WORKER_NOT_CONFIGURED = "仅保存在本机 · 尚未配置完整连接"
    const val PAUSED = "已暂停全部发送 · 本机继续保存"
    val obsoleteMessages = listOf(NOT_CONFIGURED, WORKER_NOT_CONFIGURED, PAUSED)

    private fun obsolete(status: StoredSyncStatus, matches: (String, String) -> Boolean) =
        when (status.state) {
            "unconfigured" -> matches(NOT_CONFIGURED, status.message) || matches(WORKER_NOT_CONFIGURED, status.message)
            "paused" -> matches(PAUSED, status.message)
            else -> false
        }

    fun visible(config: CollectorConfig, status: StoredSyncStatus, waitingReason: String?,
        inventory: QueueInventory?, sourceIssues: Int?, inventoryUnavailable: Boolean = false,
        labelsReady: Boolean = true, labelsFailed: Boolean = false, matches: (String, String) -> Boolean): VisibleSyncStatus {
        val connected = config.hasSyncConnection()
        fun withConnection(value: VisibleSyncStatus) = if (connected) value else VisibleSyncStatus.Disconnected(value)
        if (waitingReason != null) {
            val value = if (status.state == "error" && status.message != waitingReason) VisibleSyncStatus.Messages(waitingReason, status.message) else VisibleSyncStatus.Message(waitingReason)
            return withConnection(value)
        }
        if (status.state in setOf("unconfigured", "paused") && !labelsReady) return withConnection(if (labelsFailed) VisibleSyncStatus.Messages(MoteI18n.text("本机状态暂不可读取"), status.message) else VisibleSyncStatus.Loading)
        if (config.syncPaused || !obsolete(status, matches)) {
            if (!config.syncPaused && inventory != null && sourceIssues != null && sourceIssues > 0) {
                val source = text(VisibleSyncStatus.NeedsSourceAttention(sourceIssues, inventory.pending))
                return withConnection(VisibleSyncStatus.Messages(status.message, source))
            }
            return withConnection(VisibleSyncStatus.Message(status.message))
        }
        if (inventoryUnavailable) return withConnection(VisibleSyncStatus.Unavailable)
        if (inventory == null || sourceIssues == null) return withConnection(VisibleSyncStatus.Loading)
        if (inventory.blocked > 0) return withConnection(VisibleSyncStatus.NeedsAttention(inventory.blocked, inventory.pending))
        if (sourceIssues > 0) return withConnection(VisibleSyncStatus.NeedsSourceAttention(sourceIssues, inventory.pending))
        return if (connected) VisibleSyncStatus.SendAsConfigured else VisibleSyncStatus.Disconnected()
    }

    fun heartbeatState(config: CollectorConfig, status: StoredSyncStatus, blocked: Int, pending: PendingSync, sourceIssues: Int?,
        matches: (String, String) -> Boolean): String {
        if (config.syncPaused) return status.state
        if (config.hasSyncConnection() && (blocked > 0 || sourceIssues == null || sourceIssues > 0)) return "error"
        if (!obsolete(status, matches)) return status.state
        if (!config.hasSyncConnection()) return "unconfigured"
        return when { blocked > 0 || sourceIssues == null || sourceIssues > 0 -> "error"; pending.hasWork -> "waiting"; else -> "idle" }
    }

    fun text(status: VisibleSyncStatus): String = when (status) {
        is VisibleSyncStatus.Message -> status.text
        VisibleSyncStatus.Loading -> MoteI18n.text("正在读取本机同步状态…")
        VisibleSyncStatus.Unavailable -> MoteI18n.text("本机状态暂不可读取")
        is VisibleSyncStatus.Disconnected -> MoteI18n.text("未连接中央节点") + (status.detail?.let { "\n" + text(it) } ?: "")
        VisibleSyncStatus.SendAsConfigured -> MoteI18n.text("按设置发送")
        is VisibleSyncStatus.NeedsAttention -> MoteI18n.text("{0} 条记录需要处理（冲突或中央不可用） · 待发 {1} 条；请打开同步与恢复", status.blocked, status.pending)
        is VisibleSyncStatus.NeedsSourceAttention -> MoteI18n.text("{0} 个来源同步需要处理 · 待发 {1} 条；请在来源页面检查上传授权、权限或连接", status.sources, status.pending)
        is VisibleSyncStatus.Messages -> status.first + "\n" + status.second
    }
}
