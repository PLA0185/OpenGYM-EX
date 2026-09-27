# 动起 2.0.1 当前交付状态

日期：2026-09-27。V6 为完整执行目标；当前为可运行的双端阶段开发版，不将成功打包当作全部验收完成。私有源码备份：[GitHub](https://github.com/PLA0185/xunlian-2)，保留原 openGym 完整提交历史。前置阶段的2.0.0 EXE/APK及校验值已备份到私有草稿Release；当前2.0.1安装包在本机 artifacts 中，源码已按阶段推送。

## 已实现

| 范围 | 当前行为 |
|---|---|
| 双端本地 | 同一 React/训练引擎，Windows Electron + Android Capacitor；普通功能离线启动，无需服务端账号 |
| 来源预填 | 原文明确重量、组数、次数/时长及休息优先；支持kg/lb换算，保留来源全文；明确格式可离线解析，复杂原文用AI解析后审核 |
| 缺失值 | 缺少休息给出90秒应用默认值；缺少重量参考同动作近90天完成记录/首次个人基线；比例负荷用估算1RM换算，无基线留空，徒手0外部负重 |
| 实际训练 | 完成一组按动作预设自动休息，明确0秒无倒计时；来源方案默认不被旧进阶覆盖；完成弹窗/总结/纪录双语；复制仅作用于未完成组 |
| 训练资料 | 9个自编模板 + CDC、ACSM 2026 两个指南原则整理模板；组次/时长/休息审核、动作ID映射、Apply原routines/week、估算时长/主要肌群/MET、快照回退 |
| AI微调 | 周复盘携带当前方案和实际记录；可建议负重/次数/组数/休息；本地证据及幅度检查，通过后人工逐项采纳，新训练生效，可撤销，来源与已完成历史保留 |
| 营养 | 离线食材检索、克数实际摄入、9类营养；食谱图片/详情/收藏/用户副本/编辑；未知保持未知，摄入保存历史快照 |
| 周餐食 | 手动/AI七天安排、购物汇总、替换、统一档案与联合Proposal；计划不冒充实际摄入，餐食目标和排除食材有本地核验 |
| 资料与Key | 原版本迁移、双端JSON备份、错误文件不覆盖；Windows DPAPI/Android Keystore，安全存储失败会话保留；普通状态与备份排除Key |
| 主进程 | 只容忍stdout/stderr关闭管道EPIPE，不吞其他错误；隔离资料运行实际便携EXE验证；移除无运行用途的node_modules/Gradle中间物打包 |

来源说明：ACSM模板只整理官方负荷/组数/频率原则，具体动作、5次、180秒是应用编排，不能称为官方固定课程。原文缺参数不假称来源规定。百分比的公斤数是个人记录估算，不是测量值。当前已开始的训练不重建；新开始来源方案使用新预填规则。

## 实际验证

- 前端：12个文件、283项测试通过，包括原训练回归、来源与历史优先级、单位/休息/百分比换算、无基线空白、方案分享保留休息、AI微调证据及界限、营养、映射、快照、恢复和模拟DeepSeek协议。
- API：此前56项通过；本次修改不涉及API，未无理由重复运行。
- 前端npm audit此前生产/开发依赖0个已知漏洞，本次无依赖版本修改。
- Android：实际assembleRelease成功，个人RSA3072签名，APK v1/v2/v3校验；app.xunlian.personal / 2.0.1-dev / 20001 / min23 / target36。从新APK逐一读取2648个媒体验证SHA-256，4份NOTICE/许可内置。
- Windows：目录版与实际2.0.1便携EXE均通过；中文、预填保留实际记录、来源120秒倒计时、双语完成/下一动作、历史最高重量不覆盖本次确认、指南模板审核、6个离线路由、2648媒体哈希、图片解码、DPAPI与状态读写、Key排除、主动关闭输出管道EPIPE回归。包内0个node_modules文件、0个Gradle中间物。

便携EXE实际报告：

```json
{
  "status": "PASS",
  "checkedAt": "2026-09-27T11:38:34.922Z",
  "platform": "win32",
  "packaged": true,
  "checks": [
    "Chinese startup",
    "DPAPI credential round-trip and encrypted file",
    "State IPC round-trip and credential redaction",
    "Prefill preserves actual records",
    "Source 120-second rest preset and countdown",
    "Bilingual completion sheet",
    "Completion advances to next exercise",
    "Six offline routes",
    "2648 packaged media SHA-256 hashes",
    "Offline exercise image decoding",
    "Closed stdout/stderr EPIPE regression"
  ],
  "rendererErrors": [],
  "profile": "isolated verification profile; synthetic workout"
}
```

## 本地产物与校验值

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| `artifacts/windows/DongQi-2.0.1-portable.exe` | 393288180 | `5bff0f107867c860c2a40be2c15c57e237a0a40485c66191c03cce6a9b3a0c35` |
| `artifacts/DongQi-2.0.1-personal.apk` | 252891366 | `c866fa3ff308ecc26a071645bd8a941b8e323a9c6c807374e8e4fa9d20009d52` |

Android证书SHA-256：`100d6bb2cc70e95b8b203935bbdc62de4f15a5e478465c78aafd74e77d60285f`。保持原applicationId、数据目录、签名可覆盖本项目2.0.0个人签名包；Windows保留AppData/Xunlian资料目录。最新包尚未上传为新的远程Release资产，前置2.0.0资产不可误作2.0.1。源码重建命令与签名保存规则见 BUILD_AND_TEST.md。

## 尚未完成或待实测

1. Android真机：没有连接设备；已有模拟器缺少加速驱动，软件模式重启被自动审批策略拦截，未执行。不能声称安装升级、重启、Keystore、分享及全流程真机通过。
2. DeepSeek真实请求：未使用真实Key。本地校验和网络/结构/domain修复通过模拟响应测试，真实生成质量、计费请求及复杂文字提取仍待用户配置Key后验证。
3. 数据整理：13,545条食材中81条中文精确人工匹配；1324动作中15个名称人工核对，其他仍有部分英文。373道HowToCook来源配方有大量原料/份数/克数待确认；8个本地组合及1个合作方食谱可直接完整营养规划。不假称全部中文或全部营养完整。
4. 饮食约束：餐次数、重复上限、预算、器材及偏好主要进AI上下文，尚未全部转换为确定性约束校验。7天餐次/引用/目标能量蛋白及排除食材已核验，不能因此称所有偏好都已严格满足。
5. 复杂训练文本：离线解析支持明确行格式；逐组不同重量、复杂周期、文字数字等需拆行/AI解析后审核。不是所有自由格式都能一次无误导入。
6. 尚未完成全矩阵设备验收、无障碍/性能/长期数据场景；Windows无发布者证书签名。媒体授权仍待用户取得，当前仅个人开发包、私有备份，没有公开再分发。

当前是可试用阶段交付。后续逐项补齐V6验收，状态必须保持上述区分。
