package dev.mote.collector

import java.security.MessageDigest

/** Portable JSON.stringify encoding. Android's org.json escapes '/' and cannot
 * define the same subtree identity as the rule converter and shared runtime. */
internal object UiStructureHash {
    fun hash(resourceId: String, role: String, children: List<String>): String {
        val data = "[${quote(resourceId)},${quote(role)},${children.joinToString(",", "[", "]", transform = ::quote)}]"
        return MessageDigest.getInstance("SHA-256").digest(data.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }

    private fun quote(value: String): String = buildString {
        append('"')
        var index = 0
        while (index < value.length) {
            val char = value[index++]
            when (char) {
                '"', '\\' -> { append('\\'); append(char) }
                '\b' -> append("\\b")
                '\t' -> append("\\t")
                '\n' -> append("\\n")
                '\u000C' -> append("\\f")
                '\r' -> append("\\r")
                else -> when {
                    char.isHighSurrogate() && index < value.length && value[index].isLowSurrogate() -> { append(char); append(value[index++]) }
                    char.code < 32 || char.isSurrogate() -> append("\\u%04x".format(char.code))
                    else -> append(char)
                }
            }
        }
        append('"')
    }
}
