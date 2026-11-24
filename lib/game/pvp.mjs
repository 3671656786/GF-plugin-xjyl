// lib/game/pvp.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { ownerList } from "./../admin/admin.mjs?v=v1795534610437";
import { 是最高权限 } from "./../admin/edit.mjs?v=v1795534610437";
import { S, dget, dn, ds, dset, escMd, fmt, kfmt, pushLog } from "./../core/base.mjs?v=v1795534610437";
import { actBtn, btn, reply, row } from "./../core/qq.mjs?v=v1795534610437";
import { P } from "./../core/util.mjs?v=v1795534610437";
import { players } from "././alliance.mjs?v=v1795534610437";
import { 伤害结算, 大数, 战斗记录, 攻击力, 条带 } from "././combat.mjs?v=v1795534610437";
import { 技能点上限, 职业表, 灰混 } from "././cook.mjs?v=v1795534610437";
import { 读职业 } from "././player.mjs?v=v1795534610437";
import { 我血量上限, 设血量 } from "././dungeon.mjs?v=v1795534610437";
import { addCoin, addCore, attrs, byGid, gid, hasAcc, hasItem, pwrOf, recPwr, takeItem, 加经验, 战斗蓝量写回 } from "././player.mjs?v=v1795534610437";
import { 剩操作冷却, 设操作冷却 } from "././progress.mjs?v=v1795534610437";
import { 修甲拦截, 药品回血, 药品集, 蓝药集, 自动喝蓝药, 没蓝提醒 } from "././rebirth.mjs?v=v1795534610437";


/* ============================================================
 * 2.9.8（需求 3）玩家挑战（PVP · 手动回合制互攻）
 * ------------------------------------------------------------
 * · `星甲挑战#目标`（@某人 / 编号 / 名字）→ 对方收到带「同意 / 拒绝」按钮的战书；
 *   同意后进入手动回合制：双方沿用现有 普攻 / 技能#N / 治疗 / 逃跑 指令，
 *   会话里记「行动方」，谁轮到谁出手，每次出手后自动换人。
 * · 敌方 = 玩家真实属性（词条开战快照），**不套 PVE 三档狂暴**（不传 敌方:true）；
 *   PVP 用独立防秒杀上限：单刀合计 ≤ 对方血量上限 35%（PVE 的 单刀上限() 不受影响）。
 * · 一方血量归零即结算（胜者拿战利品，败者真实血量归零）；逃跑判负；
 *   5 分钟无任何动作自动结束（不计胜负、无奖励）。
 * · 存档：dataPath/系统/PVP挑战.json = { 会话: { [id]: 会话 }, 待定: { [目标openid]: 会话id } }
 * ============================================================ */
export const PVP无动作超时毫秒 = 5 * 60 * 1000;

   // 5 分钟无动作自动结束
export const PVP单刀上限比例 = 0.35;

              // PVP 防秒杀：单刀合计 ≤ 对方血量上限 35%
export function PVP全表(ctx) {
  const v = dget(ctx, P.PVP挑战, "全", null);
  const 表 = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  if (!表.会话 || typeof 表.会话 !== "object") 表.会话 = {};
  if (!表.待定 || typeof 表.待定 !== "object") 表.待定 = {};
  return 表;
}


export function PVP存表(ctx, 表) { dset(ctx, P.PVP挑战, "全", 表); }


export function PVP保存(ctx, s) { const 表 = PVP全表(ctx); 表.会话[s.id] = s; PVP存表(ctx, 表); }


export function PVP找会话(ctx, u) {
  const 表 = PVP全表(ctx);
  for (const id of Object.keys(表.会话)) {
    const s = 表.会话[id];
    if (s && s.状态 !== "已结束" && (s.a.u === u || s.b.u === u)) return s;
  }
  return null;
}


export function PVP找待定(ctx, u) {
  const 表 = PVP全表(ctx);
  const id = 表.待定[u];
  const s = id ? 表.会话[id] : null;
  if (!s || s.状态 !== "待接受" || Date.now() - s.创建 > PVP无动作超时毫秒) return null;
  return s;
}


export function PVP进行中(ctx, u) { const s = PVP找会话(ctx, u); return !!(s && s.状态 === "进行中"); }


export function PVP方我(s, u) { return s.a.u === u ? s.a : s.b; }


export function PVP方敌(s, u) { return s.a.u === u ? s.b : s.a; }


export function PVP侧出(s, u) { return s.a.u === u ? "a" : "b"; }


