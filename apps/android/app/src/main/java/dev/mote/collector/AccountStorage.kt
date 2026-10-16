package dev.mote.collector

import android.content.Context
import java.io.File

/** The selected identity is fixed before opening an existing store; no token-derived paths. */
internal fun Context.accountDirectory(): File {
    LocalDataFormat.requireCurrent(this)
    val config = Settings(this).read()
    val key = config.ownerKey()
    val localOwner = getSharedPreferences("mote", Context.MODE_PRIVATE).getString("localOwnerKey", "")
    return File(noBackupFilesDir, "accounts/${if (key == localOwner) "local" else key}").apply { check(isDirectory || mkdirs()) }
}
internal fun Context.accountPreferences(name: String) = getSharedPreferences("$name.${Settings(this).read().account()?.key ?: "local"}", Context.MODE_PRIVATE)

internal fun android.content.Context.ingress3(config: CollectorConfig, current: () -> Boolean = { true }): Ingress3Client {
    val settings = Settings(this)
    val binding = requireNotNull(config.account()) { "Verified account required" }
    return Ingress3Client(binding, settings.deviceId, config.deviceName, request = { method, path, body ->
        SyncSchedule.requireConditions(this, config)
        HttpJson.requestBytes(method, binding.origin + path, body?.toString()?.toByteArray(Charsets.UTF_8), config.connectionToken(), sendingContext = this)
    }, current = { current() && Settings(this).read().let { it.account() == binding && it.connectionToken() == config.connectionToken() && it.hasSyncConnection() } }, compressed = if (!config.packedUpload) null else { path, batch, events ->
        SyncSchedule.requireConditions(this, config)
        HttpJson.requestBytes("POST", binding.origin + path, CaptureBundle.encode(events), config.connectionToken(), CaptureBundle.CONTENT_TYPE,
            headers = mapOf("X-Mote-Batch-Id" to batch), sendingContext = this)
    })
}
