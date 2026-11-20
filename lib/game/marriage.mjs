// lib/game/marriage.mjs —— 3.0.0（需求 3）：结婚 / 好感 / 离婚 / 伴侣加成
//   · 婚前送花刷好感：1 朵花 = 1 点好感，累计满 1000 可求婚（单次可送 1000）
//   · 结婚后：打「副本 / BOSS」时，**对象**额外获得 1% 经验 / 星羽 / 金币（只有这三项、只有 1%）
//   · 可以离婚再换人；好感与婚姻是两套数据，离婚不清好感（再追同一人不用重新刷）
//   · 数据：dataPath/游戏数据/社交/婚姻.json（带版本，读取兜底）
import { S, dget, dset, kfmt, n } from "./../core/base.mjs?v=v1795174016938";
import { actBtn, btn, reply, row, 蓝字 } from "./../core/qq.mjs?v=v1795174016938";
import { P } from "./../core/util.mjs?v=v1795174016938";
import { byGid, gid, hasItem, takeItem } from "./../game/player.mjs?v=v1795174016938";

const 档案路径 = "游戏数据/社交/婚姻.json";
const 好感上限 = 1000;
const 加成比例 = 0.01;   // 仅 1%

function 空档() { return { 版本: "1.0.0", 婚: {}, 好感: {}, 待应: {} }; }

export function 婚姻档案(ctx) {
  const v = dget(ctx, 档案路径, "档", null);
  const o = v && typeof v === "object" ? v : 空档();
  if (!o.婚 || typeof o.婚 !== "object") o.婚 = {};
  if (!o.好感 || typeof o.好感 !== "object") o.好感 = {};
  if (!o.待应 || typeof o.待应 !== "object") o.待应 = {};
  if (!o.版本) o.版本 = "1.0.0";
  return o;
}

function 存档(ctx, o) { dset(ctx, 档案路径, "档", o); }

function 对键(a, b) { const x = S(a), y = S(b); return x < y ? x + "|" + y : y + "|" + x; }

export function 好感值(ctx, a, b) { return n(婚姻档案(ctx).好感[对键(a, b)], 0); }

export function 配偶(ctx, u) {
  const o = 婚姻档案(ctx);
  const m = o.婚[S(u)];
  return m && m.对象 ? S(m.对象) : "";
}

// 把「编号 / openid」解析成玩家 openid
function 找目标(ctx, 键) {
  const s = S(键);
  if (!s) return "";
  const x = byGid(ctx, s);
  return x || "";
}

function 名字(ctx, u) {
  try {
    const 表 = dget(ctx, P.昵称, u, "");
    return S(表) || ("玩家" + S(gid(ctx, u)));
  } catch (e) { return "玩家" + S(gid(ctx, u)); }
}

/* ---------- 送花 ---------- */
export async function 送花(ctx, t, u, 目标键, 数量) {
  const 对 = 找目标(ctx, 目标键);
  if (!对) { await reply(ctx, t, "找不到这个玩家：**" + S(目标键) + "**（用编号，如 `星甲送花10001#100`）", { 标题: "🌹 送花失败" }); return; }
  if (对 === u) { await reply(ctx, t, "不能给自己送花。", { 标题: "🌹 送花失败" }); return; }
  const 数 = Math.max(1, Math.min(好感上限, Math.floor(Number(数量) || 1)));
  const 有 = hasItem(ctx, u, "花");
  if (有 < 数) {
    await reply(ctx, t, "花不够：需要 " + kfmt(数) + " 朵，你只有 " + kfmt(有) + " 朵。\n花可以从副本 / BOSS / 花妖 / 商店获得。", { 标题: "🌹 送花失败" });
    return;
  }
  takeItem(ctx, u, "花", 数);
  const o = 婚姻档案(ctx);
  const k = 对键(u, 对);
  o.好感[k] = Math.min(好感上限, n(o.好感[k], 0) + 数);
  if (配偶(ctx, u) === 对) o.好感[k] = 好感上限;   // 已婚的直接满好感显示
  存档(ctx, o);
  const 好 = o.好感[k];
  const 已婚 = 配偶(ctx, u) === 对;
  await reply(ctx, t, [
    "你给 **" + 名字(ctx, 对) + "** 送了 " + kfmt(数) + " 朵花 🌹",
    "当前好感：**" + 好 + " / " + 好感上限 + "**" + (已婚 ? "（已婚）" : ""),
    "",
    已婚 ? "你们已经结婚了，好感只用于展示。" : (好 >= 好感上限 ? "好感已满，可以 `星甲求婚" + gid(ctx, 对) + "` 了。" : "好感满 " + 好感上限 + " 就能求婚。")
  ].join("\n"), {
    标题: "🌹 送花",
    行组: [row(
      蓝字("送花" + gid(ctx, 对) + "#100", "再送100"),
      btn("mgview", "我的婚姻", "婚姻"),
      btn("mgback", "属性", "属性")
    )]
  });
}

