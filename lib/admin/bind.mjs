// lib/admin/bind.mjs —— 3.2.0：绑定账号（QQ号 ↔ 机器人 openid）
// 流程（仿示例机器人）：发 `绑定账号 <QQ号>` → 拿登录 code → 点蓝链登录后，后台轮询
//   syncScanSateGetTicket 拿 ticket，校验 ticket.uin == 输入的 QQ 号 → 绑定成功 → 解锁群管功能。
// 官方接口（用户实测可用）：
//   GET https://q.qq.com/ide/devtoolAuth/GetLoginCode            → { code:0, data:{ code } }
//   GET https://q.qq.com/ide/devtoolAuth/syncScanSateGetTicket?code=xxx → { code:0, data:{ code, ticket?, uin? } }
import { S, ds, dset, dget, dall, ymd, fmt } from "./../core/base.mjs?v=v1795277295507";
import { reply, row, btn, actBtn, 蓝字 } from "./../core/qq.mjs?v=v1795277295507";

const 档绑定 = "游戏数据/群管/绑定.json";       // key=QQ号 → { openid, 时间 }
const 档绑定反查 = "游戏数据/群管/绑定反查.json"; // key=openid → { qq, 时间 }
const 档待绑 = "游戏数据/群管/绑定等待.json";    // key=openid → { qq, code, 开始, 目标 }
const 超时毫秒 = 120 * 1000;
// 3.2.4：轮询 3 秒→2 秒，更快识别登录成功
const 轮询间隔毫秒 = 2 * 1000;

