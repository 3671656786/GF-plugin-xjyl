// lib/core/util.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S } from "././base.mjs?v=v1795174016938";


export const P = {
  开号: "游戏数据/是否开号.json",
  游戏ID: "游戏数据/游戏ID.json",
  账号总数: "游戏数据/账号总数.json",
  昵称: "游戏数据/星舰数据/昵称.json",
  星羽: "游戏数据/星舰数据/星羽.json",
  存款: "游戏数据/星舰数据/存款-星羽.json",
  星核: "游戏数据/星舰数据/星核.json",
  贡献: "游戏数据/星舰数据/联盟贡献.json",
  血量: "游戏数据/星舰数据/血量.json",
  血量上限: "游戏数据/星舰数据/血量上限.json",
  暴击: "游戏数据/星舰数据/暴击.json",
  闪避: "游戏数据/星舰数据/闪避.json",
  战力: "游戏数据/星舰数据/总评分.json",
  等级: "游戏数据/星舰数据/等级.json",
  经验: "游戏数据/星舰数据/经验.json",
  转生: "游戏数据/星舰数据/转生次数.json",
  强化: "游戏数据/星舰数据/强化等级.json",
  攻击: "游戏数据/星舰数据/攻击力.json",
  防御: "游戏数据/星舰数据/防御力.json",
  暴击率: "游戏数据/星舰数据/暴击率.json",
  暴伤: "游戏数据/星舰数据/暴击伤害.json",
  // 2.9.2（需求 5）：控制台「真伤概率」的底值存档（默认 0，只由主人/后台写入；
  //   与装备词条相加后统一走 词条汇总()，战斗里 p.真伤概率 直接生效）
  真伤概率: "游戏数据/星舰数据/真伤概率.json",
  装备槽: "游戏数据/星舰数据/装备槽.json",
  背包: "游戏数据/星甲背包/物品.json",
  修甲状态: "游戏数据/星舰数据/战甲修复/记录状态.json",
  修甲时间: "游戏数据/星舰数据/战甲修复/记录时间.json",
  修复速度: "游戏数据/星舰数据/战甲修复/修复速度.json",
   打坐: "游戏数据/修炼/打坐.json",
  金币: "游戏数据/星舰数据/金币.json",
  装备升级: "游戏数据/星甲背包/装备升级.json",
  装备加点: "游戏数据/星甲背包/装备加点.json",
  战斗: "游戏数据/副本/战斗.json",
  挑战次数: "游戏数据/副本/挑战次数.json",
  挑战冷却: "游戏数据/副本/挑战冷却.json",
  BOSS保底: "游戏数据/副本/BOSS保底.json",
  操作冷却: "游戏数据/副本/操作冷却.json",
  出招冷却: "游戏数据/副本/出招冷却.json",
  打劫冷却: "游戏数据/星舰数据/打劫/冷却.json",
  出招记录: "游戏数据/副本/出招记录.json",
  修改记录: "系统/属性修改.json",
  退级冷却: "游戏数据/星舰数据/退级冷却.json",
  // 3.0.0（需求 4.4）：自动回血开关，默认开启（关闭后战斗中不再自动嗑药）
  自动回血: "游戏数据/星舰数据/自动回血.json",
  队伍: "游戏数据/副本/队伍.json",
  副本进度: "游戏数据/星舰数据/副本进度.json",
  副本首通: "游戏数据/星舰数据/副本首通.json",
  联盟: "游戏数据/星舰数据/联盟.json",
  联盟数据: "游戏数据/星舰系统/联盟数据.json",
  时空位置: "游戏数据/星舰数据/时空门/位置.json",
  时空冷却: "游戏数据/星舰数据/时空门/冷却.json",
  签到日期: "游戏数据/签到系统/签到时间.json",
  连签: "游戏数据/签到系统/连签次数.json",
  超能力: "游戏数据/超能力/状态.json",
  超能力记录: "游戏数据/超能力/记录.json",
  打工冷却: "游戏数据/星舰数据/打工/冷却.json",
  转盘日期: "游戏数据/星舰数据/天选转盘/日期.json",
  昵称记录: "昵称记录/记录.json",
  联盟战: "联盟战/记录.json",
  基金净值: "金融市场/净值.json",
  基金刷新: "金融市场/刷新.json",
  基金成本: "金融市场/成本.json",
  // 2.9.9（需求 E）：10 只股票（行情 / 持仓 / 分红计时 / 事件节流；旧基金份额档保留做迁移源）
  股票行情: "金融市场/股票行情.json",
  股票持仓: "金融市场/股票持仓.json",
  股票分红: "金融市场/分红.json",
  股票事件: "金融市场/事件冷却.json",
  交易行: "交易行/上架.json",
  交易行序号: "交易行/序号.json",
  存款时间: "游戏数据/星舰数据/存款时间.json",
  商品价格: "游戏数据/商店系统/道具价格.json",
  主人名单: "系统/主人名单.json",
  称号: "系统/称号.json",
  系统称号: "系统/系统称号.json",
  星灵: "游戏数据/星灵/状态.json",
  悬赏: "任务系统/悬赏.json",
  封禁名单: "系统/封禁名单.json",
  操作日志: "系统/管理日志.json",
  天下楼: "游戏数据/天下楼/进度.json",
  每日上限: "任务系统/每日属性上限.json",
  溢出水位: "游戏数据/星舰数据/溢出转经验.json",
  道具清理标记: "游戏数据/星舰数据/道具清理标记.json",
  已移除道具回收: "游戏数据/星舰数据/已移除道具回收/",
  农场: "游戏数据/农场/地块.json",
  农场成长: "游戏数据/农场/成长.json",
  赌场每日: "游戏数据/赌场/每日.json",
  自动战斗: "游戏数据/副本/自动出招状态.json",
  自动战斗索引: "游戏数据/副本/自动出招索引.json",
  入群欢迎: "系统/入群欢迎.json",
  最近消息: "系统/最近消息.json",
  每日进度: (d) => "任务系统/每日任务/" + d + "❂完成.json",
  每日领奖: (d) => "任务系统/每日任务/" + d + "❂领奖.json",
  指引已领: "新手指引/已领.json",
  道具: (name) => "游戏数据/星舰数据/道具/" + name + ".json",
  音乐音源: "音乐/默认音源.json",
  音乐歌单: "音乐/搜索结果.json",
  音乐收藏: "音乐/收藏.json",
  属性迁移标记: "游戏数据/星舰数据/属性迁移标记.json",
  装备槽迁移标记: "游戏数据/星舰数据/装备槽迁移标记.json",
  控制台锁定: "系统/控制台登录锁定.json",
  // 2.9.3：控制台登录会话（token → {过期, ip, 最近}），插件重载后仍有效
  控制台会话: "系统/控制台会话.json",
  // 2.9.4（需求 5）：探索 / 钓鱼的独立冷却（键 = openid_探索 / openid_钓鱼）
  娱乐冷却: "游戏数据/娱乐/探索钓鱼冷却.json",
  // 2.9.8（需求 1）：管理员手动激活的「敬请期待」词条（键 = 玩家 openid，值 = { 词条键: 数值 }）
  激活词条: "系统/激活词条.json",
  // 2.9.8（需求 3）：玩家挑战 PVP 会话（{ 会话: { [id]: 会话 }, 待定: { [目标openid]: 会话id } }）
  PVP挑战: "系统/PVP挑战.json",
  // 2.9.6（需求 8/9/11）：信用分 / 贷款 / 事件流水 / 世界资金（都存在 dataPath，插件目录不落盘）
  // 2.9.8（需求 9）：农田升级 —— 存档路径（{ [openid]: [地块等级…] }）
  农田升级: "游戏数据/农场/地块等级.json",
  信用分: "游戏数据/信用/信用分.json",
  // 2.9.8（需求 5）：奖励分（主分满 100 后溢出的加分；键 = 玩家 openid）
  奖励分: "游戏数据/信用/奖励分.json",
  贷款: "游戏数据/信用/贷款.json",
  信用事件: "游戏数据/信用/事件.json",
  世界资金: "系统/世界资金.json",
  // 2.9.10（需求 1）：股票管理员价格上下限（键 = 股票代码，值 = { 上, 下 }，0 = 不设；仅管理员可见）
  股票上下限: "系统/股票上下限.json"
};


