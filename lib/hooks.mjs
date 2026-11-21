// lib/hooks.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { isBanned, ownerList, 写控制台配置, 同步主人配置, 读控制台配置 } from "././admin/admin.mjs?v=v1795275255862";
import { registerWebuiCanonical } from "././admin/webui.mjs?v=v1795275255862";
import { PT, S, dset, n, 最高权限者, 版本, 迁移旧数据, 默认最高权限者 } from "././core/base.mjs?v=v1795275255862";
import { 进出群提示 } from "././core/misc.mjs?v=v1795275255862";
import { 记录入群申请 } from "././admin/group-mgr.mjs?v=v1795275255862";
import { ACT, ack, active, btn, reply, row, 标记请求开始 } from "././core/qq.mjs?v=v1795275255862";
import { dispatch, onCallback } from "././core/router.mjs?v=v1795275255862";
import { P, interBtn, interTarget, targetOf, uid, uname } from "././core/util.mjs?v=v1795275255862";
import { 停止股票时钟, 停止自动时钟, 停止超时时钟, 启动股票时钟, 启动自动时钟, 启动超时时钟, 清理自动垃圾 } from "././game/combat.mjs?v=v1795275255862";
import { 迁移旧基金 } from "././game/econ.mjs?v=v1795275255862";
import { 迁移装备槽存档 } from "././game/equip.mjs?v=v1795275255862";
import { 清理已移除道具, 迁移属性字段全服, 迁移经验累计 } from "././game/player.mjs?v=v1795275255862";
import { 迁移药物改名 } from "././game/rebirth.mjs?v=v1795275255862";
import { 启动宠物时钟, 停止宠物时钟 } from "././game/pet.mjs?v=v1795275255862";
import { noteNick } from "././game/pvp.mjs?v=v1795275255862";
import { 清理重启的自动出招 } from "././ui/menu.mjs?v=v1795275255862";
// 3.2.0：绑定账号后台轮询时钟
import { 启动绑定时钟, 停止绑定时钟 } from "././admin/bind.mjs?v=v1795275255862";


