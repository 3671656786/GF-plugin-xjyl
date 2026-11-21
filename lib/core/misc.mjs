// lib/core/misc.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { 写控制台配置, 读控制台配置 } from "./../admin/admin.mjs?v=v1795259210803";
import { PT, S, dget, dn, dset, mdImg, ymd, 版本 } from "././base.mjs?v=v1795259210803";
import { ack, api, cmdInput, delMsg, reply, sendSegs, 发图片, 主动可用 } from "././qq.mjs?v=v1795259210803";
import { 闪避上限 } from "././rules.mjs?v=v1795259210803";
import { P, interBtn, interTarget, targetOf, uid } from "././util.mjs?v=v1795259210803";
import { players } from "./../game/alliance.mjs?v=v1795259210803";
import { BOSS战备, BOSS攻倍率, BOSS攻倍率分段表, BOSS攻倍率曲线点, BOSS特殊属性, BOSS特殊属性表, BOSS真伤加成, BOSS表, BOSS词条档, 副本基准属性 } from "./../game/boss.mjs?v=v1795259210803";
import { BET_MAX, BET_MIN, EXP_MAX, FISH_MAX, 娱乐冷却余, 娱乐已用, 探索每日上限, 赌场哈希, 赌场日限, 赌场日限下限, 赌场日限区间, 赌场每日记录, 钓鱼每日上限 } from "./../game/casual.mjs?v=v1795259210803";
import { 伤害结算, 单次伤害, 大数, 天下楼真伤加成, 尝试复活, 怪词条, 推进敌方阶段, 攻击力, 敌方闪避上限, 敌方阶段值, 敌方阶段档, 敌方阶段表, 自动服药 } from "./../game/combat.mjs?v=v1795259210803";
import { 菜日上限 } from "./../game/cook.mjs?v=v1795259210803";
import { 串行锁, 信用拦截, 信用每日上限, 信用零放行, 写贷款, 加世界资金, 加世界资金Async, 加信用分, 取信用分, 取奖励分, 奖励分上限, 奖励分步长, 奖励分每日上限, 奖励幸运币, 奖励星核, 奖励星羽, 官方群链接, 扣世界资金, 扣世界资金Async, 日取量, 结算逾期, 补货提示, 读世界资金, 读贷款, 贷款概况, 贷款计息, 贷款额度, 资金见底 } from "./../game/credit.mjs?v=v1795259210803";
import { BOSS总血量, 专属装备表, 全部装备, 我血量上限, 掉生长药水, 敌推荐战力, 敌数据, 敌缩放幅度, 敌缩放系数, 生长药水今日已掉, 生长药水今日已购, 生长药水日掉限, 生长药水日购限, 装备数值 } from "./../game/dungeon.mjs?v=v1795259210803";
import { hallList, hallSave, 交易行上架税率, 交易行每页条数, 交易行购买税率, 存股票持仓, 存股票行情, 股事件, 股票tick, 股票买入, 股票停牌阈值, 股票单次涨跌停, 股票卖出, 股票派息, 股票派息毫秒, 股票行情, 股票表, 股票跳间隔毫秒, 设股票上下限, 读股票上下限, 读股票持仓, 购买数量, 迁移旧基金 } from "./../game/econ.mjs?v=v1795259210803";
import { xpNeed, 作物表, 催熟, 农场升级需经验, 农场地块上限, 农场地块最大, 农场地块起步, 农场等级上限, 农场解锁间隔, 农田产量倍率, 农田升级最大, 农田升级费, 存农场, 种子价, 经验锚点, 菜价, 菜品集, 菜谱表, 读农场, 读农场成长, 读农田等级 } from "./../game/farm.mjs?v=v1795259210803";
import { addCoin, attrs, byGid, gid, giveItem, hasItem, pwrOf, 奖励倍率, 授系统称号, 撤销玩家词条, 星灵词条, 激活玩家词条, 玩家可用词条键, 玩家激活词条, 称号倍, 称号表, 系统称号列表, 系统称号巡检, 系统称号效果, 系统称号稀有度, 系统称号表, 细分倍率, 词条上限, 词条定义, 词条汇总, 词条面板文本 } from "./../game/player.mjs?v=v1795259210803";
import { DG } from "./../game/progress.mjs?v=v1795259210803";
import { PVP全表, PVP找会话, PVP进行中 } from "./../game/pvp.mjs?v=v1795259210803";
import { 药品回血, 药品集, 装备表 } from "./../game/rebirth.mjs?v=v1795259210803";
import { 世界资金初始, 信用上限, 信用默认, 捐款加分单位, 捐款单次加分上限, 贷款小时利率, 贷款最久毫秒, 贷款最高额, 贷款每分额度 } from "./../game/star.mjs?v=v1795259210803";
import { 单刀上限, 单刀截断, 单刀顶, 单次硬顶, 天下楼怪, 实际伤害, 我方出手, 玩家单次伤害硬上限 } from "./../game/tower.mjs?v=v1795259210803";
import { plugin_onevent, plugin_onmessage, 归一分隔符 } from "./../hooks.mjs?v=v1795259210803";
import { 公告拆段, 公告拆段字数, 公告每页条数, 读公告 } from "./../ui/menu.mjs?v=v1795259210803";

