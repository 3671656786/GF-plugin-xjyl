// lib/game/player.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { 读控制台配置 } from "./../admin/admin.mjs?v=v1795255847401";
import { S, dall, dget, dn, ds, dset, fileOf, kfmt, n, pushLog, rnd, root, ymd, 版本 } from "./../core/base.mjs?v=v1795255847401";
import { 蓝链 } from "./../core/qq.mjs?v=v1795255847401";
import { 暴击率上限 } from "./../core/rules.mjs?v=v1795255847401";
import { P, P旧 } from "./../core/util.mjs?v=v1795255847401";
import { 商店表 } from "././dungeon.mjs?v=v1795255847401";
import { hallList, hallSave } from "././econ.mjs?v=v1795255847401";
import { 槽项, 装备加成, 装备槽, 迁移装备等级, 道具说明表 } from "././equip.mjs?v=v1795255847401";
import { DROPS, GOODS, strCount, xpNeed, 目录道具名, 等级无上限, 菜品集 } from "././farm.mjs?v=v1795255847401";
import { rankTitle } from "././pvp.mjs?v=v1795255847401";
import { players } from "././alliance.mjs?v=v1795255847401";
import { 药品集, 装备定义 } from "././rebirth.mjs?v=v1795255847401";
import { 星灵加成, 星灵状态 } from "././star.mjs?v=v1795255847401";
import { 天下楼记录 } from "././tower.mjs?v=v1795255847401";
import fs from "node:fs";
import path from "node:path";

export let _道具集缓存 = null;
export function 清道具集缓存() { _道具集缓存 = null; }


export function allItems() {
  const 动态可用 = typeof 商店表 !== "undefined" && Array.isArray(商店表);
  const 键 = 动态可用 ? 商店表.length + "|" + 药品集.length : "";
  if (_道具集缓存 && _道具集缓存.键 === 键) return _道具集缓存.表;
  const set = {};
  const push = (nm) => { const x = S(nm); if (x) set[x] = 1; };
  GOODS.forEach((x) => push(x.名));
  DROPS.forEach(push);
  菜品集.forEach(push);
  药品集.forEach(push);
  Object.keys(道具说明表).forEach(push);
  if (动态可用) 商店表.forEach((x) => push(x.名));
  const 表 = Object.keys(set);
  _道具集缓存 = { 键: 键, 表: 表 };
  return 表;
}


// 2.5.17：读「我持有的全部道具」= 静态道具集 ∪ 道具目录里实际存在的文件
export function 我的道具集(ctx, u) {
  const 名 = allItems().slice();
  const 已 = {};
  名.forEach((x) => { 已[x] = 1; });
  for (const nm of 目录道具名(ctx)) if (!已[nm]) { 已[nm] = 1; 名.push(nm); }
  return 名.map((x) => ({ 名: x, 数量: hasItem(ctx, u, x) })).filter((x) => x.数量 > 0);
}


export function itemKey(name) { return name === "改名卡" ? "改名次数" : name; }


export function itemPrice(name) { const g = GOODS.filter((x) => x.名 === name)[0]; return g ? g.价 : 0; }


// 旧版道具分散在两个目录，且改名卡存为「改名次数」——读取时全部兼容
export const 道具目录表 = ["游戏数据/星舰数据/道具系统/", "游戏数据/星舰数据/道具/"];


export function 道具路径候选(name) {
  const key = itemKey(name);
  const names = key === name ? [name] : [key, name];
  const out = [];
  for (const d of 道具目录表) for (const n of names) out.push(d + n + ".json");
  return out;
}


export function 读道具值(ctx, u, name) {
  for (const rel of 道具路径候选(name)) {
    const v = dget(ctx, rel, u, null);
    if (v !== null && v !== undefined) return Number(v) || 0;
  }
  return null;
}


// 2.5.45：**彻底移除**的道具（当前只有「幸运护符」）
//   一旦列在这里：① hasItem 恒为 0（背包/道具面板/使用/赠送 全部看不到它）
//                ② giveItem 拒绝发放（掉落 / 任务 / 商店 / 交易行 任何路径都发不出来）
//                ③ plugin_init 会做一次性数据清理（见 清理已移除道具）
export const 已移除道具 = ["幸运护符"];


export function 是已移除道具(name) { return 已移除道具.indexOf(S(name)) >= 0; }


export function hasItem(ctx, u, name) {
  if (是已移除道具(name)) return 0;                    // 2.5.45：已删除的道具视为「从来没有过」
  const v = 读道具值(ctx, u, name);
  if (v !== null) return v;
  return (name === "改名卡" || name === "刷新卡") ? 1 : 0;
}


export function giveItem(ctx, u, name, count) {
  if (是已移除道具(name)) return 0;                    // 2.5.45：已删除的道具不再发放
  const cur = hasItem(ctx, u, name);
  const next = Math.max(0, cur + Math.floor(count));
  // 写回已存在的旧文件；都不存在则写到 道具系统/
  for (const rel of 道具路径候选(name)) {
    try { if (fs.existsSync(fileOf(ctx, rel))) { dset(ctx, rel, u, next); return next; } } catch (e) { /* ignore */ }
  }
  dset(ctx, "游戏数据/星舰数据/道具系统/" + itemKey(name) + ".json", u, next);
  return next;
}


export function takeItem(ctx, u, name, count) {
  if (hasItem(ctx, u, name) < count) return false;
  giveItem(ctx, u, name, -count);
  return true;
}


/* ---------- 2.5.45 一次性清理「已移除道具」的历史残留 ----------
 * 需求：道具彻底删除后，背包里已经有的不能留幽灵数据。
 * 做法：遍历该道具的所有历史存储文件（`道具系统/` 与 `道具/` 两个目录、含旧键名），
 *      把每个玩家的数量**先备份**到 `游戏数据/星舰数据/已移除道具回收/`，
 *      再把原文件整体写成 `{}`（彻底清空，不留 0 值残留）。
 * 只执行一次：用 `P.道具清理标记` 记版本号，之后每次启动直接跳过（不重复清、不重复备份）。
 */
// 2.9.2：清理标记与「插件版本号」解耦 —— 原来用 版本 当标记，一升级 版本 就会把整套清理再跑一遍
export const 道具清理版本 = "2.5.45";


export function 清理已移除道具(ctx) {
  const 已做 = ds(ctx, P.道具清理标记, "版本", "");
  if (已做 === 道具清理版本) return { 跳过: true, 报告: [] };
  const 报告 = [];
  for (const nm of 已移除道具) {
    const 文件们 = [];
    for (const rel of 道具路径候选(nm)) {
      try { const f = fileOf(ctx, rel); if (fs.existsSync(f)) 文件们.push({ rel: rel, f: f }); } catch (e) { /* ignore */ }
    }
    const 快照 = {};
    const 人集 = {};
    let 总 = 0;
    for (const it of 文件们) {
      const o = dall(ctx, it.rel);
      for (const k of Object.keys(o)) {
        const c = Math.floor(Number(o[k]) || 0);
        if (c <= 0) continue;
        快照[k] = (Number(快照[k]) || 0) + c;
        总 += c; 人集[k] = 1;
      }
    }
    if (总 > 0) {
      try {
        const dir = fileOf(ctx, P.已移除道具回收);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, nm + "_" + 版本 + ".json"), JSON.stringify(快照, null, 2), "utf8");
      } catch (e) {
        if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 备份已移除道具失败:", nm, e);
      }
    }
    for (const it of 文件们) {
      try { fs.writeFileSync(it.f, "{}", "utf8"); } catch (e) {
        if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 清理已移除道具失败:", it.rel, e);
      }
    }
    报告.push(nm + (总 > 0 ? "：清除 " + Object.keys(人集).length + " 人 / 共 " + 总 + " 个（已备份）" : "：无残留"));
    // 交易行挂单也要清掉 —— 否则买家付了星羽却因为「道具已删除」拿不到货
    try {
      const list = hallList(ctx);
      const 剩 = list.filter((g) => !是已移除道具(g && g.道具));
      if (剩.length !== list.length) {
        hallSave(ctx, 剩);
        报告.push(nm + "：交易行下架 " + (list.length - 剩.length) + " 条挂单");
      }
    } catch (e) { /* 交易行不可用就跳过 */ }
  }
  dset(ctx, P.道具清理标记, "版本", 道具清理版本);
  if (ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 已移除道具清理 → " + 报告.join("；"));
  return { 跳过: false, 报告: 报告 };
}


