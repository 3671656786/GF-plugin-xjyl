// lib/game/casual.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { 读控制台配置 } from "./../admin/admin.mjs?v=v1795793040169";
import { S, dget, dn, ds, dset, kfmt, pushLog, rnd, roll, wait, ymd } from "./../core/base.mjs?v=v1795793040169";
import { actBtn, btn, reply, row, 蓝字 } from "./../core/qq.mjs?v=v1795793040169";
import { P } from "./../core/util.mjs?v=v1795793040169";
import { 加世界资金, 扣世界资金 } from "././credit.mjs?v=v1795793040169";
import { 设血量 } from "././dungeon.mjs?v=v1795793040169";
import { 股事件 } from "././econ.mjs?v=v1795793040169";
import { 日常经验 } from "././farm.mjs?v=v1795793040169";
import { addCoin, addCore, addXp, attrs, gid, giveItem, hasItem, recPwr, takeItem, 加经验 } from "././player.mjs?v=v1795793040169";
import { tInc, tProg } from "././progress.mjs?v=v1795793040169";
import { 修甲拦截 } from "././rebirth.mjs?v=v1795793040169";


/* ============================================================
 * 九、娱乐：探索/挖矿/打工/钓鱼/赌场/转盘/抽卡/骰子/运势
 * ============================================================ */
export const EXP_DUR_MIN = 5, EXP_XP_TIMES = 200, EXP_MAX = 1000;

   // 2.9.10：探索单条指令最高 1000 次
/* 2.9.4（需求 5）：探索 / 钓鱼
 *   · 冷却 = 当日已用次数（秒）：今日第 N 次之后要等 N 秒（N 为该轮结束后的当日累计次数）
 * 2.9.8（需求 6）：每日上限拆开 —— 探索 **3000** 次、钓鱼 **1000** 次（各自独立计数）；
 *   冷却提示统一写「当前冷却 = 今日第 N 次」，单条指令上限仍 100 次。
 * 2.9.10：单条指令上限 100 → 1000（每日上限不变）。
 */
export const 探索每日上限 = 3000;


export const 钓鱼每日上限 = 1000;


export function 娱乐已用(ctx, u, 键) { return Math.max(0, Number(tProg(ctx, u)[键]) || 0); }


// 3.2.2：探索 / 钓鱼冷却统一为固定 30 秒（不论次数，原来 = 今日已用次数秒）
export const 娱乐冷却秒 = 30;

export function 娱乐冷却余(ctx, u, 键) {
  const 到 = Number(dn(ctx, P.娱乐冷却, u + "_" + 键, 0)) || 0;
  return Math.max(0, 到 - Date.now());
}


export function 设娱乐冷却(ctx, u, 键, 秒) { dset(ctx, P.娱乐冷却, u + "_" + 键, Date.now() + Math.max(0, Math.floor(Number(秒) || 0)) * 1000); }


export function expOne() {
  const r = Math.random();
  if (r < 0.46) return { 名: "太空废铁", 数: rnd(1, 3), 事: "" };
  if (r < 0.68) return { 名: "翠露散", 数: rnd(1, 2), 事: "" };
  if (r < 0.80) return { 名: "红色血清", 数: 1, 事: "发现一处医疗舱" };
  if (r < 0.90) return { 名: "陨石碎片", 数: rnd(1, 2), 事: "撞见陨石堆" };
  if (r < 0.97) return { 名: "幸运星", 数: 1, 事: "拾到一颗幸运星" };
  return { 名: "强化组件", 数: 1, 事: "捡到废弃强化组件" };
}


