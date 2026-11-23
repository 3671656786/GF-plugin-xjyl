/* ============================================================
 * lib/game/update.mjs —— 插件在线更新（3.1.6）
 * ------------------------------------------------------------
 * 玩家发 `星甲更新插件` → 查 GitHub 最新 Release → 聊天栏二次确认
 *   → 下载 zip → 备份旧目录 → 逐文件覆盖 → 重载插件。
 *
 * 下载源（每人网络环境不同，所以做成可选，共 4 个）：
 *   1. catmak.name 加速（大陆）   —— 走 gh.catmak.name 前缀
 *   2. gh-proxy.com 加速（大陆）  —— 走 gh-proxy.com 前缀
 *   3. GitHub 直连（国际/港澳台） —— 直接 github.com
 *   4. GitHub 官方 API（国际/港澳台）—— 走 api.github.com 的资产接口
 *
 * 安全设计：
 *   · 只信任仓库 3671656786/GF-plugin-xjyl 的官方 Release，且只认以
 *     GF-plugin-xjyl-v 开头的 zip 资产（防止挂马）。
 *   · 下载的 zip 先在内存里校验（能解开、含 index.mjs 与 package.json、
 *     版本号与所宣称的 tag 一致），通过后才落盘。
 *   · 覆盖前把整个插件目录复制成 .bak-<时间戳>，出问题可手动回滚。
 *   · 逐文件覆盖、**不删除**本地多余文件 → 插件目录下的 data/ 不会被误删；
 *     运行数据主体在 ctx.dataPath，更不受影响。
 *   · 解压时防路径穿越（拒绝 .. 与绝对路径）。
 * ============================================================ */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { 解压到内存 } from "./../core/unzip.mjs?v=v1795441723438";
import { 版本 } from "./../core/base.mjs?v=v1795441723438";
import { 代理下载, 代理取JSON, 有代理, 取代理地址 } from "./../core/http-proxy.mjs?v=v1795441723438";

export const 仓库 = "3671656786/GF-plugin-xjyl";
export const Release接口 = "https://api.github.com/repos/" + 仓库 + "/releases/latest";

export const 下载超时毫秒 = 90000;     // 单次下载最长 90 秒
export const 备份保留数 = 3;            // 最多保留 3 份备份目录

/* ---------- 下载源定义 ---------- */
// 说明：每个源都是「前缀 + 原始 URL」的形式。ping 时用同一套前缀去测，
// 保证测出来的延迟就是这个源真实的表现。
export const 下载源表 = [
  {
    键: "catmak",
    名: "catmak.name 加速",
    地区: "大陆",
    说明: "通过 gh.catmak.name 转发，适合大陆网络",
    拼: (u) => "https://gh.catmak.name/" + u,
    测速: "https://gh.catmak.name/https://github.com/3671656786/GF-plugin-xjyl/releases/latest",
    需要资产id: false,
  },
  {
    键: "ghproxy",
    名: "gh-proxy.com 加速",
    地区: "大陆",
    说明: "通过 gh-proxy.com 转发，适合大陆网络",
    拼: (u) => "https://gh-proxy.com/" + u,
    测速: "https://gh-proxy.com/https://github.com/3671656786/GF-plugin-xjyl/releases/latest",
    需要资产id: false,
  },
  {
    键: "direct",
    名: "GitHub 直连",
    地区: "国际/港澳台",
    说明: "直接连 github.com，适合网络通畅的环境",
    拼: (u) => u,
    测速: "https://github.com/3671656786/GF-plugin-xjyl/releases/latest",
    需要资产id: false,
  },
  {
    键: "api",
    名: "GitHub 官方 API",
    地区: "国际/港澳台",
    说明: "走 api.github.com 的资产接口，适合能连 API 的环境",
    拼: (u, 资产id) => "https://api.github.com/repos/" + 仓库 + "/releases/assets/" + 资产id,
    测速: "https://api.github.com/rate_limit",
    需要资产id: true,
  },
];

export const 默认源键 = "ghproxy";

// 按键取源
export function 取源(键) {
  return 下载源表.find(x => x.键 === 键) || 下载源表.find(x => x.键 === 默认源键);
}


// 版本号比较：a > b 返回 1，a < b 返回 -1，相等 0
export function 比较版本(a, b) {
  const pa = String(a || "0").split(".").map(Number);
  const pb = String(b || "0").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}


