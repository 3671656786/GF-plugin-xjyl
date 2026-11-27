// lib/game/equip.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { menuBtn } from "./../admin/admin.mjs?v=v1795803973703";
import { S, dall, dget, dn, ds, dset, kfmt, n, pushLog, rnd } from "./../core/base.mjs?v=v1795803973703";
import { actBtn, btn, reply, row, 蓝字, 蓝链 } from "./../core/qq.mjs?v=v1795803973703";
import { 闪避上限 } from "./../core/rules.mjs?v=v1795803973703";
import { P } from "./../core/util.mjs?v=v1795803973703";
import { 加点面板, 灰混 } from "././cook.mjs?v=v1795803973703";
import { 扣世界资金, 补货提示, 资金见底 } from "././credit.mjs?v=v1795803973703";
import { 显示品质, 规范装备名 } from "././dungeon.mjs?v=v1795803973703";
import { 是菜品, 菜价 } from "././farm.mjs?v=v1795803973703";
import { addCoin, addCore, allItems, attrs, gid, hasItem, itemPrice, pwrOf, recPwr, takeItem, 裁剪词条, 倍率说明, 全服倍率, 加经验, 我的道具集, 迁移属性字段 } from "././player.mjs?v=v1795803973703";
import { tInc } from "././progress.mjs?v=v1795803973703";
import { 是药品, 装备定义, 装备描述, 装备表 } from "././rebirth.mjs?v=v1795803973703";

export function fmtNum(v) {
  const x = Number(v) || 0;
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}


export const 道具说明表 = {
  红色血清: "使用后血量上限 +30 / 个（每日上限 5000）· 副本掉落 / 挖矿获得，**商店不卖**",
  翠露散: "使用后立刻恢复血量 80 / 个（原翠露散）",
  星石: "装备升级材料：副本每次掉 1 个 / BOSS 每次掉 2 个；升级每级消耗 = 当前等级 + 2 个（1 级 2 个、50 级 51 个、100 级 101 个）",
  太空废铁: "使用后拆解成星羽",
  陨石碎片: "使用后精炼成星核",
  幸运星: "使用后暴击伤害 +5% / 个（直接进属性面板，每日上限 100）· 商店 500 星羽",
  幸运币: "使用后参与一次幸运抽奖",
  强化组件: "使用后攻击力 +5~15 / 个（每日上限 1000，也可用于星核兑换）",
  刷新卡: "使用后重置副本与时空门冷却（商店 10000 星羽）",
  自动卡: "一键出招消耗品：每出招 1 次耗 1 张（商店 100 星羽 / 张）",
  生长药水: "对一块生长中的农田使用，立即催熟该地块作物（`星甲催熟#地块号`；商店 1000 星羽 / 个，每日限购 100；BOSS 与天下楼通关也会掉落，每日掉落上限 100）",
  护盾芯片: "使用后血量上限 +50 / 个（每日上限 1000）",
  改名卡: "使用后可以改名（`改名新昵称`）",
  经验芯片: "使用后经验 +300 / 个（**不受每日上限限制**）",
  火力核心: "使用后攻击力 +30 / 个（每日上限 1000）",
  星辉宝箱: "使用后开出星羽 / 星核 / 随机道具",
  // 2.5.40：农场种子 / 作物
  星芽种子: "农场种子：种下 3 分钟成熟 → 星芽菜 ×3（卖 180 星羽）",
  露珠种子: "农场种子：种下 8 分钟成熟 → 露珠果 ×3（卖 480 星羽）",
  火焰种子: "农场种子：种下 15 分钟成熟 → 火焰椒 ×2（卖 760 星羽）",
  霜叶种子: "农场种子：种下 25 分钟成熟 → 霜叶菇 ×2（卖 1600 星羽）",
  月光种子: "农场种子：种下 40 分钟成熟 → 月光花 ×2（卖 3600 星羽）",
  星辉种子: "农场种子：种下 60 分钟成熟 → 星辉果 ×1（卖 4500 星羽）",
  星芽菜: "农场作物：卖 60 星羽 / 个，或做「凉拌星芽」",
  露珠果: "农场作物：卖 160 星羽 / 个，或做「露珠果酱」",
  火焰椒: "农场作物：卖 380 星羽 / 个，或做「火焰椒拌面」",
  霜叶菇: "农场作物：卖 800 星羽 / 个，或做「霜叶菌汤」",
  月光花: "农场作物：卖 1800 星羽 / 个，或做「月光花蜜」",
  星辉果: "农场作物：卖 4500 星羽 / 个，或做「星辉果盘」「星辰盛宴」",
  // 2.9.0（需求 4）：新增高级种子 / 作物
  彗星种子: "农场种子：种下 90 分钟成熟 → 彗星瓜 ×2（卖 16000 星羽）",
  极光种子: "农场种子：种下 120 分钟成熟 → 极光兰 ×2（卖 28000 星羽）",
  陨晶种子: "农场种子：种下 180 分钟成熟 → 陨晶薯 ×1（卖 26000 星羽）",
  龙息种子: "农场种子：种下 240 分钟成熟 → 龙息椒 ×1（卖 42000 星羽）",
  圣辉种子: "农场种子：种下 300 分钟成熟 → 圣辉麦 ×1（卖 60000 星羽）",
  虚空种子: "农场种子：种下 360 分钟成熟 → 虚空莓 ×1（卖 85000 星羽）",
  永昼种子: "农场种子：种下 420 分钟成熟 → 永昼桃 ×1（卖 115000 星羽）",
  星穹种子: "农场种子：种下 480 分钟成熟 → 星穹果 ×1（卖 150000 星羽）",
  彗星瓜: "农场作物：卖 8000 星羽 / 个，或做「彗星瓜盅」",
  极光兰: "农场作物：卖 14000 星羽 / 个，或做「极光沙拉」",
  陨晶薯: "农场作物：卖 26000 星羽 / 个，或做「陨晶薯泥」",
  龙息椒: "农场作物：卖 42000 星羽 / 个，或做「龙息辣煲」",
  圣辉麦: "农场作物：卖 60000 星羽 / 个，或做「圣辉麦粥」",
  虚空莓: "农场作物：卖 85000 星羽 / 个，或做「虚空莓塔」",
  永昼桃: "农场作物：卖 115000 星羽 / 个，或做「永昼蜜饮」",
  星穹果: "农场作物：卖 150000 星羽 / 个，或做「星穹盛宴」",
  彗星瓜盅: "菜品：血量 +800 · 经验 +4000",
  极光沙拉: "菜品：攻击 +100（永久）· 经验 +6000",
  陨晶薯泥: "菜品：防御 +120 · 暴伤 +5%（永久）· 经验 +9000",
  龙息辣煲: "菜品：攻击 +200 · 暴击率 +1%（永久）· 经验 +14000",
  圣辉麦粥: "菜品：血量上限 +2400（永久）· 经验 +20000",
  虚空莓塔: "菜品：攻击 +300 · 暴伤 +10%（永久）· 经验 +28000",
  永昼蜜饮: "菜品：暴击率 +2% · 血量上限 +3000（永久）· 经验 +38000",
  星穹盛宴: "菜品：攻击 +450 · 防御 +250 · 血量上限 +4000 · 暴伤 +15%（永久）· 经验 +55000",
  鱼饵: "钓鱼消耗品",
  小鱼: "食材，可在交易行出售",
  大鱼: "食材，可在交易行出售",
  稀有鱼: "稀有食材，可在交易行出售",
  传说鱼: "传说食材，可在交易行出售 · 也能做成传说菜",
  烤小鱼: "菜品：血量 +120 · 经验 +60",
  小鱼汤: "菜品：血量 +260 · 经验 +150",
  香煎大鱼: "菜品：攻击力 +8（永久）· 经验 +200",
  大鱼炖锅: "菜品：血量 +600 · 攻击 +15（永久）· 经验 +400",
  稀有鱼刺身: "菜品：攻击 +40 · 暴击率 +1%（永久）· 经验 +900",
  稀有鱼寿司: "菜品：防御 +60 · 暴伤 +8%（永久）· 经验 +1500",
  传说鱼宴: "菜品：攻击 +150 · 防御 +120 · 攻击力 +50（永久）· 经验 +5000",
  传说鱼王煲: "菜品：血量上限 +2000 · 暴击率 +3%（永久）· 经验 +12000",
  花: "一朵花 · 副本入场消耗品（也可以送人）",
  赤霄血露: "使用后立刻恢复 **60** 血量（商店 30 星羽 / 瓶）",
  碧髓回春液: "使用后立刻恢复 **200** 血量（商店 120 星羽 / 瓶）",
  玄元凝血膏: "使用后立刻恢复 **600** 血量（商店 380 星羽 / 瓶）",
  九幽血髓酿: "使用后立刻恢复 **2000** 血量（商店 1200 星羽 / 瓶）",
  太虚还魂汤: "使用后立刻恢复 **5000** 血量（商店 4000 星羽 / 瓶；不是加满，是固定回 5000）",
  退级卡: "降 1 级，换取短期的经验加成；注意：使用后下一次升级有 30 分钟冷却！！！"
};


export function 道具描述(nm) { return 道具说明表[S(nm)] || "可在商店 / 交易行使用"; }


export function 副本掉装备(ctx, u, d) {
  if (!d) return "";
  const 池 = 装备表.filter((x) => x.段 <= d.段).sort((a, b) => b.段 - a.段).slice(0, 4);
  if (!池.length) return "";
  const 概率 = d.段 <= 10 ? 0.52 : 0.42;
  if (Math.random() > 概率) return "";
  const e = 池[rnd(0, 池.length - 1)];
  入背包(ctx, u, e.名, 1);
  return e.名 + "·" + e.类;
}


export function 装备加成(e, 升级等级) {
  // 2.3.0：6 基础词条 —— 攻击/防御/血量/闪避/暴击率/暴击伤害
  // 2.8.0（需求 1）：再加「百分比词条」（真伤 / 吸血 / 追击 / 反击 …），走 词条 子对象
  // 3.0.0（需求 4.9 / 11）：特殊词条只有传说装备才有（定义里普通 / 史诗 的 词条 就是空表）；
  //   这里对每条词条再按 player.mjs 的上限裁一次 —— 装备强化（+2%/级）会把词条放大，不能顶破上限。
  const 倍 = 1 + 0.02 * Math.max(0, Math.floor(Number(升级等级) || 0));
  const f = (v) => Math.round(n(v, 0) * 倍 * 100) / 100;
  const 词 = {};
  const 源 = (e && e.词条 && typeof e.词条 === "object") ? e.词条 : {};
  for (const k of Object.keys(源)) 词[k] = 裁剪词条(k, f(源[k]));
  return {
    攻击: f(e && e.攻击), 防御: f(e && e.防御), 血量: f(e && e.血量),
    闪避: f(e && e.闪避), 暴击率: f(e && e.暴击率), 暴伤: f(e && (e.暴击伤害 !== undefined ? e.暴击伤害 : e.暴伤)),
    词条: 词
  };
}


/* 3.0.0（需求 4.8）：品质显示 —— 装备定义里的 品质 ∈ 普通 / 史诗 / 传说；
 * 老定义没有 品质 字段（初级小刀 / 初级小甲 等基础装）一律按「普通」算。 */
export function 装备品质(e) {
  if (!e) return "";
  const 品 = S(e.品质);
  return 品 === "史诗" || 品 === "传说" ? 品 : "普通";
}


export function 品质标签(e) { return e ? 显示品质(装备品质(e)) : ""; }


/* ---------- 2.2.3 金币 / 装备升级 / 升级转移 ---------- */
// 2.5.50：**装备升级费用大幅下调**
//   问题：旧公式 单次 = 45 × 段位 × (等级+1) 是**线性翻倍式**增长，
//        段位 460 从 Lv.1 升到 Lv.100 累计要 45 × 460 × 5050 ≈ **1.05 亿金币**
//        （折星羽 26 亿），后期根本练不动，等于装备升级功能废掉。
//   改法：系数 45 → 6（金币）、100 → 12（星羽），并且把「(等级+1)」的线性增长
//        改成 **(等级+1)^0.5**（平方根）—— 单次费用仍然越升越贵，但不会爆掉。
//   效果（段位 460，Lv.1 → Lv.100）：
//        金币 1.05 亿 → 约 **187 万**（降 98%）；星羽 2.3 亿 → 约 374 万
//   · 单次 = 系数 × 段位 × (当前等级+1)^增速指数   ← 想再调只改这三个数
//   · 累计 / 折算等级 / 转移降价 全部走 单次升级费用()，所以只改这一处就全局一致
export const 升级系数 = { 金币: 6, 星羽: 12 };