export function PVP对方名(s) { return s.行动方 === "a" ? s.a.昵称 : s.b.昵称; }


// 一侧玩家的战斗数据：满血开局（公平对局），属性 / 词条取真实快照（与 PVE 开战同一套）
// 3.2.0（需求 1/4）：蓝量走**全局**——开局继承各自当前蓝量，结算写回（PVP 不另开蓝量池）
export function PVP造方(ctx, x) {
  const p = attrs(ctx, x);
  const 上限 = 我血量上限(p);
  const 蓝顶 = Math.max(10, Number(p.蓝量上限) || (100 + p.等级 * 5));
  return {
    u: x, 昵称: p.昵称, 编号: p.编号,
    hp: 上限, hpMax: 上限,
    mp: Math.max(0, Math.min(蓝顶, Number(p.蓝量) || 0)), mpMax: 蓝顶,
    sp: 1, spMax: 技能点上限,
    攻: 攻击力(p), 防: p.防御, 暴击率: p.暴击率, 暴伤: p.暴伤, 闪避: p.闪避,
    词条: p.词条 || {}
  };
}


export function PVP清尾(ctx, s) {
  const 表 = PVP全表(ctx);
  delete 表.待定[s.a.u]; delete 表.待定[s.b.u];
  delete 表.会话[s.id];
  PVP存表(ctx, 表);
}


// 发起：星甲挑战#目标（@某人 / 编号 / 名字）
export async function PVP发起(ctx, t, u, 目标串, ev) {
  if (await 修甲拦截(ctx, t, u)) return;
  // 5 分钟前的残留会话 / 请求先自愈
  const 已 = PVP找会话(ctx, u);
  if (已 && Date.now() - 已.最后动作 > PVP无动作超时毫秒) {
    已.状态 = "已结束"; 已.结果 = "超时";
    PVP清尾(ctx, 已);
    await reply(ctx, t, "你上一场玩家挑战超过 5 分钟无动作，已自动结束，可以重新发起。", { 标题: "⚔️ 玩家挑战" });
  } else if (已) {
    await reply(ctx, t, "你已在一场玩家挑战中（vs " + PVP方敌(已, u).昵称 + "），先打完或 `星甲逃跑`。", {
      标题: "⚔️ 玩家挑战", 行组: [row(btn("pvpi1", "战斗面板", "战斗"), btn("pvpi2", "逃跑判负", "逃跑"))]
    });
    return;
  }
  const 旧战斗 = 战斗记录(ctx, u);
  if (旧战斗 && !旧战斗.结果) {
    await reply(ctx, t, "你还有一场没打完的副本 / BOSS 战斗，先打完再挑战玩家。", {
      标题: "⚔️ 玩家挑战", 行组: [row(actBtn("pvpi3", "⚡继续战斗", "xgpanel"), btn("pvpi4", "逃跑", "逃跑"))]
    });
    return;
  }
  const key = S(目标串).trim().replace(/^@/, "");
  if (!key) {
    await reply(ctx, t, "用法：`星甲挑战#目标`（@某人 / 编号 / 名字）。\n例：`星甲挑战#5`、`星甲挑战#张三`", { 标题: "⚔️ 玩家挑战" });
    return;
  }
  let tu = byGid(ctx, key) || "";
  if (!tu) {
    const 全 = players(ctx);
    tu = 全.filter((x) => ds(ctx, P.昵称, x, "") === key)[0]
      || 全.filter((x) => ds(ctx, P.昵称, x, "").indexOf(key) >= 0)[0]
      || "";
  }
  if (!tu && ev && S(ev.mention_openid) && hasAcc(ctx, ev.mention_openid)) tu = S(ev.mention_openid);
  if (!tu) { await reply(ctx, t, "找不到玩家【" + escMd(key) + "】。可以用编号（`星甲挑战#5`）、名字或 @对方。", { 标题: "⚔️ 玩家挑战" }); return; }
  if (tu === u) { await reply(ctx, t, "不能挑战自己。", { 标题: "⚔️ 玩家挑战" }); return; }
  if (!hasAcc(ctx, tu)) { await reply(ctx, t, "对方还没开号，先让对方发 `星甲注册`。", { 标题: "⚔️ 玩家挑战" }); return; }
  if (PVP找待定(ctx, tu)) { await reply(ctx, t, "对方手上已有一封待处理的战书，等TA同意 / 拒绝后再来。", { 标题: "⚔️ 玩家挑战" }); return; }
  const s = {
    id: "P" + Date.now().toString(36) + Math.floor(Math.random() * 10000).toString(36),
    发起者: u, 状态: "待接受",
    a: PVP造方(ctx, u), b: PVP造方(ctx, tu),
    轮: 0, 行动方: "a", 日志: [],
    创建: Date.now(), 最后动作: Date.now(), 结果: ""
  };
  const 表 = PVP全表(ctx);
  表.会话[s.id] = s; 表.待定[tu] = s.id;
  PVP存表(ctx, 表);
  pushLog(ctx, u, "发起玩家挑战 → " + s.b.昵称 + "（#" + s.b.编号 + "）");
  await reply(ctx, t, [
    "⚔️ **" + s.a.昵称 + "（#" + s.a.编号 + "）** 向 **" + s.b.昵称 + "（#" + s.b.编号 + "）** 下战书！",
    "",
    "双方按真实属性回合制互攻（单刀 ≤ 对方血量上限 " + Math.round(PVP单刀上限比例 * 100) + "%），",
    "普攻 / 技能 / 治疗 / 逃跑沿用现有战斗指令，5 分钟无动作自动作废。",
    "",
    "请 **" + s.b.昵称 + "** 点击按钮响应（5 分钟内有效）："
  ].join("\n"), {
    标题: "⚔️ 玩家挑战 · 等待应战",
    行组: [row(btn("pvpr1", "✅ 同意应战", "pvp同意#" + s.id), btn("pvpr2", "❌ 拒绝", "pvp拒绝#" + s.id))]
  });
}