/* ---------- 失败原因诊断（3.1.7） ----------
 * 实测最常见的两类失败都不是"网络断了"，而是**本机代理软件**干扰：
 *   · 代理把 api.github.com 劫持到本地端口，返回 403（被代理拦下）
 *   · 或代理不支持该域名，直接 fetch failed / 连不上
 * 这里把错误翻成人话，并明确给出「关闭代理」/「设直连」的建议，
 * 而不是甩一个 fetch failed 让用户无从下手。
 */
function 诊断失败(r) {
  const 状态 = r && r.状态;
  const 原文 = String((r && r.原因) || "");
  if (状态 === 403 || 状态 === 429) {
    const 分 = r && r.重置秒 ? Math.max(1, Math.ceil((r.重置秒 * 1000 - Date.now()) / 60000)) : 0;
    return {
      限流: true,
      原因: [
        "**GitHub 拒绝访问**（HTTP " + 状态 + "）—— 多半是本机代理 / 加速器拦的，也可能是 API 限流。",
        "",
        "**请先关闭代理 / VPN / 加速器再试**（这类工具常把 github.com 劫持到本地，导致 403）。",
        "如果必须用代理：在代理里把 `github.com` 与 `api.github.com` 设为**直连**。",
        分 ? "（若确实是 API 限流，约 " + 分 + " 分钟后自动恢复）" : "",
      ].filter(Boolean).join("\n"),
    };
  }
  if (/fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|EAI_AGAIN|ENOTFOUND|abort|timeout|超时/i.test(原文)) {
    return {
      原因: [
        "**连不上 GitHub**（" + 原文.slice(0, 40) + "）。",
        "",
        "**如果你开着代理 / VPN / 加速器，请先关闭再试** —— 它们常把 GitHub 域名"
        + "解析到本地一个不工作的端口，表现就是 fetch failed / 超时。",
        "",
        "关掉代理后仍不行，过几分钟再试。",
      ].join("\n"),
    };
  }
  if (状态 === 404) return { 原因: "GitHub 上没有这个版本（可能已被删除）。" };
  return { 原因: "连接 GitHub 失败：" + (原文 || "未知原因") + "\n\n如果开着代理，请先关闭再试。" };
}


/* ---------- 通用的 GitHub API 请求（fetch + https 双通道） ----------
 * 为什么不用裸 fetch：有些环境（代理 / DNS 劫持 / 网络策略）下 undici 的 fetch
 *   会直接 "fetch failed"，而 Node 的 https 模块却能通。所以这里两条都试，
 *   先用 fetch，失败再 https —— 保证「查版本」不会因为单一通道问题直接失败。
 */
// 3.1.8：GitHub API 令牌（填了就 5000 次/小时，不填 60 次/小时）。
// 由界面层在每次请求前用 设令牌() 注入，这里只负责带上 Authorization 头。
let 当前令牌 = "";
export function 设令牌(t) { 当前令牌 = String(t || "").trim(); }
export function 读令牌() { return 当前令牌; }

function 取JSON用fetch(url, 头, 超时毫秒) {
  return (async () => {
    try {
      const ctrl = new AbortController();
      const 计时 = setTimeout(() => ctrl.abort(), 超时毫秒);
      const res = await fetch(url, { headers: 头, redirect: "follow", signal: ctrl.signal });
      clearTimeout(计时);
      if (!res.ok) return { ok: false, 状态: res.status, 原因: "HTTP " + res.status };
      const 文 = await res.text();
      return { ok: true, json: JSON.parse(文), 通道: "fetch" };
    } catch (e) {
      const m = e && e.message ? e.message : String(e);
      return { ok: false, 原因: /abort/i.test(m) ? "超时" : m };
    }
  })();
}

function 取JSON用https(url, 头, 超时毫秒) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ ok: false, 原因: "地址不合法" }); }
    const mod = u.protocol === "http:" ? http : https;
    const req = mod.get(url, { headers: 头, timeout: 超时毫秒 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const 下 = res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, url).toString();
        return resolve(取JSON用https(下, 头, 超时毫秒));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, 状态: res.statusCode, 原因: "HTTP " + res.statusCode });
      }
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        try { resolve({ ok: true, json: JSON.parse(Buffer.concat(chunks).toString("utf8")), 通道: "https", 重置秒: 重置 }); }
        catch (e) { resolve({ ok: false, 原因: "返回内容不是合法 JSON" }); }
      });
    });
    req.on("error", (e) => resolve({ ok: false, 原因: e && e.message ? e.message : String(e) }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, 原因: "超时" }); });
  });
}

