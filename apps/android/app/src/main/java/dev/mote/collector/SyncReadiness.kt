package dev.mote.collector

internal data class StoredSyncStatus(val state: String, val message: String)

internal sealed interface VisibleSyncStatus {
    data class Message(val text: String) : VisibleSyncStatus
    data object Loading : VisibleSyncStatus
    data object Unavailable : VisibleSyncStatus
    data object Disconnected : VisibleSyncStatus
    data object SendAsConfigured : VisibleSyncStatus
    data class NeedsAttention(val blocked: Int, val pending: Int) : VisibleSyncStatus
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
        inventory: QueueInventory?, inventoryUnavailable: Boolean = false, matches: (String, String) -> Boolean): VisibleSyncStatus {
        if (waitingReason != null) return VisibleSyncStatus.Message(waitingReason)
        if (config.syncPaused || !obsolete(status, matches)) return VisibleSyncStatus.Message(status.message)
        if (inventoryUnavailable) return VisibleSyncStatus.Unavailable
        if (inventory != null && inventory.blocked > 0) return VisibleSyncStatus.NeedsAttention(inventory.blocked, inventory.pending)
        if (!config.hasSyncConnection()) return VisibleSyncStatus.Disconnected
        if (inventory == null) return VisibleSyncStatus.Loading
        return VisibleSyncStatus.SendAsConfigured
    }

    fun heartbeatState(config: CollectorConfig, status: StoredSyncStatus, blocked: Int, pending: PendingSync,
        matches: (String, String) -> Boolean): String {
        if (config.syncPaused || !obsolete(status, matches)) return status.state
        if (!config.hasSyncConnection()) return "unconfigured"
        return when { blocked > 0 -> "error"; pending.hasWork -> "waiting"; else -> "idle" }
    }

    fun text(status: VisibleSyncStatus): String = when (status) {
        is VisibleSyncStatus.Message -> status.text
        VisibleSyncStatus.Loading -> MoteI18n.text("正在读取本机同步状态…")
        VisibleSyncStatus.Unavailable -> MoteI18n.text("本机状态暂不可读取")
        VisibleSyncStatus.Disconnected -> MoteI18n.text(NOT_CONFIGURED)
        VisibleSyncStatus.SendAsConfigured -> MoteI18n.text("按设置发送")
        is VisibleSyncStatus.NeedsAttention -> MoteI18n.text("{0} 条记录需要处理（冲突或中央不可用） · 待发 {1} 条；请打开同步与恢复", status.blocked, status.pending)
    }
}
