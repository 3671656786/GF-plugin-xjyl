// lib/game/alliance.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S, dall, dget, dn, ds, dset, kfmt, rnd, ymd } from "./../core/base.mjs?v=v1795535467112";
import { actBtn, btn, reply, row, 蓝字, 蓝链 } from "./../core/qq.mjs?v=v1795535467112";
import { P, uid } from "./../core/util.mjs?v=v1795535467112";
import { mine } from "././casual.mjs?v=v1795535467112";
import { 灰混 } from "././cook.mjs?v=v1795535467112";
import { 扣世界资金, 资金见底 } from "././credit.mjs?v=v1795535467112";
import { GOODS } from "././farm.mjs?v=v1795535467112";
import { addCoin, addContrib, addCore, addXp, attrs, byGid, gid, giveItem, hasItem, pwrOf, recPwr, takeItem, 加经验 } from "././player.mjs?v=v1795535467112";
import { ALB, ALLI, AL_MAX, tInc, tProg, 联盟加入文件 } from "././progress.mjs?v=v1795535467112";

export function 联盟记录文件(name) { return "游戏数据/星舰数据/联盟数据/" + name + "/记录.json"; }


export function myAlly(ctx, u) {
  const v = ds(ctx, 联盟加入文件, u, "");
  if (v) return v;
  return ds(ctx, P.联盟, u, "");
}


export function setAlly(ctx, u, name) {
  dset(ctx, 联盟加入文件, u, S(name));
  dset(ctx, P.联盟, u, S(name));
}


export function allyLv(ctx, name) {
  if (!name) return 0;
  const rel = 联盟记录文件(name);
  const 级 = dn(ctx, rel, "等级", 0);
  if (级 > 0) return Math.min(AL_MAX, 级);
  const 繁 = dn(ctx, rel, "繁荣度", -1);
  if (繁 >= 0) return Math.max(1, Math.min(AL_MAX, Math.floor(繁 / 100) + 1));
  return Math.max(1, dn(ctx, P.联盟数据, name + "_等级", 1));
}


export function allyDon(ctx, name) {
  if (!name) return 0;
  const 繁 = dn(ctx, 联盟记录文件(name), "繁荣度", -1);
  if (繁 >= 0) return 繁;
  return dn(ctx, P.联盟数据, name + "_捐献", 0);
}


// 升级需繁荣度：升到 lv+1 需要 lv*100
export function allyNeed(lv) { return Math.max(100, lv * 100); }


export function allyMem(ctx, name) {
  const m = {};
  const all = dall(ctx, 联盟加入文件);
  for (const uid of Object.keys(all)) if (S(all[uid]) === name) m[uid] = 1;
  const v = dget(ctx, P.联盟数据, name + "_成员", null);
  if (v && typeof v === "object") for (const k of Object.keys(v)) m[k] = 1;
  return m;
}


export function findAlly(name) { const s = S(name); return ALLI.filter((x) => x.名 === s)[0] || null; }


export function players(ctx) {
  const all = dall(ctx, P.开号);
  return Object.keys(all).filter((u) => String(all[u]) === "已");
}


export async function socialAlly(ctx, t, u) {
  const mine = myAlly(ctx, u);
  const lines = [];
  for (const a of ALLI) {
    const lv = allyLv(ctx, a.名);
    const people = Object.keys(allyMem(ctx, a.名)).length;
    lines.push("【" + a.名 + "】Lv." + lv + " · " + a.向 + "加成 · " + people + " 人" + (mine === a.名 ? " ← 你在此" : ""));
    lines.push("    " + a.说 + " · 捐献 " + kfmt(allyDon(ctx, a.名)) + "/" + kfmt(allyNeed(lv)));
  }
  lines.push("", "我的贡献：" + dn(ctx, P.贡献, u, 0));
  lines.push("", "`加入联盟以爆制爆` · `联盟捐献 500` · `查看联盟` · `联盟战` · `退出联盟`");
  await reply(ctx, t, lines.join("\n"), {
    标题: "🏛️ 联盟",
    行组: [
      row(btn("n1", "加入以爆制爆", "加入联盟以爆制爆"), btn("n2", "加入蚀月獠牙", "加入联盟蚀月獠牙")),
      row(btn("n3", "加入暗域商锋", "加入联盟暗域商锋"), btn("n4", "加入休闲至上", "加入联盟休闲至上")),
      row(actBtn("n5", "⚡捐500", "donate|500"), actBtn("n6", "⚡捐2000", "donate|2000"), btn("n7", "联盟日奖", "联盟日奖")),
      row(btn("n8", "查看联盟", "查看联盟"), btn("n9", "联盟战", "联盟战"), btn("n10", "菜单", "菜单"))
    ]
  });
}