export async function explore(ctx, t, u, times) {
  const 原始 = S(times);
  const 已用 = 娱乐已用(ctx, u, "探索");
  const k = Math.min(Math.max(1, Math.floor(Number(原始) || 5)), EXP_MAX);
  // 2.9.4（需求 5）：冷却 = 当日已用次数（秒）；2.9.8（需求 6）：每日上限 3000 次
  const 探余 = 娱乐冷却余(ctx, u, "探索");
  if (探余 > 0) {
    await reply(ctx, t, "探索冷却中：**固定冷却 " + 娱乐冷却秒 + " 秒（不论次数）**，还需 " + Math.ceil(探余 / 1000) + " 秒。", { 标题: "⏳ 冷却" });
    return;
  }
  if (已用 >= 探索每日上限) {
    await reply(ctx, t, "今日探索已达上限 **" + 探索每日上限 + "** 次，明天再来。", { 标题: "⏳ 次数用尽", 按钮: [btn("ex_limit", "钓鱼", "钓鱼"), btn("ex_limit2", "副本", "副本")] });
    return;
  }
  if (await 修甲拦截(ctx, t, u)) return;
  const p = attrs(ctx, u);
  let dur = p.血量;
  if (dur < EXP_DUR_MIN) {
    await reply(ctx, t, "血量不足，无法探索。\n去 `修复战甲` 或用翠露散。", {
      标题: "探索失败", 按钮: [btn("ex_a", "修复战甲", "修复战甲"), btn("ex_b", "用绿血清", "使用翠露散1")]
    });
    return;
  }
  let real = 0, xp = 0, coin = 0, used = 0;
  const bag = {}, events = [];
  let nth = 已用;   // 2.9.10：本地计数替代逐次 tProg 读盘（1000 次循环性能）
  for (let i = 0; i < k; i++) {
    if (dur < EXP_DUR_MIN) break;
    const cost = rnd(6, 14);
    dur -= cost; used += cost;
    const got = expOne();
    bag[got.名] = (bag[got.名] || 0) + got.数;
    if (got.事) events.push("第" + (real + 1) + "次：" + got.事);
    coin += rnd(20, 60);
    real += 1;
    nth += 1;
    // 2.1.1：取消「每天 30 次后 0 经验」的限制 —— 现在探索永远给经验（超过 200 次后小幅衰减）
    xp += 日常经验(nth <= EXP_XP_TIMES ? rnd(20, 40) : rnd(10, 20), p.等级, "探索");
  }
  // 2.9.10：批量入包 + 每日进度一次写入（原逐次 giveItem/tInc 在 1000 次时读写盘 ~8k 次，太慢）
  for (const nm of Object.keys(bag)) giveItem(ctx, u, nm, bag[nm]);
  if (real > 0) {
    const o = tProg(ctx, u);
    o["探索"] = (Number(o["探索"]) || 0) + real;
    dset(ctx, P.每日进度(ymd()), u, o);
  }
  const 剩血 = 设血量(ctx, u, dur);
  addCoin(ctx, u, coin);
  const up = 加经验(ctx, u, xp);
  recPwr(ctx, u);
  const 今日总 = 娱乐已用(ctx, u, "探索");
  设娱乐冷却(ctx, u, "探索", 娱乐冷却秒);
  const bagText = Object.keys(bag).map((x) => x + "×" + bag[x]).join(" · ");
  await reply(ctx, t, [
    "探索 " + real + "/" + k + " 次（血量不足会自动停）",
    "血量 -" + used + "（剩 " + 剩血 + "）",
    "经验 +" + xp + " · 星羽 +" + coin + (up.升级 ? " · 升级 → Lv." + up.等级 : ""),
    "",
    "⏱ **冷却 " + 娱乐冷却秒 + " 秒（固定·不论次数）**　今日 " + 今日总 + "/" + 探索每日上限 + " 次",
    "",
    "★ **自定义次数（点蓝色文字直接执行）**",
    蓝字("星甲探索1", "探索1次") + "　" + 蓝字("星甲探索10", "10次") + "　" + 蓝字("星甲探索30", "30次") + "　" + 蓝字("星甲探索50", "50次") + "　" + 蓝字("星甲探索100", "100次"),
    "　其他次数直接发 `星甲探索<次数>` 即可（单次指令最高 " + EXP_MAX + " 次 · 每日上限 " + 探索每日上限 + " 次）",
    "",
    "收获：" + (bagText || "无")
  ].concat(events.length ? ["", "**见闻**"].concat(events.slice(0, 4)) : []).join("\n"), {
    标题: "🧭 探索",
    行组: [
      row(actBtn("ep1", "⚡再探5次", "explore|5"), actBtn("ep2", "⚡再探10次", "explore|10"), actBtn("ep3", "⚡再探30次", "explore|30")),
      row(btn("ep7", "探索1次", "explore|1"), btn("ep8", "探索50次", "explore|50"), btn("ep9", "探索100次", "explore|100")),
      row(btn("ep4", "修复战甲", "修复战甲"), btn("ep5", "副本", "副本"), btn("ep6", "菜单", "菜单"))
    ]
  });
}


