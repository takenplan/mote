package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.io.ByteArrayInputStream

class MultiuserIngressTest {
    private fun root(): File = generateSequence(File(System.getProperty("user.dir")!!)) { it.parentFile }.first { File(it, "package.json").isFile && File(it, "apps/server").isDirectory }
    private fun request(server: String, token: String, method: String, path: String, body: JSONObject?): Pair<Int, JSONObject?> {
        java.net.http.HttpClient.newBuilder().followRedirects(java.net.http.HttpClient.Redirect.NEVER).build().use { http ->
            val payload = if (body == null) java.net.http.HttpRequest.BodyPublishers.noBody() else java.net.http.HttpRequest.BodyPublishers.ofString(body.toString())
            val request = java.net.http.HttpRequest.newBuilder(java.net.URI(server + path)).header("X-Mote-Protocol-Version", "2").header("X-Mote-Ingress-Version", "3").header("Content-Type", "application/json").header("Authorization", "Bearer $token").method(method, payload).build()
            val response = http.send(request,java.net.http.HttpResponse.BodyHandlers.ofString())
            return response.statusCode() to response.body().takeIf { it.isNotBlank() }?.let(::JSONObject)
        }
    }
    private fun fixture(test: (JSONObject) -> Unit) {
        val errors = File.createTempFile("m15-backend-", ".log")
        val process = ProcessBuilder("node", "--import", "tsx", "apps/android/test-fixtures/multiuser-backend.ts").directory(root()).redirectError(errors).start()
        try {
            val line = process.inputStream.bufferedReader().readLine() ?: error(errors.readText())
            test(JSONObject(line))
        } finally { process.destroy(); if (!process.waitFor(15, java.util.concurrent.TimeUnit.SECONDS)) process.destroyForcibly(); errors.delete() }
    }
    private fun owner(server: String, token: String) = AccountBinding.self(server, request(server, token, "GET", "/api/connections/self", null).second!!)
    private fun client(server: String, token: String, owner: AccountBinding = owner(server, token), current: () -> Boolean = { true }) = Ingress3Client(owner,"same-device","Synthetic Android",{ method,path,body -> request(server,token,method,path,body) },current)
    private fun event(id: String, text: String) = JSONObject().put("id",id).put("deviceId","same-device").put("deviceName","Synthetic Android").put("platform","android").put("capturedAt","2026-01-01T00:00:00Z").put("durationMs",0).put("source","note").put("ocrText",text)

    @Test fun `real Kotlin adapter sends same IDs under A and B and validates complete owner receipts`() = fixture { f ->
        val server=f.getString("address");val a=f.getJSONObject("a");val b=f.getJSONObject("b");val token=a.getString("token");val at=owner(server,token);val bt=owner(server,b.getString("token"));assertNotEquals(at,bt)
        val id=UUID.randomUUID().toString();val record=event(id,"Synthetic shared bytes")
        val ar=client(server,token).captures(listOf(record));val br=client(server,b.getString("token")).captures(listOf(record))
        assertEquals(at.userId,ar.getString("userId"));assertEquals(bt.userId,br.getString("userId"));assertNotEquals(ar.getString("id"),br.getString("id"))
        assertEquals(ar.toString(),client(server,token).captures(listOf(record)).toString())
        val source=ar.getString("sourceId");val batch=ar.getString("batchId")
        for (bad in listOf(JSONObject(ar.toString()).put("userId",bt.userId),JSONObject(ar.toString()).put("deploymentId","another-deployment"),JSONObject(ar.toString()).put("captures",JSONArray()),JSONObject(ar.toString()).put("version",2))) {
            assertThrows(IllegalStateException::class.java) { Ingress3Receipt.require(at,source,batch,listOf(id),bad) }
        }
        assertThrows(IllegalStateException::class.java) { client(server,b.getString("token"),at).captures(listOf(event(UUID.randomUUID().toString(),"Must not send A"))) }
        val revoked=request(server,token,"POST","/api/auth/logout",JSONObject());assertEquals(200,revoked.first)
        assertThrows(FileTransportFailure::class.java) { client(server,token,at).captures(listOf(record)) }
        assertEquals(200,request(server,b.getString("token"),"GET","/api/captures/$id",null).first)
    }

