package dev.mote.collector

import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.widget.*
import org.json.JSONObject

/** Settings plugin management stays in native controls. All lifecycle, progress,
 * capability and authority decisions come from the current owner API. */
internal class CentralPlugins(private val screens: CentralScreens, private val registeredCapabilities: () -> Unit) {
    private val ui get() = screens.ui
    private val body get() = screens.body
    private val api get() = PluginControlClient(screens.client)
    private var inventory: PluginInventory? = null
    private var binding: JSONObject? = null
    private var preparedBinding: JSONObject? = null
    private var tab = "installed"
    private var pending: PluginCommandIntent? = null
    private var retryPanel: LinearLayout? = null
    private var listVisible = false
    private val handler = Handler(Looper.getMainLooper())
    private var poll: Runnable? = null

    fun close() { poll?.let(handler::removeCallbacks); poll = null }
    fun clearPrivateState() { close(); inventory = null; binding = null; preparedBinding = null; pending = null; retryPanel = null; listVisible = false }
    fun resume() { if (listVisible && inventory != null) load() }
    fun show() { clearPrivateState(); load() }
    private fun load() {
        close(); screens.clearBack(); val control = api
        ui.work(MoteI18n.text("正在读取…"), { runCatching { val inventory = control.inventory(); val memory = if (tab == "memory") control.memory() else null; Triple(inventory, memory, memory?.optString("bindingPreparation")?.takeIf { it.isNotEmpty() }?.let(control::preparation)) } }) { result ->
            result.onSuccess { (packages, memory, preparation) -> inventory = packages; binding = memory; preparedBinding = preparation; render() }
                .onFailure { failure -> readFailure(failure) }
        }
    }
    private fun readFailure(failure: Throwable) {
        if (failure is CentralFailure && failure.status in setOf(401, 403, 404, 410)) { clearPrivateState(); body.removeAllViews(); ui.button(MoteI18n.text("刷新")) { load() } }
        ui.requestFailure(failure)
    }
    private fun submit(intent: PluginCommandIntent, done: (JSONObject) -> Unit = { load() }) {
        close(); val control = api
        val previous = pending
        val request = if (previous != null && previous.path == intent.path && previous.method == intent.method && comparable(previous) == comparable(intent)) previous else intent
        pending = request; retryPanel?.let(body::removeView); retryPanel = null
        ui.work(MoteI18n.text("正在处理…"), { runCatching { control.execute(request) } }) { result ->
            result.onSuccess { pending = null; ui.notice(MoteI18n.text("请求已登记，运行状态以中央节点返回为准。")); done(it) }
                .onFailure { failure ->
                    if (failure is CentralFailure && failure.status in setOf(401, 403, 404, 410)) { readFailure(failure); return@onFailure }
                    ui.requestFailure(failure)
                    if (failure is CentralFailure && failure.status in setOf(409, 422)) {
                        pending = null
                        val card = ui.card(); retryPanel = card
                        ui.text(MoteI18n.text("配置或方案已变化；请读取当前状态后重新确认。"), parent = card)
                        ui.button(MoteI18n.text("重新读取配置并丢弃草稿"), parent = card) { screens.confirm(MoteI18n.text("重新读取"), MoteI18n.text("有未保存的修改。离开并丢弃修改？")) { load() } }
                    } else {
                        val card = ui.card(); retryPanel = card
                        ui.text(MoteI18n.text("请求结果尚未确认，请重试同一请求。"), parent = card)
                        ui.button(MoteI18n.text("重试同一请求"), parent = card) { submit(request, done) }
                    }
                }
        }
    }
    private fun comparable(intent: PluginCommandIntent) = intent.payload().apply { remove("operationId"); remove("expectedRevision") }.toString()
    private fun render() {
        body.removeAllViews(); retryPanel = null; listVisible = true
        ui.text(MoteI18n.text("管理安装、运行与记忆方案。资料连接仍在来源中管理。"))
        ui.button(MoteI18n.text("刷新")) { load() }
        val tabs = listOf("installed" to MoteI18n.text("已安装"), "discover" to MoteI18n.text("发现"), "memory" to MoteI18n.text("记忆方案"))
        val select = Spinner(ui).apply {
            contentDescription = MoteI18n.text("插件页面")
            adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, tabs.map { it.second })
            setSelection(tabs.indexOfFirst { it.first == tab }.coerceAtLeast(0))
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) { if (tabs[position].first != tab) { tab = tabs[position].first; load() } }
            }
        }; body.addView(select, LinearLayout.LayoutParams(-1, ui.moteDp(52)))
        when (tab) { "installed" -> installed(); "discover" -> discover(); "memory" -> memory() }
        ui.button(MoteI18n.text("查看运行记录")) { ui.navigate("processing") }
        ui.disclosure(MoteI18n.text("高级：已注册能力清单")) { target -> ui.button(MoteI18n.text("已注册能力"), parent = target) { close(); body.removeAllViews(); screens.setBack { load() }; registeredCapabilities() } }
        schedulePoll()
    }
    private fun schedulePoll() {
        val active = inventory?.packages?.any { it.state == "installing" } == true || preparedBinding?.optString("state") in setOf("waiting", "running")
        if (!active) return
        val revision = ui.navigationRevision
        val next = Runnable { if (!ui.isDestroyed && !ui.isFinishing && revision == ui.navigationRevision && !ui.isWorking) load() else close() }
        poll = next; handler.postDelayed(next, 3000)
    }
    private fun installed() {
        val data = inventory ?: return
        ui.text(MoteI18n.text("安装包、配置实例和当前方案分别管理。"))
        if (data.packages.isEmpty()) { ui.text(MoteI18n.text("还没有安装外部插件。")); ui.button(MoteI18n.text("从 GitHub 添加")) { tab = "discover"; load() } }
        data.packages.forEach { item ->
            val card = ui.card(); ui.text(item.name + " · " + item.version, NativeFontRole.ROW, card)
            ui.text(state(item.state) + " · " + state(item.observed), parent = card); source(item.source, card)
            ui.text(if (item.runtime == "worker") MoteI18n.text("中央 Worker") else MoteI18n.text("独立服务"), parent = card)
            item.issues.forEach { ui.text(it, parent = card) }
            if (item.state == "restart-required") ui.text(MoteI18n.text("此包需要节点重启。当前页面不会重启服务器。"), parent = card)
            if ("configure" in item.allowedActions) ui.button(MoteI18n.text("新增实例"), parent = card) { configuration(item, null) }
            val instances = data.instances.filter { it.packageId == item.id }
            if (instances.isEmpty()) ui.text(MoteI18n.text("此安装包尚无配置实例；没有运行，也没有绑定到记忆方案。"), parent = card)
            instances.forEach { instance ->
                val target = ui.card(card); ui.text(instance.name, NativeFontRole.SECTION, target)
                ui.text(instance.scope + " · " + MoteI18n.text("配置版本 {0}", instance.revision), parent = target)
                ui.text((if (instance.desired) MoteI18n.text("已选择启用") else MoteI18n.text("已选择停用")) + " · " + state(instance.observed), parent = target)
                capabilities(instance.capabilities, target); instance.issues.forEach { ui.text(it, parent = target) }
                if ("configure" in instance.allowedActions) ui.button(MoteI18n.text("配置"), parent = target) { configuration(item, instance) }
                listOf("check" to MoteI18n.text("核验能力"), "enable" to MoteI18n.text("启用"), "disable" to MoteI18n.text("停用")).forEach { (action, label) ->
                    if (action in instance.allowedActions) ui.button(label, action == "enable", parent = target) { submit(PluginControlClient.ownedInstanceAction(instance.id, action, instance.revision)) }
                }
                ui.button(MoteI18n.text("查看记忆方案"), parent = target) { tab = "memory"; load() }
            }
            if ("uninstall" in item.allowedActions) ui.button(MoteI18n.text("卸载安装包"), parent = card) {
                screens.confirm(MoteI18n.text("卸载安装包"), MoteI18n.text("移除此安装包。已绑定、仍有历史读者或正在排空的包不能卸载，中央节点会再次核验。")) { submit(PluginControlClient.uninstall(item.id, requireNotNull(data.adminRevision))) }
            }
        }
    }
    private fun discover() {
        val data = inventory ?: return
        ui.text(MoteI18n.text("读取兼容发布包，预览版本、能力与访问范围后安装。GitHub 数据连接器仍在资料来源中管理。"))
        if (!data.installation.optBoolean("supported")) ui.text(data.installation.optString("reason", MoteI18n.text("当前节点不支持在线安装。")))
        val repository = ui.field(MoteI18n.text("GitHub 仓库")); val tag = ui.field(MoteI18n.text("发布标签（可选）"))
        ui.button(MoteI18n.text("预览发布包"), true) {
            val control = api; val selectedRepository = repository.text.toString().trim(); val selectedTag = tag.text.toString().trim()
            require(selectedRepository.isNotBlank()) { MoteI18n.text("请填写 GitHub 仓库。") }
            ui.work(MoteI18n.text("正在解析…"), { control.resolve(selectedRepository, selectedTag) }) { preview -> installation(preview, requireNotNull(data.adminRevision)) }
        }.isEnabled = data.installation.optBoolean("supported")
        data.catalog.forEach { entry -> val target = ui.card(); ui.text(entry.getString("name"), NativeFontRole.SECTION, target); ui.text(entry.getString("description"), parent = target); ui.text(entry.getString("repository"), NativeFontRole.META, target); ui.button(MoteI18n.text("选择仓库"), parent = target) { repository.setText(entry.getString("repository")); tag.setText("") } }
    }
    private fun installation(preview: JSONObject, revision: Long) {
        close(); listVisible = false; body.removeAllViews(); screens.setBack { load() }
        ui.text(MoteI18n.text("安装预览"), NativeFontRole.TITLE_MOBILE); ui.text(preview.getString("name") + " · " + preview.getString("version"), NativeFontRole.ROW)
        val target = ui.card(); source(preview.getJSONObject("source"), target)
        ui.text((if (preview.getString("runtime") == "worker") MoteI18n.text("中央 Worker") else MoteI18n.text("独立服务")) + if (preview.getBoolean("restartRequired")) " · " + MoteI18n.text("安装后需重启") else "", parent = target)
        ui.text(MoteI18n.text("访问声明") + " · " + PluginControlProjection.strings(preview.getJSONArray("access")).joinToString(" · ").ifBlank { MoteI18n.text("没有访问声明") }, parent = target)
        ui.text(MoteI18n.text("依赖") + " · " + PluginControlProjection.strings(preview.getJSONArray("dependencies")).joinToString(" · ").ifBlank { MoteI18n.text("无声明依赖") }, parent = target)
        capabilities(PluginControlProjection.capabilities(preview.getJSONArray("capabilities")), target)
        ui.text(MoteI18n.text("可信插件代码拥有中央宿主权限；访问声明不是沙箱隔离。安装完成后仍需配置、启用与绑定。"), parent = target)
        PluginControlProjection.strings(preview.getJSONArray("issues")).forEach { ui.text(it, parent = target) }
        val intent = PluginControlClient.install(preview, revision)
        ui.button(MoteI18n.text("安装此版本"), true) { submit(intent) { tab = "installed"; load() } }.isEnabled = preview.getBoolean("installable") && inventory?.installation?.optBoolean("supported") == true
        ui.button(MoteI18n.text("取消")) { load() }
    }
    private fun configuration(item: PluginPackage, instance: PluginInstance?) {
        close(); val control = screens.client
        ui.work(MoteI18n.text("正在读取…"), {
            val models = if ((instance?.fields ?: item.fields).any { it.type == "model-profile" }) {
                val raw = control.get("/api/models"); JSONObject().put("profiles", org.json.JSONArray().apply { for (kind in listOf("personal", "shared")) for (model in PluginControlProjection.objects(raw.getJSONArray(kind))) put(JSONObject().put("id", "$kind:"+model.getString("id")).put("name", model.getString("name"))) })
            } else JSONObject()
            models.put("sources", control.get("/api/sources").getJSONArray("items"))
        }) { models -> buildConfiguration(item, instance, models) }
    }
    private fun buildConfiguration(item: PluginPackage, instance: PluginInstance?, models: JSONObject) {
        body.removeAllViews(); listVisible = false; val fields = instance?.fields ?: item.fields; val initial = instance?.configuration ?: JSONObject()
        ui.text(MoteI18n.text("配置实例"), NativeFontRole.TITLE_MOBILE); ui.text(MoteI18n.text("配置实例与资料范围，再单独启用。启用不会自动替换当前记忆方案。"))
        val name = ui.field(MoteI18n.text("实例名称"), instance?.name ?: item.name)
        val previousGrants = instance?.definition?.getJSONObject("grants")
        val selectedCapabilities = linkedMapOf<String, CheckBox>(); val selectedSources = linkedMapOf<String, CheckBox>()
        val rawPackage = PluginControlProjection.objects(inventory?.declarations?.getJSONArray("packages")).single { it.getString("id") == item.id }
        for (capability in PluginControlProjection.strings(rawPackage.getJSONArray("declaredCapabilities"))) {
            selectedCapabilities[capability] = CheckBox(ui).apply { text = capability; isChecked = capability in PluginControlProjection.strings(previousGrants?.getJSONArray("capabilities")); body.addView(this); MoteUi.styleTree(this) }
        }
        ui.text(MoteI18n.text("资料范围"), NativeFontRole.SECTION)
        for (source in PluginControlProjection.objects(models.getJSONArray("sources"))) {
            selectedSources[source.getString("id")] = CheckBox(ui).apply { text = source.getString("name"); isChecked = source.getString("id") in PluginControlProjection.strings(previousGrants?.getJSONArray("sourceIds")); body.addView(this); MoteUi.styleTree(this) }
        }
        val history = CheckBox(ui).apply { text = MoteI18n.text("历史授权范围"); isChecked = previousGrants?.getBoolean("history") == true; body.addView(this); MoteUi.styleTree(this) }
        fun grants() = JSONObject().put("capabilities", org.json.JSONArray(selectedCapabilities.filterValues { it.isChecked }.keys.toList())).put("sourceIds", org.json.JSONArray(selectedSources.filterValues { it.isChecked }.keys.toList())).put("history", history.isChecked)
        ui.text(MoteI18n.text("由中央节点核验授权范围；填写范围不会授予新的数据权限。"), NativeFontRole.META)
        val reads = linkedMapOf<String, () -> Any?>()
        fields.forEach { field ->
            when (field.type) {
                "boolean" -> { val toggle = CheckBox(ui).apply { text = field.label; isChecked = initial.optBoolean(field.id) }; body.addView(toggle); MoteUi.styleTree(toggle); reads[field.id] = { toggle.isChecked } }
                "select", "model-profile" -> {
                    val options = if (field.type == "model-profile") PluginControlProjection.objects(models.optJSONArray("profiles")).map { it.getString("id") to it.getString("name") } else field.options
                    val choices = listOf("" to MoteI18n.text("请选择")) + options
                    ui.text(field.label, NativeFontRole.SUPPORT)
                    val select = Spinner(ui).apply { contentDescription = field.label; adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, choices.map { it.second }); setSelection(choices.indexOfFirst { it.first == initial.optString(field.id) }.coerceAtLeast(0)) }; body.addView(select, LinearLayout.LayoutParams(-1, ui.moteDp(52))); reads[field.id] = { choices[select.selectedItemPosition].first }
                }
                "text", "secret-reference", "number" -> {
                    val input = ui.field(field.label, if (initial.has(field.id)) initial.opt(field.id)?.toString().orEmpty() else "")
                    if (field.type == "number") input.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL or InputType.TYPE_NUMBER_FLAG_SIGNED
                    reads[field.id] = { val text = input.text.toString(); if (field.type == "number" && text.isNotBlank()) text.toDoubleOrNull() ?: text else text }
                    if (field.type == "secret-reference") ui.text(MoteI18n.text("仅填写服务器保存的凭据引用，不填写凭据本身。") + if (instance?.secretStatus?.optBoolean(field.id) == true) " " + MoteI18n.text("服务器已配置凭据。") else "", NativeFontRole.META)
                }
                else -> ui.text(MoteI18n.text("此配置字段暂不支持：{0}", field.label))
            }
            if (field.description.isNotBlank()) ui.text(field.description, NativeFontRole.META)
        }
        if (instance == null && item.fields.isEmpty()) ui.text(MoteI18n.text("先创建实例，中央节点返回此插件的配置字段。"))
        fun collect() = JSONObject(initial.toString()).apply { reads.forEach { (id, read) -> val value = read(); if (value == null || value == "") remove(id) else put(id, value) } }
        fun dirty() = name.text.toString() != (instance?.name ?: item.name) || grants().toString() != (previousGrants ?: JSONObject().put("capabilities", org.json.JSONArray()).put("sourceIds", org.json.JSONArray()).put("history", false)).toString() || collect().toString() != initial.toString()
        fun back() { if (dirty()) { screens.setBack { back() }; screens.confirm(MoteI18n.text("取消"), MoteI18n.text("有未保存的修改。离开并丢弃修改？")) { load() } } else load() }
        screens.setBack { back() }
        ui.button(if (instance == null) MoteI18n.text("创建实例") else MoteI18n.text("保存配置"), true) {
            val selectedConfiguration = collect(); val selectedName = name.text.toString().trim()
            require(selectedName.isNotBlank() && PluginControlProjection.configured(fields, selectedConfiguration, instance?.secretStatus)) { MoteI18n.text("请检查必填字段与配置值。") }
            val intent = PluginControlClient.configureOwned(item.id, instance?.definition, instance?.revision ?: requireNotNull(inventory).revision, selectedName, selectedConfiguration, grants())
            submit(intent) { load() }
        }
        ui.button(MoteI18n.text("取消")) { back() }
    }
    private fun memory() {
        val view = binding ?: return
        val revision = view.getLong("revision"); val active = view.getJSONObject("binding")
        fun bindingName(value: JSONObject): String = if (value.getString("kind") == "builtin") MoteI18n.text("内置记忆方案") else inventory?.instances?.find { it.id == value.getString("instanceId") }?.name ?: value.getString("instanceId")
        val target = ui.card(); ui.text(MoteI18n.text("自动记忆"), NativeFontRole.SECTION, target)
        ui.text(MoteI18n.text("当前准入代次 {0}", view.getLong("generation")), parent = target)
        ui.text(MoteI18n.text("外部结果待确认 {0}", view.getInt("pendingExternal")), parent = target)
        val desired = view.getBoolean("desired"); var resetting = false
        val toggle = Switch(ui).apply { text = MoteI18n.text("自动记忆"); isChecked = desired; setOnCheckedChangeListener { _, _ -> if (!resetting) { resetting = true; isChecked = desired; resetting = false; if (!ui.isWorking) submit(PluginControlClient.memoryControl(if (desired) "pause" else "resume", revision)) } } }; target.addView(toggle); MoteUi.styleTree(toggle)
        ui.button(MoteI18n.text("立即停止自动记忆"), parent = target) { screens.confirm(MoteI18n.text("立即停止自动记忆"), MoteI18n.text("撤销旧任务继续写入的权限，并请求取消运行中的自动记忆任务。外部工作可能无法立刻停止，未确认结果会单独保留。")) { submit(PluginControlClient.memoryControl("stop", revision)) } }
        ui.text(MoteI18n.text("当前记忆方案") + " · " + bindingName(active), NativeFontRole.SECTION)
        ui.text(MoteI18n.text("绑定版本") + " · " + active.getLong("revision"))
        ui.text(MoteI18n.text("准备与生效分开执行。只有范围、正文与索引核验通过后，才能切换写入与查询绑定。"))
        val eligible = inventory?.instances.orEmpty().filter { it.desired && it.checked && PluginControlProjection.strings(it.definition?.getJSONObject("grants")?.getJSONArray("capabilities")).any { capability -> capability in setOf("repository", "engine") } }
        val choices = listOf("" to MoteI18n.text("内置记忆方案")) + eligible.map { it.id to it.name }
        val select = Spinner(ui).apply { contentDescription = MoteI18n.text("记忆方案"); adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, choices.map { it.second }); setSelection(choices.indexOfFirst { it.first == active.optString("instanceId") }.coerceAtLeast(0)) }; body.addView(select)
        ui.button(MoteI18n.text("预览更换")) {
            val next = choices[select.selectedItemPosition]
            close(); listVisible = false; body.removeAllViews(); screens.setBack { load() }
            ui.text(MoteI18n.text("更换方案预览"), NativeFontRole.TITLE_MOBILE); ui.text(bindingName(active) + " → " + next.second)
            ui.text(MoteI18n.text("迁移全部 Mote 保留记忆正文及更正/替代状态。外部原生审计历史和引擎图保留在旧实例及运行备份中，不承诺跨引擎迁移。"))
            val fee = CheckBox(ui).apply { text = MoteI18n.text("已确认范围。真实接入可能产生模型与 Embedding 费用，费用以实际服务用量为准。") }; body.addView(fee); MoteUi.styleTree(fee)
            val start = ui.button(MoteI18n.text("开始准备"), true) { check(fee.isChecked); submit(PluginControlClient.prepareBinding(next.first.takeIf { it.isNotEmpty() })) }.apply { isEnabled = false }
            fee.setOnCheckedChangeListener { _, checked -> start.isEnabled = checked }; ui.button(MoteI18n.text("取消")) { load() }
        }.isEnabled = preparedBinding == null
        preparedBinding?.let { prepared ->
            val card = ui.card(); ui.text(MoteI18n.text("方案准备") + " · " + prepared.getString("state"), NativeFontRole.SECTION, card)
            ui.text(bindingName(prepared.getJSONObject("source")) + " → " + bindingName(prepared.getJSONObject("target")), parent = card)
            prepared.optJSONObject("task")?.let { task -> ui.text(task.getString("id") + " · " + task.getString("state"), parent = card); task.optString("error").takeIf { it.isNotEmpty() }?.let { ui.text(it, parent = card) }; if (task.getString("state") in setOf("failed", "blocked")) ui.button(MoteI18n.text("重试准备"), parent = card) { submit(PluginCommandIntent("/api/tasks/" + CentralScreens.encode(task.getString("id")) + "/retry", "POST", "{}")) } }
            if (prepared.getString("state") == "verified") ui.button(MoteI18n.text("设为当前方案"), true, card) { submit(PluginControlClient.bindingControl(prepared.getString("id"), "activate", revision)) }
            if (prepared.getString("state") !in setOf("activated", "cancelled")) ui.button(MoteI18n.text("取消准备"), parent = card) { submit(PluginControlClient.bindingControl(prepared.getString("id"), "cancel", revision)) }
        }
    }
    private fun source(value: JSONObject, target: LinearLayout) { ui.text(value.getString("repository"), NativeFontRole.SUPPORT, target); ui.text(MoteI18n.text("固定版本") + " · " + value.getString("tag") + " · " + value.getString("commit"), NativeFontRole.META, target); ui.text(MoteI18n.text("完整性摘要") + " · " + value.getString("digest"), NativeFontRole.META, target) }
    private fun capabilities(values: List<PluginCapability>, target: LinearLayout) { values.forEach { ui.text(it.id + " · " + capability(it.state), NativeFontRole.SUPPORT, target); if (it.reason.isNotBlank()) ui.text(it.reason, NativeFontRole.META, target) } }
    private fun capability(state: String) = when (state) { "verified" -> MoteI18n.text("已核验"); "unsupported" -> MoteI18n.text("不支持"); else -> MoteI18n.text("尚未核验") }
    private fun state(state: String) = when (state) { "installed" -> MoteI18n.text("已安装"); "installing" -> MoteI18n.text("正在安装"); "failed" -> MoteI18n.text("安装失败"); "restart-required" -> MoteI18n.text("等待节点重启"); "enabled" -> MoteI18n.text("已启用"); "disabled" -> MoteI18n.text("已停用"); "unconfigured" -> MoteI18n.text("待配置"); "draining" -> MoteI18n.text("停用中"); "blocked" -> MoteI18n.text("需要处理"); else -> state }
}
