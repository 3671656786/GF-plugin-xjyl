// lib/core/base.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { P } from "././util.mjs?v=v1795531862405";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


// 本文件所在目录（= 插件目录；运行副本里是 plugins_two/<账号>/GF-plugin-xjyl/）。
// 插件自带资源固定在 <插件目录>/data/ 下，用它兜底可以不依赖 ctx.pluginPath。
export const 自身目录 = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)); } catch (e) { return ""; }
})();



export const 版本 = "3.3.17";


// 2.6.0：最高权限者改为「插件配置」可改（控制台 → 插件 → GF-plugin-xjyl → 配置）
//   这里只是出厂默认值；运行时以 dataPath/config.json 里的「最高权限者」为准。
export const 默认最高权限者 = "6E0B188704AC0611617425B687DB9034";


export let 最高权限者 = 默认最高权限者;
// 3.0.0 拆分：模块间的 let 不能直接赋值（imported binding 只读），统一走 setter
export function 设最高权限者(v) { 最高权限者 = v; }


// 官方群链接（写死在代码里，不提供任何配置入口；`星甲官方群` 面板与世界资金见底的补货提示都只读这个常量）
export const 官方群链接常量 = "点击链接加入群聊【星甲官方群】：https://qun.qq.com/universal-share/share?ac=1&authKey=tgMfPkv8BzT9gZk26%2B%2BtL46Woa3ZuIf761D5MWC6QnzC%2FSta%2Fu%2BI6A1Uhi3jrotI&busi_data=eyJncm91cENvZGUiOiIxMDg3NzA4MTY2IiwidG9rZW4iOiI1OVE4bW1pSlMwWGxpa3JkTUZzM2ZzN2E4RFd2dzRlL05ISUdvWnhMaHl1NlBXa0pSemxsK2RHL0tvOFUzN0hNIiwidWluIjoiMzY3MTY1Njc4NiJ9&data=SRMfbGKjqqKNh7w_ypoa0l2eoj3cstKhkyUsSMLg5gZPcMPcwhgyvUzFS9yeu-U_uSyh7gKkiy_4tjidynxgxA&svctype=4&tempid=h5_group_info";



/* ============================================================
 * 一、基础工具
 * ============================================================ */
export function S(v) { return String(v === undefined || v === null ? "" : v).trim(); }


export function NW(v) { return String(v === undefined || v === null ? "" : v).replace(/[\s\u3000\u00a0]+/g, ""); }


