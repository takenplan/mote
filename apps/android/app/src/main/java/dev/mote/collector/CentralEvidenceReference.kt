package dev.mote.collector

/** Resource IDs stay UUIDs; a public original reference carries its explicit namespace. */
internal object CentralEvidenceReference {
    fun readQuery(client: CentralClient, reference: String, offset: Int): org.json.JSONObject =
        client.get("/api/capture-browser/" + java.net.URLEncoder.encode(captureId(normalize(reference)) ?: error("Unsupported capture reference"), "UTF-8"))
    private val uuid = Regex("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")
    fun normalize(reference: String): String = if (uuid.matches(reference)) capture(reference) else reference
    fun capture(id: String): String { require(uuid.matches(id)); return "capture:" + id.lowercase() }
    fun captureId(reference: String): String? {
        if (!reference.startsWith("capture:")) return null
        val id = reference.removePrefix("capture:")
        return id.takeIf(uuid::matches)?.lowercase()
    }
}