export async function joinAlly(ctx, t, u, name) {
  const input = S(name);
  let a = findAlly(input);
  if (!a && /^[1-9]$/.test(input)) a = ALLI[Number(input) - 1] || null;
  if (!a) {
    await reply(ctx, t, "没有叫【" + input + "】的联盟。\n可选：" + ALLI.map((x) => x.名).join(" / "), {
      标题: "加入失败", 按钮: [btn("o1", "查看联盟", "联盟")]
    });
    return;
  }
  const old = myAlly(ctx, u);
  if (old === a.名) { await reply(ctx, t, "你已经在【" + a.名 + "】了。", { 标题: "无需重复加入" }); return; }
  setAlly(ctx, u, a.名);
  dset(ctx, 联盟记录文件(a.名), "总人数", Object.keys(allyMem(ctx, a.名)).length);
  if (old) dset(ctx, 联盟记录文件(old), "总人数", Object.keys(allyMem(ctx, old)).length);
  const b = ALB[a.名] || {};
  const text = [];
  if (b.攻击) { dset(ctx, P.攻击, u, dn(ctx, P.攻击, u, 100) + b.攻击); text.push("攻击力+" + b.攻击); }
  if (b.血量) {
    dset(ctx, P.血量上限, u, dn(ctx, P.血量上限, u, 500) + b.血量);
    dset(ctx, P.血量, u, dn(ctx, P.血量, u, 500) + b.血量);
    text.push("血量+" + b.血量);
  }
  if (b.暴击) { dset(ctx, P.暴击, u, dn(ctx, P.暴击, u, 0) + b.暴击); text.push("暴击+" + b.暴击); }
  if (b.闪避) { dset(ctx, P.闪避, u, dn(ctx, P.闪避, u, 0) + b.闪避); text.push("闪避+" + b.闪避); }
  addCoin(ctx, u, 200);
  recPwr(ctx, u);
  await reply(ctx, t, [
    old ? "已从【" + old + "】转入【" + a.名 + "】" : "已加入【" + a.名 + "】",
    "阵营方向：" + a.向 + " · 联盟等级 " + allyLv(ctx, a.名),
    text.length ? "入盟加成：" + text.join(" · ") : "该联盟暂无战斗加成",
    "入盟礼：星羽 +200",
    "",
    "别忘了领 `联盟日奖`，并用 `联盟捐献` 提升联盟等级。"
  ].join("\n"), {
    标题: "🏛️ 入盟成功",
    行组: [row(btn("p1", "联盟日奖", "联盟日奖"), actBtn("p2", "⚡捐500", "donate|500"), btn("p3", "查看联盟", "查看联盟"))]
  });
}


export async function viewAlly(ctx, t, u) {
  const name = myAlly(ctx, u);
  if (!name) { await reply(ctx, t, "你还没有联盟。\n发送 `联盟` 查看并加入。", { 标题: "查看联盟" }); return; }
  const lv = allyLv(ctx, name);
  const don = allyDon(ctx, name);
  const m = allyMem(ctx, name);
  const rows = Object.keys(m).slice(0, 10).map((x, i) => (i + 1) + ". #" + dn(ctx, P.游戏ID, x, 0) + " " + ds(ctx, P.昵称, x, "无名"));
  await reply(ctx, t, [
    "阵营：**" + name + "** · Lv." + lv + "/" + AL_MAX,
    "捐献进度：" + kfmt(don) + " / " + kfmt(allyNeed(lv)),
    "我的贡献：" + dn(ctx, P.贡献, u, 0),
    "战力加成：+" + ((lv - 1) * 4) + "%",
    "",
    "**成员（" + Object.keys(m).length + "）**",
    rows.length ? rows.join("\n") : "（暂无）"
  ].join("\n"), {
    标题: "🏛️ 查看联盟",
    行组: [row(actBtn("y1", "⚡捐500", "donate|500"), actBtn("y2", "⚡捐2000", "donate|2000"), btn("y3", "联盟战", "联盟战"))]
  });
}


