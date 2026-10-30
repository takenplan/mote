package dev.mote.collector

/** Only committed settings may be shown on the cached settings overview cards. */
internal data class SettingsSummaryConfig(val server: String, val syncPaused: Boolean)

internal sealed interface SettingsSummaryState {
    data object Loading : SettingsSummaryState
    data object Unavailable : SettingsSummaryState
    data class Current(val config: SettingsSummaryConfig) : SettingsSummaryState
}

/** A returning Activity or a confirmed local edit fences older asynchronous reads. */
internal class SettingsSummaryTracker {
    private var generation = 0L
    var state: SettingsSummaryState = SettingsSummaryState.Loading
        private set

    fun beginRead() { generation++; state = SettingsSummaryState.Loading }
    fun token(): Long = generation
    fun isCurrent(token: Long): Boolean = token == generation
    fun readResult(token: Long, config: SettingsSummaryConfig?): Boolean {
        if (token != generation) return false
        state = config?.let { SettingsSummaryState.Current(it) } ?: SettingsSummaryState.Unavailable
        return true
    }
    fun committed(config: SettingsSummaryConfig) { generation++; state = SettingsSummaryState.Current(config) }
}
