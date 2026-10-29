# 大乐透每日两注

手机静态网页，每个北京时间自然日保存两注不同号码。同日刷新、跨设备打开以及当天历史更新后，已经保存的两注保持不变。浏览器只读取发布的 JSON，不重新抽号。无支付或购票功能。

历史数据来自[壹彩网公开历史页](https://www.9011.com.cn/lottery/dlt)，最新一期与[上海体彩网官方开奖公告](https://www.shsportslottery.com/dlt/kjgg.html)逐项核对期号、日期和七球，同时要求与已有快照存在内容一致的重叠记录。页面显示当日号码生成时的截止期号、训练期数、上次成功同步和当前来源状态。最终开奖以官方公告为准。

模型按历史权重抽样；初始 330 期数据的最后 100 期留出回测相对等概率基准平均对数评分差约为 −0.0053，未显示可靠预测优势。固定展示两注不提高单注中奖概率，历史拟合不能预测下期开奖。

## 本地运行

需要 Node.js 20 或更新版本，无需安装 npm 运行时依赖。在本目录执行：

```sh
node --test test/*.test.js
node scripts/probe.js
node scripts/update.js
node scripts/build.js
```

`probe.js` 只读核对真实来源；`update.js` 更新本地 `data/*.json`；`build.js` 将两份有效 JSON 复制到 `site/data/`。使用静态 HTTP 服务器提供 `site/` 后预览页面。构建生成的 `site/data/` 已被 Git 忽略。

## 独立仓库与首次验证

只把本项目目录的内容放到独立仓库根目录（当前目标为 `fillyawnichelle74-ai/daletou`），使 `.github/workflows/` 位于仓库根目录。不要上传外层 Knowledge-graph 笔记、微信 AppID、微信配置或凭据。

1. 初始保持仓库私有，上传本项目交付文件。在 Actions 中启用工作流，并允许工作流具有读写仓库内容权限；分支保护规则也必须允许该任务提交数据。
2. 在默认分支 `main` 上运行 **Update DLT and publish**。首次代码上传亦会触发任务。检查测试、更新、构建及数据提交日志，核对 `data/daily.json` 的 `sourceStatus.state` 是否为 `fresh`，以及最新期号是否与官方公告一致。任务成功但状态为 `stale` 只证明旧数据回退成功，不代表真实同步通过。
3. 私有仓库会跳过全部 Pages 操作，因此首次数据验证无需先公开仓库。GitHub Free Pages 发布前，先检查仓库文件清单，再经所有者批准把独立仓库改为公开，并在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。公开仓库及网页对知道地址的人可见。
4. 变更可见性和 Pages 设置后，在默认分支手动重跑同一工作流。确认 Pages 部署成功，并从部署结果打开实际网址；随后用手机网络检查加载、窄屏布局、两注、截止期号和刷新保持一致。未完成真实同步、部署和手机检查前，不视为上线验收完成。

若默认 GitHub Pages 项目站点部署成功，预期地址为 [https://fillyawnichelle74-ai.github.io/daletou/](https://fillyawnichelle74-ai.github.io/daletou/)；请以实际成功部署结果给出的网址为准。

本地检查不等同于 GitHub Actions 真实来源读取或 Pages 发布。本说明不表示已经完成公开部署。

## JSON 数据约定

`data/draws.json` 顶层的 `sourceUrl` 和 `capturedAt` 保留初始 330 期官方快照的来源与采集时间，不表示后续新增记录的来源或当前同步时间。每条 `draws[].sourceUrl` 标记该期开奖记录的实际来源；当前同步时间与状态以 `data/daily.json` 的 `lastSuccessfulSync` 和 `sourceStatus` 为准。

## 自动更新与故障恢复

工作流使用 Node 20，每四小时（UTC `0 */4 * * *`，即北京时间 00、04、08、12、16、20 点）尝试更新，也支持手动运行。`main` 分支的工作流、代码、测试、页面、包配置和 README 变更会触发；`data/*.json` 不触发该更新工作流，避免数据提交循环。单实例并发保护不取消正在执行的更新。测试 → 更新 → 构建全部成功后，才提交 `data/*.json` 并推送；公开仓库随后发布同次构建的 `site/`。

第三方来源或官方核对失败时，不绕过站点安全策略：保留历史快照和 `lastSuccessfulSync`，若当天缺少号码则用最近已校验历史生成两注，保存 `stale` 状态并继续发布；当天已有号码不覆盖。若快照损坏、模型训练或文件写入失败，任务失败，后续提交和部署不运行，线上保留上次成功部署。

GitHub 定时运行可能延迟或漏跑，也可能因仓库长期不活跃而被停用；来源可能延迟、调整页面或限制请求。若没有当天号码或长时间陈旧，在 **Actions → Update DLT and publish → Run workflow** 选择默认分支重跑；若调度已停用，先重新启用。检查失败步骤和 JSON 中的来源状态，修复原因后再运行。已有当天号码即使来源恢复也不改变；页面保留其生成时的截止期号。