// 取 JSON：fetch → https 模块 → 代理隧道，三级顺序兜底。
// 注意这里是**顺序**而不是竞速 —— 竞速会让先返回的那条（哪怕内容是错误页）
// 抢到结果，导致明明能成功却报「不是合法 JSON」。API 查询以正确性优先。
// 最后一级代理是给「服务器必须走代理才能出网」的环境兜底（宿主自己的在线
// 更新就是走代理的，插件以前绕过了它，于是宿主能下、插件不能下）。
async function 取JSON(url, 加认证) {
  const 头 = { "Accept": "application/vnd.github+json", "User-Agent": "xjyl-selfupdate" };
  const tk = 当前令牌 || (加认证 ? String(process.env.XJYL_GH_TOKEN || "") : "");
  if (加认证 && tk) 头["Authorization"] = "Bearer " + tk;
  const a = await 取JSON用fetch(url, 头, 20000);
  if (a.ok) return a;
  const b = await 取JSON用https(url, 头, 20000);
  if (b.ok) return b;
  // 代理兜底
  if (有代理()) {
    try {
      const j = await 代理取JSON(url, 头, 20000);
      return { ok: true, json: j, 通道: "代理" };
    } catch (e) {
      // 代理也失败：继续按原逻辑报错
    }
  }
  // 前两条都失败：优先报「能连上但内容不对」的那种，信息更有用
  if (a.状态 && b.原因 && !b.状态) return b;
  return a.原因 ? a : b;
}


/* ---------- 结果缓存（3.1.6） ----------
 * GitHub 未认证 API 每小时只有 60 次，玩家连点「重新检查」很快就打光。
 * 版本列表 / 单个 Release 的信息变化很慢，缓存 5 分钟完全够用，
 * 既省额度又让面板秒开。失败结果不缓存（限流时不能一直返回旧错误）。
 */
// 3.1.8：GitHub API 令牌（填了就 5000 次/小时，不填 60 次/小时）。
const 信息缓存 = new Map();
const 缓存毫秒 = 5 * 60 * 1000;

function 读缓存(键) {
  const x = 信息缓存.get(键);
  if (!x) return null;
  if (Date.now() - x.时间 > 缓存毫秒) { 信息缓存.delete(键); return null; }
  return x.结果;
}
function 写缓存(键, 结果) {
  if (结果 && 结果.ok) 信息缓存.set(键, { 时间: Date.now(), 结果: 结果 });
}


// 查指定版本的 Release（tag 为空 = 最新）
export async function 查发布(tag) {
  const 键 = tag ? String(tag).replace(/^v/, "") : "__latest__";
  const 缓存 = 读缓存(键);
  if (缓存) return 缓存;

  const 地址 = tag
    ? "https://api.github.com/repos/" + 仓库 + "/releases/tags/v" + String(tag).replace(/^v/, "")
    : Release接口;
  const r = await 取JSON(地址, true);
  if (!r.ok) {
    if (r.状态 === 404 && tag) {
      return { ok: false, 原因: "GitHub 上没有 v" + tag + " 这个版本（可能已被删除）。" };
    }
    const d = 诊断失败(r);
    return { ok: false, 限流: d.限流, 原因: d.原因 };
  }
  const j = r.json;
  if (!j || !j.tag_name) return { ok: false, 原因: "GitHub 返回的 Release 没有版本号" };
  const 版本号 = String(j.tag_name).replace(/^v/, "");
  const 资产 = (Array.isArray(j.assets) ? j.assets : []).find(a => /^GF-plugin-xjyl-v[\d.]+\.zip$/i.test(a.name || ""));
  if (!资产) return { ok: false, 原因: "Release v" + 版本号 + " 里没有插件压缩包" };
  const 结果 = {
    ok: true,
    版本: 版本号,
    标题: String(j.name || j.tag_name || ""),
    发布时间: String(j.published_at || ""),
    说明: String(j.body || ""),
    zip名: 资产.name,
    资产id: 资产.id,
    下载地址: 资产.browser_download_url,
    资产大小: Number(资产.size) || 0,
    页面: String(j.html_url || ""),
  };
  写缓存(键, 结果);
  return 结果;
}