export async function plugin_init(ctx) {
  // 2.6.0（需求 7）：从 GF-plugin-mk 改名过来时，把旧目录的玩家数据迁到新目录。
  //   必须放在「同步主人配置」之前 —— 后者读主人名单会顺带创建空的 tc/，让迁移误判成「已有数据」。
  try { 迁移旧数据(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 旧数据迁移失败:", e);
  }
  // 2.6.0（需求 2）：把控制台配置里的「最高权限者 / 主人名单」同步到运行时
  try { 同步主人配置(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 主人配置同步失败:", e);
  }
  // 2.8.0（需求 10 / 11）：属性字段合并 —— 火力 → 攻击力、耐久 → 血量（全服一次性，幂等）
  try { 迁移属性字段全服(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 属性字段迁移异常:", e);
  }
  // 3.0.0（需求 12）：药物改名 → 老库存并到新药名（幂等）
  try { 迁移药物改名(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 药物改名迁移异常:", e);
  }
  // 3.0.0（需求 1）：经验改累计制的一次性迁移（幂等）
  try { 迁移经验累计(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 经验累计迁移异常:", e);
  }
  // 2.9.1（F1 修复）：装备槽存档一次性修复迁移（老结构统一升级为 {名,强化}，幂等）
  try { 迁移装备槽存档(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 装备槽修复迁移异常:", e);
  }
  // 2.5.45：启动时做一次「已移除道具」的残留数据清理（幸运护符），幂等（用标记文件控制只跑一次）
  try { 清理已移除道具(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 已移除道具清理异常:", e);
  }
  // 2.6.0（需求 8）：启动时先清一次自动战斗垃圾；之后由自动时钟每小时清一次
  try { 清理自动垃圾(ctx, true); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 自动战斗垃圾清理异常:", e);
  }
  // 2.5.55：需求 B —— 重启即停止自动出招（先中断，再启动时钟，避免立刻续跑）
  try { 清理重启的自动出招(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 重启清理自动出招异常:", e);
  }
  // 2.5.54：启动「自动出招」后台时钟（每 500ms 扫一次，到点替玩家出 1 招）
  // 2.5.56：启动「挑战超时」时钟（每小时扫一次，超过 50 小时的挑战自动放弃）
  // 3.2.0（需求 2）：宠物后台时钟（实时模拟玩家收菜/种菜/收药田）
  try { 启动宠物时钟(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 宠物时钟启动失败:", e);
  }
  // 3.2.0：绑定账号轮询时钟（每 3 秒查一次登录 ticket）
  try { 启动绑定时钟(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 绑定时钟启动失败:", e);
  }
  try { 启动超时时钟(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 挑战超时时钟启动失败:", e);
  }
  try { 启动自动时钟(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 自动出招时钟启动失败:", e);
  }
  // 2.9.9（需求 E）：旧基金持仓迁移到 01 星河基金（幂等）+ 启动股票时钟
  try { const n = 迁移旧基金(ctx); if (n > 0 && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 已迁移 " + n + " 位玩家的旧基金持仓 → 01 星河基金"); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 旧基金迁移失败:", e);
  }
  try { 启动股票时钟(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 股票时钟启动失败:", e);
  }
  // 2.6.0（需求 6）：重新挂上网页控制台（路由 + 页面 + 静态资源）
  try { registerWebuiCanonical(ctx); } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 网页控制台注册失败:", e);
  }
  if (ctx.logger && ctx.logger.info) {
    ctx.logger.info("[xjyl] v" + 版本 + " 已加载（GF-plugin-xjyl · 网页控制台已启用 · 最高权限者 " + 最高权限者 + "）");
  }
}


export async function plugin_cleanup(ctx) {
  // 2.5.55（需求 B）：卸载/重载也算「重启」→ 先把进行中的自动出招标成中断，再收时钟
  try { 清理重启的自动出招(ctx); } catch (e) { /* ignore */ }
  // 2.5.54：必须收掉后台时钟，否则每次重载都会多挂一个（会把日志刷爆）
  停止自动时钟();
  try { 停止宠物时钟(); } catch (e) { /* ignore */ }
  try { 停止绑定时钟(); } catch (e) { /* ignore */ }
  停止超时时钟();
  停止股票时钟();
  if (ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 插件已卸载");
}



/* ---------- 2.6.0（需求 2）插件配置：控制台 → 插件 → GF-plugin-xjyl → 配置 ----------
 * 只放「主人」相关两项 —— 改完保存即时生效（因为导出了 plugin_set_config，
 * 宿主不会重载插件，这里直接写 config.json 并同步到运行时）。
 * 说明：字段类型必须是 string / boolean 这类表单控件；type: "text" 是纯展示，表单不会提交。
 */
export const plugin_config_ui = [
  {
    key: "最高权限者",
    type: "string",
    label: "最高权限者 openid",
    default: 默认最高权限者,
    description: "拥有全部管理权限的唯一账号。填对方的 openid（玩家发「星甲查我行」可查到自己的 openid）。留空则用出厂默认值。"
  },
  {
    key: "主人名单",
    type: "string",
    label: "追加主人（多个用逗号或换行分隔）",
    default: "",
    description: "这些 openid 会被追加为主人，可用「星甲主人菜单」里的管理指令。只增不减；要移除请用「星甲删主人#openid」或网页控制台的主人管理。"
  },
  {
    key: "控制台密码",
    type: "string",
    label: "网页控制台登录密码（初始 12345678）",
    default: "12345678",
    description: "网页控制台登录用。建议用「控制台修改密码」接口修改（需大写字母+小写字母+数字+特殊符号，长度 ≥8）。留空则用默认值。"
  },
  {
    key: "常驻公告",
    type: "string",
    label: "常驻公告（每条消息底部显示，留空关闭）",
    default: "",
    description: "会以灰色字追加在每条回复的「响应用时」下方。支持换行（用网页控制台的「常驻公告」多行框填写更方便），最多显示 5 行，超出部分截断为「…」。留空即关闭。"
  },
  {
    key: "控制台解锁IP",
    type: "string",
    label: "手动解锁的控制台 IP（留空不解锁）",
    default: "",
    description: "某 IP 连续输错密码 3 次会被锁 24 小时。把该 IP 填到这里（或填 * 解锁全部）并保存，下次 /login 时自动清除它的锁定。"
  }
];


export function plugin_get_config(ctx) {
  try { return 读控制台配置(ctx); } catch (e) { return {}; }
}


export async function plugin_set_config(ctx, next) {
  // 2.9.2：配置表单回传时若「控制台密码」为空、或仍等于初始默认值而当前已是自定义密码，
  //   视为「表单未改动密码」→ 不覆盖，否则宿主每次保存配置都会把 /password 改过的密码重置回默认。
  const 表单 = Object.assign({}, next || {});
  const 当前密码 = S(读控制台配置(ctx)["控制台密码"]) || "12345678";
  const 来的密码 = S(表单["控制台密码"]);
  if (!来的密码 || (来的密码 === "12345678" && 当前密码 !== "12345678")) delete 表单["控制台密码"];
  const 新 = 写控制台配置(ctx, 表单);
  同步主人配置(ctx);
  if (ctx && ctx.logger && ctx.logger.info) {
    ctx.logger.info("[xjyl] 主人配置已更新：最高权限者 " + 最高权限者 + " · 主人 " + ownerList(ctx).length + " 位");
  }
  return 新;
}


// 2.9.10（需求 3）：分隔符兼容 —— `#` 可用 `.`（非小数点）与空白（一个或多个，带不带空格都行）代替。
//   单点方案：先按原文解析（既有写法行为完全不变）；dispatch 未认领时再用「归一化分隔符」重试一次。
//   归一化规则：夹在数字之间的小数点保留（1.5 不拆），其余 `#` / `.` / 空白 统一成 `#`。
//   dispatch 对未识别指令无副作用（结尾 return false），重试安全，不会双重执行。
export function 归一分隔符(m) {
  let s = S(m);
  if (!s) return s;
  s = s.replace(/([0-9])\.([0-9])/g, "$1\u0001$2");   // 保护小数点
  s = s.replace(/#/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\./g, "#");                          // 剩下的点视为分隔符
  return s.replace(/\u0001/g, ".").replace(/ /g, "#");
}



export async function plugin_onmessage(ctx, event) {
  const ty = S(event && event.t);
  if (ty !== "GROUP_AT_MESSAGE_CREATE" && ty !== "GROUP_MESSAGE_CREATE" && ty !== "C2C_MESSAGE_CREATE") return;
  标记请求开始();
  const t = targetOf(event);
  const u = uid(event);
  if (!u) return;
  const ses = { event: event, 目标: t, userId: u, 昵称: uname(event) };
  if (t.scope === "group" && t.event_id) dset(ctx, P.最近消息, t.group_openid, t.event_id);
  noteNick(ctx, u, ses.昵称);
  if (isBanned(ctx, u)) {
    await reply(ctx, t, "你已被管理员封禁，暂时无法使用任何功能。", { 标题: "已被封禁" });
    return;
  }
  const raw = S(event && event.content);
  if (!raw) return;
  const msg = PT(raw);
  if (!msg) return;
  // 2.6.0（需求 1）：所有指令必须带「星甲」前缀，无例外。
  //   不带前缀的消息一律静默忽略 —— 不回复、不自动开号、也不进入任何指令判定。
  if (!/^星甲/.test(msg)) return;
  try {
    const 去前缀 = msg.replace(/^星甲[\s#：:]*/, "").trim();
    // 只发了「星甲」两个字（或只带分隔符）→ 当作主菜单
    let 已处理 = await dispatch(ctx, ses, 去前缀 || "菜单");
    // 2.9.10（需求 3）：分隔符兼容 —— 首次未认领时，用归一化分隔符（`#`/`.`/空白 统一）再试一次
    if (!已处理) {
      const alt = 归一分隔符(去前缀);
      if (alt && alt !== S(去前缀)) 已处理 = await dispatch(ctx, ses, alt);
    }
    // 2.9.12（指令连写）：单参数指令「指令+数字」连写兜底 —— 前两轮（原文 / 归一化分隔符）都未认领时，
    //   把 `贷款100000`、`背包3` 这类拆成 `贷款#100000`、`背包#3` 再试一次。
    //   拆分条件：指令部分是纯中文/英文、参数是纯数字；拆出来是否真能被认领，由 dispatch 里的
    //   单参数正则/EXACT 自己判断（未识别无副作用、结尾 return false，不会双重执行）。
    //   多参数指令不做连写（`买入 星河基金 1000` 仍需分隔符，避免股名/物品名与数字粘连无法切分）。
    if (!已处理) {
      const 连写 = S(去前缀).match(/^([\u4e00-\u9fa5A-Za-z]+)([0-9]+)$/);
      if (连写) 已处理 = await dispatch(ctx, ses, 连写[1] + "#" + 连写[2]);
    }
    // 2.6.0：带了前缀但没人认领 → 给出兜底提示（修「点了没反应」）
    if (!已处理 && !/^星甲[#\s]*[0-9]+$/.test(msg)) {
      await reply(ctx, t, [
        "没有这条指令：**" + msg + "**",
        "",
        "可能原因：指令拼写不同 / 需要参数（带 # 或数字）",
        "可以点下面的按钮，或发 `星甲完整菜单` 查看全部指令。"
      ].join("\n"), {
        标题: "❓ 未识别指令",
        行组: [
          row(btn("un1", "星甲菜单", "星甲菜单"), btn("un2", "完整菜单", "完整菜单"), btn("un3", "使用指南", "指南"), btn("un4", "星甲属性", "属性"))
        ]
      });
    }
  } catch (e) {
    if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 指令处理失败:", msg, e);
    await reply(ctx, t, "处理出错：" + (e && e.message ? e.message : String(e)) + "\n请稍后再试。", { 标题: "出错了" }).catch(() => {});
  }
}


export async function plugin_onevent(ctx, event) {
  const ty = S(event && event.t);
  if (ty === "INTERACTION_CREATE") {
    标记请求开始();
    const b = interBtn(event);
    const t = interTarget(event);
    const u = uid(event) || t.user_openid;
    if (t.interactionId) { try { await ack(ctx, t.interactionId, 0); } catch (e) { if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 互动回应失败:", e); } }
    if (!b || !u) return;
    if (isBanned(ctx, u)) return;
    const ses = { event: event, 目标: await active(t), userId: u, 昵称: uname(event) };
    let data = S(b.data);
    if (data.indexOf(ACT) === 0) data = data.slice(ACT.length);
    // 2.6.0：兼容改名前的旧按钮（mkact:），老消息里的按钮点了也还能用
    else if (data.indexOf("mkact:") === 0) data = data.slice(6);
    try { await onCallback(ctx, ses, data); }
    catch (e) { if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 按钮处理失败:", data, e); }
    return;
  }
  // 3.1.19：入群申请 → 记录到群管模块（供「入群申请列表 / 批量同意拒绝」用）
  if (ty === "GROUP_JOIN_REQUEST") { try { await 记录入群申请(ctx, event); } catch (e) { /* ignore */ } return; }
  if (ty === "GROUP_MEMBER_ADD" || ty === "GROUP_ADD_ROBOT") { await 进出群提示(ctx, event, "add"); return; }
  if (ty === "GROUP_MEMBER_REMOVE") { await 进出群提示(ctx, event, "del"); return; }
}
