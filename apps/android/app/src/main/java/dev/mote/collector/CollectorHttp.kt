package dev.mote.collector

import android.content.Context
import org.json.JSONObject

/** Sending traffic is cancellable independently from central reading, questions and pairing. */
internal class CollectorHttp(private val context: Context) {
    fun post(url: String, body: JSONObject, token: String? = null) = request("POST", url, body, token)
    private fun verify(url: String, token: String?) {
        val settings = Settings(context); val config = settings.read()
        check(config.hasSyncConnection() && token == config.connectionToken() && url.startsWith(config.server.trimEnd('/') + "/api/"))
        check(settings.verifyAccount(config.server, config.connectionToken()) == config.account())
        check(Settings(context).read().let { it.account() == config.account() && it.connectionToken() == token })
    }
    fun postBytes(url: String, body: ByteArray, token: String? = null, contentType: String): Pair<Int, JSONObject?> {
        verify(url, token)
        return HttpJson.requestBytes("POST", url, body, token, contentType, sendingContext = context)
    }
    fun get(url: String, token: String? = null) = request("GET", url, null, token)
    fun request(method: String, url: String, body: JSONObject?, token: String? = null): Pair<Int, JSONObject?> {
        verify(url, token)
        return HttpJson.requestBytes(method, url, body?.toString()?.toByteArray(Charsets.UTF_8), token, sendingContext = context)
    }
}