// 应战 / 拒绝（只有被挑战的人能点；同意后进入回合制，发起者先手）
export async function PVP响应(ctx, t, u, id, 同意) {
  const 表 = PVP全表(ctx);
  const s = 表.会话[S(id)] || PVP找待定(ctx, u);
  if (!s || s.状态 !== "待接受") { await reply(ctx, t, "这封战书已过期或不存在（5 分钟内有效）。", { 标题: "⚔️ 玩家挑战" }); return; }
  if (s.b.u !== u) { await reply(ctx, t, "这封战书不是发给你的，由 **" + s.b.昵称 + "** 来响应。", { 标题: "⚔️ 玩家挑战" }); return; }
  const 旧战斗 = 战斗记录(ctx, u);
  if (同意 && 旧战斗 && !旧战斗.结果) {
    await reply(ctx, t, "你还有一场没打完的副本 / BOSS 战斗，先处理完再应战。", { 标题: "⚔️ 玩家挑战" });
    return;
  }
  delete 表.待定[u];
  if (!同意) {
    s.状态 = "已结束"; s.结果 = "已拒绝";
    PVP存表(ctx, 表);
    pushLog(ctx, u, "拒绝玩家挑战（来自 " + s.a.昵称 + "）");
    await reply(ctx, t, "❌ **" + s.b.昵称 + "** 拒绝了 **" + s.a.昵称 + "** 的挑战。", { 标题: "⚔️ 玩家挑战" });
    return;
  }
  s.状态 = "进行中"; s.最后动作 = Date.now();
  PVP存表(ctx, 表);
  pushLog(ctx, u, "接受玩家挑战（来自 " + s.a.昵称 + "）");
  await PVP渲染(ctx, t, s, "⚔️ 挑战开始！" + s.a.昵称 + " 先手，每次出手后自动换人。");
}


// 发起者撤销还没被响应的战书
export async function PVP取消(ctx, t, u) {
  const 表 = PVP全表(ctx);
  for (const id of Object.keys(表.会话)) {
    const s = 表.会话[id];
    if (s && s.状态 === "待接受" && s.a.u === u) {
      s.状态 = "已结束"; s.结果 = "已取消";
      delete 表.待定[s.b.u]; delete 表.会话[id];
      PVP存表(ctx, 表);
      await reply(ctx, t, "已撤销对 **" + s.b.昵称 + "** 的挑战。", { 标题: "⚔️ 玩家挑战" });
      return;
    }
  }
  await reply(ctx, t, "你没有等待响应的战书。", { 标题: "⚔️ 玩家挑战" });
}


