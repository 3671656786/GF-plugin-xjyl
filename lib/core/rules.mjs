// lib/core/rules.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S } from "././base.mjs?v=v1795617529640";
import { attrs } from "./../game/player.mjs?v=v1795617529640";

// 头像 URL（参考 GF-plugin-xinjia）：优先事件自带，其次数值 QQ，最后 QQ 小程序域名
/* ---------- 2.3.0 装备图标（参考新版 UI：武器🗡 防具👕 裤腿👖 饰品💍 圣物🔱） ---------- */
export const 装备图标 = { 武器: "🗡", 护甲: "👕", 裤腿: "👖", 饰品: "💍", 圣物: "🔱" };


export function 图标(类) { return 装备图标[S(类)] || "📦"; }


export function 装备图标行(名, 类) { return 图标(类) + " " + S(名); }


// 2.3.0：血量 = 血量（共用同一数值，不再有两套）
export function 血量(ctx, u) { const p = attrs(ctx, u); return { 现有: p.血量, 上限: p.血量上限 }; }


// 2.3.0：闪避生效 —— 按闪避率判定是否免伤（暴击/闪避都用百分比）
// 2.5.2：闪避上限 40%（超过部分不计算；暴击率上限见 暴击率上限）
export const 闪避上限 = 40;


// 2.5.27：暴击率上限 80%（玩家与 BOSS 同一套，超过按 80% 计算）
export const 暴击率上限 = 80;


export function 闪避判定(闪避率) {
  const r = Math.max(0, Math.min(闪避上限, Number(闪避率) || 0));
  return Math.random() * 100 < r;
}
