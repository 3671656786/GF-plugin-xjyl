// lib/admin/group-mgr.mjs —— 3.1.19：群管功能（仿照示例机器人）
//  · 群管帮助：标题正常黑字 + 说明灰字块（层次分明）
//  · 入群申请列表：正常字体 + 黑字混用，支持单个 / 批量同意拒绝
//  · 进退群通知开关（复用 P.入群欢迎）、禁言 / 解禁 / 禁言状态、撤回消息
//  · 入群申请来自 GROUP_JOIN_REQUEST 事件（由 hooks.plugin_onevent 调 记录入群申请 落入本地存档）
import { S, dget, dset } from "./../core/base.mjs?v=v1795239977648";
import { reply, row, btn, actBtn, api, 蓝字 } from "./../core/qq.mjs?v=v1795239977648";
import { P, uid } from "./../core/util.mjs?v=v1795239977648";

// 自己的存档路径（不入 P 常量，避免动核心）
const 档入群申请 = "游戏数据/群管/入群申请.json";
const 档群管配置 = "游戏数据/群管/配置.json";
const 申请保留上限 = 100;
// reply 已自动加蓝色艾特，正文里只留一个空占位（保持原来的文案拼接结构）
const blueAt = () => "";

/* ============================================================
 * 一、入群申请存档
 * ============================================================ */
export function 读申请(ctx) {
  const v = dget(ctx, 档入群申请, "列表", []);
  return Array.isArray(v) ? v : [];
}
export function 写申请(ctx, 列表) { dset(ctx, 档入群申请, "列表", (列表 || []).slice(0, 申请保留上限)); }

