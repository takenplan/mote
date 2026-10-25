package dev.mote.collector

import java.util.UUID

internal object NativeRecordAttachmentLabels {
    /** Only the native pending-media identity, not a similarly named user file, gets a generated label. */
    fun generatedKind(id: String, name: String, mime: String): String? {
        if (id != UUID.nameUUIDFromBytes(name.toByteArray()).toString()) return null
        return when {
            name.startsWith("photo-") && mime.startsWith("image/") -> "照片"
            name.startsWith("record-microphone-") && mime.startsWith("audio/") -> "录音"
            else -> null
        }
    }
}