export async function donateAlly(ctx, t, u, amount) {
  const name = myAlly(ctx, u);
  if (!name) { await reply(ctx, t, "先加入一个联盟才能捐献。\n发送 `联盟` 查看。", { 标题: "捐献失败" }); return; }
  const lv = allyLv(ctx, name);
  if (lv >= AL_MAX) { await reply(ctx, t, "【" + name + "】已达到最高等级 " + AL_MAX + "。", { 标题: "已是满级联盟" }); return; }
  const amt = Math.max(100, Math.floor(Number(amount) || 500));
  const p = attrs(ctx, u);
  if (p.星羽 < amt) {
    await reply(ctx, t, "星羽不足：捐 " + amt + "，你只有 " + p.星羽 + "。", {
      标题: "捐献失败", 按钮: [btn("z1", "银行", "银行系统"), actBtn("z2", "⚡挖矿", "mine")]
    });
    return;
  }
  addCoin(ctx, u, -amt);
  const 繁 = allyDon(ctx, name) + amt;
  const 新级 = Math.max(1, Math.min(AL_MAX, Math.floor(繁 / 100) + 1));
  const up = 新级 > lv ? 新级 - lv : 0;
  dset(ctx, 联盟记录文件(name), "繁荣度", 繁);
  dset(ctx, 联盟记录文件(name), "等级", 新级);
  dset(ctx, 联盟记录文件(name), "总人数", Object.keys(allyMem(ctx, name)).length);
  const contrib = Math.floor(amt / 50);
  addContrib(ctx, u, contrib);
  const 捐献经验 = 150;
  加经验(ctx, u, 捐献经验);
  tInc(ctx, u, "捐献");
  recPwr(ctx, u);
  await reply(ctx, t, [
    "向【" + name + "】捐献 " + amt + " 星羽",
    "贡献 +" + contrib + "（现 " + dn(ctx, P.贡献, u, 0) + "）",
    "经验 +" + 捐献经验,
    up ? "🎉 联盟升级！Lv." + lv + " → **Lv." + 新级 + "**（战力加成 +" + ((新级 - 1) * 4) + "%）" : "繁荣度 " + kfmt(繁) + "（下一级需 " + kfmt(新级 * 100) + "）",
    "",
    "联盟等级越高，`联盟日奖` 越丰厚。"
  ].join("\n"), {
    标题: "🤝 捐献成功",
    行组: [row(actBtn("w1", "⚡再捐500", "donate|500"), btn("w2", "联盟日奖", "联盟日奖"), btn("w3", "查看联盟", "查看联盟"))]
  });
}


export async function allyDaily(ctx, t, u) {
  const name = myAlly(ctx, u);
  if (!name) {
    await reply(ctx, t, "你还没加入联盟，加入后可领联盟专属每日奖励。\n发送 `联盟` 查看。", {
      标题: "🏛️ 联盟日奖", 按钮: [btn("v1", "联盟", "联盟"), btn("v2", "加入联盟以爆制爆", "加入联盟以爆制爆")]
    });
    return;
  }
  const key = u + "_" + ymd();
  if (ds(ctx, P.联盟数据, "日奖_" + key, "") === "已") {
    await reply(ctx, t, "今天的联盟日奖已经领过了。\n所属阵营：" + name, { 标题: "🏛️ 联盟日奖" });
    return;
  }
  const lv = allyLv(ctx, name);
  const coin = 150 + lv * 60;
  const xp = 60 + lv * 30;
  const core = Math.min(5, Math.floor(lv / 3));
  dset(ctx, P.联盟数据, "日奖_" + key, "已");
  addCoin(ctx, u, coin);
  if (core) addCore(ctx, u, core);
  addXp(ctx, u, xp);
  addContrib(ctx, u, 5);
  recPwr(ctx, u);
  await reply(ctx, t, [
    "阵营【" + name + "】Lv." + lv,
    "星羽 +" + coin + " · 经验 +" + xp + (core ? " · 星核 +" + core : "") + " · 贡献 +5",
    "",
    "联盟等级越高，每日奖励越丰厚（捐献可提升等级）。"
  ].join("\n"), {
    标题: "🏛️ 联盟日奖",
    按钮: [btn("va", "联盟捐献", "联盟捐献 500"), btn("vb", "查看联盟", "查看联盟")]
  });
}


