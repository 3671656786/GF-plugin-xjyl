// lib/game/progress.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S, dget, dn, ds, dset, kfmt, rnd, ymd, 星甲前缀 } from "./../core/base.mjs?v=v1795174016938";
import { actBtn, btn, reply, row, 蓝字 } from "./../core/qq.mjs?v=v1795174016938";
import { P } from "./../core/util.mjs?v=v1795174016938";
import { 天下楼层数 } from "././combat.mjs?v=v1795174016938";
import { 加信用分 } from "././credit.mjs?v=v1795174016938";
import { 股事件 } from "././econ.mjs?v=v1795174016938";
import { addCoin, addCore, attrs, giveItem, pwrOf, recPwr, 加经验 } from "././player.mjs?v=v1795174016938";


/* ============================================================
 * 五、副本系统
 * ------------------------------------------------------------
 * ⚠️ 2.9.3：**DG 不在这里写条目**。运行时在 `DG.length = 0` 处清空，再由 `星甲副本`
 *    （段 5~2000 的 1~25 号 + 101~103 新人副本）重建，最后 push 上 BOSS 表 / 金币兽表。
 *    这里曾有一份 2.1.0 之前的 15 条旧表（废弃矿道 / 虚空回廊 / 终焉之门 / 新手训练场…），
 *    运行时从未生效，却把文档作者带偏（「副本 13 = 新手训练场」就是这么来的，实际 13 是重炮段 310，
 *    新手本是 101）。2.9.3 已删除该死表，真实数据一律看 `星甲副本`。
 * ============================================================ */
export const DG = [];



export const DG_CD = 20000;


// 2.5.0：副本 / BOSS 共用冷却（副本 10 分钟、BOSS 20 分钟）+ 操作冷却 2 秒
// 3.0.0（需求 4.10）：副本 / BOSS 冷却统一 20 分钟
export const 副本冷却毫秒 = 1200000, BOSS冷却毫秒 = 1200000, 操作冷却毫秒 = 3000;

   // 2.7.0（需求 8）：操作/攻击 CD 2s → 3s，自动出招同源
export function 取挑战冷却(ctx, u) { const v = dget(ctx, P.挑战冷却, u, null); return v && typeof v === "object" ? v : null; }


export function 剩挑战冷却(ctx, u) { const v = 取挑战冷却(ctx, u); return v ? Math.max(0, (Number(v.到) || 0) - Date.now()) : 0; }


export function 设挑战冷却(ctx, u, 是BOSS) {
  dset(ctx, P.挑战冷却, u, { 到: Date.now() + (是BOSS ? BOSS冷却毫秒 : 副本冷却毫秒), 类型: 是BOSS ? "BOSS" : "副本" });
}


export function 剩操作冷却(ctx, u) { return Math.max(0, dn(ctx, P.操作冷却, u, 0) - Date.now()); }


export function 设操作冷却(ctx, u) { dset(ctx, P.操作冷却, u, Date.now() + 操作冷却毫秒); }


export function dgFind(id) { const s = S(id); return DG.filter((x) => String(x.id) === s)[0] || null; }


export function dgDone(ctx, u, id) { return ds(ctx, P.副本首通, u + "_" + id, "") === "已"; }


export function dgMark(ctx, u, id) { dset(ctx, P.副本首通, u + "_" + id, "已"); }


export function dgLeft(ctx, u, id) { return Math.max(0, dn(ctx, P.副本进度, u + "_" + id, 0) + DG_CD - Date.now()); }



