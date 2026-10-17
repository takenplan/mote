# 最终C：合法附件Material阻止个人导出（actual RED）

源码 C `f1be61eed018b913bfa8beb2957256676b7e2f6c`，不可变清单SHA256
`acfd08288177b232f86c166cc323d74880d655b809c7e4ff987362f0691ce036`。本项阻止个人恢复R3/最终E8验收。
当前不改公共生产源码、不改变C，不把其它局部通过当作该项通过。

恢复路先在新编译Docker实际portable导出复现，再在新恢复Node实例复现；本路随后独立执行最小测试，
同C编译服务实际0pass/1fail、0skip、EXIT1。仅合成账号/目录/字节，真实M03原件、附件join、
M05/M06 text.utf8、Material发布和M16导出；无图片/自定义recipe/Docker依赖，无SQL seed。
最小测试由Recovery编写，本提交逐字保存，仅文件位置变化：
[可重复测试](../../scripts/validation/final-e2e-attachment-personal-export.test.ts)。

```sh
npm run build:libs
npm run build -w @mote/server
MOTE_FINAL_RECOVERY_WORKSPACE=/absolute/path/to/clean/compiled/C \
  node --import tsx --test scripts/validation/final-e2e-attachment-personal-export.test.ts
```

预期：真实附件处理已成功、parent Material包含合法asset，个人导出receipt最终completed。
实际：receipt.state=failed/error=domain_export_failed。private-data生命周期exportUser validate
在 `apps/server/src/scope/private-data-lifecycle.ts:133` 硬拒 `block.kind !== text`。
真实发布draft.blocks为[text,text,asset]及历史[text,text,text,asset]；hash/id/source/external/
parent/text条件全部通过，其余13个domain export均成功。draftSchema本身允许asset，不能把这条
正向产品路径当坏fixture，或删除附件/清库来使导出通过。

原owner需要保留完整权限、引用、成员和导入原子校验；本路没有提出直接移除所有校验的补丁。
最终修复应以该真实正例及非法/跨用户asset引用负例、历史版本与重新导入验证收口。

证据索引（全部Git外，合成数据）：

- 本路独立log `/tmp/mote-final-C-personal-asset-red.log`，SHA256 `01ab8566cce0c0eca1b5c90a4a1c1a1cf8e80f98df514ad0afbc0dea8f1df449`。
- 本路exit `/tmp/mote-final-C-personal-asset-red.exit`，值1。
- 原最小test SHA256 `f25db2174ab14caa2b013ba9b920ecfc826663be44ee9b0d5795533abcdd4c76`。
- Recovery `/tmp/mote-final-recovery7-192bf10a-8608-4e04-964a-1fa9d3087301/attachment-export-red.log`，0/1、1.836s。
- 同目录 `personal-domain-diagnostic.json`、`personal-material-integrity-diagnostic.json`。

本项为新实际生产阻塞，需父指派原生命周期/Material owner进行有界修复。原owner整套旧gate红保留。
Android代理/Java版本、Web规范loopback夹具问题均独立记录，不混为本项生产原因。