export async function allyWar(ctx, t, u) {
  const name = myAlly(ctx, u);
  if (!name) { await reply(ctx, t, "先加入联盟才能参加联盟战。", { 标题: "联盟战" }); return; }
  const d = ymd();
  const war = dget(ctx, P.联盟战, "记录", {});
  const rec = (war && typeof war === "object") ? war : {};
  if (rec[u + "_" + d]) { await reply(ctx, t, "今天已经打过联盟战了，明天再来。", { 标题: "联盟战" }); return; }
  const lv = allyLv(ctx, name);
  const my = pwrOf(ctx, u);
  const rate = Math.min(0.9, 0.4 + (my / (3000 + lv * 1200)) * 0.4);
  rec[u + "_" + d] = "已";
  dset(ctx, P.联盟战, "记录", rec);
  if (Math.random() >= rate) {
    await reply(ctx, t, "联盟战惜败（胜率约 " + Math.round(rate * 100) + "%）。\n明天可以再战。", {
      标题: "⚔️ 联盟战", 按钮: [btn("aa1", "强化", "强化"), btn("aa2", "副本", "副本")]
    });
    return;
  }
  const coin = 300 + lv * 120 + rnd(0, 200);
  const core = 1 + Math.floor(lv / 3);
  addCoin(ctx, u, coin);
  addCore(ctx, u, core);
  加经验(ctx, u, 200 + lv * 80);
  addContrib(ctx, u, 20);
  recPwr(ctx, u);
  await reply(ctx, t, [
    "联盟战胜利！【" + name + "】Lv." + lv,
    "星羽 +" + coin + " · 星核 +" + core + " · 经验 +" + (200 + lv * 80) + " · 贡献 +20",
    "",
    "每天可参加 1 次联盟战。"
  ].join("\n"), {
    标题: "⚔️ 联盟战胜利",
    行组: [row(btn("ab1", "联盟日奖", "联盟日奖"), btn("ab2", "领取联盟战奖励", "领取联盟战奖励"), btn("ab3", "查看联盟", "查看联盟"))]
  });
}


export async function claimWar(ctx, t, u) {
  const name = myAlly(ctx, u);
  if (!name) { await reply(ctx, t, "先加入联盟才能领取联盟战奖励。", { 标题: "⚔️ 联盟战奖励" }); return; }
  const d = ymd();
  const war = dget(ctx, P.联盟战, "记录", {});
  if (!war || !war[u + "_" + d]) {
    await reply(ctx, t, "今天还没参加联盟战。\n发送 `联盟战` 参加。", {
      标题: "⚔️ 联盟战奖励", 按钮: [btn("aw1", "参加联盟战", "联盟战")]
    });
    return;
  }
  if (ds(ctx, P.联盟战, "领_" + u + "_" + d, "") === "已") {
    await reply(ctx, t, "今天的联盟战奖励已经领过了。", { 标题: "⚔️ 联盟战奖励" });
    return;
  }
  const lv = allyLv(ctx, name);
  const coin = 300 + lv * 100;
  const core = 1 + Math.floor(lv / 4);
  dset(ctx, P.联盟战, "领_" + u + "_" + d, "已");
  addCoin(ctx, u, coin);
  addCore(ctx, u, core);
  加经验(ctx, u, 150 + lv * 60);
  recPwr(ctx, u);
  await reply(ctx, t, [
    "领取联盟战奖励（【" + name + "】Lv." + lv + "）",
    "星羽 +" + coin + " · 星核 +" + core + " · 经验 +" + (150 + lv * 60)
  ].join("\n"), {
    标题: "🎁 联盟战奖励",
    行组: [row(btn("aw2", "联盟日奖", "联盟日奖"), btn("aw3", "查看联盟", "查看联盟"))]
  });
}


export async function leaveAlly(ctx, t, u) {
  const name = myAlly(ctx, u);
  if (!name) { await reply(ctx, t, "你本来就没有联盟。", { 标题: "退出联盟" }); return; }
  setAlly(ctx, u, "");
  dset(ctx, 联盟记录文件(name), "总人数", Object.keys(allyMem(ctx, name)).length);
  recPwr(ctx, u);
  await reply(ctx, t, "已退出【" + name + "】。\n贡献值保留，可随时加入其他联盟。", {
    标题: "已退出联盟", 按钮: [btn("x1", "联盟列表", "联盟")]
  });
}