export function hasAcc(ctx, u) { return ds(ctx, P.开号, u, "未") === "已"; }


export function gid(ctx, u) { return ds(ctx, P.游戏ID, u, "") || "未编号"; }


export function byGid(ctx, key) {
  const k = S(key);
  if (!k) return "";
  // 2.5.3 修复：原来用 dget(ctx, rel, null, {}) 读整表，dget 不支持「整表读取」→ 永远返回 {}，
  //   导致主人菜单里输入游戏编号（如 1011）总报「找不到编号」。改用 dall 真读整表。
  const map = dall(ctx, P.游戏ID);
  for (const u of Object.keys(map)) if (S(map[u]) === k) return u;
  const all = dall(ctx, P.开号);
  if (all[k] !== undefined) return k;
  return "";
}


/* ---------- 2.8.0（需求 10 / 11）属性字段合并 + 旧存档一次性迁移 ----------
 * · 火力 → 攻击力：旧「火力」不再独立存在，一次性 `攻击 = 攻击 + 火力`，之后火力清零。
 * · 耐久 / 耐久上限 → 血量 / 血量上限：两者本来就是同一个数值（血量），只是统一命名，
 *   存档文件随之改名（耐久.json → 血量.json、耐久上限.json → 血量上限.json）。
 * 幂等保证（三重）：
 *   ① 全服迁移用 `P.属性迁移标记` 记版本号，跑过就不再跑；
 *   ② 单人迁移也记同一个版本号；
 *   ③ 即使标记丢失，迁移会把旧的 火力 置空、旧 耐久 文件置空 —— 第二次跑读不到旧值，不会重复加。
 */
export const 属性迁移版本 = "2.8.0";


export function 迁移属性字段(ctx, u) {
  if (!u) return false;
  if (ds(ctx, P.属性迁移标记, u, "") === 属性迁移版本) return false;
  // ① 火力 → 攻击力（旧值只在「存在且 > 0」时才加，加完立刻清空 → 重复执行不会重复加）
  const 火 = dget(ctx, P旧.火力, u, undefined);
  if (火 !== undefined && 火 !== null) {
    const 火数 = Math.floor(Number(火) || 0);
    if (火数 > 0) dset(ctx, P.攻击, u, Math.max(1, dn(ctx, P.攻击, u, 200) + 火数));
    dset(ctx, P旧.火力, u, null);
  }
  // ② 耐久上限 → 血量上限（取两者较大值），耐久 → 血量（新文件没有值时才搬）
  const 旧上 = dget(ctx, P旧.血量上限, u, undefined);
  if (旧上 !== undefined && 旧上 !== null) {
    const v = Math.floor(Number(旧上) || 0);
    const 现上 = dget(ctx, P.血量上限, u, undefined);
    dset(ctx, P.血量上限, u, Math.max(v, Math.floor(Number(现上 === undefined || 现上 === null ? 0 : 现上) || 0)) || v);
    dset(ctx, P旧.血量上限, u, null);
  }
  const 旧血 = dget(ctx, P旧.血量, u, undefined);
  if (旧血 !== undefined && 旧血 !== null) {
    const 现 = dget(ctx, P.血量, u, undefined);
    if (现 === undefined || 现 === null) dset(ctx, P.血量, u, Math.floor(Number(旧血) || 0));
    dset(ctx, P旧.血量, u, null);
  }
  dset(ctx, P.属性迁移标记, u, 属性迁移版本);
  return true;
}