// 由 plugin_onevent 收到 GROUP_JOIN_REQUEST 时调用 —— 记录 flag / 申请人 / 留言
export async function 记录入群申请(ctx, event) {
  const g = S(event && event.group_openid);
  const flag = S(event && (event.flag || event.request_flag || event.id));
  if (!g) return;
  const 列 = 读申请(ctx);
  const 人 = uid(event) || S(event && event.user_openid) || "未知";
  const 昵称 = S(event && (event.nickname || event.nick)) || 人;
  const 留言 = S(event && (event.comment || event.message || event.reason)) || "";
  // 同一 flag 去重（事件可能重投）
  if (flag && 列.some((x) => S(x.flag) === flag && S(x.状态) === "待处理")) return;
  列.unshift({
    编号: (列[0] && Number(列[0].编号) || 0) + 1,
    flag: flag, 群: g, 人: 人, 昵称: 昵称, 留言: 留言,
    时间: Date.now(), 状态: "待处理"
  });
  写申请(ctx, 列);
  if (ctx && ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 收到入群申请：" + 昵称 + "（" + 人 + "）留言：" + 留言);
}

function 改申请状态(ctx, 编号, 状态) {
  const 列 = 读申请(ctx);
  const it = 列.find((x) => Number(x.编号) === Number(编号));
  if (!it) return null;
  it.状态 = 状态;
  it.处理时间 = Date.now();
  写申请(ctx, 列);
  return it;
}

/* ============================================================
 * 二、宿主 API：处理入群申请 / 禁言
 * ============================================================ */
async function 处理申请(ctx, flag, 同意, 理由) {
  if (!flag) return { ok: false, 原因: "申请已失效（无 flag）" };
  try {
    // 宿主 registry 的 action 名；无 SDK 时以原生 set_group_add_request 兜底
    const params = { flag: S(flag), approve: !!同意 };
    if (!同意) params.reason = S(理由) || "不符合入群条件";
    let r = null;
    try { r = await api(ctx, "handle_group_add_request", params); }
    catch (e1) { r = await api(ctx, "set_group_add_request", params); }
    const ok = !r || r.status !== "failed" && r.retcode !== 1400 && r.retcode !== 1200;
    return { ok: ok, 返回: r };
  } catch (e) {
    return { ok: false, 原因: (e && e.message) || String(e) };
  }
}

async function 调禁言(ctx, 路径, 参数) {
  try { return { ok: true, 数据: await api(ctx, 路径, 参数) }; }
  catch (e) { return { ok: false, 原因: (e && e.message) || String(e) }; }
}

/* ============================================================
 * 三、命令入口
 * ============================================================ */
// 3.1.20：仿示例机器人的「群管功能」主菜单 —— 6 大板块，标题正常黑字、说明灰字、蓝字「发送 XXX 查看」
export async function 群管帮助(ctx, t, u) {
  const 看 = (cmd, 显示) => 蓝字(cmd, "发送 " + (显示 || cmd) + " 查看");
  await reply(ctx, t, [
    "## 群管功能",
    "",
    "**基础群管**",
    "> 踢人、禁言、解除禁言、禁言列表、取QQ、绑定账号",
    "> " + 看("基础群管"),
    "",
    "**入群验证**",
    "> 新成员入群答题验证",
    "> " + 看("入群验证"),
    "",
    "**撤回系统**",
    "> 撤回链接 / 图片 / 视频 / 文件 / 卡片 / 聊天记录，可加禁言",
    "> " + 看("撤回系统"),
    "",
    "**违禁系统**",
    "> 违禁词管理（添加 / 删除 / 清空），命中自动撤回",
    "> " + 看("违禁系统"),
    "",
    "**运营数据**",
    "> 群聊数、激活 / 主动 / 消息权限、验证 / 撤回 / 违禁开启数、运行时长",
    "> " + 看("运营数据") + "（所有人可用）",
    "",
    "**入群审核**",
    "> 申请入群自动记录，支持单个 / 批量同意拒绝",
    "> " + 看("入群审核"),
    "",
    "> —— 仅群主 / 管理员可操作；账号保存暂未开放。"
  ].join("\n"), {
    标题: "🛡️ 群管功能",
    行组: [
      row(btn("gq1", "基础群管", "基础群管"), btn("gq2", "入群审核", "入群审核")),
      row(btn("gq3", "违禁系统", "违禁系统"), btn("gq4", "运营数据", "运营数据"))
    ]
  });
}

// 板块详情：基础群管（踢人/禁言/取QQ/绑定账号）
export async function 基础群管(ctx, t, u) {
  await reply(ctx, t, [
    "## 基础群管",
    "",
    "**踢人 / 移出**",
    "> 官方机器人接口未开放踢人，需群主 / 管理员在群内手动操作。",
    "",
    "**禁言 / 解除禁言**",
    "> `禁言 <QQ号> <分钟>`（可艾特目标）· `解禁 <QQ号>` · `禁言状态`",
    "> " + 蓝字("禁言状态", "查看禁言状态"),
    "",
    "**取QQ / 绑定账号**",
    "> 账号保存暂未开放（还没找到可靠方法），敬请期待。",
    "",
    "> 禁言类操作受 QQ 官方接口权限限制，失败会提示原因。"
  ].join("\n"), {
    标题: "🛡️ 基础群管",
    行组: [row(btn("gb1", "群管功能", "群管帮助"), btn("gb2", "禁言状态", "禁言状态"))]
  });
}

// 板块详情：入群验证（答题验证，账号绑定暂未开放）
export async function 入群验证(ctx, t, u) {
  await reply(ctx, t, [
    "## 入群验证",
    "",
    "**新成员答题验证**",
    "> 新成员入群后需答对问题才放行 —— 该功能依赖账号绑定，暂未开放。",
    "> " + 蓝字("进退群通知 开启", "开启进退群通知") + " 可先开着，掌握成员进出。",
    "",
    "> 当前可用的进群管理：`入群审核`（审批入群申请）、`入群欢迎`（进退群提示）。"
  ].join("\n"), {
    标题: "🛡️ 入群验证",
    行组: [row(btn("gv1", "群管功能", "群管帮助"), btn("gv2", "入群审核", "入群审核"))]
  });
}

// 板块详情：撤回系统
export async function 撤回系统(ctx, t, u) {
  await reply(ctx, t, [
    "## 撤回系统",
    "",
    "**撤回消息**",
    "> 回复 / 引用目标消息后发 `撤回`，可撤回链接 / 图片 / 视频 / 文件 / 卡片 / 聊天记录。",
    "> 限 2 分钟内；机器人自己发的消息随时可撤。",
    "> " + 蓝字("撤回上一条", "撤回上一条"),
    "",
    "**格式**",
    "> `撤回#消息ID` 按 ID 撤回；或 `撤回` 撤最近一条。",
    "",
    "> 撤回他人消息需机器人具备群管权限。"
  ].join("\n"), {
    标题: "🛡️ 撤回系统",
    行组: [row(btn("gk1", "群管功能", "群管帮助"), btn("gk2", "撤回上一条", "撤回上一条"))]
  });
}

// 板块详情：违禁系统（违禁词管理，本地存档；命中自动撤回）
const 档违禁词 = "游戏数据/群管/违禁词.json";
function 读违禁词(ctx, g) { const v = dget(ctx, 档违禁词, g, []); return Array.isArray(v) ? v.map((x) => S(x)).filter(Boolean) : []; }
function 写违禁词(ctx, g, 列) { dset(ctx, 档违禁词, g, (列 || []).slice(0, 200)); }

export async function 违禁系统(ctx, t, u, 参数) {
  const g = S(t && t.group_openid);
  const s = S(参数).trim();
  const m = s.match(/^(添加|加|删除|删|清空)\s*(.*)$/);
  if (m && g) {
    const 词 = m[2].trim();
    const 列 = 读违禁词(ctx, g);
    if (m[1] === "清空") { 写违禁词(ctx, g, []); }
    else if ((m[1] === "添加" || m[1] === "加") && 词) { if (列.indexOf(词) < 0) 列.push(词); 写违禁词(ctx, g, 列); }
    else if ((m[1] === "删除" || m[1] === "删") && 词) { 写违禁词(ctx, g, 列.filter((x) => x !== 词)); }
  }
  const 列 = g ? 读违禁词(ctx, g) : [];
  await reply(ctx, t, [
    "## 违禁系统",
    "",
    "**违禁词管理**",
    "> 命中违禁词的群消息会自动撤回（需机器人群管权限）。",
    "> 添加：`违禁系统 添加 <词>` · 删除：`违禁系统 删除 <词>` · 清空：`违禁系统 清空`",
    "",
    "**当前违禁词（" + 列.length + "）**",
    ...(列.length ? 列.slice(0, 30).map((x, i) => "> " + (i + 1) + ". " + x) : ["> （暂无，用上面的命令添加）"]),
    "",
    "> 自动撤回需机器人具备群管权限；仅在本群生效。"
  ].join("\n"), {
    标题: "🛡️ 违禁系统",
    行组: [row(btn("gc1", "群管功能", "群管帮助"), btn("gc2", "添加示例词", "违禁系统 添加 广告"))]
  });
}

// 板块详情：运营数据
export async function 运营数据(ctx, t, u) {
  const 申请 = 读申请(ctx).filter((x) => S(x.状态) === "待处理").length;
  const g = 群号(t);
  const wel = g ? S(dget(ctx, P.入群欢迎, g, "开启")) !== "关闭" : false;
  await reply(ctx, t, [
    "## 运营数据",
    "",
    "**本群状态**",
    "> 进退群通知：**" + (wel ? "开启" : "关闭") + "** · 待审入群申请：**" + 申请 + "** 条",
    "> " + 蓝字("入群审核", "查看入群审核"),
    "",
    "**运行时长**",
    "> 插件运行正常，后台时钟（宠物 / 战斗 / 股票）均在运行。",
    "",
    "> 本面板所有人可用；具体操作仅限群主 / 管理员。"
  ].join("\n"), {
    标题: "📊 运营数据",
    行组: [row(btn("go1", "群管功能", "群管帮助"), btn("go2", "入群审核", "入群审核"))]
  });
}

// 入群审核 = 入群申请列表（保留原函数名兼容）
export async function 入群审核面板(ctx, t, u) { return 入群申请列表(ctx, t, u); }

// 入群申请列表：正常字体 + 黑字（加粗）混用，不整段灰字
export async function 入群申请列表(ctx, t, u) {
  const 列 = 读申请(ctx).filter((x) => S(x.状态) === "待处理");
  if (!列.length) {
    await reply(ctx, t, [
      "## 入群申请列表",
      blueAt(u) + " 当前**没有待处理的入群申请**。",
      "",
      "> 有人申请时会自动记录到这里，发 `入群申请列表` 查看。"
    ].join("\n"), {
      标题: "📋 入群申请", 行组: [row(btn("gl0", "群管帮助", "群管帮助"), btn("gl1", "群管面板", "群管"))]
    });
    return;
  }
  const 行 = [
    "## 入群申请列表",
    blueAt(u) + " 共 **" + 列.length + "** 条待处理申请：",
    ""
  ];
  for (const it of 列.slice(0, 20)) {
    const 号 = Number(it.编号) || 0;
    // 正常字：昵称 + 编号；黑字（**）：申请人 ID 与留言
    const 留言 = it.留言 ? " · 留言：**" + S(it.留言) + "**" : "";
    行.push("**" + 号 + ".** " + S(it.昵称 || it.人) + "（**" + S(it.人) + "**）" + 留言
      + "　" + actBtn("ga" + 号, "✅同意", "同意入群申请|" + 号)
      + " " + actBtn("gr" + 号, "❌拒绝", "拒绝入群申请|" + 号));
  }
  if (列.length > 20) 行.push("> 仅显示前 20 条，其余用批量命令处理。");
  行.push("");
  行.push("> 批量：`批量同意入群 1,2,3` / `批量拒绝入群 1,2,3`；全部：`全部同意入群` / `全部拒绝入群`");
  await reply(ctx, t, 行.join("\n"), {
    标题: "📋 入群申请",
    行组: [
      row(actBtn("gba", "✅全部同意", "全部同意入群"), actBtn("gbr", "❌全部拒绝", "全部拒绝入群")),
      row(btn("gbh", "群管帮助", "群管帮助"), btn("gbp", "群管面板", "群管"))
    ]
  });
}

// 单个同意 / 拒绝
export async function 处理单条入群(ctx, t, u, 编号, 同意) {
  const it = 改申请状态(ctx, 编号, 同意 ? "已同意" : "已拒绝");
  if (!it) {
    await reply(ctx, t, "没有编号 **" + S(编号) + "** 的待处理申请，发 `入群申请列表` 看编号。", {
      标题: "❌ 处理失败", 行组: [row(btn("gs1", "申请列表", "入群申请列表"))]
    });
    return;
  }
  const r = await 处理申请(ctx, it.flag, 同意);
  if (!r.ok) { 改申请状态(ctx, 编号, "待处理"); }
  await reply(ctx, t, [
    "## " + (同意 ? "同意入群" : "拒绝入群"),
    + (r.ok ? "已" : "尝试") + (同意 ? "同意" : "拒绝") + " **" + S(it.昵称 || it.人) + "**（编号 " + 编号 + "）的入群申请。",
    "",
    r.ok ? "> 操作成功。" : "> 操作可能未成功：" + S(r.原因 || "接口返回失败") + "（状态已回滚，可重试）"
  ].join("\n"), {
    标题: (同意 ? "✅ 已同意" : "❌ 已拒绝") + "入群",
    行组: [row(btn("gn1", "申请列表", "入群申请列表"), btn("gn2", "群管帮助", "群管帮助"))]
  });
}

// 批量同意 / 拒绝：编号列表 或 全部
export async function 批量处理入群(ctx, t, u, 参数, 同意) {
  const 原 = S(参数).trim();
  const 列 = 读申请(ctx).filter((x) => S(x.状态) === "待处理");
  if (!列.length) {
    await reply(ctx, t, "当前没有待处理的入群申请。", { 标题: "📋 批量处理", 行组: [row(btn("gb1", "群管帮助", "群管帮助"))] });
    return;
  }
  let 目标 = [];
  if (/^(全部|所有|all)$/i.test(原)) 目标 = 列;
  else {
    const 号集 = 原.split(/[,，\s、]+/).map(Number).filter((x) => x > 0);
    if (!号集.length) {
      await reply(ctx, t, "用法：`批量同意入群 1,2,3` 或 `全部同意入群`。发 `入群申请列表` 看编号。", {
        标题: "📋 批量处理", 行组: [row(btn("gb2", "申请列表", "入群申请列表"))]
      });
      return;
    }
    目标 = 列.filter((x) => 号集.indexOf(Number(x.编号)) >= 0);
  }
  if (!目标.length) {
    await reply(ctx, t, "没找到这些编号的待处理申请，发 `入群申请列表` 看编号。", {
      标题: "📋 批量处理", 行组: [row(btn("gb3", "申请列表", "入群申请列表"))]
    });
    return;
  }
  let 成功 = 0, 失败 = 0;
  for (const it of 目标) {
    改申请状态(ctx, it.编号, 同意 ? "已同意" : "已拒绝");
    const r = await 处理申请(ctx, it.flag, 同意);
    if (r.ok) 成功 += 1;
    else { 失败 += 1; 改申请状态(ctx, it.编号, "待处理"); }
  }
  await reply(ctx, t, [
    "## 批量" + (同意 ? "同意" : "拒绝") + "入群",
    blueAt(u) + " 处理 **" + 目标.length + "** 条：成功 **" + 成功 + "** · 失败 **" + 失败 + "**。",
    "",
    "> 失败的申请已回滚为待处理，可重试。发 `入群申请列表` 看剩余申请。"
  ].join("\n"), {
    标题: "📋 批量处理完成",
    行组: [row(btn("gb4", "申请列表", "入群申请列表"), btn("gb5", "群管帮助", "群管帮助"))]
  });
}

/* ============================================================
 * 四、禁言 / 解禁 / 状态 / 进退群通知
 * ============================================================ */
function 群号(t) { return S(t && t.group_openid); }

export async function 禁言成员(ctx, t, u, 参数) {
  const m = S(参数).match(/^(\S+)\s+([0-9]{1,5})$/);
  if (!m) {
    await reply(ctx, t, "用法：`禁言 <QQ号/艾特> <分钟>`，如 `禁言 123456 10`（可艾特目标）。", {
      标题: "🔇 禁言", 行组: [row(btn("gm1", "群管帮助", "群管帮助"))]
    });
    return;
  }
  const 人 = m[1].replace(/^@/, ""), 分钟 = Math.max(1, Math.min(43200, Number(m[2]) || 1));
  const r = await 调禁言(ctx, "set_group_ban", { group_id: 群号(t), user_id: 人, duration: 分钟 * 60 });
  await reply(ctx, t, [
    "## 禁言成员",
    + (r.ok ? "已对 **" + 人 + "** 禁言 **" + 分钟 + " 分钟**。" : "禁言失败：" + S(r.原因)),
    "",
    "> 需要机器人具备群管权限；QQ 官方适配器可能不支持该接口。"
  ].join("\n"), {
    标题: r.ok ? "🔇 禁言成功" : "🔇 禁言失败",
    行组: [row(btn("gm2", "禁言状态", "禁言状态"), btn("gm3", "群管帮助", "群管帮助"))]
  });
}

export async function 解禁成员(ctx, t, u, 参数) {
  const 人 = S(参数).replace(/^@/, "").trim();
  if (!人) {
    await reply(ctx, t, "用法：`解禁 <QQ号/艾特>`（可艾特目标）。", {
      标题: "🔊 解禁", 行组: [row(btn("gm4", "群管帮助", "群管帮助"))]
    });
    return;
  }
  const r = await 调禁言(ctx, "set_group_ban", { group_id: 群号(t), user_id: 人, duration: 0 });
  await reply(ctx, t, [
    "## 解除禁言",
    + (r.ok ? "已解除 **" + 人 + "** 的禁言。" : "解禁失败：" + S(r.原因))
  ].join("\n"), {
    标题: r.ok ? "🔊 解禁成功" : "🔊 解禁失败",
    行组: [row(btn("gm5", "禁言状态", "禁言状态"), btn("gm6", "群管帮助", "群管帮助"))]
  });
}

export async function 禁言状态(ctx, t, u) {
  const r = await 调禁言(ctx, "get_group_mute_list", { group_id: 群号(t) });
  const 列 = (r.数据 && (r.数据.data || r.数据)) || [];
  const 项 = Array.isArray(列) ? 列 : [];
  const 行 = [
    "## 禁言状态",
    blueAt(u) + " 本群当前被禁言 **" + 项.length + "** 人。",
    ""
  ];
  for (const x of 项.slice(0, 15)) {
    const 人 = S(x.user_id || x.uin || x.openid || "?");
    const 剩 = x.剩余时间 || x.remain || x.duration || "";
    行.push("· **" + 人 + "**" + (剩 ? "（剩 " + 剩 + "）" : ""));
  }
  if (!项.length) 行.push("> 暂无人被禁言，或接口不可用（需群管权限）。");
  await reply(ctx, t, 行.join("\n"), {
    标题: "🔇 禁言状态",
    行组: [row(btn("gm7", "群管帮助", "群管帮助"), btn("gm8", "群管面板", "群管"))]
  });
}

export async function 进退群通知开关(ctx, t, u, 参数) {
  const g = 群号(t);
  if (!g) {
    await reply(ctx, t, "进退群通知只能在群聊里设置。", { 标题: "🛡️ 进退群通知" });
    return;
  }
  const 原 = S(参数).toLowerCase();
  const 开 = /^(on|开启|打开|1|true)$/.test(原);
  const 关 = /^(off|关闭|关闭|0|false)$/.test(原);
  if (!开 && !关) {
    const 当前 = S(dget(ctx, P.入群欢迎, g, "开启")) !== "关闭";
    await reply(ctx, t, [
      "## 进退群通知",
      blueAt(u) + " 当前：**" + (当前 ? "已开启" : "已关闭") + "**",
      "",
      "> 发 `#进退群通知开启` / `#进退群通知关闭` 切换。",
      "> 也可以直接发 `入群欢迎` 切换。"
    ].join("\n"), {
      标题: "🛡️ 进退群通知",
      行组: [row(actBtn("gt1", 当前 ? "关闭" : "开启", 当前 ? "进退群通知关闭" : "进退群通知开启"), btn("gt2", "群管帮助", "群管帮助"))]
    });
    return;
  }
  dset(ctx, P.入群欢迎, g, 开 ? "开启" : "关闭");
  await reply(ctx, t, "进退群通知已" + (开 ? "开启" : "关闭") + "。", {
    标题: "🛡️ 进退群通知",
    行组: [row(btn("gt3", "群管帮助", "群管帮助"), btn("gt4", "群管面板", "群管"))]
  });
}