export const RK_FIELD = {
  签到排行榜: "连签", 评分排行榜: "战力", 攻击排行榜: "攻击", 血量排行榜: "血量上限",
  等级排行榜: "等级", 星羽排行榜: "星羽", 存款排行榜: "存款", 星核排行榜: "星核"
};


export async function rankPanel(ctx, t, u, type) {
  const list = players(ctx);
  if (!list.length) { await reply(ctx, t, "还没有任何玩家数据。", { 标题: "排行榜" }); return; }
  const rows = list.map((x) => ({
    u: x, 编号: dn(ctx, P.游戏ID, x, 0), 昵称: ds(ctx, P.昵称, x, "无名"),
    战力: dn(ctx, P.战力, x, 0), 等级: dn(ctx, P.等级, x, 1), 星羽: dn(ctx, P.星羽, x, 0),
    存款: dn(ctx, P.存款, x, 0), 星核: dn(ctx, P.星核, x, 0), 攻击: dn(ctx, P.攻击, x, 0),
    血量上限: dn(ctx, P.血量上限, x, 500), 连签: dn(ctx, P.连签, x, 0)
  }));
  const top = (f) => rows.slice().sort((a, b) => b[f] - a[f]).slice(0, 10);
  const block = (title, f, suf) => {
    const r = top(f).map((x, i) => (i + 1) + ". " + x.昵称 + "(#" + x.编号 + ") " + kfmt(x[f]) + (suf || ""));
    return ["**" + title + "**"].concat(r.length ? r : ["（暂无）"]);
  };
  if (type && RK_FIELD[type]) {
    const f = RK_FIELD[type];
    const suf = f === "等级" ? " 级" : f === "连签" ? " 天" : "";
    await reply(ctx, t, ["共 " + rows.length + " 位玩家", ""].concat(block(type, f, suf)).join("\n"), {
      标题: "🏅 " + type,
      行组: [row(btn("rk1", "全部榜单", "排行榜"), btn("rk2", "签到榜", "签到排行榜"), btn("rk3", "菜单", "菜单"))]
    });
    return;
  }
  // 2.5.27：默认只显示按钮，不再一次性刷出全部榜单（要看得点对应按钮）
  const 提示 = [
    "共 **" + rows.length + "** 位玩家",
    "",
    "点下面的按钮查看对应榜单（每榜取前 10）：",
    "- 签到榜 · 评分（战力）榜 · 攻击榜",
    "- 等级榜 · 星羽榜 · 存款榜",
    "",
    "想看自己的数值：`星甲属性`"
  ];
  await reply(ctx, t, 提示.join("\n"), {
    标题: "🏅 排行榜",
    行组: [
      row(btn("ra", "签到榜", "签到排行榜"), btn("rb", "评分榜", "评分排行榜"), btn("rc", "攻击榜", "攻击排行榜"), btn("rh", "星核榜", "星核排行榜")),
      row(btn("rd", "等级榜", "等级排行榜"), btn("re", "星羽榜", "星羽排行榜"), btn("rf", "存款榜", "存款排行榜"), actBtn("rg", "⚡看属性", "info"))
    ]
  });
}


export async function giftItem(ctx, t, u, to, name, cnt) {
  const tm = S(to), it = S(name), k = Math.max(1, Math.floor(Number(cnt) || 1));
  const tu = byGid(ctx, tm);
  if (!tu) { await reply(ctx, t, "找不到编号 " + tm + " 的玩家。", { 标题: "赠送失败" }); return; }
  if (tu === u) { await reply(ctx, t, "不能送给自己。", { 标题: "赠送失败" }); return; }
  if (hasItem(ctx, u, it) < k) { await reply(ctx, t, "你只有 " + hasItem(ctx, u, it) + " 个【" + it + "】。", { 标题: "赠送失败" }); return; }
  takeItem(ctx, u, it, k);
  giveItem(ctx, tu, it, k);
  await reply(ctx, t, "已赠送【" + it + "】×" + k + " 给 " + ds(ctx, P.昵称, tu, "对方") + "。", { 标题: "🎁 赠送成功" });
}


/* 3.3.19：转账每日限额（按自然日累计，零点自动重置）
 * · 出账：每人每日最多转出 100 万（记在转出方的 转账出账）
 * · 入账：每人每日最多接收 200 万（记在接收方的 转账入账）
 * 两个额度分别计在各自名下的每日进度里，互不影响。 */
