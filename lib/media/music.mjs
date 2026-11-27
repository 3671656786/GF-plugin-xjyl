// lib/media/music.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { 安全发音频 } from "./../admin/edit.mjs?v=v1795793040169";
import { S, dget, ds, dset, escMd, mdImg } from "./../core/base.mjs?v=v1795793040169";
import { btn, cmdInput, reply, row, sendVideo, 发音乐卡片, 发音乐语音 } from "./../core/qq.mjs?v=v1795793040169";
import { P } from "./../core/util.mjs?v=v1795793040169";
import { SRC } from "./../game/pvp.mjs?v=v1795793040169";

export function 构建音乐信息Md(d, src) { return detailMd(d, src); }


export function srcDefault(ctx, u) { const v = ds(ctx, P.音乐音源, u, ""); return SRC.indexOf(v) >= 0 ? v : "汽水"; }


export function srcList(src, kw) {
  const k = encodeURIComponent(kw);
  if (src === "QQ") return "https://a.aa.cab/qq.music?msg=" + k + "&num=10";
  if (src === "汽水") return "https://api-v2.cenguigui.cn/api/qishui/?msg=" + k + "&type=json";
  if (src === "酷我") return "https://oiapi.net/api/Kuwo?msg=" + k + "&limit=20";
  return "https://oiapi.net/api/Music_163?name=" + k + "&limit=20";
}


export function srcPick(src, kw, i) {
  const k = encodeURIComponent(kw);
  if (src === "QQ") return "https://a.aa.cab/qq.music?msg=" + k + "&num=10&n=" + i;
  if (src === "汽水") return "https://api-v2.cenguigui.cn/api/qishui/?msg=" + k + "&type=json&n=" + i;
  if (src === "酷我") return "https://oiapi.net/api/Kuwo?msg=" + k + "&n=" + i;
  return "https://oiapi.net/api/Music_163?name=" + k + "&limit=20&n=" + i;
}


export async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}


export function parseItem(src, it) {
  if (src === "网易云") {
    const sg = (it && it.singers && it.singers[0]) || {};
    return { 歌名: S(it && it.name), 歌手: S(sg.name) };
  }
  if (src === "酷我") return { 歌名: S(it && it.song), 歌手: S(it && it.singer) };
  return { 歌名: S(it && (it.song || it.title)), 歌手: S(it && it.singer) };
}


export function parseDetail(src, raw) {
  const d = (raw && raw.data) || {};
  if (src === "汽水") return { 歌名: S(d.title), 歌手: S(d.singer), 封面: S(d.cover), 链接: S(d.music) };
  if (src === "酷我") return { 歌名: S(d.song), 歌手: S(d.singer), 封面: S(d.picture), 链接: S(d.url) };
  if (src === "QQ") return { 歌名: S(d.song), 歌手: S(d.singer), 封面: S(d.cover), 链接: S(d.music) };
  const sg = (d.singers && d.singers[0]) || {};
  return { 歌名: S(d.name), 歌手: S(sg.name), 封面: S(d.picurl), 链接: S(d.url) };
}


export async function musicMenu(ctx, t) {
  await reply(ctx, t, [
    "# 🎵 星甲 音乐",
    "",
    "## 点歌",
    "- `点歌小团圆` — 用上次选的音源（默认汽水）",
    "- `QQ点歌歌名` · `汽水点歌歌名` · `酷我点歌歌名` · `网易云点歌歌名`",
    "",
    "## 选歌",
    "- `选歌1` — 信息卡 + 可播放音频",
    "- `链接选歌1` — 只给音频直链",
    "",
    "## 收藏",
    "- `个人歌单` / `我的收藏`",
    "- `收藏歌曲1` · `取消收藏2` · `取消收藏3-5`",
    "- `播放收藏1` · `链接播放收藏1` · `清空个人收藏歌曲`",
    "",
    "## 音源",
    "- `音源汽水` / `音源QQ` / `音源酷我` / `音源网易` 切换默认音源",
    "",
    "**音源**：QQ云汐 · 汽水 · 酷我 · 网易云（第三方接口，无结果就换一个）"
  ].join("\n"), {
    标题: "",
    行组: [
      row(btn("mu1", "点歌（补歌名）", "点歌"), btn("mu2", "个人歌单", "个人歌单")),
      // 2.6.0：这几个按钮只是「填入指令前缀」，点完还要自己补歌名，标签写清楚避免误以为点了就出歌
      row(btn("mu3", "QQ点歌+歌名", "QQ点歌"), btn("mu4", "汽水点歌+歌名", "汽水点歌"), btn("mu5", "酷我点歌+歌名", "酷我点歌")),
      row(btn("mu6", "网易云点歌+歌名", "网易云点歌"), btn("mu7", "音源汽水", "音源汽水"), btn("mu8", "菜单", "菜单"))
    ]
  });
}


