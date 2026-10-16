package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject

/** Native selector retains an explicit owned M04 reference, never model credentials. */
internal object CentralModels {
    fun inventory(client: CentralClient): JSONObject {
        val inventory = client.get("/api/models")
        val profiles = JSONArray()
        for (kind in listOf("shared", "personal")) {
            val values = inventory.getJSONArray(kind)
            for (index in 0 until values.length()) {
                val item = values.getJSONObject(index)
                profiles.put(JSONObject().put("id", JSONObject().put("kind", kind).put("id", item.getString("id")).toString())
                    .put("name", item.getString("name")))
            }
        }
        return JSONObject().put("profiles", profiles)
    }
    fun reference(value: String): JSONObject? {
        if (value.isEmpty()) return null
        return JSONObject(value).also {
            require(it.keys().asSequence().toSet() == setOf("kind", "id") && it.getString("kind") in setOf("shared", "personal") && it.getString("id").length in 1..256)
        }
    }
}
