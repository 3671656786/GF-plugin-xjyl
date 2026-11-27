// lib/game/team.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S, dget, dn, dset, rnd } from "./../core/base.mjs?v=v1795804978535";
import { actBtn, btn, reply, row, 蓝字, 蓝链 } from "./../core/qq.mjs?v=v1795804978535";
import { P } from "./../core/util.mjs?v=v1795804978535";
import { 队伍上限 } from "././equip.mjs?v=v1795804978535";
import { attrs, gid, pwrOf } from "././player.mjs?v=v1795804978535";
import { DG, dgFind } from "././progress.mjs?v=v1795804978535";
import { 修甲中, 修甲拦截 } from "././rebirth.mjs?v=v1795804978535";
import { 灰混 } from "././cook.mjs?v=v1795804978535";
   // 2.2.3：BOSS 最多 10 人组队（普通副本同样允许，人多清得快）
export function 队伍表(ctx) { const v = dget(ctx, P.队伍, "队伍", {}); return v && typeof v === "object" ? v : {}; }


export function 存队伍表(ctx, o) { dset(ctx, P.队伍, "队伍", o); }


export function 队成员(tm) { return [S(tm && tm.队长)].concat(Array.isArray(tm && tm.成员) ? tm.成员 : []).filter(Boolean); }


export function 找我的队伍(ctx, u) {
  const all = 队伍表(ctx);
  for (const id of Object.keys(all)) {
    const tm = all[id];
    if (!tm || typeof tm !== "object") continue;
    if (S(tm.队长) === u) return { 号: id, 队: tm };
    if (Array.isArray(tm.成员) && tm.成员.indexOf(u) >= 0) return { 号: id, 队: tm };
  }
  return null;
}


export async function 创建队伍(ctx, t, u, id) {
  if (await 修甲拦截(ctx, t, u)) return;
  const d = dgFind(id);
  if (!d) { await reply(ctx, t, "没有编号 " + S(id) + " 的副本。发 `副本` 看列表。", { 标题: "组队失败", 按钮: [btn("tm0", "副本列表", "副本")] }); return; }
  if (找我的队伍(ctx, u)) { await reply(ctx, t, "你已经在一个队伍里了。", { 标题: "组队失败", 按钮: [btn("tm1", "我的队伍", "我的队伍"), btn("tm2", "退出队伍", "退出队伍")] }); return; }
  const p = attrs(ctx, u);
  if (d.转 && p.转生 < d.转) {
    await reply(ctx, t, "【" + d.名 + "】需要 " + d.转 + " 次转生，你当前 " + p.转生 + " 次。", { 标题: "组队失败" });
    return;
  }
  if (p.等级 < d.段) {
    // 2.2.0：低级玩家点「组队#高段副本」时，自动换成他当前能打的最强副本（而不是直接失败）
    const 可打 = DG.filter((x) => p.等级 >= x.段 && (!x.转 || p.转生 >= x.转)).sort((a, b) => b.段 - a.段)[0];
    if (!可打) {
      await reply(ctx, t, [
        "**不能上高级的组队**：队长必须达到副本等级。",
        "【" + d.名 + "】要求 " + d.段 + " 级，你当前 " + p.等级 + " 级。",
        "",
        "先去 `打坐` / `探索` 升级，或让等级够的玩家开队，你 `加入队伍#队号`。"
      ].join("\n"), {
        标题: "组队失败",
        行组: [row(btn("tm3", "副本列表", "副本"), actBtn("tm4", "⚡打坐", "meditate"), btn("tm5", "菜单", "菜单"))]
      });
      return;
    }
    await reply(ctx, t, "【" + d.名 + "】需要 " + d.段 + " 级（你 " + p.等级 + " 级）。\n已自动改为你能打的最强副本：【" + 可打.id + "】" + 可打.名 + "。", { 标题: "🛡️ 已自动调整" });
    await 创建队伍(ctx, t, u, 可打.id);
    return;
  }
  const all = 队伍表(ctx);
  let 号 = "";
  for (let i = 0; i < 60; i++) { const c = String(rnd(1000, 9999)); if (!all[c]) { 号 = c; break; } }
  if (!号) 号 = String(Date.now()).slice(-4);
  all[号] = { 队长: u, 队长昵称: p.昵称, 成员: [], 副本: d.id, 创建: Date.now() };
  存队伍表(ctx, all);
  await reply(ctx, t, [
    "## 队伍已创建",
    "",
    "队号：**" + 号 + "**（发给队友）",
    "目标" + (d.BOSS ? "BOSS" : "副本") + "：【" + d.id + "】" + d.名 + " · " + d.段 + "级段 · 推荐 " + d.力,
    "队长：" + p.昵称 + "（Lv." + p.等级 + "）· 成员 1/" + 队伍上限,
    "",
    "**规则**：队友等级不能高于队长（不能上高级的组队），比队长低的一律可以带。",
    d.BOSS ? "3.0.0：BOSS / 副本敌人数值全部固定（只由段位决定），组队不再按队内总血量放大。" : "",
    "队友发 `加入队伍#" + 号 + "` 上车，你发 `队伍挑战` 出发。"
  ].filter((x) => x !== "").join("\n"), {
    标题: "🛡️ 组队成功",
    行组: [
      row(btn("tm6", "加入", "加入队伍#" + 号), btn("tm7", "我的队伍", "我的队伍"), actBtn("tm8", "⚡队伍挑战", "teamfight"), btn("tm9", "退出队伍", "退出队伍"))
    ]
  });
}