/* ---------- 2.8.0：旧存档字段（只在迁移里读，业务代码一律用 P.血量 / P.血量上限 / P.攻击） ----------
 * · 火力.json → 已并入 攻击力.json（攻击 = 原攻击 + 火力，之后火力清零）
 * · 耐久.json / 耐久上限.json → 已改名为 血量.json / 血量上限.json
 */
export const P旧 = {
  火力: "游戏数据/星舰数据/火力.json",
  血量: "游戏数据/星舰数据/耐久.json",
  血量上限: "游戏数据/星舰数据/耐久上限.json"
};



/* ============================================================
 * 三、发送层（消息段 / 键盘 / 富媒体）
 * ============================================================ */
export function uid(event) {
  const a = (event && event.author) || {};
  const d = (event && event.d) || {};
  // 2.7.1 修复：群成员进出事件（GROUP_MEMBER_ADD/REMOVE）的 openid 在顶层 member_openid /
  //   op_member_openid，也可能在 d 里，原来只读 user_openid/group_member_openid/author.* → 显示「未知」
  return S(
    (event && (event.user_openid || event.group_member_openid || event.member_openid || event.op_member_openid))
    || a.user_openid || a.member_openid
    || d.member_openid || d.op_member_openid || d.user_openid
  );
}


export function uname(event) {
  const a = (event && event.author) || {};
  return S(a.username) || "新兵";
}


