// lib/game/rebirth.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { registerWebuiCanonical } from "./../admin/webui.mjs?v=v1795284787963";
import { S, dall, dget, dn, ds, dset, fileOf, fmt, kfmt, rnd, ymd } from "./../core/base.mjs?v=v1795284787963";
import { actBtn, btn, reply, row } from "./../core/qq.mjs?v=v1795284787963";
import { 暴击率上限, 血量, 闪避上限 } from "./../core/rules.mjs?v=v1795284787963";
import { P } from "./../core/util.mjs?v=v1795284787963";
import fs from "node:fs";
import { 一键出招说明, 自动卡名 } from "././combat.mjs?v=v1795284787963";
import { 吃菜 } from "././cook.mjs?v=v1795284787963";
import { 全部装备, 蓝药说明表, 刷新卡清冷却 } from "././dungeon.mjs?v=v1795284787963";
import { fmtNum, 等级显示, 装备加成 } from "././equip.mjs?v=v1795284787963";
import { LV_BASE, strCount, 催熟, 是菜品, 转生门槛 } from "././farm.mjs?v=v1795284787963";
import { addCoin, addCore, addXp, attrs, gid, giveItem, hasAcc, hasItem, newAcc, pwrOf, recPwr, takeItem, 加经验, 百分比词条键, 系统称号巡检, 写蓝量 } from "././player.mjs?v=v1795284787963";
import { DG, dgDone, tInc, 剩挑战冷却 } from "././progress.mjs?v=v1795284787963";


// ---------- 网页后台（旧副本：已废弃） ----------
// 2.6.0：这一段是 2.2.x 的旧实现，路由与 registerWebuiCanonical() 完全重复，
//   但**从来没被调用**（plugin_init 只调 canonical）→ 属于「改这里不生效」的坑。
//   同一份文件里还有一份 adminHtml() 内联页面，也一并删掉（现在用 webui/admin.html）。
//   保留这个入口只为兼容可能的外部引用，内部直接转发。
export function registerWebui(ctx) {
  return registerWebuiCanonical(ctx);
}



/* ============================================================
 * 十三、玩家系统指令：开号 / 转生 / 强化 / 道具
 * ============================================================ */
export async function doRegister(ctx, t, u, nick, auto) {
  if (hasAcc(ctx, u)) {
    await reply(ctx, t, "你已经开号了，编号 **" + gid(ctx, u) + "**。", {
      标题: "账号已存在", 行组: [row(actBtn("h1", "⚡看属性", "info"), btn("h2", "副本", "副本"), btn("h3", "每日任务", "每日任务"))]
    });
    return false;
  }
  const no = newAcc(ctx, u, nick);
  await reply(ctx, t, [
    auto ? "检测到你还没有战甲，已自动为你登记。" : "登记完成，欢迎加入。",
    "",
    "编号：**" + no + "** · 昵称：" + (S(nick) || "新兵"),
    "攻击力 " + dn(ctx, P.攻击, u, 100) + " · 血量 500 · 星羽 500",
    "",
    "**下一步**",
    "- 发 `新手指引` 领取引导任务与奖励",
    "- 发 `签到` 领每日福利",
    "- 发 `副本` 或 `探索` 开始变强"
  ].join("\n"), {
    标题: "🛡️ 战甲登记成功",
    行组: [
      row(btn("i1", "新手指引", "新手指引"), btn("i2", "每日签到", "签到"), btn("i3", "副本", "副本")),
      row(actBtn("i4", "⚡看属性", "info"), btn("i5", "菜单", "菜单"))
    ]
  });
  return true;
}


export async function doRebirth(ctx, t, u) {
  const p = attrs(ctx, u);
  const 门槛 = 转生门槛(p.转生);
  if (p.等级 < 门槛) {
    await reply(ctx, t, [
      p.等级 + " / " + 门槛 + " 级，还没到转生线。",
      "等级达到 " + 门槛 + " 级后才能转生，转生获得永久属性加成并解锁新玩法。",
      "",
      "当前经验：" + p.经验
    ].join("\n"), {
      标题: "🔁 转生", 按钮: [btn("rl1", "去升级", "升级"), btn("rl2", "去刷经验", "副本")]
    });
    return;
  }
  const times = p.转生 + 1;
  const fire = rnd(40, 90);
  const crit = rnd(1, 3);
  dset(ctx, P.转生, u, times);
  try { 系统称号巡检(ctx, u); } catch (e) { /* 幂等巡检，失败不拦转生 */ }   // P9：转生达标自动授予
  // 2.6.x：转生获得永久属性加成，等级与经验不归零（等级无上限，可继续提升）
  dset(ctx, P.攻击, u, p.攻击 + fire);
  dset(ctx, P.暴击, u, p.暴击 + crit);
  dset(ctx, P.暴击率, u, dn(ctx, P.暴击率, u, 5) + 1);
  dset(ctx, P.血量上限, u, p.血量上限 + 150);
  dset(ctx, P.血量, u, p.血量上限 + 150);
  dset(ctx, P.星核, u, p.星核 + 5);
  recPwr(ctx, u);
  // 2.5.44：转生 +1% 暴击率，可能顶到上限，超出部分按 0.01% : 1 折算成经验
  const 溢出 = 溢出转经验(ctx, u);
  await reply(ctx, t, [
    "第 **" + times + "** 次转生完成！",
    "",
    "**等级保持在 Lv." + p.等级 + "**（不归零），等级无上限，可继续提升",
    "攻击力 +" + fire + " · 暴击 +" + crit + " · 暴击率 +1% · 血量上限 +150 · 星核 +5",
    (溢出.经验 ? 溢出文案(溢出) : ""),
    "",
    "**转生后解锁**",
    "- 下一转生门槛 Lv." + 转生门槛(times) + "（每转生 +30）",
    // 2.9.2：原来这里硬编码「虚空回廊（1 转）· 终焉之门（3 转）」—— 这两个名字只存在于
    //   已被 DG.length=0 清空的旧表里，现代副本表里没有，玩家照着找不到。
    //   改成从 DG 现算：本转生真正解锁的普通副本（段位一起带上）。
    // 2.9.3：不再点名任何已废弃副本（虚空回廊 / 终焉之门 早就被 DG.length=0 清掉），
    //   一律按「DG 里真实存在的普通副本」现算段位区间，并说明转生只卡等级。
    "- 解锁副本：" + (() => {
      const 列 = DG.filter((x) => !x.BOSS && Number(x.id) < 200 && Number(x.转) === times).sort((a, b) => Number(a.段) - Number(b.段));
      if (!列.length) return "无（本转没有新增普通副本，继续升等级 / 强化即可）";
      const 低 = Number(列[0].段) || 0, 高 = Number(列[列.length - 1].段) || 0;
      return "**段 " + 低 + (高 > 低 ? "~" + 高 : "") + "**（" + 列.map((x) => x.名).join(" / ") + "）"
        + "—— 转生只看等级达标，达到这些段位的副本即可挑战";
    })(),
    // 2.9.3：删掉「神圣强化（+10 级强化段）」—— 全文件没有任何实现（无字段 / 无 +10 逻辑 / 无上限），
    //   属于纯误导文案。转生的真实效果就是上面几行：属性加成 + 解锁更高段位副本。
    "- 转生会永久提升战力（攻击 / 暴击 / 暴击率 / 血量上限 / 星核），并解锁更高段位副本"
  ].filter((x) => x !== null && x !== undefined && x !== false).join("\n"), {
    标题: "✨ 转生成功",
    行组: [row(actBtn("rb1", "⚡看属性", "info"), btn("rb2", "副本", "副本"), btn("rb3", "排行榜", "排行榜"))]
  });
}