export async function 加入队伍(ctx, t, u, 号) {
  if (await 修甲拦截(ctx, t, u)) return;
  if (找我的队伍(ctx, u)) { await reply(ctx, t, "你已经在队伍里了。", { 标题: "加入失败", 按钮: [btn("tm10", "我的队伍", "我的队伍")] }); return; }
  const all = 队伍表(ctx);
  const key = S(号);
  const tm = key ? all[key] : null;
  if (!tm || typeof tm !== "object") {
    const 开放 = Object.keys(all).filter((k) => all[k] && typeof all[k] === "object");
    await reply(ctx, t, [
      "没有找到队伍" + (key ? " " + key : "") + "。",
      开放.length ? "当前队伍：`加入队伍#" + 开放[0] + "`" : "（当前没有开放的队伍，自己 `组队#13` 开一个）"
    ].join("\n"), {
      标题: "加入失败",
      行组: [row(btn("tm11", "开新队", "组队#13"), btn("tm12", "副本列表", "副本"), btn("tm13", "菜单", "菜单"))]
    });
    return;
  }
  const 队长等级 = dn(ctx, P.等级, tm.队长, 1);
  const 我等级 = dn(ctx, P.等级, u, 1);
  if (我等级 > 队长等级) {
    await reply(ctx, t, [
      "**不能上高级的组队**。",
      "队长 " + S(tm.队长昵称) + " Lv." + 队长等级 + " · 你 Lv." + 我等级,
      "",
      "规则：队员等级不能高于队长（队长只能带低级队友）。",
      "想打更高级的副本，请自己 `组队#编号` 当队长。"
    ].join("\n"), {
      标题: "加入失败",
      行组: [row(btn("tm14", "自己开队", "组队#13"), btn("tm15", "菜单", "菜单"))]
    });
    return;
  }
  const 成员 = Array.isArray(tm.成员) ? tm.成员 : [];
  if (成员.length + 1 >= 队伍上限) {
    await reply(ctx, t, "队伍已满（" + 队伍上限 + " 人）。", { 标题: "加入失败", 按钮: [btn("tm16", "自己开队", "组队#13")] });
    return;
  }
  成员.push(u);
  tm.成员 = 成员;
  all[key] = tm;
  存队伍表(ctx, all);
  const d = dgFind(tm.副本);
  await reply(ctx, t, [
    "已加入队伍 **" + key + "**",
    "目标" + (d && d.id >= 200 ? "BOSS" : "副本") + "：【" + tm.副本 + "】" + (d ? d.名 : "?") + " · 队长 " + S(tm.队长昵称) + "（编号 " + gid(ctx, tm.队长) + "）",
    "当前成员 " + (成员.length + 1) + "/" + 队伍上限,
    "",
    "等队长发 `队伍挑战` 就可以一起打了。"
  ].join("\n"), {
    标题: "🛡️ 加入成功",
    行组: [row(btn("tm17", "我的队伍", "我的队伍"), btn("tm18", "退出队伍", "退出队伍"), btn("tm19", "菜单", "菜单"))]
  });
}


