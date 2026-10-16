package dev.mote.collector

import org.json.JSONObject

/** The Vault's export entry, shared by native UI and the real-host contract test. */
internal class CentralPortable(private val api: CentralClient) {
    fun start(operationId: String): JSONObject = api.get("/api/export-bundle?mode=data")
}