/* ---------- 2.9.2（B2 修复）强化副本取法 ----------
 * 强化第 n 次要「段位 = 30 + 10(n-1)」的副本，但星甲副本里并没有每个 10 段都正好有的普通副本
 * （实际是 30 虫壁 / 45 天秀 / 60 强体 / 80 屠龙 / 100 剑圣 / 130 蟒族 …）。
 * 原来 段 === seg 找不到就 return null → 第 2 次强化起直接「强化副本数据未就绪」，玩法断死；
 * 而且旧写法会把 BOSS 条目（段位同样是 10 的倍数）当成强化副本，玩家被要求去打 BOSS。
 * 现在：① 优先「段位正好 = seg 的普通副本」；② 没有就「段位 ≥ seg 的最低普通副本」；
 *       ③ 段位超过现有最高普通副本才判定「已达当前上限」。
 * 注意：不往 星甲副本 里加条目 —— 副本表喂着 副本基准属性() → BOSS 血/攻/防，
 *       一改整张 BOSS 标定表就作废（这正是禁止改副本表的原因）。
 */
export function 强化副本最高段() {
  const 普通 = DG.filter((x) => !x.BOSS && Number(x.id) < 200 && Number(x.段) > 0);
  return 普通.reduce((a, x) => Math.max(a, Number(x.段) || 0), 0);
}


export function strDungeon(nth) {
  const seg = 30 + (nth - 1) * 10;
  const 普通 = DG.filter((x) => !x.BOSS && Number(x.id) < 200 && Number(x.段) > 0)
    .sort((a, b) => Number(a.段) - Number(b.段));
  const 正好 = 普通.filter((x) => Number(x.段) === seg)[0];
  if (正好) return 正好;
  return 普通.filter((x) => Number(x.段) >= seg)[0] || null;
}


export async function doStrengthen(ctx, t, u) {
  const p = attrs(ctx, u);
  const can = strCount(p.等级);
  if (can <= 0) {
    await reply(ctx, t, "等级达到 " + LV_BASE + " 级后，每 10 级可强化一次。\n当前等级 " + p.等级 + "。", {
      标题: "🔧 战甲强化", 按钮: [btn("a1", "去升级", "升级"), btn("a2", "副本刷经验", "副本")]
    });
    return;
  }
  const next = p.强化 + 1;
  if (next > can) {
    await reply(ctx, t, [
      "当前强化 " + p.强化 + " 次，已经用满（等级 " + p.等级 + " 最多 " + can + " 次）。",
      "再升 10 级就能继续强化。"
    ].join("\n"), { 标题: "🔧 战甲强化", 按钮: [btn("b1", "去升级", "升级")] });
    return;
  }
  const need = strDungeon(next);
  if (!need) {
    // 2.9.2（B2）：不再给「数据未就绪」这种像是故障的提示，明确说明已达上限
    await reply(ctx, t, [
      "战甲强化已达当前上限（第 " + next + " 次需要段位 " + (30 + (next - 1) * 10) + " 的副本，现有最高普通副本段位 " + 强化副本最高段() + "）。",
      "后续开放更高段副本后可以继续强化。"
    ].join("\n"), { 标题: "🔧 战甲强化", 按钮: [btn("b1", "去升级", "升级"), btn("b2", "副本列表", "副本")] });
    return;
  }
  if (!dgDone(ctx, u, need.id)) {
    await reply(ctx, t, [
      "第 " + next + " 次强化需要先通关副本【" + need.名 + "】。",
      "副本等级段：" + need.段 + "+ · 推荐战力 " + need.力,
      "",
      "发送 `挑战" + need.id + "` 或点下面按钮直接打。"
    ].join("\n"), {
      标题: "🔧 强化条件不足",
      行组: [row(actBtn("c1", "⚡挑战" + need.名, "dg|" + need.id, 4), btn("c2", "副本列表", "副本"))]
    });
    return;
  }
  const fire = rnd(30, 70) + next * 10;
  const dur = rnd(60, 140) + next * 20;
  const crit = rnd(1, 2);
  const dod = rnd(1, 2);
  dset(ctx, P.强化, u, next);
  dset(ctx, P.攻击, u, p.攻击 + fire);
  dset(ctx, P.血量上限, u, p.血量上限 + dur);
  dset(ctx, P.血量, u, p.血量 + dur);
  dset(ctx, P.暴击, u, p.暴击 + crit);
  dset(ctx, P.闪避, u, p.闪避 + dod);
  recPwr(ctx, u);
  tInc(ctx, u, "强化");
  const nx = strDungeon(next + 1);
  await reply(ctx, t, [
    "强化完成：**+" + next + "**",
    "",
    "攻击力 +" + fire + " · 血量上限 +" + dur,
    "暴击 +" + crit + " · 闪避 +" + dod,
    "",
    "下次强化需：等级 " + (30 + next * 10) + "，并通关副本【" + (nx ? nx.名 : "后续副本") + "】"
  ].join("\n"), {
    标题: "🔧 强化成功", 行组: [row(actBtn("e1", "⚡看属性", "info"), btn("e2", "继续升级", "升级"))]
  });
}


export const USE_DEFAULT = { 红色血清: 1, 翠露散: 1, 强化组件: 1, 刷新卡: 1, 护盾芯片: 1, 幸运币: 1, 幸运星: 1, 陨石碎片: 1, 鱼饵: 1, 太空废铁: 10, 小鱼: 0, 大鱼: 0, 稀有鱼: 0, 传说鱼: 0, 改名卡: 1, 自动卡: 1,
  经验芯片: 1, 火力核心: 1, 星辉宝箱: 1,
  // 2.2.5 药品
  赤霄血露: 1, 碧髓回春液: 1, 玄元凝血膏: 1, 九幽血髓酿: 1, 太虚还魂汤: 1 };


// 2.2.5：药品集合（背包里归为「药」，战斗中回血需要消耗）
// 3.0.0（需求 12）：商店药物全部重命名（不复用参考截图里的名字）
export const 药品集 = ["翠露散", "赤霄血露", "碧髓回春液", "玄元凝血膏", "九幽血髓酿", "太虚还魂汤", "青霜灵液", "幽泉灵乳",
  // 3.0.0（需求 13）：药园成药也进战斗药品表（取进背包后可在战斗/自动出招里用）
  "凝露散", "赤心丹", "玄霜玉液", "太虚还春丹", "霜华露", "泉心玉髓"];


export const 药品回血 = { 翠露散: 80, 赤霄血露: 60, 碧髓回春液: 200, 玄元凝血膏: 600, 九幽血髓酿: 2000, 太虚还魂汤: 5000,
  凝露散: 5200, 赤心丹: 8700, 玄霜玉液: 14700, 太虚还春丹: 24500 };
// 3.0.0（需求 17）：蓝药 —— 战斗中使用可回复蓝量
// 3.2.0（需求 3）：蓝量改成全局资源后，战斗外 `使用青霜灵液` 同样补全局蓝量；自动回蓝常开（不可关闭）
export const 药品回蓝 = { 青霜灵液: 50, 幽泉灵乳: 200, 霜华露: 300, 泉心玉髓: 1000 };


// 3.2.0（需求 2）：蓝药说明表 —— **唯一一份**定义在 dungeon.mjs（商店数据主场），这里 import 复用，
//   商店（商店新增说明）/ 背包 / `使用蓝药` 回执共用同一份文案（口径不会打架）。
//   （不在本文件重新 export，避免与 dungeon.mjs 的同名导出重复。）