// 全服一次性迁移（plugin_init 调用）：把旧文件里所有玩家都搬一遍，然后写版本标记
export function 迁移属性字段全服(ctx) {
  if (ds(ctx, P.属性迁移标记, "版本", "") === 属性迁移版本) return { 跳过: true, 人数: 0 };
  const 人 = new Set();
  for (const rel of [P旧.火力, P旧.血量, P旧.血量上限]) {
    for (const k of Object.keys(dall(ctx, rel))) if (S(k)) 人.add(k);
  }
  let 人数 = 0;
  for (const u of 人) { try { 迁移属性字段(ctx, u); 人数 += 1; } catch (e) { /* 单人失败不拖垮全服 */ } }
  dset(ctx, P.属性迁移标记, "版本", 属性迁移版本);
  if (人数 && ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 属性字段迁移（火力→攻击力 / 耐久→血量）完成：" + 人数 + " 人");
  return { 跳过: false, 人数: 人数 };
}


export function newAcc(ctx, u, nick) {
  const no = dn(ctx, P.账号总数, "总数", 9999) + 1;
  dset(ctx, P.账号总数, "总数", no);
  dset(ctx, P.开号, u, "已");
  dset(ctx, P.游戏ID, u, String(no));
  dset(ctx, P.昵称, u, S(nick).slice(0, 12) || "新兵");
  dset(ctx, P.等级, u, 1);
  dset(ctx, P.经验, u, 0);
  dset(ctx, P.星羽, u, 500);
  dset(ctx, P.星核, u, 0);
  // 2.8.0：原「攻击 200 + 火力 80~120」合并为一个攻击力（数值不变，只是不再有两个字段）
  dset(ctx, P.攻击, u, 200 + rnd(80, 120));
  dset(ctx, P.血量上限, u, 500);
  dset(ctx, P.血量, u, 500);
  dset(ctx, P.暴击, u, 0);
  dset(ctx, P.闪避, u, 0);
  dset(ctx, P.防御, u, 100);
  dset(ctx, P.金币, u, 0);
  dset(ctx, P.暴击率, u, 5);
  dset(ctx, P.暴伤, u, 150);
  dset(ctx, P.转生, u, 0);
  dset(ctx, P.强化, u, 0);
  return String(no);
}


export function ensureAcc(ctx, u, nick) {
  if (!u) return { 新: false, 编号: "" };
  if (hasAcc(ctx, u)) return { 新: false, 编号: gid(ctx, u) };
  return { 新: true, 编号: newAcc(ctx, u, nick) };
}


/* ============================================================
 * 2.8.0（需求 1）词条系统 —— 15 条，全部在 attrs() 里落成
 * ------------------------------------------------------------
 * · 数值型（3 条）：攻击力 / 防御力 / 生命 —— 就是「基础值 + 装备/称号/星灵加成」后的最终值。
 * · 百分比型（12 条）：全部按 0 ~ 100（或 0 ~ 上限）存，面板显示 xx.xx% + 一句说明。
 * · 「有数值 = 这条词条的上限」：百分比类默认封顶 100%，真伤 / 吸血 / 追击伤害 等按需求给的默认上限。
 * · 来源只有三个：**装备词条**（武器 / 护甲）、**称号**、**星灵**。
 *   不给任何人默认全有 —— 一件装备 / 一个称号没带来，面板就是 0.00%。
 * ============================================================ */
export const 词条定义 = [
  { 键: "攻击力", 类型: "数值", 上限: 0, 说明: "基础攻击力 + 装备 / 称号 / 星灵加成后的最终值" },
  { 键: "防御力", 类型: "数值", 上限: 0, 说明: "基础防御力 + 装备 / 称号 / 星灵加成后的最终值" },
  { 键: "生命", 类型: "数值", 上限: 0, 说明: "血量上限 = 基础 + 装备 / 称号 / 星灵加成" },
  { 键: "闪避率", 类型: "百分比", 上限: 40, 说明: "触发后完全免除这次伤害（封顶 40%）" },
  { 键: "真伤概率", 类型: "百分比", 上限: 60, 说明: "命中时按概率无视对方防御（伤害 = 攻击力 × 暴伤%）" },
  { 键: "吸血", 类型: "百分比", 上限: 50, 说明: "造成伤害后按比例回血，单次最多回自身血量上限的 30%" },
  { 键: "精准打击", 类型: "百分比", 上限: 30, 说明: "按概率抵消对方的闪避，让这一击必定命中" },
  { 键: "复活率", 类型: "百分比", 上限: 50, 说明: "被击败时按概率满血复活，每场战斗只触发一次" },
  { 键: "重伤", 类型: "百分比", 上限: 80, 说明: "让对方从你身上吸到的血按比例减少" },
  { 键: "追击率", 类型: "百分比", 上限: 50, 说明: "主伤害结算后按概率再追加一次攻击" },
  { 键: "追击伤害", 类型: "百分比", 上限: 45, 说明: "追击那一击的伤害 = 主伤害 × 追击伤害%" },
  { 键: "抗暴率", 类型: "百分比", 上限: 35, 说明: "受到暴击时，伤害按该比例减少" },
  { 键: "闪击率", 类型: "百分比", 上限: 50, 说明: "自己闪避成功时，按概率额外打对方一次" },
  { 键: "反击率", 类型: "百分比", 上限: 35, 说明: "受到伤害时按概率反弹一次" },
  { 键: "反击伤害", 类型: "百分比", 上限: 40, 说明: "反击伤害 = 本次受到的伤害 × 反击伤害%" },
  // 3.0.0（需求 11）：BOSS 特殊属性池键（反伤率 / 狂暴真伤 / 真实暴击）—— 玩家侧也能通过传说装备 / 控制台激活拿到
  { 键: "反伤率", 类型: "百分比", 上限: 30, 说明: "受到伤害时按伤害的该比例反弹（与「反击」独立叠加）" },
  { 键: "狂暴真伤", 类型: "百分比", 上限: 30, 说明: "进入狂暴后，真伤概率额外增加该值" },
  { 键: "真实暴击", 类型: "百分比", 上限: 100, 说明: "真伤一击必定暴击（≥1 即生效）" }
];


export const 词条键表 = 词条定义.map((x) => x.键);


export const 百分比词条键 = 词条定义.filter((x) => x.类型 === "百分比").map((x) => x.键);


/* 3.0.0（需求 11）：玩家侧词条来源**全面开放** —— 15 条词条都能从「传说装备 / 称号 / 星灵 / 管理员激活」
 * 拿到，不再有「敬请期待」的锁定词条；因此这里 = 全部词条键（保留这个导出名只为兼容旧调用方）。
 * 上限仍然生效：词条汇总() 最后一步按 词条定义.上限 裁剪，装备侧 装备加成() 也裁一次。 */
export const 玩家可用词条键 = 词条键表.slice();


export function 词条上限(键) { const t = 词条定义.filter((x) => x.键 === 键)[0]; return t ? Number(t.上限) || 0 : 0; }


export function 裁剪词条(键, v) {
  const 上 = 词条上限(键);
  const x = Math.max(0, Number(v) || 0);
  return 上 > 0 ? Math.min(上, Math.round(x * 100) / 100) : Math.round(x * 100) / 100;
}


/* ============================================================
 * 2.9.8（需求 1）「敬请期待」词条的管理员手动激活（测试用）
 * ------------------------------------------------------------
 * · 15 条词条里只有 5 条玩家侧有来源，其余 10 条面板一直是灰色「敬请期待」。
 *   现在允许管理员在控制台**给指定玩家手动解禁任意一条**，撤销即恢复灰色。
 * · 存档：dataPath/系统/激活词条.json，结构 { [openid]: { 词条键: 数值 } }（只存解禁的那几条）。
 * · 生效：词条汇总() 把激活值并进汇总表（走正常上限裁剪）→ 面板显示正常色 + 战斗里真实生效。
 *   战斗本来就按 词条取(攻方, "吸血") 这类取值，所以解禁即参与计算，无需改战斗公式。
 * ============================================================ */
export const 激活词条默认数值 = 10;

   // 不指定数值时的默认激活强度（%），仍会被该词条上限裁剪
export function 玩家激活词条(ctx, u) {
  if (!u) return {};
  const v = dget(ctx, P.激活词条, u, null);
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}


export function 写玩家激活词条(ctx, u, 表) { dset(ctx, P.激活词条, u, 表); }


export function 词条已激活(ctx, u, 键) { return Object.prototype.hasOwnProperty.call(玩家激活词条(ctx, u), 键); }


// 激活：键必须是「词条定义」里的百分比型；数值可省略（默认 10）或填「满」= 该词条上限
export function 激活玩家词条(ctx, u, 键, 数值, 操作者) {
  const it = 词条定义.filter((x) => x.键 === String(键 || "").trim())[0];
  if (!it) return { ok: false, msg: "没有这个词条：" + S(键) + "（可用：" + 词条键表.join(" / ") + "）" };
  if (it.类型 !== "百分比") return { ok: false, msg: "【" + it.键 + "】是数值型词条，由属性直接决定，不需要手动激活" };
  const s = S(数值).trim();
  let v;
  if (!s || s === "满" || s === "max") v = 词条上限(it.键) || 激活词条默认数值;
  else { v = Number(s); if (!Number.isFinite(v)) return { ok: false, msg: "数值必须是数字，或填「满」" }; }
  const 值 = 裁剪词条(it.键, v);
  const 表 = 玩家激活词条(ctx, u);
  表[it.键] = 值;
  写玩家激活词条(ctx, u, 表);
  pushLog(ctx, S(操作者) || "网页后台", "激活词条 " + gid(ctx, u) + " 的【" + it.键 + "】= " + 值 + "%");
  return { ok: true, 键: it.键, 值: 值, 上限: it.上限 };
}


export function 撤销玩家词条(ctx, u, 键, 操作者) {
  const 表 = 玩家激活词条(ctx, u);
  const k = String(键 || "").trim();
  if (!Object.prototype.hasOwnProperty.call(表, k)) return { ok: false, msg: "该玩家没有激活【" + S(k) + "】" };
  delete 表[k];
  写玩家激活词条(ctx, u, 表);
  pushLog(ctx, S(操作者) || "网页后台", "撤销词条 " + gid(ctx, u) + " 的【" + S(k) + "】");
  return { ok: true, 键: k };
}


// 全表（控制台列「哪些玩家已激活」用）：{ [openid]: { 词条键: 数值 } }
export function 全部激活词条(ctx) { const o = dall(ctx, P.激活词条); return o && typeof o === "object" ? o : {}; }


/* 属性面板的 15 条词条文本：百分比型显示 xx.xx%（附上限与说明），数值型显示最终值
 * 3.0.0（需求 11）：取消「敬请期待」锁定区 —— 玩家侧来源已全面开放（传说装备 / 称号 / 星灵 / 管理员激活），
 *   15 条全部正常色显示，数值仍按 词条定义.上限 裁剪（词条汇总() ⑤）。
 *   第二个参数 激活表 只为向后兼容旧调用（控制台仍会传），不再参与「锁定 / 解锁」判断。
 */
export function 词条面板文本(p, 激活表) {
  const 词 = (p && p.词条) || {};
  const 行 = [];
  for (const it of 词条定义) {
    const 值 = Number(词[it.键]) || 0;
    if (it.类型 === "百分比") {
      行.push("　" + it.键 + "：" + 值.toFixed(2) + "%（上限 " + it.上限 + "%）　" + it.说明);
    } else if (it.键 === "生命") {
      行.push("　生命：" + kfmt(Math.max(1, Number(p && p.血量上限) || 0)) + "　血量：" + kfmt(Math.max(0, Number(p && p.血量) || 0)) + " / " + kfmt(Math.max(1, Number(p && p.血量上限) || 0)) + "　" + it.说明);
    } else {
      行.push("　" + it.键 + "：" + kfmt(值) + "　" + it.说明);
    }
  }
  return 行.join("\n");
}


// 星灵带来的词条（按等级解锁，量很小，属于长期养成）
// 2.9.2（P5 收尾）：10 条特殊词条玩家侧来源清零 —— 星灵只保留「闪避率」（真伤概率仅 BOSS 装备产出）
export function 星灵词条(等级) {
  const L = Math.max(0, Math.floor(Number(等级) || 0));
  const 每 = (n) => Math.floor(L / Math.max(1, n));
  return {
    闪避率: Math.min(6, 每(20) * 1)        // 每 20 级 +1%，封顶 6%
  };
}


// 汇总某个玩家的 15 条词条：装备（武器 + 护甲）+ 称号 + 星灵，最后按各自上限裁剪
export function 词条汇总(ctx, u, p) {
  const out = {};
  for (const k of 百分比词条键) out[k] = 0;
  // ① 装备词条
  const 槽 = 装备槽(ctx, u);
  for (const 类 of ["武器", "护甲"]) {
    const s = 槽项(槽, 类);
    if (!s) continue;
    const e = 装备定义(s.名);
    if (!e) continue;
    const 加 = 装备加成(e, s.强化);
    const 词 = (加 && 加.词条) || {};
    for (const k of Object.keys(词)) {
      if (out[k] === undefined) continue;      // 只收「已定义的词条」，防止脏数据
      out[k] += Number(词[k]) || 0;
    }
  }
  // ② 称号词条
  const 称 = 称号效果(ctx, u);
  const 称词 = (称 && 称.词条) || {};
  for (const k of Object.keys(称词)) {
    if (out[k] === undefined) continue;
    out[k] += Number(称词[k]) || 0;
  }
  // ②b 系统称号词条（P9：与定制称号共存；系统称号可多个，逐条叠加）
  for (const 名 of 系统称号列表(ctx, u)) {
    const t = 系统称号表.find((x) => x.名 === 名);
    const 词2 = (t && t.词条) || {};
    for (const k of Object.keys(词2)) {
      if (out[k] === undefined) continue;
      out[k] += Number(词2[k]) || 0;
    }
  }
  // ③ 星灵词条
  const 灵词 = 星灵词条(星灵状态(ctx, u).等级);
  for (const k of Object.keys(灵词)) {
    if (out[k] === undefined) continue;
    out[k] += Number(灵词[k]) || 0;
  }
  // ④ 闪避率 = 实际生效的闪避（基础闪避 + 装备 / 称号 / 星灵的闪避率词条，加算后由 ⑤ 裁剪到上限 40%）
  //   2.9.2 修复：原来是 Math.max(词条, p.闪避)，而 BOSS 装备同时又给「闪避(平值)」，
  //   平值永远盖住词条 → BOSS 装备的「闪避率」词条实质不生效（玩家反馈「拿了装备闪避率不涨」）。
  out.闪避率 = out.闪避率 + (Number(p && p.闪避) || 0);
  // ④b 真伤概率底值（控制台/主人可直接设，默认 0）
  out.真伤概率 = out.真伤概率 + (dn(ctx, P.真伤概率, u, 0) || 0);
  // ④c 2.9.8（需求 1）：管理员手动激活的词条（玩家侧原本拿不到的那 10 条）
  //   与装备 / 称号 / 星灵同源相加，再统一走 ⑤ 的上限裁剪 → 战斗里 p.吸血 / p.追击率 … 直接生效。
  const 激 = 玩家激活词条(ctx, u);
  for (const k of Object.keys(激)) {
    if (out[k] === undefined) continue;
    out[k] += Number(激[k]) || 0;
  }
  // ⑤ 上限裁剪
  for (const k of 百分比词条键) out[k] = 裁剪词条(k, out[k]);
  // ⑥ 数值型三条（直接取最终属性）
  out.攻击力 = Math.max(1, Number(p && p.攻击) || 1);
  out.防御力 = Math.max(0, Number(p && p.防御) || 0);
  out.生命 = Math.max(1, Number(p && p.血量上限) || 1);
  return out;
}


/* ============================================================
 * 3.0.0（需求 25）：职业存档
 *  · 路径：游戏数据/星舰数据/职业.json（util.mjs 的 P 表不在本批作用域，故常量放这里）
 *  · 结构：{ "<openid>": { 名: "剑修", 时间: 1730000000000 } }
 *  · 老存档没有该文件 / 没有该玩家的键 → 读作 ""（= 未转职），技能面板据此提示「先转职」
 *  · 职业表 / 技能表本身放在 cook.mjs（本文件不 import cook，避免循环依赖）
 * ============================================================ */
export const 职业路径 = "游戏数据/星舰数据/职业.json";


export function 读职业(ctx, u) {
  const v = dget(ctx, 职业路径, u, null);
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return S(v.名);          // 3.0.0 结构：{ 名, 时间 }
  return S(v);                                        // 兼容「直接存职业名」的老写法
}


export function 设职业(ctx, u, 名) {
  const s = S(名);
  if (!s) { dset(ctx, 职业路径, u, null); return ""; }
  dset(ctx, 职业路径, u, { 名: s, 时间: Date.now() });
  return s;
}


export function 清职业(ctx, u) { dset(ctx, 职业路径, u, null); }


/* ============================================================
 * 3.2.0（需求 1）：蓝量改为**全局资源**（不再是「战斗内资源」）
 * ------------------------------------------------------------
 * · 存档：游戏数据/星舰数据/蓝量.json = { "<openid>": 当前蓝量 }
 *   （util.mjs 的 P 表不在本批作用域，常量放这里，与 职业路径 同一套处理方式）
 * · 上限 = 100 + 等级 × 5（沿用 3.0.0 战斗内口径）+ 装备 / 称号加成
 *   （当前版本装备 / 称号都还没有蓝量来源 → 加成恒 0，口径先留好，加字段即生效）
 * · 老存档没有该文件 / 没有该玩家的键 → **按满蓝初始化**（读时不落盘，第一次写才算建库）
 * · 战斗：开战继承当前值（rec.mp）、战斗结束由 战斗蓝量写回() 落回全局
 * ============================================================ */
export const 蓝量路径 = "游戏数据/星舰数据/蓝量.json";


// 蓝量上限的加成部分（装备 + 称号）。当前版本两者都没有蓝量来源，恒 0；口径预留。
export function 蓝量加成(ctx, u, p) {
  const 基 = 100 + Math.max(0, Math.floor(Number(p && p.等级) || 0)) * 5;
  let 加 = 0;
  // ① 装备自带的蓝量字段（装备定义里目前没有 蓝量，按强化 +2%/级 放大的写法已就位）
  try {
    const 槽 = 装备槽(ctx, u);
    for (const 类 of ["武器", "护甲"]) {
      const s = 槽项(槽, 类);
      if (!s) continue;
      const e = 装备定义(s.名);
      if (!e) continue;
      加 += Math.max(0, Math.round((Number(e.蓝量) || 0) * (1 + 0.02 * Math.max(0, Number(s.强化) || 0))));
    }
  } catch (e) { /* 装备读取失败不影响基础蓝量 */ }
  // ② 称号「蓝」百分比（称号表 / 系统称号表里目前都没有该键 → 倍率恒 1）
  const 倍 = Number(称号倍(ctx, u, "蓝")) || 1;
  if (倍 > 1) 加 += Math.round(基 * (倍 - 1));
  return Math.max(0, 加);
}


// 蓝量上限：传 attrs() 出来的 p 最准（p.蓝量加成 已在 attrs 里算好）；传 { 等级 } 也能用
export function 蓝量上限(p) {
  const 基 = 100 + Math.max(0, Math.floor(Number(p && p.等级) || 0)) * 5;
  return Math.max(10, 基 + Math.max(0, Math.round(Number(p && p.蓝量加成) || 0)));
}


// 读全局蓝量：上限必须由调用方给（避免 attrs ↔ 读蓝量 互相递归）；越界 / 脏档一律夹回 [0, 上限]
export function 读蓝量(ctx, u, 上限) {
  const 顶 = Math.max(10, Math.floor(Number(上限) || 0) || 100);
  const v = dget(ctx, 蓝量路径, u, null);
  if (v === null || v === undefined) return 顶;              // 老存档：满蓝初始化
  const x = Math.floor(Number(v));
  if (!Number.isFinite(x)) return 顶;
  return Math.max(0, Math.min(顶, x));
}


// 写全局蓝量（clamp 到 [0, 上限]），返回实际落档值
export function 写蓝量(ctx, u, 值, 上限) {
  const 顶 = Math.max(10, Math.floor(Number(上限) || 0) || 蓝量上限(attrs(ctx, u)));
  const 实 = Math.max(0, Math.min(顶, Math.round(Number(值) || 0)));
  dset(ctx, 蓝量路径, u, 实);
  return 实;
}


// 战斗结束：把战斗记录里的蓝量写回全局（PVP / 天下楼 / 副本 / BOSS 共用）
export function 战斗蓝量写回(ctx, u, rec) {
  if (!rec || typeof rec !== "object") return null;
  const 顶 = Math.floor(Number(rec.mpMax) || 0);
  if (!(顶 > 0)) return null;
  return 写蓝量(ctx, u, rec.mp, 顶);
}


export function attrs(ctx, u) {
  // 2.5.5：老存档一次性迁移 —— 把「按装备名全局的强化等级」分给该名字的每一件
  迁移装备等级(ctx, u);
  // 2.8.0：旧存档字段迁移（火力 → 攻击力、耐久 → 血量），幂等
  迁移属性字段(ctx, u);
  const cap = dn(ctx, P.血量上限, u, 500);
  // 2.7.0（需求 4）：称号加成直接算进「最终属性」，属性面板 / 战力 / 战斗 / BOSS 缩放全部一致
  const 攻倍 = 称号倍(ctx, u, "攻"), 防倍 = 称号倍(ctx, u, "防"), 血倍 = 称号倍(ctx, u, "血");
  const 灵 = 星灵加成(ctx, u);   // 2.7.0（需求 5）：星灵按等级固定加 攻/防/血
  const 上限 = Math.max(1, Math.round(cap * 血倍) + 灵.血);
  const 现有 = dn(ctx, P.血量, u, 上限);
  const p = {
    u: u, 编号: gid(ctx, u), 昵称: ds(ctx, P.昵称, u, "无名"),
    称号: 称号名(ctx, u), 称号徽标: 称号徽标(ctx, u),
    // P9：系统称号（自动发放、可多个、带小加成），元素 {名, 稀有度}；与定制称号共存
    系统称号: 系统称号列表(ctx, u).map((名) => ({ 名: 名, 稀有度: 系统称号稀有度(名) })),
    等级: dn(ctx, P.等级, u, 1), 经验: dn(ctx, P.经验, u, 0),
    星羽: dn(ctx, P.星羽, u, 0), 存款: dn(ctx, P.存款, u, 0),
    星核: dn(ctx, P.星核, u, 0), 贡献: dn(ctx, P.贡献, u, 0),
    金币: dn(ctx, P.金币, u, 0),
    攻击: Math.max(1, Math.round(dn(ctx, P.攻击, u, 200) * 攻倍) + 灵.攻),
    防御: Math.max(0, Math.round(dn(ctx, P.防御, u, 100) * 防倍) + 灵.防),
    // 2.9.4（修血量显示异常）：这里再加一道兜底 —— 面板永远满足 0 ≤ 血量 ≤ 上限，
    //   旧存档 / 脏数据（负数或超过上限）一律被夹回来，不再直接显示出来。
    血量: Math.max(0, Math.min(现有, 上限)), 血量上限: 上限,
    暴击: dn(ctx, P.暴击, u, 0), 闪避: dn(ctx, P.闪避, u, 0),
    暴击率: dn(ctx, P.暴击率, u, 5), 暴伤: dn(ctx, P.暴伤, u, 150),
    转生: dn(ctx, P.转生, u, 0), 强化: dn(ctx, P.强化, u, 0),
    // 3.0.0（需求 25）：当前职业（"" = 未转职）；技能组由 cook.mjs 按职业查
    职业: 读职业(ctx, u)
  };
  // 2.8.0（需求 1）：15 条词条挂到属性上（p.词条 是完整表；百分比条同时挂到 p 上方便战斗直接取）
  p.词条 = 词条汇总(ctx, u, p);
  for (const k of 百分比词条键) p[k] = p.词条[k];
  // 3.2.0（需求 1）：蓝量改为全局资源 —— 属性卡 / 战斗面板 / PVP / 天下楼统一读这两个字段
  //   老存档没有 蓝量.json → 读蓝量() 按满蓝兜底；上限 = 100 + 等级×5 + 装备/称号加成
  p.蓝量加成 = 蓝量加成(ctx, u, p);
  p.蓝量上限 = 蓝量上限(p);
  p.蓝量 = 读蓝量(ctx, u, p.蓝量上限);
  return p;
}


export function pwrOf(ctx, u) {
  const p = attrs(ctx, u);
  // 2.8.0：火力已并入攻击力 → 原「火力×2 + 攻击×1.5」合并为「攻击×3.5」（数值不变）
  const base = p.攻击 * 3.5 + p.血量上限 + p.暴击 * 8 + p.闪避 * 8 + p.防御 * 1.2 + p.暴击率 * 20 + p.暴伤 * 2;
  return Math.floor(base * (1 + p.转生 * 0.35 + p.强化 * 0.18 + p.等级 * 0.02));
}


export function recPwr(ctx, u) {
  const v = pwrOf(ctx, u);
  dset(ctx, P.战力, u, v);
  try { 系统称号巡检(ctx, u); } catch (e) { /* 称号巡检失败不影响战力落档 */ }   // P9：战力破线自动授予
  return v;
}



/* ============================================================
 * 2.7.0 新增系统：称号 / 全服倍率 / 账号绑定（解绑·改绑·转移）/ 改编号
 * ============================================================ */
// ---------- 称号（需求 4）：默认没有称号，主人发放 ----------
// 效果都是小比例加成，靠叠加而不是单条逆天；掉落 = 装备/材料爆率加成。
// 2.8.0（需求 1）：称号除了原百分比加成，也带一小撮「词条」（词条是第三个来源）
export const 称号表 = [
  { 名: "新兵", 稀有度: "普通", 效果: { 攻: 1 }, 说明: "刚领到战甲的人，攻击 +1% · 精准打击 +2%" },
  { 名: "拾荒者", 稀有度: "普通", 效果: { 星羽: 2 }, 说明: "在废墟里翻出过好东西，星羽 +2% · 吸血 +1%" },
  { 名: "星港学徒", 稀有度: "普通", 效果: { 经验: 3 }, 说明: "考进了星港技校，经验 +3% · 抗暴率 +2%" },
  { 名: "赏金猎人", 稀有度: "稀有", 效果: { 攻: 3, 星羽: 3 }, 说明: "靠赏金吃饭，攻击 / 星羽 +3% · 真伤 +3% · 追击率 +2%" },
  { 名: "熔炉工匠", 稀有度: "稀有", 效果: { 防: 4, 血: 4 }, 说明: "在熔炉边练出的身板，防御 / 血量 +4% · 抗暴 +4% · 反击率 +3%" },
  { 名: "深空领航员", 稀有度: "稀有", 效果: { 经验: 5, 掉落: 3 }, 说明: "跑熟了深空航线，经验 +5%、掉落 +3% · 闪避 +2% · 闪击 +2%" },
  { 名: "战甲指挥官", 稀有度: "史诗", 效果: { 攻: 6, 防: 6 }, 说明: "带过队的人，攻击 / 防御 +6% · 追击 / 反击各 +4%" },
  { 名: "星核学者", 稀有度: "史诗", 效果: { 经验: 8, 星羽: 5 }, 说明: "研究星核的学者，经验 +8%、星羽 +5% · 精准 +6% · 抗暴 +5%" },
  { 名: "虚空行者", 稀有度: "史诗", 效果: { 血: 8, 掉落: 5 }, 说明: "在虚空里走过一遭，血量 +8%、掉落 +5% · 吸血 +5% · 复活 +3%" },
  { 名: "星辰领主", 稀有度: "传说", 效果: { 攻: 9, 防: 9, 血: 9 }, 说明: "统御一片星域，攻防血各 +9% · 真伤 / 重伤 / 抗暴各 +6%" },
  { 名: "天穹守望者", 稀有度: "传说", 效果: { 经验: 12, 星羽: 10 }, 说明: "守望天穹的人，经验 +12%、星羽 +10% · 复活 +5% · 闪击 +5%" },
  { 名: "永夜君王", 稀有度: "传说", 效果: { 攻: 12, 掉落: 8 }, 说明: "永夜的主人，攻击 +12%、掉落 +8% · 真伤 +8% · 吸血 +6%" },
  { 名: "星海霸主", 稀有度: "传说", 效果: { 攻: 14, 防: 12, 血: 12, 经验: 10 }, 说明: "星海霸主，攻 14% / 防 12% / 血 12% / 经验 10% · 追击 / 反击 +6%" },
  { 名: "起源见证者", 稀有度: "神话", 效果: { 攻: 15, 防: 15, 血: 15, 经验: 15, 星羽: 15, 掉落: 10 }, 说明: "见证起源者，全属性 +15%、掉落 +10% · 全套词条小幅加成" }
];


export const 称号名表 = 称号表.map((x) => x.名);


// P9：定制称号改为「任意文本、无加成、每人 1 个」—— 存什么显示什么；
//   只有名字命中 称号表 的老称号（主人按表发放的）才保留原有加成，任意文本无加成。
export function 称号名(ctx, u) { return S(ds(ctx, P.称号, u, "")); }


export function 设称号(ctx, u, 名) {
  const n = S(名).slice(0, 16);
  dset(ctx, P.称号, u, n);
  return 称号名(ctx, u);
}


export function 称号效果(ctx, u) {
  const 名 = 称号名(ctx, u);
  if (!名) return {};
  const t = 称号表.find((x) => x.名 === 名);
  // 2.8.0：把「词条」一起带出来（词条汇总会读它）；P5 收尾后称号表已不带词条，这里保留兼容
  return Object.assign({}, (t && t.效果) || {}, { 词条: (t && t.词条) || {} });
}


// 取某个效果键的倍率（1.05 = +5%），没称号/没该键就是 1
// P9：系统称号（可多个）与定制称号的加成**叠加**，一起算进「最终属性」
export function 称号倍(ctx, u, key) {
  const v = (Number(称号效果(ctx, u)[key]) || 0) + (Number(系统称号效果(ctx, u)[key]) || 0);
  return 1 + Math.max(0, v) / 100;
}


export function 称号徽标(ctx, u) {
  let out = "";
  const 名 = 称号名(ctx, u);
  if (名) {
    const t = 称号表.find((x) => x.名 === 名);
    const 星 = { 普通: "★", 稀有: "★★", 史诗: "★★★", 传说: "★★★★", 神话: "★★★★★" }[t ? t.稀有度 : "普通"] || "★";
    out += "【" + 名 + "】" + 星;
  }
  out += 系统称号徽标(ctx, u);   // P9：系统称号徽标（可多个）跟在定制称号后面
  return out;
}



/* ============================================================
 * P9 系统称号（自动发放 · 可多个 · 带小加成）
 * ------------------------------------------------------------
 * · 存档位：系统/系统称号.json（键 openid → 称号名数组）
 * · 自动发放：达成即授予、幂等不重复（挂 recPwr / 结算战斗 / 组队战报 / 天下楼结算 / 转生）
 * · 加成：每条 1%~5%，复用称号效果键（攻/防/血/经验/星羽/掉落），由 称号倍() 叠加进 attrs()
 * · 定制称号（P.称号）= 主人发放、任意文本、无加成、每人 1 个，两者共存
 * ============================================================ */
export const 系统称号表 = [
  { 名: "首战破军", 稀有度: "普通", 效果: { 攻: 1 }, 条件: "首次击败任意 BOSS" },
  { 名: "初露锋芒", 稀有度: "普通", 效果: { 攻: 2 }, 条件: "战力突破 1 万" },
  { 名: "名动星海", 稀有度: "稀有", 效果: { 防: 2 }, 条件: "战力突破 10 万" },
  { 名: "威震寰宇", 稀有度: "史诗", 效果: { 血: 3 }, 条件: "战力突破 100 万" },
  { 名: "登楼三十", 稀有度: "普通", 效果: { 防: 2 }, 条件: "天下楼到达 30 层" },
  { 名: "凌云六十", 稀有度: "史诗", 效果: { 血: 3 }, 条件: "天下楼到达 60 层" },
  { 名: "摘星九十", 稀有度: "传说", 效果: { 血: 5 }, 条件: "天下楼到达 90 层" },
  { 名: "涅槃重生", 稀有度: "稀有", 效果: { 经验: 2 }, 条件: "转生 1 次" },
  { 名: "三度轮回", 稀有度: "史诗", 效果: { 经验: 3 }, 条件: "转生 3 次" },
  { 名: "五蕴超脱", 稀有度: "传说", 效果: { 经验: 5 }, 条件: "转生 5 次" }
];


export const 系统称号名表 = 系统称号表.map((x) => x.名);


export function 系统称号列表(ctx, u) {
  const v = dget(ctx, P.系统称号, u, null);
  if (!Array.isArray(v)) return [];
  return v.map(S).filter((名) => 系统称号名表.indexOf(名) >= 0);
}


export function 系统称号稀有度(名) {
  const t = 系统称号表.find((x) => x.名 === S(名));
  return t ? t.稀有度 : "普通";
}


// 授予（幂等）：已有则返回 false，新授予返回 true
export function 授系统称号(ctx, u, 名) {
  const n = S(名);
  if (系统称号名表.indexOf(n) < 0) return false;
  const cur = dget(ctx, P.系统称号, u, null);
  const arr = Array.isArray(cur) ? cur.map(S) : [];
  if (arr.indexOf(n) >= 0) return false;
  arr.push(n);
  dset(ctx, P.系统称号, u, arr);
  pushLog(ctx, u, "获得系统称号【" + n + "】");
  return true;
}


// 系统称号加成合计（%）：各称号效果键求和，称号倍() 会消费
export function 系统称号效果(ctx, u) {
  const out = {};
  for (const 名 of 系统称号列表(ctx, u)) {
    const t = 系统称号表.find((x) => x.名 === 名);
    if (!t) continue;
    for (const k of Object.keys(t.效果 || {})) out[k] = (Number(out[k]) || 0) + (Number(t.效果[k]) || 0);
  }
  return out;
}


export function 系统称号徽标(ctx, u) {
  return 系统称号列表(ctx, u).map((名) => {
    const 星 = { 普通: "★", 稀有: "★★", 史诗: "★★★", 传说: "★★★★", 神话: "★★★★★" }[系统称号稀有度(名)] || "★";
    return "【" + 名 + "】" + 星;
  }).join("");
}


// 巡检：按 战力 / 转生 / 天下楼最高层 补授（幂等，随时可调）；返回本次新授予的名字数组
export function 系统称号巡检(ctx, u) {
  const 新 = [];
  const pwr = dn(ctx, P.战力, u, 0);
  if (pwr >= 1000000) 新.push("威震寰宇");
  else if (pwr >= 100000) 新.push("名动星海");
  else if (pwr >= 10000) 新.push("初露锋芒");
  const 转 = dn(ctx, P.转生, u, 0);
  if (转 >= 5) 新.push("五蕴超脱");
  else if (转 >= 3) 新.push("三度轮回");
  else if (转 >= 1) 新.push("涅槃重生");
  const 塔 = 天下楼记录(ctx, u);
  const 最高 = Math.max(0, Math.floor(Number(塔.最高) || 0));
  if (最高 >= 90) 新.push("摘星九十");
  else if (最高 >= 60) 新.push("凌云六十");
  else if (最高 >= 30) 新.push("登楼三十");
  const got = [];
  for (const 名 of 新) if (授系统称号(ctx, u, 名)) got.push(名);
  return got;
}



// ---------- 全服倍率（需求 15）：节日庆祝用，1.0 = 关闭 ----------
export const 倍率最小 = 1.0, 倍率最大 = 2.0;


export function 全服倍率(ctx) {
  let v = 1;
  try { v = Number(读控制台配置(ctx).全服倍率); } catch (e) { v = 1; }
  if (!Number.isFinite(v) || v < 倍率最小) return 1;
  return Math.min(倍率最大, Math.round(v * 10) / 10);
}


export function 倍率说明(ctx) {
  const m = 全服倍率(ctx);
  return m > 1 ? "🎉 全服奖励 ×" + m.toFixed(1) : "";
}


// 结算奖励统一入口：把「称号 + 全服倍率」一次性算进去（经验/星羽/金币/星核）
export function 奖励倍率(ctx, u, key) {
  const t = ["经验", "星羽", "金币", "星核"].indexOf(key) >= 0 ? 称号倍(ctx, u, key) : 1;
  return t * 全服倍率(ctx) * 细分倍率(ctx, key);
}


/* 2.9.9（需求 G）：细分倍率 —— 控制台可按 经验 / 星羽 / 金币 / 星核 / 掉落 分别调节（0.5~5），
 *   与全服倍率相乘生效；「双倍活动」= 全部设 2。存 控制台配置.细分倍率。
 *   掉落倍率作用于副本掉落物数量（floor），不影响 BOSS 爆率。 */
export const 细分倍率键 = ["经验", "星羽", "金币", "星核", "掉落"];


export function 细分倍率(ctx, key) {
  const 表 = 读控制台配置(ctx)["细分倍率"];
  if (!表 || typeof 表 !== "object") return 1;
  const v = Number(表[key]);
  if (!Number.isFinite(v)) return 1;
  return Math.max(0.5, Math.min(5, v));
}


export function 乘奖励(ctx, u, key, v) {
  return Math.max(0, Math.floor(Number(v || 0) * 奖励倍率(ctx, u, key)));
}


// 2.9.4（需求 H）：结算面板里的「基础 → 实际（×倍率）」对比项
//   倍 = 实际生效的倍率（称号 × 全服倍率）；不传时按 实际/基础 反推（只作兜底，小额会因取整偏差）
export function 倍率项(名, 基础, 实际, 倍) {
  const b = Math.max(0, Math.floor(Number(基础) || 0));
  const a = Math.max(0, Math.floor(Number(实际) || 0));
  if (!b) return "";
  let 比 = Number(倍);
  if (!Number.isFinite(比) || 比 <= 0) 比 = Math.round((a / b) * 100) / 100;
  else 比 = Math.round(比 * 100) / 100;
  return 名 + " " + kfmt(b) + " → " + kfmt(a) + "（×" + 比 + "）";
}


// 全服倍率 > 1 时返回两行说明（倍率行 + 逐项对比），否则返回空数组（不打扰玩家）
export function 倍率对比行(ctx, u, 项表) {
  const 倍 = 全服倍率(ctx);
  if (!(倍 > 1)) return [];
  const 项 = (Array.isArray(项表) ? 项表 : []).filter(Boolean);
  const 行 = [["🎉 全服倍率 ×" + 倍.toFixed(1) + "（节日加成，下面奖励已按倍率放大）", true]];
  if (项.length) 行.push(["奖励对比：" + 项.join(" · "), true]);
  return 行;
}



// ---------- 账号绑定（需求 13/14）：解绑 / 改绑 / 转移 / 改编号 ----------
// 数据全部以 openid 为键存在 tc/ 下。解绑的做法是：把该玩家的所有数据键整体改成 `#free_<编号>`，
// 这样原 openid 就「干净」了（再发消息会新建号），旧号数据仍可按编号检索、改绑回某个 openid。
export function 是解绑键(k) { return S(k).indexOf("#free_") === 0; }


export const 账号绑定文件 = "系统/账号绑定.json";


export function 读绑定表(ctx) { const v = dall(ctx, 账号绑定文件); return v && typeof v === "object" ? v : {}; }


export function 写绑定(ctx, 编号, o) { dset(ctx, 账号绑定文件, S(编号), o || null); }


// 把一个键在**所有存档文件**里改名（含 `键_副本id` 这种复合键，以及数组里的成员）
export function 重键(ctx, 旧键, 新键) {
  const 旧 = S(旧键), 新 = S(新键);
  if (!旧 || !新 || 旧 === 新) return 0;
  const 根 = root(ctx);
  let 改动 = 0;
  const 走 = (dir) => {
    let 项 = [];
    try { 项 = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const it of 项) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) { 走(p); continue; }
      if (!/\.json$/i.test(it.name)) continue;
      let 原文 = "";
      try { 原文 = fs.readFileSync(p, "utf8"); } catch (e) { continue; }
      let o;
      try { o = JSON.parse(原文); } catch (e) { continue; }
      let 变 = false;
      const 换数组 = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] === 旧) { arr[i] = 新; 变 = true; }
          else if (typeof arr[i] === "string" && arr[i].indexOf(旧 + "_") === 0) { arr[i] = 新 + arr[i].slice(旧.length); 变 = true; }
          else if (arr[i] && typeof arr[i] === "object") { 游(arr[i]); }
        }
      };
      const 游 = (obj) => {
        if (Array.isArray(obj)) { 换数组(obj); return; }
        if (!obj || typeof obj !== "object") return;
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          const 新k = (k === 旧) ? 新 : (k.indexOf(旧 + "_") === 0 ? 新 + k.slice(旧.length) : k);
          if (新k !== k) { obj[新k] = v; delete obj[k]; 变 = true; }
          if (v && typeof v === "object") 游(v);
        }
      };
      游(o);
      if (变) {
        try { fs.writeFileSync(p, JSON.stringify(o, null, 2), "utf8"); 改动 += 1; } catch (e) { /* ignore */ }
      }
    }
  };
  走(根);
  return 改动;
}