export function 取用户头像Url(ctx, event) {
  const a = (event && event.author) || {};
  const 直给 = S(a.avatar || (event && event.avatar));
  if (/^https?:\/\//i.test(直给)) return 直给.replace(/^http:/i, "https:");
  const openid = uid(event);
  const appId = S(ctx && ctx.frameworkEnv && (ctx.frameworkEnv.appId || ctx.frameworkEnv.botAppId));
  if (appId && openid) return "https://q.qlogo.cn/qqapp/" + appId + "/" + openid + "/640";
  if (/^\d{5,}$/.test(openid)) return "https://q4.qlogo.cn/g?b=qq&nk=" + openid + "&s=640";
  return "";
}


export async function 发头像(ctx, 目标, url) {
  if (!url) return false;
  try { await 发图片(ctx, 目标, url, "头像"); return true; }
  catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 头像发送失败:", e);
    return false;
  }
}


// 入群 / 退群提示（头像一条 + 文案一条，2.5.29 按需求改成新版式）
// 2.7.1：秒级时间戳 / 毫秒级时间戳 → "YYYY-MM-DD HH:mm:ss"（本地时区）
export function 时间文本(ts) {
  let v = Number(ts);
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v < 1e12) v *= 1000;               // 秒 → 毫秒
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}