// 蓝药（按「便宜优先」排序：小瓶先喝，避免一上来就消耗大药）
export const 蓝药集 = Object.keys(药品回蓝).sort((a, b) => (药品回蓝[a] || 0) - (药品回蓝[b] || 0));


export function 是蓝药(nm) { return !!药品回蓝[S(nm)]; }


export function 有蓝药(ctx, u) {
  return 蓝药集.filter((nm) => hasItem(ctx, u, nm) > 0);
}


/* 3.2.0（需求 3）：自动回蓝（常开，没有开关）
 *  · 触发：蓝量不足以放当前技能，或蓝量 = 0（由调用方传「需要」的蓝量）
 *  · 用哪个：**便宜（小瓶）优先** —— 按 药品回蓝 从小到大喝，喝到「够放这个技能」就停，不浪费大药
 *  · 没蓝药 / 喝了还不够 → ok:false，调用方据此「弹出提醒 + 停自动出招 / 禁止继续放技能（普攻仍可）」
 *  · rec 可以是战斗记录（rec.mp / rec.mpMax），也可以是 PVP 的一方（同名字段）
 */
export function 自动喝蓝药(ctx, u, rec, 需要) {
  const 顶 = Math.max(0, Math.floor(Number(rec && rec.mpMax) || 0));
  const 现 = Math.max(0, Math.floor(Number(rec && rec.mp) || 0));
  const 值 = Math.max(1, Math.floor(Number(需要) || 1));
  if (现 >= 值) return { ok: true, 药: "", 回: 0, 剩: -1, 蓝: 现, 缺药: false };   // 够用，不喝
  const 可 = 有蓝药(ctx, u);
  if (!可.length) return { ok: false, 药: "", 回: 0, 剩: 0, 蓝: 现, 缺药: true };
  const 顺序 = 可.slice().sort((a, b) => (药品回蓝[a] || 0) - (药品回蓝[b] || 0));
  let 回 = 0;
  const 用了 = {};
  for (const nm of 顺序) {
    while (hasItem(ctx, u, nm) > 0 && 现 + 回 < 值) {
      takeItem(ctx, u, nm, 1);
      回 += 药品回蓝[nm] || 50;
      用了[nm] = (用了[nm] || 0) + 1;
    }
    if (现 + 回 >= 值) break;
  }
  const 实 = 顶 > 0 ? Math.min(回, Math.max(0, 顶 - 现)) : 回;
  rec.mp = 现 + 实;
  const 名 = Object.keys(用了).map((k) => k + "×" + 用了[k]).join("+");
  const 首 = Object.keys(用了)[0] || "";
  const 够 = (Number(rec.mp) || 0) >= 值;
  return { ok: 够, 药: 名, 回: 实, 剩: 首 ? hasItem(ctx, u, 首) : 0, 蓝: rec.mp, 缺药: !够 };
}


// 自动回蓝的简短提示（省 token）
export function 回蓝提示(r, rec) {
  if (!r || !r.药) return "";
  return "🔵 自动喝蓝药【" + r.药 + "】+" + r.回 + "蓝 → " + rec.mp + "/" + (rec.mpMax || "?") + (r.剩 >= 0 ? "（剩" + r.剩 + "）" : "");
}


// 没蓝药时的统一提醒（需求 3：弹出提醒「没有蓝了，需要买蓝药」，并且不再自动放技能）
export const 没蓝提醒 = "没有蓝了，需要买蓝药";


/* 3.0.0（需求 12）药物改名的存档迁移：老库存的旧药名并进新药名（幂等）
 * 旧：翠露散/赤霄血露/碧髓回春液/玄元凝血膏/九幽血髓酿/太虚还魂汤
 */