export async function mine(ctx, t, u) {
  if (await 修甲拦截(ctx, t, u)) return;
  const p = attrs(ctx, u);
  if (p.血量 < 20) {
    await reply(ctx, t, "血量不足 20，挖不动了。", {
      标题: "挖矿失败", 按钮: [btn("mn1", "修复战甲", "修复战甲"), btn("mn2", "用绿血清", "使用翠露散1")]
    });
    return;
  }
  const cost = Math.min(rnd(18, 34), p.血量);
  const coin = rnd(60, 140);
  const ore = roll([
    { 名: "太空废铁", w: 44, lo: 1, hi: 4 },
    { 名: "陨石碎片", w: 30, lo: 1, hi: 2 },
    { 名: "星核", w: 12, lo: 1, hi: 1 },
    { 名: "幸运星", w: 14, lo: 1, hi: 1 }
  ]);
  const cnt = rnd(ore.lo, ore.hi);
  const 剩血 = 设血量(ctx, u, p.血量 - cost);
  addCoin(ctx, u, coin);
  if (ore.名 === "星核") addCore(ctx, u, cnt); else giveItem(ctx, u, ore.名, cnt);
  // 2.9.9（需求 E）：股市事件联动 —— 挖矿热潮 → 暗域矿业 +1%（节流 10 分钟）
  股事件(ctx, "03", 0.01, "矿业开采热潮");
  const up = 加经验(ctx, u, 日常经验(rnd(40, 80), p.等级, "挖矿"));
  tInc(ctx, u, "挖矿");
  recPwr(ctx, u);
  await reply(ctx, t, [
    "血量 -" + cost + "（剩 " + 剩血 + "）",
    "星羽 +" + coin + " · " + ore.名 + "×" + cnt,
    up.升级 ? "升级 → Lv." + up.等级 : ""
  ].filter(Boolean).join("\n"), {
    标题: "⛏️ 深空挖矿",
    行组: [
      row(actBtn("mc1", "⚡再挖一次", "mine"), btn("mc2", "使用道具", "使用道具"), btn("mc3", "修复战甲", "修复战甲")),
      row(actBtn("mc4", "⚡看属性", "info"), btn("mc5", "商店", "商店"), btn("mc6", "菜单", "菜单"))
    ]
  });
}


export const WORK_CD = 600000;


export async function work(ctx, t, u) {
  if (await 修甲拦截(ctx, t, u)) return;
  const last = dn(ctx, P.打工冷却, u, 0);
  const left = Math.max(0, last + WORK_CD - Date.now());
  if (left > 0) {
    await reply(ctx, t, "刚下夜班，还得歇 " + wait(left) + "。", {
      标题: "💼 星港打工", 行组: [row(actBtn("wk1", "⚡挖矿", "mine"), btn("wk2", "钓鱼", "钓鱼"), btn("wk3", "赌场", "赌场"))]
    });
    return;
  }
  // 2.9.8（需求 4）：打工收益整体上调 —— 原基础 160~320 星羽与物价脱节（贷款初始 10 万、BOSS 伤害千万级）。
  //   现在：基础 900~1800 + 等级 × 80（随等级成长），加班仍双倍。参考：Lv1 约 1 千、Lv50 约 5 千+，10 分钟冷却不爆。
  const 打工基础低 = 900, 打工基础高 = 1800, 打工每级 = 80;
  const ot = Math.random() < 0.15;
  const base = rnd(打工基础低, 打工基础高) + (Number(attrs(ctx, u).等级) || 1) * 打工每级;
  const pay = ot ? base * 2 : base;
  dset(ctx, P.打工冷却, u, Date.now());
  addCoin(ctx, u, pay);
  // 2.5.52：打工经验随等级成长（需要等级 → 这里补取一次属性）
  const up = 加经验(ctx, u, 日常经验(rnd(60, 120), attrs(ctx, u).等级, "打工"));
  tInc(ctx, u, "打工");
  recPwr(ctx, u);
  await reply(ctx, t, [
    ot ? "碰上加班，双倍工资！" : "上完了班。",
    "星羽 +" + pay + (ot ? "（基础 " + base + " ×2）" : ""),
    up.升级 ? "升级 → Lv." + up.等级 : "",
    "",
    "工资 = 基础 900~1800 + 等级 × 80（加班双倍）· 冷却：10 分钟"
  ].filter(Boolean).join("\n"), {
    标题: "💼 星港打工",
    行组: [
      row(actBtn("wl1", "⚡挖矿", "mine"), btn("wl2", "钓鱼", "钓鱼"), btn("wl3", "银行", "银行系统")),
      row(btn("wl4", "一键出招", "一键出招10"), btn("wl5", "商店", "商店"), btn("wl6", "星甲菜单", "星甲菜单"))
    ]
  });
}


