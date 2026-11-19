# lib 目录说明（3.0.0 模块化）

入口 `index.mjs` 只做 `export *` 装配，不再写业务代码。改功能请定位到对应模块。

## core（协议与基础）
| 文件 | 职责 |
| --- | --- |
| `core/base.mjs` | 常量（版本/最高权限者/词典）、`S/NW/PT` 等工具、`P` 数据路径、`dget/dset/dall` 存档 IO、日志 |
| `core/util.mjs` | 数据路径表 `P`、`uid/uname/targetOf`、`api/sendMd` 之外的入口工具 |
| `core/qq.mjs` | 发消息（Markdown/按钮/键盘/富媒体）、`reply`、`active`、上传 |
| `core/rules.mjs` | 全局战斗规则（闪避上限、暴击率上限、`闪避判定`、`血量`） |
| `core/router.mjs` | `dispatch()` 指令分发 + `onCallback()` 按钮回调 |
| `core/misc.mjs` | 头像、进出群提示、测试钩子（`__balance4` 等） |

## game（玩法）
`player`（账号/属性/词条/称号/经验）、`farm`（农田/经验曲线）、`progress`（冷却/每日任务/指南进度）、`dungeon`（副本/商店/打坐/经验面板）、`combat`（战斗引擎/伤害结算/自动出招）、`tower`（天下楼）、`boss`（BOSS 数据与词条）、`equip`（装备/强化/背包）、`team`（组队）、`rebirth`（转生/用药/修甲/装备定义）、`cook`（做菜/加点/技能）、`alliance`（联盟）、`econ`（银行/交易行/股票）、`casual`（探索/挖矿/打工/钓鱼/赌场/转盘/抽卡/骰子）、`pvp`（对战/查询）、`credit`（信用/贷款/世界资金）、`star`（星灵/悬赏）、`translate`（指令翻译）。

## ui / admin / media / content
- `ui/menu.mjs`：主菜单、完整菜单、使用指南、更新公告入口、我的称号
- `ui/card.mjs`：SVG 卡片、属性面板、运势/超能力/时空门
- `admin/admin.mjs`：主人菜单、玩家查看/重置、日志、控制台配置
- `admin/webui.mjs`：网页控制台路由/接口
- `admin/edit.mjs`：管理员改属性
- `media/music.mjs`：点歌 / B 站解析
- `content/changelog/`：更新公告（按版本分文件，`index.mjs` 聚合）

## 约定
- 跨模块只能用 `import` 拿到的函数/常量；**模块级 `let` 不能跨模块赋值**，要改状态请用对应模块导出的 setter（如 `设最高权限者`）。
- 顶级初始化语句（建表/推数据）保持原相对顺序，先声明后执行。
- 改完跑一次 `.workbuddy/tools/run-all.mjs`（插件回归），或至少 `node .workbuddy/test/t-304.mjs`。