// 查最新版本（兼容旧名字）
export function 查最新版本() { return 查发布(""); }


/**
 * 查所有历史版本（列表，含公告正文）
 * @param {number} 条数 默认 30
 */
export async function 查发布列表(条数) {
  const 取 = Math.max(1, Math.min(100, Math.floor(Number(条数) || 30)));
  const r = await 取JSON("https://api.github.com/repos/" + 仓库 + "/releases?per_page=" + 取, true);
  if (!r.ok) {
    const d = 诊断失败(r);
    return { ok: false, 限流: d.限流, 原因: d.原因 };
  }
  if (!Array.isArray(r.json)) return { ok: false, 原因: "GitHub 返回的版本列表格式不对" };
  const 列表 = r.json.map((j) => {
    const 版本号 = String(j.tag_name || "").replace(/^v/, "");
    const 资产 = (Array.isArray(j.assets) ? j.assets : []).find(a => /^GF-plugin-xjyl-v[\d.]+\.zip$/i.test(a.name || ""));
    return {
      版本: 版本号,
      标题: String(j.name || j.tag_name || ""),
      发布时间: String(j.published_at || ""),
      说明: String(j.body || ""),
      页面: String(j.html_url || ""),
      有包: !!资产,
      zip名: 资产 ? 资产.name : "",
      资产id: 资产 ? 资产.id : 0,
      下载地址: 资产 ? 资产.browser_download_url : "",
      资产大小: 资产 ? (Number(资产.size) || 0) : 0,
    };
  }).filter(x => /^\d+\.\d+/.test(x.版本));
  return { ok: true, 列表: 列表 };
}


/* ---------- 下载底层 ---------- */

// 用 Node 的 https/http 模块下载（比 fetch 更可控：跟随重定向 + 超时 + 代理）
function 下载用模块(url, 头, 重定向次数) {
  return new Promise((resolve) => {
    const 次数 = 重定向次数 || 0;
    if (次数 > 6) return resolve({ ok: false, 原因: "重定向次数过多" });
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ ok: false, 原因: "下载地址不合法：" + url }); }
    const mod = u.protocol === "http:" ? http : https;
    const req = mod.get(url, { headers: 头, timeout: 下载超时毫秒 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const 下 = res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, url).toString();
        return resolve(下载用模块(下, 头, 次数 + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, 原因: "下载返回 HTTP " + res.statusCode });
      }
      const chunks = [];
      let len = 0;
      res.on("data", (d) => { len += d.length; chunks.push(d); });
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 1024) return resolve({ ok: false, 原因: "下载到的文件太小（" + buf.length + " 字节），已放弃" });
        resolve({ ok: true, 内容: buf });
      });
    });
    req.on("error", (e) => resolve({ ok: false, 原因: "下载出错：" + (e && e.message ? e.message : e) }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, 原因: "下载超时（" + Math.round(下载超时毫秒 / 1000) + " 秒）" }); });
  });
}


/**
 * 测某个源的延迟（毫秒）与可用性
 *
 * 测的就是**这个源真正要走的那条下载 URL**（各源拼出来的 zip 地址），
 * 所以测出来的延迟与实际下载表现一致（有些镜像只放行下载路径，
 * 转发网页会被 403，所以不能拿网页地址去测）。
 *
 * @param {object} 源
 * @param {object} 发布信息（含 下载地址 / 资产id）
 */
export async function 测一个源(源, 发布) {
  const 地址 = 源.拼(发布.下载地址, 发布.资产id);
  const 头 = {
    "User-Agent": "Mozilla/5.0 (xjyl-ping)",
    "Accept": 源.需要资产id ? "application/octet-stream" : "*/*",
  };
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const 计时 = setTimeout(() => ctrl.abort(), 10000);
    // 先用 HEAD（最轻，只测建连 + 首字节）
    let res = null;
    try { res = await fetch(地址, { method: "HEAD", headers: 头, redirect: "follow", signal: ctrl.signal }); } catch (e) { /* 换 GET */ }
    if (!res || !res.ok) {
      // HEAD 不支持 → 退回 GET，拿到响应头就取消 body
      res = await fetch(地址, { headers: 头, redirect: "follow", signal: ctrl.signal });
    }
    clearTimeout(计时);
    const 毫秒 = Math.max(1, Date.now() - t0);
    if (!res.ok) return { 源: 源.名, 毫秒: 毫秒, 通: false, 说明: "HTTP " + res.status };
    try { res.body && res.body.cancel && res.body.cancel(); } catch (e) { /* ignore */ }
    return { 源: 源.名, 毫秒: 毫秒, 通: true, 说明: "可用" };
  } catch (e) {
    const m = e && e.message ? e.message : String(e);
    return { 源: 源.名, 毫秒: Date.now() - t0, 通: false, 说明: /abort/i.test(m) ? "超时" : "不通" };
  }
}