export const FISH_MAX = 1000;

   // 2.9.10：钓鱼可自定义次数（单条指令最高 1000）
export const FISH = [
  { 名: "小鱼", w: 42, lo: 20, hi: 45 },
  { 名: "大鱼", w: 28, lo: 50, hi: 110 },
  { 名: "稀有鱼", w: 17, lo: 130, hi: 260 },
  { 名: "传说鱼", w: 9, lo: 320, hi: 620 },
  { 名: "幸运星", w: 4, lo: 0, hi: 0 }
];


export async function fish(ctx, t, u, times) {
  const 原始 = S(times);
  const 已用 = 娱乐已用(ctx, u, "钓鱼");
  const k = Math.min(Math.max(1, Math.floor(Number(原始) || 1)), FISH_MAX);
  // 2.9.4（需求 5）：冷却 = 当日已用次数（秒）；每日上限 1000 次
  const 钓余 = 娱乐冷却余(ctx, u, "钓鱼");
  if (钓余 > 0) {
    await reply(ctx, t, "钓鱼冷却中：**固定冷却 " + 娱乐冷却秒 + " 秒（不论次数）**，还需 " + Math.ceil(钓余 / 1000) + " 秒。", { 标题: "⏳ 冷却" });
    return;
  }
  if (已用 >= 钓鱼每日上限) {
    await reply(ctx, t, "今日钓鱼已达上限 **" + 钓鱼每日上限 + "** 次，明天再来。", { 标题: "⏳ 次数用尽", 按钮: [btn("fs_limit", "探索", "探索"), btn("fs_limit2", "副本", "副本")] });
    return;
  }
  if (await 修甲拦截(ctx, t, u)) return;
  const bait = hasItem(ctx, u, "鱼饵");
  if (bait < 1) {
    await reply(ctx, t, "没有鱼饵了。\n商店可买：`购买#鱼饵#10`（60 星羽/个）", {
      标题: "🐟 深海钓鱼", 按钮: [btn("fs1", "买鱼饵×10", "购买#鱼饵#10"), btn("fs2", "商店", "商店")]
    });
    return;
  }
  const real = Math.min(k, bait);
  let coin = 0;
  const bag = {};
  for (let i = 0; i < real; i++) {
    const f = roll(FISH);
    bag[f.名] = (bag[f.名] || 0) + 1;
    if (f.hi > 0) coin += rnd(f.lo, f.hi);
  }
  // 2.9.10：批量入包 + 每日进度一次写入（1000 次循环性能，同探索）
  for (const nm of Object.keys(bag)) giveItem(ctx, u, nm, bag[nm]);
  if (real > 0) {
    const o = tProg(ctx, u);
    o["钓鱼"] = (Number(o["钓鱼"]) || 0) + real;
    dset(ctx, P.每日进度(ymd()), u, o);
  }
  takeItem(ctx, u, "鱼饵", real);
  addCoin(ctx, u, coin);
  const up = 加经验(ctx, u, 日常经验(real * rnd(15, 30), attrs(ctx, u).等级, "钓鱼"));
  recPwr(ctx, u);
  const 今日总 = 娱乐已用(ctx, u, "钓鱼");
  设娱乐冷却(ctx, u, "钓鱼", 娱乐冷却秒);
  const bagText = Object.keys(bag).map((x) => x + "×" + bag[x]).join(" · ");
  await reply(ctx, t, [
    "抛竿 " + real + " 次 · 消耗鱼饵 " + real + "（剩 " + (bait - real) + "）",
    "星羽 +" + coin,
    up.升级 ? "升级 → Lv." + up.等级 : "",
    "",
    "⏱ **冷却 " + 娱乐冷却秒 + " 秒（固定·不论次数）**　今日 " + 今日总 + "/" + 钓鱼每日上限 + " 次",
    "",
    "★ **自定义连钓次数（点蓝色文字直接执行）**",
    蓝字("星甲钓鱼1", "钓1次") + "　" + 蓝字("星甲钓鱼10", "10次") + "　" + 蓝字("星甲钓鱼30", "30次") + "　" + 蓝字("星甲钓鱼50", "50次") + "　" + 蓝字("星甲钓鱼100", "100次"),
    "　其他次数直接发 `星甲钓鱼<次数>` 即可（单次指令最高 " + FISH_MAX + " 次 · 每日上限 " + 钓鱼每日上限 + " 次）",
    "",
    "鱼获：" + bagText,
    "",
    "鱼可以拿去交易行卖：`上架#稀有鱼#1#200`"
  ].filter(Boolean).join("\n"), {
    标题: "🐟 深海钓鱼",
    行组: [
      row(actBtn("fh1", "⚡再钓1次", "fish|1"), actBtn("fh2", "⚡连钓5次", "fish|5"), btn("fh3", "买鱼饵×10", "购买#鱼饵#10")),
      row(btn("fh6", "钓鱼1次", "fish|1"), btn("fh7", "钓鱼10次", "fish|10"), btn("fh8", "钓鱼50次", "fish|50"), btn("fh9", "钓鱼100次", "fish|100")),
      row(btn("fh4", "交易行", "交易行"), btn("fh5", "菜单", "菜单"))
    ]
  });
}