export const 转账每日出账上限 = 1000000;
export const 转账每日入账上限 = 2000000;

// 读当天某玩家的每日进度（tProg 已按 ymd() 分文件，零点自然清零）
function 转账日量(ctx, u, 键) { return Math.max(0, Math.floor(Number(tProg(ctx, u)[键]) || 0)); }

// 当天累计转账计数（写回转出方/接收方各自的每日进度）
function 转账日加(ctx, u, 键, v) {
  if (!u || !键) return;
  const o = tProg(ctx, u);
  o[键] = Math.max(0, (Number(o[键]) || 0) + Math.floor(Number(v) || 0));
  dset(ctx, P.每日进度(ymd()), u, o);
}

export async function giftCoin(ctx, t, u, to, amt) {
  const tm = S(to);
  const tu = byGid(ctx, tm);
  if (!tu) { await reply(ctx, t, "找不到编号 " + tm + " 的玩家。", { 标题: "转账失败" }); return; }
  if (tu === u) { await reply(ctx, t, "不能转给自己。", { 标题: "转账失败" }); return; }
  const v = Math.max(1, Math.floor(Number(amt) || 0));
  if (dn(ctx, P.星羽, u, 0) < v) { await reply(ctx, t, "星羽不足。", { 标题: "转账失败" }); return; }

  // 限额校验：出账 / 入账分别独立，两个额度都够才放行
  const 已出 = 转账日量(ctx, u, "转账出账");
  const 已入 = 转账日量(ctx, tu, "转账入账");
  const 出余 = Math.max(0, 转账每日出账上限 - 已出);
  const 入余 = Math.max(0, 转账每日入账上限 - 已入);
  if (v > 出余) {
    await reply(ctx, t, [
      "⛔ 今日出账额度不足：你今天已转出 **" + kfmt(已出) + "**，每日最多转出 **" + kfmt(转账每日出账上限) + "**。",
      "本次想转 " + kfmt(v) + "，今日仅剩 " + kfmt(出余) + " 可转。",
      "",
      "额度按自然日累计，**明日 0 点重置**（入账额度另算，不受此限）。"
    ].join("\n"), { 标题: "⛔ 出账超限" });
    return;
  }
  if (v > 入余) {
    await reply(ctx, t, [
      "⛔ 对方今日入账额度不足：" + ds(ctx, P.昵称, tu, "对方") + " 今天已接收 **" + kfmt(已入) + "**，每日最多接收 **" + kfmt(转账每日入账上限) + "**。",
      "本次想转 " + kfmt(v) + "，对方今日仅剩 " + kfmt(入余) + " 可接收。",
      "",
      "额度按自然日累计，**明日 0 点重置**（你的出账额度另算，不受此限）。"
    ].join("\n"), { 标题: "⛔ 入账超限" });
    return;
  }

  addCoin(ctx, u, -v);
  addCoin(ctx, tu, v);
  // 成功后分别累加：出账记转出方，入账记接收方
  转账日加(ctx, u, "转账出账", v);
  转账日加(ctx, tu, "转账入账", v);
  await reply(ctx, t, "已转账 " + v + " 星羽给 " + ds(ctx, P.昵称, tu, "对方") + "。\n今日出账 " + kfmt(已出 + v) + "/" + kfmt(转账每日出账上限) + " · 对方入账 " + kfmt(已入 + v) + "/" + kfmt(转账每日入账上限) + "（明日 0 点重置）。", { 标题: "💸 转账成功" });
}



/* ============================================================
 * 八、经济：银行 / 商店 / 交易行 / 金融市场 / 打劫
 * ============================================================ */
/* ---------- 2.7.0（需求 17）动态利息 ----------
 * 旧规则是死数「每 6 小时 +1%，最多累 8 段」——存款到后期几百万时，光利息就能压过所有玩法产出。
 * 现在改成**每人动态**：利率随「本人存款规模」递减（边际收益递减），小存款享受高息，大存款自动降温。
 *   0 存款附近 → 1.2% / 6h
 *   10 万      → 约 0.72%
 *   50 万      → 约 0.34%
 *   200 万     → 约 0.13%
 *   1000 万    → 约 0.04%（下限 0.02%）
 * 另外用「本段利息不超过本金的 4%」再兜一层，防止长时间不结算后一次爆利。
 */
export const 存款利率上限 = 0.012;


export const 存款利率下限 = 0.0002;