export async function dgList(ctx, t, u) {
  const p = attrs(ctx, u);
  const lines = ["等级 " + p.等级 + " · 战力 " + pwrOf(ctx, u), "", "**副本列表**"];
  const 列表 = DG.slice().sort((a, b) => a.段 - b.段);
  for (const d of 列表) {
    const done = dgDone(ctx, u, d.id) ? "✅已通" : "🔒未通";
    let extra = "";
    if (d.转 && p.转生 < d.转) extra = "（需转生" + d.转 + "）";
    else if (p.等级 < d.段) extra = "（等级不足）";
    lines.push("【" + d.id + "】" + d.名 + " · " + d.段 + "级段 · 推荐" + d.力 + " · " + done + extra);
  }
  lines.push(
    "",
    "发 `挑战编号` 进入（例：`挑战3`）。副本经验极高，是主要升级途径。",
    "副本还会掉落 **武器 / 护甲**，进 `背包` 装备后提升攻击、防御、暴击。",
    "",
    "**组队**：`组队#13` 开队 → 队友 `加入队伍#队号` → 队长 `队伍挑战`（最多 4 人，可带低级，不能上高级）。",
    "**爬塔**：`天下楼` —— " + 天下楼层数 + " 层，一层一个强敌，1000 回合内必须击败（无入场费、无冷却，与副本·BOSS 同一套伤害公式）。",
    "**自动出招**：`一键出招10`（1 张自动卡 / 招，商店 100 星羽 / 张，**服务器每 2 秒代你出 1 招**，需等待；进度发 `星甲自动详情` 看；被打到 0 血时**有药就自动回血续战**，没药则自动放弃并返还 50% 入场费）；自动卡不够会自动停。无CD「快速出招」已移除。",
    "**天下楼**：`星甲天下楼` —— " + 天下楼层数 + " 层爬塔，一层一个强敌，1~30 层简单档、越往后越难越富，**无回合限制**，与副本·BOSS 同一套伤害公式；无入场费、无冷却。"
  );
  await reply(ctx, t, lines.join("\n"), {
    标题: "🏰 副本",
    行组: [
      row(actBtn("g13", "⚡新人本13", "dg|13"), actBtn("g14", "⚡新人本14", "dg|14"), actBtn("g15", "⚡新人本15", "dg|15")),
      row(actBtn("g1", "⚡打1", "dg|1"), actBtn("g2", "⚡打2", "dg|2"), actBtn("g3", "⚡打3", "dg|3"), actBtn("g4", "⚡打4", "dg|4")),
      row(actBtn("g5", "⚡打5", "dg|5"), actBtn("g6", "⚡打6", "dg|6"), actBtn("g7", "⚡打7", "dg|7"), actBtn("g8", "⚡打8", "dg|8")),
      row(actBtn("g9", "⚡打9", "dg|9"), actBtn("g10", "⚡打10", "dg|10"), actBtn("g11", "⚡打11", "dg|11"), actBtn("g12", "⚡打12", "dg|12")),
      row(btn("gi", "背包", "背包"), btn("gt", "组队", "队伍"), btn("ga", "一键出招", "一键出招10"), btn("gm", "强化", "强化"), btn("gh", "菜单", "菜单"))
    ]
  });
}


/* ---------- 2.5.13：旧版「快速挑战」（dgFight）已按要求**整段删除** ----------
 * 它原先不进入战斗、直接按战力算胜率判胜负，是「点按钮不用打就通关」Bug 的来源（2.5.12 已改道）。
 * 现在所有 `dg|<id>` 按钮统一走真正的多回合战斗 `开战()`。
 */

/* ============================================================
 * 六、每日任务 / 签到 / 新手指引
 * ============================================================ */
export const DQ = [
  { k: "签到", 名: "每日巡游", 需: 1, 币: 120, 经: 60 },
  { k: "副本", 名: "通关副本 2 次", 需: 2, 币: 260, 经: 180 },
  { k: "探索", 名: "探索 3 次", 需: 3, 币: 180, 经: 120 },
  { k: "挖矿", 名: "深空挖矿 2 次", 需: 2, 币: 160, 经: 100 },
  { k: "打工", 名: "星港打工 1 次", 需: 1, 币: 140, 经: 90 },
  { k: "钓鱼", 名: "深海钓鱼 3 次", 需: 3, 币: 200, 经: 130 },
  { k: "赌场", 名: "赌场开局 1 次", 需: 1, 币: 180, 经: 110 },
  { k: "转盘", 名: "转动天选转盘 1 次", 需: 1, 币: 160, 经: 100 },
  { k: "强化", 名: "战甲强化 1 次", 需: 1, 币: 300, 经: 200 },
  { k: "使用道具", 名: "使用道具 1 次", 需: 1, 币: 100, 经: 60 },
  { k: "存款", 名: "银行存入 1 次", 需: 1, 币: 120, 经: 70 },
  { k: "交易行", 名: "交易行成交 1 次", 需: 1, 币: 200, 经: 120 },
  { k: "捐献", 名: "联盟捐献 1 次", 需: 1, 币: 220, 经: 140 },
  { k: "修复战甲", 名: "修复战甲 1 次", 需: 1, 币: 150, 经: 90 },
  { k: "打装备", 名: "装备武器/护甲 1 次", 需: 1, 币: 180, 经: 120 },
  { k: "打坐", 名: "打坐 3 次", 需: 3, 币: 260, 经: 200 },
  { k: "做菜", 名: "做菜 1 道", 需: 1, 币: 300, 经: 260 }
];


