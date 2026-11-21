// lib/media/parse.mjs —— 3.3.0 多平台视频/图文链接解析
// 参考宿主 src/tools/media/*（blbl / dy / xhs / ks / yt / tt / x / tg）的公开端点精简移植。
// 全程内存解析，不落盘、不缓存。统一返回 { ok, platform, type, title, author, cover, videoUrl, images, description, duration, message }
import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const UA_M = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function S(v) { return v === undefined || v === null ? "" : String(v); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

async function getText(url, opts = {}) {
  const headers = Object.assign({ "User-Agent": opts.ua || UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" }, opts.headers || {});
  const r = await fetch(url, { method: "GET", redirect: "follow", headers, signal: AbortSignal.timeout(opts.timeout || 20000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.text();
}
async function getJson(url, opts = {}) {
  const t = await getText(url, opts);
  try { return JSON.parse(t); } catch (e) { throw new Error("返回非JSON"); }
}
async function finalUrl(url, opts = {}) {
  const r = await fetch(url, { method: "GET", redirect: "follow", headers: { "User-Agent": opts.ua || UA_M }, signal: AbortSignal.timeout(opts.timeout || 15000) });
  return r.url || url;
}
function escMd(s) { return S(s).replace(/[*_`\[\]<>]/g, " ").replace(/\s+/g, " ").trim(); }
function unescapeHtml(s) {
  return S(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function findUrl(text) {
  const s = S(text);
  const m = s.match(/https?:\/\/[^\s<>「」『』【】（）()"'，。；]+/i);
  return m ? m[0].replace(/[),.;,，。；：]+$/, "") : "";
}
function empty(platform, message) { return { ok: false, platform: platform || "", message: message || "解析失败", type: "", title: "", author: "", cover: "", videoUrl: "", images: [], description: "", duration: null }; }

/* ---------- 平台识别 ---------- */
export function detectPlatform(text) {
  const s = S(text);
  const u = findUrl(text).toLowerCase();
  // B站：b23.tv / bilibili.com / 裸 BV 号 / av 号 / opus（精确域名，避免误判成抖音）
  if (/b23\.tv\/|bilibili\.com|bilibili\.cn/.test(u) || /\bBV[a-zA-Z0-9]{10}\b/.test(s) || /^\s*av\d{1,12}\s*$/i.test(s)) return "blbl";
  // 抖音：只认 douyin.com / iesdouyin.com，不认 b23.tv（B站短链）
  if (/douyin\.com|iesdouyin\.com/.test(u)) return "dy";
  // 小红书：国内+国际版 + 两组短链
  if (/xiaohongshu\.com|rednote\.com|xhslink\.(cn|com)|xhsurl\.(cn|com)|xhs\.com/.test(u)) return "xhs";
  if (/kuaishou\.com|chenzhongtech\.com/.test(u)) return "ks";
  if (/tiktok\.com/.test(u)) return "tt";
  if (/youtube\.com|youtu\.be/.test(u)) return "yt";
  // Telegram 在 X 之前（t.me 与 t.co 都是 t. 开头，避免误吃）
  if (/(?:^|[^a-z])(?:www\.|m\.)?(?:t\.me|telegram\.me|telegram\.dog)\//i.test(s) && !u) return "tg";
  if (/t\.me|telegram\.me|telegram\.dog/.test(u)) return "tg";
  // X 放最后
  if (/(?:x\.com|twitter\.com|fxtwitter\.com|fixupx\.com|vxtwitter\.com|t\.co)\//i.test(u)) return "x";
  // 3.3.0：网盘链接 → 归为视频类（网盘分享里的视频，需客户端打开，给出说明）
  if (/pan\.baidu\.com|yun\.baidu\.com|pan\.quark\.cn|alipan\.com|aliyundrive\.com|115\.com|pan\.xunlei\.com|caiyun\.com/.test(u)) return "pan";
  return "";
}

/* ---------- B站（复用 blbl.mjs） ---------- */
async function parseBlbl(text) {
  const mod = await import("./../api/blbl.mjs");
  const out = await mod.parse(findUrl(text));
  if (!out || out.状态码 !== 200 || !out.数据) return empty("blbl", (out && out.消息) || "B站解析失败");
  const d = out.数据, imgs = Array.isArray(d.图片) ? d.图片 : [];
  return {
    ok: true, platform: "blbl", type: imgs.length && !d.视频链接 ? "image" : "video",
    title: S(d.视频标题), author: S(d.UP主信息 && d.UP主信息.UP主名称),
    cover: S(d.视频封面), videoUrl: S(d.视频链接), images: imgs,
    description: String(d.视频描述 || "").slice(0, 200),
    duration: S(d.视频时长) || null,
    stats: { views: num(d.播放次数), likes: num(d.点赞数量), coins: num(d.投币数量) }
  };
}

/* ---------- 抖音 ---------- */
async function parseDy(text) {
  let url = findUrl(text);
  if (/v\.douyin\.com|iesdouyin/.test(url)) url = await finalUrl(url);
  const m = url.match(/(?:video|note|slides)\/(\d+)/) || url.match(/modal_id=(\d+)/);
  const id = m ? m[1] : "";
  if (!id) return empty("dy", "无法提取抖音作品ID");
  const j = await getJson(`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}&aid=6383`, {
    ua: UA, headers: { Referer: "https://www.douyin.com/", Origin: "https://www.douyin.com" }
  });
  const d = j.aweme_detail || (j.aweme_details && j.aweme_details[0]);
  if (!d) return empty("dy", "抖音解析失败（作品可能已删除或需登录）");
  let videoUrl = "";
  try {
    const play = d.video && (d.video.play_addr || (d.video.download_addr && d.video.download_addr.url_list && d.video.download_addr.url_list[0]));
    if (play && play.url_list && play.url_list[0]) videoUrl = play.url_list[0];
  } catch (e) { /* ignore */ }
  const images = (d.images || []).map((x) => {
    const l = x.url_list || [];
    return l[0] || "";
  }).filter(Boolean);
  return {
    ok: true, platform: "dy", type: images.length && !videoUrl ? "image" : "video",
    title: S(d.desc || "").slice(0, 120) || "抖音作品", author: S(d.author && d.author.nickname),
    cover: S(d.video && d.video.cover && d.video.cover.url_list && d.video.cover.url_list[0]) || images[0] || "",
    videoUrl, images, description: S(d.desc || "").slice(0, 200),
    duration: d.video && d.video.duration ? Math.round(num(d.video.duration) / 1000) : null,
    stats: { views: num(d.statistics && d.statistics.play_count), likes: num(d.statistics && d.statistics.digg_count) }
  };
}

/* ---------- 小红书 ---------- */
async function parseXhs(text) {
  let url = findUrl(text);
  if (/xhslink\.cn|xhslink\.com/.test(url)) url = await finalUrl(url, { ua: UA });
  const m = url.match(/(?:explore|discovery\/item)\/([0-9a-f]{16,32})/i);
  const id = m ? m[1] : "";
  if (!id) return empty("xhs", "无法提取小红书笔记ID");
  const html = await getText(`https://www.xiaohongshu.com/explore/${id}`, { ua: UA });
  let data = null;
  const sm = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (sm) { try { data = JSON.parse(sm[1]); } catch (e) { /* ignore */ } }
  const note = data && data.note && data.note.noteDetailMap && data.note.noteDetailMap[id] && data.note.noteDetailMap[id].note;
  if (!note) return empty("xhs", "小红书解析失败（可能需要 xsec_token 或已删除）");
  const imgList = (note.imageList || []).map((x) => {
    const u = x.urlDefault || x.url || "";
    if (!u) return "";
    return u.startsWith("http") ? u : "https://sns-img-hw.xhscdn.com/" + u.replace(/^\//, "");
  }).filter(Boolean);
  let videoUrl = "";
  const stream = note.video && note.video.media && note.video.media.stream;
  if (stream) {
    const h264 = stream.h264 && stream.h264[0];
    if (h264 && h264.masterUrl) videoUrl = h264.masterUrl;
  }
  return {
    ok: true, platform: "xhs", type: note.type === "video" || videoUrl ? "video" : "image",
    title: S(note.title || note.desc || "").slice(0, 120) || "小红书笔记",
    author: S(note.user && note.user.nickname), cover: imgList[0] || "", videoUrl,
    images: imgList, description: S(note.desc || "").slice(0, 200), duration: null,
    stats: { likes: num(note.interactInfo && note.interactInfo.likedCount) }
  };
}

/* ---------- 快手 ---------- */
async function parseKs(text) {
  let url = findUrl(text);
  try { url = await finalUrl(url, { ua: UA_M }); } catch (e) { /* ignore */ }
  const m = url.match(/(?:short-video|photo|video)\/([\w-]+)/);
  const id = m ? m[1] : "";
  if (!id) return empty("ks", "无法提取快手作品ID");
  const html = await getText(url, { ua: UA_M });
  let photo = null;
  const sm = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (sm) {
    try {
      const st = JSON.parse(sm[1]);
      for (const k of Object.keys(st)) if (/photo|Photo/.test(k) && st[k] && st[k].caption) { photo = st[k]; break; }
    } catch (e) { /* ignore */ }
  }
  if (!photo) {
    const pm = html.match(/"caption":"([^"]+)"[\s\S]{0,2000}?"playUrl":"([^"]+)"/);
    if (pm) photo = { caption: pm[1], playUrl: pm[2] };
  }
  if (!photo) return empty("ks", "快手解析失败（页面结构变化或已删除）");
  let videoUrl = S(photo.playUrl || (photo.video && photo.video.playUrl) || "");
  videoUrl = videoUrl.replace(/\\u002F|\//g, (x) => x === "\\u002F" ? "/" : x).replace(/\\\//g, "/");
  const cover = S(photo.coverUrl || (photo.video && photo.video.cover) || "");
  return {
    ok: true, platform: "ks", type: "video", title: S(photo.caption || "快手作品").slice(0, 120),
    author: S(photo.userName || (photo.user && photo.user.name)), cover, videoUrl, images: [],
    description: S(photo.caption || "").slice(0, 200), duration: photo.duration ? Math.round(num(photo.duration) / 1000) : null
  };
}

/* ---------- YouTube ---------- */
async function parseYt(text) {
  const url = findUrl(text);
  let vid = "";
  const m1 = url.match(/(?:v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  const m2 = url.match(/youtu\.be\/([\w-]{11})/);
  vid = (m1 || m2) ? (m1 || m2)[1] : "";
  if (!vid) return empty("yt", "无法提取 YouTube 视频ID");
  const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA, "X-YouTube-Client-Name": "3", "X-YouTube-Client-Version": "19.29.37" },
    body: JSON.stringify({ videoId: vid, context: { client: { clientName: "ANDROID", clientVersion: "19.29.37", androidSdkVersion: 30, hl: "zh", gl: "US" } }, contentCheckOk: true, racyCheckOk: true }),
    signal: AbortSignal.timeout(20000)
  });
  const p = await r.json();
  const st = p.playabilityStatus && p.playabilityStatus.status;
  if (st && st !== "OK") return empty("yt", "无法播放：" + S((p.playabilityStatus && p.playabilityStatus.reason) || st));
  const d = p.videoDetails || {};
  const sd = p.streamingData || {};
  let videoUrl = "";
  const fmts = (sd.formats || []).concat(sd.adaptiveFormats || []);
  const pick = fmts.filter((f) => f.url && f.qualityLabel).sort((a, b) => (num(b.width) * num(b.height)) - (num(a.width) * num(a.height)))[0];
  if (pick) videoUrl = pick.url;
  const thumbs = (d.thumbnail && d.thumbnail.thumbnails) || [];
  return {
    ok: true, platform: "yt", type: "video", title: S(d.title || "YouTube"),
    author: S(d.author), cover: thumbs.length ? thumbs[thumbs.length - 1].url : "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg",
    videoUrl, images: [], description: S(d.shortDescription || "").slice(0, 200),
    duration: d.lengthSeconds ? num(d.lengthSeconds) : null,
    stats: { views: num(d.viewCount) }
  };
}

/* ---------- TikTok ---------- */
async function parseTt(text) {
  let url = findUrl(text);
  if (/vm\.tiktok\.com|vt\.tiktok\.com/.test(url)) url = await finalUrl(url, { ua: UA_M });
  const m = url.match(/\/video\/(\d+)/) || url.match(/\/photo\/(\d+)/);
  const id = m ? m[1] : "";
  if (!id) return empty("tt", "无法提取 TikTok 视频ID");
  const html = await getText(`https://www.tiktok.com/@user/video/${id}`, { ua: UA_M }).catch(() => "");
  let d = null;
  const sm = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (sm) {
    try {
      const u = JSON.parse(sm[1]);
      const dv = u && u.__DEFAULT_SCOPE__ && u.__DEFAULT_SCOPE__["webapp.video-detail"] && u.__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo;
      d = dv && dv.itemStruct;
    } catch (e) { /* ignore */ }
  }
  if (!d) return empty("tt", "TikTok 解析失败（可能需要登录或地区限制）");
  let videoUrl = "";
  try { videoUrl = (d.video && d.video.downloadAddr) || (d.video && d.video.playAddr) || ""; } catch (e) { /* ignore */ }
  return {
    ok: true, platform: "tt", type: "video", title: S(d.desc || "TikTok").slice(0, 120),
    author: S(d.author && d.author.uniqueId), cover: S(d.video && d.video.cover) || S(d.video && d.video.originCover) || "",
    videoUrl, images: [], description: S(d.desc || "").slice(0, 200), duration: d.video && d.video.duration ? num(d.video.duration) : null
  };
}

/* ---------- X / Twitter ---------- */
async function parseX(text) {
  const url = findUrl(text);
  const m = url.match(/\/status\/(\d+)/);
  const id = m ? m[1] : "";
  if (!id) return empty("x", "无法提取推文ID");
  const j = await getJson(`https://api.fxtwitter.com/status/${id}`, { ua: UA }).catch(() => null);
  const t = j && j.tweet;
  if (!t) return empty("x", "X 解析失败（fxtwitter 接口不可用）");
  let videoUrl = "";
  if (t.media && t.media.videos && t.media.videos.all && t.media.videos.all[0]) videoUrl = S(t.media.videos.all[0].url);
  else if (t.media && t.media.video) videoUrl = S(t.media.video.url);
  const photos = (t.media && t.media.photos && t.media.photos.all || []).map((p) => S(p.url)).filter(Boolean);
  return {
    ok: true, platform: "x", type: videoUrl ? "video" : (photos.length ? "image" : "text"),
    title: S(t.text || "推文").slice(0, 120), author: S(t.author && (t.author.name || t.author.screen_name)),
    cover: photos[0] || S(t.media && t.media.video && t.media.video.thumbnail) || "",
    videoUrl, images: photos, description: S(t.text || "").slice(0, 200), duration: null,
    stats: { likes: num(t.likes), views: num(t.views) }
  };
}

/* ---------- Telegram ---------- */
async function parseTg(text) {
  const url = findUrl(text);
  if (!/t\.me\//.test(url)) return empty("tg", "非 Telegram 链接");
  const html = await getText(url, { ua: UA });
  const meta = (name) => {
    const m = html.match(new RegExp('<meta[^>]+(?:property|name)="' + name + '"[^>]+content="([^"]*)"', "i"));
    return m ? unescapeHtml(m[1]) : "";
  };
  const title = meta("og:title") || meta("twitter:title");
  const cover = meta("og:image") || meta("twitter:image");
  const desc = meta("og:description") || meta("twitter:description");
  const videos = [...html.matchAll(/(https?:[^"'<>\s]+\.mp4[^"'<>\s]*)/g)].map((x) => unescapeHtml(x[1]));
  const photos = [...html.matchAll(/(https?:[^"'<>\s]+\.(?:jpg|jpeg|png|webp)[^"'<>\s]*)/g)].map((x) => unescapeHtml(x[1]));
  if (!title && !videos.length && !photos.length) return empty("tg", "Telegram 解析失败（可能需要登录或链接无效）");
  return {
    ok: true, platform: "tg", type: videos.length ? "video" : (photos.length ? "image" : "text"),
    title: title.slice(0, 120) || "Telegram", author: "", cover, videoUrl: videos[0] || "",
    images: photos.slice(0, 9), description: desc.slice(0, 200), duration: null
  };
}

/* ---------- 网盘（识别为视频链接，但需客户端打开） ---------- */
async function parsePan(text) {
  const url = findUrl(text);
  let 名字 = "网盘";
  if (/baidu/.test(url)) 名字 = "百度网盘";
  else if (/quark/.test(url)) 名字 = "夸克网盘";
  else if (/ali|aliyun/.test(url)) 名字 = "阿里云盘";
  else if (/115\.com/.test(url)) 名字 = "115网盘";
  else if (/xunlei/.test(url)) 名字 = "迅雷云盘";
  const 码 = (url.match(/\/s\/([a-zA-Z0-9_-]+)/) || [])[1] || "";
  return {
    ok: true, platform: "pan", type: "video",
    title: 名字 + (码 ? " 分享（提取码可能需要）" : " 分享链接"),
    author: "", cover: "", videoUrl: "", images: [],
    description: "网盘视频无法直接播放：请用对应网盘 App 打开链接下载/在线看。若链接带提取码，需按网盘提示输入。",
    duration: null, 提示: "网盘链接已识别为视频类，但需客户端打开，无直链。"
  };
}

/* ---------- 统一入口 ---------- */
export async function parseLink(text) {
  const platform = detectPlatform(text);
  if (!platform) return empty("", "未识别的平台（支持 B站/抖音/小红书/快手/TikTok/YouTube/X/Telegram）");
  try {
    if (platform === "blbl") return await parseBlbl(text);
    if (platform === "dy") return await parseDy(text);
    if (platform === "xhs") return await parseXhs(text);
    if (platform === "ks") return await parseKs(text);
    if (platform === "yt") return await parseYt(text);
    if (platform === "tt") return await parseTt(text);
    if (platform === "x") return await parseX(text);
    if (platform === "tg") return await parseTg(text);
    if (platform === "pan") return await parsePan(text);
  } catch (e) {
    return empty(platform, "解析出错：" + (e && e.message ? e.message : String(e)));
  }
  return empty(platform, "暂不支持该平台");
}

export const 平台名 = { blbl: "B站", dy: "抖音", xhs: "小红书", ks: "快手", tt: "TikTok", yt: "YouTube", x: "X(推特)", tg: "Telegram", pan: "网盘视频" };
export { findUrl, escMd, S };
