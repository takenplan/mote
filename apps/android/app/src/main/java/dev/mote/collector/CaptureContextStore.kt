package dev.mote.collector

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

internal enum class CaptureContextChannel(val wire: String, val label: String) {
    ACTIVITY("activity", "应用时长"), SCREEN("screen", "截图"), STRUCTURED("structured", "结构化内容"), NOTIFICATIONS("notifications", "通知");
    companion object { fun from(value: String) = entries.single { it.wire == value } }
}

internal data class CaptureContextEntry(
    val origin: String, val deviceId: String, val channel: CaptureContextChannel,
    val description: String = "", val draft: String = "", val revision: Long = 0,
    val pending: Boolean = false, val updatedAt: Long = 0,
    val accepted: SourceContextSnapshot? = null, val conflict: SourceContextSnapshot? = null,
) {
    val dirty get() = description != draft
    fun json() = JSONObject().put("origin", origin).put("deviceId", deviceId).put("channel", channel.wire)
        .put("description", description).put("draft", draft).put("revision", revision).put("pending", pending).put("updatedAt", updatedAt)
        .put("accepted", accepted?.json()).put("conflict", conflict?.json())
    companion object {
        fun from(value: JSONObject) = CaptureContextEntry(
            value.getString("origin"), value.getString("deviceId"), CaptureContextChannel.from(value.getString("channel")),
            value.getString("description"), value.getString("draft"), value.getLong("revision"), value.getBoolean("pending"), value.getLong("updatedAt"),
            value.optJSONObject("accepted")?.let { SourceContextSnapshot.from(it, it.getString("sourceId")) },
            value.optJSONObject("conflict")?.let { SourceContextSnapshot.from(it, it.getString("sourceId")) },
        ).also { require(it.description.length <= 12000 && it.draft.length <= 12000 && it.revision >= 0) }
    }
}

