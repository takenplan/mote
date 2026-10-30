package dev.mote.collector

import android.content.Context
import org.json.JSONObject

/** Device registration and the owner-authored context ACK precede capture submission. */
internal object CaptureContextSync {
    private fun path(entry: CaptureContextEntry) = entry.origin + "/api/devices/" + java.net.URLEncoder.encode(entry.deviceId, "UTF-8") + "/capture-context/" + entry.channel.wire
    private fun snapshot(body: JSONObject, previous: SourceContextSnapshot?): SourceContextSnapshot {
        val sourceId = body.getString("sourceId")
        require(sourceId.isNotBlank() && sourceId.length <= 200)
        return SourceContextSnapshot.from(body, previous?.sourceId ?: sourceId)
    }
    internal fun read(store: CaptureContextStore, entry: CaptureContextEntry, current: () -> Boolean,
                      request: (String, String, JSONObject?) -> Pair<Int, JSONObject?>): CaptureContextEntry {
        check(current())
        val (code, body) = request("GET", path(entry), null)
        check(current())
        if (code !in 200..299 || body == null) throw CentralFailure(code)
        return store.receive(entry, snapshot(body, entry.accepted))
    }
    internal fun sync(store: CaptureContextStore, initial: CaptureContextEntry, current: () -> Boolean,
                      request: (String, String, JSONObject?) -> Pair<Int, JSONObject?>): Boolean {
        var entry = initial
        if (!entry.pending) return true
        if (entry.conflict != null) return false
        if (entry.accepted == null) entry = read(store, entry, current, request)
        if (!entry.pending) return true
        if (entry.conflict != null || entry != store.entry(entry.origin, entry.deviceId, entry.channel)) return false
        val previous = requireNotNull(entry.accepted)
        check(current())
        val (code, body) = request("PATCH", path(entry), JSONObject().put("expectedVersion", previous.version).put("description", entry.description))
        check(current())
        if (code == 409) {
            val (readCode, latest) = request("GET", path(entry), null)
            check(current())
            if (readCode !in 200..299 || latest == null) throw CentralFailure(readCode)
            store.conflict(entry, snapshot(latest, previous)); return false
        }
        if (code !in 200..299 || body == null) throw CentralFailure(code)
        return store.acknowledge(entry, snapshot(body, previous))
    }
    fun read(context: Context, config: CollectorConfig, entry: CaptureContextEntry): CaptureContextEntry {
        require(entry.origin == config.server.trimEnd('/'))
        return read(context.captureContexts(), entry, { selected(context, config, entry.deviceId) }) { method, url, body ->
            SyncSchedule.requireConditions(context, config); CollectorHttp(context).request(method, url, body, config.connectionToken())
        }
    }
    private fun selected(context: Context, config: CollectorConfig, deviceId: String): Boolean {
        val settings = Settings(context); val now = settings.read()
        return !ConnectionGuard.reconfiguring() && now.server == config.server && now.connectionToken() == config.connectionToken() &&
            settings.deviceId == deviceId && config.hasSyncConnection() && settings.dataOrigin() == config.server.trimEnd('/')
    }
    fun syncPending(context: Context, config: CollectorConfig): Boolean {
        val settings = Settings(context); val origin = config.server.trimEnd('/'); val store = context.captureContexts()
        val deviceId = settings.deviceId
        check(selected(context, config, deviceId))
        store.bindLocal(origin, deviceId)
        for (entry in store.pending(origin, deviceId)) {
            if (!sync(store, entry, { selected(context, config, deviceId) }) { method, url, body ->
                SyncSchedule.requireConditions(context, config); CollectorHttp(context).request(method, url, body, config.connectionToken())
            }) return false
        }
        return true
    }
}