export function isGm(event) {
  const a = (event && event.author) || {};
  const r = S(a.member_role).toLowerCase();
  return r === "owner" || r === "admin";
}


// 蓝色艾特（参考 GF-plugin-xinjia）：取被点击 / 发言者的 openid，用于 Markdown `<@openid>` 前缀
export function 取艾特(event) {
  const a = (event && event.author) || {};
  return S((event && (event.group_member_openid || event.user_openid)) || a.member_openid || a.user_openid);
}


export function targetOf(event) {
  const t = S(event && event.t);
  const g = S((event && (event.group_openid || event.group_id)));
  const u = uid(event);
  const id = S(event && event.id);
  const m = 取艾特(event);
  if (t.indexOf("GROUP") >= 0 || g) return { scope: "group", group_openid: g, user_openid: u, event_id: id, mention_openid: m };
  return { scope: "c2c", user_openid: u, event_id: id, mention_openid: m };
}


export function interTarget(event) {
  const d = (event && event.data) || {};
  const r = d.resolved || d.resoloved || {};
  const a = (event && event.author) || {};
  const ct = Number(d.chat_type || 0);
  const sc = S(d.scene);
  // 群 openid 可能出现在 payload、data 或事件顶层
  const g = S(d.group_openid || d.group_open_id || (event && (event.group_openid || event.group_open_id)));
  // 点击者的 openid：依次尝试 resolved / data / 事件顶层 / author（按钮回调里 author 通常是有的）
  const u = S(
    r.user_openid || r.member_openid || d.user_openid || d.openid ||
    (event && (event.user_openid || event.group_member_openid)) ||
    a.user_openid || a.member_openid
  );
  const iid = S((event && event.id) || d.id);
  // 2.5.29：互动事件的 id 既是 interaction_id，**也可作 event_id 做被动回复**
  //   （手册 §10.2）—— 补上 event_id，让点击 ⚡ 按钮的回复走被动消息，不再依赖「主动消息」权限。
  if (ct === 1 || sc === "group" || g) {
    return { scope: "group", group_openid: g, user_openid: u, interactionId: iid, event_id: iid, mention_openid: u };
  }
  return { scope: "c2c", user_openid: u, interactionId: iid, event_id: iid, mention_openid: u };
}


export function interBtn(event) {
  if (S(event && event.t) !== "INTERACTION_CREATE") return null;
  const d = (event && event.data) || {};
  const r = d.resolved || d.resoloved;
  if (!r) return null;
  const data = S(r.button_data);
  const id = S(r.button_id);
  if (!data && !id) return null;
  return { id: id, data: data };
}
