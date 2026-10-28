package dev.mote.collector

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

internal class CentralStateFile(private val directory: File, private val name: String, private val cipher: ByteCipher) {
    private val file = File(directory, name + ".enc")
    @Synchronized fun read(): JSONObject = if (file.exists()) JSONObject(String(cipher.open(file.readBytes()), Charsets.UTF_8)) else JSONObject()
    @Synchronized fun write(value: JSONObject) {
        directory.mkdirs(); val temp = File(directory, name + ".tmp")
        try { FileOutputStream(temp).use { it.write(cipher.seal(value.toString().toByteArray())); it.fd.sync() }; check(temp.renameTo(file)) }
        finally { temp.delete() }
    }
}

/** Writes are serialized across Activity recreation; UI threads never wait for storage. */
internal object CentralDraftWrites {
    val executor = Executors.newSingleThreadExecutor()
    fun <T> barrier(work: () -> T): T = executor.submit<T> { work() }.get()
}