// 2.9.0（需求 2）：赌场改为「猜奇偶」+ 每日随机赢/输上限（每人独立，0 点重抽）
//   · 规则：开点 0~100，0 算偶数；开出 50 / 51 时庄家通吃 → 偶胜率 50/101≈49.5%、奇胜率 49/101≈48.5%，略低于 50% 保庄家优势
//   · 赔率 1:1（押 v 赢 v，返还 = 押额 × 2）
//   · 每日「赢上限 / 输上限」各自在 10 万 ~ 100 万 随机（按 openid+日期确定性哈希，每人独立、每天 0 点自动重抽）
//   · 管理员可在控制台配置 赌场今日赢上限 / 赌场今日输上限 覆盖当天的随机值（次日自动恢复随机）
//   · 玩家侧任何文案都不展示这两个数值，只提示「今日已达上限」
export const BET_MIN = 10, BET_MAX = 100000, 赌场赔率 = 2;


export const 赌场日限下限 = 100000, 赌场日限区间 = 900000;

   // 10 万 ~ (10 万 + 90 万)
export function 赌场哈希(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}


export function 赌场日限(ctx, u) {
  const today = ymd();
  let c = {};
  try { c = 读控制台配置(ctx) || {}; } catch (e) { c = {}; }
  let 赢 = Math.floor(Number(c.赌场今日赢上限) || 0);
  let 输 = Math.floor(Number(c.赌场今日输上限) || 0);
  // 控制台覆盖值只在「设置的当天」生效，次日恢复每人独立随机
  const 设日 = S(c.赌场上限设置日);
  if (设日 !== today) { 赢 = 0; 输 = 0; }
  if (!(赢 > 0)) 赢 = 赌场日限下限 + (赌场哈希(S(u) + "|" + today + "|赢") % (赌场日限区间 + 1));
  if (!(输 > 0)) 输 = 赌场日限下限 + (赌场哈希(S(u) + "|" + today + "|输") % (赌场日限区间 + 1));
  return { 日期: today, 赢: Math.min(赢, 2000000000), 输: Math.min(输, 2000000000) };
}


export function 赌场每日记录(ctx, u) {
  const today = ymd();
  let v = dget(ctx, P.赌场每日, u, null);
  if (!v || typeof v !== "object" || v.日期 !== today) v = { 日期: today, 赢: 0, 输: 0 };
  v.赢 = Math.max(0, Math.floor(Number(v.赢) || 0));
  v.输 = Math.max(0, Math.floor(Number(v.输) || 0));
  return v;
}