export async function musicSearch(ctx, t, u, src, kw, persist) {
  const s = S(kw);
  if (!s) { await reply(ctx, t, "请在指令后写歌名，例：`点歌小团圆`", { 标题: "🎵 点歌" }); return; }
  if (SRC.indexOf(src) < 0) { await reply(ctx, t, "未知音源，支持：" + SRC.join(" / "), { 标题: "🎵 点歌" }); return; }
  if (persist) dset(ctx, P.音乐音源, u, src);
  let raw;
  try { raw = await getJson(srcList(src, s)); }
  catch (e) {
    if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 点歌失败:", e);
    await reply(ctx, t, "**" + src + "** 接口不可达，稍后再试或换个音源。", { 标题: "🎵 点歌失败" });
    return;
  }
  const arr = raw && raw.data;
  if (!Array.isArray(arr) || !arr.length) {
    await reply(ctx, t, "**" + src + "** 没找到「" + escMd(s) + "」，换个音源试试。", {
      标题: "🎵 无结果",
      按钮: [btn("ms1", "汽水点歌", "汽水点歌"), btn("ms2", "酷我点歌", "酷我点歌"), btn("ms3", "网易云点歌", "网易云点歌")]
    });
    return;
  }
  const items = arr.slice(0, 10).map((x) => parseItem(src, x));
  dset(ctx, P.音乐歌单, u, { 音源: src, 搜索: s, count: items.length, data: items });
  const lines = ["## 【" + src + "】搜索结果", "", "共 **" + items.length + "** 首，点序号填入 `选歌序号`"];
  for (let i = 0; i < items.length; i++) lines.push(cmdInput("选歌" + (i + 1), (i + 1) + ". " + escMd(items[i].歌名)) + " — _" + escMd(items[i].歌手) + "_");
  lines.push("", "---", "_选好后确认发送即可播放_");
  await reply(ctx, t, lines.join("\n"), {
    标题: "",
    行组: [row(btn("ml1", "选歌1", "选歌1"), btn("ml2", "选歌2", "选歌2"), btn("ml3", "选歌3", "选歌3"), btn("ml4", "个人歌单", "个人歌单"))]
  });
}


export async function musicDetail(ctx, u, idx) {
  const ses = dget(ctx, P.音乐歌单, u, null);
  if (!ses || typeof ses !== "object") return null;
  if (idx < 1 || idx > ses.count) return null;
  const raw = await getJson(srcPick(ses.音源, ses.搜索, idx));
  const d = parseDetail(ses.音源, raw);
  if (d.链接.length < 10) return null;
  return { 音源: ses.音源, 详情: d };
}


