package dev.mote.collector

/** Account-bound format 4 preserves existing content bytes verbatim. Credentials and native private ledgers use SecretBox separately. */
class LocalContentCipher : ByteCipher {
    override fun seal(bytes: ByteArray): ByteArray = bytes
    override fun open(bytes: ByteArray): ByteArray = bytes
}

fun android.content.Context.localContentCipher(): LocalContentCipher {
    LocalDataFormat.requireCurrent(this)
    return LocalContentCipher()
}