// 剥离 QQ 官方群聊 content 里的 @机器人 标记与指令前缀
// 2.5.10：恢复最初的消息接收逻辑（撤销 2.5.9 的「必须 @ 本机 / @ 别人就不响应」判定）
export function PT(raw) {
  let s = String(raw === undefined || raw === null ? "" : raw);
  s = s.replace(/<@!?[A-Za-z0-9_\-]+>/g, " ");
  s = s.replace(/^[\s\u3000\u00a0]*@[^\s\u3000\u00a0#]+[\s\u3000\u00a0]*/g, "");
  s = s.replace(/[\u3000\u00a0]/g, " ").trim();
  s = s.replace(/^[\s\/／]+/, "").trim();
  return s;
}



export function n(v, fb) {
  const x = Number(v);
  return Number.isFinite(x) ? x : (fb === undefined ? 0 : fb);
}


export function ymd(ts) {
  const d = ts ? new Date(Number(ts)) : new Date();
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}


export function fmt(ts) {
  const d = ts ? new Date(Number(ts)) : new Date();
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}


export function rnd(a, b) {
  const lo = Math.ceil(Math.min(a, b));
  const hi = Math.floor(Math.max(a, b));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}


export function roll(list) {
  let total = 0;
  for (const x of list) total += Number(x.w) || 0;
  if (total <= 0) return list[0] || null;
  let r = Math.random() * total;
  for (const x of list) { r -= Number(x.w) || 0; if (r <= 0) return x; }
  return list[list.length - 1];
}


export function kfmt(v) {
  return String(Math.floor(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


export function wait(ms) {
  const s = Math.max(0, Math.ceil(Number(ms) / 1000));
  if (s < 60) return s + " 秒";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " 分 " + (s % 60) + " 秒";
  return Math.floor(m / 60) + " 小时 " + (m % 60) + " 分";
}


export function escMd(t) {
  return String(t === undefined || t === null ? "" : t).replace(/[\[\]]/g, (m) => "\\" + m);
}


export function mdImg(url, alt) {
  return "![" + S(alt || "img") + " #640px #640px](" + S(url) + ")";
}


// 2.2.6：所有指令统一加「星甲」前缀 —— 这里集中处理，蓝色字/按钮/提示都自动带前缀
export const 星甲前缀 = "星甲";


export function 去星甲(s) { return String(s === undefined || s === null ? "" : s).replace(/^星甲[\s#：:]*/, ""); }


// 提示文本里的 `指令` → `星甲指令`（词典里的才替换，不会误伤普通反引号内容）
export const 星甲词典 = [
  "测试markdown", "清空个人收藏歌曲", "清空个人收藏音乐", "我的openid", "领取联盟战奖励", "BOSS列表", "查看个人编号", "自动挑战进度",
  "一键挑战进度", "领取任务奖励", "领取联盟日奖", "插件运行状态", "清理残留物品", "清空残留物品", "重置每日任务", "联盟战奖励",
  "今日超能力", "撤回上一条", "天下楼面板", "天下楼进度", "天下楼挑战", "挑战天下楼", "签到排行榜", "评分排行榜",
  "攻击排行榜", "血量排行榜", "等级排行榜", "星羽排行榜", "存款排行榜", "星核排行榜", "help", "完整菜单",
  "详细菜单", "全部指令", "升级装备", "转移升级", "boss", "BOSS", "装备信息", "装备加成",
  "兑换金币", "使用指南", "帮助文档", "普通攻击", "技能列表", "赠送物品", "转账星羽", "副本列表",
  "简短菜单", "迷你菜单", "个人编号", "我的编号", "签到打卡", "每日签到", "我的信息", "个人信息",
  "我的档案", "修复战甲", "退出修甲", "取消修甲", "修甲进度", "提升等级", "战甲强化", "我的背包",
  "背包信息", "一键整理", "背包整理", "整理背包", "我的队伍", "队伍信息", "队伍挑战", "组队挑战",
  "加入boss组队", "加入副本组队",   // P8：按队长编号上车（新口令）
  "开始挑战", "退出队伍", "解散队伍", "一键挑战", "自动挑战", "挑战进度", "取消挑战", "终止挑战",
  "经验统计", "今日经验", "经验获取", "怎么升级", "匹配挑战", "快速挑战", "随机挑战", "每日任务",
  "一键领奖", "联盟系统", "查看联盟", "我的联盟", "联盟日奖", "联盟奖励", "退出联盟", "使用道具",
  "道具使用", "银行系统", "全部存入", "全部存款", "全部取出", "全部取款", "暗域商锋", "星核商店",
  "我的上架", "金融市场", "基金市场", "星域赌场", "天选转盘", "抽卡10", "今日运势", "玩法系统",
  "娱乐系统", "我的军衔", "昵称历史", "改名记录", "音乐系统", "音乐功能", "音乐菜单", "个人歌单",
  "我的收藏", "我的歌单", "清空收藏", "音乐帮助", "点歌帮助", "本群信息", "入群欢迎", "撤回最近",
  "新手指引", "新手引导", "主人菜单", "管理菜单", "主人帮助", "封禁名单", "主人列表", "插件统计",
  "管理日志", "插件日志", "系统日志", "我的装备", "装备面板", "爬塔挑战", "登楼挑战", "更新公告",
  "更新日志", "版本公告", "更新说明", "我的农场", "农场面板", "全部收获", "运行状态", "系统状态",
  "插件重启", "重启插件", "清理残留", "清空残留", "测试md", "测试按钮", "按钮测试", "放弃战斗",
  "一键出招", "自动出招", "查看玩家", "加入队伍", "一键种菜", "主菜单", "换金币", "小菜单",
  "控制台", "联盟战", "排行榜", "交易行", "拍卖行", "摇骰子", "新玩法", "超能力",
  "群管理", "查我行", "天下楼", "挑战塔", "卖作物", "软重启", "时空门", "菜单",
  "mk", "MK", "帮助", "系统", "指令", "做菜", "烹饪", "食堂",
  "菜谱", "指南", "攻略", "加点", "普攻", "技能", "赠送", "转账",
  "存款", "取出", "装甲", "注册", "开号", "签到", "巡游", "打卡",
  "属性", "战力", "修甲", "升级", "转生", "轮回", "强化", "背包",
  "队伍", "打坐", "冥想", "修行", "修炼", "经验", "副本", "秘境",
  "任务", "领奖", "联盟", "排行", "道具", "银行", "商店", "基金",
  "挖矿", "采矿", "打工", "搬砖", "赌场", "转盘", "抽奖", "骰子",
  "抽卡", "单抽", "十连", "运势", "玩法", "军衔", "点歌", "群管",
  "指引", "装备", "爬塔", "登楼", "公告", "农场", "菜园", "种菜",
  "收获", "收菜", "收割", "收成", "逃跑", "撤离", "治疗", "回血",
  "探索", "钓鱼", "音乐", "脱下"
];


export const 词典正则 = 星甲词典
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((w) => [w, new RegExp("`(?!星甲)(" + w + ")([#0-9]{0,3})`", "g")]);


export function 加前缀指令(text) {
  let s = String(text === undefined || text === null ? "" : text);
  if (!s) return s;
  for (const [w, re] of 词典正则) s = s.replace(re, (all, a, b) => "`" + 星甲前缀 + a + (b || "") + "`");
  return s;
}



/* ============================================================
 * 二、数据层
 * ============================================================ */
export function root(ctx) {
  const base = S(ctx && ctx.dataPath);
  if (!base) throw new Error("[xjyl] 缺少 dataPath");
  const dir = path.join(base, "tc");
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
  return dir;
}


export function fileOf(ctx, rel) {
  return path.join(root(ctx), String(rel).replace(/\\/g, "/"));
}


/* ---------- 2.6.0（需求 5）改名数据迁移 ----------
 * 插件从 GF-plugin-mk 改名为 GF-plugin-xjyl 后，宿主给的 dataPath 也随之变化
 * （data/<账号>/GF-plugin-mk → data/<账号>/GF-plugin-xjyl）。
 * 这里在首次启动时把旧目录整份拷过来，保证玩家进度不丢；迁移完写标记，之后不再迁。
 */
export function 迁移旧数据(ctx) {
  const base = S(ctx && ctx.dataPath);
  if (!base) return null;
  const 标记 = path.join(base, ".migrated-from-mk");
  if (fs.existsSync(标记)) return null;
  const 旧目录 = path.join(path.dirname(base), "GF-plugin-mk");
  let 结果 = { 已迁移: false, 来源: 旧目录 };
  try {
    // 「有没有数据」不能只看 tc/ 是否存在 —— 读数据层时会自动创建空的 tc/，
    // 所以要看里面有没有真正的业务目录（游戏数据 / 系统 / 任务系统）。
    const 有业务目录 = (d) => ["游戏数据", "系统", "任务系统", "新手指引"].some((x) => fs.existsSync(path.join(d, "tc", x)));
    const 旧有数据 = fs.existsSync(旧目录) && 有业务目录(旧目录);
    const 新有数据 = 有业务目录(base);
    if (旧有数据 && !新有数据) {
      fs.cpSync(旧目录, base, { recursive: true, force: false, errorOnExist: false });
      结果.已迁移 = true;
      if (ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 已从旧插件目录迁移玩家数据：" + 旧目录 + " → " + base);
    }
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(标记, JSON.stringify({ 时间: new Date().toISOString(), 旧目录: 旧目录, 已迁移: 结果.已迁移 }, null, 2), "utf8");
  } catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 旧数据迁移出错:", e);
  }
  return 结果;
}


export function dget(ctx, rel, key, fb) {
  const f = fileOf(ctx, rel);
  try {
    if (!fs.existsSync(f)) return fb;
    const o = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!o || typeof o !== "object") return fb;
    const v = o[key];
    return v === undefined || v === null ? fb : v;
  } catch (e) { return fb; }
}


/* 2.9.13（U6/U7）：数据档原子写 + 失败重试
 * 旧实现直接 writeFileSync 覆盖目标文件 —— 进程在写一半时挂掉/被杀，档就会损坏（JSON 读不回来）。
 * 现在：先写同目录临时文件（.tmp-<pid>-<随机>），再 fs.renameSync 原子覆盖目标；
 *   rename 失败重试一次，仍失败退回直接覆盖写（并打日志）。
 *   ⚠ 部分宿主的 brokered fs shim 不允许 rename（EPERM）——连续失败两次本进程内退回直写，
 *     不让每次写入都白白多付两次失败调用的开销；rename 可用的宿主保持原子写。
 * 所有走 dset 的档（世界资金 / 股票份额 / 每日进度 …）统一受益。
 */
export let __原子写退回 = false;


export function 原子写文件(ctx, f, data) {
  if (!__原子写退回) {
    const tmp = f + ".tmp-" + process.pid + "-" + Math.random().toString(36).slice(2, 8);
    let 写临时成功 = false;
    try {
      fs.writeFileSync(tmp, data, "utf8");
      写临时成功 = true;
      try { fs.renameSync(tmp, f); return true; }
      catch (e1) {
        try { fs.renameSync(tmp, f); return true; }   // Windows 上目标被短暂占用时重试一次
        catch (e2) {
          __原子写退回 = true;   // 本宿主 rename 不可用 → 之后全部直写，避免每次白付两次失败调用
          if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] rename 原子写不可用（" + (e1 && e1.code) + "），退回直接覆盖写");
        }
      }
    } catch (e) { /* 临时文件写失败 → 下面直写兜底 */ }
    try { if (写临时成功 && fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
  }
  try { fs.writeFileSync(f, data, "utf8"); return true; }
  catch (e2) {
    if (ctx && ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 写入失败:", f, e2);
    return false;
  }
}


export function dset(ctx, rel, key, val) {
  const f = fileOf(ctx, rel);
  try {
    const dir = path.dirname(f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let o = {};
    if (fs.existsSync(f)) {
      try { const raw = JSON.parse(fs.readFileSync(f, "utf8")); if (raw && typeof raw === "object") o = raw; } catch (e) { o = {}; }
    }
    o[key] = val;
    return 原子写文件(ctx, f, JSON.stringify(o, null, 2));
  } catch (e) {
    if (ctx && ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 写入失败:", rel, key, e);
    return false;
  }
}


export function dall(ctx, rel) {
  const f = fileOf(ctx, rel);
  try {
    if (!fs.existsSync(f)) return {};
    const o = JSON.parse(fs.readFileSync(f, "utf8"));
    return o && typeof o === "object" ? o : {};
  } catch (e) { return {}; }
}


export function dn(ctx, rel, key, fb) { return n(dget(ctx, rel, key, fb), fb || 0); }


export function ds(ctx, rel, key, fb) { const v = dget(ctx, rel, key, fb); return v === undefined || v === null ? (fb || "") : String(v); }


// 2.5.27：管理日志只保留 **2 天**，超过两天的自动删除（写入时清一次）
export const 日志保留毫秒 = 2 * 24 * 3600 * 1000;


export function 日志时间戳(x) {
  if (x && Number(x.毫秒)) return Number(x.毫秒);
  const s = S(x && x.时间);
  const t = Date.parse(s.replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
}


export function 读管理日志(ctx) {
  const raw = dget(ctx, P.操作日志, "日志", []);
  const list = Array.isArray(raw) ? raw : [];
  const 下限 = Date.now() - 日志保留毫秒;
  return { 全部: list, 有效: list.filter((x) => 日志时间戳(x) >= 下限) };
}


export function pushLog(ctx, who, what) {
  const { 有效 } = 读管理日志(ctx);
  有效.unshift({ 时间: fmt(), 毫秒: Date.now(), 操作者: S(who), 内容: S(what) });
  dset(ctx, P.操作日志, "日志", 有效.slice(0, 2000));
}


// 2.9.9（需求 G）：控制台管理操作的独立审计日志（JSONL 追加写，不滚动丢失）
// 2.9.13（U7）：appendFileSync 单次调用即原子追加；失败重试一次再放弃（日志失败不影响主流程）
export function 记管理日志(ctx, 动作, 详情, 操作者) {
  pushLog(ctx, S(操作者) || "网页后台", S(动作) + (详情 ? "：" + S(详情) : ""));
  try {
    const dir = path.join(S(ctx && ctx.dataPath), "log");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, "管理操作.jsonl");
    const 行 = JSON.stringify({ 时间: fmt(), 毫秒: Date.now(), 操作者: S(操作者) || "网页后台", 动作: S(动作), 详情: S(详情) }) + "\n";
    try { fs.appendFileSync(f, 行, "utf8"); }
    catch (e1) { try { fs.appendFileSync(f, 行, "utf8"); } catch (e2) { /* 日志失败不影响主流程 */ } }
  } catch (e) { /* 日志失败不影响主流程 */ }
}