export const 存款利率半衰期 = 220000;

   // 存款每多这么多，利率大致减半
export function 存款利率(dep) {
  const d = Math.max(0, Number(dep) || 0);
  const r = 存款利率上限 / (1 + d / 存款利率半衰期);
  return Math.max(存款利率下限, r);
}


export function 利率文本(r) { return (r * 100).toFixed(2) + "%"; }


export function settleInterest(ctx, u) {
  const dep = dn(ctx, P.存款, u, 0);
  const last = dn(ctx, P.存款时间, u, Date.now());
  if (dep <= 0) { dset(ctx, P.存款时间, u, Date.now()); return 0; }
  const seg = Math.floor((Date.now() - last) / (6 * 3600 * 1000));
  if (seg <= 0) return 0;
  const 段 = Math.min(seg, 8);
  const 率 = 存款利率(dep);
  // 兜底：一次结算最多给本金的 4%
  const gain = Math.min(Math.floor(dep * 0.04), Math.floor(dep * 率 * 段));
  if (gain <= 0) return 0;
  // 2.9.6（需求 11）：银行利息由「世界资金」支出；世界资金见底时不发放利息
  if (资金见底(ctx)) return 0;
  if (!扣世界资金(ctx, gain, "发放银行利息给 " + gid(ctx, u))) return 0;
  dset(ctx, P.存款, u, dep + gain);
  dset(ctx, P.存款时间, u, last + seg * 6 * 3600 * 1000);
  return gain;
}


export async function bankPanel(ctx, t, u) {
  const gain = settleInterest(ctx, u);
  const p = attrs(ctx, u);
  await reply(ctx, t, [
    "钱包：" + kfmt(p.星羽) + " 星羽",
    "存款：" + kfmt(dn(ctx, P.存款, u, 0)) + " 星羽",
    gain ? "利息入账：+" + kfmt(gain) : (资金见底(ctx) ? "⚠️ 世界资金见底，银行暂停发放利息" : ("当前利率：" + 利率文本(存款利率(dn(ctx, P.存款, u, 0))) + " / 6 小时（随存款规模递减）")),
    "",
    "`存入星羽1000` · `取出星羽1000` · `全部存入` · `全部取出`",
    "存款不会被赌场 / 交易行花掉，适合攒钱。"
  ].join("\n"), {
    标题: "🏦 星穹银行",
    行组: [
      row(btn("bk1", "存1000", "存入星羽1000"), btn("bk2", "取1000", "取出星羽1000")),
      row(btn("bk3", "全部存入", "全部存入"), btn("bk4", "全部取出", "全部取出")),
      row(btn("bk5", "金融市场", "金融市场"), btn("bk6", "商店", "商店"), btn("bk7", "菜单", "菜单"))
    ]
  });
}


export async function bankMove(ctx, t, u, dir, amt, all) {
  const p = attrs(ctx, u);
  settleInterest(ctx, u);
  const dep = dn(ctx, P.存款, u, 0);
  if (dir === "存") {
    const v = all ? p.星羽 : Math.max(1, Math.floor(Number(amt) || 0));
    if (p.星羽 < v) { await reply(ctx, t, "星羽不足：你有 " + kfmt(p.星羽) + "，存不了 " + kfmt(v) + "。", { 标题: "存款失败" }); return; }
    addCoin(ctx, u, -v);
    dset(ctx, P.存款, u, dep + v);
    tInc(ctx, u, "存款");
    await reply(ctx, t, "存入 " + kfmt(v) + " 星羽。\n存款合计 " + kfmt(dep + v), {
      标题: "🏦 存款成功",
      按钮: [btn("ca1", "再存1000", "存入星羽1000"), btn("ca2", "全部存入", "全部存入"), btn("ca3", "全部取出", "全部取出")]
    });
    return;
  }
  const v = all ? dep : Math.max(1, Math.floor(Number(amt) || 0));
  if (dep < v) { await reply(ctx, t, "存款不足：你存了 " + kfmt(dep) + "，取不了 " + kfmt(v) + "。", { 标题: "取款失败" }); return; }
  dset(ctx, P.存款, u, dep - v);
  addCoin(ctx, u, v);
  await reply(ctx, t, "取出 " + kfmt(v) + " 星羽。\n存款剩余 " + kfmt(dep - v), {
    标题: "🏦 取款成功", 按钮: [btn("cb1", "再取1000", "取出星羽1000"), btn("cb2", "全部取出", "全部取出")]
  });
}