// 解绑：编号 ↔ openid 断开，旧数据收进 #free_<编号>
export function 解绑账号(ctx, 编号) {
  const u = byGid(ctx, 编号);
  if (!u) return { ok: false, msg: "找不到编号 " + S(编号) + " 的玩家" };
  if (是解绑键(u)) return { ok: false, msg: "该编号已经是解绑状态，无需重复解绑" };
  const 新键 = "#free_" + S(编号);
  const n = 重键(ctx, u, 新键);
  写绑定(ctx, 编号, { 原openid: u, 解绑时间: Date.now(), 状态: "已解绑", 键: 新键 });
  pushLog(ctx, "网页后台", "解绑账号 " + S(编号) + "（原 openid " + u + "）");
  return { ok: true, 编号: S(编号), 旧openid: u, 新键: 新键, 文件: n };
}


// 改绑 / 转移：把某个编号的数据绑到目标 openid（目标必须还没有账号）
export function 绑定到(ctx, 编号, openid, 是否转移) {
  const 目标 = S(openid);
  if (!/^[A-Za-z0-9_\-]{6,64}$/.test(目标)) return { ok: false, msg: "openid 格式不对（6~64 位字母数字下划线）" };
  const 键 = byGid(ctx, 编号);
  if (!键) return { ok: false, msg: "找不到编号 " + S(编号) + " 的玩家" };
  if (键 === 目标) return { ok: false, msg: "该编号已经绑在这个 openid 上" };
  if (hasAcc(ctx, 目标)) return { ok: false, msg: "目标 openid 已经有账号了，请先把它解绑" };
  if (是否转移 && !是解绑键(键)) return { ok: false, msg: "该编号仍是绑定状态，请先解绑才能转移" };
  const n = 重键(ctx, 键, 目标);
  写绑定(ctx, 编号, null);
  pushLog(ctx, "网页后台", (是否转移 ? "转移" : "改绑") + "账号 " + S(编号) + " → " + 目标);
  return { ok: true, 编号: S(编号), openid: 目标, 文件: n };
}


