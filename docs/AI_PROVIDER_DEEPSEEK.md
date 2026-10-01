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


2.0.3 手机反馈定位：已启用 AI 且连接成功，开始对话返回 questions 校验失败。截图没有原始返回值，因此不能断言它究竟是数量过多、对象类型或其他结构问题。修复为 1–12 个问题、问题对象／逐行字符串的无损表示归一化、可省略摘要；不放宽训练或营养数值校验。完整 JSON Schema 给出必填、类型、数组数量和范围；失败修复请求携带具体字段及类型原因。格式仍不通过时只对追问使用明确标注的本机问题，绝不把本机问题当作 AI 计划，也不以回退掩盖鉴权／网络失败。

新增回归：成功连接 → 八个问题对象 → 用户回答 → 新训练和七天餐食审核。运行实际 Windows 包与窄屏界面，但提供商响应为 Mock；手机账号真实响应未由开发环境代发。

## 2.0.4 当前教练协议（取代旧长追问流程）

Assistant使用brief协议，不再使用历史1–12问题intake界面。COACH_BRIEF_PROMPT在coach-workflow.js固定产品目标、必要条件和来源边界；每次输入用户原话、现有档案及已有答案。brief只允许0–3个必要问题，已知身体资料/限制不重复问；回答后不得再次发一轮问题。默认的训练天数、时长和低冲击不伪装成用户条件，建议必须列assumptions。缺身体必要资料不猜年龄/体重。

没有问题直接生成；有问题只填写必要答案后直接生成结果。生成/修改没有重复确认表，正式应用仍由明确按钮执行，以保护现有方案。提案在本地保存，可离页恢复；方案revision变化后旧结果不能直接应用。

模型只从真实候选动作/配方选实体；requiredSlots由餐数规则提供。收到训练+餐食后，本地校验实体、日期、时长、排除项、素食、备餐时长、重复次数和价格完整时的预算。本地按真实每100g数据校准份量；原组合不能达成目标时采用明确标注的可行候选组合，再以原能量20%/蛋白30%且最低20g容差严格校验，不把放宽目标当修复。缺价格显示预算未验证，不编价格。

手动营养目标保留；身体资料/活动/目标改变时估算目标按真实资料重算。个人输入/模型内容均为数据，不授权网络抓取或工具执行；来源旧文不覆盖后续用户约束。Mock包括超目标份量、0问/1问、对象问题、餐数/预算/重复/素食和提案恢复，真实账号生成仍待用户安装2.0.4实测。

## 2.0.6 照片估算

按[官方Vision接口](https://api-docs.deepseek.com/guides/vision/)发送用户文本+image_url数据URL，使用deepseek-flash；不改写文本模型偏好。图片在发请求前压缩/去EXIF，只在当前页面内存暂存。AI只从供应食物ID识别并估克数区间，本地计算营养；需补充时不产生虚假实际记录。识别成功先幂等记录估算摄入，再明确选择是否替换同日期同餐次计划。

格式校验通过不等于估算准确；不得声称仅凭照片知道精确油量或全部热量。模拟测试未使用私人真实Key。

## 2.0.7 知识先行、恢复与菜式变化

coach-knowledge.js集中统一生成提示词，提炼已有官方资料及恢复公开指导。brief阶段先给来源/规则，再给用户条件；生成补入每来源最多两套相关真实预设参数、原始限制、实际候选动作/食谱及本地目标。AI先分析来源和适用范围，不把示例当用户条件；referenceGuideIds仅接受提供的来源。结果显示输入的知识来源，明确这不是模型逐本阅读全文的证明。

只指定每周次数时允许分散星期，固定可用星期保留；本地按同主要肌群和努力程度核对循环周恢复，新手力量次数限幅。现成联合方案同样先过滤来源动作/恢复/时间/星期，去重ID，按合格集合取回结果。原可行菜单只是营养可行性证据，不能要求七天照抄；本地校准和替代也按跨日使用量与硬约束选择。真实个人Key未由开发代测，格式修复/领域限制仍可能在实际模型回答中需要调整，应保留脱敏的具体字段原因。