export function detailMd(d, src) {
  const lines = ["## " + (escMd(d.歌名) || "未知歌曲"), ""];
  if (d.歌手) lines.push("**歌手** " + escMd(d.歌手), "");
  if (src) lines.push("**音源** " + escMd(src), "");
  if (/^https?:\/\//i.test(d.封面)) lines.push(mdImg(d.封面, d.歌名), "");
  lines.push("---", "_下面这条音频点一下就能播_");
  return lines.join("\n");
}


export async function musicPick(ctx, t, u, idx, mode) {
  const ses = dget(ctx, P.音乐歌单, u, null);
  if (!ses || typeof ses !== "object") { await reply(ctx, t, "还没有点歌记录，先发 `点歌歌名`。", { 标题: "🎵 选歌失败" }); return; }
  if (idx < 1 || idx > ses.count) { await reply(ctx, t, "序号要在 1 ~ " + ses.count + " 之间。", { 标题: "🎵 选歌失败" }); return; }
  let out;
  try { out = await musicDetail(ctx, u, idx); }
  catch (e) {
    if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 选歌失败:", e);
    await reply(ctx, t, "接口异常，稍后再试。", { 标题: "🎵 选歌失败" });
    return;
  }
  if (!out) { await reply(ctx, t, "**" + ses.音源 + "** 接口返回异常，换个音源再试。", { 标题: "🎵 选歌失败" }); return; }
  if (mode === "link") {
    await reply(ctx, t, ["## " + escMd(out.详情.歌名), "", "**歌手** " + escMd(out.详情.歌手), "", "**音频直链**", "", "`" + out.详情.链接 + "`"].join("\n"), { 标题: "" });
    return;
  }
  // 旧版行为：优先官方音乐 Ark 卡片，失败回退 Markdown 信息卡（含封面），再发音频
  const arkOk = await 发音乐卡片(ctx, t, out.详情);
  if (!arkOk) await reply(ctx, t, detailMd(out.详情, out.音源), { 标题: "" });
  try { await 安全发音频(ctx, t, out.详情.链接, out.详情.歌名 + " - " + out.详情.歌手); }
  catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 音频发送异常:", e);
  }
}


export async function musicFav(ctx, t, u, idx) {
  const ses = dget(ctx, P.音乐歌单, u, null);
  if (!ses || typeof ses !== "object") { await reply(ctx, t, "先点歌再收藏。", { 标题: "🎵 收藏失败" }); return; }
  if (idx < 1 || idx > ses.count) { await reply(ctx, t, "序号要在 1 ~ " + ses.count + " 之间。", { 标题: "🎵 收藏失败" }); return; }
  const it = ses.data[idx - 1];
  const v = dget(ctx, P.音乐收藏, u, []);
  const list = Array.isArray(v) ? v : [];
  list.push({ 搜索: ses.搜索, 序号: idx, 音源: ses.音源, 歌名: it.歌名, 歌手: it.歌手 });
  dset(ctx, P.音乐收藏, u, list);
  await reply(ctx, t, "已收藏 **" + escMd(it.歌名) + "** — _" + escMd(it.歌手) + "_\n当前收藏 " + list.length + " 首", {
    标题: "🎵 收藏成功", 按钮: [btn("mf1", "个人歌单", "个人歌单"), btn("mf2", "播放收藏1", "播放收藏1")]
  });
}


export async function musicUnfav(ctx, t, u, lo, hi) {
  const v = dget(ctx, P.音乐收藏, u, []);
  const list = Array.isArray(v) ? v : [];
  const a = Math.min(lo, hi), b = Math.max(lo, hi);
  if (!list.length || a < 1 || a > list.length) { await reply(ctx, t, "序号无效，当前收藏 " + list.length + " 首。", { 标题: "🎵 取消失败" }); return; }
  const up = Math.min(b, list.length);
  const cut = list.slice(a - 1, up);
  const rest = list.filter((x, i) => i < a - 1 || i >= up);
  dset(ctx, P.音乐收藏, u, rest);
  await reply(ctx, t, ["已取消收藏 " + cut.length + " 首："].concat(cut.map((x) => "- " + x.歌名)).concat(["", "剩余 " + rest.length + " 首"]).join("\n"), {
    标题: "🎵 已取消收藏"
  });
}


