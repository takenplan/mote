package dev.mote.collector
import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit
/** Pull durable, individually confirmed deliveries. No model, capture or unconfirmed write. */
class CalendarActionWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val selected = ConnectionGuard.sync {
            val config = Settings(applicationContext).read()
            if (inputData.getString("owner") != config.ownerKey() || !config.hasSyncConnection() || config.syncMode == "manual") null
            else config to CalendarActions(applicationContext)
        } ?: return Result.success()
        val (config, actions) = selected
        // Permission checks can wait on native I/O. Retain this original owner
        // through delivery rather than constructing a new client's account later.
        if (!actions.permissions()) return Result.success()
        if (SyncSchedule.waitingReason(applicationContext, config) != null) return Result.retry()
        return try { actions.deliver(); Result.success() } catch (_: Exception) { Result.retry() }
    }
    companion object {
        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("mote-calendar-delivery", ExistingPeriodicWorkPolicy.UPDATE,
                PeriodicWorkRequestBuilder<CalendarActionWorker>(15, TimeUnit.MINUTES).setInputData(workDataOf("owner" to Settings(context).read().ownerKey())).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
        }
    }
}