/**
 * 一键 Ping：并发测所有下载源，按延迟从低到高排序
 * @returns {Promise<Array<{源,毫秒,通,说明}>>}
 */
export async function 测所有源() {
  const 查 = await 查最新版本();
  if (!查.ok) {
    // 拿不到发布信息就退回用源表里的固定测速地址
    const 结果 = await Promise.all(下载源表.map(async (x) => {
      const t0 = Date.now();
      try {
        const ctrl = new AbortController();
        const 计时 = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(x.测速, { headers: { "User-Agent": "Mozilla/5.0 (xjyl-ping)" }, redirect: "follow", signal: ctrl.signal });
        clearTimeout(计时);
        if (!res.ok) return { 源: x.名, 毫秒: Date.now() - t0, 通: false, 说明: "HTTP " + res.status };
        try { res.body && res.body.cancel && res.body.cancel(); } catch (e) { /* ignore */ }
        return { 源: x.名, 毫秒: Date.now() - t0, 通: true, 说明: "可用" };
      } catch (e) {
        return { 源: x.名, 毫秒: Date.now() - t0, 通: false, 说明: "不通" };
      }
    }));
    return 结果.sort((a, b) => (a.通 !== b.通) ? (a.通 ? -1 : 1) : a.毫秒 - b.毫秒);
  }
  const 结果 = await Promise.all(下载源表.map(x => 测一个源(x, 查)));
  return 结果.sort((a, b) => {
    if (a.通 !== b.通) return a.通 ? -1 : 1;
    return a.毫秒 - b.毫秒;
  });
}


/**
 * 按指定源下载 zip（**固定通道**：只走用户选定的那个源，不自动换源）
 *
 * 同一条源地址内部用 fetch 与 https 模块两条通道竞速，谁先成功用谁 ——
 * 两者请求的是同一个 URL，所以不会「偷偷换源」，只是同一条路上挑快的走法。
 *
 * @param {string} 源键
 * @param {object} 发布信息（含 下载地址 / 资产id）
 */
async function 下载zip单源(源键, 发布) {
  const 源 = 取源(源键);
  if (!源) return { ok: false, 原因: "未知的下载源：" + 源键 };
  const 原始 = 发布.下载地址;
  const 地址 = 源.拼(原始, 发布.资产id);
  const 头 = {
    "User-Agent": "Mozilla/5.0 (xjyl-selfupdate)",
    "Accept": 源.需要资产id ? "application/octet-stream" : "*/*",
  };

  // 通道 A：fetch（带独立超时）
  const 通道A = (async () => {
    try {
      const ctrl = new AbortController();
      const 计时 = setTimeout(() => ctrl.abort(), 下载超时毫秒);
      const res = await fetch(地址, { headers: 头, redirect: "follow", signal: ctrl.signal });
      clearTimeout(计时);
      if (!res.ok) return { ok: false, 原因: "HTTP " + res.status };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) return { ok: false, 原因: "内容过小（" + buf.length + " 字节）" };
      return { ok: true, 内容: buf, 通道: "fetch" };
    } catch (e) {
      return { ok: false, 原因: e && e.message ? e.message : String(e) };
    }
  })();

  // 通道 B：https 模块（跟随重定向，自带超时）—— 同一条源地址
  const 通道B = (async () => {
    const r = await 下载用模块(地址, 头, 0);
    return r.ok ? { ok: true, 内容: r.内容, 通道: "https" } : r;
  })();

  const 胜 = await Promise.race([通道A, 通道B]);
  if (胜.ok) return { ok: true, 内容: 胜.内容, 源: 源.名, 通道: 胜.通道 };

  // 通道 C：代理隧道 —— 服务器必须走代理才能出网时的唯一出路
  // （宿主自己的在线更新就走代理，插件以前完全绕过它，于是宿主能下、插件不能下）
  if (有代理()) {
    try {
      const buf = await 代理下载(地址, 头, 60000);
      if (buf.length >= 1024) return { ok: true, 内容: buf, 源: 源.名, 通道: "代理" };
      return { ok: false, 原因: "代理返回内容过小（" + buf.length + " 字节）" };
    } catch (e) {
      return { ok: false, 原因: "代理失败：" + String((e && e.message) || e).slice(0, 60) };
    }
  }
  return { ok: false, 原因: String(胜.原因 || "").slice(0, 80) || "下载失败" };
}