export async function musicPlayFav(ctx, t, u, idx, mode) {
  const v = dget(ctx, P.音乐收藏, u, []);
  const list = Array.isArray(v) ? v : [];
  if (idx < 1 || idx > list.length) { await reply(ctx, t, "收藏共 " + list.length + " 首，序号超出范围。", { 标题: "🎵 播放失败" }); return; }
  const it = list[idx - 1];
  try {
    const raw = await getJson(srcPick(it.音源, it.搜索, it.序号));
    const d = parseDetail(it.音源, raw);
    if (d.链接.length < 10) { await reply(ctx, t, "接口返回异常，稍后再试。", { 标题: "🎵 播放失败" }); return; }
    if (mode === "link") {
      await reply(ctx, t, ["## " + escMd(d.歌名), "", "**歌手** " + escMd(d.歌手), "", "**音频直链**", "", "`" + d.链接 + "`"].join("\n"), { 标题: "" });
      return;
    }
    await reply(ctx, t, detailMd(d, it.音源), { 标题: "" });
    await 安全发音频(ctx, t, d.链接, d.歌名 + " - " + d.歌手);
  } catch (e) {
    if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 播放收藏失败:", e);
    await reply(ctx, t, "播放异常，稍后再试。", { 标题: "🎵 播放失败" });
  }
}


export async function musicList(ctx, t, u) {
  const v = dget(ctx, P.音乐收藏, u, []);
  const list = Array.isArray(v) ? v : [];
  if (!list.length) {
    await reply(ctx, t, "个人歌单还是空的。\n点歌后用 `收藏歌曲1` 添加。", {
      标题: "🎵 个人歌单", 按钮: [btn("mg1", "点歌", "点歌"), btn("mg2", "音乐菜单", "音乐系统")]
    });
    return;
  }
  const lines = ["## 个人歌单", "", "共 **" + list.length + "** 首"];
  list.forEach((x, i) => lines.push((i + 1) + ". **[" + x.音源 + "]** " + escMd(x.歌名) + " — _" + escMd(x.歌手) + "_"));
  lines.push("", "---", "_`播放收藏1` · `链接播放收藏1` · `取消收藏1`_");
  await reply(ctx, t, lines.join("\n"), {
    标题: "",
    行组: [row(btn("mh1", "播放收藏1", "播放收藏1"), btn("mh2", "取消收藏1", "取消收藏1"), btn("mh3", "清空收藏", "清空个人收藏歌曲"))]
  });
}


export async function musicClear(ctx, t, u) {
  const v = dget(ctx, P.音乐收藏, u, []);
  const len = Array.isArray(v) ? v.length : 0;
  dset(ctx, P.音乐收藏, u, []);
  await reply(ctx, t, "已清空 " + len + " 首收藏。", { 标题: "🎵 收藏已清空" });
}


export function biliUrl(text) {
  const s = S(text);
  const a = s.match(/https?:\/\/b23\.tv\/[A-Za-z0-9]+/i);
  if (a) return a[0];
  const b = s.match(/https?:\/\/(?:www\.)?bilibili\.com\/video\/BV[A-Za-z0-9]{10}/i);
  return b ? b[0] : "";
}


export async function biliDo(ctx, t, text) {
  const url = biliUrl(text);
  if (!url) return false;
  try {
    const mod = await import("./../api/blbl.mjs");
    const out = await mod.parse(url);
    if (!out || out.状态码 !== 200 || !out.数据) {
      await reply(ctx, t, "解析失败：" + ((out && out.消息) || "未知错误"), { 标题: "📺 B站解析" });
      return true;
    }
    const d = out.数据;
    const head = (d["UP主信息"] && d["UP主信息"].UP主名称) || "未知";
    const lines = [
      "## " + escMd(d["视频标题"] || "视频解析"),
      "",
      "**UP主** " + escMd(head),
      "**时长** " + (d["视频时长"] || "-") + " · **大小** " + (d["视频大小"] || "-"),
      "**播放** " + (d["播放次数"] || 0) + " · **点赞** " + (d["点赞数量"] || 0) + " · **投币** " + (d["投币数量"] || 0),
      "",
      "**简介** " + escMd(String(d["视频描述"] || "无").slice(0, 120))
    ];
    const cover = S(d["视频封面"]);
    if (/^https?:\/\//i.test(cover)) lines.push("", mdImg(cover, "封面"));
    lines.push("", "---", "_下面是视频本体，点一下播放_");
    await reply(ctx, t, lines.join("\n"), { 标题: "" });
    const direct = S(d["视频链接"]);
    if (direct) {
      try { await sendVideo(ctx, t, direct, ""); }
      catch (e) {
        if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 视频发送失败:", e);
        await reply(ctx, t, "视频本体发送失败（可能超过官方限制）。\n[▶ 点这里播放视频](" + direct + ")", { 标题: "📺 视频" });
      }
    }
    return true;
  } catch (e) {
    if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] B站解析异常:", e);
    await reply(ctx, t, "解析出错：" + (e && e.message ? e.message : String(e)), { 标题: "📺 B站解析" });
    return true;
  }
}