export const 药物改名表 = {
  绿色血清: "翠露散", 小血瓶: "赤霄血露", 中血瓶: "碧髓回春液",
  大血瓶: "玄元凝血膏", 超级血清: "九幽血髓酿", 万能药: "太虚还魂汤"
};
export function 迁移药物改名(ctx) {
  let n = 0;
  for (const 旧 of Object.keys(药物改名表)) {
    const 新 = 药物改名表[旧];
    const 源rel = "游戏数据/星舰数据/道具系统/" + 旧 + ".json";
    const 源 = dall(ctx, 源rel);
    const 键 = Object.keys(源);
    if (!键.length) continue;
    const 新rel = "游戏数据/星舰数据/道具系统/" + 新 + ".json";
    const 目标 = dall(ctx, 新rel);
    for (const k of 键) 目标[k] = (Number(目标[k]) || 0) + (Number(源[k]) || 0);
    for (const k of Object.keys(目标)) dset(ctx, 新rel, k, 目标[k]);
    try { fs.unlinkSync(fileOf(ctx, 源rel)); } catch (e) { /* ignore */ }
    n += 键.length;
  }
  if (n && ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 药物改名迁移：" + n + " 条库存已并到新药名");
  return n;
}
export function 是药品(nm) { return 药品集.indexOf(S(nm)) >= 0; }

/* 3.2.0（需求 3）：`使用蓝药` —— 自动挑背包里最便宜的蓝药补全局蓝量（战斗内同步 rec.mp）
 */
export async function 使用蓝药(ctx, t, u, 数量) {
  const 有 = 蓝药集.filter((nm) => hasItem(ctx, u, nm) > 0);
  if (!有.length) {
    await reply(ctx, t, "🔵 **" + 没蓝提醒 + "**\\n商店可买：青霜灵液（150 星羽 / +50 蓝）、幽泉灵乳（500 星羽 / +200 蓝）。", {
      标题: "🔵 没有蓝药", 行组: [row(btn("mpb1", "商店买蓝药", "商店"), btn("mpb2", "背包", "背包"), btn("mpb3", "属性", "info"))]
    });
    return;
  }
  const p = attrs(ctx, u);
  const 顶 = Number(p.蓝量上限) || 100;
  const 现 = Number(p.蓝量) || 0;
  if (现 >= 顶) { await reply(ctx, t, "你的蓝量已满（" + 现 + "/" + 顶 + "），不用喝。", { 标题: "🔵 蓝量" }); return; }
  const k = Math.max(1, Math.min(20, Math.floor(Number(数量) || 1)));
  const nm = 有[0];                       // 蓝药集 已按回蓝量升序 = 便宜优先
  const 单 = 药品回蓝[nm] || 50;
  const 需要 = Math.max(1, Math.ceil(Math.max(0, 顶 - 现) / 单));
  const 实 = Math.min(需要, Math.max(1, k), hasItem(ctx, u, nm));
  takeItem(ctx, u, nm, 实);
  const 新 = 写蓝量(ctx, u, Math.min(顶, 现 + 单 * 实), 顶);
  const rec = dget(ctx, P.战斗, u, null);
  if (rec && typeof rec === "object" && !rec.结果) { rec.mp = 新; dset(ctx, P.战斗, u, rec); }
  await reply(ctx, t, ["使用 " + 实 + " 个【" + nm + "】，蓝量 +" + (新 - 现) + "（现 " + 新 + "/" + 顶 + "）", "剩余：" + hasItem(ctx, u, nm) + " 个", 蓝药说明表[nm] || ""].filter(Boolean).join("\\n"), {
    标题: "🔵 使用蓝药", 行组: [row(actBtn("mpc1", "看属性", "info"), btn("mpc2", "商店", "商店"), btn("mpc3", "战斗", "战斗"))]
  });
}


/* ---------- 2.5.38 商店道具「每日属性上限」 ----------
 * 需求：幸运星 / 火力核心 / 护盾芯片 这类能**永久加属性**的道具，加的属性太多了，必须限量。
 * 2.5.41：上限由 500 下调为 100。
 * 2.5.43（本版）：**改成按「道具」记额度**，不再按「属性」记。
 *   原因：「血量上限」被 红色血清(要 5000) 与 护盾芯片(要 1000) 共用，
 *        按属性记会互相串额度（吃血清把芯片的额度也吃光）。
 * 新额度：红色血清 5000 · 幸运星 100（保持原值）· 其余全部 1000。
 * 规则：每天 00:00 自动重置（按日期比对，不需要定时任务）；经验芯片不受限制。
 * 覆盖道具：幸运星(暴伤+5%) · 火力核心(攻击力+30) · 幸运护符(闪避率+5%) ·
 *          护盾芯片(血量上限+50) · 红色血清(血量上限+30) · 强化组件(攻击力+5~15)
 */
export const 属性每日上限 = 1000;

                        // 默认额度（2.5.43：100 → 1000）
export const 上限豁免 = { 经验: true, 经验值: true, 经验芯片: true };


// 每个道具自己的每日额度（优先于属性额度）
export const 道具上限表 = { 红色血清: 5000, 幸运星: 100 };


// 属性额度（道具没单列时用这个兜底）
export const 属性上限表 = {
  暴击: 1000, 暴击率: 1000, 暴伤: 1000, 暴击伤害: 1000,
  攻击: 1000, 攻击: 1000, 防御: 1000,
  血量: 1000, 血量: 1000, 血量上限: 1000, 闪避: 1000, 闪避率: 1000
};


// 某道具在某属性上的每日额度
export function 道具额度(道具名, 属性) {
  const 名 = S(道具名);
  if (名 && 道具上限表[名] !== undefined) return Number(道具上限表[名]) || 0;
  return Number(属性上限表[S(属性)]) || 属性每日上限;
}


// 该属性的每日额度（跨天自动重置）；传 道具名 则按道具单独记额度
export function 上限额度(ctx, u, 属性, 道具名) {
  const 名 = S(属性);
  if (上限豁免[名]) return Infinity;
  const 上限 = 道具额度(道具名, 名);
  const 键 = S(道具名) ? "道具:" + S(道具名) : 名;
  const all = dget(ctx, P.每日上限, u, null);
  const o = all && typeof all === "object" ? all : {};
  if (S(o.日期) !== ymd()) return 上限;                 // 不是今天 → 满额度
  return Math.max(0, 上限 - (Number(o[键]) || 0));
}


// 记一次属性收益（经验不记）
export function 记上限(ctx, u, 属性, 量, 道具名) {
  const 名 = S(属性);
  const 加量 = Math.floor(Number(量) || 0);
  if (上限豁免[名] || 加量 <= 0) return;
  const 键 = S(道具名) ? "道具:" + S(道具名) : 名;
  const all = dget(ctx, P.每日上限, u, null);
  const o = all && typeof all === "object" ? all : {};
  const 今 = ymd();
  const 底 = S(o.日期) === 今 ? o : {};
  const 新 = Object.assign({}, 底);
  新.日期 = 今;
  新[键] = (Number(底[键]) || 0) + 加量;
  dset(ctx, P.每日上限, u, 新);
}


// 按额度截断「可用个数」：每个加 点 → 返回 { 用, 加点, 满, 额度 }
export function 按额度取用(ctx, u, 属性, 每个加, 想要, 道具名) {
  const 额度 = 上限额度(ctx, u, 属性, 道具名);
  const 单 = Math.max(0, Math.floor(Number(每个加) || 0));
  const 最多 = 单 > 0 && Number.isFinite(额度) ? Math.floor(额度 / 单) : Math.floor(Number(想要) || 0);
  const 用 = Math.max(0, Math.min(Math.floor(Number(想要) || 0), 最多));
  return { 用: 用, 加点: 用 * 单, 满: 用 <= 0, 额度: 额度 };
}


/* ---------- 2.5.44 暴击率 / 闪避率「溢出转经验」 ----------
 * 需求：超出上限的部分（暴击率 80% / 闪避率 40%）以前直接作废，
 *      现在按 **0.01% : 1 经验** 折算成经验补给玩家（即 1% = 100 经验）。
 * 实现要点（踩坑预防）：
 *   ① **不裁剪属性**：`P.暴击率` / `P.闪避` 是「基础值 + 装备词条」的混合值，
 *      `应用装备()` 穿/脱时会按差值精确加减；一旦裁剪，脱下装备就会扣到负数偏小、
 *      再穿回来又重复计算 → 装备平衡全乱。所以属性数值一律不动。
 *   ② 用「水位」记**已经发过经验的溢出量**（存活在 P.溢出水位），只发「新增的溢出」，
 *      避免每次打开面板都重复发。
 *   ③ 水位**只增不减**（不随脱装备回落）：否则「穿上→领经验→脱下→穿上→再领」
 *      可以无限刷经验。
 */
export const 溢出经验比 = 100;

             // 1% 溢出 = 100 经验（等价 0.01% = 1 经验）
export function 溢出水位(ctx, u) {
  const v = dget(ctx, P.溢出水位, u, null);
  return v && typeof v === "object" ? v : {};
}


// 计算并发放「新增加的溢出」对应的经验；返回本次发了多少
export function 溢出转经验(ctx, u) {
  const out = { 暴击率溢出: 0, 闪避溢出: 0, 经验: 0, 升级: 0, 满级: false };
  if (!u || !hasAcc(ctx, u)) return out;
  const p = attrs(ctx, u);
  const 两位 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const 暴溢 = Math.max(0, 两位((Number(p.暴击率) || 0) - 暴击率上限));
  const 闪溢 = Math.max(0, 两位((Number(p.闪避) || 0) - 闪避上限));
  const 旧 = 溢出水位(ctx, u);
  const 旧暴 = Math.max(0, Number(旧.暴击率) || 0);
  const 旧闪 = Math.max(0, Number(旧.闪避) || 0);
  // 只算「超过水位」的新增部分；不足 0.01% 的零头不计（水位也不推进，下次继续攒）
  const 暴单位 = Math.max(0, Math.floor(两位(暴溢 - 旧暴) * 溢出经验比 + 1e-6));
  const 闪单位 = Math.max(0, Math.floor(两位(闪溢 - 旧闪) * 溢出经验比 + 1e-6));
  const 单位 = 暴单位 + 闪单位;
  const 新暴 = Math.min(暴溢, 两位(旧暴 + 暴单位 / 溢出经验比));
  const 新闪 = Math.min(闪溢, 两位(旧闪 + 闪单位 / 溢出经验比));
  const 累计 = (Number(旧.累计经验) || 0) + 单位;
  if (!单位 && 新暴 === 旧暴 && 新闪 === 旧闪) return out;   // 没有任何变化 → 不写盘
  dset(ctx, P.溢出水位, u, { 暴击率: 新暴, 闪避: 新闪, 累计经验: 累计, 日期: ymd() });
  if (!单位) return out;
  out.暴击率溢出 = 暴单位 / 溢出经验比;
  out.闪避溢出 = 闪单位 / 溢出经验比;
  out.经验 = 单位;
  out.累计经验 = 累计;
  const up = 加经验(ctx, u, 单位);
  if (up && typeof up === "object") { out.升级 = up.升级 || 0; out.满级 = !!up.满级; }
  return out;
}


// 统一的「溢出转经验」提示行（没发经验就返回空串）
export function 溢出文案(r, 前缀) {
  if (!r || !r.经验) return "";
  const 段 = [];
  if (r.暴击率溢出) 段.push("暴击率溢出 " + fmtNum(r.暴击率溢出) + "%");
  if (r.闪避溢出) 段.push("闪避率溢出 " + fmtNum(r.闪避溢出) + "%");
  return (前缀 || "💡 ") + "溢出转经验：" + 段.join(" + ") + " → **经验 +" + r.经验 + "**（0.01% = 1 经验）"
    + (r.升级 ? "，升级 +" + r.升级 : "") + (r.满级 ? "（已满级，经验已封顶）" : "");
}


// 额度用尽时的统一提示
export async function 属性上限提示(ctx, t, 道具名, 属性, 每个加, 想用) {
  const 本上限 = 道具额度(道具名, 属性);
  await reply(ctx, t, [
    "🚫 今日【" + 属性 + "】额度已用完",
    "",
    "· 道具：" + 道具名 + "（每个 +" + 每个加 + " " + 属性 + "）",
    "· 你这次想用 " + 想用 + " 个，但今天已经加满了",
    "· 本道具每日上限：**" + 本上限 + "**（**明天 00:00 自动重置**）",
    "· 经验类道具（经验芯片）**不受限制**",
    "",
    "（这条限制是为了防止道具把属性堆爆，影响平衡）"
  ].join("\n"), {
    标题: "🚫 今日已达上限",
    行组: [row(actBtn("lm1", "⚡看属性", "info"), btn("lm2", "商店", "商店"), btn("lm3", "星甲菜单", "星甲菜单"))]
  });
}



export async function useItem(ctx, t, u, name, cnt) {
  // 3.2.0（需求 3）：`使用蓝药` —— 自动挑**最便宜**的蓝药（不用记名字）；一个都没有就按「没蓝了」提醒
  if (S(name) === "蓝药") {
    const 有 = 有蓝药(ctx, u);
    if (!有.length) {
      await reply(ctx, t, [
        没蓝提醒 + "。",
        "",
        "· 商店可买：青霜灵液（150 星羽 / 瓶，+50 蓝）、幽泉灵乳（500 星羽 / 瓶，+200 蓝）",
        "· 药园可炼：霜华露（+300 蓝）、泉心玉髓（+1000 蓝）",
        "· 买好后发 `使用青霜灵液`（或 `使用蓝药` 自动挑最便宜的）"
      ].join("\n"), { 标题: "🔵 没有蓝药", 行组: [row(btn("mp9", "商店买蓝药", "商店"), btn("mp10", "药园", "药园"), btn("mp11", "属性", "info"))] });
      return;
    }
    name = 有[0];
  }
  const have = hasItem(ctx, u, name);
  const k = Math.max(1, Math.floor(Number(cnt) || USE_DEFAULT[name] || 1));
  // 2.9.12：生长药水走催熟流程（`星甲使用生长药水#地块号` ≡ `星甲催熟#地块号`；不带地块号 = 看用法）。
  //   必须放在「have < k」拦截之前 —— cnt 在这里是地块号，不是数量。
  if (name === "生长药水") { await 催熟(ctx, t, u, cnt); return; }
  if (have < k) { await reply(ctx, t, "你只有 " + have + " 个【" + name + "】，不够用 " + k + " 个。", { 标题: "使用失败" }); return; }
  const p = attrs(ctx, u);
  // 3.0.0（需求 17）：蓝药 —— 战斗中直接补蓝（蓝量是战斗内资源，战斗外喝了没意义）
  if (药品回蓝[name]) {
    const 单 = 药品回蓝[name];
    const rec = dget(ctx, P.战斗, u, null);
    const 在战 = !!(rec && typeof rec === "object" && !rec.结果);
    if (在战) {
      const 缺 = Math.max(0, (Number(rec.mpMax) || 0) - (Number(rec.mp) || 0));
      if (缺 <= 0) { await reply(ctx, t, "你的蓝量已满，不需要喝蓝药。", { 标题: "🧪 " + name }); return; }
      const 实际 = Math.max(1, Math.min(k, Math.ceil(缺 / 单)));
      takeItem(ctx, u, name, 实际);
      rec.mp = Math.min(Number(rec.mpMax) || 0, (Number(rec.mp) || 0) + 单 * 实际);
      dset(ctx, P.战斗, u, rec);
      await reply(ctx, t, [
        "使用 " + 实际 + " 个【" + name + "】，蓝量 +" + (单 * 实际) + "（现 " + rec.mp + "/" + rec.mpMax + "）",
        "剩余：" + hasItem(ctx, u, name) + " 个",
        蓝药说明表[name] || ""
      ].filter(Boolean).join("\n"), {
        标题: "🧪 " + name,
        行组: [row(actBtn("mp1", "⚡继续战斗", "战斗"), actBtn("mp2", "⚡普通攻击", "ba|atk"), btn("mp3", "商店", "商店"))]
      });
      return;
    }
    // 3.2.0（需求 1/3）：战斗外也**能喝** —— 补的是全局蓝量（下次进战斗直接继承）
    const 顶 = Number(p.蓝量上限) || 100;
    const 现 = Number(p.蓝量) || 0;
    if (现 >= 顶) { await reply(ctx, t, "你的蓝量已满（" + 现 + "/" + 顶 + "），不需要喝蓝药。", { 标题: "🧪 " + name }); return; }
    const 实际 = Math.max(1, Math.min(k, Math.ceil(Math.max(0, 顶 - 现) / 单)));
    takeItem(ctx, u, name, 实际);
    const 新 = 写蓝量(ctx, u, Math.min(顶, 现 + 单 * 实际), 顶);
    await reply(ctx, t, [
      "使用 " + 实际 + " 个【" + name + "】，蓝量 +" + (新 - 现) + "（现 " + 新 + "/" + 顶 + "）",
      "剩余：" + hasItem(ctx, u, name) + " 个",
      蓝药说明表[name] || ""
    ].filter(Boolean).join("\n"), {
      标题: "🧪 " + name,
      行组: [row(actBtn("mp4", "⚡看属性", "info"), btn("mp5", "商店", "商店"), btn("mp6", "副本", "副本"))]
    });
    return;
  }
  if (name === "红色血清") {
    const 取 = 按额度取用(ctx, u, "血量上限", 30, k, name);
    if (取.满) { await 属性上限提示(ctx, t, name, "血量上限", 30, k); return; }
    takeItem(ctx, u, name, 取.用);
    const add = 取.加点;
    dset(ctx, P.血量上限, u, p.血量上限 + add);
    dset(ctx, P.血量, u, p.血量 + add);
    记上限(ctx, u, "血量上限", add, name);
    recPwr(ctx, u);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, [
      "使用 " + 取.用 + " 个红色血清，血量上限 +" + add + "（现 " + (p.血量上限 + add) + "）",
      (取.用 < k ? "⚙️ 今日【红色血清】额度只剩这么多：本次只用 " + 取.用 + " 个（本道具每日上限 " + 道具额度(name, "血量上限") + "），其余保留" : "")
    ].filter(Boolean).join("\n"), { 标题: "🧪 红色血清" });
    return;
  }
  // 2.2.5：统一药品（翠露散 / 赤霄血露 / 碧髓回春液 / 玄元凝血膏 / 九幽血髓酿 / 太虚还魂汤）—— 回血必须消耗
  if (是药品(name)) {
    const 单回 = 药品回血[name] || 60;
    // 2.3.0 修复：不再一次用光 —— 按「回满所需」截断，多余的不消耗
    const 缺 = Math.max(0, p.血量上限 - p.血量);
    const 实际 = Math.max(1, Math.min(k, Math.ceil(缺 / 单回) || 1));
    takeItem(ctx, u, name, 实际);
    const 新 = Math.min(p.血量上限, p.血量 + 单回 * 实际);
    dset(ctx, P.血量, u, 新);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, [
      "使用 " + 实际 + " 个【" + name + "】，血量 +" + (新 - p.血量) + "（现 " + 新 + "/" + p.血量上限 + "）",
      (实际 < k ? "⚙️ 只用了 " + 实际 + " 个就回满了，其余保留（原本要 " + k + " 个）" : ""),
      "剩余：" + hasItem(ctx, u, name) + " 个"
    ].filter(Boolean).join("\n"), {
      标题: "🧪 " + name,
      行组: [row(actBtn("hp4", "⚡再用1个", "useitem|" + name + "|1"), actBtn("hp5", "⚡用全部", "useitem|" + name + "|全部"), actBtn("hp6", "⚡属性", "info"), btn("hp7", "商店", "商店"))]
    });
    return;
  }
  if (name === "强化组件") {
    // 2.5.38：受「攻击力」每日上限约束（5~15 随机 → 加满额度就停，只消耗实际用掉的个数）
    // 2.5.43：额度改为按道具记（强化组件 1000）
    const 额度 = 上限额度(ctx, u, "攻击", name);
    let add = 0, 用 = 0;
    for (let i = 0; i < k; i++) {
      if (add >= 额度) break;
      add += rnd(5, 15);
      用 += 1;
    }
    if (!用) { await 属性上限提示(ctx, t, name, "攻击", "5~15", k); return; }
    takeItem(ctx, u, name, 用);
    dset(ctx, P.攻击, u, p.攻击 + add);
    记上限(ctx, u, "攻击", add, name);
    recPwr(ctx, u);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, [
      "使用 " + 用 + " 个强化组件，攻击力 +" + add + "（现 " + (p.攻击 + add) + "）",
      (用 < k ? "⚙️ 今日【强化组件】额度只剩这么多：本次只用 " + 用 + " 个（本道具每日上限 " + 道具额度(name, "攻击") + "），其余保留" : "")
    ].filter(Boolean).join("\n"), { 标题: "⚙️ 强化组件" });
    return;
  }
  if (name === "刷新卡") {
    /* 3.0.0（需求 B）：刷新卡从「一张清全部冷却」改成「**一张清 20 分钟**」。
     * 3.1.1（BUG 修复）：原来这里用 `await import("././dungeon.mjs")` **不带 ?v=** 动态导入，
     *   等于又加载了一份 dungeon.mjs 实例；dungeon.mjs 顶层有 `DG.length = 0` 再 push 副本表，
     *   于是共享的 DG 数组里的 BOSS 条目被清空 → 用完刷新卡后 BOSS 列表「有标题没条目」，
     *   重启后重新按正常顺序载入才恢复。
     *   现在改成**静态导入**（顶部已 import dungeon.mjs，同一份实例），不再产生第二份模块。 */
    await 刷新卡清冷却(ctx, t, u, k);
    return;
  }
  if (name === "护盾芯片") {
    const 取 = 按额度取用(ctx, u, "血量上限", 50, k, name);
    if (取.满) { await 属性上限提示(ctx, t, name, "血量上限", 50, k); return; }
    takeItem(ctx, u, name, 取.用);
    dset(ctx, P.血量上限, u, p.血量上限 + 取.加点);
    dset(ctx, P.血量, u, p.血量 + 取.加点);
    记上限(ctx, u, "血量上限", 取.加点, name);
    recPwr(ctx, u);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, [
      "使用 " + 取.用 + " 个护盾芯片，血量上限 +" + 取.加点,
      (取.用 < k ? "⚙️ 今日【护盾芯片】额度只剩这么多：本次只用 " + 取.用 + " 个（本道具每日上限 " + 道具额度(name, "血量上限") + "），其余保留" : "")
    ].filter(Boolean).join("\n"), { 标题: "🛡️ 护盾芯片" });
    return;
  }
  if (name === "幸运币") {
    takeItem(ctx, u, name, k);
    let got = 0;
    for (let i = 0; i < k; i++) {
      const r = Math.random();
      got += r < 0.5 ? rnd(50, 150) : r < 0.85 ? rnd(200, 450) : r < 0.98 ? rnd(600, 1200) : rnd(2000, 5000);
    }
    addCoin(ctx, u, got);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, "投出 " + k + " 枚幸运币，共获得 **" + got + "** 星羽。", {
      标题: "🍀 幸运币", 按钮: [actBtn("f1", "⚡再来1枚", "usecoin|1"), btn("f2", "商店", "商店")]
    });
    return;
  }
  if (name === "太空废铁") {
    takeItem(ctx, u, name, k);
    const got = k * 10;
    addCoin(ctx, u, got);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, "拆解 " + k + " 个太空废铁，获得 " + got + " 星羽。", { 标题: "♻️ 太空废铁" });
    return;
  }
  if (name === "陨石碎片") {
    takeItem(ctx, u, name, k);
    addCore(ctx, u, k);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, "精炼 " + k + " 个陨石碎片，获得 " + k + " 星核。", { 标题: "💎 陨石碎片" });
    return;
  }
  if (name === "幸运星") {
    // 2.5.43：幸运星不再加「暴击」，改为**暴击伤害（暴伤）+5%**，直接进属性面板
    const 取 = 按额度取用(ctx, u, "暴伤", 5, k, name);
    if (取.满) { await 属性上限提示(ctx, t, name, "暴伤", 5, k); return; }
    takeItem(ctx, u, name, 取.用);
    dset(ctx, P.暴伤, u, p.暴伤 + 取.加点);
    记上限(ctx, u, "暴伤", 取.加点, name);
    recPwr(ctx, u);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, [
      "吸收 " + 取.用 + " 颗幸运星，暴击伤害 +" + 取.加点 + "%（现 " + (p.暴伤 + 取.加点).toFixed(2) + "%，战力 " + pwrOf(ctx, u) + "）",
      (取.用 < k ? "⚙️ 今日【幸运星】额度只剩这么多：本次只用 " + 取.用 + " 颗（本道具每日上限 " + 道具额度(name, "暴伤") + "），其余保留" : "")
    ].filter(Boolean).join("\n"), { 标题: "⭐ 幸运星" });
    return;
  }
  if (name === "鱼饵") {
    await reply(ctx, t, "你持有鱼饵 " + have + " 个，直接发 `钓鱼` 会自动消耗。", {
      标题: "🐟 鱼饵", 按钮: [actBtn("g1", "⚡钓1次", "fish|1"), btn("g2", "买鱼饵", "购买#鱼饵#10")]
    });
    return;
  }
  if (name === "改名卡") {
    await reply(ctx, t, "发 `改名+新昵称` 使用改名卡（持有 " + have + " 张）。", { 标题: "✏️ 改名卡" });
    return;
  }
  if (name === "经验芯片") {
    takeItem(ctx, u, name, k);
    const add = 300 * k;
    addXp(ctx, u, add);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, "注入 " + k + " 枚经验芯片，经验 +" + add + "。", {
      标题: "💾 经验芯片", 按钮: [actBtn("xp1", "⚡看属性", "info"), btn("xp2", "商店", "商店")]
    });
    return;
  }
  if (name === "火力核心") {
    const 取 = 按额度取用(ctx, u, "攻击", 30, k, name);
    if (取.满) { await 属性上限提示(ctx, t, name, "攻击", 30, k); return; }
    takeItem(ctx, u, name, 取.用);
    dset(ctx, P.攻击, u, p.攻击 + 取.加点);
    记上限(ctx, u, "攻击", 取.加点, name);
    recPwr(ctx, u);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, [
      "熔入 " + 取.用 + " 颗火力核心，攻击力 +" + 取.加点 + "（现 " + (p.攻击 + 取.加点) + "）",
      (取.用 < k ? "⚙️ 今日【火力核心】额度只剩这么多：本次只用 " + 取.用 + " 颗（本道具每日上限 " + 道具额度(name, "攻击") + "），其余保留" : "")
    ].filter(Boolean).join("\n"), {
      标题: "🔥 火力核心", 按钮: [actBtn("fc1", "⚡看属性", "info"), btn("fc2", "商店", "商店")]
    });
    return;
  }
  if (name === 自动卡名) {
    await reply(ctx, t, [
      "🃏 自动卡是**一键出招**的消耗品，不能直接使用。",
      "",
      一键出招说明(),
      "当前持有：" + hasItem(ctx, u, 自动卡名) + " 张"
    ].join("\n"), {
      标题: "🃏 自动卡", 行组: [row(btn("au20", "一键出招×10", "一键出招10"), btn("au21", "一键出招×50", "一键出招50"), btn("au22", "买自动卡×10", "购买#自动卡#10"))]
    });
    return;
  }
  if (name === "幸运护符") {
    // 2.5.45：该道具已彻底移除 —— 万一有玩家还记得这条指令，给一句明确回复（不再加任何属性）
    await reply(ctx, t, [
      "🚫 【幸运护符】已在 **2.5.45** 版本**彻底移除**。",
      "",
      "· 商店不再出售，副本 / BOSS 也不再掉落",
      "· 背包里原有的幸运护符已由系统自动清除（数量已备份到后台）",
      "· 想提闪避率：用 `星甲加点#装备名#闪避#点数`，或穿带「闪避率」词条的装备"
    ].join("\n"), { 标题: "🍀 道具已移除", 按钮: [btn("rm1", "星甲菜单", "星甲菜单")] });
    return;
  }
  if (name === "星辉宝箱") {
    takeItem(ctx, u, name, k);
    let coin = 0, core = 0;
    const 得物 = [];
    for (let i = 0; i < k; i++) {
      coin += rnd(400, 1600);
      core += rnd(0, 3);
      if (Math.random() < 0.3) {
        const w = ["幸运星", "护盾芯片", "强化组件", "陨石碎片"][rnd(0, 3)];
        giveItem(ctx, u, w, 1);
        得物.push(w);
      }
    }
    addCoin(ctx, u, coin);
    if (core) addCore(ctx, u, core);
    tInc(ctx, u, "使用道具");
    const 行 = ["开出 " + k + " 个星辉宝箱：", "", "星羽 +" + kfmt(coin) + " · 星核 +" + core];
    if (得物.length) 行.push("额外道具：" + 得物.join(" · "));
    await reply(ctx, t, 行.join("\n"), {
      标题: "🎁 星辉宝箱",
      行组: [row(btn("bx1", "再开1个", "使用星辉宝箱1"), btn("bx2", "商店", "商店"), btn("bx3", "菜单", "菜单"))]
    });
    return;
  }
  // 2.2.5：赤霄血露走统一药品分支（下面 是药品() 已处理），这里保留兼容分支
  if (name === "赤霄血露") {
    takeItem(ctx, u, name, k);
    const 血量 = dn(ctx, P.血量, u, 0);
    const 上限 = dn(ctx, P.血量上限, u, 500);
    const 新 = Math.min(上限, 血量 + 60 * k);
    dset(ctx, P.血量, u, 新);
    tInc(ctx, u, "使用道具");
    await reply(ctx, t, "喝下 " + k + " 瓶赤霄血露，恢复 " + (新 - 血量) + " 血量（" + 血量 + " → " + 新 + "/" + 上限 + "）", {
      标题: "🧪 赤霄血露", 行组: [row(actBtn("hp1", "⚡看属性", "info"), btn("hp2", "商店", "商店"), btn("hp3", "菜单", "菜单"))]
    });
    return;
  }
  if (name === "退级卡") {
    takeItem(ctx, u, name, 1);
    const lv = dn(ctx, P.等级, u, 1);
    const 新lv = Math.max(1, lv - 1);
    dset(ctx, P.等级, u, 新lv);
    dset(ctx, P.经验, u, 0);
    dset(ctx, P.退级冷却, u, Date.now() + 30 * 60000);
    recPwr(ctx, u);
    await reply(ctx, t, [
      "杂鱼退级卡已使用。",
      "",
      "等级：" + lv + " → **" + 新lv + "** · 经验清零",
      "**注意：下一次升级有 30 分钟冷却**（期间经验卡在临门一脚）",
      "冷却结束：" + fmt(Date.now() + 30 * 60000)
    ].join("\n"), {
      标题: "🪪 退级卡", 行组: [row(actBtn("dl1", "⚡看属性", "info"), actBtn("dl2", "⚡打坐", "meditate"), btn("dl3", "菜单", "菜单"))]
    });
    return;
  }
  if (name === "花") {
    await reply(ctx, t, "花是副本入场消耗品（也是送人的好东西），不需要使用。\n可以去 `副本` 看看哪些 BOSS 要花。", {
      标题: "🌸 花", 行组: [row(btn("fl1", "副本列表", "副本"), btn("fl2", "商店", "商店"), btn("fl3", "菜单", "菜单"))]
    });
    return;
  }
  // 2.2.8：菜品 —— 吃了给血量/永久属性/经验
  if (是菜品(name)) {
    await 吃菜(ctx, t, u, name, k);
    return;
  }
  await reply(ctx, t, "【" + name + "】是食材 / 收藏品，可以在交易行卖给其他玩家：\n`上架#" + name + "#1#100`", {
    标题: "无法直接使用", 按钮: [btn("im1", "交易行", "交易行"), btn("im2", "商店", "商店")]
  });
}