export const CORE_SHOP = [
  { 名: "强化组件", 核: 3 }, { 名: "幸运星", 核: 2 }, { 名: "护盾芯片", 核: 4 }, { 名: "改名卡", 核: 5 },
  { 名: "火力核心", 核: 6 }, { 名: "星辉宝箱", 核: 8 }
];


/* ---------- 2.5.16 星核商店面板（修复「未识别的操作：星核商店」） ---------- */
export async function 星核商店面板(ctx, t, u) {
  const p = attrs(ctx, u);
  const 行 = [
    ["▍档案", false],
    [gid(ctx, u) + " · " + p.昵称 + " · 星核 **" + kfmt(p.星核) + "** · 星羽 " + kfmt(p.星羽), true],
    ["用「星核」兑换（星核来自副本 / BOSS / 陨石碎片）", true],
    ["", true],
    ["▍商品（点编号兑换）", false]
  ];
  CORE_SHOP.forEach((g, i) => {
    // 3.0.0（需求 24）：编号可点（点击 = 兑换 1 个）；全局连续编号
    行.push([蓝字("兑换#" + g.名 + "#1", (i + 1) + ".") + g.名, false]);
    行.push(["　价格:" + g.核 + " 星核　持有:" + hasItem(ctx, u, g.名) + "　" + 蓝字("兑换#" + g.名 + "#1", "兑换1个") + "  " + 蓝字("兑换#" + g.名 + "#5", "兑换5个"), true]);
  });
  行.push(["", true]);
  行.push(["其他：" + 蓝链([["星甲商店", "商店"], ["背包", "背包"], ["属性", "属性"], ["副本", "副本"], ["星甲菜单", "星甲菜单"]]), true]);
  await reply(ctx, t, 灰混(行), {
    标题: "💠 星核商店",
    行组: [
      row.apply(null, CORE_SHOP.slice(0, 3).map((g) => btn("cs" + g.名, "换" + g.名.slice(0, 4), "兑换#" + g.名 + "#1"))),
      row.apply(null, CORE_SHOP.slice(3, 6).map((g) => btn("cs" + g.名, "换" + g.名.slice(0, 4), "兑换#" + g.名 + "#1"))),
      row(actBtn("csb", "⚡背包", "bag|1"), actBtn("css", "⚡星甲商店", "shop|1"), btn("csm", "菜单", "菜单"))
    ]
  });
}


export async function shopPanel(ctx, t, u) {
  const p = attrs(ctx, u);
  const lines = ["钱包：" + kfmt(p.星羽) + " 星羽 · 星核：" + p.星核, "", "**常规商品**"];
  for (const g of GOODS) lines.push("- " + g.名 + " · " + kfmt(g.价) + " 星羽（持有 " + hasItem(ctx, u, g.名) + "）");
  lines.push("", "**星核兑换**");
  for (const g of CORE_SHOP) lines.push("- " + g.名 + " · " + g.核 + " 星核（持有 " + hasItem(ctx, u, g.名) + "）");
  lines.push("", "`购买#商品#数量` · `兑换#商品#数量`");
  await reply(ctx, t, lines.join("\n"), {
    标题: "🛒 暗域商锋",
    行组: [
      row(btn("sh1", "鱼饵×10", "购买#鱼饵#10"), btn("sh2", "强化组件×1", "购买#强化组件#1"), btn("sh3", "幸运币×5", "购买#幸运币#5")),
      row(btn("sh4", "护盾芯片×1", "购买#护盾芯片#1"), btn("sh5", "经验芯片×1", "购买#经验芯片#1"), btn("sh6", "陨石碎片×1", "购买#陨石碎片#1")),
      row(btn("sh7", "火力核心×1", "购买#火力核心#1"), btn("sh8", "星辉宝箱×1", "购买#星辉宝箱#1"), btn("sh9", "自动卡×10", "购买#自动卡#10")),
      row(btn("sh10", "换强化组件", "兑换#强化组件#1"), btn("sh11", "换星辉宝箱", "兑换#星辉宝箱#1"), btn("sh12", "换改名卡", "兑换#改名卡#1")),
      row(btn("sh13", "银行", "银行系统"), btn("sh14", "交易行", "交易行"), btn("sh15", "菜单", "菜单"))
    ]
  });
}