export async function 进出群提示(ctx, event, 类型) {
  const g = S(event && event.group_openid);
  if (!g) return;
  if (S(dget(ctx, P.入群欢迎, g, "开启")) === "关闭") return;
  // 3.0.0：成员进出事件没有可用的被动 msg_id（不是消息事件），只能走主动消息；
  //   宿主没开通「主动消息」权限时直接跳过，避免每次进群都刷 WARN（40034105）。
  if (!主动可用()) {
    if (ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 未开通主动消息，跳过进出群提示（" + 类型 + "）");
    return;
  }
  // 2.5.29：带上 event_id 走被动回复（不再依赖主动消息权限；被动不可用时由 发送兜底 自动转主动）
  const 目标 = { scope: "group", group_openid: g, event_id: S(event && event.id) };
  const openid = uid(event) || "未知";
  // 2.7.1 修复：原来直接把 Unix 秒数打到脸上（1792972836），改成可读时间
  const 时间 = 时间文本(event && event.timestamp);
  const 是进群 = 类型 === "add";
  await 发头像(ctx, 目标, 取用户头像Url(ctx, event));
  const 行 = 是进群
    ? [
      "欢迎新成员加入本群！",
      "您的id为：" + openid,
      "进群时间:" + 时间,
      "如需关闭提示",
      "请艾特我发“入群欢迎”"
    ]
    : [
      "很遗憾，有成员离开了本群！",
      "TA的id为：" + openid,
      "退群时间:" + 时间,
      "如需关闭提示",
      "请艾特我发“入群欢迎”"
    ];
  try {
    // 艾特该成员（蓝色 @）：进群提示里 @ 新成员，退群时成员已不在，只发文本
    await reply(ctx, 目标, 行.join("\n"), 是进群
      ? { 标题: "", 艾特id: openid }
      : { 标题: "", 无艾特: true });
  }
  catch (e) { if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 进出群提示发送失败:", e); }
}


// 兼容旧入口命名
export const plugin_on_message = plugin_onmessage;


export const plugin_on_event = plugin_onevent;



// ---------- 2.9.0：数值/玩法平衡测试钩子（t-balance4.mjs 专用，只读，不影响运行时） ----------
export const __balance4 = {
  xpNeed, 经验锚点, 天下楼怪, 天下楼真伤加成, BOSS真伤加成, DG, BOSS表, 敌数据, 敌推荐战力, 敌缩放系数, 敌缩放幅度, 副本基准属性, BOSS总血量, 我血量上限,
  伤害结算, 单次伤害, 攻击力, pwrOf, BOSS攻倍率, BOSS攻倍率曲线点, BOSS攻倍率分段表, BOSS词条档, 装备数值, 怪词条,
  赌场日限, 赌场每日记录, 赌场哈希, 赌场日限下限, 赌场日限区间, BET_MIN, BET_MAX,
  作物表, 种子价, 菜谱表, 菜价, 菜日上限, 菜品集,
  农场地块起步, 农场地块最大, 农场地块上限, 读农场成长, 读农场, 存农场, 农场等级上限, 农场升级需经验,
  读控制台配置, 写控制台配置, ymd
};



// ---------- 2.9.7：敌方三档阶段 / 玩家单次伤害硬上限测试钩子（t-297.mjs 专用） ----------
export const __combat297 = {
  敌方阶段表, 敌方阶段档, 敌方阶段值, 推进敌方阶段, 敌方闪避上限, 玩家闪避上限: 闪避上限,
  玩家单次伤害硬上限, 单刀上限, 单刀顶, 单次硬顶, 单刀截断, 实际伤害,
  伤害结算, 怪词条
};



// ---------- 2.9.6：信用 / 贷款 / 世界资金 测试钩子（t-296.mjs 专用） ----------
export const __credit296 = {
  常量: () => ({ 信用默认, 信用上限, 贷款最高额, 贷款每分额度, 贷款小时利率, 贷款最久毫秒, 世界资金初始, 捐款加分单位, 捐款单次加分上限 }),
  取信用分, 加信用分, 贷款额度, 读贷款, 写贷款, 贷款计息, 结算逾期, 贷款概况,
  读世界资金, 加世界资金, 资金见底, 官方群链接, 补货提示, 扣世界资金, 信用拦截, 信用零放行
};



// ---------- 2.9.8：商店无上限 / 词条激活 / PVP / 打工 / 奖励分 / 农田 测试钩子（t-298.mjs 专用） ----------
export const __x298 = {
  购买数量,
  词条: { 激活玩家词条, 撤销玩家词条, 玩家激活词条, 词条汇总 },
  pvp: { PVP全表, PVP找会话, PVP进行中, gid, byGid },
  钱包: { addCoin, 读金币: (c, u) => dn(c, P.金币, u, 0), 设金币: (c, u, v) => dset(c, P.金币, u, v), 读星羽: (c, u) => dn(c, P.星羽, u, 0), 设星羽: (c, u, v) => dset(c, P.星羽, u, v) },
  打工: { 基础低: 900, 基础高: 1800, 每级: 80 },
  奖励分: { 取奖励分, 上限: 奖励分上限, 步长: 奖励分步长, 星羽: 奖励星羽, 星核: 奖励星核, 幸运币: 奖励幸运币 },
  信用每日: { 信用每日上限, 奖励分每日上限, 日取量, 设信用分: (c, u, v) => dset(c, P.信用分, u, Math.max(0, Math.min(信用上限, Math.floor(Number(v) || 0)))), 清今日: (c, u) => dset(c, P.每日进度(ymd()), u, {}) },
  娱乐: { 探索每日上限, 钓鱼每日上限 },
  农场: { 读农田等级, 农田产量倍率, 农田升级费, 农田升级最大, 农场地块上限, 农场地块起步, 农场地块最大, 农场解锁间隔, 农场等级上限, 读农场, 读农场成长 }
};



// ---------- 2.9.9：股票 / 世界资金 / 管理接口 测试钩子（t-299.mjs 专用） ----------
export const __x299 = {
  股票: { 股票表, 股票tick, 股票行情, 存股票行情, 读股票持仓, 存股票持仓, 股票买入, 股票卖出, 股事件, 股票派息, 迁移旧基金, 股票单次涨跌停, 股票停牌阈值, 股票派息毫秒, 股票跳间隔毫秒, 设股票上下限, 读股票上下限 },
  经济: { 读世界资金, 加世界资金, 扣世界资金, 加世界资金Async, 扣世界资金Async, 串行锁, 设世界资金: (c, v) => dset(c, P.世界资金, "当前", Math.max(0, Math.floor(Number(v) || 0))), 细分倍率, 奖励倍率 },
  玩家: { addCoin, 读星羽: (c, u) => dn(c, P.星羽, u, 0), 设星羽: (c, u, v) => dset(c, P.星羽, u, v), gid, byGid, players }
};



// ---------- 2.9.2：P4~P6 收尾测试钩子（t-death.mjs / t-entries.mjs 专用，只读，不影响运行时） ----------
export const __final9 = {
  尝试复活, 自动服药, 药品集, 药品回血,
  全部装备, 装备表, 专属装备表, 称号表, 星灵词条, 怪词条, 词条上限, BOSS词条档, attrs, 词条汇总,
  // P9 系统称号钩子（t-titles.mjs）
  系统称号表, 系统称号列表, 授系统称号, 系统称号巡检, 系统称号效果, 系统称号稀有度, 称号倍, gid
};



// ---------- 2.9.10：探索/钓鱼上限 / 分隔符归一 测试钩子（t-300.mjs 专用） ----------
export const __x300 = {
  归一分隔符, EXP_MAX, FISH_MAX,
  信用: { 信用每日上限, 奖励分每日上限, 日取量, 加信用分, 取信用分, 取奖励分, 设信用分: (c, u, v) => dset(c, P.信用分, u, Math.max(0, Math.min(信用上限, Math.floor(Number(v) || 0)))), 清今日: (c, u) => dset(c, P.每日进度(ymd()), u, {}) },
  股票: { 股票表, 股票行情, 存股票行情, 股事件, 读股票上下限, 设股票上下限, 股票跳间隔毫秒 },
  钱: { addCoin, 读星羽: (c, u) => dn(c, P.星羽, u, 0), 设星羽: (c, u, v) => dset(c, P.星羽, u, v), 读世界资金, 设世界资金: (c, v) => dset(c, P.世界资金, "当前", Math.max(0, Math.floor(Number(v) || 0))) },
  血: { 设血量: (c, u, v) => dset(c, P.血量, u, Math.max(0, Math.floor(Number(v) || 0))), 设血量上限: (c, u, v) => dset(c, P.血量上限, u, Math.max(1, Math.floor(Number(v) || 0))) },
  娱乐: { 娱乐已用, 娱乐冷却余 }
};



// ---------- 2.9.11：更新公告分页 测试钩子（t-301.mjs 专用；2.9.13 总览界面后仅保留仍在用的导出） ----------
export const __x301 = { 读公告, 公告拆段, 公告每页条数, 公告拆段字数, 版本 };



// ---------- 2.9.12：十项更新 测试钩子（t-302.mjs 专用） ----------
export const __x302 = {
  版本,
  贷款: { 贷款最久毫秒, 读贷款, 贷款计息, 贷款概况, 取信用分, 加信用分, 取奖励分, 设信用分: (c, u, v) => dset(c, P.信用分, u, Math.max(0, Math.min(信用上限, Math.floor(Number(v) || 0)))) },
  药水: { 掉生长药水, 生长药水日购限, 生长药水日掉限, 生长药水今日已购, 生长药水今日已掉, 催熟, 读农场, 存农场 },
  boss: { BOSS表, BOSS真伤加成, BOSS特殊属性表, BOSS特殊属性, BOSS战备, BOSS词条档, 副本基准属性 },
  战报: { 我方出手, 伤害结算, 大数, 词条上限 }
};



// ---------- 2.9.13：修复 + 新税制 + 并发 + 公告总览 测试钩子（t-303.mjs 专用） ----------
export const __x303 = {
  版本,
  背包: { giveItem, hasItem },
  交易行: { hallList, hallSave, 交易行上架税率, 交易行购买税率, 交易行每页条数 },
  词条: { 词条面板文本, 词条定义, 玩家可用词条键 },
  经济: { 读世界资金, 加世界资金, 扣世界资金, 加世界资金Async, 扣世界资金Async, 串行锁, 设世界资金: (c, v) => dset(c, P.世界资金, "当前", Math.max(0, Math.floor(Number(v) || 0))) },
  钱: { addCoin, 读星羽: (c, u) => dn(c, P.星羽, u, 0), 设星羽: (c, u, v) => dset(c, P.星羽, u, v) }
};



// ---------- 旧版 API 兼容别名（旧代码/其他插件若引用这些名字可直接用） ----------
export const BOTAPI = api;


export const md图片行 = mdImg;


export const md指令输入 = cmdInput;


export const 提取纯文本 = PT;


export const 撤回消息 = delMsg;


export const 回应互动 = ack;


export const 发消息 = sendSegs;


export const 取按钮数据 = interBtn;


export const 取互动目标 = interTarget;


export const 取发送目标 = targetOf;


export const 取用户Id = uid;