// PVP 面板：双方血条 / 蓝条 / 剩余% / 回合数 + 本轮战况（沿用 灰混 + 统一按钮构造）
export async function PVP渲染(ctx, t, s, 头) {
  const 行 = [];
  if (头) 行.push([头], [""]);
  行.push(["第 " + s.轮 + " 回合 · 轮到【" + PVP对方名(s) + "】出手（⏱ 剩 " + Math.max(0, Math.ceil((PVP无动作超时毫秒 - (Date.now() - s.最后动作)) / 1000)) + " 秒无动作即作废）"]);
  行.push([""]);
  for (const 侧 of ["a", "b"]) {
    const x = s[侧];
    const 百 = x.hpMax > 0 ? Math.max(0, Math.round((x.hp / x.hpMax) * 100)) : 0;
    行.push(["【" + x.昵称 + "（#" + x.编号 + "）】" + (s.行动方 === 侧 ? "◀️ 行动方" : "")]);
    行.push(["　血量 " + kfmt(x.hp) + " / " + kfmt(x.hpMax) + "（剩 " + 百 + "%）　" + 条带(x.hp, x.hpMax)]);
    行.push(["　蓝量 " + x.mp + " / " + x.mpMax + " · 技能点 " + (Number(x.sp) || 0) + " / " + x.spMax]);
    行.push([""]);
  }
  const 日志 = Array.isArray(s.日志) ? s.日志.slice(-6) : [];
  if (日志.length) { 行.push(["本轮战况："]); for (const x of 日志) 行.push(["　" + x]); }
  else 行.push(["（刚开打，还没交手）"]);
  await reply(ctx, t, 灰混(行), {
    标题: "⚔️ 玩家挑战 " + s.a.昵称 + " vs " + s.b.昵称,
    行组: [
      row(btn("pvpa1", "普攻", "普攻"), btn("pvpa2", "技能1", "技能1"), btn("pvpa3", "技能3", "技能3"), btn("pvpa4", "技能5", "技能5")),
      row(btn("pvpa5", "治疗", "治疗"), btn("pvpa6", "逃跑判负", "逃跑"), btn("pvpa7", "属性", "属性"), btn("pvpa8", "菜单", "菜单"))
    ]
  });
}


// PVP 治疗：真实消耗背包药品（与 PVE 自动服药同一套数值），不占出手回合
export function PVP服药(ctx, u, 方) {
  const 缺 = Math.max(0, 方.hpMax - 方.hp);
  const 有药 = 药品集.filter((nm) => 药品回血[nm] > 0 && hasItem(ctx, u, nm) > 0);
  if (缺 <= 0 || !有药.length) return { 药: "", 回: 0 };
  const 顺序 = 有药.slice().sort((a, b) => (药品回血[a] || 0) - (药品回血[b] || 0));
  let 回 = 0; const 用了 = {};
  for (const nm of 顺序) {
    while (hasItem(ctx, u, nm) > 0 && 回 < 缺) {
      takeItem(ctx, u, nm, 1);
      回 += 药品回血[nm] || 60;
      用了[nm] = (用了[nm] || 0) + 1;
    }
    if (回 >= 缺) break;
  }
  回 = Math.min(回, 缺);
  方.hp = Math.min(方.hpMax, 方.hp + 回);
  return { 药: Object.keys(用了).map((k) => k + "×" + 用了[k]).join("+"), 回 };
}


