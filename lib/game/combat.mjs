// lib/game/combat.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { 时长 } from "./../admin/admin.mjs?v=v1795793619955";
import { S, dall, dget, dn, dset, fileOf, fmt, kfmt, n, pushLog, rnd, wait, 去星甲 } from "./../core/base.mjs?v=v1795793619955";
import { actBtn, btn, reply, row, 蓝字 } from "./../core/qq.mjs?v=v1795793619955";
import { 暴击率上限, 闪避上限 } from "./../core/rules.mjs?v=v1795793619955";
import { P } from "./../core/util.mjs?v=v1795793619955";
import { BOSS入场返还比例, BOSS失败返还比例, 三档难度系数, 致命打击词条 } from "././boss.mjs?v=v1795793619955";
// 3.0.0（需求 25）：技能表已改为「职业专属」；老的 技能表 导出保留在 cook.mjs（pvp.mjs 仍引用，已标废弃）
import { 技能点上限, 出招策略文案, 技能效果文案, 我的技能表, 转职费, 转职等级, 灰混 } from "././cook.mjs?v=v1795793619955";
import { 加信用分 } from "././credit.mjs?v=v1795793619955";
// 3.0.0（需求 A/B）：翻倍挑战 + 刷新卡口径都放在 dungeon.mjs（那里才有敌人数值 / 冷却 / 商店的存档口径）
import { BOSS传说爆率, BOSS总血量, BOSS掉落, BOSS史诗爆率, BOSS普通爆率, 剩传说保底, 剩史诗保底, 剩普通保底, 副本掉落, 加挑战次数, 当前血量, 我血量上限, 挑战次数, 掉生长药水, 敌数据, 敌缩放幅度, 血量倍率显示, 设血量, 翻倍次数, 翻倍上限, 翻倍属性倍, 翻倍敌数据, 翻倍敌属性, 翻倍冷却毫秒, 设挑战冷却翻倍, 刷新卡清分钟, 刷新卡需要张数, 婚姻分成 } from "././dungeon.mjs?v=v1795793619955";
import { 股事件, 股票tick } from "././econ.mjs?v=v1795793619955";
import { addCoin, addCore, attrs, gid, giveItem, hasItem, pwrOf, recPwr, takeItem, 倍率对比行, 倍率项, 加经验, 奖励倍率, 授系统称号, 百分比词条键, 细分倍率, 裁剪词条, 词条上限, 读职业, 蓝量上限, 读蓝量, 写蓝量, 战斗蓝量写回 } from "././player.mjs?v=v1795793619955";
import { dgDone, dgFind, dgMark, 剩挑战冷却, 剩操作冷却, 取挑战冷却, 操作冷却毫秒, 设挑战冷却, 设操作冷却, 副本冷却毫秒, BOSS冷却毫秒 } from "././progress.mjs?v=v1795793619955";
import { 修甲拦截, 药品回血, 药品集, 药品回蓝, 蓝药集, 自动喝蓝药, 回蓝提示, 没蓝提醒 } from "././rebirth.mjs?v=v1795793619955";
import { 单刀截断, 天下楼结算, 实际伤害, 怪物伤害, 我方伤害, 战斗已死, 战斗目标, 清死战斗 } from "././tower.mjs?v=v1795793619955";
import fs from "node:fs";
import path from "node:path";

export function 条带(v, max) { const 比 = Math.max(0, Math.min(1, max > 0 ? v / max : 0)); const n = Math.round(比 * 20); return "■".repeat(n) + "□".repeat(20 - n); }


export function 战斗记录(ctx, u) {
  const v = dget(ctx, P.战斗, u, null);
  if (!v || typeof v !== "object") return null;
  // 2.5.7：老战斗存档的技能点上限是 10，这里一次性升到 50（不回写文件，读时纠正即可）
  if (v.spMax !== undefined && Number(v.spMax) < 技能点上限) v.spMax = 技能点上限;
  if (v.sp !== undefined && Number(v.sp) > (Number(v.spMax) || 技能点上限)) v.sp = Number(v.spMax) || 技能点上限;
  // 3.0.0（需求 25）：技能要扣蓝 —— 老战斗存档没有 mp / mpMax 字段时按「满蓝」兜底（只读时纠正，不回写）
  // 3.2.0（需求 1/4）：蓝量改成全局资源 —— 老战斗存档缺 mp / mpMax 时，直接用**全局蓝量 / 全局上限**兜底
  if (v.mpMax === undefined || v.mpMax === null) v.mpMax = 蓝量上限(attrs(ctx, u));
  const 顶 = Math.max(0, Math.floor(Number(v.mpMax) || 0));
  if (v.mp === undefined || v.mp === null) v.mp = Math.min(顶, 读蓝量(ctx, u, 顶));
  v.mp = Math.max(0, Math.min(顶, Math.floor(Number(v.mp) || 0)));   // 脏档兜底：蓝量永远 ≤ 上限
  return v;
}


export function 存战斗(ctx, u, o) { dset(ctx, P.战斗, u, o); }


// 2.8.0：火力已并入攻击力 → 统一的「攻击力」就是 p.attack（副本 / BOSS / 组队 / 天下楼全部走这里）
export function 攻击力(p) {
  return Math.max(1, Math.round(Number(p && p.攻击) || 0));
}


// 2.9.7（需求 12）：副本 / BOSS / 组队 / 天下楼敌方阶段化狂暴。
// 三档互斥并取最高档；档位写进战斗记录，只能上升，回血后不会掉档反复触发。
export const 敌方闪避上限 = 45;


export const 敌方标记 = Symbol("xjyl.enemy");


export const 敌方模拟阶段 = Symbol("xjyl.enemyStage");


export const 敌方阶段表 = Object.freeze([
  Object.freeze({ 档: 0, 名: "平静", 阈值: 1, 回血: 0, 攻倍: 1, 防倍: 1, 闪避加成: 0 }),
  Object.freeze({ 档: 1, 名: "生气", 阈值: 0.75, 回血: 0.01, 攻倍: 1.5, 防倍: 1.15, 闪避加成: 10 }),
  Object.freeze({ 档: 2, 名: "愤怒", 阈值: 0.5, 回血: 0.025, 攻倍: 1.75, 防倍: 1.25, 闪避加成: 15 }),
  Object.freeze({ 档: 3, 名: "狂暴", 阈值: 0.3, 回血: 0.05, 攻倍: 2, 防倍: 1.35, 闪避加成: 20 })
]);


export function 敌方阶段档(血, 总血, 已有) {
  const 旧 = Math.max(0, Math.min(3, Math.floor(Number(已有) || 0)));
  const 上 = Math.max(0, Number(总血) || 0);
  const hp = Number(血);
  if (!(上 > 0) || !isFinite(hp) || hp <= 0) return 旧;
  const 比 = hp / 上;
  const 新 = 比 < 0.3 ? 3 : (比 < 0.5 ? 2 : (比 < 0.75 ? 1 : 0));
  return Math.max(旧, 新);
}


export function 敌方阶段值(d, 档位) {
  const 档 = Math.max(0, Math.min(3, Math.floor(Number(档位) || 0)));
  const 配 = 敌方阶段表[档];
  const 闪0 = Math.max(0, Number((d && d.闪避率 !== undefined) ? d.闪避率 : (d && d.闪避)) || 0);
  return {
    档: 档, 名: 配.名, 攻倍: 配.攻倍, 防倍: 配.防倍, 回血率: 配.回血, 闪避加成: 配.闪避加成,
    攻: (Number(d && d.攻) || 0) * 配.攻倍,
    防: (Number(d && d.防) || 0) * 配.防倍,
    暴伤: Number(d && d.暴伤) || 0,
    闪避率: Math.min(敌方闪避上限, 闪0 + 配.闪避加成)
  };
}


export function 敌方阶段文案(怪名, 档位, 回血) {
  const 配 = 敌方阶段表[Math.max(0, Math.min(3, Math.floor(Number(档位) || 0)))];
  return "⚠️【" + S(怪名) + "】进入**" + 配.名 + "**：回血 " + (配.回血 * 100) + "%（+" + kfmt(回血) + "） · 攻击 ×" + 配.攻倍 + " · 防御 ×" + 配.防倍 + " · 闪避 +" + 配.闪避加成 + "（敌方上限 " + 敌方闪避上限 + "%）";
}


// 2.9.7（收尾）：三档说明文案统一由 敌方阶段表 生成 —— 改了表格数值不会漏改文案。
export function 敌方阶段概要(连 = " · ") {
  return 敌方阶段表.slice(1).map((配) =>
    "血量 <" + (配.阈值 * 100) + "% → " + 配.名 + "（回血" + (配.回血 * 100) + "% / 攻×" + 配.攻倍 + " / 防×" + 配.防倍 + " / 闪避+" + 配.闪避加成 + "）"
  ).join(连);
}


// 在敌方受到一次完整结算后调用；跨过多档时直接取最高档，只回该档的一次血。
export function 推进敌方阶段(rec, 怪名) {
  if (!rec || rec.结果) return { 变化: false, 档: Math.max(0, Number(rec && rec.敌方阶段) || 0), 回血: 0, 提示: "" };
  const 旧 = Math.max(0, Math.min(3, Math.floor(Number(rec.敌方阶段) || 0)));
  const 新 = 敌方阶段档(rec.bhp, rec.bhpMax, 旧);
  rec.敌方阶段 = 新;
  if (新 <= 旧 || !(Number(rec.bhp) > 0)) return { 变化: false, 档: 新, 回血: 0, 提示: "" };
  const 上 = Math.max(1, Math.round(Number(rec.bhpMax) || 1));
  const 回 = Math.max(1, Math.round(上 * 敌方阶段表[新].回血));
  const 前 = Math.max(0, Number(rec.bhp) || 0);
  rec.bhp = Math.min(上, 前 + 回);
  const 实回 = Math.max(0, rec.bhp - 前);
  return { 变化: true, 档: 新, 回血: 实回, 提示: 敌方阶段文案(怪名, 新, 实回) };
}


export function 是敌方战斗方(方) { return !!(方 && (方.敌方 || (方.词条 && 方.词条[敌方标记]))); }


// 给统一伤害层套上敌方当前档位。显式档位供真实战斗记录使用；Symbol 状态供 t-balance4 每场模拟持久化。
export function 阶段化战斗方(方) {
  if (!是敌方战斗方(方)) return 方 || {};
  const 源词 = (方 && 方.词条) || {};
  const 词 = Object.assign({}, 源词);
  词[敌方标记] = true;
  const 已有 = Math.max(0, Math.min(3, Math.floor(Number(
    方 && 方.敌方阶段 !== undefined ? 方.敌方阶段 : 源词[敌方模拟阶段]
  ) || 0)));
  const 档 = 敌方阶段档(方 && 方.hp, 方 && 方.hpMax, 已有);
  源词[敌方模拟阶段] = 档;
  词[敌方模拟阶段] = 档;
  const 配 = 敌方阶段表[档];
  if (方 && 方.阶段已应用) return Object.assign({}, 方, { 词条: 词, 敌方: true, 敌方阶段: 档 });
  词.闪避率 = Math.min(敌方闪避上限, Math.max(0, Number(词.闪避率) || 0) + 配.闪避加成);
  // 2.9.12（需求 7）：狂暴真伤 —— 顶层 BOSS 进入狂暴（档 3）后真伤概率额外 +狂暴真伤
  if (档 >= 3 && Number(词.狂暴真伤) > 0) 词.真伤概率 = Math.min(词条上限("真伤概率"), Math.max(0, Number(词.真伤概率) || 0) + Number(词.狂暴真伤));
  return Object.assign({}, 方, {
    攻: (Number(方 && 方.攻) || 0) * 配.攻倍,
    防: (Number(方 && 方.防) || 0) * 配.防倍,
    词条: 词, 敌方: true, 敌方阶段: 档, 阶段已应用: true
  });
}


/* ============================================================
 * 2.8.0（需求 2）统一伤害公式 +（需求 1）15 条词条的战斗效果
 * ------------------------------------------------------------
 * 基础伤害 = 攻击力 − 敌人防御力；若 (攻击力 − 敌人防御力) <= 0，基础伤害记为 1
 * 伤害     = 基础伤害 × 暴击伤害%（暴击）／× (0.9 ~ 1.1)（未暴击）
 * 普攻 / 技能 / 追击 / 反击 / 天下楼 / BOSS / 组队 **全部走这一个公式**
 * （旧的 防/(防+2400) 减伤公式与「暴击 + 目标防御」加成都已删除）
 * 词条效果也全部集中在 伤害结算() 一处，不在各个分支里重复写。
 * ============================================================ */
export function 词条取(方, 键) { return Math.max(0, Number(方 && 方.词条 && 方.词条[键]) || 0); }


export function 率中(百分比) { return Math.max(0, Number(百分比) || 0) > 0 && Math.random() * 100 < 百分比; }


// 统一公式的单次伤害：真伤时 敌防 传 0（真伤概率 已在外层判定）
// 场景（P3）：「副本」中暴击伤害独立 —— 暴击 = 攻击力 × 暴伤%（不减敌人防御）；
//   BOSS / 天下楼 / 组队打 BOSS 维持旧公式（攻击力 − 敌防御) × 暴伤%，基础 ≤0 记 1。
// 2.10.0（需求 4.3）：**敌方攻击保底** —— 玩家防御高于怪物攻击时，旧版伤害退化成 1（「打不动人」）。
//   现在敌方（带 敌方标记 的一方）单次基础伤害至少 = 攻击力 × 敌方伤害保底比例（20%），
//   保证 BOSS / 塔怪 / 副本怪每次命中都能打出可观伤害；玩家侧不变（仍是 ≤0 记 1）。
export const 敌方伤害保底比例 = 0.2;


export function 单次伤害(攻方, 敌防, 倍率, 场景) {
  const a = Math.max(1, Number(攻方 && 攻方.攻) || 1);
  const def = Math.max(0, Number(敌防) || 0);
  const 净 = a - def;
  const 敌方 = !!(攻方 && 攻方.词条 && 攻方.词条[敌方标记]);
  const 保底 = 敌方 ? Math.max(1, Math.round(a * 敌方伤害保底比例)) : 1;
  const 基础 = 净 <= 0 ? 保底 : Math.max(净, 保底);   // (攻击力 − 防御力) ≤ 0 → 敌方走保底，玩家记 1
  const 倍 = Math.max(0.01, Number(倍率 === undefined ? 1 : 倍率) || 1);
  const 暴 = Math.random() * 100 < Math.min(暴击率上限, Math.max(0, Number(攻方 && 攻方.暴击率) || 0));
  if (暴) {
    if (场景 === "副本") {
      // 副本暴击：不吃减防，直接 攻击力 × 暴伤%
      return { dmg: Math.max(1, Math.round(a * (Math.max(0, Number(攻方 && 攻方.暴伤) || 100) / 100) * 倍)), 暴: true, 基础: a };
    }
    return { dmg: Math.max(1, Math.round(基础 * (Math.max(0, Number(攻方 && 攻方.暴伤) || 100) / 100) * 倍)), 暴: true, 基础: 基础 };
  }
  return { dmg: Math.max(1, Math.round(基础 * (0.9 + Math.random() * 0.2) * 倍)), 暴: false, 基础: 基础 };
}


/* 一次完整攻击的结算（攻方 → 守方）。返回：
 *   主    本次主伤害（0 = 被闪避）
 *   追击  追击那一下的伤害（追击率 触发）
 *   吸血  攻方回复的血量（受守方「重伤」削减，单次 ≤ 攻方血量上限 10%）
 *   反伤  [{类型, 伤害}] —— 守方的「反击」/「闪击」打回来的伤害
 *   抗暴  守方用抗暴率减免了这次暴击
 */
export function 伤害结算(攻方, 守方, 倍率, 场景) {
  const 原守方 = 守方 || {};
  const 模拟敌词 = 是敌方战斗方(原守方) && 原守方.敌方阶段 === undefined && !原守方.阶段已应用
    ? ((原守方 && 原守方.词条) || null) : null;
  const 模拟旧档 = 模拟敌词 ? Math.max(0, Math.min(3, Math.floor(Number(模拟敌词[敌方模拟阶段]) || 0))) : 0;
  攻方 = 阶段化战斗方(攻方);
  守方 = 阶段化战斗方(守方);
  const 倍 = Math.max(0.01, Number(倍率 === undefined ? 1 : 倍率) || 1);
  const out = { 主: 0, 暴: false, 闪避: false, 真伤: false, 精准: false, 追击: 0, 吸血: 0, 抗暴: false, 反伤: [] };
  // ① 闪避 / 精准打击（玩家封顶 40%，敌方阶段叠加后独立封顶 45%）
  const 闪避率 = Math.min(是敌方战斗方(守方) ? 敌方闪避上限 : 闪避上限, 词条取(守方, "闪避率"));
  let 被闪 = Math.random() * 100 < 闪避率;
  if (被闪 && 率中(词条取(攻方, "精准打击"))) { 被闪 = false; out.精准 = true; }
  if (被闪) {
    out.闪避 = true;
    // 闪击：守方闪避成功 → 按守方「闪击率」额外打攻方一次
    if (率中(词条取(守方, "闪击率"))) {
      const s = 单次伤害({ 攻: 守方.攻, 暴击率: 守方.暴击率, 暴伤: 守方.暴伤 }, 攻方.防, 1, 场景);
      out.反伤.push({ 类型: "闪击", 伤害: Math.max(1, s.dmg), 暴: s.暴 });
    }
    return out;
  }
  // ② 真伤概率：命中时按概率无视对方防御（伤害 = 攻击力 × 暴伤%）
  const 真伤 = 率中(词条取(攻方, "真伤概率"));
  out.真伤 = 真伤;
  const 敌防 = 真伤 ? 0 : Math.max(0, Number(守方 && 守方.防) || 0);
  // ③ 主伤害（2.9.12：真实暴击 —— 真伤一击必暴）
  const 真暴 = 真伤 && 词条取(攻方, "真实暴击") >= 1;
  const s = 单次伤害(真暴 ? Object.assign({}, 攻方, { 暴击率: 100 }) : 攻方, 敌防, 倍, 场景);
  out.主 = s.dmg; out.暴 = s.暴; out.基础 = s.基础;
  // ④ 抗暴率：守方受到暴击时按该比例减少伤害
  if (out.暴) {
    const 抗 = Math.min(90, 词条取(守方, "抗暴率")) / 100;
    if (抗 > 0) { out.抗暴 = true; out.主 = Math.max(1, Math.round(out.主 * (1 - 抗))); }
  }
  // ⑤ 追击率 / 追击伤害：主伤害之后按概率再追加一次（伤害 = 主伤害 × 追击伤害%）
  if (率中(词条取(攻方, "追击率"))) {
    const 率 = Math.max(0, 词条取(攻方, "追击伤害")) / 100;
    out.追击 = Math.max(1, Math.round(out.主 * 率));
  }
  // ⑥ 吸血：按造成伤害的比例回血；守方「重伤」按比例削减；单次 ≤ 攻方血量上限的 30%（2.9.12：10% → 30%，双向生效）
  const 总伤 = out.主 + out.追击;
  if (总伤 > 0) {
    const 吸 = 词条取(攻方, "吸血") / 100;
    if (吸 > 0) {
      const 重 = Math.min(100, 词条取(守方, "重伤")) / 100;
      const 顶 = Math.max(1, Math.round((Number(攻方 && 攻方.hpMax) || 0) * 0.3));
      out.吸血 = Math.min(顶, Math.max(0, Math.round(总伤 * 吸 * (1 - 重))));
    }
  }
  // ⑦ 反击率 / 反击伤害：守方受到伤害后按概率反弹（伤害 = 受到的伤害 × 反击伤害%）
  if (总伤 > 0 && 率中(词条取(守方, "反击率"))) {
    out.反伤.push({ 类型: "反击", 伤害: Math.max(1, Math.round(总伤 * (词条取(守方, "反击伤害") / 100))), 暴: false });
  }
  // ⑦b 反伤率（2.9.12：BOSS 特殊属性池「吸血+反伤」档）—— 受伤按固定比例反弹，与反击独立叠加
  if (总伤 > 0 && 词条取(守方, "反伤率") > 0) {
    out.反伤.push({ 类型: "反伤", 伤害: Math.max(1, Math.round(总伤 * (词条取(守方, "反伤率") / 100))), 暴: false });
  }
  /* t-balance4 直接调用统一伤害层、在外部扣血；其每场复用同一个敌方词条对象。
   * 用不可枚举到 Object.keys/JSON 的 Symbol 保存档位，并把本次「扣血后触档回血」折成净伤害，
   * 让旧模拟器无需另写第二套狂暴逻辑也能覆盖攻/防/闪避/回血。真实战斗传显式档位，不走此分支。 */
  if (模拟敌词 && 总伤 > 0 && Number(原守方.hpMax) > 0 && Number(原守方.hp) > 0) {
    const 上 = Math.max(1, Math.round(Number(原守方.hpMax) || 1));
    const 模拟扣 = Math.min(总伤, Math.max(1, Math.round(上 * 0.25)), Math.max(0, Math.round(Number(原守方.hp) || 0)));
    const 扣后 = Math.max(0, Number(原守方.hp) - 模拟扣);
    const 新档 = 敌方阶段档(扣后, 上, 模拟旧档);
    if (新档 > 模拟旧档 && 扣后 > 0) {
      模拟敌词[敌方模拟阶段] = 新档;
      const 回 = Math.min(Math.max(0, 上 - 扣后), Math.max(1, Math.round(上 * 敌方阶段表[新档].回血)));
      const 净扣 = Math.max(0, 模拟扣 - 回);
      out.主 = 净扣;
      out.追击 = 0;
      out.阶段触发 = 新档;
      out.阶段回血 = 回;
    }
  }
  return out;
}


// 兼容旧调用点：(攻, 防, 暴击率, 暴伤, 目标闪避率) → 走同一套统一公式
export function 战斗伤害(攻, 防, 暴击率, 暴伤, 目标闪避率) {
  const 结 = 伤害结算(
    { 攻: 攻, 暴击率: 暴击率, 暴伤: 暴伤 },
    { 防: 防 }
  );
  return { dmg: 结.主, 暴: 结.暴, 闪避: 结.闪避, 追击: 结.追击, 吸血: 结.吸血, 反伤: 结.反伤, 真伤: 结.真伤, 精准: 结.精准, 抗暴: 结.抗暴 };
}


