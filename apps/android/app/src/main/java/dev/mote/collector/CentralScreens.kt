package dev.mote.collector

import android.net.Uri
import android.provider.OpenableColumns
import android.text.Editable
import android.text.InputFilter
import android.text.TextWatcher
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
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

internal class CentralScreens(val ui: CentralContent, val body: LinearLayout, private val directory: File) {
    private val ownerKey = ui.accountOwnerKey()
    fun ownsSelectedAccount() = ui.accountOwnerKey() == ownerKey
    val client get() = requireNotNull(ui.client).also { check(ownsSelectedAccount()) { MoteI18n.text("登录会话已变更，请重新打开中央页面。") } }
    private val cipher = SecretBox()
    private val askStore = CentralStateFile(directory, "ask", cipher)
    private val noteStore = CentralNoteStore(directory, cipher)
    private val importStore = CentralImports(File(directory, "import-pending"), cipher)
    private val portableImportStore = CentralImports(File(directory, "portable-import-pending"), cipher)
    private val attachmentStore = CentralStateFile(directory, "attachment-times", cipher)
    private val insightStore = CentralStateFile(directory, "insight-request", cipher)
    private val memoryCorrectionStore = CentralStateFile(directory, "memory-correction", cipher)
    private val memoryAdmissionStore = CentralStateFile(directory, "memory-admission", cipher)
    private val fileRetries = CentralStateFile(directory, "file-retries", cipher)
    fun pendingFileRetry(id: String): JSONObject? = CentralDraftWrites.barrier {
        fileRetries.read().optJSONObject(id)?.also { check(it.getString("ownerKey") == ownerKey) }
    }
    fun submitFileRetry(api: CentralClient, id: String, originalRef: String, request: JSONObject): JSONObject {
        check(ownsSelectedAccount() && ui.client === api)
        UUID.fromString(id); require(Regex("original:[a-f0-9]{64}").matches(originalRef))
        require(request.getString("stage") in setOf("transcribe", "diarize", "summary") && !request.has("operationId"))
        val intent = CentralDraftWrites.barrier {
            val all = fileRetries.read(); val previous = all.optJSONObject(id)
            if (previous != null) {
                val body = JSONObject(previous.getJSONObject("body").toString()).apply { remove("operationId") }
                check(previous.getString("ownerKey") == ownerKey && previous.getString("originalRef") == originalRef && SourceRules.canonical(body) == SourceRules.canonical(request)) { MoteI18n.text("请求结果尚未确认，请重试同一请求。") }
                previous
            } else JSONObject().put("ownerKey", ownerKey).put("originalRef", originalRef)
                .put("body", JSONObject(request.toString()).put("operationId", UUID.randomUUID().toString())).also { all.put(id, it); fileRetries.write(all) }
        }
        return sendFileRetry(api, id, intent)
    }
    fun retryFileAdmission(api: CentralClient, id: String) = sendFileRetry(api, id, requireNotNull(pendingFileRetry(id)))
    private fun sendFileRetry(api: CentralClient, id: String, intent: JSONObject): JSONObject {
        check(ownsSelectedAccount() && ui.client === api && intent.getString("ownerKey") == ownerKey)
        val account = AccountBinding.self(api.server, api.get("/api/connections/self")); check(account.key == ownerKey)
        val request = intent.getJSONObject("body"); val operationId = request.getString("operationId"); UUID.fromString(operationId)
        val receipt = try { api.post("/api/files/" + encode(id) + "/retry", request) }
        catch (failure: CentralFailure) {
            // These two M06 refusals occur before admission. They must allow
            // the user to wait or explicitly confirm unknown work later;
            // transport failures and unverified acknowledgements stay durable.
            if (failure.status == 409 && failure.code in setOf("external_result_unknown", "file_processing_active")) clearFileRetry(id, operationId)
            throw failure
        }
        require(receipt.getBoolean("queued") && Regex("[a-f0-9]{64}").matches(receipt.getString("taskId")))
        val task = api.get("/api/tasks/" + receipt.getString("taskId"))
        val operation = "file-retry:" + SourceRules.hash(JSONArray().put(intent.getString("originalRef")).put(operationId).toString())
        require(task.getString("id") == receipt.getString("taskId") && task.getString("operationId") == "task:" + SourceRules.hash(JSONArray().put(account.userId).put(operation).toString()))
        require(task.getString("kind") == if (request.getString("stage") == "summary") "processing.derivatives" else "processing.pipeline")
        check(ownsSelectedAccount() && ui.client === api)
        clearFileRetry(id, operationId)
        return receipt
    }
    private fun clearFileRetry(id: String, operationId: String) = CentralDraftWrites.barrier {
            val all = fileRetries.read()
            if (all.optJSONObject(id)?.getJSONObject("body")?.optString("operationId") == operationId) { all.remove(id); fileRetries.write(all) }
    }
    private val fileDeletes = CentralStateFile(directory, "file-deletes", cipher)
    fun pendingFileDeletes(): List<JSONObject> = CentralDraftWrites.barrier {
        val all = fileDeletes.read()
        all.keys().asSequence().map { id -> all.getJSONObject(id).also { check(it.getString("ownerKey") == ownerKey && it.getString("captureId") == id) } }.toList()
    }
    fun submitFileDelete(api: CentralClient, row: JSONObject): JSONObject {
        check(ownsSelectedAccount() && ui.client === api)
        val id = row.getString("captureId"); UUID.fromString(id)
        val rawGeneration = row.get("originalGeneration")
        require(rawGeneration is Number && rawGeneration.toDouble() >= 0 && rawGeneration.toDouble() < 9007199254740991.0 && rawGeneration.toDouble() == rawGeneration.toLong().toDouble())
        val generation = rawGeneration.toLong()
        val descriptor = JSONObject().put("captureId", id).put("sourceId", row.getString("sourceId"))
            .put("externalId", row.getJSONObject("item").getString("externalId")).put("originalRef", row.getString("originalRef"))
            .put("originalGeneration", generation)
        require(Regex("original:[a-f0-9]{64}").matches(descriptor.getString("originalRef")))
        val intent = CentralDraftWrites.barrier {
            check(ownsSelectedAccount() && ui.client === api)
            val all = fileDeletes.read(); val previous = all.optJSONObject(id)
            if (previous != null) {
                check(previous.getString("ownerKey") == ownerKey && SourceRules.canonical(previous.getJSONObject("descriptor")) == SourceRules.canonical(descriptor)) { MoteI18n.text("请求结果尚未确认，请重试同一请求。") }
                previous
            } else JSONObject().put("ownerKey", ownerKey).put("captureId", id).put("title", row.getJSONObject("item").optString("title"))
                .put("descriptor", descriptor).put("body", JSONObject().put("operationId", UUID.randomUUID().toString()).put("originalGeneration", generation))
                .also { all.put(id, it); fileDeletes.write(all) }
        }
        return sendFileDelete(api, intent)
    }
    fun discardFileDelete(api: CentralClient, intent: JSONObject) = CentralDraftWrites.barrier {
        // Local abandonment never rebases or cancels an admitted central action.
        api.assertActive(); check(ownsSelectedAccount() && ui.client === api && intent.getString("ownerKey") == ownerKey)
        val all = fileDeletes.read(); val id = intent.getString("captureId")
        if (all.optJSONObject(id)?.getJSONObject("body")?.optString("operationId") == intent.getJSONObject("body").getString("operationId")) {
            all.remove(id); fileDeletes.write(all)
        }
    }
    fun retryFileDelete(api: CentralClient, intent: JSONObject): JSONObject = sendFileDelete(api, intent)
    private fun sendFileDelete(api: CentralClient, intent: JSONObject): JSONObject {
        check(ownsSelectedAccount() && ui.client === api && intent.getString("ownerKey") == ownerKey)
        check(AccountBinding.self(api.server, api.get("/api/connections/self")).key == ownerKey)
        val id = intent.getString("captureId"); UUID.fromString(id)
        val request = JSONObject(intent.getJSONObject("body").toString()); val operation = request.getString("operationId"); UUID.fromString(operation)
        // Recovery uses the persisted request even when GET detail is now 404.
        // Never fetch a newer generation to rebase an unresolved deletion.
        val receipt = api.delete("/api/files/" + encode(id), request)
        val count = receipt.get("deleted"); require(count is Number && count.toDouble() >= 1 && count.toDouble() <= 9007199254740991.0 && count.toDouble() == count.toLong().toDouble())
        require(receipt.getString("cleanup") in setOf("complete", "pending"))
        val decision = receipt.getJSONObject("decision"); val descriptor = intent.getJSONObject("descriptor")
        require(decision.getString("sourceId") == descriptor.getString("sourceId") && decision.getString("externalId") == descriptor.getString("externalId"))
        UUID.fromString(decision.getString("decisionId"))
        val generation = decision.get("generation"); require(generation is Number && generation.toDouble() == (request.getLong("originalGeneration") + 1).toDouble())
        check(ownsSelectedAccount() && ui.client === api)
        CentralDraftWrites.barrier {
            check(ownsSelectedAccount() && ui.client === api)
            val all = fileDeletes.read()
            if (all.optJSONObject(id)?.getJSONObject("body")?.optString("operationId") == operation) { all.remove(id); fileDeletes.write(all) }
        }
        return receipt
    }
    fun pendingMemoryAdmission(): JSONObject? = CentralDraftWrites.barrier { memoryAdmissionStore.read().takeIf { it.has("operationId") } }
    fun discardMemoryAdmission() = CentralDraftWrites.barrier { memoryAdmissionStore.write(JSONObject()) }
    fun submitMemory(api: CentralClient, request: JSONObject): JSONObject {
        val intent = CentralDraftWrites.barrier {
            val saved = memoryAdmissionStore.read()
            if (saved.has("operationId")) {
                val prior = JSONObject(saved.toString()).apply { remove("operationId") }
                check(SourceRules.canonical(prior) == SourceRules.canonical(request)) { MoteI18n.text("请求结果尚未确认，请重试同一请求。") }
                saved
            } else JSONObject(request.toString()).put("operationId", UUID.randomUUID().toString()).also(memoryAdmissionStore::write)
        }
        return sendMemoryAdmission(api, intent)
    }
    fun retryMemoryAdmission(api: CentralClient) = sendMemoryAdmission(api, requireNotNull(pendingMemoryAdmission()))
    private fun sendMemoryAdmission(api: CentralClient, intent: JSONObject): JSONObject {
        val id = intent.getString("operationId"); UUID.fromString(id)
        val job = api.post("/api/memory/jobs", intent)
        require(job.getString("id") == id); job.getJSONObject("tasks"); job.getBoolean("current")
        CentralDraftWrites.barrier { if (memoryAdmissionStore.read().optString("operationId") == id) memoryAdmissionStore.write(JSONObject()) }
        return job
    }
    fun pendingMemoryCorrection(): JSONObject? = CentralDraftWrites.barrier { memoryCorrectionStore.read().takeIf { it.has("operationId") } }
    fun correctMemory(api: CentralClient, id: String, correction: JSONObject): JSONObject {
        val fields = JSONArray().apply { listOf("title", "statement", "uncertainty", "version", "validFrom", "validUntil").forEach { put(JSONArray().put(it).put(correction.opt(it))) } }
        val key = id + ":" + fields.toString()
        val intent = CentralDraftWrites.barrier {
            val old = memoryCorrectionStore.read()
            if (old.optString("key") == key && old.has("operationId")) old
            else JSONObject().put("key", key).put("memoryId", id).put("operationId", UUID.randomUUID().toString()).put("correction", JSONObject(correction.toString())).also(memoryCorrectionStore::write)
        }
        return sendMemoryCorrection(api, intent)
    }
    fun retryMemoryCorrection(api: CentralClient) = sendMemoryCorrection(api, requireNotNull(pendingMemoryCorrection()))
    private fun sendMemoryCorrection(api: CentralClient, intent: JSONObject): JSONObject {
        val id = intent.getString("operationId"); UUID.fromString(id)
        val job = api.post("/api/memories/" + encode(intent.getString("memoryId")) + "/correct", JSONObject().put("operationId", id).put("correction", intent.getJSONObject("correction")))
        require(job.getString("id") == id); job.getJSONObject("tasks"); job.getBoolean("current")
        CentralDraftWrites.barrier { if (memoryCorrectionStore.read().optString("operationId") == id) memoryCorrectionStore.write(JSONObject()) }
        return job
    }
    private val connectorCommands = CentralStateFile(directory, "connector-commands", cipher)
    fun connectorWork(): JSONObject = CentralDraftWrites.barrier { connectorCommands.read() }
    fun submitConnector(api: CentralClient, id: String, generation: Long, path: String, body: JSONObject): JSONObject {
        require(path in setOf("sync", "disconnect", "operations").map { "/api/connectors/" + encode(id) + "/" + it })
        val request = CentralDraftWrites.barrier {
            val all = connectorCommands.read(); val previous = all.optJSONObject(id)?.optJSONObject("pending")
            if (previous != null) {
                val prior = JSONObject(previous.getJSONObject("body").toString()).apply { remove("operationId") }
                check(previous.getString("path") == path && SourceRules.canonical(prior) == SourceRules.canonical(body)) { MoteI18n.text("请求结果尚未确认，请重试同一请求。") }
                previous
            } else JSONObject().put("path", path).put("body", JSONObject(body.toString()).put("operationId", UUID.randomUUID().toString())).also {
                all.put(id, JSONObject().put("generation", generation).put("pending", it)); connectorCommands.write(all)
            }
        }
        return sendConnector(api, id, request)
    }
    fun retryConnector(api: CentralClient, id: String) = sendConnector(api, id, requireNotNull(connectorWork().optJSONObject(id)?.optJSONObject("pending")))
    private fun sendConnector(api: CentralClient, id: String, request: JSONObject): JSONObject {
        require(request.getString("path") in setOf("sync", "disconnect", "operations").map { "/api/connectors/" + encode(id) + "/" + it })
        val operationId = request.getJSONObject("body").getString("operationId"); UUID.fromString(operationId)
        val task = api.post(request.getString("path"), request.getJSONObject("body"))
        require(Regex("[a-f0-9]{64}").matches(task.getString("id")))
        require(task.getString("state") in setOf("waiting", "running", "blocked", "succeeded", "failed", "cancelled", "stale"))
        CentralDraftWrites.barrier {
            val all = connectorCommands.read(); val entry = all.optJSONObject(id)
            if (entry?.optJSONObject("pending")?.getJSONObject("body")?.optString("operationId") == operationId) {
                entry.remove("pending"); entry.put("taskId", task.getString("id")); connectorCommands.write(all)
            }
        }
        return task
    }
    fun rememberConnectorTask(id: String, generation: Long, taskId: String) = CentralDraftWrites.barrier {
        require(Regex("[a-f0-9]{64}").matches(taskId)); val all = connectorCommands.read()
        val previous = all.optJSONObject(id); check(previous?.has("pending") != true) { MoteI18n.text("请求结果尚未确认，请重试同一请求。") }
        all.put(id, JSONObject().put("generation", generation).put("taskId", taskId)); connectorCommands.write(all)
    }
    fun clearPendingConnector(id: String) = CentralDraftWrites.barrier {
        val all = connectorCommands.read(); all.optJSONObject(id)?.remove("pending"); connectorCommands.write(all)
    }
    private val draftFailure = java.util.concurrent.atomic.AtomicReference<Throwable?>(null)
    var importInstruction = ""
    private var player: android.media.MediaPlayer? = null
    @Volatile private var audioFile: File? = null
    fun close() { player?.release(); player = null; audioFile?.delete(); audioFile = null; admin.close() }
    private var askState = JSONObject()
    private val askWriter = LatestWriter<JSONObject>(CentralDraftWrites.executor) {
        runCatching { askStore.write(it) }.onSuccess { draftFailure.set(null) }.onFailure(draftFailure::set)
    }
    private val noteWriter = LatestWriter<JSONObject>(CentralDraftWrites.executor) {
        runCatching { noteStore.edit(it.getString("text"), it.getString("mood"), it.getJSONArray("attachments")) }
            .onSuccess { draftFailure.set(null) }.onFailure(draftFailure::set)
    }
    private var currentPage = "ask"
    private var question: EditText? = null
    private var preset: Spinner? = null
    private var model: EditText? = null
    private var modelSettings = JSONObject()
    private var messages: LinearLayout? = null
    private var runStatus: TextView? = null
    private var send: Button? = null
    private var stop: Button? = null
    private var noteText: EditText? = null
    private var noteMood: EditText? = null
    private var noteDraft = JSONObject().put("text", "").put("mood", "").put("attachments", JSONArray())
    private var detailBack: (() -> Unit)? = null
    private var noteHistory = JSONObject()
    private val library = CentralLibrary(this)
    private val admin = CentralAdmin(this)
    private val activity = CentralWorkActivity(this)

