package dev.mote.collector

import org.json.JSONObject
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneId

/** Current scoped contracts only. Derived service fields remain the exact
 * values read from the image policy; the editor never creates credentials. */
internal object CentralResourceSettings {
    fun perceptionRequest(revision: Long, saved: JSONObject, values: JSONObject, concurrency: String, providerRevision: String, profileId: String): JSONObject {
        val limit = concurrency.toInt(); require(limit in 1..8)
        require(providerRevision.isNotBlank() && providerRevision.length <= 128)
        val settings = JSONObject(saved.toString())
        for (key in listOf("enabled", "understandingEnabled", "allowExternalProcessing", "allowQueryImages")) settings.put(key, values.getBoolean(key))
        settings.put("concurrency", limit).put("providerRevision", providerRevision).put("profileId", profileId)
        return JSONObject().put("revision", revision).put("settings", settings)
    }
    fun historicalRequest(after: String, before: String, sourceId: String, mode: String, timeZone: ZoneId = ZoneId.systemDefault()): JSONObject {
        require(mode in setOf("complete", "recompute"))
        val start = after.takeIf(String::isNotBlank)?.let(LocalDate::parse)
        val end = before.takeIf(String::isNotBlank)?.let(LocalDate::parse)
        require(start == null || end == null || start <= end)
        return JSONObject().put("mode", mode).apply {
            start?.let { put("after", it.atStartOfDay(timeZone).toInstant().toString()) }
            end?.let { put("before", it.plusDays(1).atStartOfDay(timeZone).toInstant().toString()) }
            sourceId.takeIf(String::isNotBlank)?.let { put("sourceId", it) }
        }
    }
    fun storageRequest(revision: Long, days: String, capacityMiB: String): JSONObject {
        val retention = days.toLong(); val capacity = capacityMiB.toBigDecimal()
        require(retention in 0..36500 && capacity >= BigDecimal.ONE && capacity <= BigDecimal(1000000))
        val bytes = capacity.multiply(BigDecimal(1024 * 1024)).longValueExact()
        return JSONObject().put("revision", revision).put("retentionDays", retention).put("maxStorageBytes", bytes)
    }
    fun capacityMiB(bytes: Long): String = BigDecimal(bytes).divide(BigDecimal(1024 * 1024)).stripTrailingZeros().toPlainString()
    fun modelState(state: String): String = when (state) {
        "ready" -> "模型文件已安装"; "not_installed" -> "尚未安装"; "downloading" -> "下载中"
        "verifying" -> "校验中"; "installing" -> "安装中"; "failed" -> "处理失败"; "cancelled" -> "已取消"
        else -> "状态尚未确认"
    }
}