// 改编号（需求 3）：1 ~ 999999999，不能和别人重复
export function 改编号(ctx, 旧编号, 新编号) {
  const 新 = S(新编号).trim();
  if (!/^[1-9][0-9]{0,8}$/.test(新)) return { ok: false, msg: "编号必须是 1 ~ 999999999 的正整数" };
  const n = Number(新);
  if (n < 1 || n > 999999999) return { ok: false, msg: "编号必须是 1 ~ 999999999 的正整数" };
  const u = byGid(ctx, 旧编号);
  if (!u) return { ok: false, msg: "找不到编号 " + S(旧编号) + " 的玩家" };
  if (S(旧编号) === 新) return { ok: false, msg: "新旧编号相同" };
  const 占用 = byGid(ctx, 新);
  if (占用 && 占用 !== u) return { ok: false, msg: "编号 " + 新 + " 已被其他玩家占用" };
  dset(ctx, P.游戏ID, u, 新);
  // 解绑键里带旧编号，跟着改一下；绑定表里的记录一并搬过去
  if (是解绑键(u)) {
    const 新键 = "#free_" + 新;
    重键(ctx, u, 新键);
  }
  const 绑 = 读绑定表(ctx)[S(旧编号)];
  if (绑) { 写绑定(ctx, 旧编号, null); 写绑定(ctx, 新, 绑); }
  pushLog(ctx, "网页后台", "改编号 " + S(旧编号) + " → " + 新);
  return { ok: true, 编号: 新 };
}


