/* ============================================================
 * lib/core/http-proxy.mjs —— HTTP CONNECT 代理通道（3.1.12）
 * ------------------------------------------------------------
 * 为什么需要它：
 *   宿主的 src/tools/media/http-proxy.ts 有一套完整的代理实现（X 解析、twimg
 *   下载走的就是它），但那是宿主内部模块，插件 import 不到。插件原来的下载是
 *   **纯直连** fetch / https —— 于是出现「宿主的在线更新能下、插件的在线更新
 *   下不了」：服务器明明配了代理（或需要走代理才能出网），插件却绕过了它。
 *
 * 这里把宿主的思路搬过来，零依赖实现：
 *   · 代理地址依次读 X_PROXY_URL / HTTPS_PROXY / HTTP_PROXY（大小写都认，
 *     因为 Linux 惯例是小写、Windows 不区分大小写，只认大写会让 Linux 上
 *     配好的代理静默失效）；
 *   · 值为 off / false / none / direct 时视为「不启用代理」；
 *   · 用 HTTP CONNECT 隧道把 https 请求包进去，手动跟随重定向。
 *
 * 为什么不用 fetch 的代理选项：Node 内置 fetch（undici）**不支持**代理，
 * 必须自己建隧道。这也是宿主当初手写这份代码的原因。
 * ============================================================ */
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { Readable } from "node:stream";

/** 默认代理端口（与宿主 http-proxy.ts 保持一致） */
const 默认代理地址 = "http://127.0.0.1:7897";

/**
 * 读环境变量，大小写都认。
 * 只认大写等于让 Linux 用户配好的 http_proxy/https_proxy 完全失效（Linux 严格
 * 区分大小写），这正是宿主踩过的坑，这里不重复。
 */
function 读环境变量(名) {
  return (
    process.env[名] ||
    process.env[名.toLowerCase()] ||
    process.env[名.toUpperCase()] ||
    ""
  );
}

/**
 * 取当前应使用的代理地址；没有可用代理时返回空串。
 */
export function 取代理地址() {
  const raw = String(
    读环境变量("X_PROXY_URL") ||
    读环境变量("HTTPS_PROXY") ||
    读环境变量("HTTP_PROXY") ||
    ""
  ).trim();
  if (!raw) return "";
  if (/^(off|false|none|direct)$/i.test(raw)) return "";
  // 允许用户写 "7897" 这种只有端口的写法 → 补成 http://127.0.0.1:7897
  if (/^\d+$/.test(raw)) return "http://127.0.0.1:" + raw;
  if (!/^https?:\/\//i.test(raw)) return "http://" + raw;
  return raw;
}

/** 是否配置了代理 */
export function 有代理() {
  return !!取代理地址();
}

/** 建立到代理的 CONNECT 隧道 */
function 连隧道(代理, 主机, 端口, 超时毫秒) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 代理.hostname,
      port: Number(代理.port) || 80,
      method: "CONNECT",
      path: `${主机}:${端口}`,
      headers: {
        Host: `${主机}:${端口}`,
        ...(代理.username || 代理.password
          ? {
            "Proxy-Authorization": "Basic " +
              Buffer.from(`${decodeURIComponent(代理.username)}:${decodeURIComponent(代理.password)}`).toString("base64"),
          }
          : {}),
      },
      timeout: 超时毫秒,
    });
    req.once("connect", (res, socket) => {
      if (res.statusCode === 200) return resolve(socket);
      socket.destroy();
      reject(new Error("代理 CONNECT 失败（HTTP " + res.statusCode + "）"));
    });
    req.once("timeout", () => req.destroy(new Error("代理连接超时")));
    req.once("error", reject);
    req.end();
  });
}

/**
 * 经代理请求 https 目标，手动跟随重定向，返回 Buffer。
 * 代理不可用时抛错，由调用方决定是否直连兜底。
 */
export async function 代理下载(url, 头 = {}, 超时毫秒 = 30000, 最大跳转 = 4) {
  const 代理地址 = 取代理地址();
  if (!代理地址) throw new Error("未配置代理");
  const 代理 = new URL(代理地址);

  let 当前 = url;
  for (let 跳 = 0; ; 跳++) {
    const 目标 = new URL(当前);
    if (目标.protocol !== "https:") throw new Error("代理请求仅支持 https 目标");
    const 端口 = Number(目标.port) || 443;

    const 套接字 = await 连隧道(代理, 目标.hostname, 端口, 超时毫秒);
    try {
      const res = await new Promise((resolve, reject) => {
        const tlsSocket = tls.connect({ socket: 套接字, servername: 目标.hostname });
        tlsSocket.once("secureConnect", () => {
          const 计时 = setTimeout(() => reject(new Error("代理请求超时")), 超时毫秒);
          // 必须用自定义 Agent 覆盖 createConnection，否则 Node 会忽略
          // 已建立的隧道、转头直连被墙域名。
          const agent = new https.Agent({ keepAlive: false, maxSockets: 1 });
          agent.createConnection = () => tlsSocket;
          const req = https.request(
            目标,
            { method: "GET", headers: { ...头, Host: 目标.host }, agent },
            (msg) => {
              clearTimeout(计时);
              resolve(msg);
            },
          );
          req.once("error", (e) => {
            clearTimeout(计时);
            reject(e);
          });
          req.end();
        });
        tlsSocket.once("error", reject);
      });

      const 状态 = res.statusCode || 0;
      const 位置 = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(状态) && 位置 && 跳 < 最大跳转) {
        res.destroy();
        当前 = new URL(位置, 目标).toString();
        continue;
      }
      if (状态 < 200 || 状态 >= 300) {
        res.destroy();
        throw new Error("HTTP " + 状态);
      }

      const 块 = [];
      for await (const c of res) 块.push(c);
      return Buffer.concat(块);
    } catch (e) {
      套接字.destroy();
      throw e;
    }
  }
}

/**
 * 经代理取 JSON（用于查版本 —— 版本查询比下载更容易被限流/拦截）。
 */
export async function 代理取JSON(url, 头 = {}, 超时毫秒 = 20000) {
  const buf = await 代理下载(url, { ...头, Accept: "application/vnd.github+json, application/json, */*" }, 超时毫秒);
  return JSON.parse(buf.toString("utf8"));
}