/**
 * 下载 zip（**首选源优先，失败按顺序降级到其他源**）
 *
 * 为什么还要降级：公共镜像对新发布的文件经常有**同步延迟** —— 实测 catmak 对刚发的
 *   版本返回 404，而同一版本 gh-proxy 正常。死守单一源就会出现「有网络却更新不了」。
 * 用**顺序**而不是并行：并行容易卡在慢源上，也会让人以为「选了 A 却偷偷走 B」。
 * 试了哪些、最后用哪个，都如实报给主人。
 */
export async function 下载zip(源键, 发布) {
  const 首选 = 取源(源键);
  if (!首选) return { ok: false, 原因: "未知的下载源：" + 源键 };
  const 顺序 = [首选].concat(下载源表.filter((x) => x.键 !== 首选.键));
  const 试过 = [];
  for (const 源 of 顺序) {
    const r = await 下载zip单源(源.键, 发布);
    if (r.ok) {
      const 换过 = 源.键 !== 首选.键;
      return {
        ...r,
        换过源: 换过,
        首选源: 首选.名,
        试过: 试过,
        提示: 换过
          ? "首选源「" + 首选.名 + "」不可用（" + (试过[0] ? 试过[0].原因 : "") + ")，已自动改用「" + 源.名 + "」"
          : "",
      };
    }
    试过.push({ 源: 源.名, 原因: String(r.原因 || "").slice(0, 50) });
  }
  return {
    ok: false,
    原因: "所有下载源都失败了：\n" + 试过.map((x) => "· " + x.源 + "：" + x.原因).join("\n"),
    试过: 试过,
  };
}


/**
 * 校验解压内容：必须含 index.mjs 与 package.json，且 package.json 版本与宣称一致
 */
export function 校验包(条目, 期望版本) {
  const index = 条目.get("index.mjs");
  const pkg = 条目.get("package.json");
  if (!index) return { ok: false, 原因: "压缩包里没有 index.mjs，不是有效的插件包" };
  if (!pkg) return { ok: false, 原因: "压缩包里没有 package.json，已放弃（防止装到坏包）" };
  let 版本号 = "";
  try { 版本号 = String(JSON.parse(pkg.toString("utf8")).version || ""); } catch (e) {
    return { ok: false, 原因: "package.json 解析失败，已放弃" };
  }
  if (期望版本 && 版本号 !== 期望版本) {
    return { ok: false, 原因: "包内版本（" + 版本号 + "）与 Release 标注（" + 期望版本 + "）不一致，已放弃" };
  }
  return { ok: true, 版本: 版本号 };
}


/** 备份插件目录（保留最近 N 份） */
export function 备份插件目录(插件目录) {
  const 父 = path.dirname(插件目录);
  const 名 = path.basename(插件目录);
  const 戳 = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const 备份 = path.join(父, 名 + ".bak-" + 戳);
  try {
    fs.cpSync(插件目录, 备份, { recursive: true, force: true });
  } catch (e) {
    return { ok: false, 原因: "备份失败：" + e.message, 路径: "" };
  }
  try {
    const 旧的 = fs.readdirSync(父).filter(x => x.startsWith(名 + ".bak-")).sort();
    while (旧的.length > 备份保留数) {
      fs.rmSync(path.join(父, 旧的.shift()), { recursive: true, force: true });
    }
  } catch (e) { /* 清理失败不影响更新 */ }
  return { ok: true, 路径: 备份 };
}


/** 覆盖安装：逐文件写入插件目录（不删除本地多余文件） */
export function 覆盖安装(条目, 插件目录) {
  let 写了 = 0;
  for (const [名, 内容] of 条目) {
    const 目标 = path.join(插件目录, 名);
    const 相对 = path.relative(插件目录, 目标);
    if (相对.startsWith("..") || path.isAbsolute(相对)) continue;   // 防穿越
    fs.mkdirSync(path.dirname(目标), { recursive: true });
    fs.writeFileSync(目标, 内容);
    写了 += 1;
  }
  return 写了;
}


