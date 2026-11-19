// lib/core/router.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { announce, banListPanel, banOne, giveTo, groupInfo, groupPanel, isOwner, logPanel, menuBtn, ownerList, ownerMenu, ownersPanel, recallOne, resetPlayer, resetTasks, setField, statsPanel, viewPlayer, welcomeToggle, 写控制台配置, 字段定义, 软重启, 运行状态面板 } from "./../admin/admin.mjs?v=v1795104611902";
import { 修改属性面板, 改属性, 是最高权限, 清空修改 } from "./../admin/edit.mjs?v=v1795104611902";
import { NW, S, dget, dn, ds, dset, kfmt, pushLog, 最高权限者 } from "././base.mjs?v=v1795104611902";
import { actBtn, btn, reply, row, 蓝链 } from "././qq.mjs?v=v1795104611902";
import { P, uid } from "././util.mjs?v=v1795104611902";
import { allyDaily, allyWar, bankMove, bankPanel, claimWar, donateAlly, giftCoin, giftItem, joinAlly, leaveAlly, rankPanel, socialAlly, viewAlly, 星核商店面板 } from "./../game/alliance.mjs?v=v1795104611902";
import { casinoBet, casinoPanel, dice, explore, fish, gacha, mine, wheel, work } from "./../game/casual.mjs?v=v1795104611902";
import { 一键出招, 停止出招, 出招详情面板, 开战, 快速出招已移除, 战斗行动, 战斗记录, 战斗面板, 时长换次数, 自动时长上限毫秒, 解析挑战时长, 解析出招策略 } from "./../game/combat.mjs?v=v1795104611902";
import { 做菜, 做菜面板, 兑金币, 加点, 加点面板, 升级面板, 技能面板, 职业面板, 转职, 灰混 } from "./../game/cook.mjs?v=v1795104611902";
import { 世界资金面板, 信用分面板, 信用拦截, 官方群面板, 捐款, 贷款信息面板, 贷款申请, 贷款还款 } from "./../game/credit.mjs?v=v1795104611902";
import { 副本总览, 副本详情面板, 商店表, 商店购买, 商店面板, 开始一键挑战, 打坐面板, 经验面板, 队伍挑战 } from "./../game/dungeon.mjs?v=v1795104611902";
import { buyItem, exchangeItem, hallBuy, hallCancel, hallMine, hallPanel, hallPut, rob, 商店搜索, 股票买入, 股票卖出, 股票面板 } from "./../game/econ.mjs?v=v1795104611902";
import { 一键整理, 一键穿最强, 分解装备, 升级装备, 卖物品, 快速卖, 我背包件数, 清理残留, 穿装备, 背包面板, 分类背包面板, 脱装备, 装备面板, 转移升级 } from "./../game/equip.mjs?v=v1795104611902";
import { 一键种菜, 催熟, 农场面板, 农田升级, 农田面板, 卖作物, 收获, 种植, 菜谱, 农田浇水, 农田偏好 } from "./../game/farm.mjs?v=v1795104611902";
import { 药园一键收, 药园买种, 药园升级, 药园取, 药园服用, 药园帮助, 药园开垦, 药园收, 药园种子, 药园炼, 药园种, 药园药柜, 药园药方, 药园面板, 药园浇水, 药园偏好 } from "./../game/herb.mjs?v=v1795104611902";
import { 宠物面板, 宠物领养, 宠物出战, 宠物休息, 宠物喂食, 宠物帮助, 宠物小屋, 小屋建造, 宠物买食, 宠物自动喂 } from "./../game/pet.mjs?v=v1795104611902";
import { 婚姻面板, 婚姻帮助, 送花, 求婚, 答应求婚, 拒绝求婚, 离婚 } from "./../game/marriage.mjs?v=v1795104611902";
import { allItems, attrs, byGid, ensureAcc, gid, hasAcc, hasItem, pText, pwrOf, takeItem, 我的道具集, 改编号, 称号徽标, 称号表, 设称号, 手动升级, 累计经验需求 } from "./../game/player.mjs?v=v1795104611902";
import { dgFind, doSign, guideClaim, guidePanel, tClaim, tPanel } from "./../game/progress.mjs?v=v1795104611902";
import { PVP发起, PVP取消, PVP响应, PVP行动, PVP进行中, nickHistory, noteNick, queryId, queryUser, rankShow } from "./../game/pvp.mjs?v=v1795104611902";
import { USE_DEFAULT, doRebirth, doRegister, doStrengthen, useItem, 使用蓝药, 开始修甲, 结算修甲, 装备定义 } from "./../game/rebirth.mjs?v=v1795104611902";
import { 悬赏面板, 悬赏领取, 星灵升级, 星灵面板 } from "./../game/star.mjs?v=v1795104611902";
import { 创建队伍, 加入队伍, 加入队伍按编号, 退出队伍, 队伍面板 } from "./../game/team.mjs?v=v1795104611902";
import { 天下楼帮助, 天下楼开战, 天下楼面板, 重置天下楼 } from "./../game/tower.mjs?v=v1795104611902";
import { 英文时长转中文, 译指令 } from "./../game/translate.mjs?v=v1795104611902";
import { biliDo, musicCmd, musicMenu } from "./../media/music.mjs?v=v1795104611902";
import { battle, fortune, gate, superpower, 发属性卡, 属性面板 } from "./../ui/card.mjs?v=v1795104611902";
import { mainMenu, 使用指南, 公告详情, 完整指令菜单, 完整菜单, 我的称号面板, 星甲菜单, 更新公告 } from "./../ui/menu.mjs?v=v1795104611902";
import fs from "node:fs";