// 玩家侧词条（开战时快照进 rec，战斗中不再重新读档，保证一场战斗数值一致）
export function 我词条(rec) {
  const w = (rec && rec.我词条) || {};
  return w && typeof w === "object" ? w : {};
}


// 怪物侧词条：默认只有闪避率（狂暴放大后的），其余走 DG/BOSS 条目里的 词条 字段（默认全 0）
export function 怪词条(d, 阶段值) {
  const 源 = (d && d.词条 && typeof d.词条 === "object") ? d.词条 : {};
  const out = { 闪避率: Number(阶段值 && 阶段值.闪避率 !== undefined ? 阶段值.闪避率 : (d && (d.闪避率 !== undefined ? d.闪避率 : d.闪避))) || 0 };
  out[敌方标记] = true;
  for (const k of 百分比词条键) if (k !== "闪避率") out[k] = 裁剪词条(k, 源[k]);
  // 2.10.0（需求 4.5）：敌方专属「致命打击」不在 player.mjs 的词条定义里（玩家侧无来源），
  //   这里原样透传给 伤害结算 / 尝试复活，上限取 致命打击词条.上限。
  const 打击 = Math.min(致命打击词条.上限, Math.max(0, Number(源.致命打击) || 0));
  if (打击 > 0) out.致命打击 = 打击;
  return out;
}


/* 复活率：被击败时按概率复活，**每场战斗只触发一次**。
 * 2.10.0（需求 4.5）：返回值从 boolean 改为「复活后的血量」（null = 未触发）。
 *   新增第 4 个参数 敌词 —— 敌人带「致命打击」词条时（HIGH 档 BOSS / 塔怪），
 *   复活血量 = 血量上限 ×(1 − 致命打击%)，而不是满血；普通副本 / 低中档 BOSS 不生效。
 *   「致命打击」定义在 boss.mjs（敌方专属词条，玩家侧无来源）。 */
export function 尝试复活(rec, 词, 标记键, 敌词) {
  if (!rec || rec[标记键]) return null;
  if (!率中(词条取({ 词条: 词 }, "复活率"))) return null;
  rec[标记键] = true;
  const 上 = Math.max(1, Math.round(Number(rec.hpMax) || 1));
  const 打击 = Math.max(0, Math.min(100, Number(敌词 && 敌词.致命打击) || 0));
  const 血 = Math.max(1, Math.round(上 * (1 - 打击 / 100)));
  rec.复活血 = 血;
  rec.致命打击 = 打击;
  return 血;
}


// 2.10.0（需求 4.5）：复活提示文案（含「致命打击」扣血说明，两种调用方共用）
export function 复活文案(rec, 前缀) {
  const 打击 = Math.max(0, Number(rec && rec.致命打击) || 0);
  return (前缀 || "") + "你的【复活率】触发，" + (打击 > 0 ? "被【致命打击 " + 打击 + "%】压制，" : "") +
    "以 " + (rec ? rec.hp : 0) + "/" + (rec ? rec.hpMax : 0) + " 血重新站了起来（每场一次）";
}


/* 2.10.0（需求 4.4）：当前特殊状态（三档狂暴）常驻显示文案 —— 平静（档 0）返回空串 = 不显示。
 * 例：⚡ 愤怒 II · 攻×1.75 · 防×1.25 · 闪避+15 · 每回合回血 2.5% */
export function 敌方阶段状态行(档位) {
  const 档 = Math.max(0, Math.min(3, Math.floor(Number(档位) || 0)));
  if (档 <= 0) return "";
  const 配 = 敌方阶段表[档];
  const 罗马 = ["", "I", "II", "III"][档];
  return "⚡ " + 配.名 + " " + 罗马 + " · 攻×" + 配.攻倍 + " · 防×" + 配.防倍
    + " · 闪避+" + 配.闪避加成 + "%（敌方上限 " + 敌方闪避上限 + "%） · 每回合回血 " + (配.回血 * 100) + "%";
}


/* 3.0.0（需求 A）翻倍挑战入口解析：
 *   `星甲挑战101#5` / `星甲BOSS201#5` 这类「编号#次数」也能直接进 开战（router 只把整串丢进来就行）；
 *   次数超出 1~5 会被夹紧，并在回执里提示。 */