    fun show(page: String) {
        currentPage = page; detailBack = null; question = null; messages = null; noteText = null; noteMood = null
        when (page) {
            "ask" -> loadAsk()
            "notes" -> loadNotes()
            "overview" -> overview()
            "activity" -> activity.show()
            "archive", "timeline", "materials", "coding", "files", "memories", "insights", "sources" -> library.show(page)
            else -> admin.show(page)
        }
    }
    fun back(): Boolean = detailBack?.let { detailBack = null; it(); true } ?: false
    fun setBack(action: () -> Unit) { ui.enterDetail(); detailBack = action; question = null; messages = null; close() }
    fun clearBack() { detailBack = null }
    fun resume() { if (currentPage in setOf("plugins", "extensions", "lark")) admin.resume() else admin.resumeConnections(); if (currentPage == "activity") ui.scheduleActivityPoll() }
    fun pollWorkActivity() { if (currentPage == "activity") activity.poll() }
    fun saveWorkState(out: android.os.Bundle) = activity.saveState(out)
    fun restoreWorkState(value: android.os.Bundle) = activity.restoreState(value)
    fun openWorkEvidence(ref: String) = library.queryEvidence(ref)
    fun clearPrivateState() { askState = JSONObject(); question = null; messages = null; noteText = null; noteMood = null; admin.clearPrivateState(); activity.clearPrivateState(); body.removeAllViews() }
    fun refresh() { ui.navigate(currentPage) }
    fun insightRequest(prompt: String): JSONObject = CentralDraftWrites.barrier {
        val saved = insightStore.read()
        if (saved.has("requestId")) saved else JSONObject().put("requestId", UUID.randomUUID().toString())
            .put("timeZone", java.time.ZoneId.systemDefault().id).apply { if (prompt.isNotBlank()) put("prompt", prompt) }
            .also(insightStore::write)
    }
    fun insightAccepted() = CentralDraftWrites.barrier { insightStore.write(JSONObject()) }
    private fun persistAsk() = askWriter.submit(JSONObject(askState.toString()))
    private fun watch(field: EditText, changed: () -> Unit) {
        field.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = changed()
            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    private fun overview() {
        ui.button(MoteI18n.text("刷新")) { refresh() }
        val target = ui.card()
        val api = client
        ui.work(MoteI18n.text("正在连接中央节点…"), {
            listOf(api.get("/api/data/statistics"), api.get("/api/ingress/devices"), CentralModels.inventory(api), api.get("/api/operations?limit=5"))
        }) { data ->
            val statistics = data[0]
            ui.text(MoteI18n.text("中央工作台"), NativeFontRole.TITLE_MOBILE, target)
            for ((key, label) in listOf("captures" to "原始采集记录", "materials" to "正式资料", "sources" to "来源与连接")) {
                ui.text(MoteI18n.text(label) + " · " + statistics.getLong(key), parent = target)
            }
            ui.text(MoteI18n.text("模型预设"), NativeFontRole.SECTION, target)
            val profiles = data[2].getJSONArray("profiles")
            if (profiles.length() == 0) ui.text(MoteI18n.text("请先配置模型服务"), parent = target)
            for (i in 0 until profiles.length()) ui.text(profiles.getJSONObject(i).getString("name"), parent = target)
            ui.text(MoteI18n.text("设备"), NativeFontRole.SECTION, target)
            val devices = data[1].optJSONArray("items") ?: JSONArray()
            for (i in 0 until devices.length()) {
                val device = devices.getJSONObject(i)
                ui.text(device.getString("name") + " · " + device.getString("platform"), parent = target)
            }
            ui.text(MoteI18n.text("处理任务"), NativeFontRole.SECTION, target)
            admin.items(data[3], target) { row -> admin.operation(row.getString("id")) }
            ui.button(MoteI18n.text("处理任务"), parent = target) { ui.navigate("activity") }
        }
        ui.button(MoteI18n.text("中央资料库")) { ui.navigate("archive") }
        ui.button(MoteI18n.text("日程建议")) {
            ui.startActivity(android.content.Intent(ui, CalendarActionsActivity::class.java))
        }
        ui.button(MoteI18n.text("Agent 视角")) { ui.navigate("agentView") }
    }

    private fun loadAsk() {
        val api = client
        ui.work(MoteI18n.text("正在读取对话…"), {
            val state = CentralDraftWrites.barrier { draftFailure.get()?.let { throw it }; askStore.read() }
            val runs = api.get("/api/query-runs").optJSONArray("items") ?: JSONArray()
            if (!state.has("runId") && !state.has("pending")) {
                val recent = (0 until runs.length()).map { runs.getJSONObject(it) }.firstOrNull { it.optString("status") == "running" }
                recent?.let { state.put("runId", it.getString("id")); if (it.has("conversationId")) state.put("conversationId", it.getString("conversationId")) }
            }
            Triple(state, api.get("/api/conversations?limit=30"), CentralModels.inventory(api))
        }) { (state, history, settings) ->
            askState = state; modelSettings = settings; buildAsk(history)
            val conversationId = askState.optString("conversationId")
            if (conversationId.isNotBlank()) loadConversation(conversationId)
            if (askState.has("runId") || askState.has("pending")) ui.scheduleAskPoll()
        }
    }
    private fun buildAsk(history: JSONObject) {
        body.removeAllViews()
        ui.text(MoteI18n.text("回答和历史对话保存在中央，离开页面后回答仍继续。"))
        ui.button(MoteI18n.text("新对话")) {
            if (askState.has("pending") || askState.optString("runStatus") == "running") { ui.notice(MoteI18n.text("请先等待当前回答完成，或停止回答。")); return@button }
            askState.remove("runId"); askState.remove("conversationId"); askState.remove("runStatus"); askState.put("question", ""); persistAsk(); refresh()
        }
        ui.button(MoteI18n.text("刷新")) { refresh() }
        messages = ui.card()
        runStatus = ui.text("", parent = messages!!)
        question = ui.field(MoteI18n.text("你的问题"), askState.optString("question"), multiline = true).apply {
            filters = arrayOf(InputFilter.LengthFilter(8000)); minLines = 4
        }
        watch(question!!) { askState.put("question", question!!.text.toString()); persistAsk() }
        val profiles = modelSettings.getJSONArray("profiles")
        val ids = listOf("") + (0 until profiles.length()).map { profiles.getJSONObject(it).getString("id") }
        val names = listOf(MoteI18n.text("跟随功能默认")) + (0 until profiles.length()).map { profiles.getJSONObject(it).getString("name") }
        ui.text(MoteI18n.text("模型预设"), NativeFontRole.SUPPORT)
        preset = Spinner(ui).apply {
            adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, names)
            setSelection(ids.indexOf(askState.optString("modelProfileId")).coerceAtLeast(0))
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                    askState.put("modelProfileId", ids[position])
                    if (CentralModels.reference(ids[position])?.optString("kind") == "shared") { askState.remove("modelOverride"); model?.setText("") }
                    persistAsk(); controlsAsk()
                }
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
        }; body.addView(preset)
        model = ui.field(MoteI18n.text("模型 ID（留空跟随预设）"), askState.optString("modelOverride")).apply { filters = arrayOf(InputFilter.LengthFilter(512)) }
        watch(model!!) { askState.put("modelOverride", model!!.text.toString()); persistAsk() }
        ui.button(MoteI18n.text("添加图片")) {
            if (askState.has("pending") || askState.optString("runStatus") == "running") return@button
            ui.pickAttachment(chat = true)
        }
        val attachments = askState.optJSONArray("attachments") ?: JSONArray()
        for (i in 0 until attachments.length()) {
            val attachment = attachments.getJSONObject(i)
            ui.button(MoteI18n.text("移除附件：{0}", attachment.optString("name"))) {
                if (askState.has("pending") || askState.optString("runStatus") == "running") return@button
                attachments.remove(i); askState.put("attachments", attachments); persistAsk(); refresh()
            }
        }
        send = ui.button(MoteI18n.text("发送"), true) { submitAsk() }
        stop = ui.button(MoteI18n.text("停止回答")) {
            val id = askState.optString("runId"); if (id.isBlank()) return@button
            val api = client
            ui.work(MoteI18n.text("正在停止回答…"), { api.post("/api/query-runs/" + encode(id) + "/cancel") }) { run -> receiveRun(run) }
        }
        controlsAsk()
        ui.text(MoteI18n.text("对话历史"), NativeFontRole.SECTION)
        val items = history.optJSONArray("items") ?: JSONArray()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            ui.button(item.optString("title") + "\n" + item.optString("updatedAt")) {
                if (askState.has("pending") || askState.optString("runStatus") == "running") { ui.notice(MoteI18n.text("请先等待当前回答完成，或停止回答。")); return@button }
                askState.put("conversationId", item.getString("id")); askState.remove("runId"); persistAsk(); loadConversation(item.getString("id"))
            }
        }
        next(history)?.let { cursor ->
            ui.button(MoteI18n.text("加载更早的对话")) {
                val api = client
                ui.work(MoteI18n.text("正在读取对话…"), { api.get("/api/conversations?limit=30&cursor=" + encode(cursor)) }) { buildAsk(it) }
            }
        }
    }
    private fun controlsAsk() {
        val busy = askState.has("pending") || askState.optString("runStatus") == "running"
        question?.isEnabled = !busy
        preset?.isEnabled = !busy; model?.isEnabled = !busy && CentralModels.reference(askState.optString("modelProfileId"))?.optString("kind") != "shared"
        send?.isEnabled = !busy || askState.has("pending")
        send?.text = if (askState.has("pending")) MoteI18n.text("重试同一请求") else MoteI18n.text("发送")
        stop?.visibility = if (askState.optString("runStatus") == "running") android.view.View.VISIBLE else android.view.View.GONE
    }
    private fun submitAsk() {
        val api = client
        val request = askState.optJSONObject("pending") ?: run {
            val text = question?.text?.toString()?.trim().orEmpty()
            if (text.isBlank()) { ui.notice(MoteI18n.text("请输入问题（最多 8000 字）")); return }
            val input = JSONObject().put("question", text).put("timeZone", java.time.ZoneId.systemDefault().id)
            CentralModels.reference(askState.optString("modelProfileId"))?.let { input.put("modelReference", it) }
            askState.optString("modelOverride").trim().takeIf { it.isNotBlank() }?.let { input.put("modelOverride", it) }
            askState.optString("conversationId").takeIf { it.isNotBlank() }?.let { input.put("conversationId", it) }
            val attachments = askState.optJSONArray("attachments") ?: JSONArray()
            if (attachments.length() > 0) input.put("attachmentIds", JSONArray((0 until attachments.length()).map { attachments.getJSONObject(it).getString("id") }))
            JSONObject().put("id", UUID.randomUUID().toString()).put("input", input)
        }
        askState.put("pending", request); persistAsk(); controlsAsk()
        val snapshot = JSONObject(askState.toString())
        ui.work(MoteI18n.text("正在发送问题…"), {
            CentralDraftWrites.barrier { askStore.write(snapshot); draftFailure.set(null) }
            // Retrying preserves the admission ID even when the first response was lost.
            api.post("/api/query-runs", request)
        }) { run -> askState.remove("pending"); receiveRun(run) }
    }
    fun pollAsk() {
        if (currentPage != "ask" || detailBack != null) return
        // Returning to a tab must not replay a completed run and clear the next unsent draft.
        if (!askState.has("pending") && askState.optString("runStatus") in setOf("completed", "cancelled", "failed")) return
        val id = askState.optString("runId").ifBlank { askState.optJSONObject("pending")?.optString("id").orEmpty() }
        if (id.isBlank()) return
        val api = client
        ui.work(MoteI18n.text("正在读取回答进度…"), {
            try { api.get("/api/query-runs/" + encode(id)) } catch (error: CentralFailure) {
                if (error.status == 404) JSONObject().put("id", id).put("status", "missing") else throw error
            }
        }) { run ->
            if (run.optString("status") == "missing") {
                if (askState.has("pending")) { controlsAsk(); ui.notice(MoteI18n.text("请求尚未确认，可重试同一请求。")) }
                else { askState.remove("runId"); askState.remove("runStatus"); persistAsk(); controlsAsk(); ui.notice(MoteI18n.text("对话或运行记录已删除。")) }
            } else { askState.remove("pending"); receiveRun(run) }
        }
    }
    private fun receiveRun(run: JSONObject) {
        askState.put("runId", run.getString("id")).put("runStatus", run.getString("status"))
        run.optString("conversationId").takeIf { it.isNotBlank() }?.let { askState.put("conversationId", it) }
        val events = run.optJSONArray("events") ?: JSONArray()
        val latest = if (events.length() > 0) events.getJSONObject(events.length() - 1).optString("message") else ""
        runStatus?.text = when (run.getString("status")) {
            "running" -> latest.ifBlank { MoteI18n.text("中央节点正在回答…") }
            "completed" -> MoteI18n.text("回答已完成")
            "cancelled" -> MoteI18n.text("已停止回答")
            else -> run.optJSONObject("error")?.optString("message") ?: MoteI18n.text("回答未完成")
        }
        if (run.getString("status") == "completed") { askState.put("question", "").put("attachments", JSONArray()); question?.setText("") }
        persistAsk(); controlsAsk()
        if (run.getString("status") == "running") ui.scheduleAskPoll()
        else askState.optString("conversationId").takeIf { it.isNotBlank() }?.let { loadConversation(it) }
    }
    private fun loadConversation(id: String, cursor: String? = null) {
        val api = client
        ui.work(MoteI18n.text("正在读取对话…"), { api.get("/api/conversations/" + encode(id) + "?limit=20" + (cursor?.let { "&cursor=" + encode(it) } ?: "")) }) { conversation ->
            val target = messages ?: return@work
            target.removeAllViews(); runStatus = ui.text("", parent = target)
            val turns = conversation.getJSONArray("turns")
            for (i in 0 until turns.length()) {
                val turn = turns.getJSONObject(i)
                ui.text(turn.getString("question"), NativeFontRole.SECTION, target)
                turn.optJSONObject("result")?.let { answer ->
                    ui.text(answer.optString("answer"), parent = target)
                    val citations = answer.optJSONArray("citations") ?: JSONArray()
                    for (j in 0 until citations.length()) {
                        val citation = citations.getJSONObject(j)
                        ui.text(citation.optString("excerpt"), parent = target)
                        ui.button(MoteI18n.text("查看原文依据") + " · " + citation.optString("appName"), parent = target) { library.queryEvidence(citation.getString("id")) }
                    }
                }
                turn.optJSONObject("error")?.let { ui.text(it.optString("message"), parent = target) }
            }
            next(conversation)?.let { older -> ui.button(MoteI18n.text("加载更早的对话"), parent = target) { loadConversation(id, older) } }
            if (askState.optString("runStatus") != "running") ui.button(MoteI18n.text("删除对话"), parent = target) {
                confirm(MoteI18n.text("删除对话"), MoteI18n.text("删除后无法恢复。")) {
                    ui.work(MoteI18n.text("正在删除…"), { api.delete("/api/conversations/" + encode(id)) }) {
                        askState.remove("conversationId"); askState.remove("runId"); persistAsk(); refresh()
                    }
                }
            }
        }
    }

    private fun loadNotes() {
        val api = client
        ui.work(MoteI18n.text("正在读取随手记…"), {
            CentralDraftWrites.barrier { draftFailure.get()?.let { throw it }; noteStore.read() } to runCatching { api.get("/api/captures?kind=note&limit=30") }
        }) { (state, history) ->
            noteDraft = state.getJSONObject("draft"); noteHistory = history.getOrDefault(JSONObject()); buildNotes(state, noteHistory)
            history.exceptionOrNull()?.let(ui::requestFailure)
        }
    }
    private fun persistNote() {
        noteDraft.put("text", noteText?.text?.toString() ?: noteDraft.optString("text"))
        noteDraft.put("mood", noteMood?.text?.toString() ?: noteDraft.optString("mood"))
        noteWriter.submit(JSONObject(noteDraft.toString()))
    }
    private fun buildNotes(state: JSONObject, history: JSONObject) {
        body.removeAllViews()
        noteText = ui.field(MoteI18n.text("此刻想留下什么？"), noteDraft.optString("text"), multiline = true).apply {
            filters = arrayOf(InputFilter.LengthFilter(100000)); minLines = 5
        }
        noteMood = ui.field(MoteI18n.text("心情（可选）"), noteDraft.optString("mood")).apply { filters = arrayOf(InputFilter.LengthFilter(80)) }
        watch(noteText!!) { persistNote() }; watch(noteMood!!) { persistNote() }
        ui.button(MoteI18n.text("图片与语音附件")) { ui.pickAttachment() }
        val attachments = noteDraft.getJSONArray("attachments")
        ui.text(MoteI18n.text("已添加 {0} 个附件", attachments.length()))
        for (i in 0 until attachments.length()) ui.button(MoteI18n.text("移除附件：{0}", i + 1)) {
            attachments.remove(i); persistNote(); refresh()
        }
        ui.button(MoteI18n.text("保存并同步"), true) {
            persistNote()
            syncNotes(enqueue = true)
        }
        ui.text(MoteI18n.text("图片和录音会先归档。是否提取文字或转写录音取决于中央处理设置；请在资料库查看状态。每个附件最多 50 MiB。"))
        val pending = state.getJSONArray("pending")
        if (pending.length() > 0) {
            ui.text(MoteI18n.text("待同步 {0} 条", pending.length()), NativeFontRole.SECTION)
            ui.button(MoteI18n.text("重试同步")) {
                syncNotes(enqueue = false)
            }
            for (i in 0 until pending.length()) ui.text(pending.getJSONObject(i).getString("text"))
        }
        ui.text(MoteI18n.text("已经留下的心绪与杂事"), NativeFontRole.SECTION)
        ui.button(MoteI18n.text("刷新")) { refresh() }
        val items = history.optJSONArray("items") ?: JSONArray()
        for (i in 0 until items.length()) {
            val note = items.getJSONObject(i); val card = ui.card()
            ui.text(note.optString("capturedAt"), NativeFontRole.SUPPORT, card); ui.text(note.optString("ocrText"), parent = card)
            ui.button(MoteI18n.text("查看原文"), parent = card) { library.captureEvidence(note.getString("id")) }
        }
        next(history)?.let { cursor -> ui.button(MoteI18n.text("加载更早的随手记")) {
            val api = client
            ui.work(MoteI18n.text("正在读取随手记…"), { api.get("/api/captures?kind=note&limit=30&cursor=" + encode(cursor)) }) { noteHistory = it; buildNotes(state, it) }
        } }
    }

    private fun syncNotes(enqueue: Boolean) {
        val api = client
        ui.work(MoteI18n.text("正在保存随手记…"), {
            val state = CentralDraftWrites.barrier {
                draftFailure.get()?.let { throw it }
                if (enqueue) noteStore.enqueue(Settings(ui).deviceId, Settings(ui).read().deviceName)
                noteStore.read()
            }
            val outcome = runCatching {
                val items = state.getJSONArray("pending")
                for (i in 0 until items.length()) {
                    val note = items.getJSONObject(i)
                    val response = CentralNotes.send(api, note)
                    CentralDraftWrites.barrier { CentralNotes.acknowledge(noteStore, api, note, response) }
                }
            }
            CentralDraftWrites.barrier { noteStore.read() } to outcome
        }) { (state, outcome) ->
            noteDraft = state.getJSONObject("draft"); buildNotes(state, noteHistory)
            outcome.onFailure(ui::requestFailure).onSuccess { refresh() }
        }
    }

    fun addAttachments(uris: List<Uri>, chat: Boolean) {
        if (chat && (askState.has("pending") || askState.optString("runStatus") == "running")) return
        val api = client
        val previous = if (chat) askState.optJSONArray("attachments") ?: JSONArray() else noteDraft.getJSONArray("attachments")
        val max = if (chat) 4 else 10
        if (previous.length() + uris.size > max) { ui.notice(if (chat) MoteI18n.text("最多添加 4 张图片") else MoteI18n.text("最多 10 个附件")); return }
        val draftSnapshot = JSONObject(noteDraft.toString())
        val askSnapshot = JSONObject(askState.toString())
        ui.work(MoteI18n.text("正在上传附件…"), { progress -> runCatching {
            val settings = Settings(ui)
            for (uri in uris) {
                val mime = ui.contentResolver.getType(uri).orEmpty()
                require(!chat || mime in listOf("image/png", "image/jpeg", "image/webp")) { MoteI18n.text("请选择 PNG、JPEG 或 WebP 图片。") }
                val name = ui.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null } ?: "attachment"
                directory.mkdirs()
                val spool = File(directory, "attachment-" + UUID.randomUUID() + ".tmp")
                try {
                    ui.contentResolver.openInputStream(uri)!!.use { input -> spool.outputStream().use { output ->
                        val buffer = ByteArray(65536); var total = 0
                        while (true) { val n = input.read(buffer); if (n < 0) break; total += n
                            require(total <= if (chat) 8 * 1024 * 1024 else CentralAttachments.MAX_BYTES) { MoteI18n.text("附件必须是图片或音频，且每个文件最多 50 MiB。") }
                            output.write(buffer, 0, n)
                        }
                    } }
                    // The original digest makes resuming an ambiguous upload idempotent.
                    val id = CentralAttachments.upload(api, spool, name, mime, settings.deviceId, resolveTime = { key ->
                        CentralDraftWrites.barrier {
                            val times = attachmentStore.read()
                            if (!times.has(key)) { times.put(key, System.currentTimeMillis()); attachmentStore.write(times) }
                            times.getLong(key)
                        }
                    }) { done, total ->
                        progress.message = MoteI18n.text("正在上传附件 {0}/{1}", done, total)
                    }
                    if (chat) {
                        val attachments = askSnapshot.optJSONArray("attachments") ?: JSONArray()
                        attachments.put(JSONObject().put("id", id).put("name", name)); askSnapshot.put("attachments", attachments)
                        CentralDraftWrites.barrier { askStore.write(askSnapshot) }
                    } else {
                        draftSnapshot.getJSONArray("attachments").put(id)
                        CentralDraftWrites.barrier { noteStore.edit(draftSnapshot.getString("text"), draftSnapshot.getString("mood"), draftSnapshot.getJSONArray("attachments")) }
                    }
                } finally { spool.delete() }
            }
        } }) { outcome ->
            askState = askSnapshot; noteDraft = draftSnapshot
            refresh(); outcome.exceptionOrNull()?.let(ui::requestFailure)
        }
    }

    fun importFile(uri: Uri) {
        val api = client; val instruction = importInstruction
        ui.work(MoteI18n.text("正在导入文件…"), { progress ->
            importStore.stage(ui, uri, instruction)
            importStore.send(api) { done, total -> progress.message = MoteI18n.text("正在上传附件 {0}/{1}", done, total) }
        }) { admin.importDetail(it.getString("id")) }
    }
    fun importPortableFile(uri: Uri, operationId: String? = null) {
        val api = client
        ui.work(MoteI18n.text("正在导入文件…"), {
            portableImportStore.stagePortable(ui, uri, operationId)
            portableImportStore.sendPortable(api)
        }) { admin.portableImportDetail(it.getString("id")) }
    }
    fun pendingPortableImport() = portableImportStore.pending()
    fun retryPortableImport(api: CentralClient) = portableImportStore.sendPortable(api)
    fun discardPortableImport() = portableImportStore.discard()
    fun importPending(target: LinearLayout) {
        ui.work(MoteI18n.text("正在读取…"), { importStore.pending() }) { saved ->
            if (saved.has("manifest")) {
                ui.text(saved.getJSONObject("manifest").getString("name"), parent = target)
                ui.button(MoteI18n.text("重试同一请求"), parent = target) {
                    val api = client
                    ui.work(MoteI18n.text("正在导入文件…"), { progress ->
                        importStore.send(api) { done, total -> progress.message = MoteI18n.text("正在上传附件 {0}/{1}", done, total) }
                    }) { admin.importDetail(it.getString("id")) }
                }
                ui.button(MoteI18n.text("放弃待导入文件"), parent = target) {
                    confirm(MoteI18n.text("放弃待导入文件"), MoteI18n.text("中央已接收的原件仍保留。")) {
                        ui.work(MoteI18n.text("正在处理…"), { importStore.discard() }) { refresh() }
                    }
                }
            }
        }
    }
    fun playAudio(path: String, target: LinearLayout, expected: CentralDownload? = null) {
        close(); val api = client; val revision = ui.navigationRevision
        ui.work(MoteI18n.text("正在读取录音…"), {
            val file = File.createTempFile("central-audio-", ".tmp", directory.apply { mkdirs() })
            audioFile = file
            try {
                file.outputStream().use { api.download(path, it, 256 * 1024 * 1024L, expected) }
                check(!ui.isDestroyed && !ui.isFinishing && ui.navigationRevision == revision)
                file
            }
            catch (error: Throwable) { file.delete(); throw error }
        }) { file ->
            audioFile = file
            val current = android.media.MediaPlayer(); player = current
            var ready = false
            val toggle = ui.button(MoteI18n.text("播放或暂停"), parent = target) {
                if (player === current && ready) { if (current.isPlaying) current.pause() else current.start() }
            }.apply { isEnabled = false }
            val seek = SeekBar(ui).apply { max = 1000; contentDescription = MoteI18n.text("播放进度")
                isEnabled = false
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(bar: SeekBar?, value: Int, fromUser: Boolean) {
                        if (fromUser && player === current && ready) current.seekTo((current.duration.toLong() * value / 1000).toInt())
                    }
                    override fun onStartTrackingTouch(bar: SeekBar?) = Unit
                    override fun onStopTrackingTouch(bar: SeekBar?) = Unit
                })
            }; target.addView(seek)
            current.setOnPreparedListener { if (player === current) { ready = true; toggle.isEnabled = true; seek.isEnabled = true; it.start() } }
            current.setOnErrorListener { _, _, _ ->
                ready = false; toggle.isEnabled = false; seek.isEnabled = false
                ui.notice(MoteI18n.text("无法播放此录音")); if (player === current) close(); true
            }
            try { file.inputStream().use { current.setDataSource(it.fd) }; current.prepareAsync() }
            catch (error: Throwable) { close(); throw error }
        }
    }

    fun confirm(title: String, message: String, action: () -> Unit) {
        val owner = client; val revision = ui.navigationRevision
        MoteDialogBuilder(ui).setTitle(title).setMessage(message).setNegativeButton(MoteI18n.text("取消"), null)
            .setPositiveButton(MoteI18n.text("确认")) { _, _ -> if (ui.client === owner && ui.navigationRevision == revision) action() }.show()
    }
    companion object {
        fun encode(value: String): String = java.net.URLEncoder.encode(value, "UTF-8")
        fun next(value: JSONObject): String? = if (value.isNull("nextCursor") || !value.has("nextCursor")) null else value.opt("nextCursor").toString()
        val pages = listOf(
            "overview" to "中央工作台", "archive" to "中央资料库", "ask" to "问一问", "activity" to "活动", "notes" to "随手记",
            "materials" to "正式资料", "coding" to "Coding 会话同步状态", "timeline" to "片段", "files" to "文件与录音",
            "memories" to "记忆", "insights" to "洞察", "actions" to "行动", "agentView" to "Agent 视角",
            "sources" to "来源", "devices" to "设备", "connections" to "对外授权", "lark" to "飞书",
            "statistics" to "运行状态", "processing" to "处理任务", "plugins" to "插件", "settings" to "模型与服务",
            "usage" to "用量与费用", "vault" to "存储与索引", "developer" to "诊断与更新", "about" to "设置", "imports" to "导入", "help" to "帮助与反馈"
        )
    }
}
