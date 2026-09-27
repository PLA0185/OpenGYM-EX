# 整库高清图片与动画接入

用户要求所有动作图片和动画都高清。当前用户尚未取得完整素材包，本阶段完成接入准备，不宣称整库替换已完成。现有 11 个动作的高清两帧照片不能替代全部动画。

## 素材与对应关系

需要每个内置动作各一张 JPEG 和一个真实多帧 GIF，共 1324 对。图片与动画短边均至少 720 像素，优先 1080；不能把 180 素材放大当作高清。完整动画必须至少两帧，实际清晰度、姿势和动作仍要视觉审核。

输入清单的每行需要 exerciseId、nameEn、image、animation，供应商 sourceName 和 sourceVersion 必填。路径相对清单文件。只允许确切 ID 与名字匹配，不能凭名字相近就替换动作。不同供应商 ID 先人工映射到应用 ID；映射不通过会报告错误。

```json
{
  "sourceName": "实际供应商",
  "sourceVersion": "实际版本",
  "exercises": [
    {"exerciseId": "0025", "nameEn": "barbell bench press", "image": "images/0025.jpg", "animation": "animations/0025.gif"}
  ]
}
```

## 批量导入

```powershell
Set-Location D:/OpenGYM-EX
python -X utf8 scripts/data/import-hd-media.py --template
# 生成全部 1324 个 ID／英文名的模板 data/raw/hd-media-template.json。
# 将模板放进素材目录，填写真实来源、版本和文件路径。
python -X utf8 scripts/data/import-hd-media.py D:/素材目录/manifest.json
# 先审核 data/raw/hd-media-report.json 的缺失、低分辨率、静态 GIF、错名与重复项。
python -X utf8 scripts/data/import-hd-media.py D:/素材目录/manifest.json --apply
```

默认检查不写运行素材。--apply 只有覆盖全部 1324 个动作且没有错误才替换，拒绝将一部分高清包装成整库完成。先在临时目录准备全部文件、检查来源没有在过程中变化，再复制到现有 img／gif 路径；完整 SHA-256 写入 media-manifest.json，高清真实尺寸写入 exercise-hd.json。

运行界面优先新高清动画、暂停显示高清静图，卡片使用同一高清图；不会再优先用原有 11 张照片替代整库高清动画。显示实际尺寸。构建校验图像、动画哈希与高清覆盖信息，素材缺失或标记不匹配会失败。重建原始 180 素材会清除高清标记，防止误报。

## 打包与保留

```powershell
Set-Location frontend
npm run build:windows
Set-Location ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1
node scripts/verify-windows.mjs artifacts/windows/OpenGymEX-2.0.2-portable.exe
```

首次依赖准备／data:bootstrap 会恢复原始素材；如要高清，请在 bootstrap 后重新执行高清导入，然后构建。保留供应商原包、完整清单及许可，原包放私人目录，不上传公共源码。导入器只读取本地文件，不购买、抓取或执行供应商代码。新购买格式如为 MP4，需增加原生视频播放和视频元数据校验，不能改后缀当作 GIF 导入。

## 来源核查

[ExerciseDB 官方 FAQ](https://exercisedb.io/faq) 宣称 Pro 提供 720／1080 GIF，与当前 0025 等 ID 配对；这只是可用来源线索，未取得完整包，不保证用户购买包对当前 1324 个动作的实际覆盖或清晰度。应先审看样例、核对 ID 与素材质量，再决定来源。也可使用已经取得的 Gymvisual 高清原素材，按实际命名建立人工映射。

验证命令：python -X utf8 scripts/data/test-hd-media.py。覆盖尺寸与动画结构、截断、低分辨率、静态动画、错名和不完整覆盖拒绝。