export const 升级增速指数 = 0.5;


export function 升级记录表(ctx) { const v = dget(ctx, P.装备升级, "记录", {}); return v && typeof v === "object" ? v : {}; }


export function 存升级记录表(ctx, o) { dset(ctx, P.装备升级, "记录", o); }


export function 我的升级(ctx, u) { const v = 升级记录表(ctx)[u]; return v && typeof v === "object" ? v : {}; }


/* ---------- 2.5.5 装备「每件自带等级」 ----------
 * 旧版：升级等级按【装备名】全局存在 装备升级.json，导致
 *   ① 新掉的同名装备直接继承旧强化等级（新装备等级不是 1）；
 *   ② 同名不同等级的装备被堆成一条，无法区分谁是谁。
 * 现在：等级跟着「每一件」走。
 *   · 背包条目带 强化 字段（0 起，= 已升级次数），合并键 = 名 + 强化
 *   · 装备槽存 { 名, 强化 }（旧字符串存档自动迁移）
 *   · 展示等级 = 强化 + 1（所以新装备显示 Lv.1）
 *   · 加点点数仍按【装备名】记（总点 = 该名字所有件的 强化 之和），无需迁移点数
 */
export const 已迁移装备 = new Set();


export function 件强化(it) { return Math.max(0, Math.floor(n(it && it.强化, 0))); }


export function 等级显示(L) { return Math.max(1, Math.floor(Number(L) || 0) + 1); }


export function 槽项(槽, 类) {
  const v = 槽 ? 槽[类] : null;
  if (!v) return null;
  // 2.9.1（F1 修复）兼容读取：老存档可能是「装备名字符串」，也可能是对象但字段名不同
  //   （名/装备/名字 任一；强化/升级/等级 任一），全部归一成 { 名, 强化 }。
  // 3.0.0（需求 4.8）：名字再过一遍 规范装备名()，2.x 的 `专属·X刃` / `BOSS·X·刃` / `传说·X·刃`
  //   在读取时就能落到新品质体系（幂等，新名原样返回）—— 老档即使没跑迁移也不会「装备位变空」。
  if (typeof v === "string") { const nm = S(v); return nm ? { 名: 规范装备名(nm), 强化: 0 } : null; }
  if (typeof v !== "object") return null;
  const nm = S(v.名 || v.装备 || v.名字);
  if (!nm) return null;
  let 强 = 件强化(v);
  if (v.强化 === undefined && v.升级 !== undefined) 强 = Math.max(0, Math.floor(n(v.升级, 0)));
  if (v.强化 === undefined && v.等级 !== undefined) 强 = Math.max(0, Math.floor(n(v.等级, 1)) - 1);
  return { 名: 规范装备名(nm), 强化: 强 };
}


export function 槽名(槽, 类) { const it = 槽项(槽, 类); return it ? it.名 : ""; }


export function 槽强化(槽, 类) { const it = 槽项(槽, 类); return it ? it.强化 : 0; }


// 某名字的所有「件」（装备槽 + 背包），返回强化等级数组
export function 强化列表(ctx, u, 名) {
  const nm = S(名);
  const out = [];
  if (!nm) return out;
  const 槽 = 装备槽(ctx, u);
  for (const 类 of ["武器", "护甲"]) { const it = 槽项(槽, 类); if (it && it.名 === nm) out.push(it.强化); }
  for (const it of 我的背包(ctx, u)) {
    if (S(it.名) !== nm) continue;
    const c = Math.max(1, n(it.数量, 1));
    for (let i = 0; i < c; i++) out.push(件强化(it));
  }
  return out;
}


export function 最高强化(ctx, u, 名) { const l = 强化列表(ctx, u, 名); return l.length ? Math.max.apply(null, l) : 0; }


export function 最低强化(ctx, u, 名) { const l = 强化列表(ctx, u, 名); return l.length ? Math.min.apply(null, l) : 0; }


export function 升级总点(ctx, u, 名) { return 强化列表(ctx, u, 名).reduce((a, b) => a + b, 0); }


// 升级 / 加点面板针对的那一件：已装备的优先，否则背包里强化最高的那件
export function 目标件强化(ctx, u, e) {
  if (!e) return 0;
  const it = 槽项(装备槽(ctx, u), e.类);
  if (it && it.名 === e.名) return it.强化;
  return 最高强化(ctx, u, e.名);
}


// 背包规范化：装备按「名 + 强化」合并（不同等级不合并），其余按名字合并
// 3.0.0：名字先过 规范装备名()（旧 `专属·/BOSS·/传说·` 前缀 → 品质体系），避免同档装备被拆成两行
export function 规范化背包(list) {
  const out = [];
  const 位 = {};
  for (const it of list) {
    const nm = 规范装备名(S(it.名));
    const c = Math.max(0, Math.floor(n(it.数量, 1)));
    if (!nm || c <= 0) continue;
    const e = 装备定义(nm);
    const key = e ? nm + "|" + 件强化(it) : nm;
    if (位[key] === undefined) {
      位[key] = out.length;
      const 新项 = { 名: nm, 类: e ? e.类 : (S(it.类) || "其他"), 数量: c };
      if (e) 新项.强化 = 件强化(it);
      out.push(新项);
    } else out[位[key]].数量 += c;
  }
  return out;
}


// 把「某名字 + 某强化等级」的一件改成新等级（自动与同名同等级的件合并）
export function 改件强化(ctx, u, 名, 旧, 新) {
  const nm = S(名);
  const 旧L = Math.max(0, Math.floor(n(旧, 0)));
  const 新L = Math.max(0, Math.floor(n(新, 0)));
  const list = 我的背包(ctx, u);
  const i = list.findIndex((x) => S(x.名) === nm && 件强化(x) === 旧L);
  if (i < 0) return false;
  const 量 = Math.max(1, n(list[i].数量, 1));
  if (量 > 1) {
    list[i].数量 = 量 - 1;
    list.push({ 名: nm, 类: 装备定义(nm) ? 装备定义(nm).类 : S(list[i].类), 数量: 1, 强化: 新L });
  } else list[i].强化 = 新L;
  存我背包(ctx, u, 规范化背包(list));
  return true;
}


// 老存档迁移：把「按名字全局的强化等级」分给该名字的每一件，然后清空旧记录
export function 迁移装备等级(ctx, u) {
  if (!u) return;
  // 3.0.0（需求 4.8）：先做一次「旧装备名 → 品质体系」的名字迁移（幂等），再走强化等级迁移
  if (!已迁移装备.has(u)) { try { 迁移玩家装备名(ctx, u); } catch (e) { /* 名字迁移失败不能挡住属性计算 */ } }
  if (已迁移装备.has(u)) return;
  已迁移装备.add(u);
  const 旧 = 我的升级(ctx, u);
  const 背包原文 = 我的背包(ctx, u);
  const 槽 = 装备槽(ctx, u);
  const 取旧 = (nm) => Math.max(0, Math.floor(n(旧[nm], 0)));
  let 改了 = false;
  for (const it of 背包原文) {
    const nm = S(it.名);
    if (!nm || !装备定义(nm) || it.强化 !== undefined) continue;
    it.强化 = 取旧(nm);
    改了 = true;
  }
  for (const 类 of ["武器", "护甲"]) {
    const v = 槽[类];
    if (!v) continue;
    if (typeof v === "string") {
      const nm = S(v);
      if (!装备定义(nm)) continue;
      槽[类] = { 名: nm, 强化: 取旧(nm) };
      改了 = true;
    } else if (typeof v === "object" && v.名 && v.强化 === undefined) {
      v.强化 = 取旧(S(v.名));
      改了 = true;
    }
  }
  if (改了) { 存我背包(ctx, u, 规范化背包(背包原文)); 存装备槽(ctx, u, 槽); }
  if (旧 && Object.keys(旧).length) {
    const all = 升级记录表(ctx);
    if (all[u]) { delete all[u]; 存升级记录表(ctx, all); }
  }
}


// 兼容旧调用：取该名字的最高强化等级
export function 取升级等级(ctx, u, 名) { return 最高强化(ctx, u, S(名)); }


/* ---------- 2.9.1（F1 修复）装备槽存档一次性修复迁移（全服，幂等） ----------
 * 症状：老玩家（如编号 520）背包里有装备，装备位却显示 武器[空] 护甲[空]，装备加成对不上。
 * 根因：历史上「按名全局升级 → 每件自带等级」「属性字段合并」等迁移都只在玩家触发 attrs()
 *   时才**懒迁移**自己的装备槽；中途丢档 / 换目录拷贝 / 懒迁移没跑到的玩家，装备槽.json 里
 *   会残留旧结构（字符串槽值、缺 强化 字段、垃圾条目），槽项() 解析不出 → 装备位永远空。
 * 修法：plugin_init 全服跑一次，把所有玩家的槽值统一升级成 { 名, 强化 }，无效条目清掉；
 *   用 P.装备槽迁移标记 记版本号，重复启动不会重跑。数值只在**结构**上归一，不改任何数值。
 */
export const 装备槽迁移版本 = "2.9.1";


export function 规范化槽值(v, 取旧) {
  if (typeof v === "string") { const nm = S(v); return nm ? { 名: nm, 强化: 取旧(nm) } : null; }
  if (!v || typeof v !== "object") return null;
  const nm = S(v.名 || v.装备 || v.名字);
  if (!nm) return null;
  if (v.强化 === undefined) {
    // 2.9.1：老对象槽值缺「强化」→ 优先 升级/等级 旧字段，都没有则回落到「按名全局升级记录」
    if (v.升级 !== undefined) return { 名: nm, 强化: Math.max(0, Math.floor(n(v.升级, 0))) };
    if (v.等级 !== undefined) return { 名: nm, 强化: Math.max(0, Math.floor(n(v.等级, 1)) - 1) };
    return { 名: nm, 强化: 取旧(nm) };
  }
  return { 名: nm, 强化: 件强化(v) };
}