// P8：按「队长编号」加入队伍 —— `加入boss组队#队长编号` / `加入副本组队#队长编号`
//   （旧口令 `加入队伍#队号` 原样保留；队长编号 = 玩家编号，组队面板会显示队类型与队长编号）
export async function 加入队伍按编号(ctx, t, u, 队长编号, 要BOSS) {
  if (await 修甲拦截(ctx, t, u)) return;
  const 号0 = S(队长编号);
  const 类型名 = 要BOSS ? "BOSS" : "副本";
  if (!号0) {
    await reply(ctx, t, "用法：`" + (要BOSS ? "加入boss组队" : "加入副本组队") + "#队长编号`（队长编号 = 玩家编号，见组队面板）。", { 标题: "加入失败" });
    return;
  }
  const all = 队伍表(ctx);
  let 目标号 = "";
  for (const k of Object.keys(all)) {
    const tm = all[k];
    if (!tm || typeof tm !== "object") continue;
    if (S(gid(ctx, tm.队长)) !== 号0) continue;
    const d = dgFind(tm.副本);
    if (!!(d && d.id >= 200) === 要BOSS) { 目标号 = k; break; }
  }
  if (!目标号) {
    // 该队长有队但类型不符 → 提示实际类型；完全没有 → 提示先开队
    const 他的队号 = Object.keys(all).filter((k) => all[k] && typeof all[k] === "object" && S(gid(ctx, all[k].队长)) === 号0)[0];
    if (他的队号) {
      const d = dgFind(all[他的队号].副本);
      await reply(ctx, t, [
        "编号 **" + 号0 + "** 的队伍是【" + (d && d.id >= 200 ? "BOSS 组队" : "副本组队") + "】，不是 " + 类型名 + " 组队。",
        "",
        "想加入它就发 `" + (d && d.id >= 200 ? "加入boss组队#" + 号0 : "加入副本组队#" + 号0) + "`，或 `加入队伍#" + 他的队号 + "`。"
      ].join("\n"), { 标题: "加入失败", 按钮: [btn("tm45", "我的队伍", "队伍")] });
      return;
    }
    await reply(ctx, t, "没有找到编号 **" + 号0 + "** 当队长的" + 类型名 + "队伍。\n让队长先 `组队#" + (要BOSS ? "201" : "13") + "` 开队，或用 `加入队伍#队号` 直接上车。", { 标题: "加入失败" });
    return;
  }
  await 加入队伍(ctx, t, u, 目标号);
}