export function tProg(ctx, u) { const v = dget(ctx, P.每日进度(ymd()), u, {}); return v && typeof v === "object" ? v : {}; }


export function tInc(ctx, u, k) {
  if (!u || !k) return;
  const o = tProg(ctx, u);
  o[k] = (Number(o[k]) || 0) + 1;
  dset(ctx, P.每日进度(ymd()), u, o);
}


export function tGot(ctx, u) { const v = dget(ctx, P.每日领奖(ymd()), u, {}); return v && typeof v === "object" ? v : {}; }


export function tSummary(ctx, u) {
  const pr = tProg(ctx, u);
  let done = 0;
  for (const q of DQ) if ((Number(pr[q.k]) || 0) >= q.需) done += 1;
  return done + "/" + DQ.length;
}


export async function tPanel(ctx, t, u) {
  const pr = tProg(ctx, u);
  const got = tGot(ctx, u);
  const lines = ["**今日进度**"];
  let can = 0, done = 0;
  for (const q of DQ) {
    const cur = Number(pr[q.k]) || 0;
    const ok = cur >= q.需;
    if (ok) done += 1;
    const taken = got[q.k] === "已";
    if (ok && !taken) can += 1;
    lines.push((ok ? "✅" : "⬜") + " " + q.名 + " " + Math.min(cur, q.需) + "/" + q.需 + (taken ? "（已领）" : ok ? "（可领）" : ""));
  }
  lines.push("", "已完成 " + done + "/" + DQ.length + " 项 · 可领 " + can + " 项");
  await reply(ctx, t, lines.join("\n"), {
    标题: "📋 每日任务",
    行组: [
      row(actBtn("q1", "⚡一键领奖", "questall"), btn("q2", "副本", "副本"), btn("q3", "签到", "签到")),
      row(actBtn("q4", "⚡挖矿", "mine"), actBtn("q5", "⚡打工", "work"), btn("q6", "钓鱼", "钓鱼"), btn("q7", "菜单", "菜单"))
    ]
  });
}


export async function tClaim(ctx, t, u) {
  const pr = tProg(ctx, u), got = tGot(ctx, u);
  let coin = 0, xp = 0;
  const names = [];
  for (const q of DQ) {
    if ((Number(pr[q.k]) || 0) < q.需) continue;
    if (got[q.k] === "已") continue;
    got[q.k] = "已"; coin += q.币; xp += q.经; names.push(q.名);
  }
  if (!names.length) { await reply(ctx, t, "暂时没有可领取的任务奖励。\n发 `每日任务` 查看进度。", { 标题: "📋 领奖" }); return; }
  dset(ctx, P.每日领奖(ymd()), u, got);
  addCoin(ctx, u, coin);
  const up = 加经验(ctx, u, xp);
  if (names.length >= 5) addCore(ctx, u, 2);
  recPwr(ctx, u);
  await reply(ctx, t, [
    "领取 " + names.length + " 项奖励",
    "星羽 +" + coin + " · 经验 +" + xp + (names.length >= 5 ? " · 星核 +2" : ""),
    up.升级 ? "升级 " + up.升级 + " 次 → Lv." + up.等级 : "",
    "",
    names.join(" · ")
  ].filter(Boolean).join("\n"), {
    标题: "🎁 领奖成功",
    行组: [row(actBtn("r1", "⚡看属性", "info"), btn("r2", "每日任务", "每日任务"), btn("r3", "副本", "副本"))]
  });
}