/* ============================================================
 * 十三·五、2.1.0 新增玩法
 *   ① 修甲需要等待（记录状态/记录时间，退出修甲结算）
 *   ② 新人副本（见 DG 的 13/14/15）
 *   ③ 副本组队（可带低级，不能上高级）
 *   ④ 一键挑战（**已移除**，2.5.25 起保留入口拦截提示，改用 挑战/组队挑战）
 *   ⑤ 副本掉落武器 / 护甲（装备后提升攻击/防御/暴击）
 *   ⑥ 星甲背包（搜索 · 一键整理 · 每页 5 个）
 * ============================================================ */
export function nowSec() { return Math.floor(Date.now() / 1000); }



/* ---------- ① 修甲：需要等待 ---------- */
export const 修甲速默认 = 100;

   // 每分钟恢复的血量
export function 修甲中(ctx, u) { return ds(ctx, P.修甲状态, u, "正常") === "正在修甲"; }


export function 修甲速度(ctx, u) { const v = dn(ctx, P.修复速度, u, 修甲速默认); return v > 0 ? v : 修甲速默认; }


export function 修甲信息(ctx, u) {
  const p = attrs(ctx, u);
  const 开始 = dn(ctx, P.修甲时间, u, nowSec());
  const 分钟 = Math.max(0, Math.floor((nowSec() - 开始) / 60));
  const 速 = 修甲速度(ctx, u);
  const 目标 = Math.max(0, p.血量上限 - p.血量);
  const 可恢复 = 分钟 * 速;
  return { p, 开始, 分钟, 速, 目标, 可恢复, 完成: 可恢复 >= 目标 };
}


