// lib/admin/bind.mjs —— 3.2.0：绑定账号（QQ号 ↔ 机器人 openid）
// 流程（仿示例机器人）：发 `绑定账号 <QQ号>` → 拿登录 code → 点蓝链登录后，后台轮询
//   syncScanSateGetTicket 拿 ticket，校验 ticket.uin == 输入的 QQ 号 → 绑定成功 → 解锁群管功能。
// 官方接口（用户实测可用）：
//   GET https://q.qq.com/ide/devtoolAuth/GetLoginCode            → { code:0, data:{ code } }
//   GET https://q.qq.com/ide/devtoolAuth/syncScanSateGetTicket?code=xxx → { code:0, data:{ code, ticket?, uin? } }
import { S, ds, dset, dget, ymd, fmt } from "./../core/base.mjs?v=v1795259210803";
import { reply, row, btn, actBtn, 蓝字 } from "./../core/qq.mjs?v=v1795259210803";

const 档绑定 = "游戏数据/群管/绑定.json";       // key=QQ号 → { openid, 时间 }
const 档绑定反查 = "游戏数据/群管/绑定反查.json"; // key=openid → { qq, 时间 }
const 档待绑 = "游戏数据/群管/绑定等待.json";    // key=openid → { qq, code, 开始, 目标 }
const 超时毫秒 = 120 * 1000;
const 轮询间隔毫秒 = 3 * 1000;

// 供 group-mgr 禁言等群管功能用：QQ号 → openid
export function 读绑定(ctx, qq) {
  const v = dget(ctx, 档绑定, S(qq), null);
  return v && typeof v === "object" ? v : null;
}
export function 读绑定byOpenid(ctx, openid) {
  const v = dget(ctx, 档绑定反查, S(openid), null);
  return v && typeof v === "object" ? v : null;
}
export function 已绑定人数(ctx) {
  try {
    const all = dget(ctx, 档绑定, "", null);
    return all && typeof all === "object" ? Object.keys(all).length : 0;
  } catch (e) { return 0; }
}