// 回合行动：act = atk / skill / heal / flee（沿用现有战斗指令，路由层拦截进来）
export async function PVP行动(ctx, t, u, act, 档位) {
  const s = PVP找会话(ctx, u);
  if (!s) { await reply(ctx, t, "当前没有进行中的玩家挑战。发 `星甲挑战#目标` 发起一场。", { 标题: "⚔️ 玩家挑战" }); return; }
  if (s.状态 === "待接受") {
    await reply(ctx, t, "战书还没被应战（发给 **" + PVP方敌(s, u).昵称 + "**，5 分钟内有效）。", {
      标题: "⚔️ 玩家挑战", 行组: [row(btn("pvpw1", "撤销战书", "pvp取消"))]
    });
    return;
  }
  // 5 分钟无动作自动结束（不计胜负、无奖励）
  if (Date.now() - s.最后动作 > PVP无动作超时毫秒) {
    s.状态 = "已结束"; s.结果 = "超时";
    PVP清尾(ctx, s);
    pushLog(ctx, u, "玩家挑战超时结束（" + s.a.昵称 + " vs " + s.b.昵称 + "）");
    await reply(ctx, t, "⏱ 超过 5 分钟无动作，玩家挑战自动结束（不计胜负、无奖励）。", { 标题: "⚔️ 玩家挑战 · 已作废" });
    return;
  }
  const 我 = PVP方我(s, u), 敌 = PVP方敌(s, u);
  const 侧 = PVP侧出(s, u);
  if (s.行动方 !== 侧) {
    await reply(ctx, t, "还没轮到你，当前轮到【" + PVP对方名(s) + "】出手。", { 标题: "⚔️ 玩家挑战" });
    return;
  }
  // 逃跑 = 判负（PVP 直接结算，不掷骰子）
  if (act === "flee") {
    s.状态 = "已结束"; s.结果 = "逃跑";
    await PVP结算(ctx, t, s, 敌.u, 我.u, 我.昵称 + " 逃跑，判负。");
    return;
  }
  // 操作冷却 3 秒（2.7.0 起；与 PVE 手动出招一致）
  const 余 = 剩操作冷却(ctx, u);
  if (余 > 0) { await reply(ctx, t, "操作太快了，请等 **" + (余 / 1000).toFixed(1) + "** 秒再出手。", { 标题: "⏳ 操作冷却" }); return; }
  if (act === "heal") {
    if (我.hp >= 我.hpMax) { await reply(ctx, t, "你的血量已满，不需要治疗。", { 标题: "⚔️ 玩家挑战" }); return; }
    const 治 = PVP服药(ctx, u, 我);
    if (!治.药) { await reply(ctx, t, "你没有药品了。\n可以用 `星甲商店` 买血瓶，或硬着头皮继续打。", { 标题: "⚔️ 玩家挑战", 行组: [row(btn("pvpw2", "商店买药", "商店"), btn("pvpw3", "普攻", "普攻"))] }); return; }
    设操作冷却(ctx, u);
    s.行动方 = 侧 === "a" ? "b" : "a";
    s.最后动作 = Date.now();
    const 日志 = Array.isArray(s.日志) ? s.日志 : [];
    日志.push("💊 " + 我.昵称 + " 用【" + 治.药 + "】治疗 +" + kfmt(治.回) + "（" + 我.hp + "/" + 我.hpMax + "）");
    s.日志 = 日志.slice(-10);
    PVP保存(ctx, s);
    await PVP渲染(ctx, t, s, "");
    return;
  }
  let 倍 = 1, 模式名 = "普通攻击";
  if (act === "skill") {
    // 3.0.0（需求 25/26）：PVP 也改用「职业专属技能」——按出手方自己的职业取技能组
    const 职名 = 读职业(ctx, 我.u) || "剑修";
    const 职业 = 职业表.filter((x) => x.名 === 职名)[0] || 职业表[0];
    const 技组 = (职业 && 职业.技能) || [];
    const 档 = Math.max(1, Math.min(技组.length || 1, Math.floor(Number(档位) || 1)));
    const 技 = 技组[档 - 1] || { 名: "普攻", 倍: 1, 耗: 0 };
    if ((Number(我.sp) || 0) < 技.耗) {
      await reply(ctx, t, [
        (读职业(ctx, 我.u) ? "技能点不足：【" + 技.名 + "】（" + Math.round(技.倍 * 100) + "%）需要 **" + 技.耗 + "** 点。" : "你还没转职，没有职业技能（发 `星甲转职 剑修`）。"),
        "当前技能点：" + (Number(我.sp) || 0) + " / " + 我.spMax,
        "",
        "普通攻击每次 +1 技能点。"
      ].join("\n"), { 标题: "⚔️ 技能点不足", 行组: [row(btn("pvpw4", "普攻+1点", "普攻"))] });
      return;
    }
    我.sp = (Number(我.sp) || 0) - 技.耗;
    // 3.0.0：职业技能同时耗蓝（与 PVE 一致）
    // 3.2.0（需求 3/4）：蓝不够 → 先自动喝蓝药（便宜优先、常开不可关）；没蓝药 → 提醒并禁止放技能（普攻仍可）
    const 蓝耗 = Math.max(0, Number(技.蓝) || 0);
    if (蓝耗 > 0) {
      if ((Number(我.mp) || 0) < 蓝耗) {
        const 补 = 自动喝蓝药(ctx, u, 我, 蓝耗);
        if (!补.ok) {
          我.sp = (Number(我.sp) || 0) + 技.耗;   // 没蓝放不出来 → 技能点退回
          PVP保存(ctx, s);
          await reply(ctx, t, [
            "蓝量不足：【" + 技.名 + "】需要 " + 蓝耗 + " 蓝（你有 " + (Number(我.mp) || 0) + "）。",
            "",
            "⚠️ " + 没蓝提醒 + "（自动回蓝已尝试：背包里没有能补够的蓝药）",
            "· 商店可买：青霜灵液（150 星羽 / 瓶，+50 蓝）、幽泉灵乳（500 星羽 / 瓶，+200 蓝）",
            "· 现在只能普攻（每次回复 5 蓝）；买好蓝药后发 `使用青霜灵液`"
          ].join("\n"), { 标题: "🔵 没有蓝了，需要买蓝药", 行组: [row(btn("pvpw5", "普攻", "普攻"), btn("pvpw6", "商店", "商店"))] });
          return;
        }
        if (补.药) { const 日志0 = Array.isArray(s.日志) ? s.日志 : []; 日志0.push("🔵 " + 我.昵称 + " 自动喝蓝药【" + 补.药 + "】+" + 补.回 + " → " + 我.mp + "/" + 我.mpMax); s.日志 = 日志0.slice(-10); }
      }
      我.mp = Math.max(0, (Number(我.mp) || 0) - 蓝耗);
    }
    倍 = 技.倍; 模式名 = 技.名;
  } else {
    我.sp = Math.min(我.spMax, (Number(我.sp) || 0) + 1);
    我.mp = Math.min(Number(我.mpMax) || 0, (Number(我.mp) || 0) + 5);
  }
  s.轮 = (Number(s.轮) || 0) + 1;
  const 日志 = Array.isArray(s.日志) ? s.日志 : [];
  // 出手结算：敌方 = 玩家真实属性（词条快照），不传 敌方:true → 无 PVE 三档狂暴
  const r = 伤害结算(
    { 攻: 我.攻, 暴击率: 我.暴击率, 暴伤: 我.暴伤, 词条: 我.词条 || {}, hp: 我.hp, hpMax: 我.hpMax },
    { 攻: 敌.攻, 防: 敌.防, 暴击率: 敌.暴击率, 暴伤: 敌.暴伤, 词条: 敌.词条 || {}, hp: 敌.hp, hpMax: 敌.hpMax },
    倍, "PVP"
  );
  if (r.闪避) {
    日志.push("✦" + 敌.昵称 + "闪避成功，" + 我.昵称 + "造成了0 伤害");
  } else {
    // PVP 独立防秒杀：主伤 + 追击合计 ≤ 对方血量上限 35%（不碰 PVE 的 单刀上限()）
    const 顶 = Math.max(1, Math.round(敌.hpMax * PVP单刀上限比例));
    const 追值 = r.追击 > 0 ? Math.round(r.追击) : 0;
    const 合 = Math.max(1, Math.round(r.主 + 追值));
    const 实伤 = Math.min(合, 顶);
    const 显示追 = Math.min(追值, 实伤);
    const 显示主 = Math.max(1, 实伤 - 显示追);
    敌.hp = Math.max(0, 敌.hp - 实伤);
    if (r.吸血 > 0) 我.hp = Math.min(我.hpMax, 我.hp + r.吸血);
    // 2.9.12：PVP 与 PVE 同一套 ✦/✧ 战报格式（主语为双方昵称）
    日志.push((r.暴 ? "✧" : "✦") + 我.昵称 + "对" + 敌.昵称 + "造成了 " + 大数(显示主)
      + (r.真伤 ? (r.暴 ? " 点真实暴击伤害" : " 点真实伤害") : (r.暴 ? " 暴击伤害" : " 伤害"))
      + "，" + 敌.昵称 + " 剩 " + Math.max(0, Math.round((敌.hp / 敌.hpMax) * 100)) + "%");
    if (显示追 > 0) 日志.push("✦" + 我.昵称 + "对" + 敌.昵称 + "造成了 " + 大数(显示追) + " 追击伤害(" + Math.round(显示追 / 显示主 * 100) + "%)");
    if (r.吸血 > 0) 日志.push("✦" + 我.昵称 + "吸了" + 敌.昵称 + " " + 大数(r.吸血) + " 点血");
  }
  // 守方的 反击 / 闪击 / 反伤 词条打回攻方，同样受 PVP 单刀上限
  for (const f of (r.反伤 || [])) {
    const 顶 = Math.max(1, Math.round(我.hpMax * PVP单刀上限比例));
    const 实 = Math.min(Math.max(1, Math.round(f.伤害)), 顶);
    我.hp = Math.max(0, 我.hp - 实);
    if (f.类型 === "闪击") 日志.push("✦" + 敌.昵称 + "发动了闪击进行弹反", (f.暴 ? "✧" : "✦") + 敌.昵称 + "对" + 我.昵称 + "造成了 " + 大数(实) + " 点闪击" + (f.暴 ? "真实暴击" : "") + "伤害");
    else if (f.类型 === "反击") 日志.push("✦" + 敌.昵称 + "发动了反击，减免了" + 大数(实) + "伤害，并对" + 我.昵称 + "造成了" + 大数(实) + "伤害");
    else 日志.push("✦" + 敌.昵称 + "发动了反伤，" + 我.昵称 + "受到 " + 大数(实) + " 反弹伤害");
  }
  我.mp = Math.min(我.mpMax, 我.mp + 5);
  s.行动方 = 侧 === "a" ? "b" : "a";
  s.最后动作 = Date.now();
  设操作冷却(ctx, u);
  if (我.hp <= 0) { s.状态 = "已结束"; s.结果 = "结算"; await PVP结算(ctx, t, s, 敌.u, 我.u, ""); return; }
  if (敌.hp <= 0) { s.状态 = "已结束"; s.结果 = "结算"; await PVP结算(ctx, t, s, 我.u, 敌.u, ""); return; }
  s.日志 = 日志.slice(-10);
  PVP保存(ctx, s);
  await PVP渲染(ctx, t, s, "");
}