export async function doSign(ctx, t, u) {
  const today = ymd();
  if (ds(ctx, P.签到日期, u, "") === today) {
    await reply(ctx, t, "今天已经签到过了。\n连签：" + dn(ctx, P.连签, u, 1) + " 天", {
      标题: "📅 每日巡游", 按钮: [actBtn("c1", "⚡看属性", "info"), btn("c2", "每日任务", "每日任务")]
    });
    return;
  }
  const last = ds(ctx, P.签到日期, u, "");
  const yst = ymd(Date.now() - 86400000);
  const streak = last === yst ? dn(ctx, P.连签, u, 1) + 1 : 1;
  dset(ctx, P.签到日期, u, today);
  dset(ctx, P.连签, u, streak);
  const base = rnd(150, 260);
  const bonus = Math.min(300, (streak - 1) * 30);
  const coin = base + bonus;
  const xp = rnd(120, 240) + Math.min(300, (streak - 1) * 20);
  addCoin(ctx, u, coin);
  const up = 加经验(ctx, u, xp);
  tInc(ctx, u, "签到");
  // 2.9.6（需求 8）：每日签到 +1 信用分（签到成功才加，重复签到不会刷分）
  加信用分(ctx, u, 1, "每日签到");
  // 2.9.9（需求 E）：股市事件联动 —— 全服签到 → 天穹银行 +1%（节流 10 分钟）
  股事件(ctx, "07", 0.01, "全服签到热情高涨");
  let extra = "";
  if (streak % 7 === 0) { giveItem(ctx, u, "幸运星", 1); addCore(ctx, u, 1); extra = "\n7 天连签奖励：幸运星×1 · 星核×1"; }
  recPwr(ctx, u);
  await reply(ctx, t, [
    "连签 **" + streak + "** 天",
    "星羽 +" + coin + "（基础 " + base + " + 连签 " + bonus + "）",
    "经验 +" + xp + (up.升级 ? " · 升级 " + up.升级 + " 次 → Lv." + up.等级 : ""),
    extra
  ].filter(Boolean).join("\n"), {
    标题: "📅 巡游完成",
    行组: [
      row(actBtn("k1", "⚡看属性", "info"), btn("k2", "每日任务", "每日任务"), btn("k3", "副本", "副本")),
      row(actBtn("k4", "⚡挖矿", "mine"), actBtn("k5", "⚡打工", "work"), actBtn("k6", "⚡转盘", "wheel"))
    ]
  });
}


export const GUIDE = [
  { id: 1, 名: "登记战甲", 说明: "发送任意指令即自动开号", cmd: "星甲菜单", ck: () => true, 币: 200, 经: 0, 核: 0, 物: [["翠露散", 1]] },
  { id: 2, 名: "完成一次巡游", 说明: "发送 签到", cmd: "星甲签到", ck: (c, u) => (Number(tProg(c, u)["签到"]) || 0) >= 1, 币: 150, 经: 80, 核: 0, 物: [["鱼饵", 3]] },
  { id: 3, 名: "外出探索一次", 说明: "发送 探索", cmd: "星甲探索", ck: (c, u) => (Number(tProg(c, u)["探索"]) || 0) >= 1, 币: 200, 经: 120, 核: 0, 物: [] },
  { id: 4, 名: "通关第一个副本", 说明: "发送 挑战1", cmd: "星甲挑战1", ck: (c, u) => (Number(tProg(c, u)["副本"]) || 0) >= 1, 币: 400, 经: 300, 核: 1, 物: [["强化组件", 1]] },
  { id: 5, 名: "使用一次道具", 说明: "发送 使用翠露散1", cmd: "星甲使用翠露散1", ck: (c, u) => (Number(tProg(c, u)["使用道具"]) || 0) >= 1, 币: 200, 经: 100, 核: 0, 物: [["红色血清", 1]] },
  { id: 6, 名: "去赚一笔钱", 说明: "挖矿或打工", cmd: "星甲挖矿", ck: (c, u) => (Number(tProg(c, u)["挖矿"]) || 0) + (Number(tProg(c, u)["打工"]) || 0) >= 1, 币: 300, 经: 150, 核: 0, 物: [["幸运币", 2]] },
  { id: 7, 名: "加入一个联盟", 说明: "发送 加入联盟以爆制爆", cmd: "星甲联盟", ck: (c, u) => Boolean(ds(c, P.联盟, u, "")), 币: 300, 经: 0, 核: 2, 物: [] },
  { id: 8, 名: "完成 3 个每日任务", 说明: "发送 每日任务 查看", cmd: "星甲每日任务", ck: (c, u) => {
      const pr = tProg(c, u);
      let k = 0;
      for (const q of DQ) if ((Number(pr[q.k]) || 0) >= q.需) k += 1;
      return k >= 3;
    }, 币: 600, 经: 400, 核: 3, 物: [["幸运星", 1]] },
  { id: 9, 名: "打坐一次", 说明: "发送 打坐", cmd: "星甲打坐", ck: (c, u) => (Number(tProg(c, u)["打坐"]) || 0) >= 1, 币: 260, 经: 200, 核: 0, 物: [["鱼饵", 5]] },
  // 3.1.0：新手指引补上 3.0 新玩法（药园 / 职业 / 宠物 / 婚姻）
  { id: 10, 名: "开一块药园", 说明: "发送 药园 看说明，再 药园开垦", cmd: "星甲药园", ck: (c, u) => { try { const v = dget(c, "游戏数据/药园/药园.json", u, null); return !!(v && Number(v.开垦) >= 1); } catch (e) { return false; } }, 币: 500, 经: 400, 核: 1, 物: [["花", 20]] },
  { id: 11, 名: "转职成剑修", 说明: "发送 职业 看说明，再 转职剑修（Lv.20）", cmd: "星甲职业", ck: (c, u) => { try { const v = dget(c, "游戏数据/星舰数据/职业.json", u, null); return !!(v && (v.名 || v)); } catch (e) { return false; } }, 币: 800, 经: 600, 核: 2, 物: [["星石", 5]] },
  { id: 12, 名: "领养一只宠物", 说明: "发送 宠物 看说明，再 宠物领养 星尾狐", cmd: "星甲宠物", ck: (c, u) => { try { const v = dget(c, "游戏数据/宠物/宠物.json", u, null); return !!(v && v.宠 && Object.keys(v.宠).length); } catch (e) { return false; } }, 币: 600, 经: 300, 核: 1, 物: [["花", 10]] },
  { id: 13, 名: "送花刷好感", 说明: "发送 婚姻 看说明，再 送花<编号>#100", cmd: "星甲婚姻", ck: (c, u) => { try { const v = dget(c, "游戏数据/社交/婚姻.json", "档", null); const 好 = (v && v.好感) || {}; return Object.keys(好).some((k) => k.split("|").indexOf(u) >= 0 && Number(好[k]) > 0); } catch (e) { return false; } }, 币: 400, 经: 200, 核: 0, 物: [["花", 10]] }
];