export async function casinoPanel(ctx, t, u) {
  // 2.9.1（C1）：全服功能开关 —— 控制台可关（POST /server/feature {功能:'赌场', 开:false}）
  try {
    const 开 = 读控制台配置(ctx)["全服开关"];
    if (开 && typeof 开 === "object" && 开["赌场"] === false) {
      await reply(ctx, t, "🎲 赌场已暂时关闭（全服维护），请稍后再来。", { 标题: "赌场关闭中" });
      return;
    }
  } catch (e) { /* 配置读不到则不拦 */ }
  const p = attrs(ctx, u);
  await reply(ctx, t, [
    "钱包：" + kfmt(p.星羽) + " 星羽",
    "",
    "**猜奇偶玩法**",
    "开点 0~100：**0 算偶数**；开出 50 / 51 时庄家通吃。",
    "猜中按 **1:1** 赔付（押 500 赢 500），猜错全输。",
    "单注 " + kfmt(BET_MIN) + " ~ " + kfmt(BET_MAX) + "。",
    "每天有随机的 **赢钱 / 输钱上限**（每人不同，0 点重抽），到了就得今天收手。",
    "",
    "用法：`猜大小#偶#500`（`大` = 偶、`小` = 奇，旧口令兼容）"
  ].join("\n"), {
    标题: "🎲 星域赌场（猜奇偶）",
    行组: [
      row(actBtn("cs1", "⚡押偶10", "bet|偶|10"), actBtn("cs2", "⚡押奇10", "bet|奇|10"), actBtn("cs8", "⚡押偶100", "bet|偶|100"), actBtn("cs9", "⚡押奇100", "bet|奇|100")),
      row(actBtn("cs3", "⚡押偶10000", "bet|偶|10000"), actBtn("cs4", "⚡押奇10000", "bet|奇|10000"), actBtn("cs10", "⚡全押偶", "bet|偶|all"), actBtn("cs11", "⚡全押奇", "bet|奇|all")),
      row(btn("cs5", "银行", "银行系统"), btn("cs6", "挖矿", "挖矿"), btn("cs7", "星甲菜单", "星甲菜单"))
    ]
  });
}


