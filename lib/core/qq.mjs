// lib/core/qq.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { 读控制台配置 } from "./../admin/admin.mjs?v=v1795112955791";
import { S, 加前缀指令, 星甲前缀, 自身目录 } from "././base.mjs?v=v1795112955791";
import { 译指令 } from "./../game/translate.mjs?v=v1795112955791";
import fs from "node:fs";
import path from "node:path";

export function cmdInput(fill, show, 原文) {
  const 原0 = S(fill);
  // 2.5.23：英文回调串（autoatk|10 / ba|atk / explore|5 …）自动转成中文指令再填入
  let 译 = 原0;
  try { 译 = 原0 ? S(译指令(原0)) : 原0; } catch (e) { 译 = 原0; }   // 兜底：翻译异常时保持原样
  const 原 = 译 || 原0;
  const 填 = 原 && !/^星甲/.test(原) ? 星甲前缀 + 原 : 原;
  const 显 = S(show === undefined || show === null || show === "" ? 原 : (S(show) === 原0 ? 原 : show));
  // 2.9.4（需求 3/5）：菜单参考页用「原文模式」—— 属性值直接写中文指令原文，不做百分号编码，
  //   这样消息正文里能直接读到「星甲挑战#N」这类指令原文（玩家可读、日志可读、自动化测试可读）；
  //   含会破坏 XML 属性的字符（引号 / 尖括号 / 与号 / 百分号 / 反斜杠 / 换行）时仍退回百分号编码。
  const 属性 = (v) => (原文 && v && !/["'<>&%\\\r\n]/.test(v) ? v : encodeURIComponent(v));
  return '<qqbot-cmd-input text="' + 属性(填) + '" show="' + 属性(显) + '" reference="false"/>';
}


// 蓝色可点击文字（QQ 官方「指令」内联组件，渲染为蓝色、点一下就填好指令）
export function 蓝字(指令, 显示) { return cmdInput(指令, 显示 === undefined || 显示 === null || 显示 === "" ? 指令 : 显示); }


// 2.9.4（需求 3/5）：菜单专用 —— 蓝色，但属性值保留指令原文
export function 蓝字原文(指令, 显示) { return cmdInput(指令, 显示 === undefined || 显示 === null || 显示 === "" ? 指令 : 显示, true); }


// 一组蓝色可点击字：[["指令","显示"], ...] → "显示1  显示2"
export function 蓝链(项) {
  return (Array.isArray(项) ? 项 : [])
    .filter((x) => x && x[0])
    .map((x) => 蓝字(x[0], x[1]))
    .join("  ");
}


export function segMd(text, keyboard) { return { type: "md", data: String(text === undefined || text === null ? "" : text), keyboard: keyboard || null }; }


export function segText(text) { return { type: "text", data: String(text === undefined || text === null ? "" : text) }; }



export const seqMap = new Map();


export function nextSeq(key) {
  const v = (seqMap.get(key) || 0) + 1;
  seqMap.set(key, v);
  return v;
}


export function apiPath(t) {
  if (t.scope === "group") {
    if (!t.group_openid) throw new Error("缺少 group_openid");
    return "/v2/groups/" + t.group_openid + "/messages";
  }
  if (t.user_openid) return "/v2/users/" + t.user_openid + "/messages";
  // 兜底：万一被误判为私聊但有群 openid，仍按群发送
  if (t.group_openid) return "/v2/groups/" + t.group_openid + "/messages";
  throw new Error("缺少 user_openid / group_openid");
}


export async function api(ctx, p, params) {
  if (!ctx || !ctx.actions || !ctx.actions.call) throw new Error("[xjyl] 上下文未就绪");
  return ctx.actions.call(p, params || {}, ctx.adapterName);
}


// 蓝色艾特：Markdown 里的 `<@openid>` 会被 QQ 渲染成蓝色的 @ 提示
// 2.2.1：按需求「所有功能都要带蓝色艾特，否则发不出去」，群聊/私聊都加。
//  （想只让群聊带艾特，把这里改成 true 即可）
export const 艾特仅在群聊 = false;


export function 艾特前缀(t) {
  const o = t || {};
  if (o.无艾特) return "";
  const id = S(o.mention_openid || o.艾特id);
  if (!id) return "";
  if (艾特仅在群聊 && o.scope !== "group") return "";
  return "<@" + id + ">";
}


export async function sendMd(ctx, t, text, keyboard) {
  // 2.2.6：提示里的指令统一显示为「星甲xxx」
  const 原文 = 加前缀指令(String(text === undefined || text === null ? "" : text));
  const 艾特 = 艾特前缀(t);
  const content = (艾特 && 原文.indexOf("<@") !== 0) ? (艾特 + "\n\n" + 原文) : 原文;
  const body = { content: "", msg_type: 2, markdown: { content: content } };
  if (keyboard) body.keyboard = keyboard;
  const eid = S(t.event_id);
  if (eid) { body.msg_id = eid; body.msg_seq = nextSeq(eid); }
  // 2.5.29：走「发送兜底」—— 被动（带凭证）↔ 主动（不带）可互相兜底
  return 发送兜底(ctx, t, body);
}


/* ---------- 2.9.4 按钮统一构造（修 40034103 keyboard…action 无效） ----------
 * QQ 官方对按钮的要求：id 只能是 [A-Za-z0-9_-] 且 ≤64；每行 ≤5 个、最多 5 行；
 * render_data 必填 label/visited_label/style（style 0~4）；action 必填 type / permission / data，
 * 指令型（type 2）才允许带 enter；提示字段名是 **unsupported_tips**（旧代码写成 unsupport_tips，
 * 少了一个 ed，属于不合规字段）。所有按钮一律走这里生成，避免各处手写结构出错。
 */
export const 按钮样式集 = new Set([0, 1, 2, 3, 4]);


export function 造按钮(o) {
  const 源 = o || {};
  const 类型 = Number(源.type) === 1 ? 1 : 2;
  const 标签 = S(源.label).slice(0, 12) || "按钮";
  let 数据 = S(源.data).slice(0, 90);
  if (!数据) 数据 = 类型 === 1 ? (ACT + "menu") : (星甲前缀 + "菜单");
  const 样式 = 按钮样式集.has(Number(源.style)) ? Number(源.style) : (类型 === 1 ? 1 : 0);
  const 候选id = S(源.id);
  const id = /^[A-Za-z0-9_\-]{1,64}$/.test(候选id) ? 候选id : ("b" + Math.random().toString(36).slice(2, 10));
  const action = { type: 类型, permission: { type: 2 }, data: 数据, unsupported_tips: "当前客户端不支持此操作" };
  if (类型 === 2) action.enter = false;
  return { id: id, render_data: { label: 标签, visited_label: 标签, style: 样式 }, action: action };
}


// 指令按钮：点击把 data 填进输入框（type 2）
export function btn(id, label, data, style) {
  // 2.2.6：按钮点击后填入的指令也统一带「星甲」前缀
  // 2.5.23：英文回调串自动翻译成中文指令（不再出现 `星甲autoatk|10` 这种英文）
  const 原0 = S(data);
  let 译 = 原0;
  try { 译 = 原0 ? S(译指令(原0)) : 原0; } catch (e) { 译 = 原0; }   // 兜底：翻译异常时保持原样
  const 原 = 译 || 原0;
  const 填入 = 原 && !/^星甲/.test(原) ? 星甲前缀 + 原 : 原;
  return 造按钮({ id: id, label: label, data: 填入, style: style, type: 2 });
}


// 回调按钮：点击立刻执行（type 1）—— 保持蓝色（内联按钮不变）
// 2.6.0（需求 5）：改名后回调前缀同步改为 xjylact:；解析端仍兼容旧的 mkact:
export const ACT = "xjylact:";


export function actBtn(id, label, act, style) {
  // 3.1.0（需求）：快捷按钮去掉「⚡」标记，只保留蓝色按钮本身
  const 文 = String(label === undefined || label === null ? "" : label).replace(/^⚡\s*/, "");
  return 造按钮({ id: id, label: 文, data: ACT + S(act), style: style === undefined ? 1 : style, type: 1 });
}


export function row() {
  const list = [];
  for (let i = 0; i < arguments.length; i++) if (arguments[i]) list.push(arguments[i]);
  return { buttons: list.slice(0, 5) };
}


// 整块键盘归一化：结构重造 + id 去重（同一键盘里重复 id 也可能被判 action 无效）
export function kb(rows) {
  const 用 = new Set();
  const out = [];
  for (const r of (Array.isArray(rows) ? rows : [])) {
    if (!r || !Array.isArray(r.buttons) || !r.buttons.length) continue;
    const 钮 = [];
    for (const b of r.buttons.slice(0, 5)) {
      if (!b) continue;
      const 归 = 造按钮({
        type: b.action && b.action.type,
        label: b.render_data && b.render_data.label,
        data: b.action && b.action.data,
        style: b.render_data && b.render_data.style,
        id: b.id
      });
      if (用.has(归.id)) 归.id = 归.id.slice(0, 56) + "_" + Math.random().toString(36).slice(2, 6);
      用.add(归.id);
      钮.push(归);
    }
    if (钮.length) out.push({ buttons: 钮 });
    if (out.length >= 5) break;
  }
  return out.length ? { content: { rows: out } } : null;
}


export async function sendSegs(ctx, t, segs) {
  const out = [];
  for (const seg of (Array.isArray(segs) ? segs : [segs])) {
    if (!seg) continue;
    try {
      if (seg.type === "md") out.push(await sendMd(ctx, t, seg.data, seg.keyboard));
      else if (seg.type === "text") out.push(await sendMd(ctx, t, seg.data, null));
      else if (seg.type === "image") out.push(await sendMedia(ctx, t, await uploadPic(ctx, t, seg.data), seg.note));
      else if (seg.type === "video") out.push(await sendMedia(ctx, t, await upload(ctx, t, segData(seg), 2), seg.note));
      else if (seg.type === "audio") out.push(await sendMedia(ctx, t, await upload(ctx, t, segData(seg), 3), seg.note));
      else if (seg.type === "ark") out.push(await sendArkRaw(ctx, t, seg.templateId, seg.kv));
    } catch (e) {
      if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 富媒体发送失败:", seg.type, e);
    }
  }
  return out;
}


// 图片：优先当 URL，其次当 base64/本地文件内容
export function segData(seg) {
  if (seg.url) return { url: seg.url };
  return { data: seg.data };
}


export async function uploadPic(ctx, t, data) {
  const v = String(data === undefined || data === null ? "" : data);
  if (/^https?:\/\//i.test(v)) return upload(ctx, t, { url: v }, 1);
  if (v.indexOf("base64://") === 0) return upload(ctx, t, { data: v.slice(9) }, 1);
  return upload(ctx, t, { data: v }, 1);
}


// 旧版兼容：段_图片url / 段_图片base64 / 段_图片本地 / 段_视频url
export function 段_图片url(url, note) { return { type: "image", data: S(url), note: S(note) }; }


export function 段_图片base64(b64, note) { return { type: "image", data: S(b64), note: S(note) }; }


export function 段_图片本地(ctx, rel, note) {
  try {
    const p = 解析插件相对路径(ctx, rel);
    if (!fs.existsSync(p)) return null;
    return { type: "image", data: fs.readFileSync(p).toString("base64"), note: S(note) };
  } catch (e) { return null; }
}


export function 段_视频url(url, note) { return { type: "video", url: S(url), note: S(note) }; }


export function 段_音频url(url, note) { return { type: "audio", url: S(url), note: S(note) }; }


export function 段_Ark(templateId, kv) { return { type: "ark", templateId: S(templateId), kv: kv || [] }; }


// 插件目录下的相对路径（用于读取 data/ 里的图片资源）
// 解析顺序：① <本文件所在目录>/data/<rel> —— 插件自带资源的标准位置（data/默认资源/text/运势.json …）
//          ② <ctx.pluginPath>/data/<rel>
//          ③ <ctx.dataPath>/<rel>  —— 旧版把资源放在 data/<账号>/<插件>/ 下
//          ④ <插件目录>/<rel>
// 注意：以前只查 ③，而插件自带资源其实在 ①，导致运势签文表 / 运势图 URL.json 永远读不到。
export function 解析插件相对路径(ctx, rel) {
  const r = String(rel === undefined || rel === null ? "" : rel).replace(/\\/g, "/").replace(/^\/+/, "");
  const pluginPath = S(ctx && ctx.pluginPath);
  const dataPath = S(ctx && ctx.dataPath);
  const cands = [];
  if (自身目录) cands.push(path.join(自身目录, "data", r));
  if (pluginPath && pluginPath !== 自身目录) cands.push(path.join(pluginPath, "data", r));
  if (dataPath) cands.push(path.join(dataPath, r));
  if (pluginPath && pluginPath !== 自身目录) cands.push(path.join(pluginPath, r));
  if (自身目录) cands.push(path.join(自身目录, r));
  for (const c of cands) {
    try { if (c && fs.existsSync(c)) return c; } catch (e) { /* 继续尝试下一个 */ }
  }
  return cands[0] || r;
}


// 取发送结果里的消息 id（旧版常用）
export function 取发送消息Id(result) {
  const o = result || {};
  const d = (o.data && typeof o.data === "object") ? o.data : o;
  return S(d.id || d.msg_id || d.message_id || o.id || o.msg_id);
}


// ---------- Ark 模板消息（msg_type 3） ----------
export async function sendArkRaw(ctx, t, templateId, kv) {
  const body = { msg_type: 3, ark: { template_id: Number(templateId) || templateId, kv: Array.isArray(kv) ? kv : [] } };
  const eid = S(t.event_id);
  if (eid) { body.msg_id = eid; body.msg_seq = nextSeq(eid); }
  return api(ctx, apiPath(t), body);
}


// 旧版兼容：发Ark / 指令钮 / 构建点歌Footer键盘
export async function 发Ark(ctx, t, templateId, kv) { return sendArkRaw(ctx, t, templateId, kv); }


export function 指令钮(id, label, data, style) { return btn(id, label, data, style); }


export function 构建点歌Footer键盘() {
  return kb([row(btn("bt_music", "音乐系统", "音乐系统"), btn("bt_fav", "个人歌单", "个人歌单"), btn("bt_home", "返回首页", "菜单"))]);
}


// 互动回调场景的主动回复（去掉 msg_id）
export async function 发互动回复(ctx, t, segs) { return sendSegs(ctx, await active(t), segs); }


// 音乐 Ark 卡片（官方模板 24）；失败时调用方可回退 Markdown 卡
export async function 发音乐Ark(ctx, t, d) {
  const kv = [
    { key: "#PROMPT#", value: S(d.歌名) || "音乐" },
    { key: "#METADATA#", value: S(d.链接) },
    { key: "#TITLE#", value: S(d.歌名) },
    { key: "#SINGER#", value: S(d.歌手) },
    { key: "#IMG#", value: S(d.封面) },
    { key: "#MUSIC_URL#", value: S(d.链接) }
  ];
  return sendArkRaw(ctx, t, 24, kv);
}


export async function 发音乐卡片(ctx, t, d) {
  try { await 发音乐Ark(ctx, t, d); return true; }
  catch (e) { return false; }
}


export async function 发音乐语音(ctx, t) {
  await reply(ctx, t, "官方机器人不支持语音消息，请用音频（`选歌序号`）播放。", { 标题: "🎵 语音" });
}


export async function 发视频(ctx, t, url, note) { return sendMedia(ctx, t, await upload(ctx, t, { url: url }, 2), note); }


export async function 发图片(ctx, t, url, note) { return sendMedia(ctx, t, await uploadPic(ctx, t, url), note); }


// ---------- 响应耗时 ----------
export let 本次请求开始 = 0;


export function 标记请求开始() { 本次请求开始 = Date.now(); }


export function 耗时后缀() {
  if (!本次请求开始) return "";
  const 差 = Date.now() - 本次请求开始;
  // 2.7.1 修复：事件回调（进群/退群等）没有重置起点时，会拿到上一次消息的起点，
  //   算出「20165358ms」这种离谱数字。超过 60 秒直接不显示。
  if (!Number.isFinite(差) || 差 < 0 || 差 > 60000) return "";
  return "\n\n> 响应用时: " + 差 + "ms";
}


/* ---------- 2.9.3 常驻公告：每条消息「响应用时」下方的灰色公告 ----------
 * 数据源：控制台配置「常驻公告」（dataPath/config.json），支持换行，最多 5 行。
 * 样式：沿用本插件既有的灰色语法 —— Markdown 引用块（`> ` 前缀），与「响应用时」同一套。
 * 关闭：空字符串 / 纯空白 / 纯换行。
 */
export const 公告最多行数 = 5;


export function 常驻公告后缀(ctx) {
  let 文 = "";
  try { 文 = S(读控制台配置(ctx)["常驻公告"]); } catch (e) { 文 = ""; }
  if (!文 || !文.trim()) return "";
  let 行 = 文.replace(/\r\n?/g, "\n").split("\n");
  // 去掉首尾空行，中间空行保留（用于分段）
  while (行.length && !S(行[0]).trim()) 行.shift();
  while (行.length && !S(行[行.length - 1]).trim()) 行.pop();
  if (!行.length) return "";
  if (行.length > 公告最多行数) {
    // 超出 5 行：截断并把「…」接在第 5 行行尾，保证总行数仍是 5 行
    行 = 行.slice(0, 公告最多行数);
    行[公告最多行数 - 1] = S(行[公告最多行数 - 1]) + " …";
  }
  return "\n\n" + 行.map((x) => (S(x).trim() ? "> " + x : ">")).join("\n");
}


export async function reply(ctx, t, text, opts) {
  const o = opts || {};
  const head = S(o.标题);
  // 2.2.6：提示里的指令统一显示为「星甲xxx」
  const body = 加前缀指令(String(text === undefined || text === null ? "" : text)).replace(/\n{3,}/g, "\n\n");
  const tail = o.无耗时 ? "" : 耗时后缀();
  // 2.9.3：常驻公告追加在「响应用时」下面（配置为空时不追加）
  const 公告 = 常驻公告后缀(ctx);
  const full = (head ? ("### " + head + "\n\n" + body) : body) + tail + 公告;
  let keyboard = null;
  if (Array.isArray(o.行组) && o.行组.length) keyboard = kb(o.行组);
  else if (Array.isArray(o.按钮) && o.按钮.length) keyboard = kb([row.apply(null, o.按钮)]);
  // 允许单条回复关闭蓝色艾特：reply(ctx, t, "...", { 无艾特: true })
  // 2.5.29：支持 { 艾特id: openid } 指定要 @ 的人（进群提示 @ 新成员）
  let 目标 = o.无艾特 ? Object.assign({}, t, { 无艾特: true }) : t;
  if (o.艾特id) 目标 = Object.assign({}, 目标, { 艾特id: S(o.艾特id) });
  return sendSegs(ctx, 目标, [segMd(full, keyboard)]);
}


// 富媒体：先上传拿 file_info，再以 msg_type 7 发送
export async function upload(ctx, t, opts, fileType) {
  const body = { file_type: fileType || 1, srv_send_msg: false };
  if (opts.url) body.url = S(opts.url);
  if (opts.data) body.file_data = opts.data;
  let p;
  if (t.scope === "group") {
    if (!t.group_openid) throw new Error("缺少 group_openid");
    body.group_openid = t.group_openid;
    p = "/v2/groups/" + t.group_openid + "/files";
  } else {
    if (!t.user_openid) throw new Error("缺少 user_openid");
    p = "/v2/users/" + t.user_openid + "/files";
  }
  const res = await api(ctx, p, body);
  const info = S(res && res.file_info);
  if (!info) throw new Error("富媒体上传未返回 file_info");
  return info;
}


export async function sendMedia(ctx, t, fileInfo, note) {
  const body = { msg_type: 7, media: { file_info: fileInfo } };
  const c = S(note);
  if (c) body.content = c.slice(0, 100);
  const eid = S(t.event_id);
  if (eid) { body.msg_id = eid; body.msg_seq = nextSeq(eid); }
  return 发送兜底(ctx, t, body);
}


export async function sendAudio(ctx, t, url, note) { return sendMedia(ctx, t, await upload(ctx, t, { url: url }, 3), note); }


export async function sendVideo(ctx, t, url, note) { return sendMedia(ctx, t, await upload(ctx, t, { url: url }, 2), note); }


export async function delMsg(ctx, t, id) {
  const mid = S(id);
  if (!mid) throw new Error("message_id 为空");
  if (t.scope === "group") return api(ctx, "/v2/groups/" + S(t.group_openid) + "/messages/" + mid, { __method: "DELETE" });
  return api(ctx, "/v2/users/" + S(t.user_openid) + "/messages/" + mid, { __method: "DELETE" });
}


export async function ack(ctx, iid, code) {
  const id = S(iid);
  if (!id) return null;
  return api(ctx, "/interactions/" + id, { code: code === undefined ? 0 : code, __method: "PUT" });
}


// 2.5.29：发送兜底（修「没开主动消息 → 点 ⚡ 按钮报 40034105 无权限」）
//   规则：先用当前凭证发（有 event_id 就是被动消息）；失败就换另一条路再试一次。
//   ① 被动失败（msg_id 过期 / 事件不支持回复 / 超次数）→ 去掉凭证转**主动**
//   ② 主动失败（40034105 无权限 / 40034100 超频控）→ 有 event_id 就转**被动**
//   两条都失败才抛出，并把两次错误都写进日志，方便定位。
export function 错误摘要(e) {
  return S(e && (e.message || e.msg || e)).slice(0, 200);
}


/* ---------- 2.9.4 发送侧加固（修 runoob 三类报错） ----------
 * 40034101「msg_id 无效或越权」：同一个 msg_id（event_id）只能被动回复**一次**，
 *   而且只在 5 分钟窗口内有效。→ ① 成功后标记已用，同一凭证再发就走主动；
 *   ② 命中 40034101 立即降级主动（去掉 msg_id/msg_seq）重发；③ 请求已超过 5 分钟直接走主动。
 * 40034103「keyboard…action 无效」：按钮结构不合规（旧代码字段名 unsupport_tips 写错、id 重复等）。
 *   → kb() 已统一重造结构；万一仍被判非法，这里去掉 keyboard 再发一次（宁可没按钮，也不丢消息）。
 * 40034105 / 40034100：无主动消息权限 / 频控，日志里单独点名。
 */
export const 已用凭证 = new Map();

     // msg_id → 首次成功使用时间
export const 被动窗口毫秒 = 5 * 60 * 1000;


export function 清理已用凭证() {
  const 现在 = Date.now();
  for (const [k, v] of Array.from(已用凭证)) if (!v || 现在 - Number(v) > 被动窗口毫秒) 已用凭证.delete(k);
  // 兜底：极端情况下（大量不同事件）防止 Map 无限增长
  if (已用凭证.size > 800) { let i = 0; for (const k of Array.from(已用凭证.keys())) { 已用凭证.delete(k); if (++i > 400) break; } }
}


export function 凭证可用(id) {
  const k = S(id);
  if (!k) return false;
  const 用 = Number(已用凭证.get(k)) || 0;
  if (!用) return true;
  return Date.now() - 用 > 被动窗口毫秒;
}


export function 标记凭证已用(id) { const k = S(id); if (k) { 已用凭证.set(k, Date.now()); 清理已用凭证(); } }


// 失败原因只写一次（同一错误码 + 同一摘要不重复刷日志）
export const 已报错误 = new Set();


export function 报发送错误(ctx, 标签, e) {
  const 摘 = 错误摘要(e);
  const 码 = (摘.match(/40034[0-9]{3}/) || [""])[0];
  const 键 = 码 + "|" + 摘.slice(0, 60);
  if (已报错误.has(键)) return;
  已报错误.add(键);
  if (已报错误.size > 200) 已报错误.clear();
  const 说明 = 码 === "40034101" ? "（msg_id 无效/越权：该事件已被回复过或超出 5 分钟窗口，已降级为主动消息）"
    : 码 === "40034103" ? "（键盘/按钮结构非法：已按统一构造重造，必要时去键盘重发）"
      : 码 === "40034105" ? "（未开启主动消息权限，或该事件不支持被动回复）"
        : 码 === "40034100" ? "（触发频控，请降低发送频率）" : "";
  if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] " + 标签 + "：" + 摘 + 说明);
}


/* 3.0.0：主动消息可用性缓存 —— 一旦命中 40034105（未开通主动消息），30 分钟内不再尝试主动，
 *   免得群成员进出这类「没有被动凭证」的事件每次刷一堆 WARN。 */
let 主动可用至 = 0;
export function 主动可用() { return Date.now() >= 主动可用至; }
export function 标记主动不可用(毫秒) { 主动可用至 = Date.now() + (Number(毫秒) || 30 * 60 * 1000); }

export async function 发送兜底(ctx, t, body) {
  const 主 = Object.assign({}, body);
  // ③ 请求已超过被动窗口 → 直接走主动，别浪费一次必失败的重试
  if (S(主.msg_id) && 本次请求开始 && Date.now() - 本次请求开始 > 被动窗口毫秒) {
    delete 主.msg_id; delete 主.msg_seq;
  }
  // ① 同一凭证只用一次：已用过 → 直接走主动
  if (S(主.msg_id) && !凭证可用(主.msg_id)) {
    delete 主.msg_id; delete 主.msg_seq;
  }
  let 错1 = null;
  try {
    const r = await api(ctx, apiPath(t), 主);
    if (S(主.msg_id)) 标记凭证已用(主.msg_id);
    return r;
  } catch (e) { 错1 = e; }
  const 摘1 = 错误摘要(错1);
  // 40034103：按钮非法 → 去键盘重发（同一条路，保留 msg_id）
  if (/40034103/.test(摘1) && 主.keyboard) {
    报发送错误(ctx, "按钮结构非法，已去键盘重发", 错1);
    const 无键盘 = Object.assign({}, 主);
    delete 无键盘.keyboard;
    try {
      const r = await api(ctx, apiPath(t), 无键盘);
      if (S(无键盘.msg_id)) 标记凭证已用(无键盘.msg_id);
      return r;
    } catch (e1b) { 错1 = e1b; }
  }
  // 40034101：msg_id 已被用过 / 超出 5 分钟窗口 → 记一次日志后降级主动（同一错误码只记一次，不刷屏）
  // 40034105：未开通「主动消息」权限 —— 标记 30 分钟内不再走主动，且只记一次日志
  if (/40034105/.test(摘1)) {
    标记主动不可用();
    报发送错误(ctx, "主动消息未开通（40034105），已跳过主动发送", 错1);
  }
  if (/40034101/.test(摘1)) {
    报发送错误(ctx, "被动回复失败，已降级为主动消息", 错1);
    if (S(主.msg_id)) 标记凭证已用(主.msg_id);   // 失效凭证不再重试
  }
  const 备用 = Object.assign({}, body);
  if (S(主.msg_id)) {
    // ② 被动失败（含 40034101 msg_id 失效）→ 主动；但已知未开通主动消息就直接放弃，不白试一次
    if (!主动可用()) {
      报发送错误(ctx, "被动回复失败，且宿主未开通主动消息（已跳过）", 错1);
      throw 错1;
    }
    delete 备用.msg_id;
    delete 备用.msg_seq;
  } else {
    // 主动失败 → 被动（用 event_id / 备用凭证；已用过的凭证不再试）
    const 凭证 = S(t && (t.event_id || t.备用event_id));
    if (!凭证 || !凭证可用(凭证)) {
      报发送错误(ctx, "主动消息发送失败且无可用被动凭证", 错1);
      throw 错1;
    }
    备用.msg_id = 凭证;
    备用.msg_seq = nextSeq(凭证);
  }
  try {
    const r = await api(ctx, apiPath(t), 备用);
    if (S(备用.msg_id)) 标记凭证已用(备用.msg_id);
    return r;
  } catch (e2) {
    // 40034103 的第二次机会：备用这条路再去掉键盘
    if (/40034103/.test(错误摘要(e2)) && 备用.keyboard) {
      const 无键盘 = Object.assign({}, 备用);
      delete 无键盘.keyboard;
      try {
        const r = await api(ctx, apiPath(t), 无键盘);
        if (S(无键盘.msg_id)) 标记凭证已用(无键盘.msg_id);
        return r;
      } catch (e2b) { 报发送错误(ctx, "发送失败（被动/主动/去键盘均已尝试）", e2b); throw e2b; }
    }
    报发送错误(ctx, "发送失败（被动/主动均已尝试）", e2);
    throw e2;
  }
}


// 互动回调场景：优先**被动回复**（QQ 文档：INTERACTION_CREATE 的 id 可作 event_id 做被动回复）
// 2.5.29：上一版这里把 event_id 剥掉 → 没开主动消息的机器人点 ⚡ 按钮必然 400（40034105）。
//   现在保留 event_id（被动优先），发送兜底会在被动不可用时自动转主动。
export async function active(t) {
  const o = {};
  for (const k in t) if (k !== "interactionId") o[k] = t[k];
  return o;
}