    @Test fun `rotation preserves stable account and disable rejects before private upload while B remains usable`() = fixture { f ->
        val server=f.getString("address"); val a=f.getJSONObject("a"); val b=f.getJSONObject("b"); val original=owner(server,a.getString("token"))
        val rotated=request(server,"","POST","/api/auth/login",JSONObject().put("username","generated-a").put("password",f.getString("password")).put("mode","client"))
        assertEquals(200,rotated.first);val token=rotated.second!!.getString("token");assertNotEquals(token,a.getString("token"));assertEquals(original,owner(server,token));assertEquals(original.key,owner(server,token).key)
        val record=event(UUID.randomUUID().toString(),"Generated rotated ownership")
        assertEquals(original.userId,client(server,token).captures(listOf(record)).getString("userId"))
        assertEquals(200,request(server,f.getJSONObject("admin").getString("token"),"PATCH","/api/admin/accounts/"+a.getString("userId"),JSONObject().put("disabled",true)).first)
        assertThrows(FileTransportFailure::class.java) { client(server,token,original).captures(listOf(event(UUID.randomUUID().toString(),"Never send after disable"))) }
        val bob=client(server,b.getString("token"));assertEquals(b.getString("userId"),bob.captures(listOf(record)).getString("userId"))
        assertThrows(IllegalArgumentException::class.java) { AccountBinding("https://example.test/path",original.deploymentId,original.userId) }
        assertEquals("https://example.test",AccountBinding.normalize("HTTPS://EXAMPLE.TEST:443/"))
        assertNotEquals(original.key,original.copy(deploymentId="same-url-new-deployment").key)
        assertNotEquals(original.key,original.copy(userId=b.getString("userId")).key)
    }

    @Test fun `real file spool commits original bytes and only complete v3 ACK clears its journal`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token");val client=client(server,token)
        val directory=kotlin.io.path.createTempDirectory("m15-file-spool-").toFile()
        try {
            val bytes="Generated preserved original\n尾部".toByteArray();val source=LocalSource(id="same-source",name="Synthetic file",kind="local-files",uri="content://generated/file",retention="archive",syncContinuously=false)
            val queue=FileArchiveQueue(directory,LocalContentCipher());queue.configure(source)
            val candidate=JSONObject().put("externalId","same-external").put("observedAt","2026-01-01T00:00:00Z").put("title","fixture.txt").put("kind","file").put("layer","original").put("text","").put("mimeType","text/plain")
            val generation=queue.configure(source).getString("generation");queue.observe(source,candidate,generation);queue.finish(source,generation){false}
            val row=queue.prepare(source,{ByteArrayInputStream(bytes)},{true},captureImmediately=true)!!;val manifest=row.getJSONObject("pending").getJSONObject("manifest")
            client.register(source.registration("same-device"));val (_,begun)=client.begin(source.id,manifest);client.part(begun.getString("id"),0,queue.part(source.id,0))
            val ack=client.commit(source.id,begun.getString("id"),manifest)
            val reopened=FileArchiveQueue(directory,LocalContentCipher());assertEquals(1,reopened.pendingCount(source.id))
            assertThrows(IllegalStateException::class.java){reopened.acknowledge(source.id,row,JSONObject(ack.toString()).put("userId",f.getJSONObject("b").getString("userId")),client.binding)}
            assertEquals(1,reopened.pendingCount(source.id));reopened.acknowledge(source.id,row,ack,client.binding);assertEquals(0,reopened.pendingCount(source.id))
            val original=ack.getJSONArray("captures").getJSONObject(0).getJSONObject("original");assertEquals(Ingress3Client.hash(bytes),original.getString("hash"));assertEquals(bytes.size.toLong(),original.getLong("bytes"))
        } finally {directory.deleteRecursively()}
    }
}