// ---------- 2.1.1 经验系统：统一入口 + 每日经验统计 ----------
export const 经验日档 = (d) => "游戏数据/经验/日统计/" + d + ".json";


export function 记经验(ctx, u, v) {
  const d = ymd();
  const add = Math.max(0, Math.floor(Number(v) || 0));
  if (!add) return;
  dset(ctx, 经验日档(d), u, dn(ctx, 经验日档(d), u, 0) + add);
}


export function 今日经验(ctx, u) { return dn(ctx, 经验日档(ymd()), u, 0); }


// 所有加经验都走这里：入账 + 记录今日合计（保证 今日经验统计 准确）
export function 加经验(ctx, u, v) {
  // 2.7.0（需求 4/15）：称号「经验」加成 + 全服节日倍率
  const k = Math.max(0, Math.floor(Number(v) || 0) * 奖励倍率(ctx, u, "经验"));
  // 退级卡副作用：冷却期内经验卡在当前等级的临门一脚，无法升级
  const 冷却 = dn(ctx, P.退级冷却, u, 0);
  let 用量 = k;
  if (冷却 && Date.now() < 冷却) {
    const 需 = 累计经验需求(dn(ctx, P.等级, u, 1) + 1);
    const 已有 = dn(ctx, P.经验, u, 0);
    用量 = Math.max(0, Math.min(k, 需 - 已有 - 1));
  }
  const up = addXp(ctx, u, 用量);
  记经验(ctx, u, 用量);
  return up;
}


