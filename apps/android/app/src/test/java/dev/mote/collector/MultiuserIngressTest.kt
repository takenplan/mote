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
        // JVM-only external HTTP adapter: Android bootclasspath has no java.net.http,
        // and JDK HttpURLConnection rejects PATCH. Product Android transport is unchanged.
        val uri = java.net.URI(server + path)
        require(uri.scheme == "http" && uri.host == "127.0.0.1")
        return java.net.Socket(uri.host, uri.port).use { socket ->
            socket.soTimeout = 15000
            val bytes = body?.toString()?.toByteArray(Charsets.UTF_8) ?: byteArrayOf()
            val headers = "$method ${uri.rawPath}${uri.rawQuery?.let { "?$it" } ?: ""} HTTP/1.1\r\nHost: ${uri.host}:${uri.port}\r\nConnection: close\r\nX-Mote-Protocol-Version: 2\r\nX-Mote-Ingress-Version: 3\r\nContent-Type: application/json\r\nAuthorization: Bearer $token\r\nContent-Length: ${bytes.size}\r\n\r\n"
            socket.getOutputStream().apply { write(headers.toByteArray(Charsets.US_ASCII)); write(bytes); flush() }
            val raw = socket.getInputStream().readBytes().toString(Charsets.UTF_8)
            val split = raw.indexOf("\r\n\r\n"); check(split > 0)
            val status = raw.substringBefore("\r\n").split(" ")[1].toInt()
            check(!raw.substring(0,split).contains("transfer-encoding: chunked",ignoreCase=true))
            status to raw.substring(split+4).takeIf { it.isNotBlank() }?.let(::JSONObject)
        }
    }

    private fun fixture(plugins: Boolean = false, test: (JSONObject) -> Unit) {
        val errors = File.createTempFile("m15-backend-", ".log")
        val process = ProcessBuilder(listOf("node", "--import", "tsx", "apps/android/test-fixtures/multiuser-backend.ts") + if (plugins) listOf("--plugins") else emptyList()).directory(root()).redirectError(errors).start()
        try {
            val line = process.inputStream.bufferedReader().readLine() ?: error(errors.readText())
            test(JSONObject(line))
        } finally { process.destroy(); if (!process.waitFor(15, java.util.concurrent.TimeUnit.SECONDS)) process.destroyForcibly(); errors.delete() }
    }
    private fun owner(server: String, token: String) = AccountBinding.self(server, request(server, token, "GET", "/api/connections/self", null).second!!)
    private fun client(server: String, token: String, owner: AccountBinding = owner(server, token), current: () -> Boolean = { true }) = Ingress3Client(owner,"same-device","Synthetic Android",{ method,path,body -> request(server,token,method,path,body) },current)
    private fun event(id: String, text: String) = JSONObject().put("id",id).put("deviceId","same-device").put("deviceName","Synthetic Android").put("platform","android").put("capturedAt","2026-01-01T00:00:00Z").put("durationMs",0).put("source","note").put("ocrText",text)

    private fun central(server: String, token: String) = CentralClient(server,token,{ method,url,body,_,_ ->
        request(server,token,method,url.removePrefix(server),body?.let { JSONObject(String(it,Charsets.UTF_8)) })
    })
    @Test fun `native Vault export starts a real owner portable task instead of the retired global bundle`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token")
        val id=UUID.randomUUID().toString();val receipt=CentralPortable(central(server,token)).start(id)
        assertEquals(id,receipt.getString("id"));assertEquals("export",receipt.getString("kind"))
        assertEquals(owner(server,token).userId,receipt.getString("userId"));assertEquals(3,receipt.getInt("version"))
    }
    @Test fun `native portable recovery list exact artifact and cancellation remain bound to the original owner`() = fixture { f ->
        val server=f.getString("address");val a=CentralPortable(central(server,f.getJSONObject("a").getString("token")))
        val b=CentralPortable(central(server,f.getJSONObject("b").getString("token")));val id=UUID.randomUUID().toString()
        a.start(id);var receipt=a.read(id);val deadline=System.currentTimeMillis()+10000
        while(receipt.getString("state")=="working") { check(System.currentTimeMillis()<deadline);Thread.sleep(10);receipt=a.read(id) }
        assertEquals("completed",receipt.getString("state"));assertEquals(id,a.start(id).getString("id"))
        assertEquals(id,a.list().getJSONArray("items").getJSONObject(0).getString("id"));assertEquals(0,b.list().getJSONArray("items").length())
        assertEquals(404,assertThrows(CentralFailure::class.java){b.read(id)}.status)
        val directory=java.nio.file.Files.createTempDirectory("m15-portable-native-").toFile()
        try {
            val output=java.io.ByteArrayOutputStream();a.save(receipt,directory) {output}
            val bytes=output.toByteArray();assertEquals(receipt.getLong("bytes"),bytes.size.toLong())
            assertEquals(receipt.getString("sha256"),Ingress3Client.hash(bytes))
            val archive=JSONObject(String(bytes,Charsets.UTF_8));assertEquals(receipt.getString("userId"),archive.getString("userId"))
            for(name in listOf("a","b","admin"))assertFalse(String(bytes,Charsets.UTF_8).contains(f.getJSONObject(name).getString("token")))
            assertEquals(0,directory.listFiles()!!.size)
            for((field,value) in listOf("userId" to f.getJSONObject("b").getString("userId"),"deploymentId" to "other-deployment","filename" to "wrong.json","sha256" to "wrong")) {
                val corrupt=JSONObject(receipt.toString()).put(field,value);val untouched=java.io.ByteArrayOutputStream()
                assertThrows(IllegalArgumentException::class.java){a.save(corrupt,directory) {untouched}};assertEquals(0,untouched.size())
            }
            assertEquals("cancelled",a.control(id,"cancel").getString("state"));val untouched=java.io.ByteArrayOutputStream()
            assertThrows(IllegalArgumentException::class.java){a.save(receipt,directory) {untouched}};assertEquals(0,untouched.size())
        } finally { directory.deleteRecursively() }
    }
    @Test fun `actual native plugin inventory consumes owned M09 rather than legacy host aggregate`() = fixture { f ->
        val token=f.getJSONObject("a").getString("token");val control=PluginControlClient(central(f.getString("address"),token))
        val inventory=control.inventory()
        assertTrue(inventory.packages.isEmpty());assertTrue(inventory.instances.isEmpty());assertTrue(inventory.catalog.isEmpty())
        assertFalse(inventory.installation.getBoolean("supported"))
    }
    @Test fun `actual native owned plugin edit check CAS and memory preparation use original public commands`() = fixture(true) { f ->
        val server=f.getString("address");val a=PluginControlClient(central(server,f.getJSONObject("a").getString("token")));val b=PluginControlClient(central(server,f.getJSONObject("b").getString("token")))
        val grants=JSONObject().put("capabilities",JSONArray().put("processor")).put("sourceIds",JSONArray()).put("history",false)
        for ((control,label) in listOf(a to "A",b to "B")) {
            val before=control.inventory();val pkg=before.packages.single();assertTrue(pkg.fields.any {it.id=="credential"})
            val create=PluginControlClient.configureOwned(pkg.id,null,before.revision,label,JSONObject().put("label",label).put("credential","personal:$label"),grants)
            val body=create.payload();body.getJSONObject("instance").put("id","same-native-instance");control.execute(create.copy(body=body.toString()))
        }
        val original=a.inventory();val instance=original.instances.single();assertTrue(instance.secretStatus.getBoolean("credential"));assertFalse(instance.configuration.has("credential"))
        val edit=PluginControlClient.configureOwned(instance.packageId,instance.definition,original.revision,"A edited",JSONObject().put("label","A edited"),grants)
        a.execute(edit);assertTrue(a.inventory().instances.single().secretStatus.getBoolean("credential"));assertEquals("B",b.inventory().instances.single().name)
        assertEquals(409,assertThrows(CentralFailure::class.java){a.execute(edit)}.status)
        a.execute(PluginControlClient.ownedInstanceAction(instance.id,"check",a.inventory().revision));assertTrue(a.inventory().instances.single().checked);assertFalse(b.inventory().instances.single().checked)
        a.execute(PluginControlClient.ownedInstanceAction(instance.id,"enable",a.inventory().revision));assertTrue(a.inventory().instances.single().desired)
        a.execute(PluginControlClient.ownedInstanceAction(instance.id,"disable",a.inventory().revision));assertFalse(a.inventory().instances.single().desired)
        val memory=a.memory();a.execute(PluginControlClient.memoryControl("pause",memory.getLong("revision")));assertFalse(a.memory().getBoolean("desired"))
        val preparation=a.execute(PluginControlClient.prepareBinding(null));val id=preparation.getString("id");assertEquals(id,a.memory().getString("bindingPreparation"));assertFalse(b.memory().has("bindingPreparation"))
        a.preparation(id);assertEquals(404,assertThrows(CentralFailure::class.java){b.preparation(id)}.status)
        a.execute(PluginControlClient.bindingControl(id,"cancel",a.memory().getLong("revision")));assertFalse(a.memory().has("bindingPreparation"))
    }
    @Test fun `actual native note and original attachment use scoped ingress instead of retired routes`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token");val api=central(server,token)
        val note=JSONObject().put("id",UUID.randomUUID().toString()).put("deviceId","native-phone").put("deviceName","Synthetic native")
            .put("platform","android").put("capturedAt","2026-01-01T00:00:00Z").put("text","Synthetic native note bytes").put("mood","calm")
        CentralNotes.send(api,note)
        val saved=request(server,token,"GET","/api/captures/"+note.getString("id"),null)
        assertEquals(200,saved.first);assertEquals(note.getString("text"),saved.second!!.getString("ocrText"))
        assertEquals(404,request(server,f.getJSONObject("b").getString("token"),"GET","/api/captures/"+note.getString("id"),null).first)
        val file=File.createTempFile("m15-native-attachment-",".png").apply { writeBytes(ByteArray(4*1024*1024+7){(it%251).toByte()}) }
        try {
            val captured=CentralAttachments.upload(api,file,"Synthetic.png","image/png","native-phone",{1000L})
            val result=request(server,token,"GET","/api/captures/$captured",null);assertEquals(200,result.first)
            assertEquals(404,request(server,f.getJSONObject("b").getString("token"),"GET","/api/captures/$captured",null).first)
        } finally {file.delete()}
    }
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

    @Test fun `same real loopback URL with replacement deployment rejects old owner before any private bytes`() {
        val processes=mutableListOf<Process>();val logs=mutableListOf<File>()
        fun start(port:Int):JSONObject {
            val log=File.createTempFile("m15-redeployment-", ".log");logs.add(log)
            val process=ProcessBuilder("node","--import","tsx","apps/android/test-fixtures/multiuser-backend.ts","--port=$port").directory(root()).redirectError(log).start();processes.add(process)
            return JSONObject(process.inputStream.bufferedReader().readLine()?:error(log.readText()))
        }
        try {
            val first=start(0);val url=first.getString("address");val original=owner(url,first.getJSONObject("a").getString("token"))
            processes[0].destroy();assertTrue(processes[0].waitFor(15,java.util.concurrent.TimeUnit.SECONDS))
            val second=start(java.net.URI(url).port);assertEquals(url,second.getString("address"));val token=second.getJSONObject("a").getString("token");val replacement=owner(url,token)
            assertNotEquals(original.deploymentId,replacement.deploymentId);assertNotEquals(original.key,replacement.key)
            val calls=mutableListOf<String>();val old=Ingress3Client(original,"same-device","Synthetic redeployment",request={method,path,body->calls.add(method+" "+path);request(url,token,method,path,body)})
            val record=event(UUID.randomUUID().toString(),"Synthetic original A deployment bytes")
            assertThrows(IllegalStateException::class.java){old.captures(listOf(record))};assertEquals(listOf("GET /api/connections/self"),calls)
            assertEquals(404,request(url,token,"GET","/api/captures/"+record.getString("id"),null).first)
            val receipt=client(url,token).captures(listOf(record));assertEquals(replacement.deploymentId,receipt.getString("deploymentId"));assertEquals(replacement.userId,receipt.getString("userId"))
        } finally {for(process in processes)if(process.isAlive){process.destroy();if(!process.waitFor(15,java.util.concurrent.TimeUnit.SECONDS))process.destroyForcibly()};logs.forEach {it.delete()}}
    }

    @Test fun `native query citations use actual scoped read and cannot fall back to raw owner history`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token");val id=UUID.randomUUID().toString()
        val receipt=client(server,token).captures(listOf(event(id,"Synthetic native query original")))
        val api=central(server,token)
        // The real organizer may publish before the first read. A settled note
        // must use its declared canonical evidence, never a raw UUID fallback.
        val deadline=System.currentTimeMillis()+8000;var material:JSONObject?=null
        while(material==null&&System.currentTimeMillis()<deadline) {
            val rows=api.get("/api/materials").getJSONArray("items")
            material=(0 until rows.length()).map(rows::getJSONObject).firstOrNull {it.getJSONObject("origin").getString("externalId")==id&&it.getJSONObject("origin").getString("sourceId")==receipt.getString("sourceId")}
            if(material==null)Thread.sleep(20)
        }
        assertNotNull("Real capture organizer must publish before exercising settled evidence",material)
        val expanded=api.get("/api/agent-view/material-read?ref="+java.net.URLEncoder.encode(material!!.getString("ref"),"UTF-8"))
        val reference=expanded.getJSONArray("originalRefs").getString(0)
        assertNotEquals("capture:$id",reference)
        assertEquals(404,assertThrows(CentralFailure::class.java) {CentralEvidenceReference.readQuery(api,"capture:$id",0)}.status)
        val response=CentralEvidenceReference.readQuery(api,reference,0)
        assertEquals("Synthetic native query original",response.getJSONArray("items").getJSONObject(0).getString("text"))
        assertEquals(200,request(server,token,"PATCH","/api/sources/"+receipt.getString("sourceId"),JSONObject().put("enabled",false)).first)
        assertEquals(200,request(server,token,"GET","/api/captures/$id",null).first)
        assertEquals(404,assertThrows(CentralFailure::class.java) {CentralEvidenceReference.readQuery(api,reference,0)}.status)
        assertEquals(404,assertThrows(CentralFailure::class.java) {CentralEvidenceReference.readQuery(central(server,f.getJSONObject("b").getString("token")),reference,0)}.status)
    }

    @Test fun `actual image capture rejects corrupt original reference mime and retention despite a complete owner receipt`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token");val binding=owner(server,token)
        val image=event(UUID.randomUUID().toString(),"Synthetic image fixture").put("source","screen").put("imageMime","image/png").put("imageBase64","iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=")
        client(server,token).captures(listOf(image))
        for((key,value) in listOf("ref" to "original:"+"0".repeat(64),"mime" to "image/jpeg","retention" to "archive")) {
            val corrupt=Ingress3Client(binding,"same-device","Synthetic Android",{method,path,body->
                val (code,result)=request(server,token,method,path,body)
                if(path.endsWith("/captures")&&code==200)result!!.getJSONArray("captures").getJSONObject(0).getJSONObject("original").put(key,value)
                code to result
            })
            assertThrows(IllegalStateException::class.java) {corrupt.captures(listOf(image))}
        }
    }

    @Test fun `real file spool commits original bytes and only complete v3 ACK clears its journal`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token");val client=client(server,token)
        val directory=kotlin.io.path.createTempDirectory("m15-file-spool-").toFile()
        try {
            val bytes="Generated preserved original\n尾部".toByteArray();val source=LocalSource(id="same-source",name="Synthetic file",kind="local-files",uri="content://generated/file",retention="archive",syncContinuously=false)
            val queue=FileArchiveQueue(directory,LocalContentCipher());queue.configure(source)
            val candidate=JSONObject().put("externalId","content://generated/原件.txt").put("observedAt","2026-01-01T00:00:00Z").put("title","fixture.txt").put("kind","file").put("layer","original").put("text","").put("mimeType","text/plain")
            val generation=queue.configure(source).getString("generation");queue.observe(source,candidate,generation);queue.finish(source,generation){false}
            val row=queue.prepare(source,{ByteArrayInputStream(bytes)},{true},captureImmediately=true)!!;val manifest=row.getJSONObject("pending").getJSONObject("manifest")
            client.register(source.registration("same-device"));val (_,begun)=client.begin(source.id,manifest);client.part(begun.getString("id"),0,queue.part(source.id,0))
            val ack=client.commit(source.id,begun.getString("id"),manifest)
            val reopened=FileArchiveQueue(directory,LocalContentCipher());assertEquals(1,reopened.pendingCount(source.id))
            assertThrows(IllegalStateException::class.java){reopened.acknowledge(source.id,row,JSONObject(ack.toString()).put("userId",f.getJSONObject("b").getString("userId")),client.binding)}
            for ((key,value) in listOf("ref" to "original:"+"0".repeat(64),"mime" to "image/jpeg","retention" to "snapshot")) {
                val wrong=JSONObject(ack.toString());wrong.getJSONArray("captures").getJSONObject(0).getJSONObject("original").put(key,value)
                assertThrows(IllegalStateException::class.java) {reopened.acknowledge(source.id,row,wrong,client.binding)}
                assertEquals(1,reopened.pendingCount(source.id))
            }
            assertEquals(1,reopened.pendingCount(source.id));reopened.acknowledge(source.id,row,ack,client.binding);assertEquals(0,reopened.pendingCount(source.id))
            val original=ack.getJSONArray("captures").getJSONObject(0).getJSONObject("original");assertEquals(Ingress3Client.hash(bytes),original.getString("hash"));assertEquals(bytes.size.toLong(),original.getLong("bytes"))
        } finally {directory.deleteRecursively()}
    }
    @Test fun `actual capture conflict settles good records and isolates only the rejected id under its owner`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token");val api=client(server,token)
        val conflict=event(UUID.randomUUID().toString(),"Central immutable bytes").put("privacy",JSONObject().put("excluded",false))
        api.captures(listOf(conflict))
        val records=listOf(event(UUID.randomUUID().toString(),"Generated before conflict"),JSONObject(conflict.toString()).put("ocrText","Different local bytes"),event(UUID.randomUUID().toString(),"Generated after conflict"))
        val directory=kotlin.io.path.createTempDirectory("android-parity-outbox-").toFile()
        val cipher=object:ByteCipher {override fun seal(value:ByteArray)=value;override fun open(value:ByteArray)=value}
        try {
            val queue=DurableQueue(directory,cipher)
            records.forEach {queue.enqueue(it.put("privacy",JSONObject().put("excluded",false)),null,1024*1024)}
            val settled=mutableListOf<Pair<String,Int>>()
            api.settleCaptures(queue.peekBatch()) {record,status->
                val id=record.getString("id");settled.add(id to status)
                when(status) {200->queue.acknowledge(id,0,0);409->queue.uploadConflict(id);410->queue.archiveMissing(id)}
            }
            assertEquals(records.map {it.getString("id")}.toSet(),settled.map {it.first}.toSet())
            assertEquals(listOf(200,409,200),records.map {record->settled.single {it.first==record.getString("id")}.second})
            assertEquals(0,DurableQueue(directory,cipher).peekBatch().size)
            assertEquals(1,queue.syncIssues().size)
            for(record in records) assertEquals(404,request(server,f.getJSONObject("b").getString("token"),"GET","/api/captures/"+record.getString("id"),null).first)
            assertEquals("Central immutable bytes",request(server,token,"GET","/api/captures/"+conflict.getString("id"),null).second!!.getString("ocrText"))
        } finally {directory.deleteRecursively()}
    }
    @Test fun `actual narrow source registration preserves central pause and exposes typed outcome`() = fixture { f ->
        val server=f.getString("address");val token=f.getJSONObject("a").getString("token");val api=client(server,token)
        val source=LocalSource(id="generated-paused-source",name="Generated source",kind="local-files",uri="content://generated/source",retention="archive",syncContinuously=false)
        api.register(source.registration("same-device"))
        assertEquals(200,request(server,token,"PATCH","/api/sources/${source.id}",JSONObject().put("enabled",false)).first)
        assertTrue(api.sourcePaused(source))
        val paused=assertThrows(FileIngressRejection::class.java){api.register(source.registration("same-device"))}
        assertEquals(409,paused.httpStatus);assertTrue(paused.paused)
        assertFalse(request(server,token,"GET","/api/sources/${source.id}",null).second!!.getBoolean("enabled"))
        assertEquals(404,request(server,f.getJSONObject("b").getString("token"),"GET","/api/sources/${source.id}",null).first)
    }

}