/** Owner declarations are private metadata. Neither captured text nor other nodes can edit this journal. */
internal class CaptureContextStore(private val directory: File, private val cipher: ByteCipher) {
    private val file = File(directory, "contexts.enc")
    private fun state() = if (file.exists()) JSONObject(String(cipher.open(file.readBytes()), Charsets.UTF_8)) else JSONObject()
    private fun key(origin: String, deviceId: String, channel: CaptureContextChannel) = SourceRules.hash(listOf(origin, deviceId, channel.wire).joinToString("\u0000"))
    private fun entries(value: JSONObject) = value.keys().asSequence().map { CaptureContextEntry.from(value.getJSONObject(it)) }.toList()
    @Synchronized fun entry(origin: String, deviceId: String, channel: CaptureContextChannel): CaptureContextEntry {
        require(deviceId.isNotBlank() && deviceId.length <= 200 && origin == origin.trim().trimEnd('/'))
        return state().optJSONObject(key(origin, deviceId, channel))?.let(CaptureContextEntry::from) ?: CaptureContextEntry(origin, deviceId, channel)
    }
    private fun put(value: JSONObject, item: CaptureContextEntry) { value.put(key(item.origin, item.deviceId, item.channel), item.json()) }
    @Synchronized fun edit(origin: String, deviceId: String, channel: CaptureContextChannel, draft: String): CaptureContextEntry {
        require(draft.length <= 12000)
        val current = entry(origin, deviceId, channel)
        if (current.draft == draft) return current
        return current.copy(draft = draft, revision = current.revision + 1).also { val value = state(); put(value, it); write(value) }
    }
    @Synchronized fun saveDraft(origin: String, deviceId: String, channel: CaptureContextChannel): CaptureContextEntry {
        val current = entry(origin, deviceId, channel)
        return current.copy(description = current.draft, pending = current.accepted?.description != current.draft,
            revision = current.revision + 1, updatedAt = System.currentTimeMillis()).also { val value = state(); put(value, it); write(value) }
    }
    @Synchronized fun hasPendingConnectionWork() = entries(state()).any { it.pending || (it.origin.isBlank() && it.draft.isNotBlank()) }
    @Synchronized fun pending(origin: String, deviceId: String, includeUnbound: Boolean = false) = entries(state()).filter {
        it.deviceId == deviceId && (it.origin == origin || (includeUnbound && it.origin.isBlank())) && it.pending
    }
    /** Settings.dataOrigin remains sticky while these entries are unconfirmed; the existing bindLocal gate precedes this. */
    @Synchronized fun bindLocal(origin: String, deviceId: String) {
        require(origin.isNotBlank())
        val value = state()
        val local = entries(value).filter { it.origin.isBlank() && it.deviceId == deviceId }
        local.forEach { require(!value.has(key(origin, deviceId, it.channel))) { "Local context already has a selected target" } }
        local.forEach { value.remove(key("", deviceId, it.channel)); put(value, it.copy(origin = origin, revision = it.revision + 1)) }
        if (local.isNotEmpty()) write(value)
    }
    @Synchronized fun receive(expected: CaptureContextEntry, remote: SourceContextSnapshot): CaptureContextEntry {
        val current = entry(expected.origin, expected.deviceId, expected.channel)
        if (current != expected) return current
        require(expected.accepted == null || expected.accepted.sourceId == remote.sourceId)
        val next = when {
            current.pending && remote.description == current.description -> current.copy(accepted = remote, conflict = null, pending = false)
            current.pending && (current.accepted == null && remote.version > 0 || current.accepted != null && current.accepted != remote) -> current.copy(conflict = remote)
            current.pending -> current.copy(accepted = remote, conflict = null)
            else -> current.copy(description = remote.description, draft = if (current.dirty) current.draft else remote.description, accepted = remote, conflict = null)
        }
        return next.also { val value = state(); put(value, it); write(value) }
    }
    @Synchronized fun acknowledge(expected: CaptureContextEntry, accepted: SourceContextSnapshot): Boolean {
        require(accepted.description == expected.description && accepted.version >= (expected.accepted?.version ?: 0))
        require(expected.accepted == null || expected.accepted.sourceId == accepted.sourceId)
        require(expected.accepted == null || expected.accepted.description == expected.description || accepted.version > expected.accepted.version)
        val current = entry(expected.origin, expected.deviceId, expected.channel)
        if (current != expected) return false
        val value = state(); put(value, current.copy(accepted = accepted, conflict = null, pending = false)); write(value)
        return true
    }
    @Synchronized fun conflict(expected: CaptureContextEntry, remote: SourceContextSnapshot): Boolean {
        if (entry(expected.origin, expected.deviceId, expected.channel) != expected) return false
        require(expected.accepted == null || expected.accepted.sourceId == remote.sourceId)
        val value = state(); put(value, expected.copy(conflict = remote)); write(value); return true
    }
    @Synchronized fun resolve(expected: CaptureContextEntry, keepLocal: Boolean): CaptureContextEntry {
        val current = entry(expected.origin, expected.deviceId, expected.channel)
        require(current == expected)
        val remote = requireNotNull(current.conflict)
        val next = if (keepLocal) current.copy(accepted = remote, conflict = null, pending = current.description != remote.description, revision = current.revision + 1)
            else current.copy(description = remote.description, draft = remote.description, accepted = remote, conflict = null, pending = false, revision = current.revision + 1)
        return next.also { val value = state(); put(value, it); write(value) }
    }
    private fun write(value: JSONObject) {
        directory.mkdirs()
        val temporary = File(directory, UUID.randomUUID().toString() + ".tmp")
        try { FileOutputStream(temporary).use { it.write(cipher.seal(value.toString().toByteArray(Charsets.UTF_8))); it.fd.sync() }; check(temporary.renameTo(file)) }
        finally { temporary.delete() }
    }
}

private val captureContextStores = java.util.concurrent.ConcurrentHashMap<String, CaptureContextStore>()
internal fun Context.captureContexts(): CaptureContextStore {
    LocalDataFormat.requireCurrent(this)
    val app = applicationContext; val directory = File(app.noBackupFilesDir, "capture-context")
    return captureContextStores.computeIfAbsent(directory.absolutePath) { CaptureContextStore(directory, app.localContentCipher()) }
}