// 经验来源说明（`经验` 指令用）
export const 经验途径表 = [
  // 2.9.6：探索已改为每日 1000 次上限（原「无每日上限」是旧文案）
  ["探索", "每次 20~40（每日 1000 次上限，越探越稳）"],
  ["挖矿", "每次 40~80"],
  ["打工", "基础 900~1800 + 等级×80（加班双倍，10 分钟冷却）"],
  ["钓鱼", "每条 15~30"],
  ["打坐", "每次 80~200（每天 10 次）"],
  ["副本", "经验最高，通关 1~15 号副本"],
  ["组队 / 一键出招", "与普通副本同档，另有首通加成"],
  ["对战", "挑战#玩家（对方同意后回合制）/ 匹配挑战"],
  ["签到", "每天 1 次，连签越多越多"],
  ["每日任务 / 新手指引", "领奖时一次性发放"],
  ["联盟捐献", "每次捐献 150"],
  ["交易行卖出", "卖出即得少量经验"]
];


export function addCoin(ctx, u, v) { const x = Math.max(0, dn(ctx, P.星羽, u, 0) + Math.floor(v)); dset(ctx, P.星羽, u, x); return x; }


export function addCore(ctx, u, v) { const x = Math.max(0, dn(ctx, P.星核, u, 0) + Math.floor(v)); dset(ctx, P.星核, u, x); return x; }