export function 迁移装备槽存档(ctx) {
  // 3.0.0（需求 4.8）：先把 2.x 的旧装备名迁到品质体系，再做槽结构修复（顺序无关，但一次跑完更省事）
  try { 迁移装备品质(ctx); } catch (e) { /* 名字迁移失败不能挡住装备槽修复 */ }
  if (ds(ctx, P.装备槽迁移标记, "版本", "") === 装备槽迁移版本) return { 跳过: true, 人数: 0 };
  const all = dall(ctx, P.装备槽);
  const 旧升级 = 升级记录表(ctx);
  let 人数 = 0;
  for (const u of Object.keys(all)) {
    const 槽 = all[u];
    const 取旧 = (nm) => { const r = 旧升级[u]; return r && typeof r === "object" ? Math.max(0, Math.floor(n(r[nm], 0))) : 0; };
    if (!槽 || typeof 槽 !== "object" || Array.isArray(槽)) { dset(ctx, P.装备槽, u, {}); 人数 += 1; continue; }
    let 改 = false;
    for (const 类 of ["武器", "护甲"]) {
      if (槽[类] === undefined) continue;
      const 新 = 规范化槽值(槽[类], 取旧);
      if (JSON.stringify(新) !== JSON.stringify(槽[类])) {
        if (新) 槽[类] = 新; else delete 槽[类];
        改 = true;
      }
    }
    if (改) { dset(ctx, P.装备槽, u, 槽); 人数 += 1; }
  }
  dset(ctx, P.装备槽迁移标记, "版本", 装备槽迁移版本);
  if (人数 && ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 装备槽存档修复迁移完成：" + 人数 + " 人");
  return { 跳过: false, 人数: 人数 };
}


/* ---------- 3.0.0（需求 4.8）旧装备名 → 品质体系迁移（一次性，幂等） ----------
 * 2.x 的装备名：`专属·X刃` / `专属·X甲`（副本）、`BOSS·X·刃` / `BOSS·X·甲`（BOSS 普通档）、
 *   `传说·X·刃` / `传说·X·甲`（BOSS 传说档）。
 * 3.0.0 统一成 `普通/史诗/传说·X·锋|铠`（副本）与 `…·刃|甲`（BOSS），见 dungeon.mjs 装备名()。
 * 迁移范围：星甲背包条目名、装备槽 名、旧「按名全局升级」记录键；映射函数 规范装备名() 是幂等的
 *   （新名字原样返回），所以重复执行不会二次改名，也不会把装备改成不存在的名字（装备不会消失）。
 * 版本记在 系统/装备品质迁移.json（不占用 P 常量表，避免改 core/util.mjs）。
 */
export const 装备品质迁移版本 = "3.0.0";


export const 装备品质迁移文件 = "系统/装备品质迁移.json";


export function 迁移玩家装备名(ctx, u) {
  if (!u) return false;
  let 改 = false;
  // ① 星甲背包
  const 背包原文 = 我的背包(ctx, u);
  let 包改 = false;
  for (const it of 背包原文) {
    const 旧 = S(it.名);
    const 新 = 规范装备名(旧);
    if (新 && 新 !== 旧) { it.名 = 新; 包改 = true; }
  }
  if (包改) { 存我背包(ctx, u, 规范化背包(背包原文)); 改 = true; }
  // ② 装备槽（槽项() 已经做了名字映射，这里把存档也真的改写掉）
  const 槽 = 装备槽(ctx, u);
  let 槽改 = false;
  for (const 类 of ["武器", "护甲"]) {
    const 原 = 槽[类];
    if (!原) continue;
    const 旧名 = typeof 原 === "string" ? S(原) : S(原.名 || 原.装备 || 原.名字);
    const it = 槽项(槽, 类);
    if (!it || !旧名 || it.名 === 旧名) continue;
    槽[类] = { 名: it.名, 强化: it.强化 };
    槽改 = true;
  }
  if (槽改) { 存装备槽(ctx, u, 槽); 改 = true; }
  // ③ 旧「按名全局升级」记录（2.5.5 之前的结构）：键同步改名，历史点数不丢
  const 升级表 = 升级记录表(ctx);
  const 我 = 升级表[u];
  if (我 && typeof 我 === "object") {
    let 键改 = false;
    const 新表 = {};
    for (const k of Object.keys(我)) { const nk = 规范装备名(k); if (nk !== k) 键改 = true; 新表[nk] = 我[k]; }
    if (键改) { 升级表[u] = 新表; 存升级记录表(ctx, 升级表); 改 = true; }
  }
  return 改;
}


// 全服一次性迁移（plugin_init → 迁移装备槽存档 → 本函数），版本号命中就跳过（幂等）
export function 迁移装备品质(ctx) {
  if (ds(ctx, 装备品质迁移文件, "版本", "") === 装备品质迁移版本) return { 跳过: true, 人数: 0 };
  const 人 = new Set();
  for (const u of Object.keys(背包表(ctx))) 人.add(u);
  const 槽表 = dall(ctx, P.装备槽);
  for (const u of Object.keys(槽表 && typeof 槽表 === "object" ? 槽表 : {})) 人.add(u);
  let 人数 = 0;
  for (const u of 人) { if (迁移玩家装备名(ctx, u)) 人数 += 1; }
  dset(ctx, 装备品质迁移文件, "版本", 装备品质迁移版本);
  if (人数 && ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 装备品质名迁移完成：" + 人数 + " 人");
  return { 跳过: false, 人数: 人数 };
}


/* ---------- 3.0.0（需求 1/2）：装备升级改版 ----------
 * · 满级 9999 级（原来是无限 / 9999 兜底）；
 * · 每级消耗 星羽 / 金币 / 花 / 星石：
 *     星羽 37·L·段比 ｜ 金币 30·L·段比 ｜ 花 17.6·L·段比 ｜ 星石 = 当前等级+2（1 级 2 个、50 级 51 个、100 级 101 个）
 *   其中 L = 当前等级+1（升到第 L 级），段比 = min(1, 段/2000)。
 * · 这样「段 2000 的顶级装备升到 9999」累计 ≈ 18.5 亿星羽 / 15 亿金币 / 8.8 亿花 / 约 5000 万星石，
 *   与需求给的数字对齐（见 t-upgrade9999 断言，误差 ±2%）。低段装备按段比等比便宜。
 * · 星石来源：副本每次 1 个、BOSS 每次 2 个（见 combat.mjs 结算），作用是压数值膨胀（高级升级越来越贵）。
 */
export const 装备满级 = 9999;
export const 升级段基准 = 2000;
export const 升级基础 = { 星羽: 37, 金币: 30, 花: 17.6 };

export function 段比(段) {
  const d = Math.max(1, Math.floor(Number(段) || 1));
  return Math.max(0.01, Math.min(1, d / 升级段基准));
}

// 某段位装备的「第 n 级」单次升级费用（n 从 0 开始：升到 n+1 级的花费）
export function 单次升级费用(段, 当前等级) {
  const n = Math.max(0, Math.floor(Number(当前等级) || 0));
  const 比 = 段比(段);
  const L = n + 1;
  return {
    金币: Math.round(升级基础.金币 * L * 比),
    星羽: Math.round(升级基础.星羽 * L * 比),
    花: Math.round(升级基础.花 * L * 比),
    星石: n + 2
  };
}


// 从 0 级升到 L 级的累计费用（含星石）
export function 累计升级费用(段, L) {
  let 金 = 0, 羽 = 0, 花 = 0, 石 = 0;
  const 终 = Math.min(装备满级, Math.max(0, Math.floor(L || 0)));
  for (let i = 0; i < 终; i++) { const c = 单次升级费用(段, i); 金 += c.金币; 羽 += c.星羽; 花 += c.花; 石 += c.星石; }
  return { 金币: 金, 星羽: 羽, 花: 花, 星石: 石 };
}


// 按「已投入的金币总额」反算该段位装备能升到几级（转移时自动降价用）
export function 按金币折算等级(段, 金币额) {
  let 剩 = Math.max(0, Math.floor(Number(金币额) || 0)), L = 0;
  while (L < 9999) { const c = 单次升级费用(段, L); if (c.金币 > 剩) break; 剩 -= c.金币; L += 1; }
  return L;
}


/* ---------- 2.2.5 星甲装备：查看已穿戴装备与加成 ---------- */
export async function 装备面板(ctx, t, u) {
  const p = attrs(ctx, u);
  const 槽 = 装备槽(ctx, u);
  // 2.9.1（F2 修复）：正文里不再写「## 星甲装备」——reply 的 标题 会渲染一次，
  //   原来正文和标题各渲染一次 → 页面出现两个「星甲装备」。
  // 3.4.0 UI：黑白混排 + ▍分区锚点（装备位一眼看到，操作沉底）
  const 黑 = (x) => [x, false];
  const 灰 = (x) => [x, true];
  const 行 = [黑("▍档案"), 灰("编号 " + gid(ctx, u) + " · 昵称 **" + p.昵称 + "**"), ["", true], 黑("▍当前装备")];
  const 已穿 = [];
  for (const 类 of ["武器", "护甲"]) {
    const it = 槽项(槽, 类);
    if (!it) { 行.push(灰(类 + "：🟫 空（`背包` 里点蓝色「装备」）")); continue; }
    const e = 装备定义(it.名);
    if (!e) { 行.push(灰(类 + "：" + it.名 + "（数据异常）")); continue; }
    const L = it.强化;
    已穿.push(it.名);
    const 单 = 单次升级费用(e.段, L);
    行.push(灰("**" + 类 + "**：" + 品质标签(e) + "[" + it.名 + "] lv." + e.段 + (e.专属 === undefined ? "" : (e.BOSS ? "（BOSS装）" : "（副本装）")) + " · 强化 +" + 等级显示(L)));
    行.push(灰("　加成：" + 装备描述(e, L)));
    行.push(灰("　下一级：金币 " + kfmt(单.金币) + " + 星羽 " + kfmt(单.星羽)));
  }
  行.push(["", true], 黑("▍总加成"));
  行.push(灰("攻击 **" + p.攻击 + "** · 防御 **" + p.防御 + "** · 血量上限 **" + p.血量上限 + "**"));
  行.push(灰("暴击 " + p.暴击率.toFixed(2) + "% · 暴伤 " + p.暴伤.toFixed(2) + "% · 暴击点 " + p.暴击));
  行.push(灰("闪避 " + p.闪避.toFixed(2) + "%（上限 " + 闪避上限 + "%）· 幸运星 → 暴伤"));
  行.push(["", true], 黑("▍操作"));
  行.push(灰(蓝链([
    ["星甲背包", "背包"], ["升级装备#" + (已穿[0] || "") + "#1", "升级" + (已穿[0] || "装备")],
    ["转移升级", "转移升级"], ["星甲装备", "刷新"], ["星甲属性", "属性"]
  ])));
  await reply(ctx, t, 灰混(行), {
    标题: "⚔️ 星甲装备",
    行组: [
      row(actBtn("ep1", "⚡背包", "bag|1"), actBtn("ep2", "⚡属性", "info"), btn("ep3", "转移升级", "转移升级"), btn("ep4", "升级装备", "升级装备#")),
      row(btn("ep5", "一键卖武器", "一键卖#武器"), btn("ep6", "副本", "副本"), btn("ep7", "BOSS列表", "BOSS列表"), btn("ep8", "星甲菜单", "星甲菜单"))
    ]
  });
}


export async function 升级装备(ctx, t, u, name, 次数) {
  const e = 装备定义(name);
  if (!e) { await reply(ctx, t, "只有武器 / 护甲可以升级。", { 标题: "🔨 升级失败", 按钮: [btn("up1", "背包", "背包")] }); return; }
  if (背包持有(ctx, u, e.名) < 1 && 槽名(装备槽(ctx, u), e.类) !== e.名) {
    await reply(ctx, t, "背包里没有【" + e.名 + "】。", { 标题: "🔨 升级失败", 按钮: [btn("up2", "背包", "背包")] });
    return;
  }
  // 3.0.0：满级 9999，一次最多升 100 级；到顶后提示已满级
  const 次 = Math.min(Math.max(1, Math.floor(Number(次数) || 1)), 100);
  // 2.5.5：每件自带等级 —— 升级对象 = 已装备的那件优先，否则背包里强化最高的那件
  const 槽 = 装备槽(ctx, u);
  const 槽本 = 槽项(槽, e.类);
  const 在槽 = !!(槽本 && 槽本.名 === e.名);
  const cur = 在槽 ? 槽本.强化 : 最高强化(ctx, u, e.名);
  if (cur >= 装备满级) {
    await reply(ctx, t, "【" + e.名 + "】已经满级（Lv." + 装备满级 + "），不能再升了。", { 标题: "🔨 已满级", 行组: [row(btn("up9", "加点面板", "加点#" + e.名), btn("up10", "背包", "背包"))] });
    return;
  }
  const 实次 = Math.min(次, 装备满级 - cur);
  let 需金 = 0, 需羽 = 0, 需花 = 0, 需石 = 0;
  for (let i = 0; i < 实次; i++) { const c = 单次升级费用(e.段, cur + i); 需金 += c.金币; 需羽 += c.星羽; 需花 += c.花; 需石 += c.星石; }
  const p = attrs(ctx, u);
  const 有花 = hasItem(ctx, u, "花"), 有石 = hasItem(ctx, u, "星石");
  if (p.金币 < 需金 || p.星羽 < 需羽 || 有花 < 需花 || 有石 < 需石) {
    await reply(ctx, t, [
      "材料不足，升级失败。",
      "",
      "需要：金币 " + kfmt(需金) + " + 星羽 " + kfmt(需羽) + " + 花 " + kfmt(需花) + " + 星石 " + kfmt(需石),
      "持有：金币 " + kfmt(p.金币) + " + 星羽 " + kfmt(p.星羽) + " + 花 " + kfmt(有花) + " + 星石 " + kfmt(有石),
      "星石：副本每次掉 1 个 / BOSS 每次掉 2 个（升级每级消耗 = 当前等级+2）",
      "",
      "金币来源：卖装备 / 卖材料（`一键卖#武器`）；星羽来源：副本、挖矿、打工…"
    ].join("\n"), { 标题: "🔨 升级失败", 行组: [row(btn("up3", "背包", "背包"), btn("up4", "副本", "副本"), btn("up5", "商店", "商店"))] });
    return;
  }
  dset(ctx, P.金币, u, p.金币 - 需金);
  addCoin(ctx, u, -需羽);
  if (需花 > 0) takeItem(ctx, u, "花", 需花);
  if (需石 > 0) takeItem(ctx, u, "星石", 需石);
  const 新级 = cur + 实次;
  // 2.5.5：等级写在「这一件」上；已装备的立刻重算属性
  if (在槽) {
    应用装备(ctx, u, e, -1, cur);
    应用装备(ctx, u, e, 1, 新级);
    槽[e.类] = { 名: e.名, 强化: 新级 };
    存装备槽(ctx, u, 槽);
  } else 改件强化(ctx, u, e.名, cur, 新级);
  const 加 = 装备加成(e, 新级);
  await reply(ctx, t, [
    "## 🔨 升级成功",
    "",
    "【" + e.名 + "】Lv." + 等级显示(cur) + " → **Lv." + 等级显示(新级) + "**（" + 装备定义(e.名).类 + " · lv." + e.段 + "）",
    "升级对象：" + (在槽 ? "已装备的那件" : "背包里强化最高的那件"),
    "",
    "花费：金币 " + kfmt(需金) + " + 星羽 " + kfmt(需羽) + " + 花 " + kfmt(需花) + " + 星石 " + kfmt(需石),
    "新属性：" + 装备描述(e, 新级),
    "**获得 " + 实次 + " 个升级点** —— 用 " + 蓝字("星甲加点#" + e.名, "【加点面板】") + " 加到指定属性",
    (新级 >= 装备满级 ? "已达满级 Lv." + 装备满级 : "下一级需：" + kfmt(单次升级费用(e.段, 新级).金币) + " 金币 + " + kfmt(单次升级费用(e.段, 新级).星羽) + " 星羽 + " + kfmt(单次升级费用(e.段, 新级).花) + " 花 + " + 单次升级费用(e.段, 新级).星石 + " 星石")
  ].join("\n"), {
    标题: "🔨 升级装备",
    行组: [row(actBtn("up6", "⚡再升1级", "upeq|" + e.名 + "|1"), btn("up7", "加点面板", "加点#" + e.名), actBtn("up8", "⚡背包", "bag|1"))]
  });
  // 2.5.4：升级完成 → 直接跟一张加点面板（升级得点、点数加属性），省得玩家再点一次
  await 加点面板(ctx, t, u, e.名);
}


// 转移升级：把源装备的升级等级按「费用折算」搬到目标装备（250 金币 + 2500 星羽）
export const 转移费用 = { 金币: 250, 星羽: 2500 };


export async function 转移升级(ctx, t, u, 源名, 目标名) {
  const a = 装备定义(源名), b = 装备定义(目标名);
  if (!a || !b) { await reply(ctx, t, "用法：`转移升级#源装备#目标装备`（都必须是武器 / 护甲）", { 标题: "🔁 转移失败", 按钮: [btn("tr1", "背包", "背包")] }); return; }
  if (a.名 === b.名) { await reply(ctx, t, "源装备和目标装备不能是同一件。", { 标题: "🔁 转移失败" }); return; }
  const 槽 = 装备槽(ctx, u);
  const 源槽 = 槽项(槽, a.类);
  const 源在槽 = !!(源槽 && 源槽.名 === a.名);
  const 目槽 = 槽项(槽, b.类);
  const 目在槽 = !!(目槽 && 目槽.名 === b.名);
  const 持有源 = 背包持有(ctx, u, a.名) > 0 || 源在槽;
  const 持有目 = 背包持有(ctx, u, b.名) > 0 || 目在槽;
  if (!持有源 || !持有目) { await reply(ctx, t, "背包里没有" + (!持有源 ? "【" + a.名 + "】" : "") + (!持有目 ? "【" + b.名 + "】" : "") + "。", { 标题: "🔁 转移失败", 按钮: [btn("tr2", "背包", "背包")] }); return; }
  // 2.5.5：每件自带等级 —— 源取「强化最高」的那件（真正投入过的那件）
  const 源级 = 源在槽 ? 源槽.强化 : 最高强化(ctx, u, a.名);
  if (源级 <= 0) { await reply(ctx, t, "【" + a.名 + "】还没有升级过，没有可转移的属性。", { 标题: "🔁 转移失败" }); return; }
  const 目当前 = 目在槽 ? 目槽.强化 : 最高强化(ctx, u, b.名);
  const p = attrs(ctx, u);
  if (p.金币 < 转移费用.金币 || p.星羽 < 转移费用.星羽) {
    await reply(ctx, t, "转移需要 金币 " + 转移费用.金币 + " + 星羽 " + kfmt(转移费用.星羽) + "。\n持有：金币 " + kfmt(p.金币) + " + 星羽 " + kfmt(p.星羽), { 标题: "🔁 转移失败" });
    return;
  }
  // 按源装备已投入的金币总额，折算到目标装备段位的等级（自动降价、属性同步减少）
  const 投入 = 累计升级费用(a.段, 源级);
  const 目标级 = Math.max(0, 按金币折算等级(b.段, 投入.金币));
  dset(ctx, P.金币, u, p.金币 - 转移费用.金币);
  addCoin(ctx, u, -转移费用.星羽);
  // 源清零（等级写在那一件上）
  if (源在槽) { 应用装备(ctx, u, a, -1, 源级); 槽[a.类] = { 名: a.名, 强化: 0 }; }
  else 改件强化(ctx, u, a.名, 源级, 0);
  // 目标置为折算后的等级
  if (目在槽) { 应用装备(ctx, u, b, -1, 目当前); 应用装备(ctx, u, b, 1, 目标级); 槽[b.类] = { 名: b.名, 强化: 目标级 }; }
  else 改件强化(ctx, u, b.名, 目当前, 目标级);
  存装备槽(ctx, u, 槽);
  const 新 = 装备定义(b.名);
  await reply(ctx, t, [
    "## 🔁 转移完成",
    "",
    "源：【" + a.名 + "】Lv." + 等级显示(源级) + "（lv." + a.段 + "）→ 清零",
    "目标：【" + b.名 + "】→ **Lv." + 等级显示(目标级) + "**（lv." + b.段 + "）",
    "",
    "源累计投入：金币 " + kfmt(投入.金币) + " + 星羽 " + kfmt(投入.星羽),
    "按目标段位折算后自动降价为 Lv." + 等级显示(目标级) + "（等级越高越贵，属性同步下调）",
    "手续费：金币 " + 转移费用.金币 + " + 星羽 " + kfmt(转移费用.星羽),
    "",
    "目标新属性：" + 装备描述(新, 目标级)
  ].join("\n"), {
    标题: "🔁 转移升级",
    行组: [row(actBtn("tr3", "⚡看背包", "bag|1"), actBtn("tr4", "⚡属性", "info"))]
  });
}


export function 应用装备(ctx, u, e, 方向, 升级等级) {
  if (!e) return;
  迁移属性字段(ctx, u);   // 2.8.0：换装备会直接改 血量上限 / 攻击，先确保旧字段已迁移
  const 加 = 装备加成(e, 升级等级);
  const s = 方向 < 0 ? -1 : 1;
  dset(ctx, P.攻击, u, Math.max(0, dn(ctx, P.攻击, u, 200) + s * 加.攻击));
  dset(ctx, P.防御, u, Math.max(0, dn(ctx, P.防御, u, 100) + s * 加.防御));
  dset(ctx, P.暴击率, u, Math.max(0, dn(ctx, P.暴击率, u, 5) + s * 加.暴击率));
  dset(ctx, P.暴伤, u, Math.max(0, dn(ctx, P.暴伤, u, 150) + s * 加.暴伤));
  dset(ctx, P.闪避, u, Math.max(0, dn(ctx, P.闪避, u, 0) + s * 加.闪避));
  const 上限 = Math.max(1, dn(ctx, P.血量上限, u, 500) + s * 加.血量);
  dset(ctx, P.血量上限, u, 上限);
  dset(ctx, P.血量, u, Math.max(0, Math.min(dn(ctx, P.血量, u, 上限), 上限)));
  recPwr(ctx, u);
}


export function 装备槽(ctx, u) { const v = dget(ctx, P.装备槽, u, null); return v && typeof v === "object" ? v : {}; }


export function 存装备槽(ctx, u, o) { dset(ctx, P.装备槽, u, o); }


/* ---------- 2.7.0（需求 6）一键穿最强 ----------
 * 背包一多，玩家很难判断哪件更强（段位 / 强化 / 词条都影响）。
 * 按「装备评分」把武器与护甲各换成背包里分最高的一件；已装备的参与比较但不移动。
 */
export function 装备评分(e, lv) {
  if (!e) return -1;
  const a = 装备加成(e, lv);
  return (Number(a.攻击) || 0) * 1.5 + (Number(a.防御) || 0) * 1.2 + (Number(a.血量) || 0) * 1
    + (Number(a.暴击率) || 0) * 20 + (Number(a.暴伤) || 0) * 2 + (Number(a.闪避) || 0) * 8;
}


export async function 一键穿最强(ctx, t, u) {
  const 槽 = 装备槽(ctx, u);
  const 列表 = 背包列表(ctx, u);
  const 换 = [];
  for (const 类 of ["武器", "护甲"]) {
    const 当前 = 槽项(槽, 类);
    const 当前分 = 当前 ? 装备评分(装备定义(当前.名), 当前.强化) : -1;
    let 最佳 = null, 最佳分 = 当前分;
    for (const it of 列表) {
      if (it.装备中 || it.类 !== 类) continue;
      const e = 装备定义(it.名);
      if (!e) continue;
      const s = 装备评分(e, it.强化);
      if (s > 最佳分) { 最佳分 = s; 最佳 = it; }
    }
    if (最佳) {
      槽[类] = { 名: 最佳.名, 强化: 最佳.强化 };
      换.push(类 + " → **" + 最佳.名 + "**（Lv." + 等级显示(最佳.强化) + "）");
    }
  }
  if (!换.length) {
    await reply(ctx, t, "已经是当前背包里最强的配置了。\n想要更强就去 " + 蓝字("星甲副本", "打副本") + " 掉装备，或用 " + 蓝字("星甲升级装备", "升级装备") + " 提升。", { 标题: "🛡️ 一键穿最强", 按钮: [btn("eq1", "装备", "装备"), btn("eq2", "背包", "背包")] });
    return;
  }
  存装备槽(ctx, u, 槽);
  recPwr(ctx, u);
  const p = attrs(ctx, u);
  await reply(ctx, t, [
    "**已换上当前最强装备**",
    "",
    ...换.map((x) => "✅ " + x),
    "",
    "当前战力：**" + kfmt(pwrOf(ctx, u)) + "**　攻击 " + kfmt(p.攻击) + " · 防御 " + kfmt(p.防御) + " · 血量 " + kfmt(p.血量上限)
  ].join("\n"), { 标题: "🛡️ 一键穿最强", 按钮: [row(btn("eq3", "装备面板", "装备"), btn("eq4", "升级装备", "升级装备"), btn("eq5", "副本", "副本"))] });
}


export async function 穿装备(ctx, t, u, name) {
  const e = 装备定义(name);
  if (!e) return false;
  // 2.5.13：先把「道具系统」里的同件装备搬回星甲背包，避免面板显示有、装备却报「背包里没有」
  同步装备存储(ctx, u, e.名);
  if (背包持有(ctx, u, e.名) < 1) {
    await reply(ctx, t, "背包里没有【" + e.名 + "】。\n副本掉落装备后可以在 `背包` 里装备。", {
      标题: "装备失败", 按钮: [btn("eq1", "背包", "背包"), btn("eq2", "副本", "副本")]
    });
    return true;
  }
  const 槽 = 装备槽(ctx, u);
  const 旧项 = 槽项(槽, e.类);
  const 旧 = 旧项 ? 旧项.名 : "";
  if (旧 === e.名) {
    await reply(ctx, t, "【" + e.名 + "】已经装备在" + e.类 + "位上了。", { 标题: "无需重复装备", 按钮: [btn("eq3", "背包", "背包")] });
    return true;
  }
  // 2.5.5：装备「背包里强化最高的那件」，这件自带的等级一起装上
  const 新级 = 最高强化(ctx, u, e.名);
  if (!出背包(ctx, u, e.名, 1, 新级)) {
    await reply(ctx, t, "背包数量不足。", { 标题: "装备失败" });
    return true;
  }
  if (旧项 && 装备定义(旧项.名)) { 应用装备(ctx, u, 装备定义(旧项.名), -1, 旧项.强化); 入背包(ctx, u, 旧项.名, 1, 旧项.强化); }
  应用装备(ctx, u, e, 1, 新级);
  槽[e.类] = { 名: e.名, 强化: 新级 };
  存装备槽(ctx, u, 槽);
  tInc(ctx, u, "打装备");
  await reply(ctx, t, [
    "已装备【" + e.名 + "】（" + e.类 + " · lv." + e.段 + " · 等级 Lv." + 等级显示(新级) + "）",
    "Lv." + 等级显示(新级) + " · " + 装备描述(e, 新级),
    "",
    旧项 ? "换下的【" + 旧项.名 + "】Lv." + 等级显示(旧项.强化) + " 已放回背包。" : "",
    "当前：攻击 " + dn(ctx, P.攻击, u, 0) + " · 防御 " + dn(ctx, P.防御, u, 0) +
      " · 暴击率 " + dn(ctx, P.暴击率, u, 0).toFixed(2) + "% · 暴伤 " + dn(ctx, P.暴伤, u, 0).toFixed(2) + "%"
  ].filter(Boolean).join("\n"), {
    标题: "⚔️ 装备成功",
    行组: [row(btn("eq4", "背包", "背包"), actBtn("eq5", "⚡看属性", "info"), btn("eq6", "副本", "副本"), btn("eq7", "菜单", "菜单"))]
  });
  return true;
}


/* ---------- 2.2.3 快速卖：按类别或指定数量批量出售 ---------- */
export async function 快速卖(ctx, t, u, 类别, 数量) {
  const 类 = S(类别);
  // 2.9.6（需求 11）：商店回收物品由「世界资金」付账，见底时暂停回收
  if (资金见底(ctx)) {
    await reply(ctx, t, [
      "❌ 商店暂时不回收物品 —— 世界资金已见底。",
      "",
      补货提示(ctx)
    ].join("\n"), { 标题: "🛒 无法回收", 行组: [row(btn("qs0", "官方群", "官方群"), btn("qs01", "世界资金", "世界资金"), btn("qs02", "背包", "背包"))] });
    return;
  }
  const 我的 = 背包列表(ctx, u);
  const 装备类 = 我的.filter((x) => x.类 === "武器" || x.类 === "护甲");
  const 材料类 = 我的.filter((x) => x.类 === "材料" || x.类 === "药");
  // 2.5.3：历史残留物品（名字已不在装备 / 道具表里）单独归一类，可一键卖掉
  const 残留类 = 我的.filter((x) => !装备定义(x.名) && allItems().indexOf(x.名) < 0 && !x.装备中);
  let 目标 = [];
  if (类 === "武器" || 类 === "护甲") 目标 = 我的.filter((x) => x.类 === 类);
  else if (类 === "装备") 目标 = 装备类;
  else if (类 === "材料") 目标 = 材料类;
  else if (类 === "鱼") 目标 = 我的.filter((x) => x.类 === "材料" && /鱼|鱼饵/.test(x.名));
  else if (类 === "菜") 目标 = 我的.filter((x) => x.类 === "菜");
  else if (类 === "其他" || 类 === "残留" || 类 === "遗留") 目标 = 残留类;
  else if (类 === "全部") 目标 = 材料类.concat(装备类.filter((x) => !x.装备中), 残留类);
  else {
    // 指定物品名：按数量卖
    const k = Math.max(1, Math.floor(Number(数量) || 1));
    const 有 = 我的.filter((x) => x.名 === 类);
    if (!有.length) { await reply(ctx, t, "背包里没有【" + 类 + "】。", { 标题: "💰 快速卖", 按钮: [btn("qs1", "背包", "背包")] }); return; }
    const 件 = 有[0];
    const 真量 = Math.min(k, 件.数量);
    if (装备定义(件.名)) 同步装备存储(ctx, u, 件.名);
    await 卖物品(ctx, t, u, 件.名, 真量);
    return;
  }
  const 可卖 = 目标.filter((x) => !x.装备中);
  if (!可卖.length) {
    await reply(ctx, t, "没有可出售的" + 类 + "（装备中的要先去 `背包` 脱下）。", { 标题: "💰 快速卖", 按钮: [btn("qs2", "背包", "背包")] });
    return;
  }
  let 金币 = 0, 星羽 = 0, 返还金 = 0, 返还羽 = 0, 件数 = 0;
  const 明细 = [];
  for (const x of 可卖) {
    const e = 装备定义(x.名);
    if (e) {
      // 2.5.5：每件自带等级，按这件自己的等级折算返还
      const 价 = Math.max(50, e.段 * 120) * x.数量;
      const L = Math.max(0, Math.floor(n(x.升级, 0)));
      const 投入 = 累计升级费用(e.段, L);
      金币 += 价;
      返还金 += Math.floor(投入.金币 * 0.8) * x.数量;
      返还羽 += Math.floor(投入.星羽 * 0.8) * x.数量;
      明细.push("【" + x.名 + "】Lv." + 等级显示(L) + " ×" + x.数量 + " → 金币 " + kfmt(价) + (L > 0 ? "（返还升级费 80%）" : ""));
    } else {
      // 2.5.3：残留物品直接从背包移除并按单价折星羽（原来走 takeItem，会写进道具表导致卖不掉 / 越卖越多）
      if (allItems().indexOf(x.名) < 0) {
        const 单价 = 40;
        星羽 += 单价 * x.数量;
        出背包(ctx, u, x.名, x.数量);
        明细.push("【" + x.名 + "】×" + x.数量 + " → 星羽 " + kfmt(单价 * x.数量) + "（残留）");
      } else {
        const 价 = Math.max(10, Math.floor(itemPrice(x.名) * 0.8) || 30);   // 3.1.0：商店回收只返还 80% 成本
        const 真价 = 是菜品(x.名) ? Math.max(10, Math.floor(菜价[x.名] * 0.8)) : 价;
        // 2.2.9：菜品卖成金币，其余材料卖成星羽
        if (是菜品(x.名)) 返还金 += 真价 * x.数量; else 星羽 += 真价 * x.数量;
        takeItem(ctx, u, x.名, x.数量);
        明细.push("【" + x.名 + "】×" + x.数量 + " → " + (是菜品(x.名) ? "金币 " : "星羽 ") + kfmt(真价 * x.数量));
      }
    }
    件数 += x.数量;
    if (e) 出背包(ctx, u, x.名, x.数量, Math.max(0, Math.floor(n(x.升级, 0))));
  }
  dset(ctx, P.金币, u, dn(ctx, P.金币, u, 0) + 金币 + 返还金);
  if (星羽 + 返还羽 > 0) addCoin(ctx, u, 星羽 + 返还羽);
  // 2.9.10（收支核对）：物品已出包、必须付清 —— 世界资金不足时照付并把差额记入系统日志（同赌场照赔语义）
  if (!扣世界资金(ctx, 金币 + 返还金 + 星羽 + 返还羽, "商店批量回收物品")) {
    pushLog(ctx, "世界资金", "商店批量回收 " + gid(ctx, u) + " 时世界资金不足（已照付 " + kfmt(金币 + 返还金 + 星羽 + 返还羽) + "，余额已被清至 0）");
  }
  加经验(ctx, u, Math.max(20, Math.floor((金币 + 星羽) / 10)));
  await reply(ctx, t, [
    "## 💰 快速卖出完成",
    "",
    "共卖出 **" + 件数 + "** 件 · 涉及 " + 可卖.length + " 种",
    "金币 +" + kfmt(金币 + 返还金) + (返还金 ? "（含升级费返还 " + kfmt(返还金) + "）" : ""),
    "星羽 +" + kfmt(星羽 + 返还羽) + (返还羽 ? "（含升级费返还 " + kfmt(返还羽) + "）" : ""),
    "",
    "明细：",
    ...明细.slice(0, 12)
  ].join("\n"), { 标题: "💰 快速卖", 行组: [row(actBtn("qs3", "⚡背包", "bag|1"), actBtn("qs4", "⚡属性", "info")), row(btn("qs5", "一键卖武器", "一键卖#武器"), btn("qs6", "一键卖材料", "一键卖#材料"), btn("qs7", "星甲菜单", "星甲菜单"))] });
}


/* ---------- 2.5.3 清理残留：历史遗留物品（名字已不在装备 / 道具表里）一次性折价清掉 ---------- */
export async function 清理残留(ctx, t, u) {
  const 残留 = 背包列表(ctx, u).filter((x) => !x.装备中 && !装备定义(x.名) && allItems().indexOf(x.名) < 0);
  if (!残留.length) {
    await reply(ctx, t, "背包里没有历史残留物品，很干净 🧼", { 标题: "🧹 清理残留", 按钮: [menuBtn()] });
    return;
  }
  const 单价 = 40;
  let 件 = 0, 星羽 = 0;
  const 明细 = [];
  for (const x of 残留) {
    const c = Math.max(1, n(x.数量, 1));
    出背包(ctx, u, x.名, c);
    件 += c; 星羽 += 单价 * c;
    明细.push("【" + x.名 + "】×" + c + " → 星羽 " + kfmt(单价 * c));
  }
  if (星羽 > 0) {
    // 3.1.15：清理残留是系统折价回收（付钱给玩家）→ 从世界金支出（与商店回收同一口径）
    if (!扣世界资金(ctx, 星羽, "清理残留回收")) pushLog(ctx, "世界资金", "清理残留时资金不足（已照付 " + kfmt(星羽) + "）");
    addCoin(ctx, u, 星羽);
  }
  await reply(ctx, t, [
    "## 🧹 清理残留完成",
    "",
    "清除 **" + 件 + "** 件历史遗留物品 · 涉及 " + 残留.length + " 种",
    "折价返还：星羽 +" + kfmt(星羽) + "（单价 " + 单价 + "）",
    "",
    "明细：",
    ...明细.slice(0, 12)
  ].join("\n"), { 标题: "🧹 清理残留", 行组: [row(btn("clr1", "背包", "背包"), btn("clr2", "一键整理", "一键整理"), btn("clr3", "星甲菜单", "星甲菜单"))] });
}


export async function 脱装备(ctx, t, u, arg) {
  const 槽 = 装备槽(ctx, u);
  const k = S(arg);
  const 目标类 = (k === "武器" || k === "护甲") ? [k] : (装备定义(k) ? [装备定义(k).类] : ["武器", "护甲"]);
  const 脱下的 = [];
  for (const 类 of 目标类) {
    const it = 槽项(槽, 类);
    if (!it) continue;
    const e = 装备定义(it.名);
    槽[类] = "";
    if (e) 应用装备(ctx, u, e, -1, it.强化);
    入背包(ctx, u, it.名, 1, it.强化);
    脱下的.push(it.名 + " Lv." + 等级显示(it.强化) + "（" + 类 + "）");
  }
  存装备槽(ctx, u, 槽);
  if (!脱下的.length) {
    await reply(ctx, t, "你身上没有已装备的" + (目标类.length === 1 ? 目标类[0] : "装备") + "。", {
      标题: "脱下失败", 按钮: [btn("eq8", "背包", "背包")]
    });
    return;
  }
  recPwr(ctx, u);
  await reply(ctx, t, "已脱下：" + 脱下的.join(" · ") + "\n装备已放回星甲背包。", {
    标题: "🎽 脱下装备",
    行组: [row(btn("eq9", "背包", "背包"), actBtn("eq10", "⚡看属性", "info"), btn("eq11", "菜单", "菜单"))]
  });
}


export async function 卖物品(ctx, t, u, name, cnt) {
  const nm = S(name);
  const k = Math.max(1, Math.floor(Number(cnt) || 1));
  const e = 装备定义(nm);
  // 2.9.6（需求 11）：商店回收物品由「世界资金」付账，见底时暂停回收
  if (资金见底(ctx)) {
    await reply(ctx, t, [
      "❌ 商店暂时不回收物品 —— 世界资金已见底。",
      "",
      补货提示(ctx)
    ].join("\n"), { 标题: "🛒 无法回收", 行组: [row(btn("sl0", "官方群", "官方群"), btn("sl1", "世界资金", "世界资金"), btn("sl2", "背包", "背包"))] });
    return;
  }
  if (e) {
    if (槽名(装备槽(ctx, u), e.类) === nm) {
      await reply(ctx, t, "【" + nm + "】正装备着，先 `脱下" + e.类 + "` 再卖。", { 标题: "卖出失败" });
      return;
    }
    // 2.5.13：先把「道具系统」里的同件装备搬回星甲背包，避免卖不掉
    同步装备存储(ctx, u, nm);
    const 有 = 背包持有(ctx, u, nm);
    if (有 < k) { await reply(ctx, t, "背包里只有 " + 有 + " 件【" + nm + "】。", { 标题: "卖出失败" }); return; }
    // 2.2.3：装备卖的是「金币」；若曾升级过，返还 80% 的升级费用
    // 2.5.5：每件自带等级 —— 卖的是「强化最低」的那几件，按各自的投入分别返还
    const 单价 = Math.max(50, e.段 * 120);
    let 返金 = 0, 返羽 = 0, 卖了 = 0;
    const 级记 = [];
    for (let i = 0; i < k; i++) {
      const L = 最低强化(ctx, u, nm);
      if (!出背包(ctx, u, nm, 1, L)) break;
      卖了 += 1;
      级记.push(L);
      const 投入 = 累计升级费用(e.段, L);
      返金 += Math.floor(投入.金币 * 0.8);
      返羽 += Math.floor(投入.星羽 * 0.8);
    }
    const 价 = 单价 * 卖了;
    // 2.9.10（收支核对）：装备已出包、必须付清 —— 世界资金不足时照付并记系统日志
    if (!扣世界资金(ctx, 价 + 返金 + 返羽, "商店回收装备 " + nm + "×" + 卖了)) {
      pushLog(ctx, "世界资金", "商店回收装备 " + nm + "×" + 卖了 + "（" + gid(ctx, u) + "）时世界资金不足（已照付 " + kfmt(价 + 返金 + 返羽) + "，余额已被清至 0）");
    }
    dset(ctx, P.金币, u, dn(ctx, P.金币, u, 0) + 价 + 返金);
    if (返羽 > 0) addCoin(ctx, u, 返羽);
    const 卖出经验 = Math.max(20, Math.floor(价 / 10));
    加经验(ctx, u, 卖出经验);
    const 行 = ["已卖出 " + 卖了 + " 件【" + nm + "】（等级 " + 级记.map((L) => "Lv." + 等级显示(L)).join(" / ") + "）", "", "金币 +" + kfmt(价)];
    if (返金 > 0 || 返羽 > 0) 行.push("返还 80% 升级费用：金币 +" + kfmt(返金) + " · 星羽 +" + kfmt(返羽));
    行.push("经验 +" + 卖出经验);
    await reply(ctx, t, 行.join("\n"), { 标题: "💰 卖出成功", 按钮: [btn("eq12", "背包", "背包"), btn("eq15", "商店", "商店")] });
    return;
  }
  // 2.5.3：历史残留物品（名字已不在装备表 / 道具表里，例如旧版 BOSS 专属装备）也能卖出
  if (allItems().indexOf(nm) < 0) {
    const 残留量 = 我背包件数(ctx, u, nm);
    if (残留量 > 0) {
      if (残留量 < k) { await reply(ctx, t, "背包里只有 " + 残留量 + " 件【" + nm + "】。", { 标题: "卖出失败" }); return; }
      const 单价 = 40;
      // 2.9.10（收支核对修复）：先扣世界资金（不够则整单退回），再出货付款 —— 严格模式
      if (!扣世界资金(ctx, 单价 * k, "商店回收残留物品 " + nm + "×" + k)) {
        await reply(ctx, t, [
          "❌ 卖出暂缓 —— 世界资金不足以回收（未扣货、未付款）。",
          "",
          补货提示(ctx)
        ].join("\n"), { 标题: "🌐 世界资金不足", 按钮: [btn("eq19", "世界资金", "世界资金"), btn("eq20", "官方群", "官方群")] });
        return;
      }
      出背包(ctx, u, nm, k);
      addCoin(ctx, u, 单价 * k);
      const 经验2 = Math.max(20, Math.floor(单价 * k / 10));
      加经验(ctx, u, 经验2);
      await reply(ctx, t, "已卖出 " + k + " 件【" + nm + "】（历史残留物品）\n\n星羽 +" + 单价 * k + "（单价 " + 单价 + "）· 经验 +" + 经验2, {
        标题: "💰 卖出成功", 行组: [row(btn("eq16", "背包", "背包"), btn("eq17", "清理残留", "清理残留"), btn("eq18", "商店", "商店"))]
      });
      return;
    }
  }
  if (allItems().indexOf(nm) < 0) { await reply(ctx, t, "【" + nm + "】不能出售。", { 标题: "卖出失败" }); return; }
  if (hasItem(ctx, u, nm) < k) { await reply(ctx, t, "你只有 " + hasItem(ctx, u, nm) + " 个【" + nm + "】。", { 标题: "卖出失败" }); return; }
  // 2.2.9：菜品卖成「金币」；普通材料仍卖成「星羽」
  const 是菜 = 是菜品(nm);
  const 价 = 是菜 ? Math.max(10, Math.floor(菜价[nm] * 0.6)) : Math.max(10, Math.floor(itemPrice(nm) * 0.6) || 30);
  // 2.9.10（收支核对修复）：先扣世界资金（不够则整单退回），再出货付款 —— 严格模式
  if (!扣世界资金(ctx, 价 * k, "商店回收 " + nm + "×" + k)) {
    await reply(ctx, t, [
      "❌ 卖出暂缓 —— 世界资金不足以回收（未扣货、未付款）。",
      "",
      补货提示(ctx)
    ].join("\n"), { 标题: "🌐 世界资金不足", 行组: [row(btn("eq21", "世界资金", "世界资金"), btn("eq22", "官方群", "官方群"), btn("eq23", "背包", "背包"))] });
    return;
  }
  takeItem(ctx, u, nm, k);
  if (是菜) dset(ctx, P.金币, u, dn(ctx, P.金币, u, 0) + 价 * k);
  else addCoin(ctx, u, 价 * k);
  const 卖出经验 = Math.max(20, Math.floor(价 * k / 10));
  加经验(ctx, u, 卖出经验);
  await reply(ctx, t, "已卖出 " + k + " 个【" + nm + "】，星羽 +" + (价 * k) + "（单价 " + 价 + "）· 经验 +" + 卖出经验, {
    标题: "💰 卖出成功", 按钮: [btn("eq13", "背包", "背包"), btn("eq14", "商店", "商店")]
  });
}


export async function 分解装备(ctx, t, u, name) {
  const e = 装备定义(name);
  if (!e) { await reply(ctx, t, "只有武器 / 护甲可以分解。", { 标题: "分解失败" }); return; }
  同步装备存储(ctx, u, e.名);
  if (槽名(装备槽(ctx, u), e.类) === e.名) { await reply(ctx, t, "【" + e.名 + "】正装备着，先脱下再分解。", { 标题: "分解失败" }); return; }
  // 2.5.5：分解的是「强化最低」的那件（避免误拆高级装备）
  const L = 最低强化(ctx, u, e.名);
  if (!出背包(ctx, u, e.名, 1, L)) { await reply(ctx, t, "背包里没有【" + e.名 + "】。", { 标题: "分解失败" }); return; }
  const 核 = Math.max(1, Math.floor(e.段 / 3));
  addCore(ctx, u, 核);
  await reply(ctx, t, "分解【" + e.名 + "】（Lv." + 等级显示(L) + "）获得 星核 +" + 核, { 标题: "♻️ 分解完成", 按钮: [btn("eq15", "背包", "背包")] });
}



/* ---------- ⑥ 星甲背包 ---------- */
export function 背包表(ctx) { const v = dget(ctx, P.背包, "物品", {}); return v && typeof v === "object" ? v : {}; }


export function 我的背包(ctx, u) { const v = 背包表(ctx)[u]; return Array.isArray(v) ? v : []; }


export function 存我背包(ctx, u, list) { const all = 背包表(ctx); all[u] = Array.isArray(list) ? list : []; dset(ctx, P.背包, "物品", all); }


// 2.5.5：装备入包带「强化等级」（默认 0 = Lv.1）；同名同等级才合并
// 3.0.0：入包前过一遍 规范装备名()，老名字（专属·/BOSS·/传说·）也能正确进包，不会变成「未知物品」
export function 入背包(ctx, u, name, cnt, 强化) {
  const nm = 规范装备名(S(name));
  if (!nm) return 0;
  const 数 = Math.max(1, Math.floor(Number(cnt) || 1));
  const e = 装备定义(nm);
  const L = e ? Math.max(0, Math.floor(n(强化, 0))) : 0;
  const list = 我的背包(ctx, u);
  if (e) {
    const it = list.filter((x) => S(x.名) === nm && 件强化(x) === L)[0];
    if (it) it.数量 = Math.max(0, n(it.数量, 1)) + 数;
    else list.push({ 名: nm, 类: e.类, 数量: 数, 强化: L });
  } else {
    const it = list.filter((x) => S(x.名) === nm)[0];
    if (it) it.数量 = Math.max(0, n(it.数量, 1)) + 数;
    else list.push({ 名: nm, 类: "其他", 数量: 数 });
  }
  存我背包(ctx, u, list);
  return 背包持有(ctx, u, nm);
}


export function 背包持有(ctx, u, name) {
  const 目标 = 规范装备名(S(name));
  return 我的背包(ctx, u).filter((x) => 规范装备名(S(x.名)) === 目标).reduce((a, b) => a + Math.max(0, n(b.数量, 1)), 0);
}


/* ---------- 2.5.13 两套存储统一（修复「背包数据刷新不及时」） ----------
 * 历史上有两套库存：
 *   · 星甲背包/物品.json   —— 副本 / BOSS 掉落、装备（走 入背包 / 出背包 / 背包持有）
 *   · 道具系统/<名>.json   —— 商店购买、材料、管理员发放（走 giveItem / hasItem）
 * 装备若被写进「道具系统」（例如商店买的 初级小刀、管理员发放的装备），
 * 背包面板能看到、但「装备 / 分解 / 卖」全部报「背包里没有」——看起来就是数据没刷新。
 * 现在：装备统一走星甲背包，并提供一个「把道具系统里的装备搬回星甲背包」的同步函数。
 */
export function 同步装备存储(ctx, u, name) {
  const nm = S(name);
  if (!nm || !装备定义(nm)) return 0;
  const 道具量 = hasItem(ctx, u, nm);
  if (道具量 > 0) { takeItem(ctx, u, nm, 道具量); 入背包(ctx, u, nm, 道具量, 0); }
  return 背包持有(ctx, u, nm);
}


// 装备增减（正数发放 / 负数扣除），返回现持有数量
export function giveEquip(ctx, u, name, cnt) {
  const nm = S(name);
  const e = 装备定义(nm);
  if (!e) return 0;
  同步装备存储(ctx, u, nm);
  const k = Math.trunc(Number(cnt) || 0);
  if (k > 0) 入背包(ctx, u, nm, k, 0);
  else if (k < 0) 出背包(ctx, u, nm, Math.abs(k));
  return 背包持有(ctx, u, nm);
}


export function 我背包件数(ctx, u, name) {
  const nm = 规范装备名(S(name));
  let t = 0;
  for (const it of 我的背包(ctx, u)) if (规范装备名(S(it.名)) === nm) t += Math.max(1, n(it.数量, 1));
  return t;
}


// 2.5.5：出背包可指定「强化等级」（装备用）；不指定时优先扣强化最低的那件
export function 出背包(ctx, u, name, cnt, 强化) {
  const k = Math.max(1, Math.floor(Number(cnt) || 1));
  const nm = 规范装备名(S(name));
  const e = 装备定义(nm);
  const 指定 = (e && 强化 !== undefined && 强化 !== null) ? Math.max(0, Math.floor(n(强化, 0))) : null;
  const list = 我的背包(ctx, u);
  const 候选 = list.filter((x) => 规范装备名(S(x.名)) === nm && (指定 === null || 件强化(x) === 指定));
  const 总 = 候选.reduce((a, b) => a + Math.max(0, n(b.数量, 1)), 0);
  if (总 < k) return false;
  if (指定 === null) 候选.sort((a, b) => 件强化(a) - 件强化(b));
  let 剩 = k;
  for (const it of 候选) {
    if (!剩) break;
    const c = Math.max(0, n(it.数量, 1));
    const 取 = Math.min(c, 剩);
    it.数量 = c - 取;
    剩 -= 取;
  }
  存我背包(ctx, u, 规范化背包(list));
  return true;
}


export function 排序物品(list) {
  const 权重 = { 武器: 0, 护甲: 1, 材料: 8, 其他: 9 };
  return list.sort((a, b) => {
    const wa = 权重[a.类] === undefined ? 5 : 权重[a.类];
    const wb = 权重[b.类] === undefined ? 5 : 权重[b.类];
    if (wa !== wb) return wa - wb;
    if (n(a.段, 0) !== n(b.段, 0)) return n(b.段, 0) - n(a.段, 0);
    return String(a.名).localeCompare(String(b.名), "zh");
  });
}


/* ---------- 3.0.0（需求 22/24）关键词搜索：分级匹配 + 排序 + 分页 ----------
 * 商店（lib/game/econ.mjs）与背包（本文件）共用这一套：
 *   ① 匹配：大小写不敏感的中文包含匹配（`种子` 命中「星芽种子」「小麦种子」）；
 *   ② 排序：完全匹配（3）> 名称开头（2）> 名称包含（1），同级保持原始顺序（编号稳定）；
 *   ③ 分页：每页 N 条，页脚统一「关键词命中 N 件 · 第 x/y 页」。
 * 放在 equip.mjs 是因为背包与商店都要用，且本文件不反向依赖 econ.mjs（避免新增循环 import）。
 */
export function 匹配等级(名, 词) {
  const a = S(名).toLowerCase(), b = S(词).toLowerCase();
  if (!b || !a) return 0;
  if (a === b) return 3;
  if (a.indexOf(b) === 0) return 2;
  if (a.indexOf(b) >= 0) return 1;
  return 0;
}


// 表 → 按「完全匹配 > 名称开头 > 包含」排序后的命中项（不改变原表）
//   取名：可选，默认取 x.名（也支持表里直接是字符串）
export function 搜索排序(表, 词, 取名) {
  const 词0 = S(词);
  if (!词0) return [];
  const 名取 = typeof 取名 === "function" ? 取名 : (x) => (typeof x === "string" ? x : (x && x.名));
  const 带 = [];
  (Array.isArray(表) ? 表 : []).forEach((x, i) => {
    const 级 = 匹配等级(名取(x), 词0);
    if (级 > 0) 带.push({ x: x, 级: 级, i: i });
  });
  带.sort((a, b) => (b.级 - a.级) || (a.i - b.i));
  return 带.map((r) => r.x);
}


// 分页：返回 { 总页, 页, 本页 }，页码越界一律夹到 [1, 总页]
export function 搜索分页(命中, 每页, 页参) {
  const 条 = Array.isArray(命中) ? 命中 : [];
  const 每 = Math.max(1, Math.floor(Number(每页) || 5));
  const 总页 = Math.max(1, Math.ceil(条.length / 每));
  let 页 = Math.max(1, Math.floor(Number(页参) || 1));
  if (页 > 总页) 页 = 总页;
  return { 总页: 总页, 页: 页, 本页: 条.slice((页 - 1) * 每, 页 * 每) };
}


// 背包视图 = 已装备 + 背包内装备 + 材料道具文件（实时合并，不重复计数）
// 2.5.5：装备按「名 + 等级」分行 —— 同名不同等级不再被合并
export function 背包列表(ctx, u) {
  const out = [];
  const 槽 = 装备槽(ctx, u);
  const 扣 = {};
  for (const 类 of ["武器", "护甲"]) {
    const it0 = 槽项(槽, 类);
    if (!it0) continue;
    const e = 装备定义(it0.名);
    if (!e) continue;
    const key = it0.名 + "|" + it0.强化;
    扣[key] = (扣[key] || 0) + 1;
    out.push({ 名: it0.名, 类: e.类, 段: e.段, 品质: 装备品质(e), 数量: 1, 装备中: true, 强化: it0.强化, 升级: it0.强化, 等级: 等级显示(it0.强化), 描述: 装备描述(e, it0.强化) });
  }
  for (const it of 我的背包(ctx, u)) {
    const nm = 规范装备名(S(it.名));
    if (!nm) continue;
    const e = 装备定义(nm);
    const L = e ? 件强化(it) : 0;
    const key = e ? nm + "|" + L : nm;
    let c = Math.max(0, n(it.数量, 1));
    if (扣[key]) { const 取 = Math.min(c, 扣[key]); c -= 取; 扣[key] -= 取; }
    if (c <= 0) continue;
    out.push({ 名: nm, 类: e ? e.类 : (S(it.类) || "其他"), 段: e ? e.段 : 0, 品质: e ? 装备品质(e) : "", 数量: c, 装备中: false, 强化: L, 升级: L, 等级: e ? 等级显示(L) : 0, 描述: e ? 装备描述(e, L) : "" });
  }
  // 2.5.17：道具部分改为「我持有的全部道具」（含道具目录里实际存在的文件），
  //   这样商店买的太虚还魂汤 / 碧髓回春液 / 玄元凝血膏 / 九幽血髓酿等不会再「消失」
  for (const it of 我的道具集(ctx, u)) {
    const nm = it.名;
    const c = it.数量;
    if (c > 0) {
      // 2.5.13：若这一项其实是装备（例如商店买的 / 管理员发放的），按装备类显示，才能装备 / 分解
      const e = 装备定义(nm);
      out.push({ 名: nm, 类: e ? e.类 : (是药品(nm) ? "药" : (是菜品(nm) ? "菜" : "材料")), 段: e ? e.段 : 0, 品质: e ? 装备品质(e) : "", 数量: c, 装备中: false, 强化: 0, 升级: 0, 等级: e ? 1 : 0, 描述: e ? 装备描述(e, 0) : 道具描述(nm) });
    }
  }
  return out;
}


export function 背包动作(x) {
  if (x.装备中) return "脱下";
  if (x.类 === "武器" || x.类 === "护甲") return "装备   卖   分解";
  if (x.类 === "材料") return "使用   卖";
  return "卖";
}


export function 背包主指令(x) {
  if (x.装备中) return "脱下" + x.类;
  if (x.类 === "武器" || x.类 === "护甲") return "装备#" + x.名;
  return "使用" + x.名 + "1";
}


export function 背包主标签(x) {
  if (x.装备中) return "脱下";
  if (x.类 === "武器" || x.类 === "护甲") return "装备";
  return "使用";
}


// 2.2.1：背包里的「使用 / 卖 / 装备 / 分解」改成蓝色可点击文字
export function 背包蓝字(x) {
  const 项 = [];
  if (x.装备中) 项.push(["脱下" + x.类, "脱下"], ["升级装备#" + x.名 + "#1", "升级"]);
  else if (x.类 === "武器" || x.类 === "护甲") 项.push(["装备#" + x.名, "装备"], ["升级装备#" + x.名 + "#1", "升级"], ["卖#" + x.名 + "#1", "卖"], ["分解#" + x.名, "分解"]);
  else if (x.类 === "药" || x.类 === "材料" || x.类 === "菜") {
    // 2.2.5：修复「点使用永远插入 使用XX1」——默认按 USE_DEFAULT，另给「全用」和数量选择
    项.push(["使用" + x.名, "使用"], ["使用#" + x.名 + "#全部", "全用"], ["卖#" + x.名 + "#1", "卖1"], ["卖#" + x.名 + "#10", "卖10"]);
  }
  else 项.push(["卖#" + x.名 + "#1", "卖"]);
  return 蓝链(项);
}


export function 页码窗口(页, 总页) {
  const out = [];
  const 起 = Math.max(1, Math.min(页 - 2, 总页 - 4));
  for (let i = 起; i <= Math.min(总页, 起 + 4); i++) out.push(i);
  return out;
}


// 3.1.13（背包 UI 优化）：每页从 5 件提到 8 件。
//   原来一件物品占 2~3 行（名称行 + 操作行 + 描述行），5 件就是 10~15 行，一屏放不下；
//   把描述并入主行后，一件占 2 行，8 件 = 16 行仍在一屏内 —— 少翻页，看得全。
export const 背包每页 = 8;


/* 3.0.0（需求 22/24）：背包参数解析 —— 一个入口同时认「页码 / 关键词 / 编号详情」
 *   ""             → 全部物品第 1 页（旧行为）
 *   "3"            → 第 3 页（旧行为：翻页蓝字 / 页码按钮发的就是 `背包#3`）
 *   "种子"          → 关键词搜索第 1 页
 *   "种子#2"        → 关键词搜索第 2 页（搜索结果的翻页）
 *   "详情3"/"3号"   → 按「全局编号」看物品详情（列表里蓝色编号点进来就是这条）
 * 编号口径：**全局连续编号**（= 全部背包列表的下标 + 1，不受搜索过滤与翻页影响）。
 */
export function 解析背包参数(arg) {
  const 词 = S(arg);
  const 详情m = 词.match(/^(?:详情|查看|编号)\s*#?\s*([0-9]{1,4})$/) || 词.match(/^([0-9]{1,4})\s*号$/);
  if (详情m) return { 关键词: "", 页: 1, 详情号: Math.max(1, Math.floor(Number(详情m[1]))) };
  const 段 = 词.split("#").map((x) => S(x)).filter((x) => x !== "");
  if (段.length >= 2 && /^[0-9]{1,3}$/.test(段[段.length - 1])) {
    return { 关键词: 段.slice(0, -1).join("#"), 页: Math.max(1, Number(段[段.length - 1])), 详情号: 0 };
  }
  if (!段.length) return { 关键词: "", 页: 1, 详情号: 0 };
  if (/^[0-9]{1,3}$/.test(词)) return { 关键词: "", 页: Math.max(1, Number(词)), 详情号: 0 };
  return { 关键词: 词, 页: 1, 详情号: 0 };
}


// 背包关键词命中：名称 / 类别都参与匹配，排序「完全匹配 > 名称开头 > 包含」，同分按全局编号
export function 背包搜索(全部, 关键词) {
  const 词 = S(关键词);
  const 表 = Array.isArray(全部) ? 全部 : [];
  if (!词) return 表;
  return 表
    .map((x, i) => ({ x: x, i: i, 级: Math.max(匹配等级(x.名, 词), 匹配等级(x.类, 词)) }))
    .filter((r) => r.级 > 0)
    .sort((a, b) => (b.级 - a.级) || (a.i - b.i))
    .map((r) => r.x);
}


// 全局编号：物品在「全部背包列表」里的位置 + 1（搜索视图里也显示这个号，点哪个号都对得上同一件）
export function 背包编号(全部, x) {
  const i = (Array.isArray(全部) ? 全部 : []).indexOf(x);
  return i >= 0 ? i + 1 : 0;
}


export async function 背包面板(ctx, t, u, arg, 模式) {
  // 3.0.0（需求：分类背包）：模式 = "" 全部 / "材料" / "装备" / "其他" —— 各自独立编号与翻页
  const 全量 = 背包列表(ctx, u);
  const 全部 = 模式 ? 全量.filter((x) => 分类命中(x, 模式)) : 全量;
  const 参 = 解析背包参数(arg);
  if (参.详情号) { await 背包详情面板(ctx, t, u, 参.详情号); return; }
  const 关键词 = 参.关键词;
  const 命中 = 背包搜索(全部, 关键词);
  const 分页 = 搜索分页(命中, 背包每页, 参.页);
  const 页 = 分页.页, 总页 = 分页.总页, 切片 = 分页.本页;
  const p = attrs(ctx, u);
  const 槽 = 装备槽(ctx, u);
  // 3.0.0（需求 4.8）：装备位也带品质标签
  const 位文本 = (类) => {
    const nm = 槽名(槽, 类);
    if (!nm) return "空";
    const e0 = 装备定义(nm);
    return (e0 ? 品质标签(e0) : "") + nm + " Lv." + 等级显示(槽强化(槽, 类));
  };
  const 正文 = [
    ["▍档案", false],
    ["用户:" + gid(ctx, u) + (p.称号徽标 ? "　" + p.称号徽标 : ""), true],
    ["昵称:" + p.昵称 + (全服倍率(ctx) > 1 ? "　" + 倍率说明(ctx) : ""), true],
    ["金币:" + kfmt(p.金币) + "　星羽:" + kfmt(p.星羽) + "　存款:" + kfmt(p.存款), true],
    ["装备位: 武器[" + 位文本("武器") + "] 护甲[" + 位文本("护甲") + "]", true],
    // 3.0.0（需求 22）：搜索时页眉给「关键词命中 N 件 · 第 x/y 页」
    [模式 ? "【" + 模式 + "背包】物品 " + 全部.length + " 种 · 第 " + 页 + "/" + 总页 + " 页（与总背包分开编号）" : null, true],
    !模式 ? [关键词
      ? "物品 " + 全部.length + " 种 · 关键词命中 " + 命中.length + " 件 · 第 " + 页 + "/" + 总页 + " 页 · 搜索「" + 关键词 + "」"
      : "物品 " + 全部.length + " 种 · 第 " + 页 + "/" + 总页 + " 页", true] : null,
    ["", true]
  ];
  if (!切片.length) 正文.push([关键词 ? "没有找到匹配「" + 关键词 + "」的物品（例：背包#武器 / 背包#种子）。" : "背包空空如也，去打副本掉装备吧。", true]);

  // 3.1.13（背包 UI 优化）：页眉加一行「按类别统计」，玩家一眼知道背包里都是什么、
  //   有多少件装备可穿，不用自己数。同时把装备/材料/其他分开计（与分类背包口径一致）。
  if (切片.length) {
    const 统计 = { 装备: 0, 材料: 0, 其他: 0 };
    全部.forEach((x) => {
      const 是装 = x.类 === "武器" || x.类 === "护甲";
      const 是材 = !是装 && (x.类 === "材料" || x.类 === "");
      if (是装) 统计.装备++; else if (是材) 统计.材料++; else 统计.其他++;
    });
    const 件 = 全部.reduce((a, b) => a + Math.max(1, n(b.数量, 1)), 0);
    正文.push([
      "⚔️装备 " + 统计.装备 + "　🧱材料 " + 统计.材料 + "　📦其他 " + 统计.其他 +
      "　·　共 " + 件 + " 件（" + 全部.length + " 种）",
      true,
    ]);
    正文.push(["", true]);
  }
  // 3.3.7：物品列表前加黑色分区锚点，与属性/农场/药园/副本面板的设计语言统一
  正文.push(["▍物品清单（点蓝色编号看详情）", false]);

  切片.forEach((x, i) => {
    const 号 = 背包编号(全部, x);
    const 是装 = x.类 === "武器" || x.类 === "护甲";
    // 2.7.0（需求 11）：原来每个物品占三行（名称独立加粗 + 描述 + 数量），
    //   而 QQ 的 markdown 对「连续的独立加粗行」支持不好，玩家看到的效果是「只有第一个物品名是大的」。
    //   现在改成：名称与数量/操作放**同一行**且加粗内联，一件物品最多两行，加粗也不会被拆散。
    // 3.0.0（需求 24 / 4.8）：行首编号改成蓝色可点（点了填 `星甲背包#详情N`），编号 = 全局连续编号
    //   3.0.0：装备名前面加品质标签（【普通】/【史诗】/【传说】），掉落与背包口径一致
    // 3.3.17（背包 UI 更新）：物品名改为**正常字体**（去掉 ** 加粗），描述**完整显示不截断**，
    //   整行走灰混的灰色引用块（[头,true]）。编号仍是蓝色可点入口。
    const 描述 = String(x.描述 || "").trim();
    const 头 = "■ " + 蓝字("背包#详情" + 号, 号 + ".") + " " + (是装 ? 显示品质(x.品质) : "") + x.名 +
      // 2.9.1（F3 修复）：原来「段位 lv.50」和「强化等级 Lv.1」两个等级拼在一起（Lv50 Lv.1），
      //   玩家分不清。现在只显示段位一个等级；强化 >0 时才追加「+N」强化标记。
      "（" + (x.类 || "物品") + (x.段 ? "·lv." + x.段 : "") + (是装 && x.强化 > 0 ? "·+" + x.强化 : "") + (x.装备中 ? " ·已装备" : "") + "）" +
      "　×" + x.数量 +
      // 描述完整并入主行（灰字），不再截断
      (描述 ? "　" + 描述 : "");
    正文.push([头, true]);
    正文.push(["　" + 背包蓝字(x), true]);
    // 3.1.13：物品之间加一条细分隔线，长列表时层次更清楚
    if (i < 切片.length - 1) 正文.push(["　———", true]);
  });
  const 页前缀 = 模式 ? 模式 + "背包#" : (关键词 ? "背包#" + 关键词 + "#" : "背包#");
  const 页脚 = 蓝链(页码窗口(页, 总页).map((n) => [页前缀 + n, n === 页 ? "[" + n + "]" : String(n)]));
  正文.push(["", true]);
  正文.push(["翻页：" + (页 > 1 ? 蓝字(页前缀 + (页 - 1), "上一页") + "  " : "") + 页脚 + (页 < 总页 ? "  " + 蓝字(页前缀 + (页 + 1), "下一页") : ""), true]);
  正文.push(["搜索：" + 蓝链([["背包#武器", "武器"], ["背包#护甲", "护甲"], ["背包#药", "药品"], ["背包#材料", "材料"], ["背包#鱼", "鱼"]])
    + "　自定义：发 `星甲背包 关键词`（如 " + 蓝字("背包#种子", "背包#种子") + "）", true]);
  // 3.1.13（背包 UI 优化）：原来这段说明很长（一整行 60+ 字），压成一行短提示，
  //   完整说明留在「详情」页里 —— 背包是高频翻的界面，底部越短越好。
  正文.push(["详情：点蓝色编号看属性　整理：" + 蓝字("一键整理", "一键整理") + "　属性：" + 蓝字("星甲属性", "属性"), true]);
   const 残留数 = 全部.filter((x) => !装备定义(x.名) && allItems().indexOf(x.名) < 0).reduce((a, b) => a + Math.max(1, n(b.数量, 1)), 0);
  if (残留数 > 0) 正文.push(["⚠️ 背包里有 " + 残留数 + " 件历史残留物品（旧版装备），可 " + 蓝字("清理残留", "清理残留") + " 折价清掉", true]);
 正文.push(["装备操作：" + 蓝链([["星甲一键穿最强", "一键穿最强"], ["星甲装备", "星甲装备"], ["星甲转移升级", "转移升级"], ["星甲升级装备", "升级装备"], ["星甲一键卖装备", "一键卖装备"], ["星甲兑换金币", "星羽换金币"]]), true]);
  const 行组 = [];
  // 3.1.13（背包 UI 优化）：每页 8 件 → 快捷按钮**每行 4 个**（QQ 按钮一行放太多会挤成一长条、
  //   按钮文字被截断，反而看不清）。原来 5 件塞一行就已经偏挤了。
  const 快键 = 切片.map((x, i) => btn("bg" + i, 背包主标签(x) + x.名.slice(0, 6), 背包主指令(x)));
  for (let i = 0; i < 快键.length; i += 4) 行组.push(row.apply(null, 快键.slice(i, i + 4)));
  const 页行 = [];
  if (页 > 1) 页行.push(btn("bgp", "⬅上一页", 页前缀 + (页 - 1)));
  页行.push(actBtn("bgt", "⚡一键整理", "bagtidy"));
  if (页 < 总页) 页行.push(btn("bgn", "下一页➡", 页前缀 + (页 + 1)));
  页行.push(btn("bgq", "搜索武器", "背包#武器"), btn("bgr", "搜索材料", "背包#材料"));
  行组.push(row.apply(null, 页行));
  行组.push(row.apply(null, 页码窗口(页, 总页).map((n) => btn("bpg" + n, String(n), 页前缀 + n))));
  await reply(ctx, t, 灰混(正文), { 标题: "🎒 星甲背包", 行组: 行组 });
}


/* 3.0.0（需求 24）：背包物品详情 —— 按「全局编号」查看单件物品并直接操作
 * 入口：列表里的蓝色编号（点了填 `星甲背包#详情N`）、`星甲背包 详情N`、`星甲背包 N号`
 * 用全局编号而不是页内编号：搜索结果里点编号也能落回同一件物品（编号不受搜索 / 翻页影响）。
 */
export function 分类命中(x, 模式) {
  const 类 = S(x && x.类);
  const 是装 = 类 === "武器" || 类 === "护甲";
  const 是材 = !是装 && (类 === "材料" || 类 === "");
  if (模式 === "装备") return 是装;
  if (模式 === "材料") return 是材;
  if (模式 === "其他") return !是装 && !是材;
  return true;
}

// 3.0.0：分类背包入口（材料 / 装备 / 其他）
export async function 分类背包面板(ctx, t, u, arg, 模式) { return 背包面板(ctx, t, u, arg, 模式); }

export async function 背包详情面板(ctx, t, u, 号参) {
  const 全部 = 背包列表(ctx, u);
  const 号 = Math.floor(Number(号参) || 0);
  if (号 < 1 || 号 > 全部.length) {
    await reply(ctx, t, [
      "背包里没有 " + (号 > 0 ? 号 + " 号" : "这个编号的") + "物品（当前共 " + 全部.length + " 件）。",
      "",
      "编号 = 列表左侧的蓝色数字；发 " + 蓝字("背包#1", "星甲背包") + " 回背包看编号。"
    ].join("\n"), {
      标题: "🎒 物品详情",
      行组: [row(btn("bd0", "背包", "背包"), btn("bd1", "搜索种子", "背包#种子"), actBtn("bd2", "⚡一键整理", "bagtidy"))]
    });
    return;
  }
  const x = 全部[号 - 1];
  const 是装 = x.类 === "武器" || x.类 === "护甲";
  let 价 = 0;
  try { 价 = Math.max(0, Math.floor(Number(itemPrice(x.名)) || 0)); } catch (e) { 价 = 0; }
  const 行 = [
    "## 🎒 " + 号 + ". " + (是装 ? 显示品质(x.品质) : "") + x.名,
    "",
    "类型：" + (是装 ? 装备品质(x) + " · " : "") + (x.类 || "物品") + (x.段 ? " · lv." + x.段 : "") + (是装 && x.强化 > 0 ? " · 强化 +" + x.强化 : "") + (x.装备中 ? " · **已装备**" : ""),
    "数量：" + x.数量 + (价 > 0 ? "　参考单价：" + kfmt(价) + " 星羽" : ""),
    x.描述 ? "说明：" + x.描述 : "",
    "",
    "操作：" + 背包蓝字(x),
    "",
    "编号：" + 号 + "/" + 全部.length + " · 发 `星甲背包 详情<编号>` 可直接跳转"
  ].filter((s) => s !== "");
  const 跳 = [];
  if (号 > 1) 跳.push(btn("bdP", "⬅上一件(" + (号 - 1) + ")", "背包#详情" + (号 - 1)));
  跳.push(btn("bdB", "返回背包", "背包#1"));
  if (号 < 全部.length) 跳.push(btn("bdN", "下一件(" + (号 + 1) + ")➡", "背包#详情" + (号 + 1)));
  await reply(ctx, t, 行.join("\n"), {
    标题: "🎒 物品详情 " + 号 + "/" + 全部.length,
    行组: [
      row.apply(null, 跳),
      row(btn("bdU", 背包主标签(x) + x.名.slice(0, 6), 背包主指令(x)), btn("bdS", "卖1个", "卖#" + x.名 + "#1"), btn("bdA", "属性", "属性"), btn("bdM", "星甲菜单", "星甲菜单"))
    ]
  });
}


export async function 一键整理(ctx, t, u) {
  const 前 = 背包列表(ctx, u);
  const 装 = 我的背包(ctx, u);
  const 类记 = {};
  for (const it of 装) { const nm = S(it.名); if (nm && !类记[nm]) 类记[nm] = S(it.类) || ""; }
  // 2.5.5：装备按「名 + 等级」合并（不同等级保持两行），材料道具按名字合并
  const 新 = 规范化背包(装);
  // 2.5.3：修正历史残留的分类 —— 装备按装备表定类；真道具保留原类（原类缺失时按材料）；
  //   名字已彻底不存在的（旧版专属装备等）记为「其他」，可用 `清理残留` 折价清掉。
  for (const it of 新) {
    const e = 装备定义(it.名);
    it.类 = e ? e.类 : (allItems().indexOf(it.名) >= 0 ? (类记[it.名] || "材料") : "其他");
  }
  排序物品(新);
  存我背包(ctx, u, 新);
  const 后 = 背包列表(ctx, u);
  const 材料 = 后.filter((x) => x.类 === "材料").reduce((a, b) => a + b.数量, 0);
  await reply(ctx, t, [
    "**背包整理完成**",
    "",
    "背包内物品：" + 装.length + " 条 → " + 新.length + " 条（合并同名堆叠）",
    "装备：" + 后.filter((x) => x.类 === "武器" || x.类 === "护甲").length + " 件 · 材料：" + 材料 + " 个",
    "排列顺序：已装备 → 武器 → 护甲 → 其他 → 材料（同类型按等级从高到低）",
    "",
    "已装备：" + ["武器", "护甲"].map((k) => k + "[" + (槽名(装备槽(ctx, u), k) ? 槽名(装备槽(ctx, u), k) + " Lv." + 等级显示(槽强化(装备槽(ctx, u), k)) : "空") + "]").join(" · ")
  ].join("\n"), {
    标题: "🧹 一键整理",
    行组: [row(actBtn("bt1", "⚡看背包", "bag|1"), actBtn("bt2", "⚡看属性", "info"), btn("bt3", "副本", "副本"), btn("bt4", "菜单", "菜单"))]
  });
}



/* ---------- ③ 副本组队 ---------- */
export const 队伍上限 = 10;
