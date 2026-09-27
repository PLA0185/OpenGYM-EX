# 离线数据与来源

实际下载版本及 SHA-256 见 `data/sources.lock.json`；构建统计见 `data/build-report.json`。`scripts/data/bootstrap.mjs` 从锁定 URL 获取缺失原始文件，再执行 seed、素材、参考配方构建；种子随 App 内置，普通使用不会下载巨型数据库。

| 数据 | 本次来源与处理 |
|---|---|
| USDA FDC | Foundation 2026-04、SR Legacy 2018-04、FNDDS 2021–2023；过滤缺失能量记录，保存真实 FDC ID、每 100g 营养、生熟状态、版本与原名称 |
| HowToCook | commit `a2d45c6984dff9ee941da0e7c452f7965965d962`；373 道来源配方、原文、步骤；176 个来源配方带本地图片；Unlicense |
| 本地组合 | 8 个自行编排的餐食组合；建议克数明确标估算，不能标成 HowToCook 官方营养 |
| 合作方食谱 | Nutrition.gov 收录的伊利诺伊大学 Breakfast Smoothie；使用配方事实和自写中文步骤，不打包原站图片；按 FDC 份量提示换算克数，一把菠菜标估算 |
| 动作 | 固定原仓库 commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`；1324 个真实 Exercise ID、来源文字、中文步骤；图片+GIF 共2648个离线文件，逐文件校验 |
| MET | 2024 Adult Compendium 的六个原活动代码和原 MET，中文说明；人工选择参考活动或输入范围，始终标估算，不自动叠加 TDEE |
| 指南模板 | 依据 CDC 对成人每周至少150分钟中等有氧、至少两天主要肌群力量活动的原则，自行整理力量模板；明确有氧须另行安排，不冒充 CDC 原创固定训练表 |

FDC 来源：[下载](https://fdc.nal.usda.gov/download-datasets/)、[FAQ/公共数据说明](https://fdc.nal.usda.gov/faq.html)。来源配方：[HowToCook](https://github.com/Anduin2017/HowToCook)、[Nutrition.gov 早餐奶昔](https://www.nutrition.gov/recipes/breakfast-smoothie)。参考：[成人活动指南](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html)、[Compendium 活动表](https://pacompendium.com/conditioning-exercise/)、[使用说明](https://pacompendium.com/)。

## 质量边界

不能把原方的“适量”“几个”“约几克”“范围数量”“乘份数”都当作精确克数。转换器优先读取计算章节，避免工具和重复原料进入配方；范围及复杂算式保留为未知，不偷取最后一个数字。未知份数的原方须编辑副本确认。历史摄入和餐食保存食材、克数及营养快照，修改食谱不会改变过去记录。

13,545 条食材中 81 条精确中文译名得到人工匹配，其余只是类别译名，保留完整英文区别。动作中 15 个常用名称人工校对，其余为术语组合翻译，部分仍待细译。大量 HowToCook 原料及数量待用户或后续人工整理；本版不声称全部来源配方营养完整。MyPlate cookbook 原官网返回403，本次未冒充下载成功；补入可实际下载的合作方页面配方。

营养目标使用 Mifflin–St Jeor 简化方程估计静息能量，活动系数及 1.6g/kg 蛋白、0.8g/kg 脂肪是可编辑的产品建议，非测量值或个体医疗处方。依据方程原文记录：[PMID 2305711](https://pubmed.ncbi.nlm.nih.gov/2305711/)。特殊情况和未成年人不自动计算，可手动设置目标。热量消耗是总能耗估算，包含静息部分。

## 动作媒体授权状态

动作仓库的文字/工具 MIT 许可**不授予 Gym visual 媒体许可**。原许可保留在 `data/EXERCISE_LICENSE.txt`。用户于2026-09-27明确说明会取得授权，并要求继续正常打包；因此本次按用户指示产出个人开发包并内置素材，**取得授权的证据尚未提供，不能标为已授权或公开再分发**。来源清单与 manifest 都记录 `permission-pending`。媒体文件没有推入 Git 仓库；构建脚本可从固定原始公开来源重建。发布权限应在取得的授权范围内另行核对。


## 2026 抗阻指南与负荷换算

新增 [ACSM 2026 官方说明](https://acsm.org/resistance-training-guidelines-update-2026/) 整理模板：力量目标约80%1RM、每动作2–3组、每周至少两次主要肌群训练。这里只整理原则和自行编排动作；5次、180秒休息标为应用编排字段，不是官方发布的固定训练课。内置共9个自编模板+2个指南整理模板。

指南比例使用同动作近90天已完成负重和1–12次记录，通过已有Epley估算1RM后换算（估算值向下到0.5个人重量单位），或使用首次用户确认基线。无个人基线留空，徒手为0外部负重；不以身高、体重、性别猜工作重量。明确导入重量无需该估算，直接按原文与单位转换预填。来源原文保留供核对，AI解析结果仍须审核。
