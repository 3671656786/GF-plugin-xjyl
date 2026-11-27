// lib/media/parseCmd.mjs —— 3.3.0 解析命令 + 群自动解析开关
import { S, dget, dset, escMd, mdImg } from "./../core/base.mjs?v=v1795804329240";
import { reply, row, btn, sendVideo } from "./../core/qq.mjs?v=v1795804329240";
import { isGm } from "./../core/util.mjs?v=v1795804329240";
import { isOwner } from "./../admin/admin.mjs?v=v1795804329240";
import { parseLink, findUrl, detectPlatform, 平台名 } from "./parse.mjs?v=v1795804329240";

const 档开关 = "游戏数据/设置/自动解析.json";   // key=群openid → "开"/"关"

export function 自动解析开(ctx, 群) {
  return ds2(ctx, 档开关, S(群)) === "开";
}
function ds2(ctx, rel, key) {
  const v = dget(ctx, rel, key, "");
  return v === undefined || v === null ? "" : String(v);
}

// 开关命令（群主/管理员/主人）
export async function 自动解析开关(ctx, t, u, ev, 开) {
  const g = S(t && t.group_openid);
  if (!g) { await reply(ctx, t, "自动解析只能在群里开关。", { 标题: "⚙️ 自动解析" }); return; }
  const ok = isGm(ev) || isOwner(ctx, ev);
  if (!ok) {
    await reply(ctx, t, "只有群主 / 管理员 / 主人可以设置自动解析。", { 标题: "⚙️ 权限不足" });
    return;
  }
  dset(ctx, 档开关, g, 开 ? "开" : "关");
  const 说明 = 开
    ? ["> 本群现在**所有链接都会自动解析**，不需要前缀。", "> 关闭：发 `星甲关闭自动解析`。", "> 手动解析（`星甲解析`）依然可用，两者共存。"]
    : ["> 本群已关闭自动解析。发 `星甲解析 <链接>` 或 `星甲<链接>` 仍可手动解析。"];
  await reply(ctx, t, [
    "## ⚙️ 自动解析已" + (开 ? "开启" : "关闭"),
    ""
  ].concat(说明).join("\n"), {
    标题: "⚙️ 自动解析" + (开 ? "开启" : "关闭"),
    行组: [row(btn("ap1", 开 ? "关闭自动解析" : "开启自动解析", 开 ? "星甲关闭自动解析" : "星甲开启自动解析"), btn("ap2", "解析帮助", "星甲解析帮助"))]
  });
}

// 解析并发送结果（统一各平台）
export async function 发解析结果(ctx, t, 文本, 静默) {
  const url = findUrl(文本);
  if (!url) { if (!静默) await reply(ctx, t, "没找到链接。用法：`星甲解析 <链接>`", { 标题: "🔗 解析" }); return; }
  // 3.3.0：只解析视频/图文平台链接 —— 非视频链接（普通网页/文章）不解析、不刷屏
  const 平台 = detectPlatform(url);
  if (!平台) { if (!静默) await reply(ctx, t, "这个链接不是支持的视频平台（支持 B站/抖音/小红书/快手/TikTok/YouTube/X/Telegram/网盘）。", { 标题: "🔗 解析" }); return; }
  await reply(ctx, t, "⏳ 正在解析 " + (平台名[平台] || "链接") + "…", { 标题: "🔗 解析中", 无绑定引导: true });
  const r = await parseLink(url);
  if (!r.ok) {
    await reply(ctx, t, "> 解析失败：" + escMd(r.message), { 标题: "🔗 解析失败" });
    return;
  }
  const lines = [
    "## " + escMd(r.title || "链接解析"),
    "",
    "**平台** " + (平台名[r.platform] || r.platform) + (r.type ? " · **类型** " + (r.type === "image" ? "图文" : "视频") : ""),
    r.author ? "**作者** " + escMd(r.author) : "",
    r.duration ? "**时长** " + (typeof r.duration === "number" ? r.duration + " 秒" : r.duration) : "",
    r.stats && r.stats.views ? "**播放** " + r.stats.views : ""
  ].filter(Boolean);
  let 正文 = lines.join("\n");
  if (r.description) 正文 += "\n\n**简介** " + escMd(r.description.slice(0, 150));
  if (/^https?:\/\//i.test(r.cover)) 正文 += "\n\n" + mdImg(r.cover, "封面");
  if (r.images && r.images.length) {
    正文 += "\n\n**图集**（" + r.images.length + " 张）：";
    for (const im of r.images.slice(0, 9)) if (/^https?:\/\//i.test(im)) 正文 += "\n" + mdImg(im, "图");
  }
  if (r.videoUrl) 正文 += "\n\n_下面是视频本体，点一下播放_";
  await reply(ctx, t, 正文, { 标题: "", 无绑定引导: true });
  if (/^https?:\/\//i.test(r.videoUrl)) {
    try { await sendVideo(ctx, t, r.videoUrl, ""); }
    catch (e) {
      if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 视频本体发送失败:", e);
      await reply(ctx, t, "视频本体发送失败（可能超过官方限制）。\n[▶ 点这里播放视频](" + r.videoUrl + ")", { 标题: "🔗 视频直链", 无绑定引导: true });
    }
  }
}

export async function 解析帮助(ctx, t) {
  await reply(ctx, t, [
    "## 🔗 视频 / 图文解析",
    "",
    "支持：**B站 / 抖音 / 小红书 / 快手 / TikTok / YouTube / X(推特) / Telegram**",
    "",
    "**手动解析**（任何时候可用）：",
    "> `星甲解析 <链接>` 或把链接直接跟在 `星甲` 后面发给我",
    "",
    "**自动解析**（群主/管理员/主人设置）：",
    "> `星甲开启自动解析` → 本群所有链接自动解析，无需前缀",
    "> `星甲关闭自动解析` → 关闭（默认关闭）",
    "",
    "> 解析不落盘、不缓存。"
  ].join("\n"), {
    标题: "🔗 解析帮助",
    行组: [row(btn("ph1", "开启自动解析", "星甲开启自动解析"), btn("ph2", "关闭自动解析", "星甲关闭自动解析"))]
  });
}