export async function casinoBet(ctx, t, u, side, amt) {
  // 2.9.1（C1）：全服功能开关同样拦住直接下注
  try {
    const 开 = 读控制台配置(ctx)["全服开关"];
    if (开 && typeof 开 === "object" && 开["赌场"] === false) {
      await reply(ctx, t, "🎲 赌场已暂时关闭（全服维护），请稍后再来。", { 标题: "赌场关闭中" });
      return;
    }
  } catch (e) { /* ignore */ }
  const g0 = S(side);
  const g = g0 === "大" ? "偶" : g0 === "小" ? "奇" : g0;   // 旧口令兼容：大 = 偶、小 = 奇
  const p0 = attrs(ctx, u);
  // 2.5.1：支持「全押」
  const v = S(amt) === "all" ? Math.min(BET_MAX, p0.星羽) : Math.floor(Number(amt) || 0);
  if (g !== "偶" && g !== "奇") { await reply(ctx, t, "只能押「奇」或「偶」，例：`猜大小#偶#500`", { 标题: "下注失败" }); return; }
  if (v < BET_MIN || v > BET_MAX) { await reply(ctx, t, "单注要在 " + kfmt(BET_MIN) + " ~ " + kfmt(BET_MAX) + " 之间。", { 标题: "下注失败" }); return; }
  const p = attrs(ctx, u);
  if (p.星羽 < v) {
    await reply(ctx, t, "星羽不足：你有 " + kfmt(p.星羽) + "，押不了 " + kfmt(v) + "。", {
      标题: "下注失败", 按钮: [actBtn("cv1", "⚡押偶100", "bet|偶|100"), btn("cv2", "挖矿", "挖矿"), btn("cv3", "打工", "打工")]
    });
    return;
  }
  // 2.9.0（需求 2）：每日随机赢 / 输上限（玩家侧不展示数值）
  const 限 = 赌场日限(ctx, u);
  const 日 = 赌场每日记录(ctx, u);
  if (日.赢 >= 限.赢 || 日.输 >= 限.输) {
    await reply(ctx, t, "今日已达上限，明天再来碰碰运气。", {
      标题: "🎲 今日已达上限",
      行组: [row(btn("cw7", "赌场", "赌场"), btn("cw8", "星甲菜单", "星甲菜单"))]
    });
    return;
  }
  const 剩赢 = Math.max(0, 限.赢 - 日.赢), 剩输 = Math.max(0, 限.输 - 日.输);
  const pt = rnd(0, 100);
  const open = (pt === 50 || pt === 51) ? "庄" : (pt % 2 === 0 ? "偶" : "奇");   // 0 算偶数；50/51 庄家通吃
  let delta, txt;
  if (open === "庄") { delta = -v; txt = "开点 " + pt + " · 庄家通吃"; }
  else if (open === g) { delta = v * (赌场赔率 - 1); txt = "开点 " + pt + "（" + open + "数）· 猜中「" + g + "」，按 " + 赌场赔率 + " 倍返还！"; }
  else { delta = -v; txt = "开点 " + pt + "（" + open + "数）· 猜「" + g + "」没中"; }
  // 上限裁剪：赢不超过当日剩余赢额，输不超过当日剩余输额
  let 触限 = "";
  if (delta > 0 && delta > 剩赢) { delta = 剩赢; 触限 = "今日已达上限"; }
  if (delta < 0 && -delta > 剩输) { delta = -剩输; 触限 = "今日已达上限"; }
  日.赢 += Math.max(0, delta);
  日.输 += Math.max(0, -delta);
  dset(ctx, P.赌场每日, u, 日);
  // 2.9.9（需求 F）：赌场过世界资金账本 —— 玩家输的钱进世界资金；赔付从世界资金出（不足也照赔，庄家信用兜底）
  if (delta > 0) {
    if (!扣世界资金(ctx, delta, "赌场赔付 " + gid(ctx, u))) pushLog(ctx, "世界资金", "赌场赔付 " + gid(ctx, u) + " 时资金见底（已照赔 " + delta + "）");
  } else if (delta < 0) {
    加世界资金(ctx, -delta, "赌场收入（" + gid(ctx, u) + " 输 " + (-delta) + "）");
  }
  addCoin(ctx, u, delta);
  tInc(ctx, u, "赌场");
  addXp(ctx, u, rnd(10, 30));
  // 2.9.9（需求 E）：股市事件联动 —— 单次赢 ≥ 5 万算「大奖」→ 极光传媒 +4%（节流 10 分钟）
  if (delta >= 50000) 股事件(ctx, "05", 0.04, "赌场爆出大奖，传媒股大涨");
  recPwr(ctx, u);
  await reply(ctx, t, [
    "押 " + kfmt(v) + " · 押「" + g + "」",
    txt,
    "星羽 " + (delta >= 0 ? "+" : "") + kfmt(delta) + " → 余额 " + kfmt(Math.max(0, p.星羽 + delta)),
    (触限 ? "⚠️ " + 触限 + "（今天到此为止吧）" : "")
  ].filter(Boolean).join("\n"), {
    标题: delta >= 0 ? "🎉 赌场猜中（1:1）" : "💸 赌场输钱",
    行组: [
      row(actBtn("cw1", "⚡再来10", "bet|偶|10"), actBtn("cw2", "⚡再来100", "bet|偶|100"), actBtn("cw4", "⚡全押偶", "bet|偶|all"), actBtn("cw5", "⚡全押奇", "bet|奇|all")),
      row(btn("cw3", "赌场", "赌场"), btn("cw6", "星甲菜单", "星甲菜单"))
    ]
  });
}


export const WHEEL = [
  { 名: "星羽×200", t: "币", v: 200, w: 30 },
  { 名: "星羽×500", t: "币", v: 500, w: 22 },
  { 名: "星羽×1200", t: "币", v: 1200, w: 12 },
  { 名: "经验×300", t: "经", v: 300, w: 16 },
  { 名: "幸运星×1", t: "物", v: 1, k: "幸运星", w: 8 },
  { 名: "强化组件×1", t: "物", v: 1, k: "强化组件", w: 5 },
  { 名: "星核×3", t: "核", v: 3, w: 4 },
  { 名: "谢谢参与", t: "空", v: 0, w: 3 }
];


export async function wheel(ctx, t, u) {
  const today = ymd();
  if (ds(ctx, P.转盘日期, u, "") === today) {
    await reply(ctx, t, "今天的转盘已经转过了，明天再来。", {
      标题: "🎡 天选转盘", 行组: [row(actBtn("wh1", "⚡挖矿", "mine"), btn("wh2", "赌场", "赌场"), btn("wh3", "菜单", "菜单"))]
    });
    return;
  }
  dset(ctx, P.转盘日期, u, today);
  const prize = roll(WHEEL);
  if (prize.t === "币") {
    addCoin(ctx, u, prize.v);
    // 2.9.9（需求 F）：转盘星羽奖励从世界资金出（不足也照发，兜底记日志）
    if (!扣世界资金(ctx, prize.v, "转盘出奖 " + prize.名 + " → " + gid(ctx, u))) pushLog(ctx, "世界资金", "转盘出奖时资金见底（已照发 " + prize.v + "）");
  }
  else if (prize.t === "经") addXp(ctx, u, prize.v);
  else if (prize.t === "核") addCore(ctx, u, prize.v);
  else if (prize.t === "物") giveItem(ctx, u, prize.k, prize.v);
  tInc(ctx, u, "转盘");
  recPwr(ctx, u);
  await reply(ctx, t, ["转盘缓缓停下…", "获得：**" + prize.名 + "**", "", "每天可免费转 1 次。"].join("\n"), {
    标题: "🎡 天选转盘",
    行组: [row(actBtn("wi1", "⚡挖矿", "mine"), actBtn("wi2", "⚡打工", "work"), btn("wi3", "赌场", "赌场"))]
  });
}


