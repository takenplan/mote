package dev.mote.collector

import org.json.JSONObject
import java.net.URI

/** Identity is confirmed by M01. Credential/authorization epochs are deliberately not ownership. */
data class AccountBinding(val origin: String, val deploymentId: String, val userId: String) {
    init { require(origin == normalize(origin)); require(deploymentId.matches(ID) && userId.matches(ID)) }
    val key: String get() = SourceRules.hash(listOf(origin, deploymentId, userId).joinToString("\u0000"))
    fun json() = JSONObject().put("origin", origin).put("deploymentId", deploymentId).put("userId", userId)
    companion object {
        private val ID = Regex("[A-Za-z0-9_.:-]{1,128}")
        fun normalize(server: String): String {
            val value = URI(server.trim().trimEnd('/'))
            require(value.scheme?.lowercase() in setOf("http", "https") && value.host != null && value.rawUserInfo == null && value.rawQuery == null && value.rawFragment == null && value.path.orEmpty().isEmpty())
            val port = value.port.takeUnless { it == -1 || it == if (value.scheme.lowercase() == "https") 443 else 80 }
            return URI(value.scheme.lowercase(), null, value.host.lowercase(), port ?: -1, null, null, null).toASCIIString()
        }
        fun parse(value: String) = JSONObject(value).let { AccountBinding(it.getString("origin"), it.getString("deploymentId"), it.getString("userId")) }
        fun self(server: String, response: JSONObject): AccountBinding {
            ProtocolCompatibility.requireCompatible(response.opt("protocol"))
            val capabilities = response.getJSONObject("capabilities")
            require(capabilities.opt("ingest") == true && capabilities.opt("ingressVersion") == 3)
            require(response.getJSONObject("credential").optString("kind") in setOf("client", "device"))
            val account = response.getJSONObject("account")
            return AccountBinding(normalize(server), account.getString("deploymentId"), account.getString("userId"))
        }
    }
}
