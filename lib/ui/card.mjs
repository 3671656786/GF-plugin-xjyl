// lib/ui/card.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S, dget, dn, ds, dset, fmt, kfmt, rnd, wait, ymd } from "./../core/base.mjs?v=v1795172705997";
import { actBtn, btn, reply, row, sendMedia, sendSegs, upload, 段_图片url, 段_图片本地, 蓝链, 解析插件相对路径 } from "./../core/qq.mjs?v=v1795172705997";
import { 暴击率上限, 装备图标行, 闪避上限 } from "./../core/rules.mjs?v=v1795172705997";
import { P } from "./../core/util.mjs?v=v1795172705997";
import { players } from "./../game/alliance.mjs?v=v1795172705997";
import { 灰块 } from "./../game/cook.mjs?v=v1795172705997";
import { 设血量 } from "./../game/dungeon.mjs?v=v1795172705997";
import { 槽名, 槽强化, 等级显示, 装备槽 } from "./../game/equip.mjs?v=v1795172705997";
import { 累计经验需求 } from "./../game/player.mjs?v=v1795172705997";
import { addCoin, addCore, attrs, byGid, gid, pwrOf, recPwr, 加经验, 玩家可用词条键, 玩家激活词条, 词条定义, 词条面板文本 } from "./../game/player.mjs?v=v1795172705997";
import { tInc } from "./../game/progress.mjs?v=v1795172705997";
import { rankTitle } from "./../game/pvp.mjs?v=v1795172705997";
import { 修甲拦截, 溢出文案, 溢出转经验 } from "./../game/rebirth.mjs?v=v1795172705997";
import fs from "node:fs";
import path from "node:path";

// ---------- 默认资源 / Sharp 图片渲染 ----------
// 读取 data/默认资源/<rel>（旧版资源目录：text/运势.json、text/URL.json、image/*.png）
export function 读默认资源(ctx, rel, fb) {
  try {
    const p = 解析插件相对路径(ctx, "默认资源/" + rel);
    if (!fs.existsSync(p)) return fb;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) { return fb; }
}


export const 内置签文 = [
  { Sorte: "大吉", Estrelas: "★★★★★★★", signText: "福星高照，万事如意", unSignText: "运势极佳，事业财运感情皆顺。宜把握时机，积极进取。" },
  { Sorte: "中吉", Estrelas: "★★★★★★☆", signText: "云开见月，花发逢春", unSignText: "困境将过，好运来临，稳中求进。" },
  { Sorte: "小吉", Estrelas: "★★★★★☆☆", signText: "春回大地，万物复苏", unSignText: "新的开始，运势平稳上升，宜脚踏实地。" },
  { Sorte: "吉", Estrelas: "★★★★☆☆☆", signText: "贵人相助，事倍功半", unSignText: "多结交良友，善用外力，可化解困难。" },
  { Sorte: "半吉", Estrelas: "★★★☆☆☆☆", signText: "山路崎岖，行路艰难", unSignText: "运势平平，有惊无险，稳守当前。" },
  { Sorte: "平", Estrelas: "★★☆☆☆☆☆", signText: "风平浪静，波澜不惊", unSignText: "运势平稳，顺其自然，知足常乐。" },
  { Sorte: "凶", Estrelas: "☆☆☆☆☆☆☆", signText: "乌云遮月，前路茫茫", unSignText: "运势低迷，宜静不宜动，等待时机转变。" },
  { Sorte: "大凶", Estrelas: "☆☆☆☆☆☆☆", signText: "狂风暴雨，舟船飘摇", unSignText: "运势极差，宜修身养性，避免冒险。" }
];


export let _sharp缓存 = undefined;
export function 清Sharp缓存() { _sharp缓存 = undefined; }