async function 取登录code() {
  const r = await fetch("https://q.qq.com/ide/devtoolAuth/GetLoginCode", { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  return S(j && j.data && j.data.code);
}

async function 查ticket(code) {
  const r = await fetch("https://q.qq.com/ide/devtoolAuth/syncScanSateGetTicket?code=" + encodeURIComponent(code), { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  const d = (j && j.data) || {};
  return { ticket: S(d.ticket), uin: S(d.uin) };
}

function 登录链接(code) {
  return "https://h5.qzone.qq.com/qqq/code/" + encodeURIComponent(code) + "?_proxy=1&from=ide";
}

const AppId = "1904319717";   // 用户的机器人 AppID（用于官方头像 URL）
function 头像(qq) {
  return "https://thirdqq.qlogo.cn/qqapp/" + AppId + "/" + encodeURIComponent(S(qq)) + "/640";
}

// 主动通知用：去掉 event_id 走主动消息
function 主动目标(t) {
  const o = { scope: t && t.scope, group_openid: S(t && t.group_openid), user_openid: S(t && t.user_openid) };
  return o;
}

// 命令入口：绑定账号 <QQ号>
export async function 绑定账号(ctx, t, u, 参数) {
  const qq = S(参数).trim();
  if (!/^[0-9]{5,12}$/.test(qq)) {
    await reply(ctx, t, [
      "**格式错误！**",
      "",
      "正确用法：`星甲绑定账号 10001`（10001 换成你的 QQ 号，5~12 位数字）。"
    ].join("\n"), { 标题: "🔗 绑定账号", 行组: [row(btn("bd1", "查看已绑定", "绑定列表"))] });
    return;
  }
  const 已有 = 读绑定(ctx, qq);
  if (已有 && 已有.openid) {
    await reply(ctx, t, "> 绑定账号 " + qq + "\n\n这个 QQ 号已经绑定过了～", { 标题: "🔗 已绑定" });
    return;
  }
  const 反 = 读绑定byOpenid(ctx, u);
  if (反 && 反.qq) {
    await reply(ctx, t, "> 绑定账号\n\n你已绑定过 QQ **" + 反.qq + "**，无需重复绑定。", { 标题: "🔗 已绑定" });
    return;
  }
  let code = "";
  try { code = await 取登录code(); } catch (e) { /* code 空 */ }
  if (!code) {
    await reply(ctx, t, "获取登录凭证失败，请稍后重试。", { 标题: "🔗 绑定失败" });
    return;
  }
  // 存待绑（后台轮询用）；目标 t 只留主动发送所需字段
  const 待 = { qq: qq, code: code, 开始: Date.now(), 目标: 主动目标(t) };
  dset(ctx, 档待绑, u, JSON.stringify(待));
  const link = 登录链接(code);
  await reply(ctx, t, [
    "## 🔗 绑定账号",
    "",
    "**账号绑定仅用于获取你的 QQ 号，不具备任何用途、不会对你的账号造成任何危害，请放心登录～**",
    "",
    "请在 **120 秒**内点击下方按钮并确认登录：",
    "",
    "[点击确认登录](" + link + ")",
    "",
    "> 登录完成后会自动校验并绑定，无需再发指令。",
    "> 若长时间没反应，可发 `星甲绑定确认 ` 手动检查一次。"
  ].join("\n"), {
    标题: "🔗 绑定账号",
    行组: [row(actBtn("bd2", "我已登录·立即校验", "绑定确认"), btn("bd3", "绑定列表", "绑定列表"))]
  });
}

// 手动/回调触发一次校验；返回是否成功
export async function 校验绑定(ctx, u) {
  const raw = ds(ctx, 档待绑, u, "");
  if (!raw) return { ok: false, 原因: "没有待绑定的记录，请先发 `星甲绑定账号 <QQ号>`" };
  let 待;
  try { 待 = JSON.parse(raw); } catch (e) { return { ok: false, 原因: "记录损坏，请重新绑定" }; }
  if (Date.now() - Number(待.开始 || 0) > 超时毫秒) {
    dset(ctx, 档待绑, u, "");
    return { ok: false, 原因: "登录超时（超过 120 秒），请重新绑定" };
  }
  let 查;
  try { 查 = await 查ticket(S(待.code)); } catch (e) { return { ok: false, 原因: "校验请求失败，稍后再试" }; }
  if (!查.ticket) return { ok: false, 原因: "尚未登录，请在 120 秒内点上面的按钮登录并确认" };
  if (查.uin && 查.uin !== S(待.qq)) {
    dset(ctx, 档待绑, u, "");
    return { ok: false, 原因: "身份不符：申请人 " + 待.qq + "，登录人 " + 查.uin + "，无法绑定" };
  }
  const qq = S(待.qq);
  const 已有 = 读绑定(ctx, qq);
  if (已有 && 已有.openid) { dset(ctx, 档待绑, u, ""); return { ok: false, 原因: "该 QQ 号已绑定过" }; }
  const 反 = 读绑定byOpenid(ctx, u);
  if (反 && 反.qq) { dset(ctx, 档待绑, u, ""); return { ok: false, 原因: "你已绑定过 QQ " + 反.qq }; }
  // 写入双向绑定 + 时间
  const 时 = fmt(Date.now());
  dset(ctx, 档绑定, qq, JSON.stringify({ openid: u, 时间: 时 }));
  dset(ctx, 档绑定反查, u, JSON.stringify({ qq: qq, 时间: 时 }));
  dset(ctx, 档待绑, u, "");
  return { ok: true, qq: qq, 时间: 时 };
}

// 校验命令（玩家登录后手动点按钮/发指令也走这里）
export async function 绑定确认(ctx, t, u) {
  const r = await 校验绑定(ctx, u);
  if (!r.ok) {
    await reply(ctx, t, "> 绑定确认\n\n" + r.原因, { 标题: "🔗 绑定确认" });
    return;
  }
  await 发绑定成功(ctx, t, u, r.qq, r.时间);
}

// 发绑定成功卡（前台用被动回复，后台轮询用主动目标）
export async function 发绑定成功(ctx, t, u, qq, 时间) {
  const 人 = 已绑定人数(ctx);
  await reply(ctx, t, [
    "![" + qq + " #160px #160px](" + 头像(qq) + ")",
    "",
    "> 绑定账号 " + qq,
    "",
    "当前绑定人数 **" + 人 + "** 人",
    "数据已上传服务器！",
    "",
    "> 绑定时间：" + 时间,
    "> 现在可以使用禁言等需要 QQ 号的群管功能了。"
  ].join("\n"), { 标题: "🔗 绑定成功" });
}

export async function 绑定列表(ctx, t, u) {
  const 反 = 读绑定byOpenid(ctx, u);
  const 人 = 已绑定人数(ctx);
  await reply(ctx, t, [
    "## 🔗 绑定列表",
    "",
    "当前绑定人数 **" + 人 + "** 人。",
    "",
    "> 你的绑定：" + (反 && 反.qq ? "QQ **" + 反.qq + "** ✅" : "未绑定"),
    "",
    "> 绑定账号：`星甲绑定账号 <QQ号>` · 立即校验：`星甲绑定确认`"
  ].join("\n"), { 标题: "🔗 绑定列表", 行组: [row(btn("bd4", "绑定账号", "绑定账号帮助"), btn("bd5", "群管帮助", "群管帮助"))] });
}

/* ---------- 后台轮询时钟：每 3 秒扫待绑记录，查到 ticket 且 uin 匹配就自动绑定 ---------- */
let 时钟 = null, 时钟ctx = null, 时钟号 = 0;

export function 启动绑定时钟(ctx) {
  if (时钟) { try { clearInterval(时钟); } catch (e) {} 时钟 = null; }
  if (ctx) 时钟ctx = ctx;
  时钟号 += 1;
  const 我 = 时钟号;
  时钟 = setInterval(async () => {
    if (我 !== 时钟号) return;
    const c = 时钟ctx;
    if (!c) return;
    try { await 扫一轮(c); } catch (e) { /* 静默，别刷屏 */ }
  }, 轮询间隔毫秒);
  if (时钟 && typeof 时钟.unref === "function") 时钟.unref();
}

export function 停止绑定时钟() {
  if (时钟) { try { clearInterval(时钟); } catch (e) {} 时钟 = null; }
}

async function 扫一轮(ctx) {
  let 待表;
  try { 待表 = dget(ctx, 档待绑, "", null); } catch (e) { return; }
  if (!待表 || typeof 待表 !== "object") return;
  for (const openid of Object.keys(待表)) {
    const raw = 待表[openid];
    let 待;
    try { 待 = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { continue; }
    if (!待 || !待.code) continue;
    // 超时清理
    if (Date.now() - Number(待.开始 || 0) > 超时毫秒) {
      try { dset(ctx, 档待绑, openid, ""); } catch (e) {}
      continue;
    }
    let 查;
    try { 查 = await 查ticket(S(待.code)); } catch (e) { continue; }
    if (!查.ticket) continue;                       // 还没登录
    if (查.uin && 查.uin !== S(待.qq)) {            // 身份不符 → 清掉并通知
      try {
        dset(ctx, 档待绑, openid, "");
        await reply(ctx, 待.目标 || { scope: "group", group_openid: "", user_openid: openid },
          "> 绑定账号\n\n身份不符：申请人 " + 待.qq + "，登录人 " + 查.uin + "，无法绑定。", { 标题: "🔗 绑定失败" });
      } catch (e) {}
      continue;
    }
    // 成功：写绑定
    try {
      const r = await 校验绑定(ctx, openid);
      if (r.ok) await 发绑定成功(ctx, 待.目标 || { scope: "group", group_openid: "", user_openid: openid }, openid, r.qq, r.时间);
    } catch (e) { /* 静默 */ }
  }
}
