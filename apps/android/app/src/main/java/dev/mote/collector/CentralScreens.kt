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
import java.util.UUID

internal class CentralScreens(val ui: CentralContent, val body: LinearLayout, private val directory: File) {
    val client get() = requireNotNull(ui.client)
    private val cipher = ui.secretBox()
    private val askStore = CentralStateFile(directory, "ask", cipher)
    private val noteStore = CentralNoteStore(directory, cipher)
    private val importStore = CentralImports(File(directory, "import-pending"), cipher)
    private val attachmentStore = CentralStateFile(directory, "attachment-times", cipher)
    private val insightStore = CentralStateFile(directory, "insight-request", cipher)
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
    private var askHistory = JSONObject()
    private var messages: LinearLayout? = null
    private var scopeBox: LinearLayout? = null
    private var scopeLabel: TextView? = null
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
    private val insights = CentralInsights(this)

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
    fun resume() { if (currentPage in setOf("plugins", "extensions")) admin.resume(); if (currentPage == "activity") ui.scheduleActivityPoll(); if (currentPage == "memories") ui.scheduleMemoryTopicsPoll(); if (currentPage == "insights") insights.resume() }
    fun pollMemoryTopics() { if (currentPage == "memories") library.pollTopics() }
    fun saveMemoryTopics(out: android.os.Bundle) = library.saveTopics(out)
    fun restoreMemoryTopics(value: android.os.Bundle) = library.restoreTopics(value)
    fun showInsights() = insights.show()
    fun selectInsight(id: String) = insights.select(id)
    fun pollInsight() = insights.poll()
    fun pauseInsights() = insights.pause()
    fun saveInsightState(out: android.os.Bundle) = insights.save(out)
    fun restoreInsightState(value: android.os.Bundle) = insights.restore(value)
    fun pollWorkActivity() { if (currentPage == "activity") activity.poll() }
    fun saveWorkState(out: android.os.Bundle) = activity.saveState(out)
    fun restoreWorkState(value: android.os.Bundle) = activity.restoreState(value)
    fun openWorkEvidence(ref: String) = library.evidence(CentralEvidenceReference.normalize(ref))
    fun clearPrivateState() { askState = JSONObject(); question = null; messages = null; noteText = null; noteMood = null; admin.clearPrivateState(); activity.clearPrivateState(); library.clearTopics(); insights.clear(); body.removeAllViews() }
    fun refresh() { if (currentPage == "insights") insights.returnFromEvidence(); ui.navigate(currentPage) }
    fun insightRequest(prompt: String): JSONObject = CentralDraftWrites.barrier {
        val saved = insightStore.read()
        if (saved.has("requestId")) saved else JSONObject().put("requestId", UUID.randomUUID().toString())
            .put("timeZone", java.time.ZoneId.systemDefault().id).apply { if (prompt.isNotBlank()) put("prompt", prompt) }
            .also(insightStore::write)
    }
    fun pendingInsightRequest(): JSONObject = CentralDraftWrites.barrier { insightStore.read() }
    fun insightAccepted() = CentralDraftWrites.barrier { insightStore.write(JSONObject()) }
    fun askAbout(id: String) {
        UUID.fromString(id)
        if (askState.has("pending") || askState.optString("runStatus") == "running") { ui.notice(MoteI18n.text("请先等待当前回答完成，或停止回答。")); return }
        askState.remove("conversationId"); askState.remove("runId"); askState.remove("runStatus"); NativeAskEvidenceScope.select(askState, id); persistAsk(); ui.navigate("ask")
    }
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
            listOf(api.get("/api/status"), api.get("/api/devices"), api.get("/api/operations?limit=5"))
        }) { data ->
            val status = data[0]
            ui.text(MoteI18n.text("中央工作台"), NativeFontRole.TITLE_MOBILE, target)
            val agent = status.getJSONObject("agent")
            ui.text(if (agent.optBoolean("configured")) MoteI18n.text("模型已配置") else MoteI18n.text("请先配置模型服务"), parent = target)
            ui.text(agent.optString("model"), parent = target)
            admin.values(status.optJSONObject("storage") ?: JSONObject(), target)
            ui.text(MoteI18n.text("设备"), NativeFontRole.SECTION, target)
            val devices = data[1].optJSONArray("items") ?: JSONArray()
            for (i in 0 until devices.length()) {
                val device = devices.getJSONObject(i)
                ui.text(device.optString("deviceName") + " · " + device.optString("lastSeenAt"), parent = target)
            }
            ui.text(MoteI18n.text("处理任务"), NativeFontRole.SECTION, target)
            admin.items(data[2], target) { row -> admin.operation(row.optString("id")) }
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
            Triple(state, api.get("/api/conversations?limit=30"), api.get("/api/model-settings"))
        }) { (state, history, settings) ->
            var scopeRefused = false
            ui.takeAskEvidence()?.let { evidence -> scopeRefused = !NativeAskEvidenceScope.select(state, evidence) }
            askState = state; modelSettings = settings; buildAsk(history)
            if (scopeRefused) ui.notice(MoteI18n.text("请先等待当前回答完成，或停止回答。"))
            val conversationId = askState.optString("conversationId")
            if (conversationId.isNotBlank()) loadConversation(conversationId)
            ui.takeAskConversation()?.let(::selectConversation)
            if (askState.has("runId") || askState.has("pending")) ui.scheduleAskPoll()
        }
    }
    private fun buildAsk(history: JSONObject) {
        askHistory = history
        body.removeAllViews()
        body.setPadding(ui.moteDp(20), ui.moteDp(25), ui.moteDp(20), ui.moteDp(28))
        messages = LinearLayout(ui).apply { orientation = LinearLayout.VERTICAL }.also(body::addView)
        runStatus = ui.text("", parent = messages!!).apply { setPadding(0,0,0,0) }
        if (askState.optString("conversationId").isBlank()) ui.text(MoteI18n.text("想从留下的内容里找什么？"), NativeFontRole.TITLE_MOBILE, messages!!)
        ui.askConversationActions(askState.optString("conversationId").isNotBlank())
        val compose = ui.askComposer()
        scopeBox = LinearLayout(ui).apply { orientation = LinearLayout.HORIZONTAL; gravity = android.view.Gravity.CENTER_VERTICAL }.also(compose::addView)
        scopeLabel = TextView(ui).apply {
            MoteUi.type(this, NativeFontRole.SUPPORT); MoteUi.textColor(this, NativeColorRole.MUTED)
            minHeight = ui.moteDp(38); gravity = android.view.Gravity.CENTER_VERTICAL; isFocusable = true
            setOnClickListener {
                val id = (askState.optJSONArray("anchorEvidenceIds") ?: askState.optJSONArray("evidenceIds"))?.optString(0)
                if (id.isNullOrBlank()) { ui.navigate("archive"); return@setOnClickListener }
                val labels = listOf("参考这条记录，自动查找相关上下文", "仅查这条记录", "清除范围")
                MoteDialogBuilder(ui).setTitle(MoteI18n.text("调整参考范围")).setItems(labels.map { MoteI18n.text(it) }.toTypedArray()) { _, index ->
                    val accepted = when (index) { 0 -> NativeAskEvidenceScope.select(askState,id); 1 -> NativeAskEvidenceScope.selectOnly(askState,id); else -> NativeAskEvidenceScope.clear(askState) }
                    if (accepted) { persistAsk(); updateScope() } else ui.notice(MoteI18n.text("请先等待当前回答完成，或停止回答。"))
                }.show()
            }
        }.also { scopeBox!!.addView(it, LinearLayout.LayoutParams(-1,-2)) }
        updateScope()
        val entry = LinearLayout(ui).apply { orientation = LinearLayout.VERTICAL; background = MoteUi.shape(ui, NativeColorRole.SURFACE_RAISED, 7, true); setPadding(ui.moteDp(12),ui.moteDp(10),ui.moteDp(12),ui.moteDp(8)) }
        compose.addView(entry)
        question = EditText(ui).apply {
            hint = MoteI18n.text("想找回什么？"); contentDescription = MoteI18n.text("你的问题"); isSaveEnabled = false
            MoteUi.textInput(this, android.text.InputType.TYPE_CLASS_TEXT, multiline = true); MoteUi.field(this)
            filters = arrayOf(InputFilter.LengthFilter(8000)); setText(askState.optString("question"))
            NativePresentationStyles.bind(this, "ask-question") { (it as EditText).apply { minLines = 2; maxLines = 4; background = null; setPadding(0,0,0,ui.moteDp(6)) } }
        }.also { entry.addView(it, LinearLayout.LayoutParams(-1,-2)) }
        watch(question!!) { askState.put("question", question!!.text.toString()); persistAsk(); controlsAsk() }
        val actions = LinearLayout(ui).apply { gravity = android.view.Gravity.CENTER_VERTICAL }; entry.addView(actions)
        fun action(label: String, description: String = label, onClick: () -> Unit): Button = MoteUi.action(Button(ui).apply {
            text = label; contentDescription = MoteI18n.text(description); setOnClickListener { if (!ui.isWorking) onClick() }
        }, MoteUi.ButtonRole.TEXT).also { actions.addView(it, LinearLayout.LayoutParams(-2,-2)) }
        action("▧", "添加图片") { if (!askBusy()) ui.pickAttachment(chat = true) }
        val modelBox = LinearLayout(ui).apply { orientation = LinearLayout.VERTICAL; visibility = android.view.View.GONE }
        action("▸ " + MoteI18n.text("本次模型"), "本次模型") { modelBox.visibility = if (modelBox.visibility == android.view.View.VISIBLE) android.view.View.GONE else android.view.View.VISIBLE }
        actions.addView(android.view.View(ui), LinearLayout.LayoutParams(0,1,1f))
        send = action("↑", "发送") { submitAsk() }.apply { MoteUi.action(this,MoteUi.ButtonRole.PRIMARY); minimumWidth = ui.moteDp(36); minWidth = minimumWidth }
        entry.addView(modelBox)
        val profiles = modelSettings.optJSONArray("profiles") ?: JSONArray()
        val ids = listOf("") + (0 until profiles.length()).map { profiles.getJSONObject(it).getString("id") }
        val names = listOf(MoteI18n.text("跟随功能默认")) + (0 until profiles.length()).map { profiles.getJSONObject(it).getString("name") }
        ui.text(MoteI18n.text("模型预设"), NativeFontRole.SUPPORT, modelBox)
        preset = Spinner(ui).apply {
            adapter = MoteUi.choiceAdapter(ui, names); setSelection(ids.indexOf(askState.optString("modelProfileId")).coerceAtLeast(0))
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) { askState.put("modelProfileId", ids[position]); persistAsk() }
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
        }.also(modelBox::addView)
        model = ui.field(MoteI18n.text("模型 ID（留空跟随预设）"), askState.optString("modelOverride"), parent = modelBox).apply { filters = arrayOf(InputFilter.LengthFilter(512)) }
        watch(model!!) { askState.put("modelOverride", model!!.text.toString()); persistAsk() }
        val attachments = askState.optJSONArray("attachments") ?: JSONArray()
        for (i in 0 until attachments.length()) {
            val attachment = attachments.getJSONObject(i)
            ui.button(MoteI18n.text("移除附件：{0}", attachment.optString("name")), parent = compose) {
                if (askBusy()) return@button
                attachments.remove(i); askState.put("attachments", attachments); persistAsk(); refresh()
            }
        }
        stop = ui.button(MoteI18n.text("停止回答"), parent = compose) {
            val id = askState.optString("runId"); if (id.isBlank()) return@button
            val api = client; ui.work(MoteI18n.text("正在停止回答…"), { api.post("/api/query-runs/" + encode(id) + "/cancel") }) { run -> receiveRun(run) }
        }
        controlsAsk()
    }
    private fun askBusy() = askState.has("pending") || askState.optString("runStatus") == "running"
    fun newConversation(discardConfirmed: Boolean = false) {
        if (askBusy()) { ui.notice(MoteI18n.text("请先等待当前回答完成，或停止回答。")); return }
        if (!discardConfirmed && (askState.optString("question").isNotBlank() || (askState.optJSONArray("attachments")?.length() ?: 0) > 0)) {
            MoteDialogBuilder(ui).setTitle(MoteI18n.text("还有未发送的内容")).setMessage(MoteI18n.text("切换对话会舍弃当前输入和图片。你也可以留在这里继续编辑。"))
                .setNegativeButton(MoteI18n.text("继续编辑"),null).setPositiveButton(MoteI18n.text("舍弃并切换")) { _, _ -> newConversation(true) }.show(); return
        }
        listOf("runId","conversationId","runStatus","evidenceIds","anchorEvidenceIds","scopeDirty").forEach(askState::remove)
        askState.put("question", "").put("attachments",JSONArray()); persistAsk(); refresh()
    }
    fun showAskHistory() {
        if (currentPage != "ask" || ui.isWorking) return
        setBack { refresh() }; ui.hideAskComposer(); ui.detailTitle(MoteI18n.text("对话历史")); body.removeAllViews()
        ui.text(MoteI18n.text("对话历史"),NativeFontRole.TITLE_MOBILE)
        ui.button(MoteI18n.text("新对话")) { newConversation() }
        val items = askHistory.optJSONArray("items") ?: JSONArray()
        if (items.length() == 0) ui.text(MoteI18n.text("还没有对话。"), NativeFontRole.SUPPORT)
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            ui.selectRow(item.optString("title"), MoteI18n.text("{0} 轮对话",item.optInt("turnCount")) + " · " + item.optString("updatedAt"),body) { selectConversation(item.getString("id")) }
        }
        next(askHistory)?.let { cursor -> ui.button(MoteI18n.text("加载更早的对话")) {
            val api = client; ui.work(MoteI18n.text("正在读取对话…"), { api.get("/api/conversations?limit=30&cursor=" + encode(cursor)) }) { askHistory = it; showAskHistory() }
        } }
    }
    fun conversationMore() {
        val id = askState.optString("conversationId"); if (id.isBlank() || askBusy()) return
        MoteDialogBuilder(ui).setTitle(MoteI18n.text("对话更多")).setItems(arrayOf(MoteI18n.text("刷新"),MoteI18n.text("删除对话"))) { _, index ->
            if (index == 0) refresh() else confirm(MoteI18n.text("删除对话"), MoteI18n.text("删除后无法恢复。")) {
                val api = client; ui.work(MoteI18n.text("正在删除…"), { api.delete("/api/conversations/" + encode(id)) }) {
                    askState.remove("conversationId"); askState.remove("runId"); persistAsk(); refresh()
                }
            }
        }.show()
    }
    private fun selectConversation(id: String, discardConfirmed: Boolean = false) {
        if (runCatching { UUID.fromString(id) }.isFailure) { ui.notice(MoteI18n.text("请求的资源不存在或已删除。")); return }
        if (askState.optString("conversationId") == id) { refresh(); return }
        if (askState.has("pending") || askState.optString("runStatus") == "running") {
            ui.notice(MoteI18n.text("请先等待当前回答完成，或停止回答。")); return
        }
        if (!discardConfirmed && (askState.optString("question").isNotBlank() || (askState.optJSONArray("attachments")?.length() ?: 0) > 0)) {
            MoteDialogBuilder(ui).setTitle(MoteI18n.text("还有未发送的内容"))
                .setMessage(MoteI18n.text("切换对话会舍弃当前输入和图片。你也可以留在这里继续编辑。"))
                .setNegativeButton(MoteI18n.text("继续编辑"), null)
                .setPositiveButton(MoteI18n.text("舍弃并切换")) { _, _ -> selectConversation(id, true) }.show()
            return
        }
        askState.put("conversationId", id).put("question", "").put("attachments", JSONArray())
        listOf("runId", "runStatus", "evidenceIds", "anchorEvidenceIds", "scopeDirty").forEach(askState::remove)
        question?.setText(""); persistAsk(); refresh()
    }

    private fun controlsAsk() {
        val busy = askState.has("pending") || askState.optString("runStatus") == "running"
        question?.isEnabled = !busy
        preset?.isEnabled = !busy; model?.isEnabled = !busy
        send?.isEnabled = (!busy && question?.text?.isNotBlank() == true) || askState.has("pending")
        send?.text = if (askState.has("pending")) MoteI18n.text("重试同一请求") else "↑"
        stop?.visibility = if (askState.optString("runStatus") == "running") android.view.View.VISIBLE else android.view.View.GONE
    }
    private fun updateScope() {
        val strict = (askState.optJSONArray("evidenceIds")?.length() ?: 0) > 0
        val anchored = (askState.optJSONArray("anchorEvidenceIds")?.length() ?: 0) > 0
        scopeBox?.visibility = android.view.View.VISIBLE
        scopeLabel?.text = if (strict) MoteI18n.text("仅查这条记录") + " ⌄" else if (anchored) MoteI18n.text("参考这条记录，自动查找相关上下文") + " ⌄" else "＋ " + MoteI18n.text("参考资料")
    }
    private fun submitAsk() {
        val api = client
        val request = askState.optJSONObject("pending") ?: run {
            val text = question?.text?.toString()?.trim().orEmpty()
            if (text.isBlank()) { ui.notice(MoteI18n.text("请输入问题（最多 8000 字）")); return }
            val input = JSONObject().put("question", text).put("timeZone", java.time.ZoneId.systemDefault().id)
            NativeAskEvidenceScope.writeInput(askState, input)
            askState.optString("modelProfileId").takeIf { it.isNotBlank() }?.let { input.put("modelProfileId", it) }
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
        }) { run -> askState.remove("pending"); askState.remove("scopeDirty"); receiveRun(run) }
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
        askState.remove("scopeDirty")
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
            NativeAskEvidenceScope.restore(askState, conversation); persistAsk(); updateScope()
            target.removeAllViews(); runStatus = ui.text("", parent = target)
            val turns = conversation.getJSONArray("turns")
            for (i in 0 until turns.length()) {
                val turn = turns.getJSONObject(i)
                ui.text(turn.getString("question"), NativeFontRole.SECTION, target)
                val presentation = CentralConversationPresentation.read(turn)
                presentation.notice?.let { ui.text(it, parent = target) }
                presentation.result?.let { answer ->
                    val sourceCitations = answer.optJSONArray("citations") ?: JSONArray()
                    val citations = (0 until sourceCitations.length()).map { sourceCitations.getJSONObject(it) }.distinctBy { it.getString("id") }
                    val display = NativeAnswerPresentation.format(answer.optString("answer"), citations.map { it.getString("id") })
                    val styled = android.text.SpannableString(display.text)
                    display.emphasis.forEach { span -> styled.setSpan(android.text.style.StyleSpan(if (span.bold) android.graphics.Typeface.BOLD else android.graphics.Typeface.ITALIC), span.start, span.end, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
                    ui.text("", parent = target).apply { text = styled; setTextIsSelectable(true) }
                    for ((index, citation) in citations.withIndex()) {
                        ui.button("[${index + 1}] " + MoteI18n.text("查看原文依据") + " · " + citation.optString("appName"), parent = target) { openConversationEvidence(id, citation.getString("id")) { library.captureEvidence(citation.getString("id")) } }
                    }
                    ui.button(MoteI18n.text("存为记录"), parent = target) { ui.recordConversation(turn.getString("question") + "\n\n" + answer.optString("answer"), id) }
                }
                turn.optJSONObject("error")?.let { ui.text(it.optString("message"), parent = target) }
            }
            next(conversation)?.let { older -> ui.button(MoteI18n.text("加载更早的对话"), parent = target) { loadConversation(id, older) } }
            ui.askConversationActions(true)
        }
    }

    private fun loadNotes() {
        val api = client
        ui.work(MoteI18n.text("正在读取随手记…"), {
            CentralDraftWrites.barrier { draftFailure.get()?.let { throw it }; noteStore.read() } to runCatching { api.get("/api/notes?limit=30") }
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
        ui.button(MoteI18n.text("记下"), true) { ui.recordNew() }
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
            ui.work(MoteI18n.text("正在读取随手记…"), { api.get("/api/notes?limit=30&cursor=" + encode(cursor)) }) { noteHistory = it; buildNotes(state, it) }
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
                    val response = api.post("/api/notes", note)
                    CentralDraftWrites.barrier { noteStore.acknowledge(note.getString("id"), response) }
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
    fun playAudio(path: String, target: LinearLayout) {
        close(); val api = client; val revision = ui.navigationRevision
        ui.work(MoteI18n.text("正在读取录音…"), {
            val file = File.createTempFile("central-audio-", ".tmp", ui.cacheDir)
            audioFile = file
            try {
                file.outputStream().use { api.download(path, it, 256 * 1024 * 1024L) }
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

    fun openConversationEvidence(conversationId: String, evidenceId: String, open: () -> Unit) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { CentralConversationReference.available(api, conversationId, evidenceId) }) { available ->
            if (available) open()
            else MoteDialogBuilder(ui).setTitle(MoteI18n.text("引用不可用")).setMessage(MoteI18n.text("引用原文已删除，历史问答仍保留。"))
                .setPositiveButton(MoteI18n.text("返回原对话"), null).show()
        }
    }

    fun confirm(title: String, message: String, action: () -> Unit) {
        MoteDialogBuilder(ui).setTitle(title).setMessage(message).setNegativeButton(MoteI18n.text("取消"), null)
            .setPositiveButton(MoteI18n.text("确认")) { _, _ -> action() }.show()
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