/* ---------- 求婚 / 答应 / 拒绝 / 离婚 ---------- */
export async function 求婚(ctx, t, u, 目标键) {
  const 对 = 找目标(ctx, 目标键);
  if (!对) { await reply(ctx, t, "找不到这个玩家：**" + S(目标键) + "**", { 标题: "💍 求婚失败" }); return; }
  if (对 === u) { await reply(ctx, t, "不能和自己结婚。", { 标题: "💍 求婚失败" }); return; }
  const 我婚 = 配偶(ctx, u), 他婚 = 配偶(ctx, 对);
  if (我婚) {
    await reply(ctx, t, "你已经和 **" + 名字(ctx, 我婚) + "** 结婚了；想换人先 `星甲离婚`。", { 标题: "💍 求婚失败", 行组: [row(btn("mgd", "离婚", "离婚"), btn("mginfo", "我的婚姻", "婚姻"))] });
    return;
  }
  if (他婚) { await reply(ctx, t, "对方已经和 **" + 名字(ctx, 他婚) + "** 结婚了。", { 标题: "💍 求婚失败" }); return; }
  const 好 = 好感值(ctx, u, 对);
  if (好 < 好感上限) {
    await reply(ctx, t, [
      "好感还不够：**" + 好 + " / " + 好感上限 + "**",
      "",
      "先送花刷好感：`星甲送花" + gid(ctx, 对) + "#1000`（1 朵花 = 1 点好感，一次最多 1000）"
    ].join("\n"), { 标题: "💍 求婚失败", 行组: [row(btn("mgg", "送花", "送花"), btn("mginfo2", "我的婚姻", "婚姻"))] });
    return;
  }
  const o = 婚姻档案(ctx);
  o.待应[对] = { 对象: u, 时间: Date.now() };
  存档(ctx, o);
  await reply(ctx, t, [
    "💍 你已经向 **" + 名字(ctx, 对) + "** 求婚（好感 " + 好感上限 + "）。",
    "",
    "对方发 `星甲答应求婚` 就结婚，`星甲拒绝求婚` 婉拒；3 天内有效。"
  ].join("\n"), {
    标题: "💍 求婚",
    行组: [row(btn("mginfo3", "我的婚姻", "婚姻"), btn("mgback2", "属性", "属性"))]
  });
}

export async function 答应求婚(ctx, t, u) {
  const o = 婚姻档案(ctx);
  const p = o.待应[u];
  if (!p || !p.对象) { await reply(ctx, t, "现在没有待处理的求婚。", { 标题: "💍 结婚" }); return; }
  if (Date.now() - n(p.时间, 0) > 3 * 24 * 3600 * 1000) {
    delete o.待应[u]; 存档(ctx, o);
    await reply(ctx, t, "这条求婚已经过期（3 天），让对方重新求一次吧。", { 标题: "💍 结婚" });
    return;
  }
  const 对 = S(p.对象);
  if (配偶(ctx, u) || 配偶(ctx, 对)) { await reply(ctx, t, "你们中有一方已经结婚了，先处理离婚。", { 标题: "💍 结婚" }); return; }
  o.婚[u] = { 对象: 对, 时间: Date.now() };
  o.婚[对] = { 对象: u, 时间: Date.now() };
  o.好感[对键(u, 对)] = 好感上限;
  delete o.待应[u];
  存档(ctx, o);
  await reply(ctx, t, [
    "🎉 你们结婚了！",
    "",
    "**" + 名字(ctx, u) + "** ❤️ **" + 名字(ctx, 对) + "**",
    "",
    "婚后打 **副本 / BOSS** 时，对象额外获得 **1%** 的经验 / 星羽 / 金币（仅这三项）。",
    "想换人随时 `星甲离婚`。"
  ].join("\n"), { 标题: "💍 结婚成功", 行组: [row(btn("mginfo4", "我的婚姻", "婚姻"), btn("mgback3", "属性", "属性"))] });
}

export async function 拒绝求婚(ctx, t, u) {
  const o = 婚姻档案(ctx);
  const p = o.待应[u];
  if (!p || !p.对象) { await reply(ctx, t, "现在没有待处理的求婚。", { 标题: "💍 求婚" }); return; }
  const 对 = S(p.对象);
  delete o.待应[u];
  存档(ctx, o);
  await reply(ctx, t, "你婉拒了 **" + 名字(ctx, 对) + "** 的求婚。", { 标题: "💍 求婚" });
}