// 供 group-mgr 禁言等群管功能用：QQ号 → openid
// 注意：存档里存的是 JSON.stringify 后的字符串，读时要 parse（3.2.1 修复：之前没 parse 导致永远读到 null）
function 读对象(ctx, 档, key) {
  const v = dget(ctx, 档, S(key), null);
  if (!v) return null;
  if (typeof v === "object") return v;
  try { const o = JSON.parse(v); return o && typeof o === "object" ? o : null; } catch (e) { return null; }
}
export function 读绑定(ctx, qq) { return 读对象(ctx, 档绑定, qq); }
export function 读绑定byOpenid(ctx, openid) { return 读对象(ctx, 档绑定反查, openid); }
export function 已绑定人数(ctx) {
  try {
    const all = dall(ctx, 档绑定);
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
  // 3.2.5：宽松取 uin —— 兼容 data.uin / data.data.uin / data.user_uin 等可能结构
  const uin = S(d.uin || d.user_uin || d.qq || (d.user && d.user.uin) || (d.data && d.data.uin));
  const ticket = S(d.ticket || d.ticket_id || d.ticketId);
  return { ticket: ticket, uin: uin, 原始: JSON.stringify(j) };
}

function 登录链接(code) {
  return "https://h5.qzone.qq.com/qqq/code/" + encodeURIComponent(code) + "?_proxy=1&from=ide";
}

// 头像：用无需 AppId 的通用地址（thirdqq.qlogo.cn/qqapp/<AppId>/<QQ>/640 在部分环境取不到会显示默认企鹅）
function 头像(qq) {
  return "https://q.qlogo.cn/headimg_dl?dst_uin=" + encodeURIComponent(S(qq)) + "&spec=640";
}

// 主动通知用：去掉 event_id 走主动消息
function 主动目标(t) {
  const o = { scope: t && t.scope, group_openid: S(t && t.group_openid), user_openid: S(t && t.user_openid) };
  return o;
}

// 命令入口：绑定账号 <QQ号>
export async function 绑定账号(ctx, t, u, 参数) {
  // 3.2.3：QQ 号改为可选 —— 登录后从 ticket 直接拿真实 uin，不强制手输（避免输错导致身份不符卡死）
  const 手输 = S(参数).trim();
  if (手输 && !/^[0-9]{5,12}$/.test(手输)) {
    await reply(ctx, t, [
      "**格式错误！**",
      "",
      "可直接发 `星甲绑定账号`（不用填 QQ 号，登录后自动获取），或带 QQ 号：`星甲绑定账号 10001`。"
    ].join("\n"), { 标题: "🔗 绑定账号", 行组: [row(btn("bd1", "查看已绑定", "绑定列表"))] });
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
  const 待 = { qq: 手输, code: code, 开始: Date.now(), 目标: 主动目标(t) };
  dset(ctx, 档待绑, u, JSON.stringify(待));
  const link = 登录链接(code);
  await reply(ctx, t, [
    "## 🔗 绑定账号",
    "",
    "**账号绑定仅用于获取你的 QQ 号，不具备任何用途、不会对你的账号造成任何危害，请放心登录～**",
    "",
    "请在 **120 秒**内点下面蓝链，用**手机QQ内置浏览器**打开并完成验证：",
    "",
    "[点击确认登录](" + link + ")",
    "",
    "> 绑定的是**你登录的那个 QQ 号**（自动识别，不用填、也不会填错）。",
    "> 登录完成后会自动绑定；若没反应，登录成功后点【我已登录·立即校验】。"
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
  // 3.2.5：以 uin 为登录成功的唯一标志（不再依赖 ticket 字段）。
  //   之前要求「先有 ticket 再有 uin」，若某次登录接口只回 uin 会被误判成未登录 —— 这是识别不到的主因之一。
  //   诊断：失败原因里附接口原始返回，方便定位（只留关键字段）。
  const 登录uin = S(查.uin);
  if (!登录uin) {
    const 诊断 = 查.原始 && 查.原始 !== '{"code":0,"data":{"code":"' + S(待.code) + '"}}' ? "（接口返回：" + S(查.原始).slice(0, 120) + "）" : "";
    return { ok: false, 原因: "尚未登录：请在 120 秒内点登录蓝链、用手机QQ完成确认。" + 诊断, 暂缓: !!查.ticket };
  }
  const qq = 登录uin;
  const 手输 = S(待.qq);
  const 已纠偏 = 手输 && 手输 !== qq;            // 手输了但和登录人不同 → 成功卡里说明已按登录人绑定
  const 已有 = 读绑定(ctx, qq);
  if (已有 && 已有.openid) { dset(ctx, 档待绑, u, ""); return { ok: false, 原因: "该 QQ 号（" + qq + "）已绑定过" }; }
  const 反 = 读绑定byOpenid(ctx, u);
  if (反 && 反.qq) { dset(ctx, 档待绑, u, ""); return { ok: false, 原因: "你已绑定过 QQ " + 反.qq }; }
  // 写入双向绑定 + 时间
  const 时 = fmt(Date.now());
  dset(ctx, 档绑定, qq, JSON.stringify({ openid: u, 时间: 时 }));
  dset(ctx, 档绑定反查, u, JSON.stringify({ qq: qq, 时间: 时 }));
  dset(ctx, 档待绑, u, "");
  return { ok: true, qq: qq, 时间: 时, 已纠偏: 已纠偏, 手输: 手输 };
}

// 校验命令（玩家登录后手动点按钮/发指令也走这里）
export async function 绑定确认(ctx, t, u) {
  const r = await 校验绑定(ctx, u);
  if (!r.ok) {
    // 3.2.4 关键修复：**失败时绝不重置 code** —— 之前每次失败都换新 code，
    //   把用户刚登录成功的 code 作废了 → 永远识别不到登录。现在保留原 code，
    //   后台轮询会继续用它查 ticket；只有用户主动点「重新登录」才换新 code。
    const 待原始 = ds(ctx, 档待绑, u, "");
    let 待 = null;
    try { 待 = 待原始 ? JSON.parse(待原始) : null; } catch (e) { /* ignore */ }
    const link = 待 && 待.code ? 登录链接(S(待.code)) : "";
    await reply(ctx, t, [
      "> 绑定确认：" + r.原因,
      "",
      "> 如果你**已经登录成功**，后台正在自动识别（约 2 秒一次），稍等几秒即可，不用重复点。",
      "> 如果**没登录或登录超时**，点下面【重新登录】拿新链接。",
      link ? "" : "> 没有有效的登录链接，请发 `星甲绑定账号`。"
    ].filter(Boolean).join("\n"), {
      标题: "🔗 绑定确认",
      行组: [row(actBtn("bdc1", "已登录·再校验一次", "绑定确认"), actBtn("bdc3", "重新登录（换链接）", "绑定重登")), row(btn("bdc2", "绑定列表", "绑定列表"))]
    });
    return;
  }
  await 发绑定成功(ctx, t, u, r.qq, r.时间, r);
}

// 3.2.4：主动重新登录 —— 生成新 code + 新链接（只有用户明确点「重新登录」时才调用，避免作废已登录的 code）
export async function 绑定重登(ctx, t, u) {
  let code = "";
  try { code = await 取登录code(); } catch (e) { /* ignore */ }
  if (!code) {
    await reply(ctx, t, "获取登录链接失败，请稍后重试。", { 标题: "🔗 重新登录" });
    return;
  }
  dset(ctx, 档待绑, u, JSON.stringify({ qq: "", code: code, 开始: Date.now(), 目标: 主动目标(t) }));
  await reply(ctx, t, [
    "## 🔗 重新登录",
    "",
    "请在 **120 秒**内点下面蓝链，用**手机QQ内置浏览器**打开并完成验证：",
    "",
    "[点击确认登录](" + 登录链接(code) + ")",
    "",
    "> 登录成功后会自动绑定；没反应就点【已登录·再校验一次】。"
  ].join("\n"), {
    标题: "🔗 重新登录",
    行组: [row(actBtn("bdr1", "已登录·立即校验", "绑定确认"), btn("bdr2", "绑定列表", "绑定列表"))]
  });
}

// 发绑定成功卡（前台用被动回复，后台轮询用主动目标）
export async function 发绑定成功(ctx, t, u, qq, 时间, 纠偏) {
  const 人 = 已绑定人数(ctx);
  const 昵称 = ds(ctx, "游戏数据/星舰数据/昵称.json", u, "") || "用户";
  await reply(ctx, t, [
    "![" + 昵称 + " #160px #160px](" + 头像(qq) + ")",
    "",
    "**" + 昵称 + "**",
    "> 绑定账号 " + qq,
    "",
    "当前绑定人数 **" + 人 + "** 人",
    "数据已上传服务器！",
    "",
    "> 绑定时间：" + 时间,
    (纠偏 && 纠偏.已纠偏 ? "> 你填写的 " + 纠偏.手输 + " 与登录 QQ 不一致，已按**登录的真实 QQ " + qq + "** 绑定。" : ""),
    "> 现在可以使用禁言等需要 QQ 号的群管功能了。"
  ].filter(Boolean).join("\n"), { 标题: "🔗 绑定成功" });
}

// 3.2.1：用 QQ 号查询绑定信息（未绑定返回失败）；也支持查自己的
export async function 查号(ctx, t, u, 参数) {
  const s = S(参数).trim();
  if (!s) {
    const 自己 = 读绑定byOpenid(ctx, u);
    await reply(ctx, t, [
      "## 🔍 查号",
      "",
      "> 你的绑定：" + (自己 && 自己.qq ? "QQ **" + 自己.qq + "** ✅" : "未绑定"),
      "",
      "用法：`星甲查号 <QQ号>` 查某个 QQ 号的绑定信息。"
    ].join("\n"), { 标题: "🔍 查号", 行组: [row(btn("cq1", "绑定账号", "绑定账号"), btn("cq2", "群管帮助", "群管帮助"))] });
    return;
  }
  if (!/^[0-9]{5,12}$/.test(s)) {
    await reply(ctx, t, "QQ 号格式不对（5~12 位数字）。", { 标题: "🔍 查号" });
    return;
  }
  const b = 读绑定(ctx, s);
  if (!b || !b.openid) {
    await reply(ctx, t, "> 查号 " + s + "\n\n**查询失败**：该 QQ 号未绑定，请让对方发 `星甲绑定账号 " + s + "` 绑定后再查。", {
      标题: "🔍 查号失败", 行组: [row(btn("cq3", "绑定账号", "绑定账号"))]
    });
    return;
  }
  await reply(ctx, t, [
    "## 🔍 查号",
    "",
    "> QQ：**" + s + "**",
    "> openid：`" + b.openid + "`",
    "> 绑定时间：" + S(b.时间),
    "",
    "> 可用 `星甲禁言 " + s + " <分钟>` 等操作。"
  ].join("\n"), { 标题: "🔍 查号", 行组: [row(btn("cq4", "禁言状态", "禁言状态"), btn("cq5", "群管帮助", "群管帮助"))] });
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
  ].join("\n"), { 标题: "🔗 绑定列表", 行组: [row(btn("bd4", "绑定账号", "绑定账号"), btn("bd5", "群管帮助", "群管帮助"))] });
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
  try { 待表 = dall(ctx, 档待绑); } catch (e) { return; }
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
    // 3.2.5：以 uin 为登录成功标志 —— 有 uin 就走校验绑定，不再要求 ticket 字段
    if (!查.uin && !查.ticket) continue;            // 确实还没登录
    // 不再比对「手输 QQ vs 登录人」—— 直接走校验绑定（以登录人真实 uin 为准，手输填错也能绑）
    try {
      const r = await 校验绑定(ctx, openid);
      if (r.ok) await 发绑定成功(ctx, 待.目标 || { scope: "group", group_openid: "", user_openid: openid }, openid, r.qq, r.时间, r);
    } catch (e) { /* 静默 */ }
  }
}