export async function 开始修甲(ctx, t, u) {
  const p = attrs(ctx, u);
  if (修甲中(ctx, u)) {
    const i = 修甲信息(ctx, u);
    await reply(ctx, t, [
      "你已经在修复战甲中。",
      "已修复 " + i.分钟 + " 分钟 · 已恢复血量 " + Math.min(i.可恢复, i.目标) + " / " + i.目标,
      "",
      "发 `退出修甲` 结算血量（没修满也能先退，已修好的照样到账）。"
    ].join("\n"), {
      标题: "🛠️ 正在修甲",
      行组: [row(btn("qk1", "退出修甲", "退出修甲"), btn("qk2", "属性", "属性"), btn("qk3", "菜单", "菜单"))]
    });
    return;
  }
  if (p.血量 >= p.血量上限) {
    await reply(ctx, t, "血量已满（" + p.血量 + "/" + p.血量上限 + "），不需要修复。", {
      标题: "🛠️ 修复战甲", 按钮: [btn("qk4", "副本", "副本"), btn("qk5", "菜单", "菜单")]
    });
    return;
  }
  const 速 = 修甲速度(ctx, u);
  const 需 = p.血量上限 - p.血量;
  const 分钟 = Math.ceil(需 / 速);
  dset(ctx, P.修甲状态, u, "正在修甲");
  dset(ctx, P.修甲时间, u, nowSec());
  await reply(ctx, t, [
    "已开始修甲，**期间不能探索 / 挖矿 / 钓鱼 / 打工 / 挑战副本 / 对战**。",
    "",
    "血量 " + p.血量 + " → " + p.血量上限 + "（缺 " + 需 + "）",
    "修复速度：" + 速 + " 血量 / 分钟",
    "预计完成：" + fmt(Date.now() + 分钟 * 60000) + "（约 " + 分钟 + " 分钟）",
    "",
    "修好后发 `退出修甲` 结算（提前退出也可以，已修好的血量照样到账）。"
  ].join("\n"), {
    标题: "🛠️ 修复战甲",
    行组: [row(btn("qk6", "退出修甲", "退出修甲"), actBtn("qk7", "⚡看属性", "info"), btn("qk8", "菜单", "菜单"))]
  });
}


