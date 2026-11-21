// lib/admin/webui.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { EDIT_FIELD, isBanned, ownerList, sharp安装, sharp状态, 会话聚合, 修改记录列表, 写控制台配置, 可编辑字段名, 夹紧字段, 字段区间表, 字段表, 排行, 控制台发消息, 日志日期表, 概览, 读会话消息, 读控制台配置, 读日志行 } from "././admin.mjs?v=v1795277295507";
import { 修改记录, 存修改记录 } from "././edit.mjs?v=v1795277295507";
import { S, dall, dget, dn, ds, dset, fmt, kfmt, n, pushLog, ymd, 最高权限者, 记管理日志 } from "./../core/base.mjs?v=v1795277295507";
import { delMsg, 解析插件相对路径 } from "./../core/qq.mjs?v=v1795277295507";
import { P } from "./../core/util.mjs?v=v1795277295507";
import { players } from "./../game/alliance.mjs?v=v1795277295507";
import { 写自动, 怪词条, 读自动 } from "./../game/combat.mjs?v=v1795277295507";
import { 加世界资金, 取信用分, 官方群链接, 读世界资金, 贷款概况 } from "./../game/credit.mjs?v=v1795277295507";
import { BOSS传说爆率, BOSS爆率表, BOSS普通爆率, BOSS史诗爆率, 保底传说次数, 保底史诗次数, 保底普通次数, 保底次数表, 副本专属, 装备名 } from "./../game/dungeon.mjs?v=v1795277295507";
import { 股票tick, 股票找, 股票行情, 股票表, 设股票上下限, 读股票上下限 } from "./../game/econ.mjs?v=v1795277295507";
import { GOODS, strCount, 读农场, 读农场成长 } from "./../game/farm.mjs?v=v1795277295507";
import { addCoin, addContrib, addCore, addXp, allItems, attrs, byGid, gid, giveItem, hasAcc, hasItem, pwrOf, recPwr, 全服倍率, 全部激活词条, 撤销玩家词条, 改编号, 是解绑键, 激活玩家词条, 激活词条默认数值, 玩家可用词条键, 玩家激活词条, 称号表, 细分倍率, 细分倍率键, 绑定到, 解绑账号, 设称号, 词条定义, 词条键表 } from "./../game/player.mjs?v=v1795277295507";
import { BOSS冷却毫秒, DG, 副本冷却毫秒 } from "./../game/progress.mjs?v=v1795277295507";
import { PVP全表, PVP存表, PVP无动作超时毫秒, rankTitle } from "./../game/pvp.mjs?v=v1795277295507";
import { 世界资金初始 } from "./../game/star.mjs?v=v1795277295507";
import { 完整菜单组 } from "./../ui/menu.mjs?v=v1795277295507";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";


