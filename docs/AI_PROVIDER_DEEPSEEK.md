# DeepSeek 官方接口基线

核验日期：2026-09-27。实现：`frontend/src/lib/deepseek.js`。本记录区分接口契约、Mock 验证和真实账号验证。

| 项目 | 本次实现 |
|---|---|
| 入口 | `POST https://api.deepseek.com/chat/completions` |
| 认证 | `Authorization: Bearer <用户自行配置的 Key>` |
| 可选模型 | 官方当前模型 `deepseek-flash`、`deepseek-v4-pro`；默认 flash |
| 结构化输出 | `response_format: {type: 'json_object'}`；system prompt 明确 json 和字段示例 |
| Thinking | `thinking: {type: 'disabled'}`；结构化短任务使用非思考模式 |
| 流式 | `stream: false`；本次没有流式工具调用与 reasoning_content 多轮循环 |
| 输出上限 | `max_tokens: 8192`；`finish_reason` 非 stop 拒绝保存 |
| 超时与取消 | 每次 HTTP 尝试 90 秒，AbortController；界面可取消，离开界面取消 |
| 并发 | 本机最多两个在途 HTTP 请求；与官方账号级并发额度分开 |
| 重试 | 429/500/503 最多三次，500/1000ms 退避；400/401/402/422 不重试 |
| 修复 | 空内容、非法 JSON、schema 或领域校验失败最多修复一次；不应用失败结果 |
| 本地校验 | Zod schema；真实实体、日期餐次、份量、目标容差、排除食材、版本冲突；营养由本地计算 |

官方 rate limit 当前按账号并发控制；不可沿用“永无限制”的旧说法。模型、限额与上下文上限可能变化。本实现没有设置官方说明在思考模式下无效的采样参数，也不会把模型错误正文直接显示为包含 Key 的日志。

资料来自 [官方文档首页](https://api-docs.deepseek.com/zh-cn/)、[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[JSON Output](https://api-docs.deepseek.com/zh-cn/guides/json_mode/)、[Thinking Mode](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)、[错误码](https://api-docs.deepseek.com/zh-cn/quick_start/error_codes/)、[限流](https://api-docs.deepseek.com/zh-cn/quick_start/rate_limit/)。JSON/thinking 指南的浏览工具超时后，另以 HTTPS 下载官方页面核对内容。

## 存储及发送范围

Android 使用本项目最小原生插件，以 Android Keystore AES-GCM 加密 SharedPreferences 的密文。Windows 使用 Electron safeStorage/Windows DPAPI，密钥文件与普通状态分开；开启 contextIsolation、sandbox、有限 IPC。安全存储不可用时，只在本次会话使用并提示。Web 使用内存。普通状态与导出递归清除密钥字段。Windows DPAPI 不代表可以防御同一登录账号下所有恶意软件。

只有用户启用 AI 并点击生成/分析/复盘/测试才请求服务。界面提前说明资料范围；结构化结果必须审核后应用，不自动循环修改训练或营养。输入文本和模型内容作为数据，不能授权抓取链接或执行工具。用户的其他工程或系统凭据没有被读取。

依据：[Android Keystore](https://developer.android.com/privacy-and-security/keystore)、[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)。

## 测试状态

Mock 覆盖官方请求格式、Bearer、模型、错误码、重试、超时、空内容、截断、非法 JSON、schema 和领域修复。真实 DeepSeek smoke **未测**：用户已在手机配置并反馈连接测试成功，但本机未使用真实 Key。没有用其他项目的 Key，也没有把 Mock 当作联通测试。

独立命令：`node frontend/scripts/deepseek-smoke.mjs` 默认 SKIP；用户在该进程环境配置 `DEEPSEEK_API_KEY` 后加 `--live` 才发送一次连接测试。后续真实验收应再覆盖训练解析、食谱解析、七天餐食和联合方案，尤其检查实际模型是否遵守本地约束。


2.0.2 增加 intake 追问与 coach 联合新方案结构。生成与连接分开验收，错误细分为未启用、目标缺失、服务／结构／实体与营养约束，并显示有限且脱敏的诊断。候选目录与真实食谱营养参与本地校验；生成的新负重不会覆盖来源或个人历史，应用保守初值仅标为试用建议。提案确认前不写正式计划，联合应用可撤销。