export async function 结算修甲(ctx, t, u) {
  if (!修甲中(ctx, u)) {
    await reply(ctx, t, "你现在没有在修复战甲。\n发 `修复战甲` 开始修甲（需要等待，速度见属性）。", {
      标题: "🛠️ 退出修甲", 按钮: [btn("qk9", "修复战甲", "修复战甲"), btn("qk10", "属性", "属性")]
    });
    return;
  }
  const i = 修甲信息(ctx, u);
  const 恢复 = Math.min(i.目标, i.可恢复);
  const 新血量 = Math.min(i.p.血量上限, i.p.血量 + 恢复);
  dset(ctx, P.血量, u, 新血量);
  dset(ctx, P.修甲状态, u, "正常");
  dset(ctx, P.修甲时间, u, nowSec());
  if (恢复 > 0) tInc(ctx, u, "修复战甲");
  recPwr(ctx, u);
  const 行 = [
    "修甲结束。",
    "",
    "修复时长：" + i.分钟 + " 分钟 · 速度 " + i.速 + " / 分钟",
    "血量 " + i.p.血量 + " → " + 新血量 + " / " + i.p.血量上限 + (新血量 >= i.p.血量上限 ? "（已满）" : "")
  ];
  if (恢复 <= 0) 行.push("", "提示：不满 1 分钟没有恢复量，多等一会儿再来退。");
  else if (新血量 < i.p.血量上限) 行.push("", "还差 " + (i.p.血量上限 - 新血量) + " 血量，可再次 `修复战甲`。");
  await reply(ctx, t, 行.join("\n"), {
    标题: "🛠️ 修甲完成",
    行组: [row(actBtn("qk11", "⚡看属性", "info"), btn("qk12", "副本", "副本"), btn("qk13", "菜单", "菜单"))]
  });
}