// 结算：胜者拿战利品（星羽从败者身上抢 5%，经验按等级，30% 概率 1 星核），败者真实血量归零
export async function PVP结算(ctx, t, s, 胜者, 败者, 前言) {
  const 日志 = Array.isArray(s.日志) ? s.日志 : [];
  s.日志 = 日志.slice(-10);
  PVP保存(ctx, s);
  // 3.2.0（需求 1/4）：PVP 结束 → 双方蓝量都写回全局（PVP 不再单独维护蓝量池）
  try { 战斗蓝量写回(ctx, s.a.u, s.a); 战斗蓝量写回(ctx, s.b.u, s.b); } catch (e) { /* 蓝量写回失败不影响结算 */ }
  const 胜p = attrs(ctx, 胜者), 败p = attrs(ctx, 败者);
  const 抢 = Math.max(50, Math.floor((Number(败p.星羽) || 0) * 0.05));
  addCoin(ctx, 败者, -抢);
  addCoin(ctx, 胜者, 抢);
  const xp = 60 + Math.floor((Number(胜p.等级) || 1) * 10);
  const up = 加经验(ctx, 胜者, xp);
  let 核行 = "";
  if (Math.random() < 0.3) { addCore(ctx, 胜者, 1); 核行 = " · 星核 +1"; }
  设血量(ctx, 败者, 0);   // 被打死：真实存档血量归零，修甲 / 吃药恢复
  recPwr(ctx, 胜者);
  pushLog(ctx, 胜者, "玩家挑战获胜 vs " + 败p.昵称 + "（" + s.轮 + " 回合，+" + kfmt(抢) + " 星羽）");
  pushLog(ctx, 败者, "玩家挑战落败 vs " + 胜p.昵称 + "（" + s.轮 + " 回合，-" + kfmt(抢) + " 星羽）");
  await reply(ctx, t, [
    前言 || "",
    "🏆 **" + 胜p.昵称 + "（#" + 胜p.编号 + "）** 击败了 **" + 败p.昵称 + "（#" + 败p.编号 + "）**！（" + s.轮 + " 回合）",
    "",
    "战利品：星羽 +" + kfmt(抢) + " · 经验 +" + xp + (up.升级 ? " · 升级 → Lv." + up.等级 : "") + 核行,
    "败者血量归零：发 `星甲修复战甲` 或使用药品恢复。"
  ].filter((x) => x !== "").join("\n"), {
    标题: "⚔️ 玩家挑战 · 结算",
    行组: [row(btn("pvpe1", "再战一场", "星甲挑战#" + 败p.编号), btn("pvpe2", "排行榜", "排行榜"), btn("pvpe3", "菜单", "菜单"))]
  });
  PVP清尾(ctx, s);
}