// 音乐指令统一入口（放在最后，函数声明会被提升）
export async function musicCmd(ctx, t, u, m0) {
  const m = S(m0);
  // 2.6.0 修复：`星甲音乐` 原来进不来（文档与词典都在用这个短名）
  if (m === "音乐系统" || m === "音乐功能" || m === "音乐菜单" || m === "点歌" || m === "音乐") { await musicMenu(ctx, t); return true; }
  let sw = m.match(/^(?:切换音源|音源|默认音源)\s*(QQ|qq|汽水|酷我|网易云|网易)?$/);
  if (sw) {
    const raw = S(sw[1]).toLowerCase();
    if (!raw) {
      await reply(ctx, t, "当前默认音源：**" + srcDefault(ctx, u) + "**\n可用：" + SRC.join(" / ") + "\n用法：`音源汽水`", { 标题: "🎵 默认音源" });
      return true;
    }
    const src = raw === "qq" ? "QQ" : raw === "网易" ? "网易云" : S(sw[1]);
    dset(ctx, P.音乐音源, u, src);
    await reply(ctx, t, "默认音源已切换为 **" + src + "**。\n直接发 `点歌歌名` 就会用它。", {
      标题: "🎵 音源已切换", 按钮: [btn("mx1", "点歌", "点歌"), btn("mx2", "音乐菜单", "音乐系统")]
    });
    return true;
  }
  let pt = m.match(/^(酷我|汽水|网易云|QQ|)点歌([\s\S]+)$/);
  if (pt) {
    const pre = S(pt[1]), kw = S(pt[2]);
    await musicSearch(ctx, t, u, pre || srcDefault(ctx, u), kw, Boolean(pre));
    return true;
  }
  let pk = m.match(/^(链接|卡片|)选歌([0-9]{1,2})$/);
  if (pk) { await musicPick(ctx, t, u, Number(pk[2]), pk[1] === "链接" ? "link" : "card"); return true; }
  let pv = m.match(/^语音选歌([0-9]{1,2})$/);
  if (pv) { await 发音乐语音(ctx, t); return true; }
  if (m === "个人歌单" || m === "我的收藏" || m === "我的歌单") { await musicList(ctx, t, u); return true; }
  // 2.6.0：序号改成可选 —— 只发「收藏歌曲」时回用法，而不是静默无反应
  let fa = m.match(/^(?:收藏音乐|收藏歌曲)\s*#?\s*([0-9]{1,2})?$/);
  if (fa) {
    if (!fa[1]) { await reply(ctx, t, "用法：`星甲收藏歌曲1`（先用 `星甲点歌 歌名` 搜到歌，再按序号收藏）", { 标题: "🎵 收藏" }); return true; }
    await musicFav(ctx, t, u, Number(fa[1])); return true;
  }
  let un = m.match(/^取消收藏([0-9]{1,2})(?:[-_.~]([0-9]{1,2}))?$/);
  if (un) { await musicUnfav(ctx, t, u, Number(un[1]), un[2] ? Number(un[2]) : Number(un[1])); return true; }
  let pl = m.match(/^(链接|)播放收藏([0-9]{1,2})$/);
  if (pl) { await musicPlayFav(ctx, t, u, Number(pl[2]), pl[1] === "链接" ? "link" : "card"); return true; }
  if (m === "清空个人收藏歌曲" || m === "清空个人收藏音乐" || m === "清空收藏") { await musicClear(ctx, t, u); return true; }
  return false;
}