export async function 队伍面板(ctx, t, u) {
  const 我 = 找我的队伍(ctx, u);
  const all = 队伍表(ctx);
  if (!我) {
    const 可加 = Object.keys(all).filter((k) => all[k] && 队成员(all[k]).length < 队伍上限);
    // P8：可加入列表带上队类型与队长编号（`加入boss组队#队长编号` / `加入副本组队#队长编号`）
    const 可加入文本 = 可加.length
      ? 可加.map((k) => {
          const tm = all[k];
          const dd = dgFind(tm.副本);
          return 蓝字("加入队伍#" + k, "队伍" + k) + "（" + (dd && dd.id >= 200 ? "BOSS" : "副本") + "·队长 " + gid(ctx, tm.队长) + "）";
        }).join("  ")
      : "（当前没有开放的队伍）";
    await reply(ctx, t, 灰混([
      ["▍队伍状态", false],
      ["当前**没有队伍** · 自己开队或加入队友的队", true],
      ["", true],
      ["▍怎么组队", false],
      ["`组队#13` 自己当队长（新人本）· `加入队伍#队号` 加入队友 · `队伍挑战` 队长发起 · `退出队伍` 离开", true],
      ["BOSS 也能组队：`星甲组队#205`，公式一样，敌人不放大（最高 30 回合）", true],
      ["", true],
      ["▍等级规则", false],
      ["队长须达副本段位 · 队员不能高于队长（可带低级）· 每队最多 " + 队伍上限 + " 人", true],
      ["", true],
      ["▍当前可加入", false],
      [可加入文本, true],
      ["", true],
      ["▍操作", false],
      [蓝链([["组队#101", "组队101"], ["队伍挑战", "队伍挑战"], ["退出队伍", "退出队伍"], ["副本", "副本"], ["星甲菜单", "菜单"]]), true]
    ]), {
      标题: "🛡️ 队伍",
      行组: [row(btn("tm20", "组队101", "组队#101"), btn("tm21", "组队#1", "组队#1"), btn("tm22", "副本", "副本"), btn("tm23", "星甲菜单", "星甲菜单"))]
    });
    return;
  }
  const d = dgFind(我.队.副本);
  const 成员 = 队成员(我.队);
  const 行 = [
    ["▍队伍 #" + 我.号, false],
    [(d && d.id >= 200 ? "BOSS 组队" : "副本组队") + " · 目标【" + 我.队.副本 + "】" + (d ? d.名 + " · " + d.段 + "级段" : "?"), true],
    ["队长 " + S(我.队.队长昵称) + " Lv." + dn(ctx, P.等级, 我.队.队长, 1) + (我.队.队长 === u ? "（你）" : "") + " · 编号 " + gid(ctx, 我.队.队长), true],
    ["", true],
    ["▍成员 " + 成员.length + "/" + 队伍上限, false]
  ];
  for (const m of 成员) {
    const pm = attrs(ctx, m);
    行.push([(m === 我.队.队长 ? "👑 " : "· ") + pm.昵称 + " Lv." + pm.等级 + " · 战力 " + pwrOf(ctx, m) + " · 血 " + pm.血量 + "/" + pm.血量上限 + (修甲中(ctx, m) ? " · 修甲中" : ""), true]);
  }
  行.push(["", true], [我.队.队长 === u ? "队友发 `加入队伍#" + 我.号 + "` 上车；你发 `队伍挑战` 出发" : "等队长发 `队伍挑战` 出发", true]);
  await reply(ctx, t, 灰混(行), {
    标题: "🛡️ 我的队伍",
    行组: [
      row(actBtn("tm24", "⚡队伍挑战", "teamfight"), btn("tm25", "副本列表", "副本"), btn("tm26", "退出队伍", "退出队伍"), btn("tm27", "菜单", "菜单"))
    ]
  });
}


export async function 退出队伍(ctx, t, u) {
  const all = 队伍表(ctx);
  const 我 = 找我的队伍(ctx, u);
  if (!我) { await reply(ctx, t, "你当前没有队伍。", { 标题: "退出队伍", 按钮: [btn("tm28", "组队#13", "组队#13")] }); return; }
  if (S(我.队.队长) === u) {
    delete all[我.号];
    存队伍表(ctx, all);
    await reply(ctx, t, "队伍 **" + 我.号 + "** 已解散（你是队长）。", { 标题: "🛡️ 已解散", 按钮: [btn("tm29", "副本", "副本"), btn("tm30", "菜单", "菜单")] });
    return;
  }
  const 成员 = (Array.isArray(我.队.成员) ? 我.队.成员 : []).filter((x) => x !== u);
  我.队.成员 = 成员;
  all[我.号] = 我.队;
  存队伍表(ctx, all);
  await reply(ctx, t, "已退出队伍 **" + 我.号 + "**。", { 标题: "🛡️ 已退出", 按钮: [btn("tm31", "副本", "副本"), btn("tm32", "菜单", "菜单")] });
}


/* ---------- 2.5.22 BOSS 血量公式 ----------
 * 单体：BOSS血量 = 基础血量 + 玩家血量上限 × 血量倍率
 * 组队：BOSS血量 = 基础血量 + 队内玩家总血量上限 × 血量倍率
 * 2.9.1：倍率 10 → 3。×10 时 BOSS 实战血量被「玩家血量项」主导（占比 >80%），
 *   同档单刷变成纯粹的磨血长跑且高段位必输；×3 后基础血量占比回升，战斗时长合理。
 */
export const 血量倍率 = 3;


// 2.8.0（需求 12）：普通副本（DG 条目里没有 血/攻/防）原来全是 0 → 打不动也打不死。
//   现在按条目的「力」补一套基础属性，BOSS（有 血 字段）维持原来的算法。
export const 副本血系数 = 2;

        // 副本基础血量 = 力 × 2
export const 副本攻系数 = 0.13;

     // 副本攻击 = 力 × 0.13
export const 副本防系数 = 0.10;

     // 副本防御 = 力 × 0.10
export const 副本血量倍率 = 0;