export function 解析挑战参数(id, 翻倍) {
  const 原 = S(id);
  let 编号 = 原, 次 = 翻倍;
  const m = 原.match(/^(.*?)[#\s]([0-9]{1,2})$/);
  if (m && S(m[1]) !== "") { 编号 = m[1]; 次 = m[2]; }
  const 请求 = Math.floor(Number(次) || 1);
  const 次2 = 翻倍次数(请求);
  return { 编号: 编号, 翻倍: 次2, 请求: 请求, 夹紧: 请求 !== 次2 };
}


/* 3.0.0（需求 A）：战斗中的目标数据 —— 翻倍挑战时**每一回合**都要把敌方属性 ×1.5。
 *   tower.mjs 的 战斗目标() 不认识 翻倍 字段（血量已经存在 rec.bhp/bhpMax 里 ×N），
 *   所以在 combat 侧包一层：只放大 攻 / 防 / 暴 / 暴伤 / 词条，血量不动。 */
export function 战斗敌(rec) {
  const d = 战斗目标(rec);   // tower.mjs 的原始目标（不含翻倍）
  if (!d) return d;
  const n = 翻倍次数(rec && rec.翻倍);
  return n > 1 ? 翻倍敌属性(d, n) : d;
}


export async function 开战(ctx, t, u, id, 翻倍参数) {
  if (await 修甲拦截(ctx, t, u)) return;
  const 参 = 解析挑战参数(id, 翻倍参数);
  const d = dgFind(参.编号);
  if (!d) { await reply(ctx, t, "没有编号 " + S(参.编号) + " 的副本。发 `副本` 看列表。", { 标题: "挑战失败", 按钮: [btn("xg6", "副本列表", "副本")] }); return; }
  const 翻倍 = 参.翻倍;
  const p = attrs(ctx, u);
  let 旧 = 战斗记录(ctx, u);
  if (战斗已死(旧)) { 清死战斗(ctx, u); 旧 = null; }   // 2.5.31：脏记录自愈
  if (旧 && !旧.结果) {
    await reply(ctx, t, "你还有一场没打完的战斗（【" + 旧.名称 + "】BOSS 血量 " + 旧.bhp + "/" + 旧.bhpMax + "）。", {
      标题: "挑战失败", 行组: [row(actBtn("xg7", "⚡继续战斗", "xgpanel"), actBtn("xg8", "⚡放弃战斗", "xgflee"))]
    });
    return;
  }
  // 3.0.0（需求 25 追加）：部分 BOSS 有等级门槛（花妖系列 / 金币兽 Lv.50 起打，字段由 boss.mjs 的 需等级 提供）
  //   放在「转生 / 段位」校验之前 —— 门槛是最直白的提示，玩家先看到「需要 Lv.50」而不是「需要转生」
  {
    const 需 = Math.max(0, Math.floor(Number(d.需等级) || 0));
    if (需 > 0 && Number(p.等级) < 需) {
      await reply(ctx, t, [
        "【" + d.名 + "】需要 **Lv." + 需 + "** 才能挑战（你 Lv." + p.等级 + "）。",
        "",
        "先去低段副本 / `星甲打坐` / `星甲探索` 升级；等级到了再来。"
      ].join("\n"), {
        标题: "挑战失败",
        行组: [row(btn("xg13", "副本列表", "副本"), btn("xg13b", "BOSS列表", "BOSS列表"), actBtn("xg13c", "⚡打坐", "meditate"), btn("xg13d", "星甲菜单", "星甲菜单"))]
      });
      return;
    }
  }
  if (d.转 && p.转生 < d.转) { await reply(ctx, t, "【" + d.名 + "】需要转生 " + d.转 + " 次（你 " + p.转生 + "）。", { 标题: "挑战失败" }); return; }
  if (p.等级 < d.段) {
    await reply(ctx, t, [
      "等级不足：【" + d.名 + "】需要 **" + d.段 + "** 级，你当前 Lv." + p.等级 + "。",
      "",
      "可以先打低段副本 / `打坐` / `探索` 升级。"
    ].join("\n"), {
      标题: "挑战失败",
      行组: [row(btn("xg9", "副本列表", "副本"), actBtn("xg10", "⚡打坐", "meditate"), actBtn("xg11", "⚡探索5次", "explore|5"), btn("xg12", "菜单", "菜单"))]
    });
    return;
  }
  if (p.血量 <= 0) { await reply(ctx, t, "血量归零，先 `星甲修复战甲` 或使用药品。", { 标题: "挑战失败" }); return; }
  // 2.5.0：操作冷却 2 秒（防止连点）
  const 操作剩 = 剩操作冷却(ctx, u);
  if (操作剩 > 0) { await reply(ctx, t, "操作太快了，请等 **" + (操作剩 / 1000).toFixed(1) + "** 秒。", { 标题: "⏳ 操作冷却" }); return; }
  // 2.5.0：副本 / BOSS 共用冷却（副本 10 分钟、BOSS 20 分钟），刷新卡可清
  const 冷 = 剩挑战冷却(ctx, u);
  if (冷 > 0) {
    const v = 取挑战冷却(ctx, u) || {};
    await reply(ctx, t, [
      "【" + (v.类型 || "副本") + "】冷却中，还需 " + wait(冷) + "。",
      "副本 / BOSS 冷却 **各 " + Math.round(Math.max(副本冷却毫秒, BOSS冷却毫秒) / 60000) + " 分钟**（共用；翻倍挑战按次数叠冷却）",
      // 3.0.0（需求 B）：一张刷新卡只清 20 分钟，剩余多就提示要几张
      "刷新卡 **一张清 " + 刷新卡清分钟 + " 分钟** —— 当前还需 **" + 刷新卡需要张数(ctx, u) + "** 张（`星甲使用刷新卡" + 刷新卡需要张数(ctx, u) + "`）"
    ].join("\n"), { 标题: "⏳ 冷却中", 行组: [row(actBtn("xcu", "⚡用1张刷新卡", "useitem|刷新卡|1"), btn("xcw", "用" + 刷新卡需要张数(ctx, u) + "张清完", "使用刷新卡" + 刷新卡需要张数(ctx, u)), btn("xcd", "星甲菜单", "星甲菜单"))] });
    return;
  }
  // 2.4.0：BOSS 入场消耗「金币」；副本入场消耗「星羽」
  const 入场币 = d.id >= 200 ? "金币" : "星羽";
  const 入场额 = Number(d.需币) || 0;
  const 入场余额 = 入场币 === "金币" ? p.金币 : p.星羽;
  if (入场额 > 0 && 入场余额 < 入场额) {
    await reply(ctx, t, [
      "进入【" + d.名 + "】需要 **" + kfmt(入场额) + "** " + 入场币 + "（你有 " + kfmt(入场余额) + "）。",
      入场币 === "金币" ? "金币来源：卖装备 / 卖菜 / `星甲兑换金币`" : "星羽来源：挖矿 / 打工 / 副本"
    ].join("\n"), {
      标题: "挑战失败",
      行组: 入场币 === "金币"
        ? [row(btn("xg14", "兑换金币", "兑换金币"), btn("xg15", "一键卖装备", "一键卖#装备"), btn("xg16", "BOSS列表", "BOSS列表"))]
        : [row(btn("xg14", "挖矿", "挖矿"), btn("xg15", "打工", "打工"), btn("xg16", "副本列表", "副本"))]
    });
    return;
  }
  // 2.5.2：BOSS 还要消耗花，数量 = 金币 ÷ 5（例 2500 金币 → 500 花）；副本不消耗花
  const 需花 = d.id >= 200 ? Math.max(1, Math.ceil(入场额 / 5)) : 0;
  if (需花 > 0 && hasItem(ctx, u, "花") < 需花) {
    await reply(ctx, t, [
      "进入【" + d.名 + "】需要 **" + 需花 + "** 朵花（你 " + hasItem(ctx, u, "花") + " 朵）。",
      "花与金币的比例是 5 : 1（花 = 入场金币 ÷ 5）。",
      "花来源：花妖系列 BOSS（1000 / 5000 / 10000 朵）、普通 BOSS 掉落、商店 250 星羽一朵。"
    ].join("\n"), {
      标题: "挑战失败", 行组: [row(btn("xg17", "买花", "购买#花#10"), btn("xg18", "BOSS列表", "BOSS列表"), btn("xg19", "星甲菜单", "星甲菜单"))]
    });
    return;
  }
  if (入场额) {
    if (入场币 === "金币") dset(ctx, P.金币, u, p.金币 - 入场额);
    else addCoin(ctx, u, -入场额);
  }
  if (需花) takeItem(ctx, u, "花", 需花);
  const 血量上限 = 我血量上限(p);
  // 3.2.0（需求 1）：蓝量改全局资源 —— 开战**继承**当前全局蓝量（不再每场补满），战斗结束写回
  const 蓝顶 = Math.max(10, Number(p.蓝量上限) || 蓝量上限(p));
  const 起蓝 = Math.max(0, Math.min(蓝顶, Number(p.蓝量) || 0));
  // 2.8.0（需求 12）：副本 / BOSS 出场属性按挑战者战力动态缩放（±15% 内），写进战斗记录便于复盘
  const 挑战战力 = pwrOf(ctx, u);
  // 3.0.0（需求 A）：翻倍挑战 —— 血量 ×N、其它属性 ×1.5（固定），见 dungeon.mjs 翻倍敌数据()
  const 敌 = 翻倍敌数据(d, 挑战战力, 翻倍);   // 里面已经把 血 ×N、攻防等 ×1.5
  const boss总血 = BOSS总血量(敌, 血量上限);
  const 冷却毫秒 = 翻倍冷却毫秒(d.id >= 200, 翻倍);
  const 记录 = {
    副本: d.id, 名称: d.名, 轮: 0, 结果: "",
    hp: 血量上限, hpMax: 血量上限, mp: 起蓝, mpMax: 蓝顶, sp: 1, spMax: 技能点上限,
    bhp: boss总血, bhpMax: boss总血, 敌方阶段: 0,
    攻: 攻击力(p), 防: p.防御, 暴击率: p.暴击率, 暴伤: p.暴伤, 闪避: p.闪避,
    累计伤害: 0, 累计受伤: 0, 日志: [], 开始: Date.now(),
    次数: 加挑战次数(ctx, u, d.id, 翻倍),
    // 3.0.0（需求 A）：翻倍次数写进战斗记录，战斗中的每一回合都按它放大敌方属性
    翻倍: 翻倍,
    // 2.8.0：动态缩放系数 + 玩家词条快照（整场战斗用同一份，保证数值可复盘）
    挑战战力: 挑战战力, 缩放: Number(敌 && 敌.缩放) || 1, 我词条: p.词条 || {},
    目标: { scope: t.scope, group_openid: t.group_openid, user_openid: t.user_openid, mention_openid: t.mention_openid }
  };
  dset(ctx, P.副本进度, u + "_" + d.id, Date.now());
  // 2.5.0：开战即进入共用冷却 + 操作冷却（3.0.0：翻倍挑战冷却 ×N）
  设挑战冷却翻倍(ctx, u, d.id >= 200, 翻倍);
  设操作冷却(ctx, u);
  存战斗(ctx, u, 记录);
  await reply(ctx, t, [
    "战斗开始！",
    "",
    "【" + d.名 + "】挡在了你面前。",
    // 2.10.0（需求 4.1）：血量 / 攻 / 防 全部固定（只由段位决定），不再有「+ 你的血量 × N」与动态缩放
    "BOSS血量 " + kfmt(boss总血) + "（固定数值 · 段位 " + d.段 + " 决定" + (翻倍 > 1 ? " · 翻倍 " + 翻倍 + " 次 → 基础血量 ×" + 翻倍 : "") + "）",
    (翻倍 > 1
      ? "🔥 **翻倍挑战 " + 翻倍 + " 次**：血量 ×" + 翻倍 + " · 其它属性（攻/防/暴击/暴伤/词条）固定 ×" + 翻倍属性倍 + " · 冷却 " + Math.round(冷却毫秒 / 60000) + " 分钟 · 掉落与保底按 " + 翻倍 + " 次结算 · 入场费只收 1 份 · 中途没药失败也只按 1 份入场返还 50%"
      : ""),
    (参.夹紧 ? "（你填的翻倍 " + 参.请求 + " 次已夹到 " + 翻倍 + " 次：上限 " + 翻倍上限 + " 次）" : ""),
    (d.id >= 200 ? "敌方为固定数值，不随你的战力缩放。" : "普通副本为固定数值，不随你的战力缩放。"),
    "你的血量 " + 血量上限 + " · 技能点 3",
    // 3.2.0（需求 1）：开战就报当前全局蓝量（不足会自动喝蓝药，没蓝药会提醒买）
    "你的蓝量 " + 起蓝 + "/" + 蓝顶 + "（全局蓝量 · 每回合回 5 点 · 不够自动喝蓝药）",
    "",
    "**回复 请决定下一步操作**"
  ].filter((x) => x !== "").join("\n"), {
    标题: "⚔️ 副本战斗" + (翻倍 > 1 ? "（翻倍 " + 翻倍 + "）" : ""),
    行组: [row(actBtn("ba1", "⚡普攻", "ba|atk"), actBtn("ba2", "⚡技能1", "ba|skill|1"), actBtn("ba3", "⚡技能2", "ba|skill|2"), actBtn("ba4", "⚡治疗", "ba|heal"), actBtn("ba5", "⚡逃跑", "ba|flee"))]
  });
}


// 2.4.2：大数显示（1 亿以上用「亿」，与新版 UI 一致）
export function 大数(v) {
  const n = Number(v) || 0;
  if (n >= 1e8) return (n / 1e8).toFixed(4) + "亿";
  if (n >= 1e4) return (n / 1e4).toFixed(2) + "万";
  return String(Math.floor(n));
}


export async function 战斗面板(ctx, t, u, 指定) {
  // 3.1.0（需求 1）：允许传入「刚被打死的战斗记录」——先播最后一回合面板，再走结算
  let rec = 指定 || 战斗记录(ctx, u);
  // 2.5.31：脏记录自愈 —— 血量已归零却仍挂着「未完成」的战斗会让玩家彻底卡死
  if (!指定 && 战斗已死(rec)) { 清死战斗(ctx, u); rec = null; }
  if (!rec) { await reply(ctx, t, "你当前没有进行中的战斗。\n发 `星甲副本` 或 `星甲BOSS列表` 选一个开打，或发 `星甲天下楼` 爬塔。", { 标题: "⚔️ 战斗", 按钮: [btn("xg19", "副本列表", "副本"), btn("xg20", "BOSS列表", "BOSS列表"), btn("xg21", "天下楼", "天下楼")] }); return; }
  const d = 战斗敌(rec);   // 3.0.0：翻倍挑战时敌方属性已按 ×1.5 放大
  const p = attrs(ctx, u);
  const 是BOSS = !!d && Number(d.id) >= 200;
  // 2.9.12：BOSS 名不再加「公会·」前缀（显示层直接用名字；数据键不受影响，为后续按来源加前缀留好结构）
  const 名 = rec.天下楼 ? ("天下楼·第" + rec.层 + "层 " + S(rec.名称)) : S(rec.名称);
  // 2.10.0（需求 4.11）：战斗信息**只显示当前这一回合** —— rec.日志 由每回合整段替换
  //   （战斗行动 / 一键出招 结束时 = 本回合那几行），不再 slice 累积上一条战斗状态。
  const 战斗信息 = (Array.isArray(rec.日志) ? rec.日志 : []);
  // 2.10.0（需求 4.4）：三档特殊状态常驻显示；未进入（档 0 平静）时不显示这一行
  const 状态行 = 敌方阶段状态行(rec.敌方阶段);
  // 3.0.0（需求 25/26）：职业 + 技能序号列表（带消耗）+ 自动出招策略
  const 职业 = 读职业(ctx, u);
  const 技能 = 我的技能表(ctx, u);
  const 自动 = 读自动(ctx, u);
  const 策略行 = (自动 && 自动.开 && !自动.结束)
    ? "🃏 当前策略：" + 出招策略文案(自动.技能) + (自动.技能 > 0 ? "（技能点 / 蓝量够就放技能，不够则普攻）" : "（纯普攻）")
    : "";
  const 行 = [
    ["用户:" + gid(ctx, u) + "　昵称:" + p.昵称, true],
    ["职业:" + (职业 || "未转职（`星甲职业` 查看 / `星甲转职#剑修`）"), false],
    ["血量:" + rec.hp + "/" + rec.hpMax, true],
    ["蓝量:" + rec.mp + "/" + rec.mpMax + "（全局蓝量 · 不够自动喝蓝药）", true],
    ["技能点:" + (Number(rec.sp) || 0) + "/" + (rec.spMax || 技能点上限), true],
    // 3.0.0（需求 A）：翻倍进度一眼看到（第几场 / 总场次），以及本场的放大口径
    ...(翻倍次数(rec.翻倍) > 1
      ? [["🔥 翻倍 " + 翻倍次数(rec.翻倍) + " 次 · 血量 ×" + 翻倍次数(rec.翻倍) + " · 攻防等 ×" + 翻倍属性倍 + " · 冷却 " + Math.round(翻倍冷却毫秒(是BOSS, 翻倍次数(rec.翻倍)) / 60000) + " 分钟 · 掉落/保底按 " + 翻倍次数(rec.翻倍) + " 次结算", false]]
      : []),
    ...(策略行 ? [[策略行, false]] : []),
    // 3.0.0（需求 25）：技能序号列表 —— 只列当前职业的专属技能
    ...(技能.length
      ? 技能.map((s) => ["　技能" + s.序 + " " + s.名 + "　" + Math.round(s.倍 * 100) + "%（" + 技能效果文案(s) + "）　耗 " + s.耗 + " 点 / " + s.蓝 + " 蓝", true])
      : [["　未转职：没有可用技能（`星甲职业` → `星甲转职#剑修`）", true]]),
    ["🃏 自动卡:" + hasItem(ctx, u, 自动卡名) + " 张（一键出招 1 招耗 1 张 · **每 " + (自动每击毫秒 / 1000) + " 秒出 1 招** · 挑战时长上限 " + 自动时长上限小时 + " 小时）", false],
    // 2.5.56：**非自动也显示挑战时间**（超过 50 小时服务器每小时检测一次并自动放弃）
    ["⏱ " + 挑战时间文本(rec, true), false],
    ["", true],
    ...(状态行 ? [["当前状态: " + 状态行, false]] : []),
    ["战斗信息（本回合）: " + 名, false],
    ["", true]
  ];
  if (战斗信息.length) for (const x of 战斗信息) 行.push(["　" + x, true]);
  else 行.push(["　战斗刚打响，" + 名 + " 正在打量你。", true]);
  行.push(["", false]);
  行.push(["boss血量: " + kfmt(rec.bhp) + " / " + kfmt(rec.bhpMax), false]);
  // 2.10.0（需求 4.1）：三档全部固定数值，不再展示「动态缩放」
  行.push(["队伍信息", false]);
  行.push(["", true]);
  行.push([p.昵称 + "（" + gid(ctx, u) + "）", true]);
  行.push(["　技能点:" + (Number(rec.sp) || 0) + "　累计伤害:" + 大数(rec.累计伤害), true]);
  行.push(["　累计承伤:" + 大数(rec.累计受伤), true]);
  行.push(["　血量:" + rec.hp + "/" + rec.hpMax, true]);
  行.push(["　蓝量:" + rec.mp + "/" + rec.mpMax + "（全局）", true]);
  行.push(["　用户:" + gid(ctx, u), true]);
  行.push(["", true]);
  行.push(["请决定下一步操作", true]);
  行.push(["一键出招：`星甲一键出招10`（纯普攻）或 `星甲一键出招3:1000`（**优先技能3，技能点 / 蓝量不够就普攻**，共 1000 招）· 也可 `星甲一键出招2小时`（按时长，上限 " + 自动时长上限小时 + " 小时）· 每招 1 张自动卡 · **每 " + (自动每击毫秒 / 1000) + " 秒 1 招** · 有药自动续战 / " + (rec.天下楼 ? "没药自动放弃（塔无入场费）" : "没药放弃返 50%"), true]);
 行.push(["自动出招进行中时：`星甲自动详情` 看实时进度 · `星甲停止出招` 中断", true]);
  行.push(["你已经挑战" + (rec.次数 || 0) + "次（含失败）", true]);
  // 3.0.0（需求 4.9）：副本与 BOSS 现在共用同一组三档爆率与保底（10% / 5% / 1%，保底 10 / 25 / 100），
  //   所以只要不是天下楼，就统一显示三档装备的爆率 + 保底剩余。
  if (!rec.天下楼) {
    行.push(["普通装备：爆率 " + Math.round(BOSS普通爆率 * 100) + "% · 保底还剩 " + 剩普通保底(ctx, u, rec.副本) + " 次必出", true]);
    行.push(["史诗装备：爆率 " + Math.round(BOSS史诗爆率 * 100) + "% · 保底还剩 " + 剩史诗保底(ctx, u, rec.副本) + " 次必出", true]);
    行.push(["传说装备：爆率 " + Math.round(BOSS传说爆率 * 100) + "% · 保底还剩 " + 剩传说保底(ctx, u, rec.副本) + " 次必出", true]);
  } else {
    // 2.5.31：天下楼没有专属装备 / 保底，别显示「本副本无保底 · 爆率 0%」误导玩家
    行.push(["🏔️ 塔内奖励：经验 / 星羽 / 星核 + 材料（无入场费 · 不占副本冷却 · 失败不掉层）", true]);
    行.push(["塔内规则：单次伤害上限与副本一致（普攻 25% / 技能 35%）· 总承伤 = 你的血量 × 1~3 倍，30 层起不吃药必死", true]);
  }
  行.push(["", true]);
  // 2.7.0：天下楼显示层数与已进行回合数（回合限制已取消）
  if (rec.天下楼) 行.push(["🏔️ 天下楼第 " + rec.层 + " 层　已进行 " + rec.轮 + " 回合（无回合限制）", true]);
  行.push(["血量条 " + 条带(rec.hp, rec.hpMax), true]);
  await reply(ctx, t, 灰混(行), {
    标题: "⚔️ 战斗 " + 名,
    行组: [
      row(actBtn("bb1", "⚡普攻", "ba|atk"), actBtn("bb2", "⚡技能", "ba|skill|1"), actBtn("bb3", "⚡背包", "bag|1"), actBtn("bb4", "⚡使用", "baguse")),
      row(actBtn("bb5", "⚡攻(回)", "ba|atk"), actBtn("bb6", "⚡副本", "dgpanel"), actBtn("bb7", "⚡放弃", "ba|flee"), btn("bb8", "一键自动", "autoatk|10"), btn("bb18", "自动详情", "autodetail")),
      // 3.0.0（需求 25）：技能按钮只列当前职业技能（未转职则给「职业面板」入口）
      ...(技能.length
        ? [row.apply(null, 技能.map((s) => btn("bb2" + s.序 + "a", "技能" + s.序, "星甲技能" + s.序)))]
        : [row(btn("bb9", "普攻", "普攻"), btn("bb10", "技能面板", "技能"), btn("bb25", "职业面板", "职业"))]),
      row(btn("bb17", "买自动卡", "购买#自动卡#10"), btn("bb19", "出招详情", "autodetail"), btn("bb26", "职业面板", "职业"), btn("bb27", "技能面板", "技能"))
    ]
  });
}


/* ---------- 2.3.0 自动用药：手动战斗 / 一键出招通用 ---------- */
// 还有药就自动服用（血量越低越优先），没药才返回 ok:false → 调用方据此「自动放弃」
export function 自动服药(ctx, u, rec, 强制) {
  // 3.0.0（需求 4.4）：自动回血默认开启；玩家关掉后就不再自动嗑药（手动「治疗」动作不受影响）
  if (!强制 && S(dget(ctx, P.自动回血, u, "开启")) === "关闭") return { ok: true, 药: "", 回: 0, 剩: -1, 已关: true };
  const 缺 = Math.max(0, rec.hpMax - rec.hp);
  if (缺 <= 0) return { ok: true, 药: "", 回: 0, 剩: -1 };
  // 2.5.0：按药品的实际回血数值补够，不再「吃 1 个就回满」
  const 有药 = 药品集.filter((nm) => 药品回血[nm] > 0 && hasItem(ctx, u, nm) > 0);
  if (!有药.length) return { ok: false, 药: "", 回: 0, 剩: 0 };
  const 血比 = rec.hpMax > 0 ? rec.hp / rec.hpMax : 0;
  // 没到危险线就不浪费药（2.5.9：自动回血线 40% → 30%）
  if (!强制 && 血比 > 0.3) return { ok: true, 药: "", 回: 0, 剩: -1 };
  // 从小到大用药，避免浪费大药
  const 顺序 = 有药.slice().sort((a, b) => (药品回血[a] || 0) - (药品回血[b] || 0));
  let 回 = 0, 用了 = {};
  for (const nm of 顺序) {
    while (hasItem(ctx, u, nm) > 0 && 回 < 缺) {
      takeItem(ctx, u, nm, 1);
      回 += 药品回血[nm] || 60;
      用了[nm] = (用了[nm] || 0) + 1;
    }
    if (回 >= 缺) break;
  }
  const 实际 = Math.min(回, 缺);
  rec.hp = Math.min(rec.hpMax, rec.hp + 实际);
  const 名 = Object.keys(用了).map((k) => k + "×" + 用了[k]).join("+");
  const 首 = Object.keys(用了)[0] || "";
  return { ok: true, 药: 名, 回: 实际, 剩: 首 ? hasItem(ctx, u, 首) : 0 };
}


// 自动用药的简短提示（省 token）
export function 用药提示(r, rec) {
  if (!r.药) return "";
  return "💊 自动用药【" + r.药 + "】+" + kfmt(r.回) + "血 → " + rec.hp + "/" + rec.hpMax + "（剩" + r.剩 + "）";
}


// 2.5.27：自动出招「续命」**必须有药品** —— 血量归零时吃库存药回满，继续打；
//   **没药 → 不再免费回血，直接判挑战失败**（走失败结算：自动放弃 + 返还 50% 入场费）。
export function 自动续命(ctx, u, rec) {
  if (S(dget(ctx, P.自动回血, u, "开启")) === "关闭") return null;
  if (!药品集.some((nm) => 药品回血[nm] > 0 && hasItem(ctx, u, nm) > 0)) return null;
  const r = 自动服药(ctx, u, rec, true);
  if (rec.hp > 0) return { 名: r.药 || "药品", 回: r.回 };
  return null;
}


// 2.5.26：无 CD「快速出招」已移除 —— 统一拦截提示（词表保留，避免静默无响应）
export async function 快速出招已移除(ctx, t) {
  await reply(ctx, t, [
    "🚧 无CD「快速出招」已移除。",
    "",
    "现在只剩 `星甲一键出招N`（**每招消耗 1 张自动卡**，服务器**每 " + (自动每击毫秒 / 1000) + " 秒代你出 1 招**，进度发 `星甲自动详情` 看）。",
    "战斗中被打到 0 血时：**有药会自动回血续战**；没药则自动放弃并返还 50% 入场费。"
  ].join("\n"), {
    标题: "🚧 已移除",
    行组: [row(btn("rmf1", "一键出招×10", "autoatk|10"), btn("rmf2", "出招详情", "autodetail"), btn("rmf3", "战斗面板", "战斗"))]
  });
}


/* ============================================================
 * 3.0.0 修复（用户报「莫名其妙被击倒」）：玩家出手统一入口
 *
 * 根因：守方的「反击 / 反伤」在 伤害结算() 里是按**未截断**的总伤算的
 *   （`反击伤害% × (主 + 追击)`），而主伤害随后才被 单刀截断() 砍到「单刀上限」。
 *   玩家攻击力被控制台改高后，打怪只有 12 万（单刀上限），但反击仍是 5 亿级 → 一拳把自己反弹死，
 *   战报里只显示「你造成了 12 万 / BOSS 打了你 7812」，所以看起来完全「莫名其妙」。
 *   （实测存档：累计受伤 529,710,219 而单刀上限只有 120,597。）
 *
 * 现在：战斗行动 / 技能出手 / 一键出招 全部走 玩家出手()，
 *   ① 反击 / 反伤 打回玩家时**按「这一刀实际打出的伤害」封顶**（不超过你造成的伤害）；
 *   ② 闪击（守方闪避后弹反）额外加一层「血量上限 35%」硬顶，防止被单次弹反秒杀；
 *   ③ 封顶发生时行尾标注「（已按单次上限封顶）」，战报能看懂。
 * ============================================================ */
export function 玩家出手(rec, d, 倍率, 类型, 技能名) {
  const r = 我方伤害(rec, d);
  const 行 = [];
  const 敌名 = S(rec.名称);
  let 伤 = 0;
  if (r.闪避) {
    行.push("✦" + 敌名 + "闪避成功，你造成了0 伤害");
  } else {
    const 主 = Math.max(1, Math.round(r.dmg * (倍率 || 1)));
    const 追 = r.追击 > 0 ? Math.round(r.追击) : 0;
    // 3.1.21：普攻单次 ≤25%、技能整段（主伤 + 追击等）合计 ≤35%（用户要求上调）
    let 合计 = 主 + 追;
    if (类型 === "skill") {
      const 段顶 = Math.max(1, Math.round((Number(rec && rec.bhpMax) || 0) * 0.35));
      if (合计 > 段顶) { 合计 = 段顶; 行.push("（技能整段合计已达上限 35%）"); }
    }
    伤 = 单刀截断(rec, 类型, 合计, 行);
    const 实 = 实际伤害(rec, 伤);
    rec.bhp = Math.max(0, rec.bhp - 实);
    rec.累计伤害 = (Number(rec.累计伤害) || 0) + 实;
    const 显示追 = Math.min(追, 伤);
    const 显示主 = Math.max(1, 伤 - 显示追);
    行.push((r.暴 ? "✧" : "✦") + "你对" + 敌名 + "造成了 " + 大数(显示主)
      + (r.真伤 ? (r.暴 ? " 点真实暴击伤害" : " 点真实伤害") : (r.暴 ? " 暴击伤害" : " 伤害"))
      + (r.抗暴 ? "（被抗暴）" : "") + (实 < 伤 ? "（溢出，击杀）" : ""));
    if (显示追 > 0) 行.push("✦你对" + 敌名 + "造成了 " + 大数(显示追) + " 追击伤害(" + Math.round(显示追 / 显示主 * 100) + "%)");
    const 进阶 = 推进敌方阶段(rec, rec.名称);
    if (进阶.变化) 行.push(进阶.提示);
  }
  if (r.吸血 > 0) {
    const 回 = Math.min(r.吸血, Math.max(0, rec.hpMax - rec.hp));
    if (回 > 0) { rec.hp = Math.min(rec.hpMax, rec.hp + 回); 行.push("✦你吸了" + 敌名 + " " + 大数(回) + " 点血"); }
  }
  // 守方「反击 / 闪击 / 反伤」打回自己身上：这里才是修复点
  for (const f of (r.反伤 || [])) {
    const 原 = Math.max(1, Math.round(Number(f.伤害) || 0));
    const 顶 = f.类型 === "闪击"
      // 闪击按敌方自身攻击算（与玩家伤害无关）→ 只受「血量上限 35%」硬顶约束
      ? Math.max(1, Math.round((Number(rec.hpMax) || 0) * 0.35))
      // 反击 / 反伤 = 你打出的伤害 × 比例 → 按「本刀实际造成的伤害」封顶
      : Math.max(1, Math.min(Math.max(1, 伤), Math.round((Number(rec.hpMax) || 0) * 0.35)));
    const 实 = Math.min(原, 顶);
    rec.hp = Math.max(0, rec.hp - 实);
    rec.累计受伤 = (Number(rec.累计受伤) || 0) + 实;
    const 封顶 = 实 < 原 ? "（已按单次上限封顶）" : "";
    if (f.类型 === "闪击") 行.push("✦" + 敌名 + "发动了闪击进行弹反", (f.暴 ? "✧" : "✦") + 敌名 + "对你造成了 " + 大数(实) + " 点闪击" + (f.暴 ? "真实暴击" : "") + "伤害" + 封顶);
    else if (f.类型 === "反击") 行.push("✦" + 敌名 + "发动了反击，减免了" + 大数(实) + "伤害，并对你造成了" + 大数(实) + "伤害" + 封顶);
    else 行.push("✦" + 敌名 + "发动了反伤，你受到 " + 大数(实) + " 反弹伤害" + 封顶);
  }
  return { 伤: 伤, 闪避: r.闪避, 暴: r.暴, 吸血: r.吸血, 反伤: r.反伤 || [], 行: 行 };
}


/* ============================================================
 * 3.0.0（需求 25 / 26）：职业专属技能结算 + 自动出招策略解析
 *  · 技能结构见 cook.mjs 的 职业表：{ 序, 名, 倍, 段, 耗(技能点), 蓝(蓝量), 破防?, 暴击?, 回血?, 减伤? }
 *  · 技能点 / 蓝量 由调用方（战斗行动 / 一键出招）先扣，这里只负责结算效果
 *  · 破防 = 本次出手临时降目标防御（克隆 d，不改 boss.mjs / dungeon.mjs 的静态表）
 *  · 暴击 = 本次出手临时 +暴击率（打完还原，不写存档）
 *  · 回血 = 按血量上限 % 回复；减伤 = 接下来 2 回合受到的伤害降低 %
 * ============================================================ */
export function 技能出手(rec, d, 技) {
  const s = 技 || {};
  const 行 = [];
  const 段数 = Math.max(1, Math.min(5, Math.floor(Number(s.段) || 1)));
  const 总倍 = Math.max(0.1, Number(s.倍) || 1);
  const 每段 = Math.max(0.1, 总倍 / 段数);
  let 目标 = d;
  const 破 = Math.max(0, Math.min(90, Number(s.破防) || 0));
  if (破 > 0) {
    const 原防 = Math.max(0, Math.round(Number(d && d.防) || 0));
    const 新防 = Math.max(0, Math.round(原防 * (1 - 破 / 100)));
    目标 = Object.assign({}, d, { 防: 新防 });
    行.push("✦破防 " + 破 + "%（目标防御 " + kfmt(原防) + " → " + kfmt(新防) + "）");
  }
  const 暴加 = Math.max(0, Number(s.暴击) || 0);
  const 旧暴 = Number(rec.暴击率) || 0;
  if (暴加 > 0) {
    rec.暴击率 = 旧暴 + 暴加;
    行.push("✦暴击率 +" + 暴加 + "%（本次出手 " + rec.暴击率 + "%）");
  }
  let 伤 = 0;
  try {
    for (let i = 0; i < 段数; i++) {
      const 出 = 玩家出手(rec, 目标, 每段, "skill", s.名);
      伤 += 出.伤;
      for (const x of 出.行) 行.push(x);
      if (Number(rec.bhp) <= 0) break;   // 目标已倒下 → 剩余段数不再结算
    }
  } finally {
    if (暴加 > 0) rec.暴击率 = 旧暴;
  }
  const 回 = Math.max(0, Number(s.回血) || 0);
  if (回 > 0) {
    const 上限 = Math.max(0, Number(rec.hpMax) || 0);
    const 额 = Math.min(Math.round(上限 * 回 / 100), Math.max(0, 上限 - (Number(rec.hp) || 0)));
    if (额 > 0) { rec.hp = Math.min(上限, (Number(rec.hp) || 0) + 额); 行.push("💚回血 " + kfmt(额) + "（" + rec.hp + "/" + rec.hpMax + "）"); }
    else 行.push("💚回血 " + 回 + "%：血量已满，无需回复");
  }
  const 减 = Math.max(0, Math.min(80, Number(s.减伤) || 0));
  if (减 > 0) {
    rec.减伤 = { 值: 减 / 100, 剩: 2 };
    行.push("🛡减伤 " + 减 + "%（接下来 2 回合）");
  }
  return { 伤: 伤, 行: 行 };
}


// 取出并消耗「减伤」：返回本次承伤要打的折扣（0 = 没有减伤）
export function 消耗减伤(rec) {
  const v = rec && rec.减伤;
  if (!v || typeof v !== "object") return 0;
  const 值 = Math.max(0, Math.min(0.8, Number(v.值) || 0));
  const 剩 = Math.max(0, Math.floor(Number(v.剩) || 0));
  if (值 <= 0 || 剩 <= 0) { rec.减伤 = 0; return 0; }
  v.剩 = 剩 - 1;
  if (v.剩 <= 0) rec.减伤 = 0;
  return 值;
}


/* 自动出招策略解析（需求 19）：
 *   一键出招10      → { 技能序号: 0, 次数: 10 }   纯普攻
 *   一键出招3:1000  → { 技能序号: 3, 次数: 1000 } 优先放技能3，技能点/蓝量不够就普攻
 *   兼容 星甲 前缀、空格、全角冒号、快速 前缀（快速 返回 快速:true 由调用方回「已移除」）
 *   按时长（2小时 / 30分钟）不在这里解析，仍走 router 的 解析挑战时长。 */
export const 出招策略正则 = /^(快速|无cd|无CD|极速|秒)?(?:一键出招|出招|自动出招|一键自动|连击|自动打击)\s*#?\s*(?:([0-9]{1,2})\s*[:：]\s*)?([0-9]{0,7})$/i;


export function 解析出招策略(文本) {
  const s = S(去星甲(S(文本)));
  if (!s) return null;
  const m = s.match(出招策略正则);
  if (!m) return null;
  const 有冒号 = m[2] !== undefined;
  const 序号 = 有冒号 ? Math.floor(Number(m[2]) || 0) : 0;
  const 次数 = m[3] === "" ? 0 : Math.floor(Number(m[3]) || 0);
  if (!有冒号 && 次数 <= 0) return null;        // 「一键出招」光秃秃 → 交给老分支按默认 10 次
  return { 快速: !!m[1], 技能序号: Math.max(0, 序号), 次数: 次数 > 0 ? 次数 : 10, 原文: s };
}


export async function 战斗行动(ctx, t, u, act, 档位) {
  // 2.5.54：自动代打进行中不允许手动插招（否则两边同时推进会乱节奏/重复结算）
  const 自动中 = 读自动(ctx, u);
  if (自动中 && 自动中.开 && !自动中.结束 && !自动静默) {
    await reply(ctx, t, [
      "🃏 自动出招进行中（还剩 " + (Number(自动中.剩) || 0) + " 次，每 " + (自动每击毫秒 / 1000) + " 秒 1 招）",
      "",
      "想手动打：先发 `星甲停止出招`",
      "想看进度：发 `星甲自动详情`"
    ].join("\n"), {
      标题: "⏳ 自动出招中",
      行组: [row(btn("bb01", "自动详情", "autodetail"), btn("bb02", "停止出招", "autostop"), btn("bb03", "战斗面板", "战斗"))]
    });
    return;
  }
  const rec0 = 战斗记录(ctx, u);
  if (rec0 && !rec0.结果) {
    // 2.5.0：操作冷却 2 秒
    const 余 = 剩操作冷却(ctx, u);
    if (余 > 0) { await reply(ctx, t, "操作太快了，请等 **" + (余 / 1000).toFixed(1) + "** 秒再出招。", { 标题: "⏳ 操作冷却" }); return; }
    设操作冷却(ctx, u);
  }
  const rec = 战斗记录(ctx, u);
  if (!rec || rec.结果) { await reply(ctx, t, "当前没有进行中的战斗。", { 标题: "⚔️ 战斗", 按钮: [btn("bb8", "副本列表", "副本")] }); return; }
  // 2.5.56：已超过 50 小时的挑战直接判失败（不等每小时那一次扫描）
  if (await 超时自动放弃(ctx, t, u, rec)) return;
  const d = 战斗敌(rec);   // 3.0.0：翻倍挑战时这里已把敌方属性 ×1.5（血量在 bhp/bhpMax 里 ×N）
  if (!d) { await reply(ctx, t, "副本数据异常，战斗已结束。", { 标题: "⚔️ 战斗" }); 存战斗(ctx, u, null); return; }
  const p = attrs(ctx, u);
  const 模式 = S(act);
  if (模式 === "flee") {
    const ok2 = Math.random() < 0.5;
    rec.结果 = ok2 ? "逃跑成功" : "逃跑失败";
    if (!ok2) { const hurt = rnd(10, 30); 设血量(ctx, u, p.血量 - hurt); }
    战斗蓝量写回(ctx, u, rec);   // 3.2.0（需求 1）：逃跑同样把战斗内蓝量写回全局
    存战斗(ctx, u, rec);
    await reply(ctx, t, ok2 ? "你成功脱离了战斗。" : "逃跑失败，被对手追上挨了一下（血量 -10~30）。", {
      标题: "🏃 逃跑", 行组: [row(btn("bb9", "副本列表", "副本"), actBtn("bb10", "⚡看属性", "info"), btn("bb11", "菜单", "菜单"))]
    });
    return;
  }
  rec.轮 = (Number(rec.轮) || 0) + 1;
  // 3.1.21：战斗信息「单次显示单次」—— 本回合日志从空开始，不再从 rec.日志（上一回合）接着累积。
  //   原来这里 `= rec.日志`，导致每回合都把上一回合的战报带上，越积越多，面板显示上一次的信息。
  const 日志 = [];
  let 我伤 = 0;
  if (模式 === "skill") {
    // 3.0.0（需求 25/26）：技能改为「职业专属」—— 未转职没有技能；每个职业 5 个，消耗 技能点 + 蓝量
    const 职业 = 读职业(ctx, u);
    const 表 = 我的技能表(ctx, u);
    if (!表.length) {
      await reply(ctx, t, [
        "你还没有转职，用不了技能（旧的 8 档通用技能已下线）。",
        "",
        "转职：`星甲职业` 看 6 个职业 → `星甲转职#剑修`（" + 转职费 + " 星羽，需 Lv." + 转职等级 + "）",
        "转职后技能面板会变成该职业专属的 5 个技能。"
      ].join("\n"), {
        标题: "⚔️ 未转职",
        行组: [
          row(btn("bb20", "职业面板", "职业"), actBtn("bb21", "⚡普攻+1点", "ba|atk"), btn("bb22", "战斗面板", "战斗")),
          row(btn("bb23", "副本", "副本"), btn("bb24", "星甲菜单", "星甲菜单"))
        ]
      });
      return;
    }
    const 序 = Math.max(1, Math.min(表.length, Math.floor(Number(档位) || 1)));
    const 技 = 表[序 - 1];
    const 耗 = Math.max(0, Number(技.耗) || 0), 蓝 = Math.max(0, Number(技.蓝) || 0);
    if ((Number(rec.sp) || 0) < 耗) {
      await reply(ctx, t, [
        "技能点不足：【" + 技.名 + "】技能" + 序 + "（" + Math.round(技.倍 * 100) + "%）需要 **" + 耗 + "** 点。",
        "当前技能点：" + (Number(rec.sp) || 0) + " / " + (rec.spMax || 技能点上限),
        "",
        "普通攻击每次 +1 技能点，且无冷却；技能点上限 " + 技能点上限 + "。"
      ].join("\n"), {
        标题: "⚔️ 技能点不足",
        行组: [row(actBtn("bb12", "⚡普攻+1点", "ba|atk"), btn("bb13", "技能面板", "技能"), ...表.slice(0, 3).map((s) => btn("bb2" + s.序, "技能" + s.序, "星甲技能" + s.序)))]
      });
      return;
    }
    // 3.2.0（需求 3）：蓝量不足以放当前技能 / 蓝量 = 0 → **先自动喝蓝药**（便宜优先，常开不可关）
    //   喝完还不够（没有蓝药了）→ 弹出提醒并**禁止继续放技能**（普通攻击仍可用，普攻每回合回 5 蓝）
    if ((Number(rec.mp) || 0) < 蓝) {
      const 喝 = 自动喝蓝药(ctx, u, rec, 蓝);
      if (喝.药) 日志.push(回蓝提示(喝, rec));
      if (!喝.ok) {
        await reply(ctx, t, [
          "蓝量不足：【" + 技.名 + "】技能" + 序 + "需要 **" + 蓝 + "** 蓝，你只剩 " + (Number(rec.mp) || 0) + "。",
          "",
          "⚠️ " + 没蓝提醒 + "（自动回蓝已尝试：背包里没有能补够的蓝药）",
          "· 商店可买：青霜灵液（150 星羽 / 瓶，+50 蓝）、幽泉灵乳（500 星羽 / 瓶，+200 蓝）",
          "· 买好后发 `使用青霜灵液`（战斗中/战斗外都能喝）；也可 `使用蓝药` 自动挑最便宜的",
          "· 现在只能**普通攻击**（每次 +1 技能点、每回合回 5 蓝），技能已暂停"
        ].join("\n"), {
          标题: "🔵 没有蓝了，需要买蓝药",
          行组: [row(btn("bb25", "⚡普攻+1点", "ba|atk"), btn("bb28", "买蓝药", "商店"), btn("bb26", "技能面板", "技能"), btn("bb27", "战斗面板", "战斗"))]
        });
        return;
      }
      dset(ctx, P.战斗, u, rec);   // 蓝药已经真实消耗 → 先把补蓝后的记录落档
    }
    rec.sp = (Number(rec.sp) || 0) - 耗;
    rec.mp = Math.max(0, (Number(rec.mp) || 0) - 蓝);
    // 3.0.0：技能效果（多段 / 破防 / 暴击 / 回血 / 减伤）统一在 技能出手() 里结算
    日志.push("✦你发动【" + 技.名 + "】（技能" + 序 + " · " + 职业 + "）耗 " + 耗 + " 点 / " + 蓝 + " 蓝　剩余 " + rec.sp + " 点 / " + rec.mp + " 蓝");
    const 出手 = 技能出手(rec, d, 技);
    我伤 = 出手.伤;
    日志.push(...出手.行);
  } else if (模式 === "heal") {
    // 2.2.5：回血必须消耗药品（按小到大找第一个够用的）
    const 有药 = 药品集.filter((nm) => 药品回血[nm] > 0 && hasItem(ctx, u, nm) > 0);
    if (!有药.length) {
      await reply(ctx, t, "你没有药品了。\n可以用 `商店` 买（赤霄血露 30、碧髓回春液 120、玄元凝血膏 380…），或打副本掉花/血清。", {
        标题: "⚔️ 治疗失败", 行组: [row(btn("bh1", "商店买药", "商店#1"), actBtn("bh2", "⚡普通攻击", "ba|atk"))]
      });
      return;
    }
    if (rec.hp >= rec.hpMax) {
      await reply(ctx, t, "你的血量已满，不需要治疗。", { 标题: "⚔️ 治疗", 行组: [row(actBtn("bh3", "⚡普通攻击", "ba|atk"), actBtn("bh4", "⚡技能", "ba|skill|1"))] });
      return;
    }
    rec.mp = Math.max(0, rec.mp - 10);
    // 2.5.37 修复：药品回血**严格按商店数值**（赤霄血露 60 / 中 200 / 大 600 / 九幽血髓酿 2000 / 太虚还魂汤 5000）。
    //   原来这里多算了 `药品回血 × 1.2 + 血量上限 × 10%`，血 10 万的玩家每次白拿 1 万血 → 一瓶顶十几瓶，
    //   也导致「面板说要 168 瓶、实际几瓶就满」的错位。
    //   现在治疗 = 按需嗑药补满（从小到大用药、不浪费大药），**真实消耗多瓶**，日志显示实际用量。
    const 治 = 自动服药(ctx, u, rec, true);
    日志.push(p.昵称 + " 用【" + (治.药 || "药品") + "】治疗，恢复 " + kfmt(治.回) + " 血量（" + rec.hp + "/" + rec.hpMax + "）");
  } else {
    // 2.3.1：普通攻击 —— 每次 +1 技能点（3.0.0：上限 99999，见 技能点上限）
    // 3.0.0 修复：改走 玩家出手()，守方反击 / 反伤不会再按「未截断的原始伤害」把玩家反弹死
    const 出手 = 玩家出手(rec, d, 1, "atk", "");
    我伤 = 出手.伤;
    rec.sp = Math.min(Number(rec.spMax) || 技能点上限, (Number(rec.sp) || 0) + 1);
    日志.push(...出手.行, "技能点 +1（" + rec.sp + "）");
  }
  // 2.8.0：怪物被击倒时也可以靠「复活率」站起来（每场一次，默认怪物复活率为 0）
  // 2.10.0：尝试复活() 现在返回「复活后的血量」（null = 未触发）；致命打击只对玩家生效
  {
    const 怪血 = rec.bhp <= 0 ? 尝试复活(rec, 怪词条(d, 敌方阶段值(d, rec.敌方阶段)), "怪复活过") : null;
    if (怪血 !== null && rec.bhp <= 0) {
      rec.bhp = rec.bhpMax;
      日志.push("💫【" + S(rec.名称) + "】复活率触发，满血站了起来（每场一次）");
    }
  }
  if (rec.bhp <= 0) {
    // 3.1.0（需求 1）：先显示最后一回合战斗面板，再结算
    rec.日志 = 日志.slice(-12);
    存战斗(ctx, u, rec);
    try { await 战斗面板(ctx, t, u, rec); } catch (e) { /* ignore */ }
    if (rec.天下楼) { await 天下楼结算(ctx, t, u, rec, true); return; }
    await 结算战斗(ctx, t, u, rec, d, true); return;
  }
  // 2.3.0：出手后血量过低 → 自动喝药（没药就硬抗，倒下时再判定是否放弃）
  if (模式 !== "heal") {
    const 喝 = 自动服药(ctx, u, rec, false);
    if (喝.药) 日志.push(用药提示(喝, rec));
  }
  const 加倍 = 模式 === "heal" ? 0.5 : 1;
  // 2.5.2：BOSS / 副本的反击也要过「我方闪避」判定，闪避成功则 0 伤害并单独提示
  const 我闪避 = rec.闪避 === undefined ? (Number(attrs(ctx, u).闪避) || 0) : rec.闪避;
  // 2.9.7：敌方阶段已在本次玩家伤害结算后推进，并持久化在 rec.敌方阶段。
  // 天下楼 / 副本 / BOSS 的反击统一走 怪物伤害()（同一套公式 + 同一套词条）
  const rb = 怪物伤害(rec, d, 加倍, 我闪避);
  // 3.0.0（需求 25）：技能「减伤」在这里折扣本次承伤（闪避成功不消耗层数）
  const 减伤比 = rb.闪避 ? 0 : 消耗减伤(rec);
  if (减伤比 > 0) {
    const 原主 = Math.max(0, Number(rb.dmg) || 0), 原追 = Math.max(0, Number(rb.追击) || 0);
    rb.dmg = Math.max(0, Math.round(原主 * (1 - 减伤比)));
    rb.追击 = Math.max(0, Math.round(原追 * (1 - 减伤比)));
    日志.push("🛡 减伤 " + Math.round(减伤比 * 100) + "% 生效：承伤 " + 大数(原主 + 原追) + " → " + 大数(rb.dmg + rb.追击));
  }
  // 2.9.12：战报格式统一 —— BOSS 打玩家与玩家打 BOSS 同一套 ✦/✧ 格式
  if (rb.闪避) {
    日志.push("✦你闪避成功，" + S(rec.名称) + "对你造成了0 伤害");
  } else {
    const 怪主 = rb.dmg;
    const 怪追 = rb.追击 || 0;
    const 怪伤 = Math.max(1, 怪主 + 怪追);
    rec.hp = Math.max(0, rec.hp - 怪伤);
    rec.累计受伤 = (Number(rec.累计受伤) || 0) + 怪伤;
    日志.push((rb.暴 ? "✧" : "✦") + S(rec.名称) + "对你造成了 " + 大数(怪主)
      + (rb.真伤 ? (rb.暴 ? " 点真实暴击伤害" : " 点真实伤害") : (rb.暴 ? " 暴击伤害" : " 伤害"))
      + (rb.抗暴 ? "（被抗暴）" : ""));
    if (怪追 > 0) 日志.push("✦" + S(rec.名称) + "对你造成了 " + 大数(怪追) + " 追击伤害(" + Math.round(怪追 / Math.max(1, 怪主) * 100) + "%)");
  }
  // 怪物吸血 → 怪回血；我的「反击 / 闪击 / 反伤」→ 打回怪身上
  if (rb.吸血 > 0) {
    const 回 = Math.min(rb.吸血, Math.max(0, rec.bhpMax - rec.bhp));
    if (回 > 0) { rec.bhp = Math.min(rec.bhpMax, rec.bhp + 回); 日志.push("✦" + S(rec.名称) + "吸了你 " + 大数(回) + " 点血"); }
  }
  for (const f of (rb.反伤 || [])) {
    // 2.9.3：反击 / 闪击 打怪同样受单刀上限约束（不能靠额外伤害绕过上限）
    const 触顶 = [];
    const 实 = 实际伤害(rec, 单刀截断(rec, "atk", f.伤害, 触顶));
    rec.bhp = Math.max(0, rec.bhp - 实);
    rec.累计伤害 = (Number(rec.累计伤害) || 0) + 实;
    if (f.类型 === "闪击") 日志.push("✦你发动了闪击进行弹反", (f.暴 ? "✧" : "✦") + "你对" + S(rec.名称) + "造成了 " + 大数(实) + " 点闪击" + (f.暴 ? "真实暴击" : "") + "伤害");
    else if (f.类型 === "反击") 日志.push("✦你发动了反击，减免了" + 大数(实) + "伤害，并对" + S(rec.名称) + "造成了" + 大数(实) + "伤害");
    else 日志.push("✦你发动了反伤，" + S(rec.名称) + "受到 " + 大数(实) + " 反弹伤害");
    const 进阶 = 推进敌方阶段(rec, rec.名称);
    if (进阶.变化) 日志.push(进阶.提示);
  }
  // 2.8.0：反击 / 闪击 也可能直接把怪打死 —— 这里必须立刻结算，否则会出现「怪 0 血还在打」
  if (rec.bhp <= 0) {
    rec.日志 = 日志.slice(-12);   // 2.10.0（需求 4.11）：本回合信息（整段替换）
    // 3.1.0（需求 1）：先显示最后一回合的战斗面板，再进结算
    存战斗(ctx, u, rec);
    try { await 战斗面板(ctx, t, u, rec); } catch (e) { /* ignore */ }
    if (rec.天下楼) { await 天下楼结算(ctx, t, u, rec, true); return; }
    await 结算战斗(ctx, t, u, rec, d, true);
    return;
  }
  rec.mp = Math.min(rec.mpMax, rec.mp + 5);
  // 2.5.7 修复：删掉「每 3 轮额外 +1 技能点」。这就是两个 bug 的根源：
  //   ① 第 3/6/9… 轮普攻会 +2 点（普攻 +1 与每隔 3 轮 +1 叠加）；
  //   ② 用技能后恰好又碰上 3 的倍数，会补回 1 点 → 看起来「少消耗一个」。
  // 2.8.0：我方被击倒时先判「复活率」（每场一次）
  /* 2.10.0（需求 4.5 / 4.6）：**移除「0 血自动放弃」**
   *   玩家血量 ≤0 不再立刻判负，仍可行动（下一回合可以治疗 / 吃药 / 继续输出）；
   *   只有「被命中且没闪避」这一下才判挑战失败 —— 闪避成功（rb.闪避）就算血条是 0 也继续打。
   *   复活率优先于吃药（沿用 2.9.2 的顺序），复活后血量由「致命打击」决定，不一定满血。 */
  if (rec.hp <= 0) {
    const 活 = 尝试复活(rec, 我词条(rec), "我复活过", 怪词条(d, 敌方阶段值(d, rec.敌方阶段)));
    if (活 !== null) { rec.hp = 活; 日志.push("💫 " + 复活文案(rec, "")); }
    else if (rb.闪避) 日志.push("🕯 你的血条已空，但这一击被你闪开了 —— 仍可行动（治疗 / 吃药 / 继续输出）；下次被命中且未闪避才算失败");
  }
  // 2.10.0（需求 4.11）：战斗信息只保留本回合 —— 整段替换，不再累积上一条战斗状态
  rec.日志 = 日志.slice(-12);
  存战斗(ctx, u, rec);
  if (rec.hp <= 0 && !rb.闪避) { if (rec.天下楼) { await 天下楼结算(ctx, t, u, rec, false, "被击倒"); return; } await 结算战斗(ctx, t, u, rec, d, false); return; }
  await 战斗面板(ctx, t, u);
}


/* ---------- 2.5.7 自动出招（消耗「自动卡」· 服务器每 2 秒代出 1 招） ----------
 * 一次指令 = 连打 N 次（服务器逐次结算伤害、BOSS 逐次反击、自动回血）。
 * 3.0.0（需求 19）：支持 `序号:N` 策略 —— 每一步先判技能点 / 蓝量，够就放该序号的职业技能、不够就普攻；
 *   纯 N 仍是「全普攻」。冷却独立于普通操作冷却，避免卡住正常普攻。
 * 2.5.19：上限 50 → 1000；没打完会**退回未使用次数对应的自动卡**。
 * 2.5.26 按需求改造：
 *   ① **移除无 CD「快速出招」**（旧的 `星甲快速出招10` / `星甲无cd出招` / `autoatkfast|10`
 *      统一回一条「已移除」提示，不静默丢弃）；
 *   ② 冷却 **10 秒 → 1 秒**；
 *   ③ 自动出招途中被打到 0 血**不再判失败**：先吃库存药回血，没药则「战甲应急修复」回满续战；
 *      同时去掉旧的「没药 + 血低就提前收手」，真正做到「不会停止」。
 */
export const 自动卡名 = "自动卡";


// 2.5.55：**挑战时长** —— 自动出招改为「按时长」驱动，最长 **50 小时**（超出按 50 小时算）
//   1 招 = 2 秒（与手动出招操作冷却一致）→ 50 小时 = 90000 招
export const 自动时长上限小时 = 50;


export const 自动时长上限毫秒 = 自动时长上限小时 * 3600 * 1000;


export const 一键出招冷却毫秒 = 3000;

   // 2.7.0：与操作 CD 对齐 3 秒
// 2.5.54：自动出招 = **服务器代打**，每次出招之间的间隔与手动出招完全一致（操作冷却 2 秒）
export const 自动每击毫秒 = 操作冷却毫秒;


// 单次最多多少次（= 50 小时 / 2 秒，仍是 90000 次）
export const 一键出招最大 = Math.max(1, Math.floor(自动时长上限毫秒 / 自动每击毫秒));


// 2.5.55：把「2小时 / 30分钟 / 1小时30分 / 90分钟」这类文本解析成毫秒；解析不出返回 0
export function 解析挑战时长(文本) {
  const s = S(文本).replace(/\s+/g, "");
  if (!s) return 0;
  let 总毫秒 = 0, 命中 = false;
  const re = /([0-9]{1,6}(?:\.[0-9]{1,2})?)(小时|时|h|H|分钟|分|m|M|秒|s|S)/g;
  let m;
  while ((m = re.exec(s))) {
    const n = Number(m[1]) || 0;
    const u = m[2];
    if (/小时|时|h|H/.test(u)) 总毫秒 += n * 3600 * 1000;
    else if (/分钟|分|m|M/.test(u)) 总毫秒 += n * 60 * 1000;
    else 总毫秒 += n * 1000;
    命中 = true;
  }
  if (!命中) {
    // 纯数字：按小时理解（`一键出招2` 仍走次数，这里只给「2小时」用显式单位）
    return 0;
  }
  return Math.max(0, Math.round(总毫秒));
}


// 时长 → 需要出多少招（每招 2 秒）
export function 时长换次数(毫秒) { return Math.max(1, Math.ceil(Math.max(0, Number(毫秒) || 0) / 自动每击毫秒)); }


export function 剩出招冷却(ctx, u) { return Math.max(0, dn(ctx, P.出招冷却, u, 0) - Date.now()); }


export function 设出招冷却(ctx, u, 毫秒) { dset(ctx, P.出招冷却, u, Date.now() + (毫秒 === undefined ? 一键出招冷却毫秒 : 毫秒)); }


export function 存出招详情(ctx, u, o) { try { dset(ctx, P.出招记录, u, o); } catch (e) { /* 落盘失败不影响战斗 */ } }


export function 取出招详情(ctx, u) { const v = dget(ctx, P.出招记录, u, null); return v && typeof v === "object" ? v : null; }


// 打 n 次要多少张自动卡（固定 1 张 / 次）
export function 计算自动卡消耗(次数) { return Math.max(0, Math.floor(Number(次数) || 0)); }


/* ---------- 2.5.54 自动出招：服务器代打（每次 2 秒，与手动一致） ----------
 * 需求：自动出招**不再是「扣几张小卡瞬间给出结果」**，而是「服务器像玩家一样每 2 秒出招 1 次，
 *      玩家需要等」，只是省去手动点；`星甲自动详情` 看实时进度。
 * 实现：
 *   · 状态存 `P.自动战斗`（按 openid），活跃列表存 `P.自动战斗索引`
 *   · 后台时钟（plugin_init 启动，plugin_cleanup 收掉）每 500ms 扫一次，
 *     到点就调 `一键出招(..., 1, {单步:true})` —— **复用完全相同的战斗代码**，伤害/暴击/闪避/反击/用药一致
 *   · 每次出招扣 1 张自动卡；打完 / 没卡 / 战斗结束会自动停机
 *   · 停机（含通关结算）时把结算文本存进状态，玩家发 `星甲自动详情` 就能看到完整结果，
 *     不依赖「主动消息」权限（GF 官方机器人默认没有该权限，推送可能失败）
 */
export let 自动静默 = false;

          // 单步执行期间为 true → 抑制逐条回执
export let 自动当前用户 = "";

         // 当前单步在打的玩家
export let 自动时钟 = null;

           // 后台时钟句柄

export function 读自动(ctx, u) { const v = dget(ctx, P.自动战斗, u, null); return v && typeof v === "object" ? v : null; }


export function 写自动(ctx, u, o) { try { dset(ctx, P.自动战斗, u, o || null); } catch (e) { /* ignore */ } }


export function 自动索引(ctx) {
  const v = dget(ctx, P.自动战斗索引, "列表", []);
  return Array.isArray(v) ? v.filter((x) => S(x)) : [];
}


export function 自动索引加(ctx, u) {
  const l = 自动索引(ctx);
  if (l.indexOf(u) < 0) l.push(u);
  try { dset(ctx, P.自动战斗索引, "列表", l.slice(-500)); } catch (e) { /* ignore */ }
}


export function 自动索引删(ctx, u) {
  const l = 自动索引(ctx).filter((x) => x !== u);
  try { dset(ctx, P.自动战斗索引, "列表", l); } catch (e) { /* ignore */ }
}


/* ---------- 2.6.0（需求 8）自动战斗垃圾自动清理 ----------
 * 自动出招会留下两类**只增不减**的数据，跑久了就是一堆垃圾：
 *   ① 自动出招状态（P.自动战斗）：每个用过的人一条，带最多 3500 字结算文本，人走了也不删；
 *   ② 出招详情（P.出招记录）：每次一键出招存一份，`每击` 逐次伤害明细一次挑战可达上千条。
 * 处理办法：
 *   · 写详情时就只留最近 60 笔（见 一键出招 里 每击 的 slice）；
 *   · 每 1 小时扫一次（后台时钟里触发），删掉 3 天前的完结状态与详情；
 *   · 再兜一层条数上限，超了按时间保留最近的（进行中的自动出招永不清理）。
 */
export const 自动垃圾保留毫秒 = 3 * 24 * 3600 * 1000;


export const 自动状态上限 = 300;


export const 出招详情上限 = 300;


export const 每击保留 = 60;


export let 上次自动清理 = 0;


export function dwrite(ctx, rel, obj) {
  const f = fileOf(ctx, rel);
  try {
    const dir = path.dirname(f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f, JSON.stringify(obj || {}, null, 2), "utf8");
    return true;
  } catch (e) {
    if (ctx && ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 写入失败:", rel, e);
    return false;
  }
}


export function 清理自动垃圾(ctx, 强制) {
  const now = Date.now();
  if (!强制 && now - 上次自动清理 < 3600 * 1000) return null;
  上次自动清理 = now;
  const 结果 = { 删除状态: 0, 裁剪状态: 0, 删除详情: 0, 裁剪详情: 0 };
  // ① 自动出招状态
  try {
    const all = dall(ctx, P.自动战斗);
    const keep = {};
    const 时间表 = [];
    let 改 = false;
    for (const k of Object.keys(all)) {
      const st = all[k];
      if (!st || typeof st !== "object") { 改 = true; continue; }
      const 进行中 = !!st.开 && !st.结束;
      const t = Number(st.最近) || Number(st.停时) || Number(st.开始) || 0;
      if (!进行中 && t > 0 && now - t > 自动垃圾保留毫秒) { 结果.删除状态 += 1; 改 = true; continue; }
      if (typeof st.结果文本 === "string" && st.结果文本.length > 800) {
        st.结果文本 = st.结果文本.slice(0, 800) + "\n…（已截断，旧记录自动清理）";
        结果.裁剪状态 += 1; 改 = true;
      }
      keep[k] = st;
      时间表.push([k, t, 进行中]);
    }
    if (Object.keys(keep).length > 自动状态上限) {
      const 进行中表 = 时间表.filter((x) => x[2]).map((x) => x[0]);
      const 其余 = 时间表.filter((x) => !x[2]).sort((a, b) => b[1] - a[1]);
      const 留 = Math.max(0, 自动状态上限 - 进行中表.length);
      for (let i = 留; i < 其余.length; i++) { delete keep[其余[i][0]]; 结果.删除状态 += 1; 改 = true; }
    }
    if (改) dwrite(ctx, P.自动战斗, keep);
  } catch (e) { /* ignore */ }
  // ② 出招详情
  try {
    const all = dall(ctx, P.出招记录);
    const keep = {};
    const 时间表 = [];
    let 改 = false;
    for (const k of Object.keys(all)) {
      const d = all[k];
      if (!d || typeof d !== "object") { 改 = true; continue; }
      const t = Number(d.时间) || 0;
      if (t > 0 && now - t > 自动垃圾保留毫秒) { 结果.删除详情 += 1; 改 = true; continue; }
      if (Array.isArray(d.每击) && d.每击.length > 每击保留) { d.每击 = d.每击.slice(-每击保留); 结果.裁剪详情 += 1; 改 = true; }
      if (Array.isArray(d.日志) && d.日志.length > 60) { d.日志 = d.日志.slice(-60); 改 = true; }
      keep[k] = d;
      时间表.push([k, t]);
    }
    if (时间表.length > 出招详情上限) {
      时间表.sort((a, b) => b[1] - a[1]);
      for (let i = 出招详情上限; i < 时间表.length; i++) { delete keep[时间表[i][0]]; 结果.删除详情 += 1; 改 = true; }
    }
    if (改) dwrite(ctx, P.出招记录, keep);
  } catch (e) { /* ignore */ }
  const 有动作 = 结果.删除状态 || 结果.删除详情 || 结果.裁剪状态 || 结果.裁剪详情;
  if (有动作 && ctx && ctx.logger && ctx.logger.info) {
    ctx.logger.info("[xjyl] 自动战斗日志清理：状态 -" + 结果.删除状态 + " 条 / 截断 " + 结果.裁剪状态 + " 条 · 出招详情 -" + 结果.删除详情 + " 条 / 裁剪 " + 结果.裁剪详情 + " 条");
  }
  return 结果;
}


// 把单步期间的结算文本存进状态（供 星甲自动详情 展示）
export function 自动记结算(ctx, text) {
  const u = 自动当前用户;
  if (!u) return;
  const st = 读自动(ctx, u);
  if (!st) return;
  st.结果文本 = String(text || "").slice(0, 3500);
  写自动(ctx, u, st);
}


// 结算用的回执：单步期间只是「记账」不发消息，避免每 2 秒刷屏
export async function 回执(ctx, t, text, opts) {
  if (自动静默) { 自动记结算(ctx, text); return; }
  return reply(ctx, t, text, opts);
}


export function 自动目标(st) {
  return {
    scope: S(st && st.scope) || "group",
    group_openid: S(st && st.group_openid),
    user_openid: S(st && st.user_openid),
    event_id: S(st && st.上次事件)   // 尽量用最近的消息 id 走被动回复，失败会走主动兜底
  };
}


// 停机：标记结束 + 移出索引（结算奖励已在单步里发过，这里只做状态收尾）
export function 自动停机(ctx, u, 原因) {
  const st = 读自动(ctx, u);
  if (!st) { 自动索引删(ctx, u); return null; }
  if (!st.结束) { st.结束 = S(原因) || "已停止"; st.停时 = Date.now(); }
  st.开 = false;
  写自动(ctx, u, st);
  自动索引删(ctx, u);
  return st;
}


// 结算结果推送：优先用「最近的消息 id」走被动回复；没权限就静默失败（玩家可用 星甲自动详情 看）
export async function 自动推送结果(ctx, u) {
  const st = 读自动(ctx, u);
  if (!st || !st.结果文本 || st.已推送) return;
  st.已推送 = true;
  写自动(ctx, u, st);
  try { await reply(ctx, 自动目标(st), st.结果文本, { 标题: "🏆 自动出招结算" }); }
  catch (e) { /* 无主动消息权限属正常情况，不影响奖励发放 */ }
}


/* 2.9.4（需求 G）：自动出招**不再周期性推送**进度 ——
 * 用户原话「自动出招详情不是一直发，是在自动出招详情的界面显示」。
 * 这里只把最近一回合的战况写进自动状态（st.进度），玩家发 `星甲自动详情` 时渲染；
 * 自动过程中只有「击杀 / 失败 / 药耗尽 / 自动卡用完 / 停机」才推一条结算。
 */
export function 自动记录进度(ctx, u, 前, 后, st) {
  if (!st || !前 || !后 || 后.结果) return false;
  const 伤 = Math.max(0, (Number(后.累计伤害) || 0) - (Number(前.累计伤害) || 0));
  const 承 = Math.max(0, (Number(后.累计受伤) || 0) - (Number(前.累计受伤) || 0));
  const 敌比 = Number(后.bhpMax) > 0 ? Math.max(0, Number(后.bhp) || 0) / Number(后.bhpMax) : 0;
  const 我比 = Number(后.hpMax) > 0 ? Math.max(0, Number(后.hp) || 0) / Number(后.hpMax) : 0;
  st.进度 = {
    时间: Date.now(),
    回合: Number(后.轮) || 0,
    本轮伤害: 伤,
    本轮承伤: 承,
    敌剩比: 敌比,
    我剩比: 我比,
    敌方剩: Number(后.bhp) || 0,
    敌方上限: Number(后.bhpMax) || 0,
    我方剩: Number(后.hp) || 0,
    我方上限: Number(后.hpMax) || 0,
    已出招: Number(st.已) || 0,
    剩余招数: Number(st.剩) || 0
  };
  写自动(ctx, u, st);
  return true;
}


// 走一步：到点判定 + 调单步
export async function 自动走一步(ctx, u) {
  const st = 读自动(ctx, u);
  if (!st || !st.开 || st.结束) { 自动索引删(ctx, u); return; }
  if (hasItem(ctx, u, 自动卡名) < 1) { 自动停机(ctx, u, "自动卡用完了"); return; }
  if ((Number(st.剩) || 0) <= 0) { 自动停机(ctx, u, "次数用完了"); return; }
  // 2.5.55：按时长挑战 —— 到点自动停
  if ((Number(st.时长) || 0) > 0 && Date.now() >= (Number(st.计划结束) || 0)) { 自动停机(ctx, u, "挑战时长已到"); return; }
  // 2.5.56：整场挑战超过 50 小时 → 自动放弃（放在读 rec 之后判定）
  const rec = 战斗记录(ctx, u);
  if (!rec || rec.结果 || 战斗已死(rec)) { 自动停机(ctx, u, "战斗已结束"); return; }
  if (挑战已用毫秒(rec) >= 自动时长上限毫秒) { await 超时自动放弃(ctx, 自动目标(st), u, rec); return; }
  st.已 = (Number(st.已) || 0) + 1;
  st.剩 = Math.max(0, (Number(st.剩) || 0) - 1);
  st.下次 = Date.now() + 自动每击毫秒;
  st.最近 = Date.now();
  写自动(ctx, u, st);
  自动当前用户 = u;
  自动静默 = true;
  try {
    await 一键出招(ctx, 自动目标(st), u, 1, { 单步: true, 技能序号: Number(st.技能) || 0 });
  } catch (e) {
    if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 自动出招单步异常:", e && (e.message || e));
    自动静默 = false; 自动当前用户 = "";
    自动停机(ctx, u, "出招异常，已停止");
    return;
  }
  自动静默 = false; 自动当前用户 = "";
  const rec2 = 战斗记录(ctx, u);
  // 2.9.4（G）：只把战况记进自动状态，供 `星甲自动详情` 显示，不再周期性发消息
  if (rec2 && !rec2.结果 && !战斗已死(rec2)) 自动记录进度(ctx, u, rec, rec2, 读自动(ctx, u) || st);
  if (!rec2 || rec2.结果 || 战斗已死(rec2)) { 自动停机(ctx, u, "战斗已结束"); await 自动推送结果(ctx, u); return; }
  const st2 = 读自动(ctx, u);
  if (st2 && (Number(st2.剩) || 0) <= 0) { 自动停机(ctx, u, "次数用完了"); await 自动推送结果(ctx, u); }
}


// 开启自动代打：写状态 + 立刻出第 1 招 + 起后台时钟
export async function 启动自动出招(ctx, t, u, 次数, rec, d, opt) {
  const o = opt || {};
  const 时长 = Math.max(0, Number(o.时长毫秒) || 0);   // 0 = 按次数
  const 旧的 = 读自动(ctx, u);
  if (旧的 && 旧的.开 && !旧的.结束) {
    await reply(ctx, t, [
      "⚠️ 你已经在自动出招中（还剩 " + (Number(旧的.剩) || 0) + " 次）",
      "",
      "看进度：`星甲自动详情`　想停下：`星甲停止出招`"
    ].join("\n"), { 标题: "🃏 自动出招中", 行组: [row(btn("au31", "自动详情", "autodetail"), btn("au32", "停止出招", "autostop"), btn("au33", "战斗面板", "战斗"))] });
    return;
  }
  const now = Date.now();
  // 3.0.0（需求 19）：自动出招策略（技能序号 0 = 纯普攻），每一步由 一键出招 判定「够就技能、不够就普攻」
  const 策略 = Math.max(0, Math.floor(Number(o.技能序号) || 0));
  const st = {
    开: true, 请求: 次数, 剩: 次数, 已: 0,
    // 3.0.0：策略随自动状态一起落档，后台时钟每一步都按它出招
    技能: 策略, 策略: 出招策略文案(策略),
    每击毫秒: 自动每击毫秒, 下次: now, 开始: now, 最近: now,
    // 2.5.55：挑战时长（毫秒）；0 表示按次数模式
    时长: 时长, 计划结束: 时长 > 0 ? now + 时长 : 0,
    结束: "", 停时: 0, 结果文本: "",
    目标: S(rec && rec.名称) || S(d && d.名) || "战斗",
    scope: S(t && t.scope) || "group",
    group_openid: S(t && t.group_openid),
    user_openid: S(t && t.user_openid),
    上次事件: S(t && t.event_id)
  };
  写自动(ctx, u, st);
  自动索引加(ctx, u);
  启动自动时钟(ctx);
  const 行首 = [
    "## 🃏 自动出招已开始",
    "",
    "对手：【" + st.目标 + "】",
    // 3.0.0（需求 19）：策略一眼可见
    "当前策略：" + st.策略 + (策略 > 0 ? "（技能点 / 蓝量够就放技能" + 策略 + "，不够则普攻）" : "（每步都是普通攻击）")
  ];
  if (时长 > 0) {
    行首.push("挑战时长：**" + 时长文本(时长) + "**（每 " + (自动每击毫秒 / 1000) + " 秒 1 招 → 最多 " + 次数 + " 招）");
    行首.push("时长上限：**" + 自动时长上限小时 + " 小时**" + (o.截断 ? "（你填的 " + (o.原文 || "") + " 超过上限，已按 " + 自动时长上限小时 + " 小时计算）" : ""));
    const 有卡 = hasItem(ctx, u, 自动卡名);
    行首.push("自动卡需求：跑满需 **" + 次数 + " 张**，你现有 " + 有卡 + " 张"
      + (有卡 < 次数 ? " → ⚠️ **只够跑 " + 时长文本(有卡 * 自动每击毫秒) + "**，卡用完会自动停" : "（够跑满）"));
  } else {
    行首.push("计划出招：**" + 次数 + "** 次（约 " + 时长文本(次数 * 自动每击毫秒) + "）");
  }
  行首.push("节奏：**每 " + (自动每击毫秒 / 1000) + " 秒出 1 招**（与手动出招完全一致，只是不用你点）");
  if (!(时长 > 0)) 行首.push("自动卡：" + hasItem(ctx, u, 自动卡名) + " 张（**每招扣 1 张**，不够会自动停）");
  行首.push(
    "",
    "随时发 `星甲自动详情` 看实时进度；`星甲停止出招` 可中断。",
    "（血量低于 30% 自动用药；0 血时有药续战、没药判失败；**控制台重启会自动停止，已出的招不返还**）"
  );
  await reply(ctx, t, 行首.join("\n"), {
    标题: "🃏 自动出招",
    行组: [
      row(btn("au21", "自动详情", "autodetail"), btn("au22", "停止出招", "autostop"), btn("au23", "战斗面板", "战斗")),
      row(actBtn("au24", "⚡手动普攻", "ba|atk"), btn("au25", "技能", "技能"), btn("au26", "星甲菜单", "星甲菜单"))
    ]
  });
  await 自动走一步(ctx, u);
  // 首招就把战斗打完（一刀秒）时，直接把结算发给玩家，不用等他自己问
  const 后 = 读自动(ctx, u);
  if (后 && 后.结束) await 自动推送结果(ctx, u);
}



// 后台时钟：每 500ms 扫一遍活跃玩家，**每轮只处理 1 个到点的玩家**（避免多人交错覆盖全局状态）
export function 自动时钟心跳(ctx) {
  // 2.6.0（需求 8）：顺手做自动战斗垃圾清理（内部按小时节流，不会每 tick 都跑）
  try { 清理自动垃圾(ctx); } catch (e) { /* ignore */ }
  const list = 自动索引(ctx);
  if (!list.length) return;
  const now = Date.now();
  for (const uid0 of list.slice(0, 100)) {
    const st = 读自动(ctx, uid0);
    if (!st || !st.开 || st.结束) { 自动索引删(ctx, uid0); continue; }
    if (now < (Number(st.下次) || 0)) continue;
    自动走一步(ctx, uid0).catch((e) => {
      if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 自动出招异常:", e && (e.message || e));
    });
    return;   // 本轮只跑一个
  }
}


export function 启动自动时钟(ctx) {
  // 3.0.0：拆成多模块后子模块状态跨实例共享（静态 import 不带版本号），重载时必须先收掉旧时钟
  if (自动时钟) { try { clearInterval(自动时钟); } catch (e) { /* ignore */ } 自动时钟 = null; }
  自动时钟 = setInterval(() => { try { 自动时钟心跳(ctx); } catch (e) { /* ignore */ } }, 500);
  if (自动时钟 && typeof 自动时钟.unref === "function") 自动时钟.unref();
}


export function 停止自动时钟() {
  if (自动时钟) { try { clearInterval(自动时钟); } catch (e) { /* ignore */ } }
  自动时钟 = null;
}


// 2.5.56：**挑战时间**（非自动出招也会显示）—— 从 rec.开始 累计到「现在」或结束时
export function 挑战已用毫秒(rec) {
  if (!rec) return 0;
  const 起 = Number(rec.开始) || 0;
  if (!起) return 0;
  const 止 = Number(rec.结束) || Number(rec.结果 ? rec.结束 : 0) || Date.now();
  return Math.max(0, 止 - 起);
}


// 挑战时间展示文本：`已进行 2 小时 13 分 / 上限 50 小时（剩余 47 小时 47 分）`
export function 挑战时间文本(rec, 显示剩余) {
  const 用 = 挑战已用毫秒(rec);
  const 超 = 用 >= 自动时长上限毫秒;
  const 段 = "挑战时间：**" + 时长文本(用) + "** / 上限 " + 自动时长上限小时 + " 小时";
  if (!显示剩余) return 超 ? 段 + "（**已超时**）" : 段;
  return 超 ? 段 + "（**已超时，将自动放弃**）" : 段 + "（剩余 " + 时长文本(自动时长上限毫秒 - 用) + "）";
}


// 超过 50 小时的挑战 → 自动放弃（返回 true 表示已放弃）
export async function 超时自动放弃(ctx, t, u, rec) {
  if (!rec || rec.结果) return false;
  if (挑战已用毫秒(rec) < 自动时长上限毫秒) return false;
  const d = 战斗敌(rec);   // 3.0.0：翻倍挑战时敌方属性已按 ×1.5 放大
  let 返还行 = "";
  // BOSS 放弃按「失败」处理：返还 50% 入场（与手动逃跑一致，不额外扣费）
  if (d && Number(d.id) >= 200) {
    const 返币 = Math.floor((Number(d.需币) || 0) * BOSS失败返还比例);
    const 返花 = Math.floor(Math.max(1, Math.ceil((Number(d.需币) || 0) / 5)) * BOSS失败返还比例);
    if (返币 > 0) dset(ctx, P.金币, u, dn(ctx, P.金币, u, 0) + 返币);
    if (返花 > 0) giveItem(ctx, u, "花", 返花);
    返还行 = "返还 50% 入场：金币 +" + kfmt(返币) + " · 花 +" + 返花;
  }
  rec.结果 = "失败";
  rec.结算 = { 赢: false, 伤害: rec.累计伤害, 目标生命: rec.bhpMax, 原因: "挑战超过 " + 自动时长上限小时 + " 小时（自动放弃）", 返还: 返还行 };
  rec.结束 = Date.now();
  战斗蓝量写回(ctx, u, rec);   // 3.2.0（需求 1）：超时放弃同样把蓝量写回全局
  存战斗(ctx, u, rec);
  pushLog(ctx, u, "挑战超时自动放弃 " + S(rec.名称));
  自动停机(ctx, u, "挑战超时（超过 " + 自动时长上限小时 + " 小时）");
  const 行 = [
    ["⏰ **挑战超时，已自动放弃**", false],
    [S(rec.名称) + " · 已进行 " + 时长文本(挑战已用毫秒(rec)) + "（上限 " + 自动时长上限小时 + " 小时）", true],
    ["累计伤害 " + kfmt(rec.累计伤害) + " · 剩余对手血量 " + kfmt(rec.bhp) + "/" + kfmt(rec.bhpMax), true]
  ];
  if (返还行) 行.push([返还行, true]);
  行.push(["", true], ["战斗已结束，可以重新开战。", true]);
  await reply(ctx, t, 灰混(行), {
    标题: "⏰ 挑战超时",
    行组: [row(btn("to1", "副本", "副本"), btn("to2", "BOSS列表", "BOSS列表"), btn("to3", "战斗面板", "战斗"))]
  });
  return true;
}


// 2.5.56：服务器**每小时**扫一次「所有进行中的战斗」，超过 50 小时自动放弃
export let 超时时钟 = null;


export function 启动超时时钟(ctx) {
  if (超时时钟) { try { clearInterval(超时时钟); } catch (e) { /* ignore */ } 超时时钟 = null; }
  // 2.6.0 修复：`超时扫描` 是 async，try/catch 只能抓同步抛出；async 里的异常会变成
  //   unhandled rejection（Node 15+ 默认直接终止进程）。必须显式 .catch。
  const 扫 = () => {
    超时扫描(ctx).catch((e) => {
      if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 挑战超时扫描异常:", e && (e.message || e));
    });
  };
  setTimeout(扫, 60 * 1000);                         // 启动 1 分钟后先扫一次（不必等满 1 小时）
  超时时钟 = setInterval(扫, 60 * 60 * 1000);         // 之后每小时一次
  if (超时时钟 && typeof 超时时钟.unref === "function") 超时时钟.unref();
}


export function 停止超时时钟() {
  if (超时时钟) { try { clearInterval(超时时钟); } catch (e) { /* ignore */ } }
  超时时钟 = null;
}


// 2.9.9（需求 E）：股票时钟 —— 每 60 秒扫一次（到点的股跳价 / 检查 24 小时分红）
export let 股票时钟 = null;


export function 启动股票时钟(ctx) {
  if (股票时钟) { try { clearInterval(股票时钟); } catch (e) { /* ignore */ } 股票时钟 = null; }
  const 扫 = () => { try { 股票tick(ctx); } catch (e) { if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 股票时钟异常:", e && (e.message || e)); } };
  setTimeout(扫, 30 * 1000);                       // 启动 30 秒后先走一次
  股票时钟 = setInterval(扫, 60 * 1000);
  if (股票时钟 && typeof 股票时钟.unref === "function") 股票时钟.unref();
}


export function 停止股票时钟() {
  if (股票时钟) { try { clearInterval(股票时钟); } catch (e) { /* ignore */ } }
  股票时钟 = null;
}


export async function 超时扫描(ctx) {
  // 遍历战斗记录表（按玩家 openid 存）
  const 表 = dall(ctx, P.战斗);
  const 键们 = Object.keys(表 || {});
  let n = 0;
  for (const u of 键们) {
    const rec = 表[u];
    if (!rec || typeof rec !== "object" || rec.结果) continue;
    if (挑战已用毫秒(rec) < 自动时长上限毫秒) continue;
    // 超时推送目标：优先自动出招记录里的会话信息
    const st = 读自动(ctx, u);
    const t = st ? 自动目标(st) : { scope: "group", group_openid: "", user_openid: u };
    try { await 超时自动放弃(ctx, t, u, rec); n += 1; } catch (e) { /* ignore */ }
  }
  if (n && ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 挑战超时自动放弃：" + n + " 场");
}


export function 时长文本(毫秒) {
  const s = Math.max(0, Math.round((Number(毫秒) || 0) / 1000));
  if (s < 60) return s + " 秒";
  const m = Math.floor(s / 60), r = s % 60;
  return m + " 分" + (r ? " " + r + " 秒" : "");
}


export function 一键出招说明() {
  return [
    "自动出招（服务器代打）：**每 " + (自动每击毫秒 / 1000) + " 秒出 1 招**，与手动出招完全一致，只是不用你点。",
    "**每招消耗 1 张【" + 自动卡名 + "】**（商店 100 星羽 / 张），卡不够会自动停（只扣实际出招数）。",
    "",
    "**两种用法**",
    "· 按次数：`星甲一键出招10`（10 招 ≈ 20 秒，**纯普攻**）",
    "· **按技能策略**：`星甲一键出招3:1000` = 优先放**技能3**，**技能点（+ 蓝量）够就放，不够就普攻**，循环到 1000 招用完",
    "　→ 转职后技能面板的序号就是这里的序号（`星甲技能` 看当前职业技能1~5）",
    "· **按时长**：`星甲一键出招2小时` / `星甲一键出招30分钟` / `星甲一键出招1小时30分`",
    "　→ **挑战时长上限 " + 自动时长上限小时 + " 小时**（超出按 " + 自动时长上限小时 + " 小时算）；自动卡 1 张 / 招：1 小时需 1800 张、" + 自动时长上限小时 + " 小时需 " + 一键出招最大 + " 张",
    "",
    "期间随时发 `星甲自动详情` 看实时进度（第几次 / 剩余时长 / 双方血量 / 结算结果）。",
    "每次伤害都与手动普攻一致（含暴击 / 闪避 / 反击）；血量低于 30% 自动用药；"
      + "被打到 0 血时**有药自动回血续战、没药则判失败（返还 50% 入场费）**；"
      + "带 `序号:N` 时会按职业专属技能出招（技能点 / 蓝量够就放，不够自动退回普攻）。",
    "**控制台重启 / 插件重载会立即停止自动出招**（已出的招不返还）。停止：`星甲停止出招`"
  ].join("\n");
}


/* ---------- 2.5.18 出招详情面板（2.5.54：同时展示「正在进行的自动出招」实时进度） ---------- */
// 2.5.54：停止自动出招
export async function 停止出招(ctx, t, u) {
  const st = 读自动(ctx, u);
  if (!st || (!st.开 && !st.结果文本)) {
    await reply(ctx, t, "你当前没有在自动出招。\n用法：`星甲一键出招10`（每 2 秒出 1 招，每招 1 张自动卡）", {
      标题: "🃏 自动出招", 行组: [row(btn("as1", "一键出招×10", "autoatk|10"), btn("as2", "战斗面板", "战斗"))]
    });
    return;
  }
  if (!st.开 || st.结束) {
    await reply(ctx, t, "本次自动出招已经结束了（" + (st.结束 || "已完成") + "）。\n发 `星甲自动详情` 看结果。", {
      标题: "🃏 已结束", 行组: [row(btn("as3", "自动详情", "autodetail"), btn("as4", "战斗面板", "战斗"))]
    });
    return;
  }
  const 停 = 自动停机(ctx, u, "你手动停止了");
  await reply(ctx, t, [
    "⏹ 已停止自动出招",
    "",
    "已出招：" + (Number(停 && 停.已) || 0) + " / " + (Number(停 && 停.请求) || 0) + " 次",
    "剩余自动卡：" + hasItem(ctx, u, 自动卡名) + " 张（**没用掉的不会扣**）",
    "",
    "战斗还没结束，可以继续 `星甲普攻` / `星甲技能`，或再来 `星甲一键出招10`。"
  ].join("\n"), {
    标题: "⏹ 已停止", 行组: [row(actBtn("as5", "⚡普攻", "ba|atk"), btn("as6", "自动详情", "autodetail"), btn("as7", "战斗面板", "战斗"))]
  });
}


export async function 出招详情面板(ctx, t, u) {
  // 2.5.54：先补跑一次（万一后台时钟没跑到），再展示实时进度
  const 活 = 读自动(ctx, u);
  if (活) {
    if (活.开 && !活.结束) { try { await 自动走一步(ctx, u); } catch (e) { /* ignore */ } }
    const st = 读自动(ctx, u);
    if (st && (st.开 || st.结果文本)) {
      const 面板 = [];
      const rec = 战斗记录(ctx, u);
      const 进行中 = !!st.开 && !st.结束;
      const 已 = Number(st.已) || 0;
      const 剩 = Number(st.剩) || 0;
      const 每击 = Number(st.每击毫秒) || 自动每击毫秒;
      面板.push(["## 🃏 自动出招" + (进行中 ? "（进行中）" : "（已结束）"), false]);
      面板.push(["对手：【" + (st.目标 || "?") + "】", true]);
      // 3.0.0（需求 19）：自动详情显示「当前策略：技能3」
      面板.push(["当前策略：" + 出招策略文案(st.技能) + (Number(st.技能) > 0 ? "（技能点 / 蓝量够就放技能" + st.技能 + "，不够则普攻）" : "（纯普攻）"), false]);
      面板.push(["进度：**" + 已 + " / " + (Number(st.请求) || 已) + "** 次" + (进行中 ? "（还剩 " + 剩 + " 次）" : ""), true]);
      面板.push(["节奏：每 " + (每击 / 1000) + " 秒 1 招" + (进行中 ? "　下次出招：" + Math.max(0, Math.ceil(((Number(st.下次) || 0) - Date.now()) / 1000)) + " 秒后" : ""), true]);
      // 2.5.55：挑战时长（按时长挑战时显示总时长 / 已进行 / 剩余）
      if ((Number(st.时长) || 0) > 0) {
        const 总 = Number(st.时长) || 0;
        const 已过 = Math.max(0, Math.min(总, (进行中 ? Date.now() : (Number(st.停时) || Date.now())) - (Number(st.开始) || 0)));
        面板.push(["挑战时长：**" + 时长文本(总) + "**（上限 " + 自动时长上限小时 + " 小时）· 已进行 " + 时长文本(已过) + (进行中 ? " · 剩余 " + 时长文本(Math.max(0, 总 - 已过)) : ""), true]);
      }
      if (进行中) 面板.push(["预计剩余：约 " + 时长文本(剩 * 每击), true]);
      面板.push(["自动卡：" + hasItem(ctx, u, 自动卡名) + " 张（每招扣 1 张）", true]);
      if (rec && !rec.结果) {
        面板.push(["", true]);
        面板.push(["⏱ " + 挑战时间文本(rec, true), true]);
        面板.push(["当前战况：对手 " + kfmt(rec.bhp || 0) + "/" + kfmt(rec.bhpMax || 0) + "　你 " + kfmt(rec.hp || 0) + "/" + kfmt(rec.hpMax || 0), true]);
        面板.push(["累计：造成 " + kfmt(rec.累计伤害 || 0) + " · 承伤 " + kfmt(rec.累计受伤 || 0) + " · 回合 " + (rec.轮 || 0), true]);
        // 2.9.4（G）：最近一回合的进度（不再推消息，只在这里显示）
        const pg = st.进度;
        if (pg && typeof pg === "object") {
          const 百 = (v) => (Math.max(0, Math.min(1, Number(v) || 0)) * 100).toFixed(1) + "%";
          const 条 = (v) => { const n = Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 10); return "█".repeat(n) + "░".repeat(10 - n); };
          面板.push(["", true]);
          面板.push(["**本轮进度**（第 " + (Number(pg.回合) || 0) + " 回合）", false]);
          面板.push(["本轮伤害 " + kfmt(pg.本轮伤害 || 0) + "　本轮承伤 " + kfmt(pg.本轮承伤 || 0), true]);
          面板.push(["敌方剩余 " + 百(pg.敌剩比) + "　" + 条(pg.敌剩比) + "　" + kfmt(pg.敌方剩 || 0) + "/" + kfmt(pg.敌方上限 || 0), true]);
          面板.push(["我方剩余 " + 百(pg.我剩比) + "　" + 条(pg.我剩比) + "　" + kfmt(pg.我方剩 || 0) + "/" + kfmt(pg.我方上限 || 0), true]);
          面板.push(["已出招 " + (Number(pg.已出招) || 0) + " 次　剩余招数 " + (Number(pg.剩余招数) || 0) + " 次", true]);
        }
      }
      if (st.结果文本) {
        面板.push(["", true]);
        面板.push(["### " + (st.结束 || "结算"), false]);
        String(st.结果文本).split("\n").forEach((x) => { if (x !== "") 面板.push([x, true]); });
      }
      面板.push(["", true]);
      面板.push([(进行中 ? "`星甲自动详情` 刷新进度 · `星甲停止出招` 中断" : "本次自动出招已结束，可以 `星甲自动详情` 回看，或直接再开一场"), true]);
      await reply(ctx, t, 灰混(面板), {
        标题: "📜 自动详情",
        行组: [
          row(btn("ad4", "一键出招×10", "autoatk|10"), btn("ad5", "自动详情", "autodetail"), btn("ad6", "停止出招", "autostop")),
          row(actBtn("ad7", "⚡普攻", "ba|atk"), btn("ad8", "技能", "技能"), btn("ad9", "战斗面板", "战斗"))
        ]
      });
      return;
    }
  }
  const d0 = 取出招详情(ctx, u);
  if (!d0) {
    await reply(ctx, t, ["还没有自动出招记录。", "", 一键出招说明()].join("\n"), {
      标题: "📜 自动详情",
      行组: [row(btn("ad1", "一键出招×10", "autoatk|10"), btn("ad2", "战斗面板", "战斗"), btn("ad3", "星甲菜单", "星甲菜单"))]
    });
    return;
  }
  const 每击 = Array.isArray(d0.每击) ? d0.每击 : [];
  const 明细 = Array.isArray(d0.日志) ? d0.日志 : [];
  // 逐次伤害：每行 10 个，最多展示 200 条
  const 伤行 = [];
  for (let i = 0; i < Math.min(每击.length, 200); i += 10) {
    伤行.push("　" + 每击.slice(i, i + 10).map((v, j) => (i + j + 1) + "." + kfmt(v)).join(" "));
  }
  const 面板 = [
    ["## 📜 出招详情", false],
    ["时间：" + fmt(d0.时间) + "　副本：[" + (d0.副本 || "?") + "] " + (d0.名称 || ""), true],
    ["方式：" + (d0.快速 ? "（旧版无CD快速出招记录）" : "一键出招（每招 " + (自动每击毫秒 / 1000) + " 秒 · 服务器代打）"), true],
    // 3.0.0（需求 19）：策略回看（老记录没有该字段 → 按纯普攻显示）
    ["当前策略：" + (d0.策略文案 || 出招策略文案(d0.策略)) + (Number(d0.策略) > 0 ? "（技能 " + (Number(d0.用技能) || 0) + " 次 / 普攻 " + (Number(d0.用普攻) || 0) + " 次）" : "（全部普攻）"), true],
    ["出招 " + (d0.次数 || 0) + " / " + (d0.请求次数 || d0.次数 || 0) + " 次　消耗自动卡 " + (d0.用卡 || 0) + " 张" + (d0.退回 ? "（退回 " + d0.退回 + " 张）" : "") + "（剩 " + (d0.剩卡 || 0) + "）", true],
    ["造成伤害 " + kfmt(d0.总伤 || 0) + "　承伤 " + kfmt(d0.总承 || 0) + "　自动用药 " + (d0.喝药 || 0) + " 次", true],
    ["暴击 " + (d0.暴击 || 0) + " 次　被闪避 " + (d0.被闪 || 0) + " 次　你闪避 " + (d0.我闪 || 0) + " 次", true],
    ["BOSS血量 " + kfmt(d0.bhp || 0) + "/" + kfmt(d0.bhpMax || 0) + "　你血量 " + (d0.hp || 0) + "/" + (d0.hpMax || 0), true],
    ["结局：" + (d0.结局 || "进行中"), true],
    ["", true],
    ["逐次伤害（共 " + 每击.length + " 次）", false]
  ];
  if (伤行.length) 伤行.forEach((x) => 面板.push([x, true]));
  else 面板.push(["（无记录）", true]);
  面板.push(["", true]);
  面板.push(["最近战斗日志（" + Math.min(明细.length, 30) + "/" + 明细.length + "）", false]);
  if (明细.length) 明细.slice(-30).forEach((x) => 面板.push(["　" + x, true]));
  else 面板.push(["（无记录）", true]);
  await reply(ctx, t, 灰混(面板), {
    标题: "📜 出招详情",
    行组: [
      row(btn("ad4", "一键出招×10", "autoatk|10"), btn("ad5", "出招详情", "autodetail"), btn("ad6", "再来看一次", "autodetail")),
      row(actBtn("ad7", "⚡普攻", "ba|atk"), btn("ad8", "技能", "技能"), btn("ad9", "战斗面板", "战斗"))
    ]
  });
}


export async function 一键出招(ctx, t, u, 次数, opt) {
  const 单步 = !!(opt && opt.单步);   // 2.5.54：单步 = 由后台时钟驱动的「这一次出招」
  // 2.5.55：支持「按时长」挑战（opt.时长毫秒），次数由时长换算
  const 时长限 = Math.max(0, Number(opt && opt.时长毫秒) || 0);
  const 限次 = 时长限 > 0 ? 时长换次数(时长限) : 一键出招最大;
  const k = 单步 ? 1 : Math.min(Math.max(1, Math.floor(Number(次数) || 10)), 限次);
  // 3.0.0（需求 19）：出招策略 = 技能序号（0 = 纯普攻）；序号超出本职业技能数时按最大值收紧
  const 出招技能 = 我的技能表(ctx, u);
  const 策略请求 = Math.floor(Number(opt && (opt.技能序号 === undefined ? opt.技能 : opt.技能序号)) || 0);
  const 策略 = 出招技能.length ? Math.max(0, Math.min(出招技能.length, 策略请求)) : 0;
  const 技N = 策略 > 0 ? 出招技能[策略 - 1] : null;
  // 2.5.54：**改成每次出招扣 1 张**（不再预扣整批），所以这里恒为 1
  const 需卡 = 1;
  const rec0 = 战斗记录(ctx, u);
  if (战斗已死(rec0)) { 清死战斗(ctx, u); }   // 2.5.31：脏记录自愈（否则永远「有一场没打完」）
  const rec1 = 战斗已死(rec0) ? null : rec0;
  if (!rec1 || rec1.结果) {
    if (单步) { 自动停机(ctx, u, "战斗已结束"); return; }
    await reply(ctx, t, "你当前没有进行中的战斗。\n先 `星甲副本` 或 `星甲BOSS列表` 选一个开打。", {
      标题: "⚔️ 一键出招", 行组: [row(btn("au0", "副本", "副本"), btn("au00", "BOSS列表", "BOSS列表"), btn("au01", "星甲菜单", "星甲菜单"))]
    });
    return;
  }
  // 2.5.26：冷却统一 1 秒（原 10 秒）
  if (!单步) {
    const 余 = 剩出招冷却(ctx, u);
    if (余 > 0) {
      await reply(ctx, t, [
        "⏳ 一键出招冷却中，还需 " + (余 / 1000).toFixed(1) + " 秒。",
        "（每招 " + (自动每击毫秒 / 1000) + " 秒；自动代打期间请用 `星甲自动详情` 看进度，手动出招需先停止）"
      ].join("\n"), {
        标题: "⏳ 冷却", 行组: [row(actBtn("au03", "⚡普攻", "ba|atk"), btn("au04", "技能", "技能"), btn("au02", "战斗面板", "战斗"))]
      });
      return;
    }
  }
  const d = 战斗敌(rec1);   // 2.5.28：天下楼 / 副本 / BOSS 统一取目标（3.0.0：含翻倍 ×1.5）
  if (!d) { if (单步) { 自动停机(ctx, u, "战斗数据异常"); return; } await reply(ctx, t, "战斗数据异常，已重置。请重新开战。", { 标题: "⚠️ 异常", 行组: [row(btn("au05", "副本", "副本"))] }); 存战斗(ctx, u, null); return; }
  // 3.0.0（需求 19）：指定了技能序号但没转职 → 提前拦截（否则会被静默降级成纯普攻）
  if (!单步 && 策略请求 > 0 && !出招技能.length) {
    await reply(ctx, t, [
      "你还没有转职，用不了技能，所以没法按 `技能" + 策略请求 + ":N` 出招（旧的 8 档通用技能已下线）。",
      "",
      "先转职：`星甲职业` 看 6 个职业 → `星甲转职#剑修`（" + 转职费 + " 星羽，需 Lv." + 转职等级 + "）",
      "转职后 `星甲一键出招" + 策略请求 + ":1000` = 优先放技能" + 策略请求 + "，技能点不够就普攻。"
    ].join("\n"), {
      标题: "⚔️ 未转职",
      行组: [
        row(btn("au30", "职业面板", "职业"), btn("au31", "技能面板", "技能"), btn("au32", "战斗面板", "战斗")),
        row(actBtn("au33", "⚡普攻", "ba|atk"), btn("au34", "星甲菜单", "星甲菜单"))
      ]
    });
    return;
  }
  const 有卡 = hasItem(ctx, u, 自动卡名);
  if (有卡 < 需卡) {
    if (单步) { 自动停机(ctx, u, "自动卡用完了"); return; }
    await reply(ctx, t, [
      "自动卡不足：需要 **" + 需卡 + "** 张（1 张 / 次），你只有 **" + 有卡 + "** 张。",
      "",
      一键出招说明(),
      "",
      "商店：自动卡 100 星羽 / 张（`星甲购买#自动卡#10`）"
    ].join("\n"), {
      标题: "🃏 自动卡不足",
      行组: [
        row(btn("au06", "买自动卡×10", "购买#自动卡#10"), btn("au07", "买自动卡×100", "购买#自动卡#100"), btn("au08", "商店", "商店")),
        row(actBtn("au09", "⚡普攻", "ba|atk"), btn("au10", "技能", "技能"), btn("au11", "背包", "背包"))
      ]
    });
    return;
  }
  takeItem(ctx, u, 自动卡名, 需卡);
  设出招冷却(ctx, u);
  const rec = rec1;
  // 2.5.54：非单步 = **开启「服务器代打」**（不再瞬间打完），立即出第 1 招，之后每 2 秒由后台时钟出 1 招
  if (!单步) { await 启动自动出招(ctx, t, u, k, rec, d, { 时长毫秒: 时长限, 原文: S(opt && opt.原文), 截断: !!(opt && opt.截断), 技能序号: 策略 }); return; }
  const 我闪避 = rec.闪避 === undefined ? (Number(attrs(ctx, u).闪避) || 0) : rec.闪避;
  const 日志 = [];   // 2.10.0（需求 4.11）：本回合信息从空开始，不叠加上一回合
  const 详情日志 = [];
  let 实际 = 0, 总伤 = 0, 总承 = 0, 喝药 = 0, 暴击 = 0, 被闪 = 0, 我闪 = 0, 续命 = 0;
  let 用技能 = 0, 用普攻 = 0;
  let 结局 = "";
  let 没蓝原因 = "";   // 3.2.0（需求 3）：没蓝药 → 停止自动出招，这里记提醒文案
  const 每击 = [];   // 2.5.9：逐次伤害明细（让玩家看到每一次的单独伤害）
  // 逐次结算：每一次都单独算伤害、单独判定暴击与闪避，BOSS 也逐次反击
  for (let i = 0; i < k; i++) {
    实际 += 1;
    /* 3.0.0（需求 19）：**每一步先判断技能点 / 蓝量够不够**
     *   够 → 放策略技能（扣技能点 + 蓝量，走 技能出手 的完整效果）
     *   不够 → 退化成普通攻击（+1 技能点），继续循环，次数用完为止
     * 3.2.0（需求 3）：蓝量不够 / 蓝量 = 0 时**先自动喝蓝药**（便宜优先、常开不可关）；
     *   没蓝药了 → 记「没蓝」结局 → **停止自动出招**并提醒买蓝药（普攻仍可手动继续） */
    let 用技 = !!(技N && (Number(rec.sp) || 0) >= (Number(技N.耗) || 0) && (Number(rec.mp) || 0) >= (Number(技N.蓝) || 0));
    if (技N && (Number(rec.sp) || 0) >= (Number(技N.耗) || 0) && !用技) {
      const 补 = 自动喝蓝药(ctx, u, rec, Math.max(1, Number(技N.蓝) || 1));
      if (补.药) {
        const 行 = "🔵 第 " + 实际 + " 次前自动喝蓝药：" + 补.药 + " +" + 补.回 + " → " + rec.mp + "/" + rec.mpMax;
        日志.push(行); 详情日志.push(行);
      }
      if (补.ok) 用技 = true;
      else { 实际 -= 1; 结局 = "没蓝"; 没蓝原因 = 没蓝提醒; break; }
    }
    const 本行 = [];
    let 本伤 = 0;
    if (用技) {
      用技能 += 1;
      rec.sp = Math.max(0, (Number(rec.sp) || 0) - (Number(技N.耗) || 0));
      rec.mp = Math.max(0, (Number(rec.mp) || 0) - (Number(技N.蓝) || 0));
      const 出 = 技能出手(rec, d, 技N);
      本伤 = 出.伤;
      本行.push("✦第 " + 实际 + " 次你发动【" + 技N.名 + "】技能" + 策略 + "（耗 " + 技N.耗 + " 点 / " + 技N.蓝 + " 蓝 · 剩 " + rec.sp + " 点 / " + rec.mp + " 蓝）");
      // 技能出手() 的伤害行以 ✦/✧ 开头，统一补「第 N 次」
      for (const x of 出.行) 本行.push(String(x).replace(/^([✦✧])/, "$1第 " + 实际 + " 次"));
      rec.上次出招 = { 类型: "skill", 序号: 策略, 名: 技N.名 };
    } else {
      用普攻 += 1;
      // ① 我方普通攻击 —— 与手动普攻**完全同一套**（玩家出手：含追击 / 吸血 / 反击 / 反伤封顶）
      //    3.0.0 修复：原来这里自己拼了一套、且**完全忽略守方反击 / 反伤**，
      //    导致「手动普攻被反弹死、自动出招却不会」的口径分裂；现在两边都走 玩家出手()。
      const 出 = 玩家出手(rec, d, 1, "atk", "");
      if (出.闪避) 被闪 += 1;
      else if (出.暴) 暴击 += 1;
      本伤 = 出.伤;
      for (const x of 出.行) 本行.push(String(x).replace(/^([✦✧])/, "$1第 " + 实际 + " 次"));
      // ② 技能点 +1（3.0.0：上限 99999）
      rec.sp = Math.min(Number(rec.spMax) || 技能点上限, (Number(rec.sp) || 0) + 1);
      rec.上次出招 = { 类型: "atk", 序号: 0, 名: "普攻" };
    }
    总伤 += 本伤;
    每击.push(本伤);
    for (const x of 本行) { 日志.push(x); 详情日志.push(x); }
    rec.轮 = (Number(rec.轮) || 0) + 1;
    if (rec.bhp <= 0) { 结局 = "win"; 存战斗(ctx, u, rec); break; }
    // ③ 自动回血（低于 30% 自动吃药，按药品回血数值补够）
    const 喝 = 自动服药(ctx, u, rec, false);
    if (喝.ok && 喝.药) {
      喝药 += 1;
      const 行 = "💊 第 " + 实际 + " 次后自动回血：" + 喝.药 + " +" + kfmt(喝.回) + " → " + rec.hp + "/" + rec.hpMax;
      日志.push(行); 详情日志.push(行);
    }
    // ④ 敌方反击（吃我方闪避判定；三档阶段已在玩家伤害后推进）
    const 怪伤结果 = 怪物伤害(rec, d, 1, 我闪避);
    // 3.0.0（需求 25）：技能「减伤」折扣本次承伤（闪避成功那一击不消耗层数）
    const 减伤比 = 怪伤结果.闪避 ? 0 : 消耗减伤(rec);
    let 怪主伤 = Math.max(0, Number(怪伤结果.dmg) || 0), 怪追伤 = Math.max(0, Number(怪伤结果.追击) || 0);
    if (减伤比 > 0) {
      const 原伤 = 怪主伤 + 怪追伤;
      怪主伤 = Math.max(0, Math.round(怪主伤 * (1 - 减伤比)));
      怪追伤 = Math.max(0, Math.round(怪追伤 * (1 - 减伤比)));
      详情日志.push("🛡 第 " + 实际 + " 次减伤 " + Math.round(减伤比 * 100) + "% 生效：承伤 " + 大数(原伤) + " → " + 大数(怪主伤 + 怪追伤));
    }
    const rb = { dmg: 怪伤结果.闪避 ? 0 : (怪主伤 + 怪追伤), 暴: 怪伤结果.暴, 闪避: 怪伤结果.闪避 };
    if (rb.闪避) { 我闪 += 1; 详情日志.push("✦第 " + 实际 + " 次你闪避成功，" + S(rec.名称) + "对你造成了0 伤害"); }
    else {
      rec.hp = Math.max(0, rec.hp - rb.dmg); rec.累计受伤 = (Number(rec.累计受伤) || 0) + rb.dmg; 总承 += rb.dmg;
      详情日志.push((rb.暴 ? "✧" : "✦") + "第 " + 实际 + " 次" + S(rec.名称) + "对你造成了 " + 大数(怪主伤) + (怪伤结果.真伤 ? (rb.暴 ? " 点真实暴击伤害" : " 点真实伤害") : (rb.暴 ? " 暴击伤害" : " 伤害")));
      if (怪追伤 > 0) 详情日志.push("✦第 " + 实际 + " 次" + S(rec.名称) + "对你造成了 " + 大数(怪追伤) + " 追击伤害(" + Math.round(怪追伤 / Math.max(1, 怪主伤) * 100) + "%)");
    }
    if (怪伤结果.吸血 > 0) { const 回 = Math.min(怪伤结果.吸血, Math.max(0, rec.bhpMax - rec.bhp)); if (回 > 0) { rec.bhp = Math.min(rec.bhpMax, rec.bhp + 回); 详情日志.push("✦第 " + 实际 + " 次" + S(rec.名称) + "吸了你 " + 大数(回) + " 点血"); } }
    for (const f of (怪伤结果.反伤 || [])) {
      // 2.9.3：反击 / 闪击 打怪同样受单刀上限约束（不能靠额外伤害绕过上限）
      const 触顶 = [];
      const 实 = 实际伤害(rec, 单刀截断(rec, "atk", f.伤害, 触顶));
      rec.bhp = Math.max(0, rec.bhp - 实);
      rec.累计伤害 = (Number(rec.累计伤害) || 0) + 实;
      if (f.类型 === "闪击") 详情日志.push("✦第 " + 实际 + " 次你发动了闪击进行弹反", (f.暴 ? "✧" : "✦") + "第 " + 实际 + " 次你对" + S(rec.名称) + "造成了 " + 大数(实) + " 点闪击" + (f.暴 ? "真实暴击" : "") + "伤害");
      else if (f.类型 === "反击") 详情日志.push("✦第 " + 实际 + " 次你发动了反击，减免了" + 大数(实) + "伤害，并对" + S(rec.名称) + "造成了" + 大数(实) + "伤害");
      else 详情日志.push("✦第 " + 实际 + " 次你发动了反伤，" + S(rec.名称) + "受到 " + 大数(实) + " 反弹伤害");
      const 反阶 = 推进敌方阶段(rec, rec.名称);
      if (反阶.变化) { 日志.push(反阶.提示); 详情日志.push(反阶.提示); }
      for (const x of 触顶) 详情日志.push(x);
    }
    if (rec.bhp <= 0) { 结局 = "win"; 存战斗(ctx, u, rec); break; }
    rec.mp = Math.min(rec.mpMax, (Number(rec.mp) || 0) + 5);
    /* 2.5.27：被打到 0 血 → 有药就自动回血续战；**没药则判挑战失败（自动放弃 + 返还 50% 入场费）**
     * 2.9.2（P4 收尾）：「复活率」词条**优先于吃药** —— 先判复活（每场一次），没触发才嗑药续命
     * 2.10.0（需求 4.5 / 4.6）：复活血量受「致命打击」影响（不一定满血）；
     *   并且**闪避成功的那一下不再判负**（血条已空也继续出招）。 */
    if (rec.hp <= 0) {
      const 活 = 尝试复活(rec, 我词条(rec), "我复活过", 怪词条(d, 敌方阶段值(d, rec.敌方阶段)));
      if (活 !== null) {
        rec.hp = 活;
        const 行 = "💫 第 " + 实际 + " 次后被打到 0 血，" + 复活文案(rec, "");
        日志.push(行); 详情日志.push(行);
      } else if (怪伤结果.闪避) {
        const 行 = "🕯 第 " + 实际 + " 次血条已空，但这一击被闪开 —— 继续出招（下次被命中且未闪避才算失败）";
        日志.push(行); 详情日志.push(行);
      } else {
        const 救 = 自动续命(ctx, u, rec);
        if (!救) { 结局 = "lose"; break; }
        续命 += 1;
        const 行 = "❤️ 第 " + 实际 + " 次后被打到 0 血，自动用药续战：" + 救.名 + " +" + kfmt(救.回) + " → " + rec.hp + "/" + rec.hpMax;
        日志.push(行); 详情日志.push(行);
      }
    }
  }
  // 2.5.19：退回未使用次数对应的自动卡（提前胜利 / 失败 / 没药收手都会退）
  const 实用卡 = 计算自动卡消耗(实际);
  const 退卡 = Math.max(0, 需卡 - 实用卡);
  if (退卡 > 0) giveItem(ctx, u, 自动卡名, 退卡);
  // 2.5.18：无论输赢都先存一份「出招详情」，方便随时用 `星甲出招详情` 回看
  const 详情 = {
    时间: Date.now(), 副本: d.id, 名称: rec.名称, 快速: false,
    次数: 实际, 用卡: 实用卡, 退回: 退卡, 剩卡: hasItem(ctx, u, 自动卡名),
    请求次数: k, 预扣卡: 需卡,
    // 3.0.0（需求 19）：策略与「技能 / 普攻」次数，自动详情直接读这里
    策略: 策略, 策略文案: 出招策略文案(策略), 技能名: 技N ? 技N.名 : "", 用技能: 用技能, 用普攻: 用普攻,
    每击: 每击.slice(-每击保留), 日志: 详情日志.slice(-60), 续命: 续命,
    总伤: 总伤, 总承: 总承, 喝药: 喝药, 暴击: 暴击, 被闪: 被闪, 我闪: 我闪,
    bhp: rec.bhp, bhpMax: rec.bhpMax, hp: rec.hp, hpMax: rec.hpMax,
    结局: 结局 === "win" ? "胜利（已结算通关）" : (结局 === "lose" ? "失败（已结算失败）" : (结局 === "超时" ? "回合耗尽（天下楼判失败）" : (结局 === "没蓝" ? "没蓝停手（没蓝药，需要买蓝药）" : "进行中")))
  };
  存出招详情(ctx, u, 详情);
  const 退卡行 = 退卡 > 0 ? "（未用完，退回自动卡 " + 退卡 + " 张）" : "";
  if (结局 === "win") {
    // 3.1.0（需求 1）：先播最后一回合面板（单步自动时不刷屏），再结算
    if (!单步) { 存战斗(ctx, u, rec); try { await 战斗面板(ctx, t, u, rec); } catch (e) { /* ignore */ } }
    if (rec.天下楼) { await 天下楼结算(ctx, t, u, rec, true); return; }
    await 结算战斗(ctx, t, u, rec, d, true); return;
  }
  if (结局 === "超时") { await 天下楼结算(ctx, t, u, rec, false, "回合耗尽"); return; }
  if (结局 === "lose") { if (rec.天下楼) { await 天下楼结算(ctx, t, u, rec, false, "被击倒"); return; } await 结算战斗(ctx, t, u, rec, d, false); return; }
  /* 3.2.0（需求 3）：没蓝药 → **停止自动出招**，弹出「没有蓝了，需要买蓝药」提醒；
   *   战斗本身不判负（普攻仍可继续，随时可手动 `ba|atk`），所以只停自动、不结算、不写失败。 */
  if (结局 === "没蓝") {
    日志.push("🔵 自动出招已停止：" + (没蓝原因 || 没蓝提醒) + "（蓝量 " + (Number(rec.mp) || 0) + "/" + rec.mpMax + "）");
    rec.日志 = 日志.slice(-12);
    存战斗(ctx, u, rec);
    const 停机前 = 读自动(ctx, u);
    自动停机(ctx, u, 没蓝原因 || 没蓝提醒);
    if (单步) {
      // 后台代打：单步不刷屏，但「没蓝」属必须让玩家知道的停机原因 → 单独推一条（没主动消息权限时静默失败）
      if (停机前) {
        try {
          await reply(ctx, 自动目标(停机前), "🔵 **" + (没蓝原因 || 没蓝提醒) + "**\n自动出招已停止（已出 " + 实际 + " 招）· 蓝量 " + (Number(rec.mp) || 0) + "/" + rec.mpMax
            + "\n普攻仍可继续（每回合回 5 蓝），买好蓝药再 `一键出招`。", { 标题: "🔵 没有蓝了，需要买蓝药" });
        } catch (e) { /* 无主动消息权限属正常情况 */ }
      }
      return;
    }
    await reply(ctx, t, 灰混([
      ["用户:" + gid(ctx, u) + "　昵称:" + attrs(ctx, u).昵称, true],
      ["血量:" + rec.hp + "/" + rec.hpMax + "　蓝量:" + (Number(rec.mp) || 0) + "/" + rec.mpMax, true],
      ["BOSS:" + rec.名称 + "　血量 " + kfmt(rec.bhp) + "/" + kfmt(rec.bhpMax), false],
      ["", true],
      ["🔵 **" + (没蓝原因 || 没蓝提醒) + "**", true],
      ["自动出招已停止（已出 " + 实际 + " 招、消耗自动卡 " + 实用卡 + " 张" + 退卡行 + "）", true],
      ["· 蓝色技能需要蓝量：不够时自动喝蓝药（青霜灵液 50 / 幽泉灵乳 200 / 霜华露 300 / 泉心玉髓 1000）", true],
      ["· 现在只能 `ba|atk` 普攻（每次 +1 技能点、每回合回 5 蓝）；买好蓝药再 `一键出招`", true]
    ]), {
      标题: "🔵 没有蓝了，需要买蓝药",
      行组: [
        row(btn("au41", "买青霜灵液×10", "购买#青霜灵液#10"), btn("au42", "买幽泉灵乳×10", "购买#幽泉灵乳#10"), btn("au43", "商店", "商店")),
        row(actBtn("au44", "⚡普攻", "ba|atk"), btn("au45", "战斗面板", "战斗"), btn("au46", "自动详情", "autodetail"))
      ]
    });
    return;
  }
  日志.push("🃏 一键出招 " + 实际 + " 次：造成 " + kfmt(总伤) + " 伤害 · 承伤 " + kfmt(总承) + " · 自动用药 " + 喝药 + " 次 · 自动续战 " + 续命 + " 次");
  rec.日志 = 日志.slice(-12);   // 2.10.0（需求 4.11）：本回合信息（整段替换）
  存战斗(ctx, u, rec);
  // 2.5.54：单步（后台代打）时不发进度汇总 —— 否则每 2 秒刷一条；进度请看 `星甲自动详情`
  if (!单步) await reply(ctx, t, 灰混([
    ["用户:" + gid(ctx, u) + "　昵称:" + attrs(ctx, u).昵称, true],
    ["血量:" + rec.hp + "/" + rec.hpMax + "　技能点:" + (Number(rec.sp) || 0) + "/" + (rec.spMax || 技能点上限), true],
    ["BOSS:" + rec.名称 + "　血量 " + kfmt(rec.bhp) + "/" + kfmt(rec.bhpMax), false],
    [条带(rec.bhp, rec.bhpMax), true],
    ["", true],
    ["🃏 一键出招 " + 实际 + " 次（消耗自动卡 " + 实用卡 + " 张）" + 退卡行, false],
    ["当前策略：" + 出招策略文案(策略) + (策略 > 0 ? "（技能 " + 用技能 + " 次 / 普攻 " + 用普攻 + " 次）" : "（全部普攻）"), true],
    ["造成伤害 " + kfmt(总伤) + "　暴击 " + 暴击 + " 次　被闪避 " + 被闪 + " 次", true],
    ["逐次伤害：" + (每击.length > 12 ? 每击.slice(0, 4).map((v, i) => (i + 1) + "." + kfmt(v)).join(" ") + " … " + 每击.slice(-8).map((v, i) => (每击.length - 7 + i) + "." + kfmt(v)).join(" ") : 每击.map((v, i) => (i + 1) + "." + kfmt(v)).join(" ")), true],
    ["受到伤害 " + kfmt(总承) + "　你闪避 " + 我闪 + " 次　自动用药 " + 喝药 + " 次　自动续战 " + 续命 + " 次", true],
    ["累计伤害 " + 大数(rec.累计伤害) + "　回合 " + rec.轮, true],
    ["", true],
    ["自动卡剩 " + hasItem(ctx, u, 自动卡名) + " 张 · 每招 " + (自动每击毫秒 / 1000) + " 秒　详情见 " + 蓝字("星甲自动详情", "出招详情"), true]
  ]), {
    标题: "🃏 一键出招",
    行组: [
      row(btn("au11", "一键出招×10", "autoatk|10"), btn("au12", "一键出招×100", "autoatk|100"), btn("au13", "查看详情", "autodetail")),
      row(btn("au14", "⏱ 挑战1小时", "autoatk|1h"), btn("au15", "⏱ 挑战8小时", "autoatk|8h"), btn("au16", "⏱ 挑战50小时", "autoatk|50h")),
      row(btn("au14", "买自动卡×10", "购买#自动卡#10"), btn("au15", "买自动卡×100", "购买#自动卡#100"), actBtn("au16", "⚡普攻", "ba|atk"), btn("au17", "技能", "技能"), btn("au18", "副本", "副本"))
    ]
  });
}


// 2.5.9：一键出招前的「开始自动」提示由 一键出招 内部直接回复，这里不再单独占位
export async function 结算战斗(ctx, t, u, rec, d, 赢) {
  const p = attrs(ctx, u);
  rec.结果 = 赢 ? "胜利" : "失败";
  // 3.2.0（需求 1）：战斗结束 → 把战斗内蓝量**写回全局蓝量**（胜负都要写；PVP / 天下楼同口径）
  战斗蓝量写回(ctx, u, rec);
  if (赢) {
    /* 3.0.0（需求 A）翻倍挑战 = **连续打 N 次**：
     *   下面所有「按场」的东西 —— 经验 / 星羽 / 星核 / 材料 / 装备掉落与保底 / 星石 / 刷新卡 /
     *   生长药水 / 金币兽金币 / 信用分 —— 一律按 N 场累加；首通加成只给第 1 场。
     *   口径写死成「真的打了 N 场」，所以不会出现「吃了 N 次保底却不掉」。
     *   入场费 / 返还仍按 1 份算（见下方 返还行）。 */
    const 翻倍N = 翻倍次数(rec && rec.翻倍);
    const 首 = !dgDone(ctx, u, d.id);
    const 是BOSS = d.id >= 200;      // 提前声明：掉落 / 报名 / 返还 多处复用
    // 2.9.4（H）：奖励实际到账值（含称号 + 全服倍率），用于结算面板「基础 → 实际」对比。
    //   倍率在这里**一次性取好**并复用：结算过程中可能新授予称号（recPwr → 巡检），
    //   若展示时再取一次，会出现「实际 9」却标「×1.37」这种与实际到账对不上的数。
    const 倍经验 = 奖励倍率(ctx, u, "经验");
    const 倍星羽 = 奖励倍率(ctx, u, "星羽");
    const 倍星核 = 奖励倍率(ctx, u, "星核");
    const 倍金币 = 奖励倍率(ctx, u, "金币");
    const 材料 = {};
    const 掉 = [];
    const 掉装 = [];
    let xp = 0, coin = 0, core = 0, 实经验 = 0, 实星羽 = 0, 实星核 = 0, 实金币 = 0;
    let 星石数 = 0, 刷新卡数 = 0, 生长药水数 = 0;
    for (let i = 0; i < 翻倍N; i++) {
      const 首i = 首 && i === 0;
      const xpI = Math.round(rnd(d.经[0], d.经[1]) * (首i ? 1.6 : 1));
      const coinI = Math.round(rnd(d.币[0], d.币[1]) * (首i ? 1.5 : 1));
      const coreI = Math.round(Number(d.核) || 0) + (首i ? 2 : 0);
      xp += xpI; coin += coinI; core += coreI;
      实经验 += Math.max(0, Math.floor(xpI * 倍经验));
      实星羽 += Math.max(0, Math.floor(coinI * 倍星羽));
      if (coreI > 0) 实星核 += Math.max(0, Math.floor(coreI * 倍星核));
      // 材料（2.9.9：掉落倍率作用于数量，按名字累计一次显示）
      for (const item of (d.掉 || [])) {
        const c = Math.floor(rnd(item[1], item[2]) * 细分倍率(ctx, "掉落"));
        if (c > 0) { giveItem(ctx, u, item[0], c); 材料[item[0]] = (材料[item[0]] || 0) + c; }
      }
      // 装备：每一场独立判定 + 独立推进保底（BOSS 三档各自保底 / 副本一次最多一件）
      if (是BOSS) { for (const x of BOSS掉落(ctx, u, d)) 掉装.push(x); }
      else { const x = 副本掉落(ctx, u, d); if (x) 掉装.push(x); }
      // 星石：普通副本 1 / BOSS 2，每场都掉
      星石数 += 是BOSS ? 2 : 1;
      // 2.5.13：刷新卡（普通 10% / BOSS 25%）每场各 roll 一次
      if (Math.random() < (是BOSS ? 0.25 : 0.1)) 刷新卡数 += 1;
      // 2.9.12：BOSS 每场 1~10 个生长药水（每日累计上限在 掉生长药水() 内部控）
      if (是BOSS) { const 药 = 掉生长药水(ctx, u); if (药 > 0) 生长药水数 += 药; }
      // 2.5.13：金币兽固定额外产金币 × 场次
      if (d.金城 && Number(d.金产) > 0) 实金币 += Math.max(0, Math.floor(Number(d.金产) * 倍金币));
    }
    if (星石数 > 0) giveItem(ctx, u, "星石", 星石数);
    if (刷新卡数 > 0) giveItem(ctx, u, "刷新卡", 刷新卡数);
    const up = 加经验(ctx, u, xp);   // 内部已按 奖励倍率(ctx,u,"经验") 放大，与面板「实际」同源
    addCoin(ctx, u, 实星羽);
    if (core > 0) addCore(ctx, u, 实星核);
    if (实金币 > 0) dset(ctx, P.金币, u, dn(ctx, P.金币, u, 0) + 实金币);
    if (首) dgMark(ctx, u, d.id);
    if (首 && 是BOSS) 授系统称号(ctx, u, "首战破军");   // P9：首次击败 BOSS 自动授予
    const 次 = 挑战次数(ctx, u, d.id);
    for (const nm of Object.keys(材料)) if (材料[nm] > 0) 掉.push(nm + "×" + 材料[nm]);
    for (const x of 掉装) 掉.push("【" + x.名 + "】（" + (x.品质 || "普通") + "装备" + (x.保底 ? "·保底" : "") + "）");
    if (星石数 > 0) 掉.push("星石×" + 星石数);
    if (刷新卡数 > 0) 掉.push("刷新卡×" + 刷新卡数);
    if (生长药水数 > 0) 掉.push("生长药水×" + 生长药水数);
    if (是BOSS && !掉装.length) {
      掉.push("本次" + (翻倍N > 1 ? " " + 翻倍N + " 场都" : "") + "未出装备（普通保底还剩 " + 剩普通保底(ctx, u, d.id) + " 次 / 史诗保底还剩 " + 剩史诗保底(ctx, u, d.id) + " 次 / 传说保底还剩 " + 剩传说保底(ctx, u, d.id) + " 次）");
    }
    rec.掉落装备 = 掉装;
    // 2.5.13：金币兽固定额外产金币
    let 金行 = "";
    if (实金币 > 0) 金行 = "★ 金币兽额外产出：金币 +" + kfmt(实金币) + (翻倍N > 1 ? "（" + 翻倍N + " 场）" : "");
    // 2.5.53：**挑战成功返还 80% 入场消耗**（按需求：回退 + 奖励 = 入场的 80%，即净消耗 20%）
    //   只按「入场费」计算（该 BOSS 的 需币 与 花 = 需币 ÷ 5），击败奖励（经验 / 星羽 / 星核 / 掉落）另算。
    let 返还行 = "";
    if (是BOSS) {
      const 返币 = Math.floor((Number(d.需币) || 0) * BOSS入场返还比例);
      const 返花 = Math.floor(Math.max(1, Math.ceil((Number(d.需币) || 0) / 5)) * BOSS入场返还比例);
      if (返币 > 0) dset(ctx, P.金币, u, dn(ctx, P.金币, u, 0) + 返币);
      if (返花 > 0) giveItem(ctx, u, "花", 返花);
      返还行 = "返还 + 奖励合计 " + Math.round(BOSS入场返还比例 * 100) + "% 入场：金币 +" + kfmt(返币) + " · 花 +" + 返花
        + "（净消耗 " + kfmt((Number(d.需币) || 0) - 返币) + " 金币 + " + (Math.max(1, Math.ceil((Number(d.需币) || 0) / 5)) - 返花) + " 花 = 20%）";
    }
    // 2.9.6（需求 8）：通关副本 +1 信用分 / 击败 BOSS +2 信用分（3.0.0：翻倍按 N 场累加）
    加信用分(ctx, u, (是BOSS ? 2 : 1) * 翻倍N, (是BOSS ? "击败 BOSS " : "通关副本 ") + d.名 + (翻倍N > 1 ? " ×" + 翻倍N : ""));
    // 2.9.9（需求 E）：股市事件联动 —— 击败 BOSS → 星舰重工 +5%；通关副本 → 深空能源 +2%（节流 10 分钟/股）
    if (是BOSS) 股事件(ctx, "02", 0.05, "⚠️ BOSS 被击杀，军工订单看涨");
    else 股事件(ctx, "06", 0.02, "副本通关潮，能源需求上升");
    recPwr(ctx, u);
    /* 3.0.0（Lead 追加）婚姻分成：经验 / 星羽 / 金币 各调一次，返回值给配偶（1% 上限、模块到位后自动生效）。
     *   marriage.mjs 未就绪时 婚姻分成() 直接返回 0，不产生任何副作用。 */
    const 婚经 = await 婚姻分成(ctx, u, "经验", 实经验);
    const 婚羽 = await 婚姻分成(ctx, u, "星羽", 实星羽);
    const 婚金 = await 婚姻分成(ctx, u, "金币", 实金币);
    const 婚行 = (婚经 + 婚羽 + 婚金 > 0)
      ? "💍 婚姻分成给配偶：" + [婚经 ? "经验 +" + kfmt(婚经) : "", 婚羽 ? "星羽 +" + kfmt(婚羽) : "", 婚金 ? "金币 +" + kfmt(婚金) : ""].filter(Boolean).join(" · ")
      : "";
    const 结算行 = [
      // 3.0.0（需求 A）：翻倍口径写在结算面板里，玩家不用猜
      ...(翻倍N > 1
        ? [["🔥 翻倍挑战 " + 翻倍N + " 次：血量 ×" + 翻倍N + " · 其它属性 ×" + 翻倍属性倍 + " · 冷却 " + Math.round(翻倍冷却毫秒(是BOSS, 翻倍N) / 60000) + " 分钟 · 掉落与保底按 " + 翻倍N + " 次结算", false]]
        : []),
      ["经验 +" + kfmt(实经验) + (up.升级 ? "（升级 " + up.升级 + " 次 → Lv." + up.等级 + "）" : ""), true],
      ["星羽 +" + kfmt(实星羽) + (core ? "　星核 +" + 实星核 : ""), true],
      [掉.length ? "掉落：" + 掉.join(" · ") : "掉落：无", true],
      ["", true],
      ["累计伤害 " + 大数(rec.累计伤害) + "　承伤 " + 大数(rec.累计受伤) + "　回合 " + rec.轮, true],
      ["当前 Lv." + dn(ctx, P.等级, u, 1) + "　战力 " + kfmt(pwrOf(ctx, u)), true]
    ];
    if (返还行) 结算行.splice(4, 0, [返还行, true]);
    if (金行) 结算行.splice(4, 0, [金行, true]);
    if (婚行) 结算行.splice(4, 0, [婚行, true]);
    // 2.9.4（H）：倍率 > 1 才显示「全服倍率」与逐项对比（经验/星羽/星核/金币兽金币）
    {
      const 项表 = [
        倍率项("经验", xp, 实经验, 倍经验),
        倍率项("星羽", coin, 实星羽, 倍星羽),
        core > 0 ? 倍率项("星核", core, 实星核, 倍星核) : "",
        (d.金城 && Number(d.金产) > 0) ? 倍率项("金币", Number(d.金产) * 翻倍N, 实金币, 倍金币) : ""
      ];
      const 倍行 = 倍率对比行(ctx, u, 项表);
      if (倍行.length) 结算行.splice(3, 0, ...倍行);
    }
    rec.结算 = { 赢: true, 翻倍: 翻倍N, 经验: xp, 星羽: coin, 星核: core, 星石: 星石数, 掉落: 掉, 返还: 返还行, 金币产出: 实金币, 婚姻: 婚经 + 婚羽 + 婚金 };
    rec.结束 = Date.now();
    存战斗(ctx, u, rec);
    pushLog(ctx, u, (是BOSS ? "BOSS " : "副本 ") + d.名 + " 通关" + (翻倍N > 1 ? "（翻倍 " + 翻倍N + "）" : ""));
    await 回执(ctx, t, 灰混([
      [是BOSS ? "BOSS副本:【" + (d.序号 || d.id - 200) + "】" + d.名 : "副本列表:【" + d.id + "】" + d.名, false],
      ["★ 已通关（第 " + 次 + " 次挑战" + (翻倍N > 1 ? " · 本次翻倍 " + 翻倍N + " 次" : "") + "）", true],
      ["", true],
      ["结算", false]
    ].concat(结算行)), {
      标题: "🏆 结算",
      行组: [
        row(actBtn("bc1", "⚡再来一次", "xgstart|" + d.id), actBtn("bc2", "⚡属性", "info"), actBtn("bc3", "⚡背包", "bag|1"), btn("bc4", "副本", "副本")),
        ...(是BOSS
          ? [row(btn("bc7", "翻倍3再来", "挑战" + d.id + "#3"), btn("bc8", "翻倍5再来", "挑战" + d.id + "#5"), btn("bc5", "BOSS列表", "BOSS列表"), btn("bc6", "星甲菜单", "星甲菜单"))]
          : [row(btn("bc7", "翻倍3再来", "挑战" + d.id + "#3"), btn("bc8", "翻倍5再来", "挑战" + d.id + "#5"), btn("bc5", "BOSS列表", "BOSS列表"), btn("bc6", "星甲菜单", "星甲菜单"))])
      ]
    });
    return;
  }
  // ---------- 失败分支 ----------
  // 2.5.9：挑战失败也要返还 50% 入场费（金币 + 花），并且【不计入保底】（保底只在通关里推进）
  {
    const 救 = 自动服药(ctx, u, rec, true);
    if (救.ok && 救.药) {
      rec.结果 = "";   // 续战 → 重新变成「进行中」
      存战斗(ctx, u, rec);
      pushLog(ctx, u, "自动用药 " + 救.药 + "（" + rec.hp + "/" + rec.hpMax + "）");
      await reply(ctx, t, "💊 自动用药：服【" + 救.药 + "】回血 " + kfmt(救.回) + "\n血量 " + rec.hp + "/" + rec.hpMax + " · 剩 " + 救.剩 + " 个\n战斗继续。", {
        标题: "💊 自动用药",
        行组: [row(actBtn("au1", "⚡普攻", "ba|atk"), actBtn("au2", "⚡1档150%", "ba|skill|1"), actBtn("au3", "⚡4档300%", "ba|skill|4"), actBtn("au4", "⚡逃跑", "ba|flee"))]
      });
      return;
    }
    const hurt = rnd(30, 80) + Math.round(d.id * 3);
    // 2.9.4：基数用「当前真实血量」（战斗中血量已被消耗），并 clamp 到 [0, 上限]
    const 剩血 = 设血量(ctx, u, Math.max(0, 当前血量(ctx, u) - hurt));
    // 2.5.54：**挑战失败返还 50%**（按需求恢复；通关才是 80%，别混）
    let 返还行 = "";
    if (d.id >= 200) {
      const 返币 = Math.floor((Number(d.需币) || 0) * BOSS失败返还比例);
      const 返花 = Math.floor(Math.max(1, Math.ceil((Number(d.需币) || 0) / 5)) * BOSS失败返还比例);
      if (返币 > 0) dset(ctx, P.金币, u, dn(ctx, P.金币, u, 0) + 返币);
      if (返花 > 0) giveItem(ctx, u, "花", 返花);
      返还行 = "返还 50% 入场：金币 +" + kfmt(返币) + " · 花 +" + 返花;
    }
    rec.结算 = { 赢: false, 伤害: rec.累计伤害, 目标生命: rec.bhpMax, 血量损失: hurt, 返还: 返还行 };
    rec.结束 = Date.now();
    存战斗(ctx, u, rec);
    pushLog(ctx, u, "挑战失败 " + d.名);
    await 回执(ctx, t, 灰混([
      [d.id >= 200 ? "BOSS副本:【" + (d.序号 || d.id - 200) + "】" + d.名 : "副本列表:【" + d.id + "】" + d.名, false],
      ["★ 挑战失败（被【" + d.名 + "】击倒）", true],
      ["", true],
      ["结算", false],
      ["造成伤害 " + 大数(rec.累计伤害) + " / BOSS血量 " + kfmt(rec.bhpMax), true],
      // 3.0.0 修复：把「最后一回合」贴出来，玩家能看懂是被什么打死的（原来只报一个战斗外血量惩罚，看起来莫名）
      ...(Array.isArray(rec.日志) && rec.日志.length
        ? [["", true], ["最后一回合（战斗内）", false], ...rec.日志.slice(-6).map((x) => ["　" + x, true])]
        : []),
      ["", true],
      ["血量 -" + hurt + "（剩 " + 剩血 + "）· 这是**战斗外血量**的失败惩罚（战斗内血量 = 上面「队伍信息」那一套，两者分开算）", true],
      ...(剩血 <= 0 ? [["⚠️ 血量已归零：先 `星甲修复战甲` 或吃药再开战（不是战斗判死，是血条空了）。", true]] : []),
      [返还行 || "本次无入场费可返还", true],
      ["保底：本次失败**不计入保底**（保底只在通关未出时推进）", true],
      ["", true],
      ["提示：`商店` 买药（赤霄血露/碧髓回春液…）后即可自动续战。", true]
    ]), {
      标题: "💀 结算",
      行组: [
        row(actBtn("bd1", "⚡再来一次", "xgstart|" + d.id), actBtn("bd2", "⚡买药", "商店"), actBtn("bd3", "⚡属性", "info"), btn("bd4", "副本", "副本"))
      ]
    });
    return;
  }
}



/* ============================================================
 * 2.5.28 天下楼（爬塔 · 独立暴击公式 · 回合限时）
 *  · 一层一个强敌，击败后自动进入下一层；层数永久累积（失败不掉层）
 *  · 2.5.51：总层数 **99 → 1000**；1~99 层（经典层）所有数值保持原样，
 *    100 层起用「经典层锚点 + √ / 对数压缩」平滑延伸（推荐等级、奖档、承伤、怪物数值、掉落档全部适配）
 *  · 2.5.31 数值重做：推荐等级 ≈ 3×层数；奖励档 = 0.25 + 1.8×(层/99)²（1 层 0.25 → 99 层 2.05），
 *    怪物血 / 攻 / 防随层数加速上涨（越往后越难越富）
 *  · 每 10 层是「楼层主」，数值 ×1.25、奖励 ×1.5
 *  · **50 回合内**必须击败，超过 50 回合判挑战失败（回合耗尽）
 *  · 2.9.3：塔内**同样受单刀上限约束**（普攻 25% / 技能 35%，与副本 / BOSS 一致）
 *  · 塔内怪物伤害走**独立公式**：你的血量上限 × 1.5%~9%（随层数上涨，防御温和减免），暴击 ×1.5
 *  · 天下楼独立暴击公式：[（攻击力 - 怪物防御）+ 怪物防御] × 暴伤% × 等级加成（150 级 = 250%）
 * ============================================================ */
// 2.5.51：**99 层 → 1000 层**
//   适配原则：**1~99 层的所有数值一分不变**（老玩家的手感、进度、药耗全部照旧），
//   100~1000 层用「经典层锚点 + 压缩曲线」平滑延伸，绝不直接线性放大（否则 1000 层会变成天文数字）。
//   · 天下楼经典层 = 99：所有公式在 L ≤ 99 时公式原样；L > 99 时换用压缩曲线
//   · 推荐等级：99 层 297 级 → 1000 层约 944 级（√ 压缩，约需 30 次转生）
//   · 奖励档：99 层 2.05 → 1000 层约 2.55（对数压缩；不会像线性那样爆到几十倍）
//   · 承伤系数：99 层 3.0 倍 → 1000 层 6.0 倍（对数压缩）
// 2.5.52：**顶层 1000 → 250**（按需求收缩）
//   适配原则不变：**1~99 层（经典层）数值一分不变**，100~250 层继续沿用上一版的压缩曲线，
//   只是上限从 1000 收到 250，所以 100~250 层的手感与 2.5.51 完全一致（不会因为改上限而变强/变弱）。
export const 天下楼层数 = 250;


export const 天下楼经典层 = 99;


// 2.7.0（需求 3）：天下楼**取消回合限制** —— 不再判「回合耗尽」，打多久都行。
//   保留这个常量只为兼容旧存档里的 轮 计数与文案，实际已不参与任何胜负判定。
export const 天下楼回合上限 = 999999;


export const 天下楼闪避率 = 10;

   // 天下楼怪物固定 10% 闪避（判定方式与玩家完全一致）
// 2.5.46：**天下楼奖励整体 ×100**
//   原因：高层经验需求是指数级（180 级起 460 万/级），而塔的奖励是按「力 × 奖档」算出来的，
//   99 层一次只有 25~40 万经验 ≈ 半级都不到，「辛苦打半天连 1 级都升不了」。
//   现在统一乘这个系数（只乘 经验 / 星羽 / 星核 三个数值奖励，**道具掉落不乘**，
//   否则星辉宝箱、幸运星也会 ×100，经济直接崩）。
//   · 想再调快/调慢：只改这一个数（100 → 200 就是两倍，50 就是一半）
export const 天下楼奖励倍数 = 100;


// 2.5.47：**按回合数发放**的四项奖励 —— 花 / 金币 / 刷新卡 / 自动卡
//   数量 = 击败本层所用回合数 × 这个比例（默认 80%，向下取整，至少 1 个）
//   设计意图：回合多 = 打得辛苦 = 多给；堆爆发一回合秒掉就给 1 个，避免「一击秒杀反而收益最高」
export const 天下楼回合奖励比例 = 0.8;


// 2.5.48：**刷新卡单独调低**（其他三项 花 / 金币 / 自动卡 保持 回合数×80% 不变）
//   原因：刷新卡商店价 10000 星羽，按 80% 发的话一层就是 100~480 张（= 100~480 万星羽等价物），
//        配合 2.5.46 经验已 ×100，刷新卡会彻底白菜化。
//   现在改为：回合数 × 5%（约原来的 1/16），并且**单层硬上限 20 张**，防止极高层失控。
//   参考：300 回合 → 15 张；600 回合 → 封顶 20 张。
export const 天下楼刷新卡比例 = 0.05;


export const 天下楼刷新卡上限 = 20;


// 2.5.49：**花 / 金币 单独调高**（后期这俩是硬消耗，按回合数 ×80% 发根本不够用）
//   数据依据：
//     · 花 —— BOSS 入场「花 = 入场金币 ÷ 5」，后期一次要 5600~7000 花（BOSS 13~15 号）
//     · 金币 —— 装备升级（2.5.50 起）「金币 = 6 × 段位 × √(等级+1)」，段位 460 升到 100 级 ≈ 187 万金币
//   现在：花 = 回合数 × 2000%（约原来 25 倍）、金币 = 回合数 × 4000%（约原来 50 倍）
//   2.5.50：再各 ×10 —— 花 ×2000%、金币 ×4000%（后期一层塔才够一次 BOSS 入场费）
//   自动卡仍 80%、刷新卡仍 5%（封顶 20）不变；想再调只改这两个数即可
export const 天下楼花比例 = 40;


export const 天下楼金币比例 = 80;


// 2.5.53（按需求重做数值）：
//  ① **怪物攻击力翻倍**（原来塔内伤害走「承伤预算」，比 BOSS 还软，玩家几乎死不了一次）
//     → 现在塔内伤害改成**攻击驱动**（与 BOSS 同一套 战斗伤害 公式），并且 `攻` 直接 ×2，
//       暴伤也从 50% 提到 **100%**，于是狂暴时（×2）一次暴击就能「一巴掌扇死」脆皮。
//  ② **经验 = 升级所需经验 × 10%**：`经 = xpNeed(推荐等级) × 0.10`（楼层主再 ×1.5），
//     语义变成「打一层 ≈ 当前推荐等级的一成的经验」，越上层推荐等级越高 → 经验自然越高。
//  ③ **总收益 ≈ 挑战消耗的 200%**：塔内唯一消耗是药，
//     药费按「1 点血 = 0.5 星羽」（赤霄血露 30 星羽 / 回 60 血，最省的买法）折算，
//     星羽奖励 = 药费 × 2 → 净赚 100%（药钱全回 + 再赚一份）。
//  ④ **30 层起基础血量逐层加厚**（见 天下楼层血倍），并且低层的「按玩家血量缩放」比例下调，
//     这样同一个高属性玩家在 1 层和 250 层面对的墙**不再一样厚**（原来两处血量几乎相同）。
export const 天下楼攻倍数 = 2;

             // ↀ 攻击力翻倍
// 2.9.14（需求 2）：塔怪真伤 —— 玩家属性一高塔怪就打不动玩家，与 BOSS真伤加成 同思路翻倍量级：
//   塔怪统一携带「真伤概率」词条（命中按概率无视玩家防御），怪物 → 玩家走 怪物伤害() 时经 怪词条() 消费。
// 2.10.0（需求 4.2/4.3）：24 → **36** —— 塔怪词条强度必须恒高于同段 BOSS 最高档（真伤 24 + 8 项词条，
//   归一化 6.5），塔怪取 36 后归一化 ≈7.3，且仍是「固定值、不读玩家属性」。
//   boss.mjs 的 塔敌人词条.真伤概率 直接引用这个常量（单一来源，改一处即同步）。
export const 天下楼真伤加成 = 36;


export const 天下楼暴伤基准 = 100;

         // 塔内暴伤%（狂暴 ×2 → 200%）
export const 天下楼经验占比 = 0.10;

        // 经验 = 升级所需 × 10%
export const 天下楼收益倍率 = 2;

           // 星羽奖励 = 药费 × 200%
export const 塔内每点血药费 = 0.5;