export async function 取Sharp(ctx) {
  if (_sharp缓存 !== undefined) return _sharp缓存;
  _sharp缓存 = null;
  try {
    const deps = path.join(S(ctx && ctx.dataPath), "runtime-deps");
    const cands = [
      path.join(deps, "node_modules", "sharp", "lib", "index.js"),
      path.join(S(ctx && ctx.dataPath), "..", "node_modules", "sharp", "lib", "index.js")
    ];
    for (const c of cands) {
      try {
        if (!fs.existsSync(c)) continue;
        const mod = await import("file://" + c.replace(/\\/g, "/"));
        _sharp缓存 = mod.default || mod;
        break;
      } catch (e) { /* 继续尝试 */ }
    }
    if (!_sharp缓存) {
      try { const mod = await import("sharp"); _sharp缓存 = mod.default || mod; } catch (e) { /* 不可用 */ }
    }
  } catch (e) { _sharp缓存 = null; }
  return _sharp缓存;
}


export async function 渲染SVG为PNG(ctx, svg) {
  const sharp = await 取Sharp(ctx);
  if (!sharp) return null;
  try { return await sharp(Buffer.from(svg)).png().toBuffer(); } catch (e) { return null; }
}


// 生成并发送卡片图；返回是否成功
export async function 发卡片图(ctx, t, svg, note) {
  const buf = await 渲染SVG为PNG(ctx, svg);
  if (!buf) return false;
  try {
    const info = await upload(ctx, t, { data: buf.toString("base64") }, 1);
    await sendMedia(ctx, t, info, S(note));
    return true;
  } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 卡片图发送失败:", e);
    return false;
  }
}


// 2.2.7：修复图片文字重叠 —— 支持自定义 x 与对齐方式（原来标签/数值都画在 x=40）
export function 行文本(text, x, y, size, color, weight, anchor) {
  return '<text x="' + x + '" y="' + y + '" fill="' + color + '" font-size="' + size + '"' +
    (weight ? ' font-weight="' + weight + '"' : "") +
    (anchor ? ' text-anchor="' + anchor + '"' : "") +
    ' font-family="Microsoft YaHei, sans-serif">' + escXml(text) + "</text>";
}