// 2.6.0（安全）：openid 打码 —— 只有「本人 / 主人」才看得到完整值
export function 打码id(id) {
  const s = S(id);
  if (s.length <= 8) return s ? s.slice(0, 2) + "****" : "";
  return s.slice(0, 4) + "****" + s.slice(-4);
}


export async function queryId(ctx, t, 查者, id) {
  const x = byGid(ctx, S(id));
  if (!x) { await reply(ctx, t, "找不到编号 " + S(id) + "。", { 标题: "🔍 查询" }); return; }
  const p = attrs(ctx, x);
  // 2.6.0（安全）：原来这里无条件输出 `用户ID：<完整 openid>`，
  //   任何玩家都能从 1 号开始遍历把所有 openid 抓走，再配合「云国绑定」复制别人账号。
  //   现在：本人或主人看完整值，其他人只看到打码结果。
  const 本人 = S(查者) && S(x) === S(查者);
  const 可看 = 本人 || 是最高权限(ctx, 查者) || ownerList(ctx).indexOf(S(查者)) >= 0;
  await reply(ctx, t, [
    "目标编号：" + p.编号,
    "游戏ID：" + p.编号,
    "用户ID：" + (可看 ? x : 打码id(x) + "（已打码）"),
    "昵称：" + p.昵称,
    "等级：" + p.等级 + " · 战力：" + pwrOf(ctx, x),
    "阵营：" + (ds(ctx, P.联盟, x, "") || "无")
  ].join("\n"), { 标题: "🔍 编号查询" });
}


