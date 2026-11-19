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
import { 解压到内存 } from "./../core/unzip.mjs?v=v1795109502978";
import { 版本 } from "./../core/base.mjs?v=v1795109502978";

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

export const 默认源键 = "catmak";

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


// 查 GitHub 最新 Release
export async function 查最新版本() {
  const ctrl = new AbortController();
  const 计时 = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(Release接口, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "xjyl-selfupdate" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        原因: res.status === 403 || res.status === 429
          ? "GitHub API 限流了（HTTP " + res.status + "），请过几分钟再试"
          : "GitHub 返回 HTTP " + res.status + "（可能是网络问题）",
      };
    }
    const j = await res.json();
    const tag = String(j.tag_name || "").replace(/^v/, "");
    if (!tag) return { ok: false, 原因: "GitHub 返回的 Release 没有版本号" };
    // 只认本插件的 zip 资产
    const 资产 = (Array.isArray(j.assets) ? j.assets : []).find(a => /^GF-plugin-xjyl-v[\d.]+\.zip$/i.test(a.name || ""));
    if (!资产) return { ok: false, 原因: "最新 Release 里没有找到插件压缩包（GF-plugin-xjyl-vX.Y.Z.zip）" };
    return {
      ok: true,
      版本: tag,
      标题: String(j.name || j.tag_name || ""),
      发布时间: String(j.published_at || ""),
      说明: String(j.body || ""),
      zip名: 资产.name,
      资产id: 资产.id,
      下载地址: 资产.browser_download_url,
      资产大小: Number(资产.size) || 0,
      页面: String(j.html_url || ""),
    };
  } catch (e) {
    const m = e && e.message ? e.message : String(e);
    return { ok: false, 原因: /abort/i.test(m) ? "连接 GitHub API 超时（20 秒），请检查网络或改用其他下载源" : "连接 GitHub API 失败：" + m };
  } finally {
    clearTimeout(计时);
  }
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
export async function 下载zip(源键, 发布) {
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
  return { ok: false, 原因: "下载失败（源：" + 源.名 + "，" + String(胜.原因 || "").slice(0, 60) + "）。可换个源再试" };
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


/**
 * 执行更新（下载 → 校验 → 备份 → 覆盖）
 * 不含重载 —— 重载由调用方在回复消息之后做（否则消息发不出去）。
 */
export async function 执行更新(插件目录, 目标版本, 源键) {
  const 查 = await 查最新版本();
  if (!查.ok) return { ok: false, 阶段: "查版本", 原因: 查.原因 };
  if (目标版本 && 查.版本 !== 目标版本) {
    return { ok: false, 阶段: "查版本", 原因: "最新版本已变成 v" + 查.版本 + "（你确认的是 v" + 目标版本 + "），请重新发起更新" };
  }
  const 下 = await 下载zip(源键, 查);
  if (!下.ok) return { ok: false, 阶段: "下载", 原因: 下.原因 };
  const 解 = 解压到内存(下.内容);
  if (!解.ok) return { ok: false, 阶段: "解压", 原因: 解.原因 };
  const 校 = 校验包(解.条目, 查.版本);
  if (!校.ok) return { ok: false, 阶段: "校验", 原因: 校.原因 };
  const 备 = 备份插件目录(插件目录);
  if (!备.ok) return { ok: false, 阶段: "备份", 原因: 备.原因 };
  let 写了 = 0;
  try {
    写了 = 覆盖安装(解.条目, 插件目录);
  } catch (e) {
    return { ok: false, 阶段: "覆盖", 原因: "写入失败：" + e.message + "（已保留备份：" + 备.路径 + "）" };
  }
  return {
    ok: true,
    旧版本: 版本,
    新版本: 校.版本,
    备份: 备.路径,
    写了: 写了,
    标题: 查.标题,
    页面: 查.页面,
    源: 下.源 || "",
  };
}