export function escXml(v) {
  return String(v === undefined || v === null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


// 「我的信息卡」SVG（Sharp 渲染；不可用时降级文本）
export function 属性卡SVG(ctx, u) {
  const p = attrs(ctx, u);
  const 联盟 = ds(ctx, P.联盟, u, "") || "未加入";
  const rows = [
    ["等级", String(p.等级)],
    ["经验", p.经验 + " / " + 累计经验需求(p.等级 + 1) + "（累计，手动升级）"],
    ["战力", String(pwrOf(ctx, u))],
    ["攻击", String(p.攻击)],
    ["血量", p.血量 + " / " + p.血量上限],
    ["蓝量（全局）", (Number(p.蓝量) || 0) + " / " + (Number(p.蓝量上限) || 100)],
    ["攻击 / 防御", p.攻击 + " / " + p.防御],
    ["暴击率 / 暴伤", p.暴击率.toFixed(2) + "% / " + p.暴伤.toFixed(2) + "%"],
    ["暴击点 / 闪避率", p.暴击 + " / " + p.闪避.toFixed(2) + "%"],
    ["转生 / 强化", p.转生 + " 次 / " + p.强化 + " 次"],
    ["星羽 / 存款", p.星羽 + " / " + p.存款],
    ["金币（装备货币）", String(p.金币)],
    ["星核 / 贡献", p.星核 + " / " + p.贡献],
    ["联盟 / 军衔", 联盟 + " / " + rankTitle(ctx, u)]
  ];
  let h = '<svg xmlns="http://www.w3.org/2000/svg" width="820" height="' + (170 + rows.length * 44 + 40) + '">';
  h += '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">';
  h += '<stop offset="0%" stop-color="#111527"/><stop offset="100%" stop-color="#1d2540"/></linearGradient></defs>';
  h += '<rect width="100%" height="100%" fill="url(#bg)"/>';
  h += '<rect x="0" y="0" width="820" height="6" fill="#4a6cf7"/>';
  h += 行文本("星甲 战甲资料", 40, 62, 30, "#e8ecff", "bold");
  h += 行文本("#" + p.编号 + "  " + p.昵称, 40, 104, 22, "#8ab4ff");
  let y = 160;
  for (const r of rows) {
    h += '<rect x="30" y="' + (y - 26) + '" width="760" height="36" rx="8" fill="#1b2138"/>';
    h += 行文本(r[0], 56, y, 20, "#9aa3c7");                          // 标签：左侧
    h += 行文本(r[1], 764, y, 20, "#e8ecff", "", "end");              // 数值：右对齐（原来重叠在 x=40）
    y += 44;
  }
  h += 行文本("生成于 " + fmt(), 40, y + 6, 16, "#6b7396");
  h += "</svg>";
  return h;
}



// 属性面板（2.3.0：按新版 UI 的灰色行样式，纯文本）
export async function 属性面板(ctx, t, u) {
  // 2.5.44：打开面板时先把「超出上限的暴击率 / 闪避率」折算成经验（老存档也在这里补转）
  const 溢出 = 溢出转经验(ctx, u);
  const p = attrs(ctx, u);
  const 槽 = 装备槽(ctx, u);
  const 行 = [
    "用户:" + gid(ctx, u),
    "昵称:" + p.昵称,
    "等级:" + p.等级 + "　经验:" + p.经验 + "/" + 累计经验需求(p.等级 + 1) + "（累计）",
    // 3.0.0（需求 15/20）：补职业与血量条，信息层级对齐参考 UI
    "职业:" + (p.职业 || "未转职（发 `星甲职业` 看转职）"),
    "",
    "当前装备",
    "武器:" + (槽名(槽, "武器") ? 装备图标行(槽名(槽, "武器"), "武器") + " Lv." + 等级显示(槽强化(槽, "武器")) : "无"),
    "防具:" + (槽名(槽, "护甲") ? 装备图标行(槽名(槽, "护甲"), "护甲") + " Lv." + 等级显示(槽强化(槽, "护甲")) : "无"),
    "",
    "攻击力:" + p.攻击,
    "防御力:" + p.防御,
    "暴击率:" + p.暴击率.toFixed(2) + "%（上限 " + 暴击率上限 + "%，超出转经验）",
    "暴击伤害:" + p.暴伤.toFixed(2) + "%（幸运星 +5%/颗）",
    "闪避率:" + p.闪避.toFixed(2) + "%（上限 " + 闪避上限 + "%，超出转经验）",
    "暴击点:" + p.暴击 + "（装备升级获得，计入战力）",
    "血量:" + p.血量 + "/" + p.血量上限 + "　" + (function () {
      const 比 = p.血量上限 > 0 ? Math.max(0, Math.min(1, p.血量 / p.血量上限)) : 0;
      const 格 = Math.round(比 * 10);
      return "█".repeat(格) + "░".repeat(10 - 格) + " " + Math.round(比 * 100) + "%";
    })(),
    // 3.2.0（需求 1）：蓝量改为全局资源 —— 属性面板显示当前蓝量 / 上限（上限 = 100 + 等级×5 + 装备/称号加成）
    "蓝量:" + (Number(p.蓝量) || 0) + "/" + (Number(p.蓝量上限) || 100) + "　" + (function () {
      const 顶 = Math.max(1, Number(p.蓝量上限) || 100);
      const 比 = Math.max(0, Math.min(1, (Number(p.蓝量) || 0) / 顶));
      const 格 = Math.round(比 * 10);
      return "█".repeat(格) + "░".repeat(10 - 格) + " " + Math.round(比 * 100) + "%";
    })() + "（全局 · 技能耗 10~40 蓝 · 每回合回 5 · 不够自动喝蓝药）",
    溢出文案(溢出, "💡 ") || null,
    "",
    "词条（共 " + 词条定义.length + " 条 · 全部开放 · 各自上限 · 特殊词条只出在传说装备上）",
    词条面板文本(p, 玩家激活词条(ctx, u)),
    "",
    "星羽:" + kfmt(p.星羽) + "　存款:" + kfmt(p.存款),
    "金币:" + kfmt(p.金币) + "　星核:" + p.星核,
    "转生:" + p.转生 + " 次　强化:" + p.强化 + " 次",
    "联盟:" + (ds(ctx, P.联盟, u, "") || "未加入") + "　军衔:" + rankTitle(ctx, u),
    "",
    "战力:" + kfmt(pwrOf(ctx, u)),
    "",
    "操作：" + 蓝链([
      ["星甲装备", "查看装备"], ["星甲背包", "背包"], ["星甲升级装备", "升级装备"],
      ["星甲副本", "副本"], ["星甲BOSS列表", "BOSS"], ["星甲打坐", "打坐"], ["星甲菜单", "菜单"]
    ])
  ].filter((x) => x !== null && x !== undefined && x !== false);
  // 3.1.0：词条段是多行字符串，作为数组元素时只有第一行会被加「>」——先按行摊平再统一灰底
  const 词条行 = String(词条面板文本(p, 玩家激活词条(ctx, u))).split("\n");
  const 摊平 = [];
  for (const x of 行) {
    if (typeof x === "string" && x.indexOf("\n") >= 0) 摊平.push(...x.split("\n"));
    else 摊平.push(x);
  }
  const 正文 = 灰块(摊平);
  await reply(ctx, t, 正文, {
    标题: "🛡️ 战甲资料",
    行组: [
      row(actBtn("st1", "⚡探索", "explore|5"), actBtn("st2", "⚡打坐", "meditate"), btn("st3", "副本", "副本"), btn("st4", "BOSS列表", "BOSS列表")),
      row(btn("st5", "转生", "转生"), btn("st6", "升级装备", "升级装备"), btn("st7", "背包", "背包"), btn("st8", "星甲菜单", "星甲菜单"))
    ]
  });
}



// 发送属性卡：2.3.0 起统一使用文本面板（与新版 UI 一致）
export async function 发属性卡(ctx, t, u, 标题) {
  await 属性面板(ctx, t, u);
}



/* ---------- 今日运势卡：把签文叠在运势图上（Sharp 渲染，思路来自 GF-plugin-xinjia）---------- */
export const 运势字体 = "Microsoft YaHei, Noto Sans SC, sans-serif";


export const 运势粉色 = "#FFB6C1";


export function 换行文本(text, per, max) {
  const s = String(text === undefined || text === null ? "" : text);
  const 上限 = Math.max(1, Number(max) || 1);
  const out = [];
  let buf = "";
  for (const ch of s) {
    if (ch === "\n" || ch === "\r") { if (buf) { out.push(buf); buf = ""; } continue; }
    buf += ch;
    if (buf.length >= per) { out.push(buf); buf = ""; }
    if (out.length >= 上限) break;
  }
  if (buf && out.length < 上限) out.push(buf);
  return out.length ? out : [""];
}


export function 运势卡SVG(w, h, card) {
  const c = card || {};
  const pad = 30;
  const cardW = Math.min(480, w - 40);
  const cardX = Math.round((w - cardW) / 2);
  const 主行 = 换行文本(c.signText, 20, 2);
  const 细行 = 换行文本(c.unSignText, 24, 6);
  const cardH = pad + 108 + 主行.length * 26 + 14 + 细行.length * 24 + 26;
  const cardY = Math.max(24, h - 50 - cardH);
  const 左 = cardX + pad;
  const 主顶 = cardY + 132;
  const 细顶 = 主顶 + 20 + 主行.length * 26 + 10;
  const p = [];
  p.push('<rect x="' + cardX + '" y="' + cardY + '" width="' + cardW + '" height="' + cardH + '" rx="32" ry="32" fill="rgba(12,12,18,0.55)" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>');
  p.push('<text x="' + 左 + '" y="' + (cardY + 46) + '" font-family="' + 运势字体 + '" font-size="13" font-weight="900" fill="' + 运势粉色 + '" letter-spacing="1">time:' + escXml(c.time) + "</text>");
  p.push('<text x="' + 左 + '" y="' + (cardY + 80) + '" font-family="' + 运势字体 + '" font-size="26" font-weight="700" fill="#ffffff">' + escXml(c.Sorte) + "</text>");
  p.push('<text x="' + 左 + '" y="' + (cardY + 110) + '" font-family="' + 运势字体 + '" font-size="18" fill="' + 运势粉色 + '">' + escXml(c.Estrelas) + "</text>");
  p.push('<rect x="' + 左 + '" y="' + (主顶 + 2) + '" width="4" height="24" rx="2" fill="#ffffff" opacity="0.95"/>');
  主行.forEach((line, i) => {
    p.push('<text x="' + (左 + 17) + '" y="' + (主顶 + 20 + i * 26) + '" font-family="' + 运势字体 + '" font-size="19" font-weight="600" fill="#ffffff">' + escXml(line) + "</text>");
  });
  p.push('<line x1="' + 左 + '" y1="' + (细顶 - 8) + '" x2="' + 左 + '" y2="' + (细顶 - 8 + 细行.length * 24) + '" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>');
  细行.forEach((line, i) => {
    p.push('<text x="' + (左 + 17) + '" y="' + (细顶 + i * 24) + '" font-family="' + 运势字体 + '" font-size="15" fill="rgba(255,255,255,0.72)">' + escXml(line) + "</text>");
  });
  p.push('<text x="' + Math.round(cardX + cardW / 2) + '" y="' + (cardY + cardH - 16) + '" text-anchor="middle" font-family="' + 运势字体 + '" font-size="11" fill="rgba(255,255,255,0.32)" letter-spacing="2">' + escXml((c.昵称 || "") + " · 本内容为虚拟生成，切勿迷信") + "</text>");
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' + p.join("\n") + "</svg>";
}


// 渲染运势卡 → base64 PNG；本地图缺失时用深色底兜底
export async function 渲染运势卡(ctx, opts) {
  const sharp = await 取Sharp(ctx);
  if (!sharp) return null;
  const o = opts || {};
  const w = o.宽 || 720, h = o.高 || 1280;
  try {
    let 底 = null;
    if (o.本地图) {
      try {
        const p = 解析插件相对路径(ctx, o.本地图);
        if (p && fs.existsSync(p)) 底 = fs.readFileSync(p);
      } catch (e) { 底 = null; }
    }
    const 层 = (底 && 底.length)
      ? await sharp(底).resize(w, h, { fit: "cover", position: "centre" }).ensureAlpha().png().toBuffer()
      : await sharp({ create: { width: w, height: h, channels: 3, background: { r: 22, g: 24, b: 44 } } }).png().toBuffer();
    const 叠 = await sharp(Buffer.from(运势卡SVG(w, h, o.卡 || {}))).png().toBuffer();
    const out = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: 层, top: 0, left: 0 }, { input: 叠, top: 0, left: 0 }]).png().toBuffer();
    return out.toString("base64");
  } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 运势卡渲染失败:", e);
    return null;
  }
}