export async function gacha(ctx, t, u, cnt) {
  const k = Number(cnt) === 10 ? 10 : 1;
  const price = Math.floor(500 * k * (k === 10 ? 0.9 : 1));
  const p = attrs(ctx, u);
  if (p.星羽 < price) {
    await reply(ctx, t, "抽卡需要 " + kfmt(price) + " 星羽，你只有 " + kfmt(p.星羽) + "。", {
      标题: "星核抽卡", 按钮: [actBtn("gc1", "⚡挖矿", "mine"), btn("gc2", "副本", "副本")]
    });
    return;
  }
  addCoin(ctx, u, -price);
  // 2.9.9（需求 F）：抽卡流水进世界资金（抽卡收入）
  加世界资金(ctx, price, "抽卡收入（" + gid(ctx, u) + " ×" + k + "）");
  const pool = [
    { 名: "太空废铁", w: 55, t: "物", v: 1, k: "太空废铁" },
    { 名: "翠露散", w: 22, t: "物", v: 1, k: "翠露散" },
    { 名: "幸运星", w: 12, t: "物", v: 1, k: "幸运星" },
    { 名: "强化组件", w: 7, t: "物", v: 1, k: "强化组件" },
    { 名: "SSR 星核", w: 4, t: "核", v: 2 }
  ];
  const out = [];
  let core = 0;
  for (let i = 0; i < k; i++) {
    const c = roll(pool);
    if (c.t === "核") { core += c.v; out.push("💠 " + c.名 + "×" + c.v); }
    else { giveItem(ctx, u, c.k, c.v); out.push("▪️ " + c.k + "×" + c.v); }
  }
  if (core) addCore(ctx, u, core);
  await reply(ctx, t, [k + " 连抽 · 花费 " + kfmt(price) + " 星羽", ""].concat(out).concat(["", core ? "星核 +" + core : "本次没出星核，下次一定。"]).join("\n"), {
    标题: "🎴 星核抽卡",
    行组: [row(btn("gd1", "再抽1次", "抽卡"), btn("gd2", "十连", "十连"), btn("gd3", "商店", "商店"))]
  });
}


export async function dice(ctx, t, u, amt) {
  const v = Math.max(50, Math.floor(Number(amt) || 100));
  const p = attrs(ctx, u);
  if (p.星羽 < v) { await reply(ctx, t, "星羽不足：你有 " + kfmt(p.星羽) + "。", { 标题: "摇骰子" }); return; }
  const a = rnd(1, 6), b = rnd(1, 6);
  const d = a > b ? v : a < b ? -v : 0;
  // 2.9.9（需求 F）：骰子同赌场过世界资金账本
  if (d > 0) { if (!扣世界资金(ctx, d, "骰子赔付 " + gid(ctx, u))) pushLog(ctx, "世界资金", "骰子赔付时资金见底（已照赔 " + d + "）"); }
  else if (d < 0) 加世界资金(ctx, -d, "骰子收入（" + gid(ctx, u) + "）");
  addCoin(ctx, u, d);
  await reply(ctx, t, [
    "你掷出 **" + a + "** · 机器人掷出 **" + b + "**",
    a > b ? "你赢了 " + kfmt(v) + " 星羽" : a < b ? "你输了 " + kfmt(v) + " 星羽" : "平局，不输不赢",
    "余额 " + kfmt(Math.max(0, p.星羽 + d))
  ].join("\n"), {
    标题: "🎲 摇骰子", 按钮: [btn("dc1", "再来500", "骰子500"), btn("dc2", "赌场", "赌场")]
  });
}
