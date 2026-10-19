package dev.mote.collector

import org.json.JSONObject
import java.util.UUID

/** File capabilities come from the scoped DTO, never its title, path or text. */
internal data class CentralFileView(val originalRef: String?, val hasOriginal: Boolean, val artifactId: String?, val current: Boolean, val hasArtifacts: Boolean) {
    val canEdit get() = current && artifactId != null
    val canProcess get() = current && originalRef != null
    val canExport get() = originalRef != null && (artifactId != null || hasArtifacts || hasOriginal)

    companion object {
        private val originalPattern = Regex("original:[a-f0-9]{64}")
        private val artifactPattern = Regex("[a-f0-9]{64}")
        fun read(row: JSONObject): CentralFileView {
            val original = if (row.has("originalRef") && !row.isNull("originalRef")) row.getString("originalRef").also { require(originalPattern.matches(it)) } else null
            val hasOriginal = row.getBoolean("hasOriginal")
            require(!hasOriginal || original != null)
            val status = row.getJSONObject("processing")
            val artifact = if (status.has("artifactId") && !status.isNull("artifactId")) status.getString("artifactId").also { require(artifactPattern.matches(it)) } else null
            return CentralFileView(original, hasOriginal, artifact, status.getBoolean("current"), (row.optJSONArray("artifacts")?.length() ?: 0) > 0)
        }

        /** Metadata-only entries have the same all-revision forget generation.
         * An optional original anchor must never be invented to admit deletion. */
        fun deleteDescriptor(row: JSONObject): JSONObject {
            val id = row.getString("captureId"); UUID.fromString(id)
            val raw = row.get("originalGeneration")
            require(raw is Number && raw.toDouble() >= 0 && raw.toDouble() < 9007199254740991.0 && raw.toDouble() == raw.toLong().toDouble())
            return JSONObject().put("captureId", id).put("sourceId", row.getString("sourceId"))
                .put("externalId", row.getJSONObject("item").getString("externalId")).put("originalGeneration", raw.toLong()).also { result ->
                    if (row.has("originalRef") && !row.isNull("originalRef")) {
                        val original = row.getString("originalRef"); require(originalPattern.matches(original)); result.put("originalRef", original)
                    }
                }
        }
    }
}
