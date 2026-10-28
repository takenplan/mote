package dev.mote.collector

import org.json.JSONObject

/** Native upload use cases depend only on authenticated JSON and byte submission. */
internal interface CentralUploadClient {
    fun post(path: String, body: JSONObject = JSONObject()): JSONObject
    fun bytes(method: String, path: String, body: ByteArray?, mime: String): JSONObject
}