export async function dispatch(ctx, ses, m0) {
  const t = ses.目标, u = ses.userId, ev = ses.event;
  // 2.2.5：按钮插入的英文 / 回调串（如 meditate、bag|1）自动翻译成中文指令
  const m = 译指令(m0);
  const owner = isOwner(ctx, ev);
  // ---- 管理类（无需开号）----
  if (m === "主人菜单" || m === "管理菜单" || m === "主人帮助") {
    if (!owner) { await reply(ctx, t, "你没有权限打开主人菜单。", { 标题: "权限不足", 按钮: [btn("p_m", "返回首页", "菜单")] }); return true; }
    await ownerMenu(ctx, t); return true;
  }
  // ---- 2.5.9 全量已移除：只认「艾特机器人」的消息 ----
  if (m === "查我行" || m === "我的openid") {
    await reply(ctx, t, [
      "你的 openid：`" + uid(ev) + "`",
      "是否主人：" + (owner ? "是" : "否"),
      "是否最高权限者：" + (uid(ev) === 最高权限者 ? "是" : "否")
    ].join("\n"), { 标题: "我的身份", 按钮: [btn("p_m2", "返回首页", "菜单")] });
    return true;
  }
  if (owner) {
    let mm;
    mm = m.match(/^(设置)([^#]{1,10})#([^#]+)#(-?[0-9]{1,15})$/);
    // 2.9.2（需求 5）：设置指令改为「字段表驱动」—— 新字段（攻击力/防御力/生命/闪避率/真伤概率）
    //   不用再逐个加进正则；只有 字段定义 里存在的字段才当成设置指令，其余（设置XXX）继续下放
    if (mm && 字段定义[mm[2]]) { await setField(ctx, t, uid(ev), mm[3], mm[2], mm[4]); return true; }
    mm = m.match(/^查看玩家#?(.*)$/);
    if (mm) { await viewPlayer(ctx, t, mm[1]); return true; }
    mm = m.match(/^重置玩家#([^#]+)$/);
    if (mm) { await resetPlayer(ctx, t, uid(ev), mm[1]); return true; }
    // 2.5.28：重置某玩家的天下楼层数（层数 / 最高层 / 通关次数全部归零）
    mm = m.match(/^(?:重置天下楼|重置爬塔)#([^#]+)$/);
    if (mm) { await 重置天下楼(ctx, t, uid(ev), mm[1]); return true; }
    mm = m.match(/^发放道具#([^#]+)#([^#]+)#(-?[0-9]{1,15})$/);
    if (mm) { await giveTo(ctx, t, uid(ev), mm[1], mm[2], mm[3]); return true; }
    mm = m.match(/^(封禁玩家|解封玩家)#([^#]+)$/);
    if (mm) { await banOne(ctx, t, uid(ev), mm[2], mm[1] === "封禁玩家"); return true; }
    if (m === "封禁名单") { await banListPanel(ctx, t); return true; }
    if (m === "主人列表") { await ownersPanel(ctx, t); return true; }
    // 2.7.0（需求 3/4/15）：主人专用 —— 改编号 / 发称号 / 全服倍率
    mm = m.match(/^改编号#?([^#]+)#([1-9][0-9]{0,8})$/);
    if (mm) {
      const r = 改编号(ctx, S(mm[1]), S(mm[2]));
      await reply(ctx, t, r.ok ? ("编号已修改：" + S(mm[1]) + " → **" + r.编号 + "**") : ("改编号失败：" + r.msg), { 标题: r.ok ? "🔢 改编号" : "⛔ 改编号失败", 按钮: [menuBtn()] });
      return true;
    }
    mm = m.match(/^称号#?([^#]+)(?:#(.+))?$/);
    if (mm) {
      const u2 = byGid(ctx, S(mm[1]));
      if (!u2) { await reply(ctx, t, "找不到编号 " + S(mm[1]) + " 的玩家", { 标题: "🏅 称号" }); return true; }
      const 名 = S(mm[2]);
      const 设 = 设称号(ctx, u2, 名);
      await reply(ctx, t, [
        设 ? ("已为 **" + gid(ctx, u2) + "** 发放称号：" + 称号徽标(ctx, u2)) : ("已清除 **" + gid(ctx, u2) + "** 的称号"),
        "",
        "可用称号：",
        ...称号表.map((x) => "· `星甲称号#" + gid(ctx, u2) + "#" + x.名 + "`（" + x.稀有度 + "）" + x.说明)
      ].join("\n"), { 标题: "🏅 称号", 按钮: [menuBtn()] });
      return true;
    }
    mm = m.match(/^(?:全服倍率|倍率)#?([0-9]+(?:\.[0-9])?)$/);
    if (mm) {
      const v = Number(mm[1]);
      if (!Number.isFinite(v) || v > 2 || (v !== 1 && v < 1.1)) { await reply(ctx, t, "倍率只能是 1（关闭）或 1.1 ~ 2，例：`星甲倍率1.5`", { 标题: "🎉 全服倍率" }); return true; }
      写控制台配置(ctx, { 全服倍率: Math.round(v * 10) / 10 });
      await reply(ctx, t, v <= 1 ? "已关闭全服奖励倍率（恢复 ×1.0）。" : ("已开启全服奖励 **×" + (Math.round(v * 10) / 10).toFixed(1) + "**（经验 / 星羽 / 金币 / 星核，结算时自动生效）。"), { 标题: "🎉 全服倍率", 按钮: [menuBtn()] });
      return true;
    }
    mm = m.match(/^(加主人|删主人)#(.+)$/);
    if (mm) {
      const id = S(mm[2]);
      if (mm[1] === "删主人" && id === 最高权限者) {
        await reply(ctx, t, "最高权限者不能被移除。", { 标题: "删主人", 按钮: [menuBtn()] });
        return true;
      }
      if (mm[1] === "加主人") {
        const list = ownerList(ctx);
        if (list.indexOf(id) >= 0) await reply(ctx, t, "该 openid 已在名单里。", { 标题: "加主人", 按钮: [menuBtn()] });
        else { list.push(id); dset(ctx, P.主人名单, "列表", list); pushLog(ctx, uid(ev), "添加主人 " + id); await reply(ctx, t, "已添加主人：`" + id + "`", { 标题: "加主人", 按钮: [menuBtn()] }); }
      } else {
        const list = ownerList(ctx).filter((x) => x !== id);
        dset(ctx, P.主人名单, "列表", list);
        pushLog(ctx, uid(ev), "移除主人 " + id);
        await reply(ctx, t, "已移除主人：`" + id + "`", { 标题: "删主人", 按钮: [menuBtn()] });
      }
      return true;
    }
    if (m === "插件统计") { await statsPanel(ctx, t); return true; }
    // 2.5.27：星甲运行状态（CPU / 内存 / 全服玩家）· 管理日志分页 · 插件软重启
    if (m === "运行状态" || m === "星甲运行状态" || m === "插件运行状态" || m === "系统状态") { await 运行状态面板(ctx, t); return true; }
    // 2.6.0：`m === "星甲重启"` 恒假（译指令已去前缀），而按钮 data 是「星甲重启」→ 去前缀后只剩「重启」，
    //   原来没有任何分支接「重启」，导致主人菜单/运行状态页的【软重启】按钮点了没反应。补上「重启」。
    if (m === "软重启" || m === "插件重启" || m === "重启插件" || m === "重启") { await 软重启(ctx, t, uid(ev)); return true; }
    mm = m.match(/^(?:管理日志|插件日志|系统日志)\s*#?\s*([0-9]{0,4})$/);
    if (mm) { await logPanel(ctx, t, mm[1] === "" ? 1 : mm[1]); return true; }
    mm = m.match(/^全服公告#(.+)$/);
    if (mm) { await announce(ctx, t, uid(ev), mm[1]); return true; }
    mm = m.match(/^重置每日任务#?(.*)$/);
    if (mm) { await resetTasks(ctx, t, uid(ev), mm[1]); return true; }
  }
  // ---- 群管 ----
  if (m === "群管" || m === "群管理") { await groupPanel(ctx, t); return true; }
  if (m === "本群信息") { await groupInfo(ctx, t, ev); return true; }
  if (m === "入群欢迎") { await welcomeToggle(ctx, t, ev); return true; }
  if (m === "撤回上一条" || m === "撤回最近") { await recallOne(ctx, t, ""); return true; }
  let rm = m.match(/^撤回(?:消息)?#(.+)$/);
  if (rm) { await recallOne(ctx, t, rm[1]); return true; }
  if (m === "指南" || m === "使用指南" || m === "帮助文档" || m === "攻略" || m === "新手文档") { await 使用指南(ctx, t, u, ""); return true; }
  { const zz = m.match(/^(?:指南|使用指南|帮助文档|攻略)\s*#?\s*([0-9]{1,2})$/); if (zz) { await 使用指南(ctx, t, u, zz[1]); return true; } }
  // ---- 菜单 / 说明 ----
  // 2.2.6：菜单名统一为「星甲菜单」（即简短菜单）；完整版用 `星甲完整菜单`
  if (m === "菜单" || m === "主菜单" || m === "简短菜单" || m === "迷你菜单" || m === "小菜单" || m === "星甲菜单") {
    // 2.7.0（需求 9）：默认菜单改为新版紧凑排版（身份卡 + 今日三件事 + 分区蓝链 + 精简按钮）
    await mainMenu(ctx, t, u); return true;
  }
  // 2.9.1（F4 修复）：完整菜单恢复独立实现（全指令分组参考页，可 `#页码` 翻页），
  //   不再与简短菜单共用 mainMenu()。
  // 2.9.4（需求 5）：菜单一分为二 ——
  //   `完整指令菜单` = 指令参考页（完整菜单组，按分组逐条，带 #页码 翻页）
  //   `完整菜单`     = 功能总览菜单（完全菜单组，按玩法分区，同样 #页码 翻页）
  //   旧的别名（全部指令 / 详细菜单 / 指令 / mk / 帮助 / help）保持可用，一律指到指令参考页。
  if (m === "完整指令菜单" || m === "指令菜单" || m === "全部指令" || m === "详细菜单" || m === "mk" || m === "MK" || m === "帮助" || m === "help" || m === "指令" || m === "星甲" || /^完整指令菜单\s*#?\s*[0-9]{0,2}$/.test(m)) {
    const 页 = (m.match(/([0-9]{1,2})\s*$/) || [])[1] || "1";
    await 完整指令菜单(ctx, t, u, 页, ev); return true;
  }
  if (m === "完整菜单" || m === "完整指令目录" || /^完整菜单\s*#?\s*[0-9]{0,2}$/.test(m)) {
    const 页 = (m.match(/([0-9]{1,2})\s*$/) || [])[1] || "1";
    await 完整菜单(ctx, t, u, 页, ev); return true;
  }
  if (m === "星甲控制台" || m === "控制台") {
    await 发属性卡(ctx, t, u, "🖥️ 星甲控制台");
    return true;
  }
  if (m === "玩法" || m === "玩法系统" || m === "娱乐系统" || m === "新玩法") {
    await reply(ctx, t, [
      "## 星甲 玩法一览",
      "",
      "**成长**：`副本`（12 个）· `挑战3` · `探索` · `探索10` · `升级` · `转生` · `强化`",
      "**赚钱**：`挖矿` · `打工` · `钓鱼` · `银行系统` · `金融市场` · `交易行` · `商店` · `抽卡`",
      "**赌运**：`赌场` · `猜大小#偶#500`（大=偶 / 小=奇） · `转盘` · `骰子500` · `今日运势`",
      "**社交**：`联盟` · `联盟捐献 500` · `联盟日奖` · `联盟战` · `排行榜` · `对战#编号`",
      "**日常**：`签到` · `每日任务` · `新手指引` · `今日超能力` · `时空门芸界`",
      "**娱乐**：`音乐系统` · `点歌歌名` · B 站解析要带前缀：`星甲https://b23.tv/xxxx`",
      "",
      "💡 带 ⚡ 的按钮点一下就直接执行"
    ].join("\n"), {
      标题: "🎮 玩法",
      行组: [
        row(actBtn("pl1", "⚡一键探索", "explore|5"), btn("pl2", "副本", "副本"), btn("pl3", "挖矿", "挖矿"), btn("pl4", "钓鱼", "钓鱼")),
        row(btn("pl5", "赌场", "赌场"), btn("pl6", "金融市场", "金融市场"), btn("pl7", "交易行", "交易行"), btn("pl8", "抽卡", "抽卡")),
        row(btn("pl9", "联盟", "联盟"), btn("pl10", "排行榜", "排行榜"), btn("pl11", "新手指引", "新手指引"), btn("pl12", "菜单", "菜单"))
      ]
    });
    return true;
  }
  if (m === "个人编号" || m === "查看个人编号" || m === "我的编号") {
    await reply(ctx, t, [
      "你的编号：**" + gid(ctx, u) + "**",
      "openid：`" + u + "`",
      "昵称：" + ds(ctx, P.昵称, u, "无名") + " · 等级 " + dn(ctx, P.等级, u, 1) + " · 战力 " + pwrOf(ctx, u)
    ].join("\n"), { 标题: "🆔 个人编号", 按钮: [btn("id1", "属性", "属性"), actBtn("id2", "⚡看属性", "info")] });
    return true;
  }
  if (m === "新手指引" || m === "指引" || m === "新手引导") { await guidePanel(ctx, t, u); return true; }
  if (m === "装甲" || m === "注册" || m === "开号") { await doRegister(ctx, t, u, ses.昵称, false); return true; }
  // 非本插件指令：完全不响应（适配「接收所有消息」模式）
  if (await musicCmd(ctx, t, u, m)) return true;
  if (await biliDo(ctx, t, m)) return true;
  // 2.6.0（需求 1/3）：这里原来有一道 `if (!像指令(m)) return true;` 硬闸门，
  //   导致一批 dispatch 里明明写好的分支（逃跑 / 治疗 / 时空门 / 探索 / 钓鱼 / 对战 …）
  //   因为没进 EXACT 白名单而永远进不来 —— 属于「死指令」。
  //   现在前缀是强制的（不带星甲根本进不到这里），玩家能打出来的都是有意发送，
  //   所以去掉闸门：统一由下面的分支匹配，最后仍不匹配才由上层给出「未识别指令」提示。
  // ---- 自动开号 ----
  // 2.6.0：前缀已经是强制的，能走到这里的一定是「星甲XXX」，属于有意发送，
  //   直接开号即可。原来这里还要求 `像指令(m)`（EXACT/PATTERNS 白名单），
  //   而白名单与 dispatch 分支长期漂移 → 新玩家第一条发 `星甲卖#武器` 这类白名单外指令时不会开号，
  //   然后被下面的分支当成没账号处理。白名单在这里已经没有存在意义。
  if (!hasAcc(ctx, u)) {
    const r = ensureAcc(ctx, u, ses.昵称);
    if (r.新) {
      await reply(ctx, t, [
        "检测到你还没有战甲，已自动为你登记。",
        "编号：**" + r.编号 + "** · 昵称：" + ses.昵称,
        "",
        "先 `签到`，再 `副本` 刷经验吧。"
      ].join("\n"), {
        标题: "🛡️ 自动开号成功",
        行组: [row(btn("n1", "签到", "签到"), btn("n2", "副本", "副本"), btn("n3", "新手指引", "新手指引")), row(actBtn("n4", "⚡看属性", "info"), btn("n5", "菜单", "菜单"))]
      });
      return true;
    }
  }
  // ---- 2.9.6（需求 8）：信用分为 0 → 除「打工 / 挖矿 / 探索 / 钓鱼 / 卖物品 / 还款 / 查看信息」外一律拦截 ----
  //   主人（管理员）不受限制，避免排查问题时自己被锁住；查询类与挣钱类走 信用零白名单 放行。
  if (!owner && await 信用拦截(ctx, t, u, m)) return true;
  // ---- 日常 ----
  if (m === "签到" || m === "巡游" || m === "打卡" || m === "签到打卡" || m === "每日签到") { await doSign(ctx, t, u); return true; }
  if (m === "每日任务" || m === "任务") { await tPanel(ctx, t, u); return true; }
  // ---- 2.7.0 新玩法：星灵 / 悬赏 ----
  if (m === "星灵" || m === "我的星灵" || m === "伙伴" || m === "星灵面板") { await 星灵面板(ctx, t, u); return true; }
  { const zz = m.match(/^(?:星灵升级|升级星灵)\s*#?\s*([0-9]{1,2})?$/); if (zz) { await 星灵升级(ctx, t, u, zz[1] || 1); return true; } }
  if (m === "悬赏" || m === "每日悬赏" || m === "今日悬赏" || m === "悬赏面板") { await 悬赏面板(ctx, t, u); return true; }
  if (m === "领取悬赏" || m === "悬赏领奖" || m === "领悬赏" || m === "悬赏领取") { await 悬赏领取(ctx, t, u); return true; }
  // 2.6.0：补「领任务奖励」（文档里一直这么写，原来少一个「取」字就没反应）
  if (m === "领取任务奖励" || m === "领任务奖励" || m === "一键领奖" || m === "领奖") { await tClaim(ctx, t, u); return true; }
  if (m === "联盟日奖" || m === "联盟奖励" || m === "领取联盟日奖") { await allyDaily(ctx, t, u); return true; }
  // ---- 联盟 / 社交 ----
  if (m === "联盟" || m === "联盟系统") { await socialAlly(ctx, t, u); return true; }
  let jm = m.match(/^加入联盟[\s#：:]*\s*(.+)$/);
  if (jm) { await joinAlly(ctx, t, u, jm[1]); return true; }
  if (m === "查看联盟" || m === "我的联盟") { await viewAlly(ctx, t, u); return true; }
  let dm = m.match(/^联盟捐献[\s#：:]*([0-9]{1,7})$/);
  if (dm) { await donateAlly(ctx, t, u, dm[1]); return true; }
  if (m === "联盟战") { await allyWar(ctx, t, u); return true; }
  if (m === "领取联盟战奖励" || m === "联盟战奖励") { await claimWar(ctx, t, u); return true; }
  if (m === "退出联盟") { await leaveAlly(ctx, t, u); return true; }
  if (m === "排行榜" || m === "排行") { await rankPanel(ctx, t, u, ""); return true; }
  let rk = m.match(/^(签到|评分|攻击力|血量|等级|星羽|存款|星核)排行榜$/);
  if (rk) { await rankPanel(ctx, t, u, m); return true; }
  let gm = m.match(/^赠送#([^#]+)#([^#]+)#([0-9]{1,5})$/);
  if (gm) { await giftItem(ctx, t, u, gm[1], gm[2], gm[3]); return true; }
  let tm = m.match(/^(?:转账|送星羽|打钱)#([^#]+)#([0-9]{1,7})$/);
  if (tm) { await giftCoin(ctx, t, u, tm[1], tm[2]); return true; }
  // ---- 副本（2.2.0：列表 → 详情 → 战斗）----
  if (m === "副本" || m === "副本列表" || m === "秘境" || m === "副本页") { await 副本总览(ctx, t, u, ""); return true; }
  if (m === "副本#boss" || m === "BOSS列表" || m === "boss" || m === "BOSS" || m === "星甲boss") { await 副本总览(ctx, t, u, "boss"); return true; }
  { const zz = m.match(/^(?:副本列表|副本页)\s*#?\s*(?:第)?([0-9]{1,2})\s*页?$/); if (zz) { await 副本总览(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^(?:BOSS列表|boss列表|BOSS|boss|星甲boss)\s*#?\s*(?:第)?([0-9]{1,3})\s*页?$/); if (zz) {
      // 2.9.2（需求 2）：3 位数且命中 BOSS 编号 → 直接打开 BOSS 详情面板；1~2 位仍按页码翻页
      const 号 = Number(zz[1]);
      if (号 >= 200 && dgFind(号)) { await 副本详情面板(ctx, t, u, 号); return true; }
      await 副本总览(ctx, t, u, "boss#" + zz[1]); return true; } }
  { const zz = m.match(/^副本\s*#?\s*([0-9]{1,3})$/); if (zz) { await 副本详情面板(ctx, t, u, zz[1]); return true; } }
  // ---- 2.9.8（需求 3）玩家挑战 ----
  // `pvp同意#会话` / `pvp拒绝#会话`（按钮回调）；`挑战同意` / `挑战拒绝`（文字，只有一封待处理战书时生效）
  if (m === "挑战同意" || m === "挑战拒绝") { await PVP响应(ctx, t, u, "", m.indexOf("同意") >= 0); return true; }
  { const zz = m.match(/^pvp(?:同意|拒绝)\s*#?\s*(.+)$/); if (zz) { await PVP响应(ctx, t, u, zz[1], m.indexOf("同意") >= 0); return true; } }
  if (m === "pvp取消" || m === "挑战取消") { await PVP取消(ctx, t, u); return true; }
  // `星甲挑战#目标`：目标为数字且命中副本编号 → 进副本（原行为不变）；否则按玩家（@某人 / 编号 / 名字）发起 PVP 战书
  { const zz = m.match(/^(?:挑战|对战|挑战玩家)\s*#\s*(.+)$/);
    if (zz) {
      const 目标串 = S(zz[1]).trim();
      // 3.1.0（需求 4）：`星甲挑战#101#5` = 翻倍 5 次；纯编号仍是普通挑战
      if (/^[0-9]{1,3}(?:#[0-9]{1,2})?$/.test(目标串) && dgFind(S(目标串).split("#")[0])) { const [idi, fan] = S(目标串).split("#"); await 开战(ctx, t, u, idi, fan); return true; }
      await PVP发起(ctx, t, u, 目标串, ev); return true;
    } }
  { const zz = m.match(/^(?:挑战|打副本)\s*#?\s*([0-9]{1,3}(?:#[0-9]{1,2})?)$/); if (zz) { const [idi, fan] = zz[1].split("#"); await 开战(ctx, t, u, idi, fan); return true; } }
  // 3.1.0（需求 4）：BSOSS 直接翻倍挑战 `星甲BOSS#201#5`（放在 BOSS 列表判定之前）
  { const zz = m.match(/^(?:BOSS|boss|星甲boss)\s*#?\s*([0-9]{1,3})\s*#\s*([0-9]{1,2})$/); if (zz) { await 开战(ctx, t, u, zz[1], zz[2]); return true; } }
  if (m === "战斗" || m === "战斗信息" || m === "战斗面板") { await 战斗面板(ctx, t, u); return true; }
  // ---- 2.5.28 天下楼（99 层爬塔）----
  if (m === "天下楼" || m === "爬塔" || m === "天下楼面板" || m === "天下楼进度" || m === "登楼") { await 天下楼面板(ctx, t, u); return true; }
  // 3.0.0（需求 4.7/27）：天下楼帮助独立页（主面板只留关键信息，长说明挪到这里）
  if (m === "天下楼帮助" || m === "爬塔帮助" || m === "天下楼说明") { await 天下楼帮助(ctx, t, u); return true; }
  if (m === "天下楼挑战" || m === "挑战天下楼" || m === "爬塔挑战" || m === "挑战塔" || m === "登楼挑战") { await 天下楼开战(ctx, t, u); return true; }
  { const zz = m.match(/^(?:天下楼|爬塔)\s*#?\s*([0-9]{1,4})$/); if (zz) { await 天下楼面板(ctx, t, u, zz[1]); return true; } }
  // ---- 2.5.40 农场（种菜 / 收菜）----
  // 2.9.4（需求 5）：「菜地」是玩家对农场的口头叫法 —— 直接指到农场面板
  if (m === "农场" || m === "我的农场" || m === "菜园" || m === "菜地" || m === "农场面板" || m === "种菜" || m === "丰收" || m === "田地") { await 农场面板(ctx, t, u); return true; }
  // 2.9.8（需求 8/9）：星甲农田 —— 地块状态 / 单独升级
  if (m === "农田" || m === "查看农田" || m === "农田面板") { await 农田面板(ctx, t, u); return true; }
  { const zz = m.match(/^农田升级\s*#?\s*([0-9]{1,2})$/); if (zz) { await 农田升级(ctx, t, u, zz[1]); return true; } }
  // 3.1.3：浇水 / 播种偏好（自动补种 + 自动买种）
  { const zz = m.match(/^农田浇水\s*#?\s*([0-9]{1,2})$/); if (zz) { await 农田浇水(ctx, t, u, zz[1]); return true; } }
  if (m === "农田浇水" || m === "菜地浇水") { await 农田浇水(ctx, t, u, ""); return true; }
  { const zz = m.match(/^农田偏好\s*[#：:]?\s*(.+)$/); if (zz) { await 农田偏好(ctx, t, u, zz[1]); return true; } }
  if (m === "农田偏好" || m === "农田播种偏好") { await 农田偏好(ctx, t, u, ""); return true; }
  // 2.9.12：生长药水催熟 —— `星甲催熟#地块号`（无参数 = 看用法与生长中地块）
  { const zz = m.match(/^(?:催熟|使用生长药水)\s*#?\s*([0-9]{0,2})$/); if (zz) { await 催熟(ctx, t, u, zz[1]); return true; } }
  if (m === "收获" || m === "收菜" || m === "收割" || m === "全部收获" || m === "收成") { await 收获(ctx, t, u); return true; }
  if (m === "卖作物" || m === "卖菜收成") { await 卖作物(ctx, t, u); return true; }
  { const zz = m.match(/^(?:种植|种下|播种|种菜)\s*#\s*([^#]+?)(?:\s*#\s*([1-9]))?$/); if (zz) { await 种植(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^(?:一键种菜|一键播种|种满)\s*#?\s*([^#\s]+)?$/); if (zz) { await 一键种菜(ctx, t, u, zz[1] || "星芽种子"); return true; } }
  { const zz = m.match(/^(?:农场|菜园|种菜)\s*#?([1-9])$/); if (zz) { await 农场面板(ctx, t, u); return true; } }
  // ---- 需求 13：个人药园（灵种 → 药材 → 成药）----
  if (m === "药园" || m === "药园面板" || m === "我的药园" || m === "灵田") { await 药园面板(ctx, t, u); return true; }
  if (m === "药园帮助" || m === "药园说明") { await 药园帮助(ctx, t, u); return true; }
  if (m === "药园种子" || m === "药园灵种" || m === "种子仓") { await 药园种子(ctx, t, u); return true; }
  if (m === "药园药柜" || m === "药柜") { await 药园药柜(ctx, t, u); return true; }
  if (m === "药园药方" || m === "药方") { await 药园药方(ctx, t, u); return true; }
  if (m === "药园开垦" || m === "开垦") { await 药园开垦(ctx, t, u); return true; }
  if (m === "药园一键收" || m === "药园全部收") { await 药园一键收(ctx, t, u); return true; }
  { const zz = m.match(/^药园买种\s*#?\s*(\S+?)\s*#?\s*([0-9]{1,2})$/); if (zz) { await 药园买种(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^药园买种\s*#?\s*(\S+)$/); if (zz) { await 药园买种(ctx, t, u, zz[1], 1); return true; } }
  { const zz = m.match(/^药园种\s*#?\s*([1-8])\s*#?\s*(\S+)$/); if (zz) { await 药园种(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^药园收\s*#?\s*([1-8])$/); if (zz) { await 药园收(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^药园升级\s*#?\s*([1-8])$/); if (zz) { await 药园升级(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^药园炼\s*#?\s*(\S+?)\s*#?\s*([0-9]{1,2})$/); if (zz) { await 药园炼(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^药园炼\s*#?\s*(\S+)$/); if (zz) { await 药园炼(ctx, t, u, zz[1], 1); return true; } }
  { const zz = m.match(/^药园取\s*#?\s*(\S+?)\s*#?\s*([0-9]{1,3})$/); if (zz) { await 药园取(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^药园取\s*#?\s*(\S+)$/); if (zz) { await 药园取(ctx, t, u, zz[1], 1); return true; } }
  { const zz = m.match(/^药园服用\s*#?\s*(\S+)$/); if (zz) { await 药园服用(ctx, t, u, zz[1]); return true; } }
  // 3.1.3：浇水 / 播种偏好（自动补种 + 自动买种）/ 药方偏好（自动炼药）
  { const zz = m.match(/^药园浇水\s*#?\s*([1-8])$/); if (zz) { await 药园浇水(ctx, t, u, zz[1]); return true; } }
  if (m === "药园浇水" || m === "灵田浇水") { await 药园浇水(ctx, t, u, ""); return true; }
  { const zz = m.match(/^药园偏好\s*[#：:]?\s*(.+)$/); if (zz) { await 药园偏好(ctx, t, u, zz[1]); return true; } }
  if (m === "药园偏好" || m === "药园播种偏好") { await 药园偏好(ctx, t, u, ""); return true; }
  // ---- 需求 3：结婚 / 好感 / 离婚 ----
  if (m === "婚姻" || m === "我的婚姻" || m === "婚姻面板" || m === "配偶") { await 婚姻面板(ctx, t, u); return true; }
  if (m === "婚姻帮助" || m === "结婚帮助") { await 婚姻帮助(ctx, t, u); return true; }
  if (m === "答应求婚" || m === "答应结婚") { await 答应求婚(ctx, t, u); return true; }
  if (m === "拒绝求婚" || m === "拒绝结婚") { await 拒绝求婚(ctx, t, u); return true; }
  if (m === "离婚") { await 离婚(ctx, t, u); return true; }
  { const zz = m.match(/^送花\s*#?\s*(\S+?)\s*#?\s*([0-9]{1,4})$/); if (zz) { await 送花(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^求婚\s*#?\s*(\S+)$/); if (zz) { await 求婚(ctx, t, u, zz[1]); return true; } }
  // ---- 需求 21：宠物（领养 + 农田/药园自动干活，惰性结算）----
  if (m === "宠物" || m === "宠物面板" || m === "我的宠物" || m === "宠物窝") { await 宠物面板(ctx, t, u); return true; }
  if (m === "宠物帮助" || m === "宠物说明") { await 宠物帮助(ctx, t, u); return true; }
  if (m === "宠物休息" || m === "宠物睡觉") { await 宠物休息(ctx, t, u); return true; }
  if (m === "宠物出战") { await 宠物出战(ctx, t, u, ""); return true; }
  { const zz = m.match(/^宠物领养\s*#?\s*(\S+)$/); if (zz) { await 宠物领养(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^宠物出战\s*#?\s*(\S+)$/); if (zz) { await 宠物出战(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^宠物喂食\s*#?\s*(\S*)$/); if (zz) { await 宠物喂食(ctx, t, u, zz[1] || ""); return true; } }
  // 需求：宠物小屋（建造 + 存食 + 自动喂食）
  if (m === "宠物小屋" || m === "宠物房子") { await 宠物小屋(ctx, t, u); return true; }
  if (m === "宠物建造" || m === "宠物建屋" || m === "建造宠物小屋") { await 小屋建造(ctx, t, u); return true; }
  { const zz = m.match(/^宠物买食\s*#?\s*(\S+?)\s*#?\s*([0-9]{1,2})$/); if (zz) { await 宠物买食(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^宠物买食\s*#?\s*(\S+)$/); if (zz) { await 宠物买食(ctx, t, u, zz[1], 1); return true; } }
  { const zz = m.match(/^宠物自动喂\s*#?\s*(on|off|开|关|开启|关闭)?$/i); if (zz) { await 宠物自动喂(ctx, t, u, zz[1] || ""); return true; } }
  // ---- 2.5.38 更新公告（读插件文档.md 的版本章节）----
  if (m === "更新公告" || m === "更新日志" || m === "版本公告" || m === "更新说明" || m === "公告") { await 更新公告(ctx, t, u, ""); return true; }
  { const zz = m.match(/^(?:更新公告|更新日志|版本公告|更新说明|公告)\s*#?\s*([0-9]{1,3})$/); if (zz) { await 更新公告(ctx, t, u, zz[1]); return true; } }
  // 2.9.13（U8）：单条公告详情（总览蓝链点进来 / 手打 `星甲公告详情#序号[#段号]`）
  { const zz = m.match(/^(?:公告详情|公告内容|更新详情)\s*#?\s*([0-9]{1,3})(?:\s*#?\s*([0-9]{1,3}))?$/); if (zz) { await 公告详情(ctx, t, u, zz[1], zz[2]); return true; } }
  // ---- 成长 ----
  if (m === "属性" || m === "我的信息" || m === "个人信息" || m === "战力" || m === "我的档案") {
    await 发属性卡(ctx, t, u, "🛡️ 战甲资料");
    return true;
  }
  // ---- 2.9.4（需求 5）玩家自己的称号面板（以前只有主人用 `称号#编号#名` 发放，玩家无从查看）----
  if (m === "我的称号" || m === "称号面板" || m === "查看称号") { await 我的称号面板(ctx, t, u); return true; }
  // 3.0.0（需求 4.4）：自动回血开关（默认开启）—— 关闭后战斗里不再自动嗑药
  if (m === "自动回血" || m === "回血开关" || m === "自动喝药") {
    const 当前 = S(dget(ctx, P.自动回血, u, "开启")) === "关闭" ? "关闭" : "开启";
    await reply(ctx, t, [
      "自动回血：**" + 当前 + "**（默认开启）",
      "",
      "开启时：战斗中血量低于 30% 会自动嗑药续战，被打到 0 血也会自动回血。",
      "关闭时：战斗中不再自动嗑药（手动「治疗」动作仍然可用）。",
      "",
      "切换：`星甲自动回血开` / `星甲自动回血关`"
    ].join("\n"), {
      标题: "💊 自动回血",
      行组: [row(actBtn("ah1", "⚡开启", "autocure|on"), actBtn("ah2", "⚡关闭", "autocure|off"), btn("ah3", "战斗面板", "战斗"))]
    });
    return true;
  }
  { const zz = m.match(/^自动回血\s*#?\s*(开|开启|关|关闭)$/); if (zz) {
    const 开 = /开/.test(zz[1]);
    dset(ctx, P.自动回血, u, 开 ? "开启" : "关闭");
    await reply(ctx, t, "自动回血已" + (开 ? "开启" : "关闭") + "。", { 标题: "💊 自动回血" });
    return true;
  } }
  // 3.0.0（需求 1）：升级改为**手动**，经验累计不归零；经验/等级都没有上限
  if (m === "升级" || m === "提升等级" || m === "手动升级") {
    const r = 手动升级(ctx, u);
    const 下 = 累计经验需求(r.等级 + 1);
    const 行 = [
      "当前：Lv." + r.等级 + (r.升级 > 0 ? "（本次连升 " + r.升级 + " 级）" : ""),
      "累计经验：" + r.经验 + " / " + 下 + "（升级不扣经验，累计不清零）",
      r.可升级 ? "经验够了，再发一次 `星甲升级` 可继续升。" : ("还差 " + Math.max(0, 下 - r.经验) + " 经验到 Lv." + (r.等级 + 1) + "。"),
      "",
      "经验来自副本 / BOSS / 天下楼 / 探索 / 挖矿 / 打工 / 钓鱼 / 打坐 / 做菜。"
    ];
    await reply(ctx, t, 行.join("\n"), {
      标题: r.升级 > 0 ? "⬆️ 升级成功" : "⬆️ 升级",
      行组: [row(btn("up1", "副本", "副本"), actBtn("up2", "⚡探索5次", "explore|5"), btn("up3", "属性", "属性"), btn("up4", "经验来源", "经验"))]
    });
    return true;
  }
  if (m === "转生" || m === "轮回") { await doRebirth(ctx, t, u); return true; }
  // 2.5.4 修复：`星甲强化` 原来被接到了「升级装备」面板（显示 lv./强化+0 列表），
  //   真正的战甲强化是 doStrengthen（每 10 级强化一次、需通关对应副本），这里改回去。
  if (m === "强化" || m === "战甲强化" || m === "星甲强化") { await doStrengthen(ctx, t, u); return true; }
  if (m === "修复战甲" || m === "修甲") { await 开始修甲(ctx, t, u); return true; }
  if (m === "退出修甲" || m === "取消修甲" || m === "修甲进度") { await 结算修甲(ctx, t, u); return true; }
  // ---------- 2.1.0 新增：背包 / 装备 / 组队 / 一键挑战 ----------
  if (m === "背包" || m === "星甲背包" || m === "我的背包" || m === "背包信息") { await 背包面板(ctx, t, u, ""); return true; }
  // 3.0.0：分类背包（独立编号与翻页，与总背包互不影响）
  if (m === "材料背包" || m === "星甲材料背包") { await 分类背包面板(ctx, t, u, "", "材料"); return true; }
  if (m === "装备背包" || m === "星甲装备背包") { await 分类背包面板(ctx, t, u, "", "装备"); return true; }
  if (m === "其他背包" || m === "星甲其他背包") { await 分类背包面板(ctx, t, u, "", "其他"); return true; }
  { const zz = m.match(/^材料背包\s*#?\s*([0-9]{1,3})$/); if (zz) { await 分类背包面板(ctx, t, u, zz[1], "材料"); return true; } }
  { const zz = m.match(/^装备背包\s*#?\s*([0-9]{1,3})$/); if (zz) { await 分类背包面板(ctx, t, u, zz[1], "装备"); return true; } }
  { const zz = m.match(/^其他背包\s*#?\s*([0-9]{1,3})$/); if (zz) { await 分类背包面板(ctx, t, u, zz[1], "其他"); return true; } }
  { const zz = m.match(/^材料背包\s*#?\s*(\S+)$/); if (zz) { await 分类背包面板(ctx, t, u, zz[1], "材料"); return true; } }
  { const zz = m.match(/^装备背包\s*#?\s*(\S+)$/); if (zz) { await 分类背包面板(ctx, t, u, zz[1], "装备"); return true; } }
  { const zz = m.match(/^其他背包\s*#?\s*(\S+)$/); if (zz) { await 分类背包面板(ctx, t, u, zz[1], "其他"); return true; } }
  let bagm = m.match(/^背包#(.+)$/);
  if (bagm) { await 背包面板(ctx, t, u, bagm[1]); return true; }
  if (m === "一键整理" || m === "背包整理" || m === "整理背包") { await 一键整理(ctx, t, u); return true; }
  if (m === "清理残留" || m === "清空残留" || m === "清理残留物品" || m === "清空残留物品") { await 清理残留(ctx, t, u); return true; }
  let eqm = m.match(/^(?:装备|穿戴)#?(.+)$/);
  if (eqm && 装备定义(eqm[1])) { await 穿装备(ctx, t, u, eqm[1]); return true; }
  let unm = m.match(/^脱下#?(.*)$/);
  if (unm) { await 脱装备(ctx, t, u, unm[1]); return true; }
  let sellm = m.match(/^卖#([^#]+)#?([0-9]{1,5})?$/);
  if (sellm && (装备定义(sellm[1]) || allItems().indexOf(S(sellm[1])) >= 0 || 我背包件数(ctx, u, S(sellm[1])) > 0)) { await 卖物品(ctx, t, u, sellm[1], sellm[2] ? Number(sellm[2]) : 1); return true; }
  let decm = m.match(/^分解#?(.+)$/);
  if (decm && 装备定义(decm[1])) { await 分解装备(ctx, t, u, decm[1]); return true; }
  let teamm = m.match(/^(?:组队|创建队伍)\s*#?\s*([0-9]{1,3})$/);
  if (teamm) { await 创建队伍(ctx, t, u, teamm[1]); return true; }
  let joinm = m.match(/^加入队伍\s*#?\s*([0-9]{1,4})?$/);
  if (joinm) { await 加入队伍(ctx, t, u, joinm[1] || ""); return true; }
  // P8：按队长编号上车（旧口令 加入队伍#队号 保留兼容）
  let joinbm = m.match(/^(?:加入boss组队|加入BOSS组队)\s*#?\s*([0-9]{1,9})?$/);
  if (joinbm) { await 加入队伍按编号(ctx, t, u, joinbm[1] || "", true); return true; }
  let joindm = m.match(/^加入副本组队\s*#?\s*([0-9]{1,9})?$/);
  if (joindm) { await 加入队伍按编号(ctx, t, u, joindm[1] || "", false); return true; }
  if (m === "队伍" || m === "我的队伍" || m === "队伍信息") { await 队伍面板(ctx, t, u); return true; }
  if (m === "队伍挑战" || m === "组队挑战" || m === "开始挑战") { await 队伍挑战(ctx, t, u); return true; }
  if (m === "退出队伍" || m === "解散队伍") { await 退出队伍(ctx, t, u); return true; }
  let autom = m.match(/^(?:一键挑战|自动挑战)\s*#?\s*([0-9]{1,3})?$/);
  if (autom) { await 开始一键挑战(ctx, t, u, autom[1] || 101); return true; }
  // 2.5.8：一键挑战整条线已移除 —— 进度 / 取消 也统一走「已移除」提示（旧消息里的按钮也拦得住）
  if (m === "挑战进度" || m === "自动挑战进度" || m === "一键挑战进度" || m === "取消挑战" || m === "终止挑战") { await 开始一键挑战(ctx, t, u, 101); return true; }
  // ---------- 2.1.1 经验相关 ----------
  if (m === "打坐" || m === "冥想" || m === "修行" || m === "修炼") { await 打坐面板(ctx, t, u); return true; }
  if (m === "经验" || m === "经验统计" || m === "今日经验" || m === "经验获取" || m === "怎么升级") { await 经验面板(ctx, t, u); return true; }
  if (m === "使用道具" || m === "道具" || m === "道具使用") {
    // 2.5.17：只列「我实际持有」的道具（含商店买的药），没持有就不显示
    const 持有 = 我的道具集(ctx, u);
    const 行 = ["**我的道具**", "",
      持有.length ? 持有.map((x) => x.名 + "×" + x.数量).join(" · ") : "（背包里没有道具，去 `星甲商店` 买点吧）",
      "", "用法：`使用翠露散1`（空格也可以：`使用 幸运币 5`）"];
    await reply(ctx, t, 行.join("\n"), {
      标题: "🎒 道具",
      行组: [
        row(btn("it1", "用绿血清", "使用翠露散1"), btn("it2", "用红血清", "使用红色血清1"), btn("it3", "用强化组件", "使用强化组件1")),
        row(btn("it4", "用幸运币", "使用幸运币1"), btn("it5", "炼化陨石", "使用陨石碎片1"), btn("it6", "商店", "商店"), btn("it7", "背包", "背包"))
      ]
    });
    return true;
  }
  // 2.2.5：支持 使用X / 使用X3 / 使用#X#3 / 使用X#3 / 使用#X#全部
  // 2.5.41 修复：不再只认 allItems() 白名单（商店新增 / 历史道具可能不在表里 → 原来会「静默无响应」）；
  //   现在只要「道具表认识」或「背包里有」或「商店在卖」就认。
  const 认道具 = (nm) => {
    const x = S(nm);
    if (!x) return false;
    try { if (allItems().indexOf(x) >= 0) return true; } catch (e) { /* ignore */ }
    try { if (hasItem(ctx, u, x) > 0) return true; } catch (e) { /* ignore */ }
    try { if (typeof 商店表 !== "undefined" && 商店表.some((s) => s.名 === x)) return true; } catch (e) { /* ignore */ }
    return false;
  };
  { const zz = m.match(/^(?:使用|服用|喝)\s*#?\s*([^#\s0-9]+)\s*#?\s*([0-9]{1,4}|全部|全|全部用完)?$/);
    if (zz && 认道具(zz[1])) {
      const 量词 = S(zz[2]);
      const 需要 = (量词 === "全部" || 量词 === "全" || 量词 === "全部用完") ? hasItem(ctx, u, S(zz[1])) : (量词 ? Number(量词) : (USE_DEFAULT[S(zz[1])] || 1));
      await useItem(ctx, t, u, S(zz[1]), 需要);
      return true;
    } }
  // 3.2.0：`使用蓝药 [数量]` —— 自动挑最便宜的蓝药补全局蓝量
  { const zz = m.match(/^使用\s*#?\s*蓝药\s*#?\s*([0-9]{1,2})?$/); if (zz) { await 使用蓝药(ctx, t, u, zz[1] || 1); return true; } }
  let um = NW(m).match(/^使用(.+?)([0-9]{0,4})$/);
  if (um && 认道具(um[1])) {
    await useItem(ctx, t, u, um[1], um[2] ? Number(um[2]) : (USE_DEFAULT[um[1]] || 1));
    return true;
  }
  let nm = m.match(/^(?:改名|更改昵称)\s*(.+)$/);
  if (nm) {
    const nick = S(nm[1]).slice(0, 12);
    if (hasItem(ctx, u, "改名卡") < 1) {
      await reply(ctx, t, "改名需要 1 张改名卡（商店 1000 星羽 / 星核兑换 5 星核）。", {
        标题: "改名失败", 按钮: [btn("rn1", "买改名卡", "购买#改名卡#1"), btn("rn2", "星核兑换", "兑换#改名卡#1")]
      });
      return true;
    }
    takeItem(ctx, u, "改名卡", 1);
    dset(ctx, P.昵称, u, nick);
    noteNick(ctx, u, nick);
    await reply(ctx, t, "昵称已改为 **" + nick + "**", { 标题: "✏️ 改名成功", 按钮: [actBtn("rn3", "⚡看属性", "info")] });
    return true;
  }
  // ---- 经济 ----
  // ---- 2.9.6（需求 8/9/10/11）信用分 / 贷款 / 捐款 / 世界资金 / 官方群 ----
  if (m === "信用分" || m === "信用" || m === "我的信用") { await 信用分面板(ctx, t, u); return true; }
  if (m === "贷款信息" || m === "我的贷款" || m === "借贷信息" || m === "欠款") { await 贷款信息面板(ctx, t, u); return true; }
  if (m === "贷款" || m === "借款") { await 贷款信息面板(ctx, t, u); return true; }
  { const zz = m.match(/^(?:贷款|借款)\s*#?\s*([0-9]{1,10})$/); if (zz) { await 贷款申请(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^(?:还款|还贷|还钱)\s*#?\s*([0-9]{1,10}|全部|全额|还清)?$/); if (zz) { await 贷款还款(ctx, t, u, zz[1] || "全部"); return true; } }
  if (m === "捐款" || m === "捐赠" || m === "捐助") { await 捐款(ctx, t, u, 0); return true; }
  { const zz = m.match(/^(?:捐款|捐赠|捐助)\s*#?\s*([0-9]{1,10})$/); if (zz) { await 捐款(ctx, t, u, zz[1]); return true; } }
  if (m === "世界资金" || m === "国库" || m === "全服资金") { await 世界资金面板(ctx, t, u); return true; }
  if (m === "官方群" || m === "官方群聊" || m === "加群") { await 官方群面板(ctx, t, u); return true; }
  if (m === "银行系统" || m === "银行") { await bankPanel(ctx, t, u); return true; }
  let bm = m.match(/^存入(?:星羽)?\s*([0-9]{1,9})$/);
  if (bm) { await bankMove(ctx, t, u, "存", bm[1], false); return true; }
  let bm2 = m.match(/^取出(?:星羽)?\s*([0-9]{1,9})$/);
  if (bm2) { await bankMove(ctx, t, u, "取", bm2[1], false); return true; }
  if (m === "全部存入" || m === "全部存款") { await bankMove(ctx, t, u, "存", 0, true); return true; }
  if (m === "全部取出" || m === "全部取款") { await bankMove(ctx, t, u, "取", 0, true); return true; }
  // ---------- 2.2.9 星羽换金币 / 菜品卖成金币 ----------
  { const zz = m.match(/^(?:兑换金币|金币兑换|星羽换金币|换金币)\s*#?\s*([0-9]{1,9}|全部|全)?$/);
    if (zz) { await 兑金币(ctx, t, u, zz[1] || "全部"); return true; } }
  // ---------- 2.2.8 做菜玩法 ----------
  // 2.9.4（需求 5）：玩家习惯叫「厨房」，补上别名 → 走食堂 / 做菜面板
  if (m === "做菜" || m === "烹饪" || m === "食堂" || m === "厨房" || m === "菜谱" || m === "做") { await 做菜面板(ctx, t, u); return true; }
  // 3.1.0：做菜面板分页 `做菜#2`
  { const zz = m.match(/^(?:做菜|烹饪|食堂|厨房|菜谱)\s*#?\s*([0-9]{1,2})$/); if (zz) { await 做菜面板(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^(?:做菜|烹饪|做)\s*#?\s*([^#\s]+)\s*#?\s*([0-9]{1,3})?$/);
    if (zz && 菜谱(zz[1])) { await 做菜(ctx, t, u, zz[1], zz[2] ? Number(zz[2]) : 1); return true; } }
  // ---------- 2.5.1：赠送 / 转账 / 存款 / 取出 的裸指令面板（修「点了没反应」） ----------
  if (m === "赠送" || m === "转账" || m === "存款" || m === "取出" || m === "赠送物品" || m === "转账星羽") {
    const p = attrs(ctx, u);
    const isGift = /赠送/.test(m);
    const isDep = m === "存款";
    const isWith = m === "取出";
    const 行 = [
      ["用户:" + gid(ctx, u) + "　昵称:" + p.昵称, true],
      ["星羽:" + kfmt(p.星羽) + "　存款:" + kfmt(p.存款), true],
      ["", true],
      [isGift ? "赠送物品给其他玩家" : (isDep ? "把钱存进银行" : (isWith ? "从银行取钱" : "给其他玩家转账星羽")), false]
    ];
    if (isGift) 行.push(["用法：`星甲赠送#编号#物品#数量`", true], ["例：`星甲赠送#16328#赤霄血露#5`", true]);
    else if (isDep) 行.push(["用法：`星甲存入星羽1000` / `星甲全部存入`", true]);
    else if (isWith) 行.push(["用法：`星甲取出星羽1000` / `星甲全部取出`", true]);
    else 行.push(["用法：`星甲转账#编号#数量`", true], ["例：`星甲转账#16328#1000`", true]);
    行.push(["", true], ["其他：" + 蓝链([["星甲银行", "银行"], ["星甲交易行", "交易行"], ["星甲查编号#1234", "查编号"], ["星甲菜单", "星甲菜单"]]), true]);
    await reply(ctx, t, 灰混(行), {
      标题: isGift ? "🎁 赠送" : (isDep ? "🏦 存款" : (isWith ? "🏦 取出" : "💸 转账")),
      行组: [row(btn("gz1", "银行", "银行"), btn("gz2", "交易行", "交易行"), btn("gz3", "背包", "背包"), btn("gz4", "星甲菜单", "星甲菜单"))]
    });
    return true;
  }
  // ---------- 2.5.0 技能 / 普攻 ----------
  // 2.9.8（需求 3）：玩家挑战进行中 → 沿用现有战斗指令（普攻 / 技能 / 治疗 / 逃跑），拦截进 PVP 回合制
  const PVP拦截 = !((() => { const r = 战斗记录(ctx, u); return r && !r.结果; })()) && PVP进行中(ctx, u);
  if (PVP拦截) {
    if (m === "普攻" || m === "普通攻击" || m === "攻击") { await PVP行动(ctx, t, u, "atk", ""); return true; }
    if (m === "逃跑" || m === "放弃战斗" || m === "撤离") { await PVP行动(ctx, t, u, "flee", ""); return true; }
    if (m === "治疗" || m === "回血") { await PVP行动(ctx, t, u, "heal", ""); return true; }
    { const zz = m.match(/^技能\s*#?\s*([1-8])$/); if (zz) { await PVP行动(ctx, t, u, "skill", zz[1]); return true; } }
  }
  if (m === "普攻" || m === "普通攻击" || m === "攻击") { await 战斗行动(ctx, t, u, "atk"); return true; }
  // 2.5.21：英文按钮码 xgflee / ba|flee 的中文指令
  if (m === "逃跑" || m === "放弃战斗" || m === "撤离") { await 战斗行动(ctx, t, u, "flee"); return true; }
  if (m === "治疗" || m === "回血") { await 战斗行动(ctx, t, u, "heal"); return true; }
  // 2.5.7：一键出招（消耗自动卡）
  // 2.5.55：支持「按时长」挑战 —— `一键出招2小时` / `一键出招30分钟` / `一键出招1小时30分` / `一键出招50小时`
  //   上限 50 小时，超出按 50 小时算；纯数字仍按「次数」理解（`一键出招10` = 10 次）
  // 2.5.26：旧的「快速」前缀（快速出招 / 无cd出招 / 极速出招）已移除 → 统一回「已移除」提示
  { const zt = m.match(/^(快速|无cd|无CD|极速|秒)?(?:一键出招|出招|自动出招|一键自动|连击|自动打击)\s*#?\s*([0-9][0-9.]*(?:小时|时|h|H|分钟|分|m|M|秒|s|S)(?:[0-9][0-9.]*(?:分钟|分|m|M|秒|s|S))?)$/i);
    if (zt) {
      if (zt[1]) { await 快速出招已移除(ctx, t); return true; }
      const 原 = zt[2];
      let 毫秒 = 解析挑战时长(原);
      const 截断 = 毫秒 > 自动时长上限毫秒;
      if (截断) 毫秒 = 自动时长上限毫秒;
      await 一键出招(ctx, t, u, 时长换次数(毫秒), { 时长毫秒: 毫秒, 原文: 原, 截断: 截断 });
      return true;
    }
  }
  // 3.0.0（需求 19）：`一键出招3:1000` = 优先放第 3 个职业技能，技能点/蓝量不够就普攻，共 1000 招
  { const zs = 解析出招策略(m); if (zs) { if (zs.快速) { await 快速出招已移除(ctx, t); return true; } await 一键出招(ctx, t, u, zs.次数, { 技能序号: zs.技能序号 }); return true; } }
  { const zc = m.match(/^(快速|无cd|无CD|极速|秒)?(?:一键出招|出招|自动出招|一键自动|连击|自动打击)\s*#?\s*([0-9]{0,7})$/i);
    if (zc) { if (zc[1]) { await 快速出招已移除(ctx, t); return true; } await 一键出招(ctx, t, u, zc[2] === "" ? 10 : zc[2]); return true; } }
  // 2.5.18：出招详情（查看上一次自动出招的逐次明细）
  if (m === "出招详情" || m === "自动详情" || m === "出招记录" || m === "查看出招详情" || m === "自动出招详情") { await 出招详情面板(ctx, t, u); return true; }
  if (m === "停止出招" || m === "停止自动" || m === "自动停止" || m === "取消出招") { await 停止出招(ctx, t, u); return true; }
  // 3.0.0（需求 25/26）：职业面板 / 转职（技能面板只显示本职业技能，1~5）
  if (m === "职业" || m === "职业面板" || m === "职业列表" || m === "我的职业" || m === "转职") { await 职业面板(ctx, t, u); return true; }
  { const zj = m.match(/^(?:转职|选择职业|转职成为)\s*#?\s*([^#\s]{1,8})$/); if (zj) { await 转职(ctx, t, u, zj[1]); return true; } }
  if (m === "技能" || m === "技能列表") { await 技能面板(ctx, t, u, 0); return true; }
  { const zz = m.match(/^技能\s*#?\s*([1-5])$/); if (zz) { await 技能面板(ctx, t, u, zz[1]); return true; } }
  { const zz = m.match(/^(?:升级装备|装备升级|强化装备)\s*#?\s*$/); if (zz) { await 升级面板(ctx, t, u, ""); return true; } }
  // ---------- 2.2.5：星甲装备（查看已穿戴装备的加成） ----------
  if (m === "装备" || m === "装备信息" || m === "装备加成" || m === "我的装备" || m === "装备面板") { await 装备面板(ctx, t, u); return true; }
  // 2.7.0（需求 6）：一键穿最强
  if (m === "一键穿最强" || m === "穿最强" || m === "一键装备" || m === "最强装备") { await 一键穿最强(ctx, t, u); return true; }
  { const zz = m.match(/^(?:加点|升级加点)\s*#?\s*([^#\s]+)\s*#\s*([^#\s]+)\s*#?\s*([0-9]{1,4})?$/);
    if (zz) { await 加点(ctx, t, u, zz[1], zz[2], zz[3] ? Number(zz[3]) : 1); return true; } }
  { const zz = m.match(/^(?:加点|升级加点)\s*#?\s*([^#\s]+)$/);
    if (zz) { await 加点面板(ctx, t, u, zz[1]); return true; } }
  if (m === "加点" || m === "升级加点") { await 加点面板(ctx, t, u, ""); return true; }
  { const zz = m.match(/^(?:升级装备|装备升级|强化装备)\s*#?\s*([^#\s]+)\s*#?\s*([0-9]{1,3})?$/);
    if (zz) { await 升级装备(ctx, t, u, zz[1], zz[2] ? Number(zz[2]) : 1); return true; } }
  { const zz = m.match(/^(?:转移升级|升级转移|转移属性)\s*#?\s*([^#\s]+)\s*#\s*([^#\s]+)$/);
    if (zz) { await 转移升级(ctx, t, u, zz[1], zz[2]); return true; } }
  if (m === "转移升级" || m === "升级转移") { await reply(ctx, t, "用法：`转移升级#源装备#目标装备`\n例：`转移升级#合金短刃#湮灭圣剑`（250 金币 + 2500 星羽）", { 标题: "🔁 转移升级", 按钮: [btn("tr5", "背包", "背包")] }); return true; }
  // 2.6.0：不写分类的「一键卖 / 批量卖 / 全部卖」= 全部卖掉（原来会被正则判死，回「没有这条指令」）
  if (m === "一键卖" || m === "批量卖" || m === "全部卖") { await 快速卖(ctx, t, u, "全部", 1); return true; }
  { const zz = m.match(/^(?:一键卖|批量卖|全部卖)\s*#?(武器|护甲|材料|装备|全部|鱼|菜|其他|残留|遗留)\s*#?\s*([0-9]{1,6})?$/);
    if (zz) { await 快速卖(ctx, t, u, S(zz[1]) || "全部", zz[2] ? Number(zz[2]) : 1); return true; } }
  { const zz = m.match(/^批量卖\s*#?\s*([^#\s]+)\s*#?\s*([0-9]{1,6})?$/);
    if (zz) { await 快速卖(ctx, t, u, zz[1], zz[2] ? Number(zz[2]) : 1); return true; } }
  { const zz = m.match(/^(?:商店|商城)\s*#?\s*([0-9]{1,3})$/); if (zz) { await 商店面板(ctx, t, u, zz[1]); return true; } }
  if (m === "商店信息" || m === "商店详情") { await 商店面板(ctx, t, u, ""); return true; }
  // 2.3.0 修复：先排掉基金指令，否则 `买入基金#100` 会被下面的商店「购买」正则抢走（报「没有这件商品：入基金」）
  // 2.9.9：旧基金指令升级为股票 —— 保留拦截，回「已迁移到 01 星河基金」提示
  if (/^(?:买入|卖出)基金/.test(m)) {
    await reply(ctx, t, [
      "💹 金融市场已升级为 **10 只股票**（2.9.9）。",
      "",
      "你原来的基金持仓已自动迁移到 **01 星河基金**（份额 / 成本不变）。",
      "新指令：`星甲股票` 看行情 · `星甲买入#星河基金#1000` · `星甲卖出#星河基金#全部`"
    ].join("\n"), { 标题: "💹 已升级为股票", 行组: [row(btn("fu0", "股票行情", "股票"), btn("fu0b", "星甲菜单", "星甲菜单"))] });
    return true;
  }
  // 2.9.9（需求 E）：股票指令
  if (m === "股票" || m === "股票行情" || m === "我的股票" || m === "金融市场" || m === "基金" || m === "基金市场") { await 股票面板(ctx, t, u); return true; }
  { const zz = m.match(/^买入#([^#\s]{1,12})#([0-9]{1,9})$/); if (zz) { await 股票买入(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^卖出#([^#\s]{1,12})#([0-9]{1,9}份?|全部|全)$/i); if (zz) { await 股票卖出(ctx, t, u, zz[1], zz[2]); return true; } }
  // 2.9.13（F1 修复）：购买上架 必须排在下面通用「购买」正则之前 ——
  //   旧顺序里 `购买上架#10#1` 先被通用正则命中（`购买` + 商品名「上架」），
  //   导致交易行面板点「⚡买【10】」报「购买失败：没有这件商品：上架」。
  { const zz = m.match(/^(?:购买上架|买上架)#([0-9]+)#([0-9]{1,5})$/);
    if (zz) { await hallBuy(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^(?:购买|买)\s*#?\s*([^#\s]+)[#\s]+([0-9]{1,5})(?:[#\s]+[0-9]{1,5})?$/);
    if (zz) { await 商店购买(ctx, t, u, zz[1], zz[2]); return true; } }
  { const zz = m.match(/^修改属性\s*#?\s*([^#\s]*)\s*#?\s*([^#\s]*)\s*#?\s*([0-9]{1,12})?$/);
    if (zz) {
      if (!是最高权限(ctx, u)) { await reply(ctx, t, "「修改属性」只有最高权限者可以使用。", { 标题: "⛔ 无权限" }); return true; }
      const 目标 = S(zz[1]), 字段 = S(zz[2]), 值 = S(zz[3]);
      if (目标 && 字段 && 值) { await 改属性(ctx, t, u, 目标, 字段, 值); return true; }
      if (目标 && 字段) { await 改属性(ctx, t, u, 目标, 字段, "0"); return true; }
      await 修改属性面板(ctx, t, u, 目标); return true;
    } }
  { const zz = m.match(/^(?:一键清空修改|清空修改|清空属性修改)\s*#?\s*([^#\s]+)?$/);
    if (zz) {
      if (!是最高权限(ctx, u)) { await reply(ctx, t, "「一键清空修改」只有最高权限者可以使用。", { 标题: "⛔ 无权限" }); return true; }
      await 清空修改(ctx, t, u, zz[1] || u); return true;
    } }
  // 2.4.1 修复：以前 `星甲商店` 命中的是旧商店；现在统一进新商店（金币/星羽分区、可翻页）
  if (m === "商店" || m === "暗域商锋" || m === "商城") { await 商店面板(ctx, t, u, ""); return true; }
  // 3.0.0（需求 22）：商店关键词搜索 —— `星甲商店 种子` / `星甲商店搜索 种子` / `星甲物品搜索#种子[#页码]`
  //   ① 上面 `商店#页码`、`商店信息/详情` 先接住，不会抢；
  //   ② 关键词首字符不允许是数字（数字仍是页码），所以 `星甲商店#3` 行为不变。
  { const zz = m.match(/^(?:商店|商城|物品|道具)(?:搜索|查找|查询|找)?\s*#?\s*([^#\s0-9][^#\s]*)(?:\s*#?\s*([0-9]{1,2}))?$/);
    if (zz) { await 商店搜索(ctx, t, u, zz[1], zz[2] || 1); return true; } }
  { const zz = m.match(/^(?:商店|物品|道具)(?:搜索|查找|查询)\s*#?\s*([0-9]{1,2})?$/);
    if (zz) { await 商店搜索(ctx, t, u, "", zz[1] || 1); return true; } }
  if (m === "星核商店" || m === "星核兑换" || m === "兑换商店") { await 星核商店面板(ctx, t, u); return true; }
  let pm = m.match(/^(?:购买|买)#([^#]+)#([0-9]{1,5})$/);
  if (pm) { await buyItem(ctx, t, u, pm[1], pm[2]); return true; }
  let em = m.match(/^兑换#([^#]+)#([0-9]{1,5})$/);
  if (em) { await exchangeItem(ctx, t, u, em[1], em[2]); return true; }
  if (m === "交易行" || m === "拍卖行") { await hallPanel(ctx, t, u, ""); return true; }
  // 2.9.13（U1）：交易行货架每页 10 条，`交易行#页码` 翻页
  { const zz = m.match(/^(?:交易行|拍卖行)\s*#?\s*([0-9]{1,3})$/); if (zz) { await hallPanel(ctx, t, u, zz[1]); return true; } }
  let sl = m.match(/^上架#([^#]+)#([0-9]{1,5})#([0-9]{1,7})$/);
  if (sl) { await hallPut(ctx, t, u, sl[1], sl[2], sl[3]); return true; }
  let sd = m.match(/^下架#([0-9]+)$/);
  if (sd) { await hallCancel(ctx, t, u, sd[1]); return true; }
  if (m === "我的上架") { await hallMine(ctx, t, u); return true; }
  if (m === "金融市场" || m === "基金" || m === "基金市场") { await marketPanel(ctx, t, u); return true; }
  let fb = m.match(/^买入基金#([0-9]{1,7})$/);
  if (fb) { await fundBuy(ctx, t, u, fb[1]); return true; }
  let fs = m.match(/^卖出基金#([0-9]{1,7})$/);
  if (fs) { await fundSell(ctx, t, u, fs[1]); return true; }
  let rb = m.match(/^打劫#([^#]+)$/);
  if (rb) { await rob(ctx, t, u, rb[1]); return true; }
  // ---- 传承 ----
  if (m === "今日超能力" || m === "超能力") { await superpower(ctx, t, u, "看"); return true; }
  let tp = m.match(/^(?:时空门|时空隧道)\s*[#：:]?\s*(芸界|深渊)?$/);
  if (tp) { await gate(ctx, t, u, tp[1] || ""); return true; }
  if (m === "匹配挑战" || m === "快速挑战") { await battle(ctx, t, u, "match", ""); return true; }
  if (m === "随机挑战") { await battle(ctx, t, u, "random", ""); return true; }
  // 2.9.8：`对战#目标` / `挑战玩家#目标` 已统一改走上面的玩家挑战（PVP 战书）流程，旧分支移除
  let lk = m.match(/^查编号#?([^#]*)$/);
  if (lk) { await queryId(ctx, t, u, lk[1]); return true; }
  let lu = m.match(/^查用户#?(.+)$/);
  if (lu) { await queryUser(ctx, t, lu[1]); return true; }
  if (m === "军衔" || m === "我的军衔") { await rankShow(ctx, t, u); return true; }
  if (m === "昵称历史" || m === "改名记录") { await nickHistory(ctx, t, u); return true; }
  if (m === "音乐帮助" || m === "点歌帮助") { await musicMenu(ctx, t); return true; }
  // ---- 娱乐 ----
  let xm = m.match(/^(?:探索|一键探索|批量探索|连探|连续探索)\s*([0-9]{0,4})$/);
  if (xm) { await explore(ctx, t, u, xm[1] || ""); return true; }
  if (m === "挖矿" || m === "采矿") { await mine(ctx, t, u); return true; }
  if (m === "打工" || m === "搬砖") { await work(ctx, t, u); return true; }
  let fm = m.match(/^(?:钓鱼|垂钓|一键钓鱼)\s*([0-9]{0,4})$/);
  if (fm) { await fish(ctx, t, u, fm[1] || ""); return true; }
  if (m === "赌场" || m === "星域赌场") { await casinoPanel(ctx, t, u); return true; }
  // 2.6.0 修复：「全押大 / 全押小」按钮发的是 `bet|大|all`，原来正则只收数字 → 被挡死；
  //   而 casinoBet 本身支持 all（押上限）。这里放行 all。
  let btm = NW(m).match(/^猜大小#?(大|小|奇|偶)#?(all|[0-9]{1,6})$/i);
  if (btm) { await casinoBet(ctx, t, u, btm[1], btm[2]); return true; }
  if (m === "转盘" || m === "天选转盘" || m === "抽奖") { await wheel(ctx, t, u); return true; }
  if (m === "抽卡" || m === "单抽") { await gacha(ctx, t, u, 1); return true; }
  if (m === "十连" || m === "抽卡10") { await gacha(ctx, t, u, 10); return true; }
  let dc = m.match(/^(?:骰子|摇骰子)\s*([0-9]{1,6})?$/);
  if (dc) { await dice(ctx, t, u, dc[1] || 100); return true; }
  if (m === "今日运势" || m === "运势") { await fortune(ctx, t, u); return true; }
  // ---- 调试 ----
  if (m === "测试md" || m === "测试markdown") {
    await reply(ctx, t, ["# 星甲 Markdown 测试", "", "**加粗** _斜体_ `代码`", "", "- 列表 A", "- 列表 B", "", "> 引用", "", "---", "_排版正常即可_"].join("\n"), {
      标题: "", 按钮: [btn("tm1", "返回菜单", "菜单")]
    });
    return true;
  }
  if (m === "测试按钮" || m === "按钮测试") {
    await reply(ctx, t, "点下面按钮会把指令填进聊天栏；⚡ 按钮点一下立刻执行。", {
      标题: "🔘 按钮测试",
      行组: [row(btn("tb1", "查看属性", "属性"), btn("tb2", "副本列表", "副本")), row(actBtn("tb3", "⚡一键探索", "explore|5"), actBtn("tb4", "⚡看属性", "info"), btn("tb5", "菜单", "菜单"))]
    });
    return true;
  }
  return false;
}



/* ============================================================
 * 十五、按钮回调
 * ============================================================ */
export async function onCallback(ctx, ses, act) {
  const t = ses.目标, u = ses.userId;
  const parts = String(act).replace(/^星甲/, "").split("|");
  // 2.6.0 修复：原来只解构到 a2，下面「加点 / addpt」用了 a3 → 点【加点】按钮会 ReferenceError 直接崩，
  //   表现是「点了没反应 / 报处理出错」。这里补齐 a3（以及后续可能用到的 a4）。
  const name = parts[0], a1 = parts[1], a2 = parts[2], a3 = parts[3], a4 = parts[4];
  if (name === "info") {
    await reply(ctx, t, pText(ctx, u), {
      标题: "🛡️ 战甲属性",
      行组: [row(actBtn("cb1", "⚡一键探索", "explore|5"), btn("cb2", "副本", "副本"), btn("cb3", "转生", "转生"), btn("cb4", "菜单", "菜单"))]
    });
    return true;
  }
  if (!hasAcc(ctx, u)) ensureAcc(ctx, u, ses.昵称);
  // 3.0.0（需求 4.4）：自动回血开关按钮
  if (name === "autocure") {
    const 开 = S(a1) !== "off";
    dset(ctx, P.自动回血, u, 开 ? "开启" : "关闭");
    await reply(ctx, t, "自动回血已" + (开 ? "开启" : "关闭") + "。", { 标题: "💊 自动回血" });
    return true;
  }
  if (name === "explore") { await explore(ctx, t, u, a1 || ""); return true; }
  if (name === "mine") { await mine(ctx, t, u); return true; }
  if (name === "work") { await work(ctx, t, u); return true; }
  if (name === "wheel") { await wheel(ctx, t, u); return true; }
  if (name === "fish") { await fish(ctx, t, u, a1 || ""); return true; }
  if (name === "bet") { await casinoBet(ctx, t, u, a1, a2); return true; }
  // 2.5.12 修复：`dg|<id>` 按钮原来走 dgFight（直接判胜负 → 不用打就通关），现在统一走真正的战斗
  if (name === "dg" || name === "xgstart") { await 开战(ctx, t, u, a1 || 101, a2); return true; }
  // 2.5.28：天下楼按钮
  if (name === "tower" || name === "towerpanel") { await 天下楼面板(ctx, t, u); return true; }
  if (name === "towerhelp") { await 天下楼帮助(ctx, t, u); return true; }
  if (name === "towerfight" || name === "towerstart") { await 天下楼开战(ctx, t, u); return true; }
  // 2.5.32：更新公告
  if (name === "changelog" || name === "clog" || name === "news") { await 更新公告(ctx, t, u, a1 || ""); return true; }
  // 2.9.13（U8）：单条公告详情按钮（clogdetail|序号|段号）
  if (name === "clogdetail") { await 公告详情(ctx, t, u, a1, a2); return true; }
  // 2.5.40：农场
  if (name === "farm" || name === "farmpanel") { await 农场面板(ctx, t, u); return true; }
  if (name === "plant") { await 种植(ctx, t, u, a1, a2); return true; }
  if (name === "plantall") { await 一键种菜(ctx, t, u, a1 || "星芽种子"); return true; }
  if (name === "harvest") { await 收获(ctx, t, u); return true; }
  if (name === "sellcrops") { await 卖作物(ctx, t, u); return true; }
  // 需求 13：个人药园
  if (name === "herb" || name === "herbpanel") { await 药园面板(ctx, t, u); return true; }
  if (name === "herbhelp") { await 药园帮助(ctx, t, u); return true; }
  if (name === "herbseeds") { await 药园种子(ctx, t, u); return true; }
  if (name === "herbbuy") { await 药园买种(ctx, t, u, a1, a2 || 1); return true; }
  if (name === "herbplant") { await 药园种(ctx, t, u, a1, a2); return true; }
  if (name === "herbreap") { await 药园收(ctx, t, u, a1); return true; }
  if (name === "herbreapall") { await 药园一键收(ctx, t, u); return true; }
  if (name === "herbopen") { await 药园开垦(ctx, t, u); return true; }
  if (name === "herbup") { await 药园升级(ctx, t, u, a1); return true; }
  if (name === "herbrecipes") { await 药园药方(ctx, t, u); return true; }
  if (name === "herbmake") { await 药园炼(ctx, t, u, a1, a2 || 1); return true; }
  if (name === "herbcab") { await 药园药柜(ctx, t, u); return true; }
  if (name === "herbtake") { await 药园取(ctx, t, u, a1, a2 || 1); return true; }
  if (name === "herbuse") { await 药园服用(ctx, t, u, a1); return true; }
  if (name === "婚姻") { await 婚姻面板(ctx, t, u); return true; }
  if (name === "婚姻帮助") { await 婚姻帮助(ctx, t, u); return true; }
  if (name === "离婚") { await 离婚(ctx, t, u); return true; }
  if (name === "送花") { await 婚姻面板(ctx, t, u); return true; }

  // 需求 21：宠物
  if (name === "petpanel") { await 宠物面板(ctx, t, u); return true; }
  if (name === "pethelp") { await 宠物帮助(ctx, t, u); return true; }
  if (name === "petadopt") { await 宠物领养(ctx, t, u, a1); return true; }
  if (name === "petwork") { await 宠物出战(ctx, t, u, a1); return true; }
  if (name === "petrest") { await 宠物休息(ctx, t, u); return true; }
  if (name === "petfeed") { await 宠物喂食(ctx, t, u, a1 || ""); return true; }
  if (name === "pethome") { await 宠物小屋(ctx, t, u); return true; }
  if (name === "pethomebuild") { await 小屋建造(ctx, t, u); return true; }
  if (name === "petbuyfood") { await 宠物买食(ctx, t, u, a1, a2 || 1); return true; }
  if (name === "petautofeed") { await 宠物自动喂(ctx, t, u, a1 || ""); return true; }
  if (name === "buy" || name === "buys") { await buyItem(ctx, t, u, a1, a2 || 1); return true; }
  if (name === "usecoin") { await useItem(ctx, t, u, "幸运币", Math.max(1, Number(a1) || 1)); return true; }
  if (name === "questall") { await tClaim(ctx, t, u); return true; }
  if (name === "donate") { await donateAlly(ctx, t, u, a1 || 500); return true; }
  if (name === "recall") { await recallOne(ctx, t, ""); return true; }
  if (name === "sp") { await superpower(ctx, t, u, a1 === "不按" ? "不按" : "按下"); return true; }
  if (name === "fight") { await battle(ctx, t, u, "random", ""); return true; }
  // ---------- 2.1.0 新增按钮 ----------
  if (name === "bag") { await 背包面板(ctx, t, u, a1 || 1); return true; }
  if (name === "bagtidy") { await 一键整理(ctx, t, u); return true; }
  if (name === "teamfight") { await 队伍挑战(ctx, t, u); return true; }
  // 2.5.8：一键挑战已移除 —— 进度 / 取消 也走「已移除」提示（旧消息里的按钮同样拦得住）
  // 2.5.25：旧进度/取消面板代码已删除，这里统一走 开始一键挑战() 的拦截提示
  if (name === "acprogress" || name === "accancel") { await 开始一键挑战(ctx, t, u, 101); return true; }
  if (name === "acauto") { await 开始一键挑战(ctx, t, u, a1 || 101); return true; }
  if (name === "meditate") { await 打坐面板(ctx, t, u); return true; }
  if (name === "exp") { await 经验面板(ctx, t, u); return true; }
  // ---------- 2.2.0 按钮 ----------
  if (name === "dgl") { await 副本总览(ctx, t, u, (a2 === "boss" ? "boss#" : "") + (a1 || 1)); return true; }
  if (name === "shop") { await 商店面板(ctx, t, u, a1 || 1); return true; }
  if (name === "xgpanel") { await 战斗面板(ctx, t, u); return true; }
  if (name === "xgflee") { await 战斗行动(ctx, t, u, "flee"); return true; }
  if (name === "ba") { await 战斗行动(ctx, t, u, a1 || "atk", a2); return true; }
  if (name === "autoatk") {
    // 2.5.55：按钮也可以带时长（autoatk|2h / autoatk|30m / autoatk|1h30m）
    const 时 = 英文时长转中文(a1);
    if (时) {
      let 毫秒 = 解析挑战时长(时);
      const 截断 = 毫秒 > 自动时长上限毫秒;
      if (截断) 毫秒 = 自动时长上限毫秒;
      await 一键出招(ctx, t, u, 时长换次数(毫秒), { 时长毫秒: 毫秒, 原文: 时, 截断: 截断 });
      return true;
    }
    await 一键出招(ctx, t, u, a1 || 10);
    return true;
  }
  if (name === "autoatkfast" || name === "fastatk") { await 快速出招已移除(ctx, t); return true; }
  if (name === "autodetail" || name === "出招详情") { await 出招详情面板(ctx, t, u); return true; }
  if (name === "autostop" || name === "停止出招" || name === "停止自动") { await 停止出招(ctx, t, u); return true; }
  // 2.5.20 修复：`加点#装备名` 原来没人接 → 点【加点面板】无回复；同时兼容 `加点#名#属性#N`
  if (name === "加点" || name === "升级加点") {
    if (a2) { await 加点(ctx, t, u, a1 || "", a2, a3 ? Number(a3) : 1); return true; }
    await 加点面板(ctx, t, u, a1 || ""); return true;
  }
  if (name === "upeq") { await 升级装备(ctx, t, u, a1 || "", a2 ? Number(a2) : 1); return true; }
  if (name === "useitem") {
    const 量 = S(a2) === "全部" ? hasItem(ctx, u, S(a1)) : (Number(a2) || 1);
    await useItem(ctx, t, u, S(a1), 量);
    return true;
  }
  if (name === "cook") { await 做菜(ctx, t, u, a1 || "", a2 ? Number(a2) : 1); return true; }
  if (name === "cookpanel") { await 做菜面板(ctx, t, u); return true; }
  if (name === "gold") { await 兑金币(ctx, t, u, a1 || ""); return true; }
  // 2.3.0：兑换需二次确认
  if (name === "goldok") { await 兑金币(ctx, t, u, a1 || "全部", true); return true; }
  if (name === "goldall") { await 兑金币(ctx, t, u, "全部", false); return true; }
  if (name === "guide") { await 使用指南(ctx, t, u, a1 || 1); return true; }
  // 2.4.2：战斗界面新按钮
  if (name === "baguse") { await 背包面板(ctx, t, u, "药"); return true; }
  if (name === "dgpanel") { await 副本总览(ctx, t, u, ""); return true; }
  if (name === "gclaim") { await guideClaim(ctx, t, u); return true; }
  if (name === "addpt") { await 加点(ctx, t, u, a1 || "", a2 || "攻击", a3 ? Number(a3) : 1); return true; }
  if (name === "sign" || name === "checkin") { await doSign(ctx, t, u); return true; }
  if (name === "pet") { await 星灵升级(ctx, t, u, a1 || 1); return true; }
  if (name === "bounty") { await 悬赏领取(ctx, t, u); return true; }
  // 2.5.16 修复：`星核商店` 按钮（act 是中文而不是代码）原来没人接 → 「未识别的操作：星核商店」
  if (name === "星核商店" || name === "星核兑换" || name === "兑换商店") { await 星核商店面板(ctx, t, u); return true; }
  if (name === "商店" || name === "商城") { await 商店面板(ctx, t, u, a1 || 1); return true; }
  if (name === "背包") { await 背包面板(ctx, t, u, a1 || 1); return true; }
  if (name === "属性" || name === "信息") { await 属性面板(ctx, t, u); return true; }
  if (name === "星甲菜单" || name === "菜单") { await 星甲菜单(ctx, t, u); return true; }
  if (name === "副本" || name === "副本列表") { await 副本总览(ctx, t, u, a1 || ""); return true; }
  if (name === "BOSS列表" || name === "BOSS菜单") { await 副本总览(ctx, t, u, "boss"); return true; }
  if (name === "队伍" || name === "我的队伍") { await 队伍面板(ctx, t, u); return true; }
  if (name === "交易行" || name === "拍卖行") { await hallPanel(ctx, t, u); return true; }
  if (name === "银行" || name === "银行系统") { await bankPanel(ctx, t, u); return true; }
  if (name === "排行榜" || name === "排行") { await rankPanel(ctx, t, u, ""); return true; }
  // 2.5.16：兜底 —— 其它未知按钮当成「指令文本」再走一遍 dispatch，避免再出现「未识别的操作：XXX」
  try {
    const ok = await dispatch(ctx, ses, act);
    if (ok) return true;
  } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 按钮兜底解析失败:", act, e);
  }
  await reply(ctx, t, "未识别的操作：" + act + "\n发 `星甲完整菜单` 可查看全部指令。", { 标题: "提示", 按钮: [btn("uc1", "完整菜单", "完整菜单"), btn("uc2", "星甲菜单", "星甲菜单")] });
  return false;
}