export async function 离婚(ctx, t, u) {
  const 对 = 配偶(ctx, u);
  if (!对) { await reply(ctx, t, "你还没有结婚。", { 标题: "💔 离婚" }); return; }
  const o = 婚姻档案(ctx);
  delete o.婚[u]; delete o.婚[对];
  // 好感保留 700（离婚后要重新追，但不用从 0 开始）
  const k = 对键(u, 对);
  o.好感[k] = Math.min(n(o.好感[k], 好感上限), 700);
  存档(ctx, o);
  await reply(ctx, t, [
    "💔 你和 **" + 名字(ctx, 对) + "** 已经离婚。",
    "",
    "好感保留 " + o.好感[k] + "（再追同一个人不用从 0 开始）；可以重新送花、求婚。"
  ].join("\n"), { 标题: "💔 离婚", 行组: [row(btn("mginfo5", "我的婚姻", "婚姻"), btn("mgback4", "属性", "属性"))] });
}

/* ---------- 面板 / 帮助 ---------- */
export async function 婚姻面板(ctx, t, u) {
  const o = 婚姻档案(ctx);
  const 对 = 配偶(ctx, u);
  const 待 = o.待应[u];
  const 行 = [
    "用户:" + gid(ctx, u) + "　昵称:" + 名字(ctx, u),
    "",
    "## 💍 我的婚姻",
    对 ? "配偶：**" + 名字(ctx, 对) + "**（结婚于 " + new Date(n(o.婚[u].时间, Date.now())).toLocaleString("zh-CN") + "）" : "配偶：**未婚**",
    对 ? "婚后加成：打 副本 / BOSS 时，对象额外获得 **1%** 经验 / 星羽 / 金币（仅这三项）" : "婚前需要送花刷好感：**好感满 1000** 才能求婚（1 朵花 = 1 点好感）",
    待 && 待.对象 ? "待处理的求婚：**" + 名字(ctx, S(待.对象)) + "** 向你求婚 —— `星甲答应求婚` / `星甲拒绝求婚`" : "",
    "",
    "**送花 / 求婚**",
    "`星甲送花<编号>#<数量>`（一次最多 1000，例如 `星甲送花10001#1000`）",
    "`星甲求婚<编号>`（好感满 1000）",
    "",
    "其他：`星甲答应求婚` / `星甲拒绝求婚` / `星甲离婚`"
  ].filter(Boolean);
  await reply(ctx, t, 行.join("\n"), {
    标题: "💍 我的婚姻",
    行组: [
      row(btn("mghelp", "婚姻帮助", "婚姻帮助"), btn("mgattr", "属性", "属性"), btn("mgmenu", "菜单", "菜单")),
      row(btn("mgbag", "背包", "背包"), btn("mgshop", "商店", "商店"), btn("mgrank", "排行榜", "排行榜"))
    ]
  });
}

export async function 婚姻帮助(ctx, t, u) {
  await reply(ctx, t, [
    "## 💍 婚姻帮助",
    "",
    "**一、流程**",
    "1. 送花：`星甲送花<编号>#<数量>` —— 1 朵花 = 1 点好感，单次最多 1000；好感满 **1000** 才能求婚。",
    "2. 求婚：`星甲求婚<编号>` —— 对方 3 天内 `星甲答应求婚` 即结婚；`星甲拒绝求婚` 婉拒。",
    "3. 婚后加成：两人一起打 **副本 / BOSS** 时，**对象**额外获得 **1%** 的经验 / 星羽 / 金币（仅这三项、仅 1%）。",
    "4. 离婚：`星甲离婚` —— 好感保留 700，可以再追别人或复婚。",
    "",
    "**二、说明**",
    "· 双方都必须未婚；已婚的要先离婚。",
    "· 花可以从副本 / BOSS / 花妖 / 商店获得（商店 250 星羽/朵）。",
    "· 加成只在 副本 / BOSS 结算时生效，天下楼、PVP、日常玩法不参与。"
  ].join("\n"), { 标题: "💍 婚姻帮助", 行组: [row(btn("mginfo6", "我的婚姻", "婚姻"), btn("mgback5", "属性", "属性"))] });
}

/* ---------- 结算加成（副本 / BOSS 专用，1%） ----------
 * 返回值 = 额外给「对象」的数值；调用方把这份额外奖励发给 配偶(ctx,u)。
 * 类型只允许 经验 / 星羽 / 金币（需求：仅这三个）。
 */
export function 婚姻加成(ctx, u, 类型, 金额) {
  if (["经验", "星羽", "金币"].indexOf(S(类型)) < 0) return 0;
  if (!配偶(ctx, u)) return 0;
  const v = Math.floor(Math.max(0, Number(金额) || 0) * 加成比例);
  return Math.max(0, v);
}