export function guideGot(ctx, u) { const v = dget(ctx, P.指引已领, u, {}); return v && typeof v === "object" ? v : {}; }


// 2.7.0（需求 16）：从「发送 X」里抽出指令并补上星甲前缀，方便直接点
export function 步骤指令(说明) {
  const m = String(说明 || "").match(/发送\s*([^\s，。]+)/);
  return m ? 星甲前缀 + m[1] : "";
}


export async function guidePanel(ctx, t, u) {
  const got = guideGot(ctx, u);
  const p = attrs(ctx, u);
  const 完成 = GUIDE.filter((g) => got[g.id] === "已").length;
  const 可领 = GUIDE.filter((g) => got[g.id] !== "已" && g.ck(ctx, u)).length;
  const 行 = [
    "**欢迎来到星甲。** 这一页就是你的入门路线，从上往下照着做就行。",
    "",
    "**① 你现在在哪**",
    "编号 " + p.编号 + " · Lv." + p.等级 + " · 战力 " + kfmt(pwrOf(ctx, u)) + (p.称号 ? " · " + p.称号徽标 : ""),
    "新手进度 **" + 完成 + "/" + GUIDE.length + "** 步" + (可领 ? "　🎁 有 **" + 可领 + "** 步奖励可以领" : ""),
    "",
    "**② 唯一必须记住的规则**",
    "所有指令都要以「星甲」开头：`星甲签到` / `星甲副本` / `星甲背包`。**不带前缀机器人不会理你。**",
    "",
    "**③ 每天先做这三件事**",
    "1. " + 蓝字("星甲签到", "星甲签到") + " —— 星羽 + 连签奖励",
    "2. " + 蓝字("星甲每日任务", "星甲每日任务") + " → 做完再 " + 蓝字("星甲领奖", "星甲领奖"),
    "3. " + 蓝字("星甲副本", "星甲副本") + " —— 经验与装备来得最快",
    "",
    "**④ 成长路线（按顺序走）**",
    "· **1~10 级**：打等级够的副本，掉什么穿什么，别急着卖",
    "· **10~30 级**：探索 / 挖矿 / 钓鱼攒星羽，去商店买药再打 BOSS",
    "· **30~60 级**：BOSS 掉专属装备，升级拿的加点用 " + 蓝字("星甲加点", "星甲加点") + " 花掉",
    "· **60 级以上**：爬 " + 蓝字("星甲天下楼", "天下楼") + "、转生换永久加成、刷传说装备",
    "",
    "**⑤ 卡住了怎么办**",
    "· 打不过 → 先 " + 蓝字("星甲修复战甲", "修复战甲") + " 回血；战力不够就退回低一级的副本",
    "· 没星羽 → 挖矿 / 打工 / 钓鱼；钱存 " + 蓝字("星甲银行", "银行") + " 有动态利息",
    "· 不知道能发什么 → " + 蓝字("星甲菜单", "星甲菜单") + "（点一下就填好指令）或 " + 蓝字("星甲指南", "使用指南"),
    "",
    "**⑥ 新手任务（完成就能领，一次比一次多）**"
  ];
  for (const g of GUIDE) {
    const ok = g.ck(ctx, u);
    const taken = got[g.id] === "已";
    const cmd = S(g.cmd) || 步骤指令(g.说明);
    行.push((taken ? "🎁 " : ok ? "✅ " : "⬜ ") + "第" + g.id + "步 " + g.名 + " —— " + String(g.说明).replace(/^发送\s*/, "") + (cmd ? "　" + 蓝字(cmd, cmd) : "") + (taken ? "（已领）" : ok ? "（可领）" : ""));
  }
  行.push("", canText(可领));
  await reply(ctx, t, 行.join("\n"), {
    标题: "🧭 新手指引",
    行组: [
      row(actBtn("u1", "⚡领取指引奖励", "gclaim"), btn("u2", "签到", "签到"), btn("u3", "副本", "副本"), btn("u7", "使用指南", "指南")),
      row(actBtn("u4", "⚡看属性", "info"), btn("u5", "每日任务", "每日任务"), btn("u9", "天下楼", "天下楼"), btn("u6", "星甲菜单", "星甲菜单"))
    ]
  });
}