// 渲染并发送运势卡；成功返回 true，失败由调用方降级发原图
export async function 发运势卡(ctx, t, 本地图, 卡) {
  try {
    const b64 = await 渲染运势卡(ctx, { 本地图: 本地图, 卡: 卡, 宽: 720, 高: 1280 });
    if (!b64) return false;
    const info = await upload(ctx, t, { data: b64 }, 1);
    await sendMedia(ctx, t, info, "今日运势 · " + S(卡 && 卡.昵称));
    return true;
  } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 运势卡发送失败:", e);
    return false;
  }
}


export async function fortune(ctx, t, u) {
  // 2.2.4：参照 GF-plugin-xinjia 的运势流程 —— 先回「正在绘制…」，再发图，最后发签文
  await reply(ctx, t, "正在绘制今日运势，请稍等…", { 标题: "", 无艾特: false });
  const 签表 = 读默认资源(ctx, "text/运势.json", null);
  const 图表 = 读默认资源(ctx, "text/URL.json", null);
  const list = (Array.isArray(签表) && 签表.length) ? 签表 : 内置签文;
  const imgs = Array.isArray(图表) ? 图表 : [];
  const today = ymd();
  const rel = "今日运势/" + today + ".json";
  let rec = null;
  const raw = ds(ctx, rel, u, "");
  if (raw) { try { rec = JSON.parse(raw); } catch (e) { rec = null; } }
  if (!rec || typeof rec !== "object") {
    rec = { 文本: rnd(0, list.length - 1), 图片: imgs.length ? rnd(0, imgs.length - 1) : -1 };
    dset(ctx, rel, u, JSON.stringify(rec));
  }
  // 旧记录里的下标可能已超出当前签表范围（例如签表退化为内置 8 条时），
  // 越界会静默落到 list[0]，导致「天天大吉」，所以这里做一次范围校验并回写。
  const 固定记录 = () => { try { dset(ctx, rel, u, JSON.stringify(rec)); } catch (e) { /* ignore */ } };
  let 文本号 = Number(rec.文本);
  if (!Number.isFinite(文本号) || 文本号 < 0 || 文本号 >= list.length) { 文本号 = rnd(0, list.length - 1); rec.文本 = 文本号; 固定记录(); }
  let 图号 = Number(rec.图片);
  if (imgs.length && (!Number.isFinite(图号) || 图号 < 0 || 图号 >= imgs.length)) { 图号 = rnd(0, imgs.length - 1); rec.图片 = 图号; 固定记录(); }
  const 签 = list[文本号] || list[0];
  const url = (图号 >= 0 && imgs[图号]) ? imgs[图号] : "";
  const 本地图 = "默认资源/image/运势" + ((图号 >= 0 ? 图号 : 0) + 1) + ".png";
  const 卡 = {
    time: today, 昵称: ds(ctx, P.昵称, u, "新兵"),
    Sorte: S(签.Sorte), Estrelas: S(签.Estrelas),
    signText: S(签.signText), unSignText: S(签.unSignText) || "此签已定，明日再来"
  };
  // ① 首选：用 Sharp 把签文叠在运势图上，发一张完整的「运势卡」
  const 已发卡 = await 发运势卡(ctx, t, 本地图, 卡);
  // ② 降级：直接发插件自带原图（本地优先），本地缺失或失败再退回 URL.json 里的外链
  if (!已发卡) {
    const local = 段_图片本地(ctx, 本地图, "");
    try {
      const segs = [];
      if (local) segs.push(local);
      else if (url) segs.push(段_图片url(url, ""));
      const res = segs.length ? await sendSegs(ctx, t, segs) : [];
      if (local && url && (!res || !res.length)) await sendSegs(ctx, t, [段_图片url(url, "")]);
    }
    catch (e) { if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 运势图发送失败:", e); }
  }
  const 宜 = ["副本", "探索", "挖矿", "打工", "钓鱼", "交易行", "联盟捐献", "抽卡"];
  const 忌 = ["赌场", "打劫", "摇骰子", "空手刷本"];
  // 2.2.4：签文格式对齐 xinjia（签等 + 星级 / 签文 / 白话 / 结尾声明）
  await reply(ctx, t, [
    "今日运势",
    S(签.Sorte) + " " + S(签.Estrelas),
    S(签.signText),
    S(签.unSignText) || "此签已定，明日再来",
    "》本内容为虚拟生成，切勿迷信"
  ].join("\n"), {
    标题: "",
    行组: [row(actBtn("ft1", "⚡看属性", "info"), btn("ft2", "副本", "副本"), btn("ft3", "星甲菜单", "星甲菜单"))]
  });
}



/* ============================================================
 * 十、传承玩法：超能力/时空门/对战/查询/军衔
 * ============================================================ */
export const SP = [
  { q: "你能让房间瞬间变干净，但", a: "只能保持 10 分钟" },
  { q: "你可以听懂所有动物说话，但", a: "它们只会吐槽你" },
  { q: "你能瞬移，但", a: "每次都随机出现在某个便利店" },
  { q: "你能看穿别人的想法，但", a: "只能看到他们今天想吃什么" },
  { q: "你不用睡觉也精力充沛，但", a: "每天要发呆 3 小时" },
  { q: "你可以复制任何食物，但", a: "复制出来的都是冷的" },
  { q: "你能让时间暂停 5 秒，但", a: "暂停期间自己也会卡住" },
  { q: "你能中任何抽奖，但", a: "奖品一律是单人餐券" },
  { q: "你能和植物交流，但", a: "它们只聊天气" },
  { q: "你可以无限学习技能，但", a: "学完就忘掉一半" }
];


export async function superpower(ctx, t, u, action) {
  const today = ymd();
  let st = dget(ctx, P.超能力, "当前", null);
  if (!st || typeof st !== "object" || st.日期 !== today || action === "换") {
    const q = SP[rnd(0, SP.length - 1)];
    st = {
      日期: today, 问题: q.q, 结果: q.a,
      按下: (st && st.日期 === today && st.按下) || 0,
      不按: (st && st.日期 === today && st.不按) || 0
    };
    dset(ctx, P.超能力, "当前", st);
  }
  if (action === "按下" || action === "不按") {
    if (ds(ctx, P.超能力记录, today + "_" + u, "")) {
      await reply(ctx, t, "今天已经选过了，明天再来。", {
        标题: "🔮 今日超能力", 行组: [row(btn("sp1", "换一题", "今日超能力"), btn("sp2", "菜单", "菜单"))]
      });
      return;
    }
    dset(ctx, P.超能力记录, today + "_" + u, action);
    st[action] = (Number(st[action]) || 0) + 1;
    dset(ctx, P.超能力, "当前", st);
    addCoin(ctx, u, 100);
    await reply(ctx, t, ["你选择了「" + action + "」，星羽 +100", "", "按下 **" + st.按下 + "** 人 · 不按 **" + st.不按 + "** 人"].join("\n"), {
      标题: "🔮 今日超能力"
    });
    return;
  }
  await reply(ctx, t, [
    "**假如** " + st.问题,
    "",
    "**但是** " + st.结果,
    "",
    "已有 **" + (st.按下 || 0) + "** 人按下 · **" + (st.不按 || 0) + "** 人不按",
    "",
    "按下 / 不按各得 100 星羽（每天限一次），换一题可刷新。"
  ].join("\n"), {
    标题: "🔮 今日超能力",
    行组: [
      row(actBtn("spa", "⚡按下", "sp|按下"), actBtn("spb", "⚡不按", "sp|不按"), btn("spc", "换一题", "今日超能力")),
      row(btn("spd", "菜单", "菜单"))
    ]
  });
}


export const GATE_CD = 1800000;


export async function gate(ctx, t, u, where) {
  const cur = ds(ctx, P.时空位置, u, "深渊");
  if (!S(where)) {
    await reply(ctx, t, [
      "当前位置：**" + cur + "**",
      "",
      "`时空门芸界` / `时空门深渊` 切换区域（也支持 `时空门#芸界`）",
      "- 深渊：探索产出稳定",
      "- 芸界：副本经验略微提升",
      "",
      "冷却 30 分钟，可用刷新卡重置。"
    ].join("\n"), {
      标题: "🌀 时空门", 行组: [row(btn("tp1", "去芸界", "时空门芸界"), btn("tp2", "去深渊", "时空门深渊"), btn("tp3", "菜单", "菜单"))]
    });
    return;
  }
  const dest = S(where).indexOf("芸") >= 0 ? "芸界" : S(where).indexOf("深") >= 0 ? "深渊" : "";
  if (!dest) { await reply(ctx, t, "未知区域，可选：芸界 / 深渊", { 标题: "🌀 时空门" }); return; }
  if (dest === cur) { await reply(ctx, t, "你已经在【" + dest + "】了。", { 标题: "🌀 时空门" }); return; }
  const last = dn(ctx, P.时空冷却, u, 0);
  const left = Math.max(0, last + GATE_CD - Date.now());
  if (left > 0) {
    await reply(ctx, t, "时空门不稳定，还需等待 " + wait(left) + "。\n用 `使用刷新卡` 可立即重置。", {
      标题: "🌀 时空门冷却", 按钮: [btn("tq1", "使用刷新卡", "使用刷新卡")]
    });
    return;
  }
  dset(ctx, P.时空位置, u, dest);
  dset(ctx, P.时空冷却, u, Date.now());
  recPwr(ctx, u);
  await reply(ctx, t, "已抵达【" + dest + "】。", {
    标题: "🌀 传送完成",
    行组: [row(actBtn("tr1", "⚡探索5次", "explore|5"), btn("tr2", "副本", "副本"), btn("tr3", "菜单", "菜单"))]
  });
}


export async function battle(ctx, t, u, mode, targetId) {
  if (await 修甲拦截(ctx, t, u)) return;
  const me = attrs(ctx, u);
  if (me.血量 <= 0) { await reply(ctx, t, "血量归零，先 `修复战甲`。", { 标题: "无法出战" }); return; }
  let foe = "";
  if (S(targetId)) foe = byGid(ctx, S(targetId));
  else {
    const list = players(ctx).filter((x) => x !== u);
    if (!list.length) { await reply(ctx, t, "暂时没有可以挑战的对手。", { 标题: "无法出战" }); return; }
    if (mode === "random") foe = list[rnd(0, list.length - 1)];
    else {
      const my = pwrOf(ctx, u);
      list.sort((a, b) => Math.abs(pwrOf(ctx, a) - my) - Math.abs(pwrOf(ctx, b) - my));
      foe = list[0];
    }
  }
  if (!foe) { await reply(ctx, t, "找不到这个对手。", { 标题: "无法出战" }); return; }
  if (foe === u) { await reply(ctx, t, "不能挑战自己。", { 标题: "无法出战" }); return; }
  const you = attrs(ctx, foe);
  const my = pwrOf(ctx, u), his = pwrOf(ctx, foe);
  const rate = Math.max(0.1, Math.min(0.9, my / (my + his)));
  if (Math.random() < rate) {
    const steal = Math.max(50, Math.floor(you.星羽 * 0.06));
    addCoin(ctx, foe, -steal);
    addCoin(ctx, u, steal);
    const xp = 60 + Math.floor(you.等级 * 12);
    const up = 加经验(ctx, u, xp);
    if (Math.random() < 0.3) addCore(ctx, u, 1);
    tInc(ctx, u, "副本");
    recPwr(ctx, u);
    await reply(ctx, t, [
      "⚔️ 你击败了 " + you.昵称 + "（#" + you.编号 + "）",
      "战力 " + kfmt(my) + " vs " + kfmt(his) + " · 胜率约 " + Math.round(rate * 100) + "%",
      "战利品：星羽 +" + kfmt(steal) + " · 经验 +" + xp + (up.升级 ? " · 升级 → Lv." + up.等级 : "")
    ].join("\n"), {
      标题: "🏆 挑战胜利",
      行组: [row(actBtn("fv1", "⚡再战一次", "fight|random"), btn("fv2", "副本", "副本"), btn("fv3", "排行榜", "排行榜"))]
    });
    return;
  }
  const hurt = rnd(20, 60);
  const 剩血 = 设血量(ctx, u, me.血量 - hurt);
  await reply(ctx, t, [
    "⚔️ 你败给了 " + you.昵称 + "（#" + you.编号 + "）",
    "战力 " + kfmt(my) + " vs " + kfmt(his) + " · 胜率约 " + Math.round(rate * 100) + "%",
    "血量 -" + hurt + "（剩 " + 剩血 + "）"
  ].join("\n"), {
    标题: "💥 挑战失败",
    行组: [row(btn("fw1", "强化", "强化"), btn("fw2", "修复战甲", "修复战甲"), btn("fw3", "副本", "副本"))]
  });
}