export async function queryUser(ctx, t, key) {
  const k = S(key);
  if (!k) { await reply(ctx, t, "用法：`查用户#openid` 或 `查用户#昵称`", { 标题: "🔍 查询" }); return; }
  if (hasAcc(ctx, k)) {
    await reply(ctx, t, ["游戏ID：" + gid(ctx, k), "用户ID：" + k, "昵称：" + ds(ctx, P.昵称, k, "无名")].join("\n"), { 标题: "🔍 用户查询" });
    return;
  }
  const hit = players(ctx).filter((x) => ds(ctx, P.昵称, x, "").indexOf(k) >= 0).slice(0, 10);
  if (!hit.length) { await reply(ctx, t, "没有找到匹配「" + escMd(k) + "」的玩家。", { 标题: "🔍 查询" }); return; }
  await reply(ctx, t, hit.map((x) => "#" + gid(ctx, x) + " " + ds(ctx, P.昵称, x, "无名") + " · Lv." + dn(ctx, P.等级, x, 1) + " · 战力 " + pwrOf(ctx, x)).join("\n"), { 标题: "🔍 用户查询" });
}


export function rankTitle(ctx, u) {
  const p = attrs(ctx, u);
  const table = [
    [0, 0, "见习新兵"], [0, 10, "列兵"], [0, 20, "上等兵"], [1, 1, "下士"], [1, 20, "中士"],
    [2, 1, "上士"], [2, 30, "少尉"], [3, 1, "中尉"], [4, 1, "上尉"], [5, 1, "少校"], [6, 1, "中校"], [8, 1, "上校"]
  ];
  let name = "见习新兵";
  for (const r of table) if (p.转生 >= r[0] && p.等级 >= r[1]) name = r[2];
  return name;
}


export async function rankShow(ctx, t, u) {
  const p = attrs(ctx, u);
  await reply(ctx, t, [
    "军衔：**" + rankTitle(ctx, u) + "**",
    "等级 " + p.等级 + " · 转生 " + p.转生 + " · 强化 " + p.强化,
    "战力 " + pwrOf(ctx, u),
    "",
    "军衔随等级与转生提升。"
  ].join("\n"), {
    标题: "🎖️ 军衔", 行组: [row(actBtn("rk_a", "⚡看属性", "info"), btn("rk_b", "排行榜", "排行榜"), btn("rk_c", "副本", "副本"))]
  });
}


export function noteNick(ctx, u, nick) {
  const name = S(nick);
  if (!name) return;
  const v = dget(ctx, P.昵称记录, u, []);
  const list = Array.isArray(v) ? v : [];
  if (list[0] && list[0].昵称 === name) return;
  list.unshift({ 昵称: name, 时间: fmt() });
  dset(ctx, P.昵称记录, u, list.slice(0, 20));
}


export async function nickHistory(ctx, t, u) {
  const v = dget(ctx, P.昵称记录, u, []);
  const list = Array.isArray(v) ? v : [];
  await reply(ctx, t, list.length ? list.map((x, i) => (i + 1) + ". " + x.昵称 + "（" + x.时间 + "）").join("\n") : "暂无昵称记录。", { 标题: "📛 昵称历史" });
}



/* ============================================================
 * 十一、音乐（点歌 / 收藏）/ B站解析
 * ============================================================ */
export const SRC = ["QQ", "汽水", "酷我", "网易云"];