/** 从某个插件目录读 package.json 版本号（读不到返回空串） */
export function 读包版本(目录) {
  try {
    const raw = fs.readFileSync(path.join(目录, "package.json"), "utf8");
    return String(JSON.parse(raw).version || "");
  } catch (e) { return ""; }
}


/**
 * 执行更新（下载 → 校验 → 备份 → 覆盖 → 回读校验）
 * @param {string} 插件目录   当前运行的插件目录（ctx.pluginPath）
 * @param {string} 目标版本   为空 = 最新版；指定则精确装到那个版本
 * @param {string} 源键       下载源
 * @param {string} 源目录     安装源目录（plugins/<id>）。宿主重载时**会从这里强制覆盖
 *                            到 plugins_two 运行副本**，所以只写运行副本会被覆盖回去 —— 必须两边都写。
 * 不含重载 —— 重载由调用方在回复消息之后做（否则消息发不出去）。
 */
export async function 执行更新(插件目录, 目标版本, 源键, 源目录) {
  const 查 = await 查发布(目标版本);
  if (!查.ok) return { ok: false, 阶段: "查版本", 原因: 查.原因 };
  if (目标版本 && 查.版本 !== String(目标版本).replace(/^v/, "")) {
    return { ok: false, 阶段: "查版本", 原因: "版本不匹配（想要 v" + 目标版本 + "，GitHub 返回 v" + 查.版本 + "）" };
  }
  const 下 = await 下载zip(源键, 查);
  if (!下.ok) return { ok: false, 阶段: "下载", 原因: 下.原因 };
  const 解 = 解压到内存(下.内容);
  if (!解.ok) return { ok: false, 阶段: "解压", 原因: 解.原因 };
  const 校 = 校验包(解.条目, 查.版本);
  if (!校.ok) return { ok: false, 阶段: "校验", 原因: 校.原因 };

  // 要写的目录：源目录（宿主重载的复制来源）+ 运行副本（当前正在跑的）
  const 目标目录组 = [];
  const 源可用 = 源目录 && fs.existsSync(源目录);
  if (源可用) 目标目录组.push({ 角色: "源目录", 路径: 源目录 });
  if (!源可用 || path.resolve(源目录) !== path.resolve(插件目录)) {
    目标目录组.push({ 角色: "运行副本", 路径: 插件目录 });
  }

  const 备份组 = [];
  for (const d of 目标目录组) {
    const 备 = 备份插件目录(d.路径);
    if (!备.ok) return { ok: false, 阶段: "备份", 原因: 备.原因 + "（" + d.角色 + "）" };
    备份组.push({ 角色: d.角色, 路径: 备.路径 });
  }

  const 写入组 = [];
  try {
    for (const d of 目标目录组) {
      写入组.push({ 角色: d.角色, 路径: d.路径, 写了: 覆盖安装(解.条目, d.路径) });
    }
  } catch (e) {
    return { ok: false, 阶段: "覆盖", 原因: "写入失败：" + e.message + "（备份见 " + (备份组[0] && 备份组[0].路径) + "）" };
  }

  // 写后回读：确认磁盘上的版本号真的变成了目标版本（这是「更新到底有没有生效」的硬证据）
  const 回读 = 目标目录组.map((d) => ({ 角色: d.角色, 路径: d.路径, 版本: 读包版本(d.路径) }));
  const 没写对 = 回读.filter((x) => x.版本 !== 校.版本);
  if (没写对.length) {
    return {
      ok: false,
      阶段: "回读校验",
      原因: "写入后磁盘版本没对上（期望 v" + 校.版本 + "，实际 " +
        没写对.map((x) => x.角色 + " v" + (x.版本 || "未知")).join(" / ") + "）",
    };
  }

  return {
    ok: true,
    旧版本: 版本,
    新版本: 校.版本,
    备份: 备份组.map((x) => x.角色 + "：" + x.路径).join("\n"),
    写了: 写入组.reduce((a, x) => a + x.写了, 0),
    写入: 写入组,
    回读: 回读,
    标题: 查.标题,
    页面: 查.页面,
    源: 下.源 || "",
  };
}