export function addContrib(ctx, u, v) { const x = Math.max(0, dn(ctx, P.贡献, u, 0) + Math.floor(v)); dset(ctx, P.贡献, u, x); return x; }


/* ============================================================
 * 3.0.0（需求 1）升级机制重做
 * ------------------------------------------------------------
 * · 经验改成「累计总量」：只增不减，升级**不再扣除**经验；
 * · 升级改成**手动**：发 `星甲升级` 才结算，一次可连升多级；
 * · 经验没有上限，等级也没有上限；
 * · 老存档一次性迁移：经验 = 累计需求(当前等级) + 原来的本级剩余经验（幂等）。
 * ============================================================ */
const 累计缓存 = new Map();
// 升到 lv 级所需的累计经验（= xpNeed(1) + xpNeed(2) + … + xpNeed(lv-1)）
export function 累计经验需求(lv) {
  const L = Math.max(1, Math.floor(Number(lv) || 1));
  if (累计缓存.has(L)) return 累计缓存.get(L);
  let s = 0;
  if (L > 1) {
    // 复用上一级结果，避免每次都从头累加
    let 基 = L - 1;
    while (基 > 1 && !累计缓存.has(基)) 基 -= 1;
    s = 累计缓存.get(基) || 0;
    for (let i = 基; i < L; i++) s += xpNeed(i);
  }
  累计缓存.set(L, s);
  return s;
}

export function 可升级(ctx, u) {
  const lv = dn(ctx, P.等级, u, 1);
  const xp = dn(ctx, P.经验, u, 0);
  return { 可: xp >= 累计经验需求(lv + 1), 等级: lv, 经验: xp, 下次: 累计经验需求(lv + 1) };
}

// 手动升级：经验够就连升（经验不扣、不归零）
export function 手动升级(ctx, u) {
  let lv = dn(ctx, P.等级, u, 1);
  const xp = dn(ctx, P.经验, u, 0);
  let up = 0;
  while (lv < 等级无上限 && xp >= 累计经验需求(lv + 1)) { lv += 1; up += 1; if (up >= 1000) break; }
  if (up > 0) { dset(ctx, P.等级, u, lv); recPwr(ctx, u); }
  return { 升级: up, 等级: lv, 经验: xp, 下次: 累计经验需求(lv + 1), 可升级: xp >= 累计经验需求(lv + 1) };
}

// 老存档迁移：把「本级剩余经验」转成「累计经验」
export function 迁移经验累计(ctx) {
  if (S(dget(ctx, "系统/版本.json", "经验累计")) === "3.0.0") return 0;
  let n = 0;
  for (const u of players(ctx)) {
    const lv = dn(ctx, P.等级, u, 1);
    const 旧 = dn(ctx, P.经验, u, 0);
    if (lv > 1 && 旧 < 累计经验需求(lv)) { dset(ctx, P.经验, u, 累计经验需求(lv) + 旧); n += 1; }
  }
  dset(ctx, "系统/版本.json", "经验累计", "3.0.0");
  if (n && ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 经验累计迁移完成：" + n + " 人");
  return n;
}

export function addXp(ctx, u, v) {
  if (!hasAcc(ctx, u)) return { 升级: 0, 等级: 1, 满级: false, 上限: 等级无上限, 可升级: false };
  const lv = dn(ctx, P.等级, u, 1);
  const xp = dn(ctx, P.经验, u, 0) + Math.max(0, Math.floor(v));
  dset(ctx, P.经验, u, Math.floor(xp));
  recPwr(ctx, u);
  // 3.0.0：不再自动升级，只回报「是否够经验手动升级」
  return { 升级: 0, 等级: lv, 满级: false, 上限: 等级无上限, 可升级: xp >= 累计经验需求(lv + 1) };
}


export function pText(ctx, u) {
  const p = attrs(ctx, u);
  const need = p.经验 + " / " + 累计经验需求(p.等级 + 1) + "（累计）";
  return [
    "编号:" + p.编号 + " · 昵称:" + p.昵称 + (p.称号 ? "（" + p.称号徽标 + "）" : ""),
    称号名(ctx, u) ? "称号:" + 称号徽标(ctx, u) + "　" + (称号表.find((x) => x.名 === 称号名(ctx, u)) || {}).说明 : "称号:无（可由主人发放）",
    "等级:" + p.等级 + " · 经验:" + need,
    "战力:" + pwrOf(ctx, u),
    "攻击:" + p.攻击 + " · 防御:" + p.防御 + " · 血量:" + p.血量 + "/" + p.血量上限,
    "暴击率:" + p.暴击率.toFixed(2) + "%（上限 " + 暴击率上限 + "%） · 暴伤:" + p.暴伤.toFixed(2) + "%",
    "暴击点:" + p.暴击 + " · 闪避率:" + p.闪避.toFixed(2) + "%",
    "",
    "**词条（共 " + 词条定义.length + " 条 · 全部开放 · 各自上限 · 特殊词条只出在传说装备上）**",
    词条面板文本(p, 玩家激活词条(ctx, u)),
    "",
    "转生:" + p.转生 + " 次 · 强化:" + p.强化 + "/" + strCount(p.等级),
    "星羽:" + p.星羽 + " · 存款:" + p.存款 + " · 金币:" + p.金币 + " · 星核:" + p.星核 + " · 贡献:" + p.贡献,
    "联盟:" + (ds(ctx, P.联盟, u, "") || "未加入") + " · 军衔:" + rankTitle(ctx, u),
    "",
    蓝链([
      ["星甲背包", "背包"], ["星甲副本", "副本"], ["星甲打坐", "打坐"], ["星甲探索5", "探索5"], ["星甲挖矿", "挖矿"],
      ["星甲打工", "打工"], ["星甲修复战甲", "修甲"], ["星甲经验", "经验"], ["星甲菜单", "菜单"]
    ])
  ].join("\n");
}