export function canText(可领) {
  return 可领 ? "👉 现在有 **" + 可领 + "** 步奖励可领，点下面的「⚡领取指引奖励」一次领走。" : "👉 继续按上面的路线推进，达成后回来点「⚡领取指引奖励」。";
}


export async function guideClaim(ctx, t, u) {
  const got = guideGot(ctx, u);
  const names = [];
  let coin = 0, xp = 0, core = 0;
  const items = [];
  for (const g of GUIDE) {
    if (got[g.id] === "已") continue;
    if (!g.ck(ctx, u)) break;
    got[g.id] = "已"; coin += g.币; xp += g.经; core += g.核;
    names.push("第" + g.id + "步 " + g.名);
    for (const it of (g.物 || [])) { giveItem(ctx, u, it[0], it[1]); items.push(it[0] + "×" + it[1]); }
  }
  if (!names.length) { await reply(ctx, t, "还没有可领取的指引奖励。\n发 `新手指引` 查看进度。", { 标题: "🧭 新手指引" }); return; }
  dset(ctx, P.指引已领, u, got);
  addCoin(ctx, u, coin);
  if (core) addCore(ctx, u, core);
  const up = 加经验(ctx, u, xp);
  recPwr(ctx, u);
  await reply(ctx, t, [
    "完成 " + names.length + " 步指引",
    "星羽 +" + coin + (xp ? " · 经验 +" + xp : "") + (core ? " · 星核 +" + core : ""),
    items.length ? "道具：" + items.join(" · ") : "",
    up.升级 ? "升级 " + up.升级 + " 次 → Lv." + up.等级 : "",
    "",
    names.join(" · ")
  ].filter(Boolean).join("\n"), {
    标题: "🎉 指引奖励",
    行组: [row(actBtn("h1", "⚡看属性", "info"), btn("h2", "每日任务", "每日任务"), btn("h3", "副本", "副本"))]
  });
}



/* ============================================================
 * 七、联盟 / 排行榜 / 赠送
 * ============================================================ */
export const ALLI = [
  { 名: "以爆制爆", 向: "攻击", 说: "入盟 +100 攻击力 · +100 血量 · +20 暴击" },
  { 名: "蚀月獠牙", 向: "暴击", 说: "入盟 +50 攻击力 · +50 血量" },
  { 名: "暗域商锋", 向: "闪避", 说: "入盟 +200 血量 · +20 闪避" },
  { 名: "休闲至上", 向: "综合", 说: "休闲联盟，暂无战斗加成" }
];


export const ALB = {
  以爆制爆: { 攻击: 100, 血量: 100, 暴击: 20 },
  蚀月獠牙: { 攻击: 50, 血量: 50 },
  暗域商锋: { 血量: 200, 闪避: 20 },
  休闲至上: {}
};


export const AL_MAX = 10;


// ---- 旧版兼容：联盟关系在 联盟数据/玩家加入的.json，联盟数据在 联盟数据/<名>/记录.json（繁荣度） ----
export const 联盟加入文件 = "游戏数据/星舰数据/联盟数据/玩家加入的.json";