// ---------- 网页后台（规范写法：ctx.router.page / get / post / static） ----------
// 路由实际地址：/api/Plugin/ext/<插件名>/<路径>（需控制台登录）
// 前端拿到的 apiBase 就是它，因此这里的路径都写成根路径（不带前缀）
export function registerWebuiCanonical(ctx) {
  const r = ctx && ctx.router;
  if (!r || typeof r.get !== "function" || typeof r.post !== "function") {
    if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 主机未提供 router，跳过后台注册");
    return;
  }
  const ok = (res, data) => { res.json({ code: 0, data: data }); };
  const no = (res, msg, st, extra) => {
    // 2.9.1：extra 允许携带 剩余次数 / 剩余锁定时间 / 锁定至 等附加字段（与前端约定的登录契约）
    const body = Object.assign({ code: -1, message: msg }, extra && typeof extra === "object" ? extra : {});
    if (typeof res.status === "function") res.status(st || 400).json(body);
    else res.json(body);
  };
  /* ---------- 3.1.2 控制台词条：全量下发，移除「敬请期待」旧逻辑 ----------
   * 3.0.0 起玩家侧词条已全面开放（传说装备 / 称号 / 星灵 / 管理员激活），
   * attrs() 的 a.词条 已是完整表（含吸血 / 追击 / 反击等原「待开放」键）。
   * 旧版这里只下发 6 条，前端靠「缺键」显示「敬请期待」——现已不适用：
   * 词条已解锁却仍被当成未开放。改为整表下发，前端显示真实数值。
   * 血量不是词条定义里的一条，单取当前血量；攻击力/防御力/生命用 a 的最终值。
   */
  const 面板词条 = (a) => {
    const 全 = (a && a.词条) || {};
    const 激 = 玩家激活词条(ctx, a && a.u);
    const out = {};
    for (const k of Object.keys(全)) out[k] = Number(全[k]) || 0;
    // 数值型三项用最终值（词条包里可能没有或口径不同）
    out["攻击力"] = Number(a && a.攻击) || 0;
    out["防御力"] = Number(a && a.防御) || 0;
    out["生命"] = Number(a && a.血量上限) || 0;
    out["血量"] = Math.max(0, Number(a && a.血量) || 0);
    // 管理员手动激活的词条覆盖回传（控制台面板据此标出「已激活」）
    for (const k of Object.keys(激)) out[k] = Number(激[k]) || 0;
    return out;
  };
  /* ---------- 2.9.8（需求 1）词条激活 / 撤销 / 状态查询 ----------
   * 三个接口都需要登录 token（走 table 里的 守卫()，无 token → 401）。
   *   POST /titles/grant   { 玩家, 词条, 数值? }  数值省略 = 10，填「满」= 该词条上限
   *   POST /titles/revoke  { 玩家, 词条 }
   *   GET  /titles/state   → 全部词条键 + 每个玩家的激活情况
   * 「玩家」可以是 openid，也可以是游戏编号。
   */
  const 找玩家 = (标识) => {
    const s = S(标识).trim();
    if (!s) return null;
    if (hasAcc(ctx, s)) return s;
    const x = byGid(ctx, s);
    return x || null;
  };
  const pl = (x) => {
    const a = attrs(ctx, x);
    return {
      id: x, 编号: a.编号, 昵称: a.昵称, 等级: a.等级, 经验: a.经验, 星羽: a.星羽, 存款: a.存款,
      星核: a.星核, 贡献: a.贡献, 攻击: a.攻击, 防御: a.防御, 血量: a.血量, 血量上限: a.血量上限,
      // 2.9.1（F5 修复）：原来 pl() 漏了 暴击率 / 暴伤 / 防御 / 金币，控制台「玩法编辑」
      //   读 GET /player 拿到的是 undefined。attrs() 对这四项始终有数值默认（5 / 150 / 100 / 0）。
      金币: a.金币, 暴击率: a.暴击率, 暴伤: a.暴伤,
      // 2.9.2（需求 5）：控制台字段与玩家的「新字段名」对齐（下拉里选 攻击力/防御力/生命/闪避率/真伤概率
      //   时，详情页要先能显示出当前值，否则输入框是空的）
      攻击力: a.攻击, 防御力: a.防御, 生命: a.血量上限, 闪避率: a.词条 ? a.词条.闪避率 : a.闪避,
      真伤概率: a.词条 ? a.词条.真伤概率 : 0,
      暴击: a.暴击, 闪避: a.闪避, 转生: a.转生, 强化: a.强化,
      战力: pwrOf(ctx, x), 军衔: rankTitle(ctx, x), 联盟: ds(ctx, P.联盟, x, ""),
      封禁: isBanned(ctx, x), 可强化: strCount(a.等级),
      // 2.7.0（需求 3/4/13/14）：控制台需要看到 称号 / 绑定状态 / 完整 openid
      称号: a.称号 || "", 称号徽标: a.称号徽标 || "",
      // P9：系统称号数组（元素 {名, 稀有度}，自动发放可多个）+ 玩家可获得 6 条词条
      系统称号: Array.isArray(a.系统称号) ? a.系统称号 : [],
      词条: 面板词条(a),
      openid: S(x), 已解绑: 是解绑键(x)
    };
  };
  const bagOf = (x) => {
    const bag = {};
    for (const it of allItems()) bag[it] = hasItem(ctx, x, it);
    return bag;
  };
  /* ---------- 2.9.1（C2）控制台登录：密码 / 会话 token / 防爆破锁定 ----------
   * · 密码存插件配置（dataPath/config.json 的「控制台密码」键），初始 12345678，首次登录提示修改
   * · POST /login {password} → {token}（随机 32 字节 hex，**2.9.3 起 7 天有效 + 滑动续期**）
   * · 除 /login 外所有接口都要求 token（Authorization: Bearer / X-Token / query.token）
   * · 2.9.3：会话**落盘**到 系统/控制台会话.json —— 原来只在内存 Map，插件一重载/重启 token 全失效，
   *   前端拿到 401 就回登录页，表现为「登录几分钟就失效」。
   * · 防爆破：按 IP 记连续失败，连续 3 次 → 锁 24 小时（423），持久化到 系统/控制台登录锁定.json
   * · 手动解锁：插件配置「控制台解锁IP」填 IP 或 *，/login 时命中即清除该 IP 锁定
   * · 失败 / 锁定事件写 dataPath/log/控制台登录.jsonl
   */
  const 会话毫秒 = 7 * 24 * 3600 * 1000;   // 2.9.3：24h → 7 天
  const 会话表 = new Map();   // token → { 过期毫秒, ip, 最近 }
  // 2.9.3：会话持久化（token → {过期, ip, 最近}），载入 / 落盘时都丢弃已过期项，文件不会无限增长
  const 载入会话 = () => {
    let 存 = {};
    try { const v = dget(ctx, P.控制台会话, "会话", {}); 存 = v && typeof v === "object" ? v : {}; } catch (e) { 存 = {}; }
    const 现在 = Date.now();
    let 有脏 = false;
    for (const k of Object.keys(存)) {
      const r = 存[k] || {};
      const 到 = Number(r.过期) || 0;
      if (!到 || 到 <= 现在) { delete 存[k]; 有脏 = true; continue; }
      会话表.set(k, { 过期: 到, ip: S(r.ip), 最近: Number(r.最近) || 0 });
    }
    if (有脏) 存会话();
    return 会话表;
  };
  const 存会话 = () => {
    const o = {};
    const 现在 = Date.now();
    for (const [k, v] of Array.from(会话表)) {
      if (!v || Number(v.过期) <= 现在) { 会话表.delete(k); continue; }
      o[k] = { 过期: Number(v.过期) || 0, ip: S(v.ip), 最近: Number(v.最近) || 0 };
    }
    try { dset(ctx, P.控制台会话, "会话", o); } catch (e) { /* ignore */ }
  };
  let 会话落盘时刻 = 0;
  const 存会话节流 = (强制) => {
    const 现在 = Date.now();
    if (!强制 && 现在 - 会话落盘时刻 < 30000) return;   // 30 秒内只落盘一次（滑动续期不必每次都写盘）
    会话落盘时刻 = 现在;
    存会话();
  };
  载入会话();
  // 3.0.0（需求）：控制台封禁改为「每小时最多 3 次失败」，锁 1 小时（原 24 小时）
  const 锁定毫秒 = 60 * 60 * 1000;
  const 连败锁定次数 = 3;
  const 失败窗口毫秒 = 60 * 60 * 1000;   // 超过 1 小时的旧失败计数自动清零
  const 锁定表 = (() => { const v = dall(ctx, P.控制台锁定); return v && v["锁"] && typeof v["锁"] === "object" ? v["锁"] : {}; })();
  const 存锁定表 = () => { try { dset(ctx, P.控制台锁定, "锁", 锁定表); } catch (e) { /* ignore */ } };
  const 登录日志 = (ip, 事件, 说明) => {
    try {
      const dir = path.join(S(ctx && ctx.dataPath), "log");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(path.join(dir, "控制台登录.jsonl"), JSON.stringify({ 时间: fmt(), ip: S(ip), 事件: S(事件), 说明: S(说明) }) + "\n", "utf8");
    } catch (e) { /* 日志失败不影响主流程 */ }
  };
  const 客户端IP = (q) => {
    const h = (q && q.headers) || {};
    return S(q && q.ip)
      || S(h["x-forwarded-for"]).split(",")[0]
      || S(h["x-real-ip"])
      || S(q && q.query && q.query._ip)
      || S(q && q.req && q.req.socket && q.req.socket.remoteAddress)
      || "未知";
  };
  const 取token = (q) => {
    const h = (q && q.headers) || {};
    const a = S(h.authorization || h.Authorization);
    const m = a.match(/^Bearer\s+(.+)$/i);
    return S(m ? m[1] : a) || S(h["x-token"] || h["X-Token"]) || S(q && q.query && q.query.token) || S(q && q.body && q.body.token);
  };
  // 2.9.3：校验通过时**滑动续期**（过期时间往后推 7 天），并通过响应头把新的过期时间带给前端
  const 校验会话 = (q, res) => {
    const tk = 取token(q);
    if (!tk) return false;
    const s = 会话表.get(tk);
    if (!s) return false;
    const 现在 = Date.now();
    if (现在 > Number(s.过期)) { 会话表.delete(tk); 存会话节流(true); return false; }
    s.过期 = 现在 + 会话毫秒;
    s.最近 = 现在;
    存会话节流(false);
    if (res && typeof res.set === "function") {
      try {
        res.set("X-Token-Expires", String(s.过期));
        res.set("X-Token-Expires-In", String(会话毫秒));
      } catch (e) { /* 响应头失败不影响请求 */ }
    }
    return true;
  };
  const 锁定状态 = (ip) => {
    const rec = 锁定表[ip];
    if (!rec) return { 锁: false };
    const 到 = Number(rec.锁到) || 0;
    if (到 > Date.now()) return { 锁: true, 到: 到 };
    if (到) { delete 锁定表[ip]; 存锁定表(); }   // 锁定期已过 → 自动解除
    return { 锁: false };
  };
  const 密码强度问题 = (v) => {
    const s = S(v);
    if (!s) return "新密码不能为空";
    if (s.length < 8) return "新密码长度至少 8 位（当前 " + s.length + " 位）";
    if (!/[A-Z]/.test(s)) return "新密码必须包含大写字母（A-Z）";
    if (!/[a-z]/.test(s)) return "新密码必须包含小写字母（a-z）";
    if (!/[0-9]/.test(s)) return "新密码必须包含数字（0-9）";
    if (!/[^A-Za-z0-9]/.test(s)) return "新密码必须包含特殊符号（如 !@#$%…）";
    return "";
  };
  const H = {
    // 2.9.2（需求 5）：字段清单 + 每个字段的合法区间（前端下拉 / 输入校验都用这个）
    meta: (_q, res) => { ok(res, { 字段: 可编辑字段名, 字段区间: 字段区间表(), 道具: allItems(), 商品: GOODS, 最高权限者: 最高权限者 }); },
    stats: (_q, res) => {
      const list = players(ctx);
      const sum = { 玩家数: list.length, 星羽: 0, 存款: 0, 星核: 0, 贡献: 0, 封禁: 0 };
      for (const x of list) {
        sum.星羽 += dn(ctx, P.星羽, x, 0); sum.存款 += dn(ctx, P.存款, x, 0);
        sum.星核 += dn(ctx, P.星核, x, 0); sum.贡献 += dn(ctx, P.贡献, x, 0);
        if (isBanned(ctx, x)) sum.封禁 += 1;
      }
      sum.主人数 = ownerList(ctx).length;
      ok(res, { 汇总: sum, 日期: ymd() });
    },
    players: (q, res) => {
      const qq = (q && q.query) || {};
      const kw = S(qq.q), sort = S(qq.sort) || "战力";
      const limit = Math.min(Math.max(Number(qq.limit) || 200, 1), 1000);
      let list = players(ctx).map(pl);
      if (kw) list = list.filter((x) => x.昵称.indexOf(kw) >= 0 || String(x.编号).indexOf(kw) >= 0 || x.id.indexOf(kw) >= 0);
      list.sort((a, b) => Number(b[sort] || 0) - Number(a[sort] || 0));
      ok(res, { total: list.length, list: list.slice(0, limit) });
    },
    player: (q, res) => {
      const qq = (q && q.query) || {};
      const x = byGid(ctx, S(qq.id));
      if (!x) return no(res, "找不到该玩家", 404);
      const lg = dget(ctx, P.操作日志, "日志", []);
      ok(res, { 玩家: pl(x), 道具: bagOf(x), 最近管理: (Array.isArray(lg) ? lg : []).slice(0, 10) });
    },
    update: (q, res) => {
      const b = (q && q.body) || {};
      const x = byGid(ctx, S(b.id));
      if (!x) return no(res, "找不到该玩家", 404);
      const rel = EDIT_FIELD[S(b.field)];
      if (!rel) return no(res, "不支持的字段：" + S(b.field) + "（可用：" + 可编辑字段名.join(" / ") + "）");
      const v = Number(b.value);
      if (!Number.isFinite(v)) return no(res, "数值必须是数字");
      // 2.9.2（需求 5）：按字段区间夹紧后落档（等级 ≥1、暴击率 0~80、闪避率 0~40、真伤 0~60 …）
      const 目标 = 夹紧字段(b.field, v);
      if (目标 === null) return no(res, "数值超出 " + S(b.field) + " 的合法区间");
      dset(ctx, rel, x, 目标);
      recPwr(ctx, x);
      pushLog(ctx, "网页后台", "设置 " + gid(ctx, x) + " 的" + S(b.field) + " = " + 目标 + (目标 !== v ? "（原值 " + v + " 已按区间夹紧）" : ""));
      ok(res, { 玩家: pl(x), 实际值: 目标, 区间: 字段区间表()[S(b.field)] || null });
    },
    items: (q, res) => {
      const b = (q && q.body) || {};
      const x = byGid(ctx, S(b.id));
      if (!x) return no(res, "找不到该玩家", 404);
      const it = S(b.item);
      const c = Math.floor(Number(b.count));
      if (!Number.isFinite(c) || c === 0) return no(res, "数量必须是非零整数");
      // 2.9.1（C1）：货币类（星羽/金币/存款/星核/贡献/经验）直接加减到对应存档，可负数扣除
      const 货币 = {
        星羽: () => dset(ctx, P.星羽, x, Math.max(0, dn(ctx, P.星羽, x, 0) + c)),
        金币: () => dset(ctx, P.金币, x, Math.max(0, dn(ctx, P.金币, x, 0) + c)),
        存款: () => dset(ctx, P.存款, x, Math.max(0, dn(ctx, P.存款, x, 0) + c)),
        星核: () => addCore(ctx, x, c),
        贡献: () => addContrib(ctx, x, c),
        经验: () => addXp(ctx, x, c)
      };
      if (货币[it]) {
        货币[it]();
        recPwr(ctx, x);
        pushLog(ctx, "网页后台", (c > 0 ? "发放" : "扣除") + " " + gid(ctx, x) + " 的【" + it + "】" + Math.abs(c));
        return ok(res, { 玩家: pl(x) });
      }
      if (allItems().indexOf(it) < 0) return no(res, "不认识的道具：" + it);
      giveItem(ctx, x, it, c);
      pushLog(ctx, "网页后台", "调整 " + gid(ctx, x) + " 的【" + it + "】" + c);
      ok(res, { 道具: bagOf(x) });
    },
    ban: (q, res) => {
      const b = (q && q.body) || {};
      const x = byGid(ctx, S(b.id));
      if (!x) return no(res, "找不到该玩家", 404);
      dset(ctx, P.封禁名单, x, b.banned ? "封禁" : "正常");
      pushLog(ctx, "网页后台", (b.banned ? "封禁" : "解封") + " " + gid(ctx, x));
      ok(res, { 玩家: pl(x) });
    },
    reset: (q, res) => {
      const b = (q && q.body) || {};
      const x = byGid(ctx, S(b.id));
      if (!x) return no(res, "找不到该玩家", 404);
      // 2.9.2（需求 5）：与主人指令 重置玩家 同一套默认值，按路径去重
      const 已重置 = new Set();
      for (const f of 字段表) {
        if (已重置.has(f.路径)) continue;
        已重置.add(f.路径);
        dset(ctx, f.路径, x, f.默认);
      }
      recPwr(ctx, x);
      pushLog(ctx, "网页后台", "重置玩家 " + gid(ctx, x));
      ok(res, { 玩家: pl(x) });
    },
    logs: (_q, res) => {
      const v = dget(ctx, P.操作日志, "日志", []);
      const g = dget(ctx, P.操作日志, "公告", []);
      ok(res, { 日志: (Array.isArray(v) ? v : []).slice(0, 50), 公告: (Array.isArray(g) ? g : []).slice(0, 20) });
    },
    // ---------- 2.2.1 控制台扩展（对应 xinjia 控制台的功能） ----------
    dashboard: (_q, res) => { try { ok(res, 概览(ctx)); } catch (e) { no(res, "概览失败", 500); } },
    rankings: (q, res) => {
      try {
        const qq = (q && q.query) || {};
        ok(res, 排行(ctx, S(qq.sort) || "战力", qq.limit));
      } catch (e) { no(res, "排行失败", 500); }
    },
    dungeons: (_q, res) => {
      try {
        ok(res, {
          list: DG.map((d) => ({
            编号: d.id, 名称: d.名, 等级: d.段, 战力: d.力, 血量: d.血, 伤害: d.攻, 防御: d.防,
            暴击率: d.暴, 暴伤: d.暴伤, 技能伤害: d.技,
            // 2.5.2：冷却改为真实值（副本 600 秒 / BOSS 1200 秒，共用冷却）
            冷却: Math.round((d.id >= 200 ? BOSS冷却毫秒 : 副本冷却毫秒) / 1000),
            需币: d.需币 || 0, 需花: d.需花 || 0,
            经验: d.经, 星羽: d.币, 星核: d.核, 掉率: d.概率,
            // P9：BOSS 条目带固有词条（含闪避率），前端展示词条徽章
            ...(d.BOSS ? { 词条: 怪词条(d) } : {}),
            // 3.0.0（需求 4.8/4.9）：三档品质装备名 —— 保留旧字段名兼容前端，另加三档字段
            专属武器: 副本专属(d).武器, 专属护甲: 副本专属(d).护甲,
            装备: { 普通: { 武器: 装备名(d, "武器", "普通"), 护甲: 装备名(d, "护甲", "普通") }, 史诗: { 武器: 装备名(d, "武器", "史诗"), 护甲: 装备名(d, "护甲", "史诗") }, 传说: { 武器: 装备名(d, "武器", "传说"), 护甲: 装备名(d, "护甲", "传说") } }
          })),
          保底: { 普通次数: 保底普通次数, 史诗次数: 保底史诗次数, 传说次数: 保底传说次数, 普通爆率: BOSS普通爆率, 史诗爆率: BOSS史诗爆率, 传说爆率: BOSS传说爆率, 次数表: 保底次数表, 爆率表: BOSS爆率表 }
        });
      } catch (e) { no(res, "读取副本失败", 500); }
    },
    chats: (q, res) => {
      try {
        const qq = (q && q.query) || {};
        const date = S(qq.date) || ymd();
        ok(res, { 日期: date, list: 会话聚合(ctx, date, qq.limit), 日期表: 日志日期表(ctx) });
      } catch (e) { no(res, "读取会话失败", 500); }
    },
    msgs: (q, res) => {
      try {
        const qq = (q && q.query) || {};
        const date = S(qq.date) || ymd();
        ok(res, { 日期: date, list: 读会话消息(ctx, date, S(qq.scope) || "group", S(qq.id), qq.limit) });
      } catch (e) { no(res, "读取消息失败", 500); }
    },
    msgDates: (_q, res) => { try { ok(res, { 日期表: 日志日期表(ctx) }); } catch (e) { no(res, "读取日期失败", 500); } },
    send: (q, res) => {
      const b = (q && q.body) || {};
      const scope = S(b.scope) === "group" ? "group" : "c2c";
      const 目标 = scope === "group"
        ? { scope: "group", group_openid: S(b.id) }
        : { scope: "c2c", user_openid: S(b.id) };
      if (!S(b.id) || !S(b.text)) return no(res, "缺少目标或内容");
      控制台发消息(ctx, 目标, S(b.text)).then(() => {
        pushLog(ctx, "网页后台", "发送消息到 " + scope + " " + S(b.id));
        ok(res, { 已发送: true });
      }).catch((e) => no(res, "发送失败：" + String(e && e.message ? e.message : e), 500));
    },
    recall: (q, res) => {
      const b = (q && q.body) || {};
      const scope = S(b.scope) === "group" ? "group" : "c2c";
      const 目标 = scope === "group"
        ? { scope: "group", group_openid: S(b.id) }
        : { scope: "c2c", user_openid: S(b.id) };
      const mid = S(b.mid);
      if (!mid) return no(res, "缺少消息ID");
      delMsg(ctx, 目标, mid).then(() => {
        pushLog(ctx, "网页后台", "撤回消息 " + mid);
        ok(res, { 已撤回: true });
      }).catch((e) => no(res, "撤回失败：" + String(e && e.message ? e.message : e), 500));
    },
    config: (_q, res) => {
      try {
        const c = Object.assign({}, 读控制台配置(ctx));
        // 2.9.1（C2）：密码不回传明文，只回「是否还是初始密码」
        const 初始 = (S(c["控制台密码"]) || "12345678") === "12345678";
        delete c["控制台密码"];
        // 3.1.8：GitHub 令牌同样不回传明文，只回「是否已设置 + 前后各 4 位」便于识别
        const 令 = S(c["GitHub令牌"]);
        delete c["GitHub令牌"];
        ok(res, {
          配置: c,
          控制台密码已设置: !初始, 使用初始密码: 初始,
          GitHub令牌已设置: !!令,
          GitHub令牌展示: 令 ? (令.slice(0, 4) + "…" + 令.slice(-4)) : "",
          sharp: sharp状态(ctx)
        });
      } catch (e) { no(res, "读取配置失败", 500); }
    },
    configSave: (q, res) => {
      try {
        const b = (q && q.body) || {};
        const 新 = {};
        if (b["图片渲染"] !== undefined) 新.图片渲染 = !!b["图片渲染"];
        if (b["渲染模式"] !== undefined) 新.渲染模式 = S(b["渲染模式"]);
        if (b["调试"] !== undefined) 新.调试 = !!b["调试"];
        if (b["备注"] !== undefined) 新.备注 = S(b["备注"]);
        // 3.1.8：GitHub API 令牌（空字符串 = 清除）
        if (b["GitHub令牌"] !== undefined) {
          const 令 = S(b["GitHub令牌"]).trim();
          // 允许清空；非空时必须像 GitHub 令牌，防止误存别的字符串
          if (令 === "" || /^gh[pousr]_[A-Za-z0-9]{20,}$/.test(令)) 新.GitHub令牌 = 令;
        }
        // 2.9.0（需求 2）：管理员在控制台设置「当日」赌场赢/输上限，覆盖当天随机值（次日自动恢复随机）
        if (b["赌场今日赢上限"] !== undefined) { const n = Math.floor(Number(b["赌场今日赢上限"]) || 0); 新.赌场今日赢上限 = n > 0 ? n : 0; 新.赌场上限设置日 = ymd(); }
        if (b["赌场今日输上限"] !== undefined) { const n = Math.floor(Number(b["赌场今日输上限"]) || 0); 新.赌场今日输上限 = n > 0 ? n : 0; 新.赌场上限设置日 = ymd(); }
        写控制台配置(ctx, 新);
        pushLog(ctx, "网页后台", "更新配置");
        // 回读时同样脱敏：令牌与密码都不回传明文
        const c2 = Object.assign({}, 读控制台配置(ctx));
        const 令2 = S(c2["GitHub令牌"]);
        delete c2["GitHub令牌"];
        delete c2["控制台密码"];
        ok(res, {
          配置: c2,
          GitHub令牌已设置: !!令2,
          GitHub令牌展示: 令2 ? (令2.slice(0, 4) + "…" + 令2.slice(-4)) : ""
        });
      } catch (e) { no(res, "保存配置失败", 500); }
    },
    sharp: (_q, res) => { try { ok(res, sharp状态(ctx)); } catch (e) { no(res, "读取失败", 500); } },
    sharpInstall: (_q, res) => { try { ok(res, sharp安装(ctx)); } catch (e) { no(res, "安装失败", 500); } },
    mods: (_q, res) => { try { ok(res, { list: 修改记录列表(ctx) }); } catch (e) { no(res, "读取失败", 500); } },
    modsClear: (q, res) => {
      try {
        const b = (q && q.body) || {};
        const 记录 = 修改记录(ctx);
        if (S(b.id)) { delete 记录[S(b.id)]; 存修改记录(ctx, 记录); }
        else { 存修改记录(ctx, {}); }
        pushLog(ctx, "网页后台", "清空属性修改记录 " + (S(b.id) || "全部"));
        ok(res, { list: 修改记录列表(ctx) });
      } catch (e) { no(res, "清空失败", 500); }
    },
    announce: (q, res) => {
      const b = (q && q.body) || {};
      const s = S(b.text);
      if (!s) return no(res, "内容不能为空");
      const v = dget(ctx, P.操作日志, "公告", []);
      const list = Array.isArray(v) ? v : [];
      list.unshift({ 时间: fmt(), 内容: s });
      dset(ctx, P.操作日志, "公告", list.slice(0, 100));
      pushLog(ctx, "网页后台", "发布公告：" + s);
      ok(res, { 公告: list.slice(0, 20) });
    },
    // 2.9.3：常驻公告 —— 每条消息「响应用时」下方的灰字，支持换行（渲染时最多 5 行）
    //   body {文本}（兼容 {text}）；空字符串 = 关闭
    sticky: (q, res) => {
      const b = (q && q.body) || {};
      const 原 = b["文本"] !== undefined ? b["文本"] : b["text"];
      const 文 = String(原 === undefined || 原 === null ? "" : 原).replace(/\r\n?/g, "\n");
      const 行数 = 文.trim() ? 文.split("\n").length : 0;
      写控制台配置(ctx, { 常驻公告: 文.trim() ? 文 : "" });
      pushLog(ctx, "网页后台", 行数 ? "设置常驻公告（" + 行数 + " 行）" : "关闭常驻公告");
      ok(res, { 常驻公告: 读控制台配置(ctx)["常驻公告"], 行数: 行数 });
    },
    // 2.6.0（需求 2/6）：GET 只读；POST 才增删主人。
    //   原来 GET/POST 共用一个 handler，靠 body 有没有 id 来决定改不改 —— GET 一旦带上 query 以外的 body
    //   就会误改主人名单。这里拆成两个，读写彻底分开。
    owners: (_q, res) => { ok(res, { 最高权限者: 最高权限者, 主人: ownerList(ctx) }); },
    ownersSave: (q, res) => {
      const b = (q && q.body) || {};
      const id = S(b.id);
      if (!id) return no(res, "缺少 id");
      if (S(b.action) === "remove") {
        if (id === 最高权限者) return no(res, "最高权限者不能被移除");
        dset(ctx, P.主人名单, "列表", ownerList(ctx).filter((x) => x !== id));
        pushLog(ctx, "网页后台", "移除主人 " + id);
      } else {
        const l = ownerList(ctx);
        if (id !== 最高权限者 && l.indexOf(id) < 0) l.push(id);
        dset(ctx, P.主人名单, "列表", l);
        pushLog(ctx, "网页后台", "添加主人 " + id);
      }
      ok(res, { 最高权限者: 最高权限者, 主人: ownerList(ctx) });
    },
    // ---------- 2.7.0 控制台新增（需求 3/4/12/13/14/15） ----------
    titles: (_q, res) => { ok(res, { list: 称号表 }); },
    // ---------- 2.9.8（需求 1）词条激活 / 撤销 / 状态 ----------
    grant: (q, res) => {
      const b = (q && q.body) || {};
      const u = 找玩家(b.player !== undefined ? b.player : b.id);
      if (!u) return no(res, "找不到玩家：" + S(b.player !== undefined ? b.player : b.id));
      const 键表 = Array.isArray(b.词条) ? b.词条 : (b.词条 !== undefined ? [b.词条] : []);
      if (!键表.length) return no(res, "请给出要激活的词条（可用：" + 词条键表.join(" / ") + "）");
      const 值表 = [];
      for (const k of 键表) {
        const r = 激活玩家词条(ctx, u, k, b.value, "网页后台");
        if (!r.ok) return no(res, r.msg);
        值表.push({ 键: r.键, 值: r.值, 上限: r.上限 });
      }
      recPwr(ctx, u);
      ok(res, { 玩家: pl(u), 激活: 值表, 已激活: 玩家激活词条(ctx, u) });
    },
    revoke: (q, res) => {
      const b = (q && q.body) || {};
      const u = 找玩家(b.player !== undefined ? b.player : b.id);
      if (!u) return no(res, "找不到玩家：" + S(b.player !== undefined ? b.player : b.id));
      const 键表 = Array.isArray(b.词条) ? b.词条 : (b.词条 !== undefined ? [b.词条] : []);
      if (!键表.length) return no(res, "请给出要撤销的词条");
      for (const k of 键表) {
        const r = 撤销玩家词条(ctx, u, k, "网页后台");
        if (!r.ok) return no(res, r.msg);
      }
      recPwr(ctx, u);
      ok(res, { 玩家: pl(u), 已激活: 玩家激活词条(ctx, u) });
    },
    state: (_q, res) => {
      const 全 = 全部激活词条(ctx);
      const 玩家 = [];
      for (const u of Object.keys(全)) {
        const 表 = 全[u];
        if (!表 || typeof 表 !== "object" || !Object.keys(表).length) continue;
        玩家.push({
          openid: u, 编号: gid(ctx, u), 昵称: ds(ctx, P.昵称, u, "无名"),
          激活: 表, 键: Object.keys(表)
        });
      }
      ok(res, {
        键表: 词条定义.map((x) => ({ 键: x.键, 类型: x.类型, 上限: x.上限, 说明: x.说明 })),
        玩家可用词条键: 玩家可用词条键.slice(),
        默认数值: 激活词条默认数值,
        玩家: 玩家
      });
    },
    number: (q, res) => {
      const b = (q && q.body) || {};
      const r = 改编号(ctx, S(b.id), S(b.number));
      if (!r.ok) return no(res, r.msg);
      const x = byGid(ctx, r.编号);
      ok(res, { 玩家: x ? pl(x) : null, 编号: r.编号 });
    },
    title: (q, res) => {
      const b = (q && q.body) || {};
      const x = byGid(ctx, S(b.id));
      if (!x) return no(res, "找不到该玩家", 404);
      // 修复（2.9.8 补丁）：定制称号是「自由文本、无加成、每人 1 个」（P9 设计，页面上也这么写），
      //   原来这里按 称号名表 白名单校验 → 输入任意新文本 / 编辑已有称号都会报「没有这个称号」保存失败。
      //   现在改为直接按 openid + 自定义文本写档（存在覆盖 / 不存在创建），与聊天指令 `称号#编号#名` 同一套 设称号()；
      //   最长 16 字（设称号 内部同样截断），空串 = 清除。「没有这个称号」只保留给真正引用称号表的路径使用。
      const 名 = S(b.title).trim().slice(0, 16);
      设称号(ctx, x, 名);
      pushLog(ctx, "网页后台", (名 ? "设置定制称号「" + 名 + "」给 " : "清除定制称号：") + gid(ctx, x));
      ok(res, { 玩家: pl(x), 称号: 名, 提示: 名 ? "已保存定制称号「" + 名 + "」" : "已清除定制称号" });
    },
    unbind: (q, res) => {
      const b = (q && q.body) || {};
      const r = 解绑账号(ctx, S(b.id));
      if (!r.ok) return no(res, r.msg);
      const x = byGid(ctx, r.编号);
      ok(res, { 玩家: x ? pl(x) : null, 解绑: true, 旧openid: r.旧openid });
    },
    rebind: (q, res) => {
      const b = (q && q.body) || {};
      const r = 绑定到(ctx, S(b.id), S(b.openid), false);
      if (!r.ok) return no(res, r.msg);
      const x = byGid(ctx, r.编号);
      ok(res, { 玩家: x ? pl(x) : null });
    },
    transfer: (q, res) => {
      const b = (q && q.body) || {};
      const r = 绑定到(ctx, S(b.id), S(b.openid), true);
      if (!r.ok) return no(res, r.msg);
      const x = byGid(ctx, r.编号);
      ok(res, { 玩家: x ? pl(x) : null });
    },
    server: (_q, res) => {
      ok(res, { 倍率: 全服倍率(ctx), 世界资金: 读世界资金(ctx), 说明: "作用于全服玩家的副本 / BOSS / 天下楼结算奖励（经验 / 星羽 / 金币 / 星核）" });
    },
    multiplier: (q, res) => {
      const b = (q && q.body) || {};
      const v = Number(b.倍率 !== undefined ? b.倍率 : b.value);
      if (!Number.isFinite(v) || v > 2 || (v !== 1 && v < 1.1)) return no(res, "倍率只能是 1.0（关闭）或 1.1 ~ 2.0 之间");
      const vv = Math.round(v * 10) / 10;
      写控制台配置(ctx, { 全服倍率: vv });
      pushLog(ctx, "网页后台", "设置全服奖励倍率 ×" + vv.toFixed(1));
      ok(res, { 倍率: vv });
    },
    // ---------- 2.9.1（C2）控制台登录 / 改密 ----------
    login: (q, res) => {
      const b = (q && q.body) || {};
      const ip = 客户端IP(q);
      const cfg = 读控制台配置(ctx);
      // 手动解锁：配置「控制台解锁IP」填该 IP 或 * → 清除锁定（管理员在插件配置 UI 里改）
      const 解锁 = S(cfg["控制台解锁IP"]);
      if ((解锁 === "*" || (解锁 && 解锁 === ip)) && 锁定表[ip]) {
        delete 锁定表[ip]; 存锁定表();
        登录日志(ip, "手动解锁", "配置命中「控制台解锁IP」");
      }
      const 锁 = 锁定状态(ip);
      if (锁.锁) {
        登录日志(ip, "锁定拒绝", "锁定至 " + new Date(锁.到).toISOString());
        return no(res, "该 IP 因密码错误已被锁定 1 小时（至 " + fmt(锁.到) + "），可请管理员在插件配置「控制台解锁IP」里填本 IP 手动解锁", 423, {
          剩余锁定时间: Math.max(0, 锁.到 - Date.now()),
          剩余锁定毫秒: Math.max(0, 锁.到 - Date.now()),
          锁定至: new Date(锁.到).toISOString()
        });
      }
      const 密码 = S(cfg["控制台密码"]) || "12345678";
      if (S(b.password) !== 密码) {
        const rec = 锁定表[ip] || { 次数: 0, 锁到: 0, 最后失败: 0 };
        // 每小时窗口：距上次失败超过 1 小时 → 计数清零重新算
        if (rec.最后失败 && Date.now() - Number(rec.最后失败) > 失败窗口毫秒) { rec.次数 = 0; rec.锁到 = 0; }
        rec.次数 = (Number(rec.次数) || 0) + 1;
        rec.最后失败 = Date.now();
        if (rec.次数 >= 连败锁定次数) {
          rec.锁到 = Date.now() + 锁定毫秒;
          rec.次数 = 0;
          锁定表[ip] = rec; 存锁定表();
          登录日志(ip, "锁定", "一小时内连续错误 " + 连败锁定次数 + " 次，锁定 1 小时");
          // 2.9.1：423 附带 剩余锁定时间（毫秒）/ 锁定至（ISO），与前端约定
          return no(res, "密码错误次数过多（一小时内 3 次），该 IP 已被锁定 1 小时", 423, {
            剩余锁定时间: rec.锁到 - Date.now(),
            剩余锁定毫秒: rec.锁到 - Date.now(),
            锁定至: new Date(rec.锁到).toISOString()
          });
        }
        锁定表[ip] = rec; 存锁定表();
        登录日志(ip, "失败", "连续第 " + rec.次数 + " 次");
        // 2.9.1：401 附带 剩余次数（含 remaining 别名，与前端约定）
        return no(res, "密码错误（本小时第 " + rec.次数 + " 次，" + 连败锁定次数 + " 次将锁定该 IP 1 小时）", 401, {
          剩余次数: Math.max(0, 连败锁定次数 - rec.次数),
          remaining: Math.max(0, 连败锁定次数 - rec.次数)
        });
      }
      delete 锁定表[ip]; 存锁定表();   // 成功登录清零失败计数
      const token = crypto.randomBytes(32).toString("hex");
      const 过期 = Date.now() + 会话毫秒;
      会话表.set(token, { 过期: 过期, ip: ip, 最近: Date.now() });
      存会话节流(true);   // 2.9.3：登录成功立即落盘，插件重载后 token 仍有效
      登录日志(ip, "成功", "");
      ok(res, {
        token: token, 有效毫秒: 会话毫秒,
        过期时间: 过期,
        初始密码: 密码 === "12345678",
        需改密: 密码 === "12345678",
        提示: 密码 === "12345678" ? "当前为初始密码，请尽快调用 POST /password 修改（需大写+小写+数字+特殊符号，≥8 位）" : ""
      });
    },
    password: (q, res) => {
      const b = (q && q.body) || {};
      const ip = 客户端IP(q);
      if (!校验会话(q)) { 登录日志(ip, "改密拒绝", "无有效会话"); return no(res, "未登录或会话已过期（请先 POST /login）", 401); }
      const 密码 = S(读控制台配置(ctx)["控制台密码"]) || "12345678";
      const 旧 = S(b.旧密码 !== undefined ? b.旧密码 : b.oldPassword);
      if (旧 !== 密码) { 登录日志(ip, "改密失败", "旧密码错误"); return no(res, "旧密码错误", 401); }
      const 新 = S(b.新密码 !== undefined ? b.新密码 : b.newPassword);
      const 问题 = 密码强度问题(新);
      if (问题) { 登录日志(ip, "改密失败", 问题); return no(res, 问题); }
      if (新 === "12345678") return no(res, "新密码不能是初始密码 12345678");
      写控制台配置(ctx, { 控制台密码: 新 });
      登录日志(ip, "改密成功", "");
      pushLog(ctx, "网页后台", "修改控制台登录密码");
      ok(res, { 已修改: true });
    },
    logout: (q, res) => {
      const tk = 取token(q);
      if (tk && 会话表.has(tk)) { 会话表.delete(tk); 存会话节流(true); }
      ok(res, { 已退出: true });
    },
    // ---------- 2.9.1（C1）主人级操作补全：踢出战斗 / 重置冷却 / 全服功能开关 ----------
    kickbattle: (q, res) => {
      const b = (q && q.body) || {};
      const x = byGid(ctx, S(b.id));
      if (!x) return no(res, "找不到该玩家", 404);
      // 移除战斗记录（读档方对 null 一律按「不在战斗中」处理）
      dset(ctx, P.战斗, x, null);
      // 中断自动出招
      const st = 读自动(ctx, x);
      let 停自动 = false;
      if (st && st.开) { st.开 = false; st.结束 = "控制台踢出战斗"; st.停时 = Date.now(); 写自动(ctx, x, st); 停自动 = true; }
      pushLog(ctx, "网页后台", "踢出战斗：" + gid(ctx, x) + (停自动 ? "（自动出招已中断）" : ""));
      ok(res, { 已踢出: true, 自动出招已中断: 停自动, 玩家: pl(x) });
    },
    cooldownReset: (q, res) => {
      const b = (q && q.body) || {};
      const x = byGid(ctx, S(b.id));
      if (!x) return no(res, "找不到该玩家", 404);
      for (const rel of [P.操作冷却, P.挑战冷却, P.出招冷却, P.打劫冷却]) dset(ctx, rel, x, 0);
      pushLog(ctx, "网页后台", "重置冷却：" + gid(ctx, x));
      ok(res, { 已重置: true, 玩家: pl(x) });
    },
    feature: (q, res) => {
      const b = (q && q.body) || {};
      const 开关 = 读控制台配置(ctx)["全服开关"];
      const 表 = 开关 && typeof 开关 === "object" && !Array.isArray(开关) ? 开关 : {};
      if (b.功能 === undefined) return ok(res, { 开关: 表, 说明: "POST {功能:'赌场', 开:false} 切换；当前支持：赌场" });
      const 名 = S(b.功能);
      if (名 !== "赌场") return no(res, "暂不支持的功能：" + 名 + "（当前支持：赌场）");
      表[名] = b.开 === undefined ? true : !!b.开;
      写控制台配置(ctx, { 全服开关: 表 });
      pushLog(ctx, "网页后台", "全服功能开关：" + 名 + " → " + (表[名] ? "开" : "关"));
      ok(res, { 开关: 表 });
    },
    // ---------- 2.9.1（C3）数据面板：经济 / 活跃 / 农场 ----------
    // 字段名与前端约定：economy 顶层标量 + 赌场/农场 对象；activity 小时(24数组)+列表；farm 榜单数组
    economy: (_q, res) => {
      try {
        const list = players(ctx);
        const 总量 = { 星羽: 0, 金币: 0, 星核: 0, 存款: 0 };
        for (const x of list) {
          总量.星羽 += dn(ctx, P.星羽, x, 0); 总量.金币 += dn(ctx, P.金币, x, 0);
          总量.星核 += dn(ctx, P.星核, x, 0); 总量.存款 += dn(ctx, P.存款, x, 0);
        }
        const c = 读控制台配置(ctx);
        let 农场总地块 = 0, 农场有人数 = 0;
        for (const x of list) {
          try { const arr = 读农场(ctx, x); if (Array.isArray(arr) && arr.length) { 农场总地块 += arr.length; 农场有人数 += 1; } } catch (e) { /* ignore */ }
        }
        const 赌场 = {
          今日赢: Math.floor(Number(c["赌场今日赢上限"]) || 0), 今日输: Math.floor(Number(c["赌场今日输上限"]) || 0),
          说明: "0 = 使用每日随机值；可在 POST /config 里设置"
        };
        ok(res, {
          玩家数: list.length, 全服倍率: 全服倍率(ctx),
          星羽: 总量.星羽, 金币: 总量.金币, 星核: 总量.星核, 存款: 总量.存款,
          总量: 总量, 赌场: 赌场, 赌场上限: 赌场,
          // 2.9.6（需求 11）：世界资金（放贷 / 银行利息 / 商店回收的资金池）
          世界资金: 读世界资金(ctx), 世界资金初始: 世界资金初始,
          // 2.9.6（需求 8）：全服信用概况
          信用: (() => {
            let 总 = 0, 失信 = 0, 最高 = 0;
            const 待收 = { 笔数: 0, 本金: 0, 利息: 0 };
            for (const x of list) {
              const v = 取信用分(ctx, x);
              总 += v; if (v <= 0) 失信 += 1; if (v > 最高) 最高 = v;
              const L = 贷款概况(ctx, x);
              if (L.有) { 待收.笔数 += 1; 待收.本金 += L.余额; 待收.利息 += L.利息; }
            }
            return { 平均分: list.length ? Math.round(总 / list.length * 10) / 10 : 0, 最高分: 最高, 失信人数: 失信, 贷款笔数: 待收.笔数, 未收本金: 待收.本金, 未收利息: 待收.利息 };
          })(),
          官方群链接: 官方群链接(),
          农场: { 玩家数: 农场有人数, 总地块数: 农场总地块 }
        });
      } catch (e) { no(res, "读取经济数据失败", 500); }
    },
    // 2.9.6（需求 11）：管理员给「世界资金」添加资金（需登录 token）
    //   body {金额}（兼容 {amount}）；负数 = 扣除（用于回收违规资金）
    economyFund: (q, res) => {
      const b = (q && q.body) || {};
      const 原 = b["金额"] !== undefined ? b["金额"] : b["amount"];
      const v = Math.floor(Number(原) || 0);
      if (!v) return no(res, "金额不能为 0（正整数增加，负数扣除）");
      const 前 = 读世界资金(ctx);
      const 后 = 加世界资金(ctx, v, "管理员控制台调整");
      pushLog(ctx, "网页后台", "调整世界资金 " + (v > 0 ? "+" : "") + v + "（" + 前 + " → " + 后 + "）");
      记管理日志(ctx, "调整世界资金", (v > 0 ? "+" : "") + v + "（" + 前 + " → " + 后 + "）");
      ok(res, { 世界资金: 后, 变化: 后 - 前, 变动前: 前, 世界资金初始: 世界资金初始 });
    },
    /* ---------- 2.9.9（需求 G）控制台扩展：细分倍率 / 双倍活动 / 批量发奖励 / 数据清理 ---------- */
    ratesGet: (_q, res) => {
      const out = {};
      for (const k of 细分倍率键) out[k] = 细分倍率(ctx, k);
      ok(res, { 倍率: out, 全服倍率: 全服倍率(ctx), 说明: "实际生效 = 称号加成 × 全服倍率 × 细分倍率；范围 0.5~5；掉落倍率只作用于副本掉落数量" });
    },
    ratesSet: (q, res) => {
      const b = (q && q.body) || {};
      const 旧表 = 读控制台配置(ctx)["细分倍率"] || {};
      const 新表 = {};
      for (const k of 细分倍率键) {
        const v = b[k] !== undefined ? Number(b[k]) : (Number(旧表[k]) || 1);
        if (!Number.isFinite(v) || v < 0.5 || v > 5) return no(res, k + "倍率必须在 0.5 ~ 5 之间");
        新表[k] = Math.round(v * 100) / 100;
      }
      写控制台配置(ctx, { 细分倍率: 新表 });
      const 双倍 = 细分倍率键.every((k) => 新表[k] === 2);
      记管理日志(ctx, 双倍 ? "开启双倍活动" : "调整细分倍率", JSON.stringify(新表));
      ok(res, { 倍率: 新表, 双倍活动: 双倍 });
    },
    grantBulk: (q, res) => {
      const b = (q && q.body) || {};
      const 筛 = S(b["筛选"] || b["filter"] || "全部");
      const 星羽 = Math.floor(Number(b["星羽"] ?? b["coin"]) || 0);
      const 道具 = S(b["道具"] || b["item"]);
      const 数量 = Math.max(1, Math.floor(Number(b["数量"] ?? b["count"]) || 1));
      if (!星羽 && !道具) return no(res, "星羽和道具至少填一项");
      if (道具 && allItems().indexOf(道具) < 0) return no(res, "没有这个道具：" + 道具);
      // 筛选：全部 / 等级:10（≥10 级）/ 信用:50（≥50 分）
      let 命中 = players(ctx);
      if (/^等级[:：]?/i.test(筛)) {
        const n = Number(筛.replace(/^等级[:：]?/i, "")) || 0;
        命中 = 命中.filter((x) => dn(ctx, P.等级, x, 1) >= n);
      } else if (/^信用[:：]?/.test(筛)) {
        const n = Number(筛.replace(/^信用[:：]?/, "")) || 0;
        命中 = 命中.filter((x) => 取信用分(ctx, x) >= n);
      } else if (筛 !== "全部") {
        return no(res, "筛选支持：全部 / 等级:10（≥10级）/ 信用:50（≥50分）");
      }
      for (const x of 命中) {
        if (星羽 > 0) addCoin(ctx, x, 星羽);
        if (道具) giveItem(ctx, x, 道具, 数量);
        pushLog(ctx, "网页后台", "批量发奖：" + (星羽 ? "星羽 +" + kfmt(星羽) : "") + (道具 ? (星羽 ? " · " : "") + 道具 + "×" + 数量 : ""));
      }
      记管理日志(ctx, "批量发奖励", "筛选=" + 筛 + " · " + 命中.length + " 人 · " + (星羽 ? "星羽+" + kfmt(星羽) : "") + (道具 ? (星羽 ? " · " : "") + 道具 + "×" + 数量 : ""));
      ok(res, { 人数: 命中.length, 筛选: 筛, 星羽: 星羽, 道具: 道具, 数量: 数量 });
    },
    cleanup: (q, res) => {
      const b = (q && q.body) || {};
      const 项 = S(b["项"] || b["target"] || "全部");
      const 结果 = {};
      const 做 = (k) => {
        if (k === "会话" || k === "全部") {
          try { dset(ctx, P.控制台会话, "会话", {}); 结果["控制台会话"] = "已清空（所有人需重新登录）"; } catch (e) { 结果["控制台会话"] = "失败"; }
        }
        if (k === "pvp" || k === "全部") {
          const 表 = PVP全表(ctx);
          let n = 0;
          for (const id of Object.keys(表.会话 || {})) {
            const s = 表.会话[id];
            if (!s || s.状态 === "已结束" || Date.now() - (Number(s.最后动作) || 0) > PVP无动作超时毫秒) { delete 表.会话[id]; n += 1; }
          }
          for (const u of Object.keys(表.待定 || {})) {
            if (!表.会话[表.待定[u]]) { delete 表.待定[u]; n += 1; }
          }
          PVP存表(ctx, 表);
          结果["PVP残留"] = "清理 " + n + " 条";
        }
        if (k === "基金" || k === "全部") {
          let n = 0;
          for (const u of Object.keys(dall(ctx, P.基金份额) || {})) { dset(ctx, P.基金份额, u, 0); n += 1; }
          for (const u of Object.keys(dall(ctx, P.基金成本) || {})) { dset(ctx, P.基金成本, u, 0); n += 1; }
          dset(ctx, P.基金净值, "值", 0);
          结果["旧基金档"] = "清零 " + n + " 条";
        }
      };
      if (["全部", "会话", "pvp", "基金"].indexOf(项) < 0) return no(res, "支持：全部 / 会话 / pvp / 基金");
      做(项);
      记管理日志(ctx, "数据清理", JSON.stringify(结果));
      ok(res, { 项: 项, 结果: 结果 });
    },
    /* ---------- 2.9.9（需求 H）指令列表：登录后拉一次，前端分组展示 ---------- */
    commands: (_q, res) => {
      ok(res, {
        分组: 完整菜单组.map((g) => ({ 组: g.组, 条: (g.条 || []).map((x) => [S(x[0]), S(x[1])]) })),
        统计: { 分组数: 完整菜单组.length, 条目数: 完整菜单组.reduce((a, g) => a + (g.条 || []).length, 0) },
        说明: "来自 完整指令菜单 数据（与游戏内 星甲完整指令菜单 一致）"
      });
    },
    activity: (_q, res) => {
      try {
        // 最近 24h：扫今天 + 昨天的消息日志（本插件无充值系统，暂无充值统计）
        const 下限 = Date.now() - 24 * 3600 * 1000;
        const 群 = {}, 战斗 = {}, 次数表 = {};
        const 小时 = new Array(24).fill(0);
        let 消息数 = 0;
        for (const d of [ymd(), ymd(Date.now() - 24 * 3600 * 1000)]) {
          for (const sc of ["group", "private"]) {
            for (const rec of 读日志行(ctx, d, sc, 5000)) {
              const t = Number(rec.time) || Date.parse(rec.ts) || 0;
              if (t && t < 下限) continue;
              消息数 += 1;
              if (t) 小时[new Date(t).getHours()] += 1;
              const id = S(rec.userId);
              if (id) 次数表[id] = (次数表[id] || 0) + 1;
              if (S(rec.groupId)) 群[S(rec.groupId)] = 1;
              if (id && /挑战|普攻|战斗/.test(S(rec.content || rec.msg || ""))) 战斗[id] = 1;
            }
          }
        }
        const 列表 = Object.keys(次数表).map((id) => ({
          id: id, 编号: gid(ctx, id), 昵称: ds(ctx, P.昵称, id, "无名"),
          消息数: 次数表[id], 战斗: !!战斗[id]
        })).sort((a, b) => b.消息数 - a.消息数).slice(0, 50);
        ok(res, {
          窗口: "最近 24 小时", 消息数: 消息数,
          活跃用户: Object.keys(次数表).length, 活跃群: Object.keys(群).length,
          战斗活跃用户: Object.keys(战斗).length,
          小时: 小时, 列表: 列表
        });
      } catch (e) { no(res, "读取活跃数据失败", 500); }
    },
    farm: (_q, res) => {
      try {
        const list = players(ctx).map((x) => {
          const 成 = 读农场成长(ctx, x);
          let 地块 = 0;
          try { const arr = 读农场(ctx, x); 地块 = Array.isArray(arr) ? arr.length : 0; } catch (e) { /* ignore */ }
          return { 编号: gid(ctx, x), 昵称: ds(ctx, P.昵称, x, "无名"), 农场等级: 成.等级, 地块数: 地块 };
        });
        list.sort((a, b) => (b.地块数 - a.地块数) || (b.农场等级 - a.农场等级));
        const 榜单 = list.slice(0, 20);
        ok(res, { 农场玩家数: list.length, top20: 榜单, 榜单: 榜单 });
      } catch (e) { no(res, "读取农场数据失败", 500); }
    },
    /* ---------- 2.9.10（需求 1）：股票管理 —— 行情（含上下限）/ 设置上下限 ---------- */
    // GET /stocks：管理接口，返回 10 只股现价 + 管理员上下限（玩家侧面板/指令一律不显示上下限）
    stocksGet: (_q, res) => {
      try {
        股票tick(ctx);
        const 行表 = 股票行情(ctx);
        const now = Date.now();
        ok(res, {
          股票: 股票表.map((it) => {
            const r = 行表[it.代码] || {};
            const 界 = 读股票上下限(ctx, it.代码);
            return { 代码: it.代码, 名: it.名, 价: Math.max(1, Math.round(Number(r.价) || it.起)), 停牌至: Number(r.停牌至) || 0, 停牌中: now < (Number(r.停牌至) || 0), 上限: 界.上, 下限: 界.下 };
          })
        });
      } catch (e) { no(res, "读取股票行情失败", 500); }
    },
    // POST /stocks/bounds：body { 股: 股名/代码, 上限, 下限 } —— 可只设一边；传空 / 0 = 取消该边
    stocksBounds: (q, res) => {
      try {
        const b = (q && q.body) || {};
        const it = 股票找(b["股"] ?? b["股名"] ?? b["股票"] ?? b["stock"]);
        if (!it) return no(res, "没有这只股票");
        const 现 = 读股票上下限(ctx, it.代码);
        const 有上 = b["上限"] !== undefined, 有下 = b["下限"] !== undefined;
        const 新 = 设股票上下限(ctx, it.代码, 有上 ? b["上限"] : 现.上, 有下 ? b["下限"] : 现.下);
        if (!新) return no(res, "上限必须大于下限（两边都设时）");
        记管理日志(ctx, "设置股票上下限", it.代码 + " " + it.名 + " → 上限 " + (新.上 || "无") + " / 下限 " + (新.下 || "无"));
        ok(res, { 代码: it.代码, 名: it.名, 上限: 新.上, 下限: 新.下, 说明: "0 = 不设限；波动 tick 与事件联动都会夹在 [下限,上限] 区间" });
      } catch (e) { no(res, "设置股票上下限失败", 500); }
    }
  };
  const wrap = (fn) => (q, res) => {
    try { fn(q, res); }
    catch (e) {
      if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] webui 接口错误:", e);
      no(res, "服务器错误：" + (e && e.message ? e.message : String(e)), 500);
    }
  };
  // 同时挂到根路径（规范写法，配合 apiBase）与 /gfmk/*（兼容旧地址）
  const table = [
    ["get", "/meta", H.meta], ["get", "/stats", H.stats],
    ["get", "/players", H.players], ["get", "/player", H.player],
    ["post", "/player/update", H.update], ["post", "/player/items", H.items],
    ["post", "/player/ban", H.ban], ["post", "/player/reset", H.reset],
    ["get", "/logs", H.logs], ["post", "/announce", H.announce],
    // 2.9.3：常驻公告（每条消息底部灰字，留空关闭）
    ["post", "/announce/sticky", H.sticky],
    ["get", "/owners", H.owners], ["post", "/owners", H.ownersSave],
    // 2.7.0（需求 3/4/12/13/14/15）：称号 / 改编号 / 解绑·改绑·转移 / 全服倍率
    ["get", "/titles", H.titles],
    // 2.9.8（需求 1）：词条「敬请期待」管理员手动激活 / 撤销 / 状态（均需 token）
    ["post", "/titles/grant", H.grant], ["post", "/titles/revoke", H.revoke],
    ["get", "/titles/state", H.state],
    ["post", "/player/number", H.number],
    ["post", "/player/title", H.title],
    ["post", "/player/unbind", H.unbind],
    ["post", "/player/rebind", H.rebind],
    ["post", "/player/transfer", H.transfer],
    ["get", "/server", H.server], ["post", "/server/multiplier", H.multiplier],
    // 2.2.1 控制台扩展（xinjia 那套功能）
    ["get", "/dashboard", H.dashboard], ["get", "/rankings", H.rankings], ["get", "/dungeons", H.dungeons],
    ["get", "/chats", H.chats], ["get", "/msgs", H.msgs], ["get", "/msg-dates", H.msgDates],
    ["post", "/send", H.send], ["post", "/recall", H.recall],
    ["get", "/config", H.config], ["post", "/config", H.configSave],
    ["get", "/sharp", H.sharp], ["post", "/sharp/install", H.sharpInstall],
    ["get", "/mods", H.mods], ["post", "/mods/clear", H.modsClear],
    // 2.9.1（C2）：登录 / 改密（/login 免 token，其余全部要 token）
    ["post", "/login", H.login], ["post", "/password", H.password], ["post", "/logout", H.logout],
    // 2.9.1（C1）：主人级操作补全
    ["post", "/player/kickbattle", H.kickbattle], ["post", "/player/cooldown-reset", H.cooldownReset],
    ["post", "/server/feature", H.feature],
    // 2.9.1（C3）：数据面板
    ["get", "/economy", H.economy], ["get", "/activity", H.activity], ["get", "/farm", H.farm],
    // 2.9.6（需求 11）：添加 / 扣除世界资金（需登录 token）
    ["post", "/economy/fund", H.economyFund],
    // 2.9.9（需求 G/H）：细分倍率 / 双倍活动 / 批量发奖励 / 数据清理 / 指令列表（均需 token）
    ["get", "/server/rates", H.ratesGet], ["post", "/server/rates", H.ratesSet],
    ["post", "/players/grant-bulk", H.grantBulk],
    ["post", "/system/cleanup", H.cleanup],
    ["get", "/commands", H.commands],
    // 2.9.10（需求 1）：股票管理 —— 行情（含上下限）/ 设上下限（均需登录 token）
    ["get", "/stocks", H.stocksGet], ["post", "/stocks/bounds", H.stocksBounds]
  ];
  // 2.9.1（C2）：除 /login 外的所有接口都要求会话 token（Authorization: Bearer / X-Token / ?token=）
  const 免认证 = new Set(["/login"]);
  const 守卫 = (fn, p) => (免认证.has(p) ? fn : (q, res) => {
    if (!校验会话(q, res)) return no(res, "未登录或会话已过期（请先 POST /login 获取 token）", 401);
    fn(q, res);
  });
  for (const item of table) {
    const verb = item[0], p = item[1], fn = wrap(守卫(item[2], p));
    try { r[verb](p, fn); } catch (e) { /* 路径冲突则忽略 */ }
    try { r[verb]("/gfmk" + p, fn); } catch (e) { /* 同上 */ }
  }
  // 静态目录（webui/ 下的 admin.html 等）
  if (typeof r.static === "function") {
    try { r.static("/static", "webui"); } catch (e) { /* ignore */ }
  }
  // 自包含 HTML 备用页：不管是 React 模块加载失败，还是想直接用浏览器打开，
  // 访问 <apiBase>/gfmk/admin（或 <apiBase>/gfmk）都能拿到完整的管理界面
  const 发管理页 = (res) => {
    let html = "";
    try {
      const p = 解析插件相对路径(ctx, "webui/admin.html");
      if (p && fs.existsSync(p)) html = fs.readFileSync(p, "utf8");
    } catch (e) { html = ""; }
    if (!html) return no(res, "管理页缺失：webui/admin.html", 404);
    if (typeof res.type === "function" && typeof res.send === "function") { res.type("html").send(html); return; }
    if (typeof res.set === "function" && typeof res.send === "function") { res.set("Content-Type", "text/html; charset=utf-8").send(html); return; }
    ok(res, { html: html });
  };
  for (const route of ["/gfmk/admin", "/gfmk"]) {
    try { r.get(route, (_q, res) => 发管理页(res)); } catch (e) { /* 路径冲突则忽略 */ }
  }
  // 3.0.0（需求 6）：控制台「指令一览」—— 直接访问 <apiBase>/commands-page 也能打开（与 /commands 同源数据）
  const 发指令页 = (res) => {
    let html = "";
    try {
      const p = 解析插件相对路径(ctx, "webui/commands.html");
      if (p && fs.existsSync(p)) html = fs.readFileSync(p, "utf8");
    } catch (e) { html = ""; }
    if (!html) return no(res, "页面缺失：webui/commands.html", 404);
    if (typeof res.type === "function" && typeof res.send === "function") { res.type("html").send(html); return; }
    if (typeof res.set === "function" && typeof res.send === "function") { res.set("Content-Type", "text/html; charset=utf-8").send(html); return; }
    ok(res, { html: html });
  };
  for (const route of ["/commands-page", "/gfmk/commands-page"]) {
    try { r.get(route, (_q, res) => 发指令页(res)); } catch (e) { /* 路径冲突则忽略 */ }
  }
  // 控制台里的「打开控制台」入口：优先内嵌 React 模块（kind: module），失败则由 htmlFile 兜底
  if (typeof r.page === "function") {
    try {
      r.page({
        path: "admin",
        title: "星甲 玩家数据后台",
        icon: "users",
        description: "查看 / 修改玩家数据 · 道具发放 · 封禁 · 日志 · 公告",
        kind: "module",
        module: "webui/remote.js",
        htmlFile: "webui/admin.html"
      });
    } catch (e) {
      if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] page() 注册失败:", e);
    }
    // 3.0.0（需求 6）：指令一览页（经典 HTML，iframe 打开，自带搜索）
    try {
      r.page({
        path: "commands",
        title: "星甲 指令一览",
        icon: "list",
        description: "查看全部可用指令 · 支持关键词搜索",
        htmlFile: "webui/commands.html"
      });
    } catch (e) {
      if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] page() 注册失败（commands）:", e);
    }
  }
  if (ctx.logger && ctx.logger.info) {
    ctx.logger.info("[xjyl] 网页后台已注册：apiBase/players · apiBase/stats · apiBase/admin");
  }
}