// 修甲中拦截行动类指令；被拦截返回 true
export async function 修甲拦截(ctx, t, u) {
  if (!修甲中(ctx, u)) return false;
  const i = 修甲信息(ctx, u);
  await reply(ctx, t, [
    "你正在修复战甲，暂时不能行动。",
    "已修复 " + i.分钟 + " 分钟 · 可恢复血量 " + Math.min(i.可恢复, i.目标) + " / " + i.目标,
    "",
    "发 `退出修甲` 结算血量后即可继续战斗。"
  ].join("\n"), {
    标题: "🛠️ 正在修甲",
    行组: [row(btn("qk14", "退出修甲", "退出修甲"), actBtn("qk15", "⚡看属性", "info"))]
  });
  return true;
}



/* ---------- ⑤ 武器 / 护甲 ---------- */
export const 装备表 = [
  { 名: "合金短刃", 类: "武器", 段: 1, 攻击: 180, 暴击率: 2, 暴伤: 8, 血量: 40 },
  { 名: "脉冲长枪", 类: "武器", 段: 3, 攻击: 460, 暴击率: 3.5, 暴伤: 15, 血量: 90 },
  { 名: "裂空战镰", 类: "武器", 段: 6, 攻击: 980, 暴击率: 5, 暴伤: 24, 血量: 160 },
  { 名: "星辉重炮", 类: "武器", 段: 10, 攻击: 1950, 暴击率: 7, 暴伤: 36, 血量: 260 },
  { 名: "湮灭圣剑", 类: "武器", 段: 15, 攻击: 3800, 暴击率: 10, 暴伤: 58, 血量: 430 },
  { 名: "虚空裁决", 类: "武器", 段: 30, 攻击: 8600, 暴击率: 14, 暴伤: 92, 血量: 720 },
  { 名: "初级护甲", 类: "护甲", 段: 1, 防御: 160, 血量: 320, 暴击率: 0.5 },
  { 名: "复合装甲", 类: "护甲", 段: 3, 防御: 420, 血量: 760, 暴击率: 1 },
  { 名: "龙鳞胸甲", 类: "护甲", 段: 6, 防御: 950, 血量: 1500, 暴击率: 1.5, 暴伤: 6 },
  { 名: "星舰战甲", 类: "护甲", 段: 10, 防御: 1900, 血量: 2700, 暴击率: 2, 暴伤: 10 },
  { 名: "天穹圣铠", 类: "护甲", 段: 15, 防御: 3800, 血量: 5000, 暴击率: 3, 暴伤: 18 },
  { 名: "神域壁垒", 类: "护甲", 段: 30, 防御: 8400, 血量: 11000, 暴击率: 4.5, 暴伤: 30 }
];


export function 装备定义(name) { const k = S(name); return 全部装备.filter((x) => x.名 === k)[0] || null; }


export function 装备描述(e, 升级等级) {
  if (!e) return "";
  const 加 = 装备加成(e, 升级等级);
  const 段 = [];
  if (加.攻击) 段.push("攻击力+" + fmtNum(加.攻击));
  if (加.防御) 段.push("防御力+" + fmtNum(加.防御));
  if (加.血量) 段.push("血量+" + fmtNum(加.血量));
  if (加.闪避) 段.push("闪避率+" + fmtNum(加.闪避) + "%");
  if (加.暴击率) 段.push("暴击率+" + fmtNum(加.暴击率) + "%");
  if (加.暴伤) 段.push("暴击伤害+" + fmtNum(加.暴伤) + "%");
  // 2.8.0（需求 1）：百分比词条也写进装备描述
  const 词 = (加 && 加.词条) || {};
  for (const k of 百分比词条键) if (词[k]) 段.push(k + "+" + fmtNum(词[k]) + "%");
  const L = Math.max(0, Math.floor(Number(升级等级) || 0));
  return (L > 0 ? "Lv." + 等级显示(L) + "（属性 +" + (L * 2) + "%）· " : "") + 段.join("，");
}
