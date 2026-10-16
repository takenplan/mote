package dev.mote.collector

import org.junit.Assert.*
import org.junit.Test
import java.net.ServerSocket
import java.nio.file.Files
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class CentralPortableDownloadTest {
    @Test fun `whole generic download rejects a partial response before opening the chosen document`() = incompleteGeneric("partial")
    @Test fun `whole generic download rejects declared bytes missing at EOF before opening the chosen document`() = incompleteGeneric("length")
    private fun incompleteGeneric(case: String) {
        val directory=Files.createTempDirectory("m15-generic-download-").toFile();val bytes="Generated support metadata".toByteArray()
        val executor=Executors.newSingleThreadExecutor()
        ServerSocket(0,1,java.net.InetAddress.getLoopbackAddress()).use { listener ->
            val response=executor.submit {
                listener.accept().use { socket ->
                    socket.soTimeout=5000;val input=socket.getInputStream().bufferedReader();while(input.readLine().isNotEmpty()) Unit
                    val status=if(case=="partial")"206 Partial Content" else "200 OK";val length=bytes.size+if(case=="length")1 else 0
                    socket.getOutputStream().apply {write("HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: $length\r\nConnection: close\r\n\r\n".toByteArray());write(bytes);flush()}
                }
            }
            val output=java.io.File(directory,"selected.json").apply {writeText("Generated existing document sentinel")};var opened=0
            val api=CentralClient("http://127.0.0.1:${listener.localPort}","synthetic-support-token")
            try {
                val failure=runCatching {api.downloadStaged("/api/support-bundle",{opened++;output.outputStream()},directory)}.exceptionOrNull()
                assertEquals("Generated existing document sentinel",output.readText());assertEquals(0,opened);assertNotNull(failure);assertEquals(listOf("selected.json"),directory.listFiles()!!.map {it.name});response.get(5,TimeUnit.SECONDS)
            } finally {executor.shutdownNow();directory.deleteRecursively()}
        }
    }
    @Test fun `download publishes only exact receipt bytes and removes all staging`() {
        val bytes="Synthetic private export 中文".toByteArray(Charsets.UTF_8)
        val sha=Ingress3Client.hash(bytes)
        for(case in listOf("good","hash","mime","etag","length","retired")) {
            val directory=Files.createTempDirectory("m15-export-download-").toFile()
            val executor=Executors.newSingleThreadExecutor()
            ServerSocket(0,1,java.net.InetAddress.getLoopbackAddress()).use { listener ->
                val response=executor.submit {
                    listener.accept().use { socket ->
                        socket.soTimeout=5000
                        val input=socket.getInputStream().bufferedReader()
                        while(input.readLine().isNotEmpty()) Unit
                        val actual=if(case=="hash")bytes.copyOf().apply { this[0]=(this[0]+1).toByte() } else bytes
                        val mime=if(case=="mime")"application/octet-stream" else "application/json; charset=utf-8"
                        val etag=if(case=="etag")"0".repeat(64) else sha
                        val length=if(case=="length")actual.size+1 else actual.size
                        socket.getOutputStream().apply {
                            write("HTTP/1.1 200 OK\r\nContent-Type: $mime\r\nContent-Length: $length\r\nETag: \"$etag\"\r\nConnection: close\r\n\r\n".toByteArray())
                            write(actual);flush()
                        }
                    }
                }
                var active=true;var verifies=0
                val api=CentralClient("http://127.0.0.1:${listener.localPort}","synthetic-export-token",active={active},verify={verifies++;if(case=="retired"&&verifies==2)active=false})
                val output=java.io.File(directory,"selected.json").apply {writeText("Generated existing document sentinel")}
                var opened=0
                try {
                    val run={api.downloadVerified("/api/portable/exports/generated/content",{opened++;output.outputStream()},CentralDownload(bytes.size.toLong(),sha,"application/json; charset=utf-8"),directory)}
                    if(case=="good") {run();assertArrayEquals(bytes,output.readBytes());assertEquals(1,opened)}
                    else {assertThrows(Exception::class.java,run);assertEquals("Generated existing document sentinel",output.readText());assertEquals(0,opened)}
                    assertEquals(listOf("selected.json"),directory.listFiles()!!.map {it.name});response.get(5,TimeUnit.SECONDS)
                } finally {executor.shutdownNow();directory.deleteRecursively()}
            }
        }
    }
}
