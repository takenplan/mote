package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeoutException
import javax.net.ssl.SSLException

enum class EventStage { APP, CONFIG, CAPTURE, MODEL, MODEL_DOWNLOAD, OCR, PRIVACY, QUEUE, UPLOAD, HEARTBEAT, NOTE, SOURCE, SUPPORT, UPDATE, UI, FILE_SCAN, FILE_PREPARE, FILE_UPLOAD, FILE_PART, FILE_COMMIT, DEDUPE }
enum class EventCode { STARTED, STOPPED, OK, FILTERED, WAIT_NETWORK, PERMISSION, CONFIG_INVALID, NETWORK, TIMEOUT, TLS, AUTH, CONFLICT, SERVER, RESPONSE, STORAGE, MODEL_UNAVAILABLE, SCHEDULER, CANCELLED, OTHER }

/** Fixed schema only: safe class names and generated source IDs; never messages, paths or content. */
class EventJournal(private val file: File, private val limit: Int = 500) {
    init { require(limit in 1..500) }
    fun record(stage: EventStage, code: EventCode, elapsedMs: Long? = null, httpStatus: Int? = null, errorName: String? = null, sourceId: String? = null) = synchronized(lock) {
        val next = JSONArray(); val old = read()
        for (index in maxOf(0, old.length() - limit + 1) until old.length()) next.put(old.getJSONObject(index))
        val event = JSONObject().put("atMs", System.currentTimeMillis()).put("stage", stage.name.lowercase()).put("code", code.name.lowercase()).put("level", level(code))
        if (elapsedMs != null && elapsedMs >= 0) event.put("elapsedMs", elapsedMs)
        if (httpStatus != null && httpStatus in 100..599) event.put("httpStatus", httpStatus)
        safeErrorName(errorName)?.let { event.put("errorName", it) }
        safeSourceId(sourceId)?.let { event.put("sourceId", it) }
        next.put(event); file.parentFile!!.mkdirs()
        val temporary = File(file.parentFile, "${file.name}.tmp")
        FileOutputStream(temporary).use { out -> privateDiagnosticFile(temporary); out.write(("[" + (0 until next.length()).joinToString(",\n") { next.getJSONObject(it).toString() } + "]\n").toByteArray()); out.fd.sync() }
        check(temporary.renameTo(file))
    }
    fun readRaw(): String = synchronized(lock) {
        if (!file.exists()) return@synchronized ""
        file.inputStream().use { input ->
            val bytes = ByteArray(256 * 1024 + 1)
            var size = 0
            while (size < bytes.size) {
                val count = input.read(bytes, size, bytes.size - size)
                if (count < 0) break
                size += count
            }
            check(size <= 256 * 1024) { "Event log exceeds limit" }
            String(bytes, 0, size, Charsets.UTF_8)
        }
    }
    fun read(strict: Boolean = false): JSONArray = synchronized(lock) {
        val raw = if (strict && file.exists()) {
            check(file.length() <= 256 * 1024) { "Event log exceeds limit" }
            JSONArray(file.readText()) // A corrupt/unreadable log is not an empty history.
        } else if (file.exists() && file.length() <= 256 * 1024) runCatching { JSONArray(file.readText()) }.getOrNull() else null
        val safe = JSONArray()
        if (raw != null) for (index in maxOf(0, raw.length() - limit) until raw.length()) {
            val item = raw.optJSONObject(index) ?: continue
            val stage = EventStage.entries.find { it.name.lowercase() == item.optString("stage") } ?: continue
            val code = EventCode.entries.find { it.name.lowercase() == item.optString("code") } ?: continue
            val at = item.opt("atMs") as? Number ?: continue
            if (!at.toDouble().isFinite() || at.toLong() < 0) continue
            val event = JSONObject().put("atMs", at.toLong()).put("stage", stage.name.lowercase()).put("code", code.name.lowercase())
            (item.opt("elapsedMs") as? Number)?.takeIf { it.toDouble().isFinite() && it.toLong() >= 0 }?.let { event.put("elapsedMs", it.toLong()) }
            (item.opt("httpStatus") as? Number)?.takeIf { it.toInt() in 100..599 }?.let { event.put("httpStatus", it.toInt()) }
            item.optString("level").takeIf { it in listOf("debug", "info", "warn", "error") }?.let { event.put("level", it) }
            safeErrorName(item.opt("errorName") as? String)?.let { event.put("errorName", it) }
            safeSourceId(item.opt("sourceId") as? String)?.let { event.put("sourceId", it) }
            safe.put(event)
        }
        safe
    }
    companion object {
        private val lock = Any()
        private val errorNames = setOf("Error", "Exception", "RuntimeException", "IOException", "SocketTimeoutException", "TimeoutException", "SSLException", "SecurityException", "IllegalArgumentException", "IllegalStateException", "JSONException", "InterruptedException", "CancellationException", "QueueFull", "SettingsWriteFailure", "SettingsChangedFailure", "OtherError")
        internal fun safeErrorName(value: String?) = value?.takeIf { it in errorNames }
        internal fun errorName(error: Throwable) = safeErrorName(error.javaClass.simpleName) ?: "OtherError"
        internal fun safeSourceId(value: String?) = value?.takeIf { it.matches(Regex("(?:android-|local-)?[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")) }
        internal fun level(code: EventCode) = when (code) {
            EventCode.STARTED -> "debug"
            EventCode.STOPPED, EventCode.OK, EventCode.FILTERED, EventCode.CANCELLED -> "info"
            EventCode.WAIT_NETWORK, EventCode.SCHEDULER, EventCode.PERMISSION, EventCode.MODEL_UNAVAILABLE -> "warn"
            else -> "error"
        }
        fun failure(error: Throwable, stage: EventStage): EventCode {
            var current: Throwable? = error
            repeat(8) {
                when (current) {
                    is SocketTimeoutException, is TimeoutException -> return EventCode.TIMEOUT
                    is SSLException -> return EventCode.TLS
                    is InterruptedException, is java.util.concurrent.CancellationException -> return EventCode.CANCELLED
                    is SecurityException -> return EventCode.PERMISSION
                    is IllegalArgumentException -> return EventCode.CONFIG_INVALID
                }
                current = current?.cause
            }
            return when (stage) {
                EventStage.CONFIG -> EventCode.CONFIG_INVALID
                EventStage.QUEUE, EventStage.NOTE, EventStage.SUPPORT, EventStage.FILE_SCAN, EventStage.FILE_PREPARE, EventStage.DEDUPE -> EventCode.STORAGE
                EventStage.MODEL -> EventCode.MODEL_UNAVAILABLE
                EventStage.UPLOAD, EventStage.HEARTBEAT, EventStage.MODEL_DOWNLOAD, EventStage.FILE_UPLOAD, EventStage.FILE_PART, EventStage.FILE_COMMIT -> if (error is IOException) EventCode.NETWORK else EventCode.RESPONSE
                else -> EventCode.OTHER
            }
        }
        fun httpFailure(status: Int) = when (status) { 401, 403 -> EventCode.AUTH; 409, 410 -> EventCode.CONFLICT; in 500..599 -> EventCode.SERVER; else -> EventCode.RESPONSE }
    }
}

/** Android's private directory is retained; make log files explicitly owner-readable/writable. */
internal fun privateDiagnosticFile(file: File) {
    check(file.setReadable(false, false) && file.setWritable(false, false) && file.setExecutable(false, false))
    check(file.setReadable(true, true) && file.setWritable(true, true))
}
