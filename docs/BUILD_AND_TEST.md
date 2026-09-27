# 构建、运行与更新

本次开发环境为 Windows x64，Node.js + Python 3，JDK 21，Android SDK 36，AGP 8.10.1，Gradle wrapper 8.14.3。默认 Android 工具位置为 `D:/DeepSeekHarnessData/jdk-21`、`D:/DeepSeekHarnessData/android-sdk`，脚本优先使用已设置的 JAVA_HOME、ANDROID_HOME。Node 和 Python 在 PATH。Electron 与 Android 插件的精确版本以 package-lock.json 为准；Android 要求最低 API 23。

## 数据与依赖

```powershell
Set-Location D:/OpenGYM-EX/frontend
npm ci
npm run data:bootstrap
```

第一次数据准备会下载锁定来源的大文件，已有文件则跳过下载。转换脚本核对原始 SHA-256，来源变动时失败，不能静默换版本。文本种子和 HowToCook 图片已进源码，2648 个动作媒体通过 bootstrap 恢复；构建前再次逐文件核对大小与 SHA-256。没有素材或发现损坏时构建失败。原始下载及私人数据在 data/raw，Git 不备份该目录。若 Electron 官方下载受限，可设置可信的 ELECTRON_MIRROR 后重新 npm ci；本次使用已安装的 Electron distribution 打包。

## 双端产物

```powershell
Set-Location D:/OpenGYM-EX/frontend
npm run build:windows
Set-Location ..
pwsh -NoProfile -File scripts/build-release.ps1
```

Windows：`artifacts/windows/DongQi-2.0.1-portable.exe`；目录版本入口 `artifacts/windows/win-unpacked/DongQi.exe`，使用目录版须保留整个目录。便携 EXE 解包后运行，不依赖本地开发服务器。没有购买代码签名证书，不能声称 Windows 发布者签名已通过。数据位于 Windows AppData 的 Xunlian 用户目录，替换 EXE 不替换个人数据。

Android：`artifacts/DongQi-2.0.1-personal.apk`，applicationId=`app.xunlian.personal`，版本2.0.1-dev / versionCode 20001，最低 Android 6（API23）、target36。使用本项目生成的个人签名，已校验 APK v1/v2/v3。它是可安装的个人开发包，不是已通过所有设备验收的正式发行版。需要调试版时运行 `scripts/build-android.ps1`，输出 `artifacts/DongQi-2.0.1-dev.apk`。调试和个人 Release 签名不同，切换时可能不能覆盖安装；先从 App 设置导出数据再处理旧安装。

Android 签名证书 SHA-256：`100d6bb2cc70e95b8b203935bbdc62de4f15a5e478465c78aafd74e77d60285f`。

签名材料保存在项目根目录 `.private-signing/`，不进入 Git，也不进入 APK。必须保留原 keystore 才能覆盖升级；密码文件通过当前 Windows 账户 DPAPI 保护，不能假设复制到新机器就能解密。在旧机器可解密时，由所有者另行做好安全的密码与 keystore 备份。本次未向远程仓库上传私钥或密码。后续升级需增加 versionCode 并保持 applicationId 与签名一致。

## 验证

```powershell
Set-Location D:/OpenGYM-EX/frontend
npm test
npm audit
Set-Location ../api
npm test
Set-Location ..
node scripts/verify-windows.mjs
```

Windows 验证器运行真正打包后的 EXE，使用隔离的测试目录，不读取个人资料或真实 Key；检查中文启动、六条离线路由、图片解码、全部媒体哈希、凭据加密与文件读写。主动关闭启动器的 stdout/stderr 管道后再次写诊断数据，覆盖用户报告的 EPIPE 崩溃。结果保存 `data/raw/windows-verify.json`，失败时进程返回非零且隔离目录保留报告。

设置页面可以导出 JSON 并在另一端恢复；恢复先校验结构、日期、数值、训练与建议，不合格文件不覆盖当前数据。Key 不随备份，需在另一端重新配置。普通功能本地工作，不包含双端云同步；手动导出/导入是当前迁移方式。Android 真机和真实 DeepSeek 调用仍需完成，参见交付状态。

## 阶段备份

Git remote：origin 为所有者私有仓库，upstream 保留原 openGym。main 保留完整历史。每阶段提交后推送；源码重建依赖锁定来源，产物哈希记录在交付状态及本地 SHA256SUMS。切勿把 .private-signing、API Key、个人记录或 node_modules 纳入提交。

## 2.0.1 名称与训练界面修订

显示名称暂定动起。Windows文件使用DongQi，仍保留历史Xunlian数据目录；Android仍使用原applicationId和原签名，versionCode增加为20001，可覆盖本项目2.0.0个人签名包。完成弹窗/总结/纪录已统一双语；训练值按已采纳AI微调/来源明确参数预填；缺少来源重量时使用有效近期记录或首次个人基线，不能猜公斤数。来源方案不套用旧版0负重/10次兜底。组间休息随动作保存并实际计时，缺失时明确标注90秒应用默认值；复制剩余组只是辅助，不修改已完成组或复制RPE/RIR。

Windows便携EXE包含大量离线媒体，启动前需解包。2.0.0采用嵌套7z，60秒测试窗口不足，延长后通过；2.0.1改用直接zlib打包减少解包负担。目录版入口启动较快，必须保留整个win-unpacked目录。


## 训练来源与复盘使用

训练资料库 → 导入 → 直接读取原文参数，可离线读取“杠铃卧推 40kg 3组×8次 休息120秒”。审核页检查数字、重量单位、训练日及来源全文，再应用到周计划。缺少组次须补全；只有负重基线缺失可保留待确认，但训练中不允许把空白负重勾选为完成。已有导入方案在下次开始训练时升级为来源优先，当前已开始的训练不被重建。

复盘须启用并配置自己的DeepSeek Key。训练参数微调由近90天完成记录校验，人工采纳后才应用；源文件/历史实际值保持不变，可用复盘页撤销最近的方案改动。旧版主动启用的进阶策略仍可在动作配置中选择；新来源方案默认关闭旧进阶，避免未确认的历史策略覆盖导入数值。
