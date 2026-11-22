// lib/admin/admin.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { 修改记录 } from "././edit.mjs?v=v1795357425873";
import { S, dall, dget, dn, ds, dset, fmt, kfmt, n, pushLog, ymd, 最高权限者, 版本, 自身目录, 读管理日志, 默认最高权限者, 设最高权限者 } from "./../core/base.mjs?v=v1795357425873";
import { actBtn, btn, delMsg, reply, row, sendMd, seqMap } from "./../core/qq.mjs?v=v1795357425873";
import { P, isGm, uid } from "./../core/util.mjs?v=v1795357425873";
import { players } from "./../game/alliance.mjs?v=v1795357425873";
import { giveEquip } from "./../game/equip.mjs?v=v1795357425873";
import { _道具集缓存, 清道具集缓存, allItems, attrs, byGid, gid, giveItem, hasAcc, hasItem, pText, pwrOf, recPwr, 今日经验 } from "./../game/player.mjs?v=v1795357425873";
import { 装备定义 } from "./../game/rebirth.mjs?v=v1795357425873";
import { _sharp缓存, 清Sharp缓存 } from "./../ui/card.mjs?v=v1795357425873";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import child_process from "node:child_process";


/* ============================================================
 * 十二、管理：主人菜单 / 群管 / 网页后台
 * ============================================================ */
export function ownerList(ctx) {
  const v = dget(ctx, P.主人名单, "列表", []);
  return Array.isArray(v) ? v.map((x) => S(x)).filter(Boolean) : [];
}


export function isOwner(ctx, event) {
  const id = uid(event);
  if (id === 最高权限者) return true;
  return ownerList(ctx).indexOf(id) >= 0;
}


export function isBanned(ctx, u) { return ds(ctx, P.封禁名单, u, "正常") === "封禁"; }



/* ============================================================
 * 2.9.2（需求 5）可编辑字段表 —— 控制台 /player/update 与主人指令共用
 * ------------------------------------------------------------
 * · 每个字段 = 名 → 存档路径 + 合法区间 + 重置默认值
 * · 原来只有「Math.max(0, v)」这一层，暴击率能填 999、等级能填 0、闪避率没入口
 * · 现在两条入口都走 夹紧字段()：低于下限抬到下限、高于上限压到上限
 * · 同一路径允许多个别名（攻击 ↔ 攻击力、闪避 ↔ 闪避率），重置时按路径去重，
 *   否则后面的别名会用默认值 0 把前面的默认值覆盖掉
 * · 战力 是派生值（攻击/防御/血量…算出来的），不放进可编辑字段
 * ============================================================ */
export const 字段表 = [
  { 名: "攻击力", 路径: P.攻击, 区间: [1, 1000000000], 默认: 100 },
  { 名: "防御力", 路径: P.防御, 区间: [0, 1000000000], 默认: 0 },
  { 名: "生命", 路径: P.血量上限, 区间: [1, 1000000000], 默认: 500 },
  { 名: "血量", 路径: P.血量, 区间: [0, 1000000000], 默认: 500 },
  { 名: "血量上限", 路径: P.血量上限, 区间: [1, 1000000000], 默认: 500 },
  { 名: "暴击率", 路径: P.暴击率, 区间: [0, 80], 默认: 5, 小数: true },
  { 名: "暴伤", 路径: P.暴伤, 区间: [0, 1000], 默认: 150, 小数: true },
  // 闪避率：存档就是基础闪避（P.闪避），词条汇总会把它和装备/称号/星灵加在一起（上限 40%）
  { 名: "闪避率", 路径: P.闪避, 区间: [0, 40], 默认: 0, 小数: true },
  { 名: "真伤概率", 路径: P.真伤概率, 区间: [0, 60], 默认: 0, 小数: true },
  { 名: "等级", 路径: P.等级, 区间: [1, 9999], 默认: 1 },
  { 名: "经验", 路径: P.经验, 区间: [0, 1000000000000000], 默认: 0 },
  { 名: "转生", 路径: P.转生, 区间: [0, 99], 默认: 0 },
  { 名: "星羽", 路径: P.星羽, 区间: [0, 1000000000000000], 默认: 0 },
  { 名: "金币", 路径: P.金币, 区间: [0, 1000000000000000], 默认: 0 },
  { 名: "存款", 路径: P.存款, 区间: [0, 1000000000000000], 默认: 0 },
  { 名: "星核", 路径: P.星核, 区间: [0, 1000000000], 默认: 0 },
  { 名: "贡献", 路径: P.贡献, 区间: [0, 1000000000000000], 默认: 0 },
  // 旧字段名（主人指令 设置攻击# / 设置闪避# / 设置强化# 仍在用）：不进 /meta 下拉，但同样夹紧
  { 名: "攻击", 路径: P.攻击, 区间: [1, 1000000000], 默认: 100, 别名: true },
  { 名: "防御", 路径: P.防御, 区间: [0, 1000000000], 默认: 0, 别名: true },
  { 名: "闪避", 路径: P.闪避, 区间: [0, 40], 默认: 0, 小数: true, 别名: true },
  { 名: "暴击", 路径: P.暴击, 区间: [0, 1000000000], 默认: 0, 别名: true },
  { 名: "强化", 路径: P.强化, 区间: [0, 999], 默认: 0, 别名: true }
];


export const 字段定义 = {};


for (const f of 字段表) 字段定义[f.名] = f;


export const EDIT_FIELD = {};


for (const f of 字段表) EDIT_FIELD[f.名] = f.路径;


// 夹紧：非法字段 / 非数字 → null；否则按下限~上限裁剪（小数型保留 2 位，整数型向下取整）
export function 夹紧字段(名, 值) {
  const f = 字段定义[S(名)];
  if (!f) return null;
  const v = Number(值);
  if (!Number.isFinite(v)) return null;
  const 下 = Number(f.区间[0]) || 0;
  const 上 = Number(f.区间[1]) || 0;
  const x = Math.min(上, Math.max(下, v));
  return f.小数 ? Math.round(x * 100) / 100 : Math.floor(x);
}


// /meta 用的字段清单（去掉别名）与区间表
export const 可编辑字段名 = 字段表.filter((f) => !f.别名).map((f) => f.名);


export function 字段区间表() {
  const o = {};
  for (const f of 字段表) if (!f.别名) o[f.名] = [f.区间[0], f.区间[1]];
  return o;
}


export function menuBtn() { return btn("adm_menu", "👑 主人菜单", "主人菜单"); }


export async function ownerMenu(ctx, t) {
  await reply(ctx, t, [
    "最高权限者：`" + 最高权限者 + "`",
    "其他主人：" + ownerList(ctx).length + " 位",
    "",
    "**👤 数据修改**",
    "- `设置星羽#编号#数值`：星羽/金币/存款/星核/贡献/经验/等级/攻击力(攻击)/防御力(防御)/生命/血量/血量上限/",
    "　暴击率/暴伤/闪避率(闪避)/真伤概率/转生/强化 同法；数值会按各字段合法区间自动夹紧（如暴击率 0~80、闪避率 0~40）",
    "- `查看玩家#编号` · `重置玩家#编号` · `重置天下楼#编号`（清空该玩家爬塔进度）",
    "- `发放道具#编号#名称#数量`：名称支持 星羽/金币/存款/星核/贡献/经验 与任意道具、装备；**数量可为负数表示扣除**",
    "　例：`发放道具#32#星羽#999999` · `发放道具#32#刷新卡#10` · `发放道具#32#虚空裁决#1`",
    "- 数量支持任意位数（无上限），如 `发放道具#32#星羽#999999999`",
    "",
    "**🚫 封禁**：`封禁玩家#编号` · `解封玩家#编号` · `封禁名单`",
    "**👑 主人**：`加主人#openid` · `删主人#openid` · `主人列表` · `查我行`",
    "**📢 系统**：`插件统计` · `星甲运行状态` · `管理日志#页码` · `星甲重启` · `重载插件` · `全服公告#内容` · `重置每日任务#编号`",
    "**🛡️ 群管**：`群管`（群管功能菜单）· `本群信息` · `入群欢迎` · `撤回上一条` · `撤回#消息ID`",
    "",
    "> `重载插件` 走宿主热重载（保留存档，无需重新出战）；`星甲重启` 是软重启（清缓存）。两者都可用。",
    "> 群管功能菜单含 6 大板块：基础群管 / 入群验证 / 撤回系统 / 违禁系统 / 运营数据 / 入群审核，发 `群管` 查看。",
    "> `管理日志` 每页 20 条可翻页（`管理日志#2`），只保留最近 2 天；`星甲运行状态` 看 CPU/内存/全服玩家。"
  ].join("\n"), {
    标题: "👑 主人菜单",
    行组: [
      row(btn("am1", "查看玩家", "查看玩家#"), btn("am2", "插件统计", "插件统计"), btn("am3", "管理日志", "管理日志")),
      row(btn("am13", "运行状态", "运行状态"), btn("am14", "软重启", "星甲重启"), btn("am15", "刷新日志", "管理日志#1")),
      row(btn("am4", "主人列表", "主人列表"), btn("am5", "封禁名单", "封禁名单"), btn("am6", "群管功能", "群管")),
      // 3.1.20：重载插件（宿主热重载）+ 群管菜单显式加进主人菜单，方便找
      row(btn("am16", "重载插件", "重载插件"), btn("am17", "群管菜单", "群管")),
      // 2.6.0：这里原来有 3 个「设置星羽 / 发放道具 / 发放星羽」按钮，data 是
      //   `设置星羽#编号#数量` 这种占位串，点一下会把占位文字填进聊天栏，发出去必然报格式错。
      //   参数类指令不适合做按钮，改成下面文字里的手打示例。
      row(btn("am4b", "排行榜", "排行榜"), btn("am4c", "封禁名单", "封禁名单"), btn("am4d", "重置每日任务", "重置每日任务")),
      row(btn("am9", "重置任务", "重置每日任务"), btn("am10", "全服公告", "全服公告#内容"), btn("am11", "返回首页", "菜单", 0))
    ]
  });
}


export async function setField(ctx, t, who, id, field, val) {
  const rel = EDIT_FIELD[field];
  if (!rel) { await reply(ctx, t, "不支持的字段：" + field + "\n可用：" + Object.keys(EDIT_FIELD).join(" / "), { 标题: "设置失败", 按钮: [menuBtn()] }); return; }
  const x = byGid(ctx, id);
  if (!x) { await reply(ctx, t, "找不到编号 " + id + " 的玩家", { 标题: "设置失败", 按钮: [menuBtn()] }); return; }
  const v = Number(val);
  if (!Number.isFinite(v)) { await reply(ctx, t, "数值必须是数字", { 标题: "设置失败", 按钮: [menuBtn()] }); return; }
  const before = dn(ctx, rel, x, 0);
  // 2.5.13：支持大数值（不再截断到 32 位）
  // 2.9.2（需求 5）：按字段区间夹紧（等级 ≥1、暴击率 ≤80、闪避率 ≤40 …），不再只是 Math.max(0)
  const 目标 = 夹紧字段(field, v);
  if (目标 === null) { await reply(ctx, t, "数值超出 " + field + " 的合法区间", { 标题: "设置失败", 按钮: [menuBtn()] }); return; }
  dset(ctx, rel, x, 目标);
  recPwr(ctx, x);
  const 夹注 = 目标 !== v ? "（已按区间 " + 字段定义[field].区间.join("~") + " 夹紧）" : "";
  pushLog(ctx, who, "设置 " + id + " 的" + field + "：" + before + " → " + 目标);
  await reply(ctx, t, ["已将编号 " + id + " 的" + field + "设为 **" + 目标 + "**" + 夹注 + "（原 " + before + "）", "", pText(ctx, x)].join("\n"), {
    标题: "✅ 设置成功", 按钮: [menuBtn()]
  });
}


export async function viewPlayer(ctx, t, key) {
  const k = S(key);
  const x = byGid(ctx, k) || (hasAcc(ctx, k) ? k : "");
  if (!x) { await reply(ctx, t, "找不到编号 / openid 为 " + k + " 的玩家", { 标题: "查看玩家", 按钮: [menuBtn()] }); return; }
  const p = attrs(ctx, x);
  await reply(ctx, t, pText(ctx, x), {
    标题: "玩家资料",
    行组: [row(btn("av1", "改星羽", "设置星羽#" + p.编号 + "#"), btn("av2", "改经验", "设置经验#" + p.编号 + "#"), btn("av3", "改攻击力", "设置攻击#" + p.编号 + "#"), menuBtn())]
  });
}


export async function resetPlayer(ctx, t, who, id) {
  const x = byGid(ctx, id);
  if (!x) { await reply(ctx, t, "找不到编号 " + id + " 的玩家", { 标题: "重置失败", 按钮: [menuBtn()] }); return; }
  // 2.9.2（需求 5）：按「路径」去重 —— 字段表里有别名（攻击 / 攻击力）共用同一存档，
  //   逐个字段重置会让后一个别名用默认值 0 覆盖掉前一个的默认值（攻击会变 0）
  const 已重置 = new Set();
  for (const f of 字段表) {
    if (已重置.has(f.路径)) continue;
    已重置.add(f.路径);
    dset(ctx, f.路径, x, f.默认);
  }
  recPwr(ctx, x);
  pushLog(ctx, who, "重置玩家 " + id);
  await reply(ctx, t, "已重置编号 " + id + " 的养成数值。", { 标题: "重置完成", 按钮: [menuBtn()] });
}


// 2.5.13：发放道具 —— 支持货币（星羽/金币/存款/星核/贡献/经验）与 15 位大数字、负数扣除
export const 发放货币表 = {
  星羽: () => P.星羽, 金币: () => P.金币, 存款: () => P.存款,
  星核: () => P.星核, 贡献: () => P.贡献, 经验: () => P.经验
};


export async function giveTo(ctx, t, who, id, name, cnt) {
  const x = byGid(ctx, id);
  if (!x) { await reply(ctx, t, "找不到编号 " + id + " 的玩家", { 标题: "发放失败", 按钮: [menuBtn()] }); return; }
  const 名 = S(name);
  const k = Math.trunc(Number(cnt));
  if (!Number.isFinite(k) || k === 0) { await reply(ctx, t, "数量必须是数字（正数发放 / 负数扣除），示例：`发放道具#32#星羽#999999`", { 标题: "发放失败", 按钮: [menuBtn()] }); return; }
  const 货币路径 = 发放货币表[名];
  if (货币路径) {
    const rel = 货币路径();
    const 前 = dn(ctx, rel, x, 0);
    const 后 = Math.max(0, 前 + k);
    dset(ctx, rel, x, Math.round(后));
    recPwr(ctx, x);
    pushLog(ctx, who, (k > 0 ? "发放" : "扣除") + " " + id + " " + 名 + " " + Math.abs(k));
    await reply(ctx, t, [
      "已" + (k > 0 ? "发放" : "扣除") + "【" + 名 + "】" + kfmt(Math.abs(k)) + " 给编号 " + id,
      "变动：" + kfmt(前) + " → **" + kfmt(后) + "**"
    ].join("\n"), { 标题: "✅ " + (k > 0 ? "发放成功" : "扣除成功"), 按钮: [menuBtn()] });
    return;
  }
  if (allItems().indexOf(名) < 0 && !装备定义(名)) {
    await reply(ctx, t, [
      "不认识的道具：" + 名,
      "",
      "可用货币：星羽 / 金币 / 存款 / 星核 / 贡献 / 经验",
      "可用道具：" + allItems().join(" / ")
    ].join("\n"), { 标题: "发放失败", 按钮: [menuBtn()] });
    return;
  }
  const 量 = Math.abs(k);
  // 2.5.13：装备走星甲背包（修复「背包里看不到 / 装备不上」），材料道具走道具系统
  const 现 = 装备定义(名)
    ? giveEquip(ctx, x, 名, k > 0 ? 量 : -量)
    : giveItem(ctx, x, 名, k > 0 ? 量 : -量);
  pushLog(ctx, who, (k > 0 ? "发放" : "扣除") + " " + id + " 【" + 名 + "】×" + 量);
  await reply(ctx, t, "已" + (k > 0 ? "发放" : "扣除") + "【" + 名 + "】×" + 量 + " 给编号 " + id + "（现持有 " + 现 + "）", { 标题: k > 0 ? "发放成功" : "扣除成功", 按钮: [menuBtn()] });
}


export async function banOne(ctx, t, who, id, on) {
  const x = byGid(ctx, id);
  if (!x) { await reply(ctx, t, "找不到编号 " + id + " 的玩家", { 标题: "操作失败", 按钮: [menuBtn()] }); return; }
  dset(ctx, P.封禁名单, x, on ? "封禁" : "正常");
  pushLog(ctx, who, (on ? "封禁" : "解封") + "玩家 " + id);
  await reply(ctx, t, "已" + (on ? "封禁" : "解封") + "编号 " + id, { 标题: "操作成功", 按钮: [menuBtn()] });
}


export async function banListPanel(ctx, t) {
  const all = dall(ctx, P.封禁名单);
  const hit = Object.keys(all).filter((x) => String(all[x]) === "封禁");
  await reply(ctx, t, hit.length ? hit.map((x, i) => (i + 1) + ". openid `" + x + "`").join("\n") : "当前没有封禁玩家。", { 标题: "🚫 封禁名单", 按钮: [menuBtn()] });
}


export async function ownersPanel(ctx, t) {
  const list = ownerList(ctx);
  await reply(ctx, t, [
    "最高权限者：`" + 最高权限者 + "`",
    "其他主人：" + list.length + " 位",
    "",
    list.length ? list.map((x, i) => (i + 1) + ". `" + x + "`").join("\n") : "（暂无）",
    "",
    "`加主人#openid` · `删主人#openid`"
  ].join("\n"), { 标题: "👑 主人列表", 按钮: [menuBtn()] });
}


export async function statsPanel(ctx, t) {
  const list = players(ctx);
  const bag = [];
  for (const it of allItems()) {
    let sum = 0;
    for (const x of list) sum += hasItem(ctx, x, it);
    if (sum > 0) bag.push(it + "：" + sum);
  }
  let coin = 0, dep = 0, core = 0, ban = 0;
  for (const x of list) {
    coin += dn(ctx, P.星羽, x, 0);
    dep += dn(ctx, P.存款, x, 0);
    core += dn(ctx, P.星核, x, 0);
    if (isBanned(ctx, x)) ban += 1;
  }
  await reply(ctx, t, [
    "开号玩家：**" + list.length + "** 位 · 封禁 " + ban + " 位",
    "全服星羽：" + kfmt(coin) + " · 存款：" + kfmt(dep) + " · 星核：" + kfmt(core),
    "",
    "**道具总量**",
    bag.length ? bag.join(" · ") : "（暂无）"
  ].join("\n"), { 标题: "📊 插件统计", 按钮: [menuBtn()] });
}


// 2.5.27：管理日志面板 —— **每页 20 条 + 可翻页**（不再只显示 20 条），且只保留 2 天
export const 日志每页 = 20;


export async function logPanel(ctx, t, 页码) {
  const { 全部, 有效 } = 读管理日志(ctx);
  // 顺手把超过 2 天的记录真正删掉（不依赖下一次写入）
  if (有效.length !== 全部.length) dset(ctx, P.操作日志, "日志", 有效.slice(0, 2000));
  if (!有效.length) { await reply(ctx, t, "暂无管理操作记录（日志只保留 2 天）。", { 标题: "管理日志", 按钮: [menuBtn()] }); return; }
  const 总页 = Math.max(1, Math.ceil(有效.length / 日志每页));
  let 页 = Math.floor(Number(页码) || 1);
  if (!Number.isFinite(页) || 页 < 1) 页 = 1;
  if (页 > 总页) 页 = 总页;
  const 起 = (页 - 1) * 日志每页;
  const 段 = 有效.slice(起, 起 + 日志每页);
  const 行 = [
    "共 **" + 有效.length + "** 条（只保留 2 天，超期自动删除）",
    "第 " + 页 + "/" + 总页 + " 页 · 每页 " + 日志每页 + " 条 · 显示第 " + (起 + 1) + "~" + (起 + 段.length) + " 条",
    ""
  ].concat(段.map((x, i) => (起 + i + 1) + ". [" + S(x.时间) + "] " + S(x.内容) + (S(x.操作者) ? "（" + S(x.操作者) + "）" : "")));
  const 行组 = [];
  const 翻 = [];
  if (页 > 1) 翻.push(btn("lg1", "⏪ 首页", "管理日志#1"), btn("lg2", "◀ 上一页", "管理日志#" + (页 - 1)));
  if (页 < 总页) 翻.push(btn("lg3", "下一页 ▶", "管理日志#" + (页 + 1)), btn("lg4", "末页 ⏩", "管理日志#" + 总页));
  if (翻.length) 行组.push(row.apply(null, 翻));
  行组.push(row(btn("lg5", "刷新本页", "管理日志#" + 页), btn("lg6", "运行状态", "运行状态"), menuBtn()));
  await reply(ctx, t, 行.join("\n"), { 标题: "📜 管理日志（第 " + 页 + "/" + 总页 + " 页）", 行组: 行组 });
}


/* ---------- 2.5.27：星甲运行状态（主人）---------- */
export const 加载时间 = Date.now();


export function 时长(ms) {
  const s = Math.max(0, Math.floor(Number(ms) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (d ? d + " 天 " : "") + (h || d ? h + " 小时 " : "") + (m || h || d ? m + " 分 " : "") + ss + " 秒";
}


export function 目录大小(dir, 上限文件数) {
  let 字节 = 0, 文件数 = 0;
  const walk = (d) => {
    if (文件数 >= (上限文件数 || 3000)) return;
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (文件数 >= (上限文件数 || 3000)) return;
      const p = path.join(d, e.name);
      try {
        if (e.isDirectory()) walk(p);
        else { 字节 += fs.statSync(p).size; 文件数 += 1; }
      } catch (err) { /* 忽略单个文件错误 */ }
    }
  };
  walk(dir);
  return { 字节, 文件数 };
}


export function 网络地址() {
  try {
    const 表 = os.networkInterfaces();
    for (const k of Object.keys(表)) for (const a of 表[k] || []) if (!a.internal && a.family === "IPv4") return k + " " + a.address;
  } catch (e) { /* ignore */ }
  return "未知";
}


export async function 运行状态面板(ctx, t) {
  const 全服 = players(ctx);
  // 进程 CPU：以「单核基准」采样 150ms，算这段时间进程占用的 CPU 比例
  const t0 = Date.now(), c0 = process.cpuUsage();
  await new Promise((r) => setTimeout(r, 150));
  const c1 = process.cpuUsage(c0);
  const 墙钟 = Math.max(1, (Date.now() - t0) * 1000);
  const 进程CPU = ((c1.user + c1.system) / 墙钟) * 100;
  const 核数 = os.cpus().length || 1;
  const m = process.memoryUsage();
  const MB = (b) => (b / 1024 / 1024).toFixed(1) + " MB";
  const 总内存 = os.totalmem(), 空闲 = os.freemem();
  const 数据 = (() => { try { return 目录大小(ctx.dataPath || ""); } catch (e) { return { 字节: 0, 文件数: 0 }; } })();
  const 日志 = (() => { try { return 目录大小(日志目录(ctx)); } catch (e) { return { 字节: 0, 文件数: 0 }; } })();
  let 战斗数 = 0;
  try {
    const all = dall(ctx, P.战斗);
    for (const k of Object.keys(all)) { const v = all[k]; if (v && typeof v === "object" && !v.结果) 战斗数 += 1; }
  } catch (e) { /* ignore */ }
  let 封禁数 = 0;
  try { const b = dall(ctx, P.封禁名单); 封禁数 = Object.keys(b).filter((x) => String(b[x]) === "封禁").length; } catch (e) { /* ignore */ }
  const { 有效 } = 读管理日志(ctx);
  await reply(ctx, t, [
    "## 🛰️ 星甲运行状态",
    "版本 **" + 版本 + "** · 插件已加载 " + 时长(Date.now() - 加载时间),
    "",
    "**🖥️ 进程（Node）**",
    "- CPU 使用率：" + 进程CPU.toFixed(2) + "%（单核基准 · 整机 " + (进程CPU / 核数).toFixed(2) + "% · " + 核数 + " 核）",
    "- 负载：" + os.loadavg().map((x) => x.toFixed(2)).join(" / ") + "（1/5/15 分钟）",
    "- 内存（RSS）：" + MB(m.rss) + " · 堆：" + MB(m.heapUsed) + "/" + MB(m.heapTotal) + " · 外部：" + MB(m.external),
    "- 系统内存：" + MB(总内存 - 空闲) + " / " + MB(总内存) + "（可用 " + MB(空闲) + "，占用 " + ((1 - 空闲 / 总内存) * 100).toFixed(1) + "%）",
    "- 进程运行：" + 时长(process.uptime() * 1000) + " · Node " + process.version + " · " + os.platform() + "/" + os.arch(),
    "- 主机：" + os.hostname() + " · 网卡：" + 网络地址(),
    "",
    "**👥 全服玩家**",
    "- 开号玩家：**" + 全服.length + "** 位 · 封禁 " + 封禁数 + " 位 · 进行中战斗 " + 战斗数 + " 场",
    "- 未开号会话（按钮序号缓存）：" + seqMap.size + " 条",
    "",
    "**📦 数据 / 日志**",
    "- 数据目录：" + (ctx.dataPath || "未知") + " → " + 数据.文件数 + " 个文件 · " + MB(数据.字节),
    "- 日志目录：" + 日志.文件数 + " 个文件 · " + MB(日志.字节),
    "- 管理日志：可用 " + 有效.length + " 条（只保留 2 天）",
    "",
    "提示：`星甲重启` 可做插件软重启（清缓存 · 重新加载依赖）。"
  ].join("\n"), {
    标题: "🛰️ 运行状态",
    行组: [
      row(btn("st1", "刷新", "运行状态"), btn("st2", "插件统计", "插件统计"), btn("st3", "管理日志", "管理日志")),
      row(btn("st4", "软重启", "星甲重启"), menuBtn())
    ]
  });
}


/* ---------- 2.5.27：星甲重启 = 插件软重启 ----------
 * 说明：插件没有「重启整个控制台进程」的权限（框架不暴露进程管理接口，也不允许插件 exec 宿主），
 *   所以这里只做**软重启**：清空内存缓存（按钮序号表 / 道具表缓存 / sharp 惰性模块）并重新初始化数据。
 */
export async function 软重启(ctx, t, who) {
  const 清 = [];
  try { seqMap.clear(); 清.push("按钮序号缓存（" + seqMap.size + " 条）"); } catch (e) { /* ignore */ }
  try { 清道具集缓存(); 清.push("道具表缓存"); } catch (e) { /* ignore */ }
  try { 清Sharp缓存(); 清.push("sharp 惰性模块"); } catch (e) { /* ignore */ }
  pushLog(ctx, who, "插件软重启（清理：" + 清.join(" / ") + "）");
  await reply(ctx, t, [
    "## ♻️ 星甲软重启完成",
    "",
    "已清理：" + (清.join(" · ") || "（无）"),
    "数据文件未改动（玩家数据 / 战斗记录 / 日志都安全保留）。",
    "",
    "**关于「重启整个控制台」**：插件没有进程管理权限，无法重启控制台本身。",
    "如需真正重启控制台，请在咔咔珂控制台里点「重启」，或由管理员操作。",
    "",
    "可以先用 `星甲运行状态` 看看现在的 CPU / 内存情况。"
  ].join("\n"), {
    标题: "♻️ 软重启",
    行组: [row(btn("rs1", "运行状态", "运行状态"), btn("rs2", "插件统计", "插件统计"), menuBtn())]
  });
}


export async function announce(ctx, t, who, text) {
  const s = S(text);
  if (!s) { await reply(ctx, t, "用法：`全服公告#内容`", { 标题: "全服公告", 按钮: [menuBtn()] }); return; }
  const v = dget(ctx, P.操作日志, "公告", []);
  const list = Array.isArray(v) ? v : [];
  list.unshift({ 时间: fmt(), 内容: s });
  dset(ctx, P.操作日志, "公告", list.slice(0, 100));
  pushLog(ctx, who, "发布公告：" + s);
  await reply(ctx, t, "公告已记录：\n> " + s, { 标题: "📢 全服公告", 按钮: [menuBtn()] });
}


export async function resetTasks(ctx, t, who, id) {
  const d = ymd();
  if (!S(id)) {
    // 修正：以前只写了 "__" 这个占位键，等于什么都没清；现在真的把每个玩家今天的进度清空。
    const 进度 = dall(ctx, P.每日进度(d));
    const 领奖 = dall(ctx, P.每日领奖(d));
    let n = 0;
    for (const key of Object.keys(进度)) { if (key.indexOf("__") === 0) continue; dset(ctx, P.每日进度(d), key, {}); n += 1; }
    for (const key of Object.keys(领奖)) { if (key.indexOf("__") === 0) continue; dset(ctx, P.每日领奖(d), key, {}); n += 1; }
    pushLog(ctx, who, "清空全服每日任务（" + n + " 条记录）");
    await reply(ctx, t, "已清空全服今日任务进度（共 " + n + " 条记录）。", { 标题: "重置完成", 按钮: [menuBtn()] });
    return;
  }
  const x = byGid(ctx, id);
  if (!x) { await reply(ctx, t, "找不到编号 " + id, { 标题: "重置失败", 按钮: [menuBtn()] }); return; }
  dset(ctx, P.每日进度(d), x, {});
  dset(ctx, P.每日领奖(d), x, {});
  pushLog(ctx, who, "重置 " + id + " 的每日任务");
  await reply(ctx, t, "已重置编号 " + id + " 的今日任务进度。", { 标题: "重置完成", 按钮: [menuBtn()] });
}


export async function groupPanel(ctx, t) {
  const g = t.scope === "group" ? t.group_openid : "";
  const wel = g ? S(dget(ctx, P.入群欢迎, g, "开启")) !== "关闭" : false;
  const last = g ? ds(ctx, P.最近消息, g, "") : "";
  await reply(ctx, t, [
    "**✅ 可用功能**",
    "- `撤回上一条` · `撤回#消息ID`",
    "- `入群欢迎`（开关进退群提示） · `本群信息`",
    "",
    "**⚠️ 平台限制**",
    "QQ 开放平台机器人没有开放 禁言 / 全体禁言 / 踢人 / 改群名片 接口，",
    "这些只能由群主 / 管理员在群内手动完成，插件无法代替。",
    "",
    "**📋 当前状态**",
    "入群欢迎：" + (g ? (wel ? "已开启" : "已关闭") : "（仅群聊可用）"),
    "触发方式：艾特机器人（@ 别人的消息不会响应）",
    "最近消息ID：" + (last || "（无记录）")
  ].join("\n"), {
    标题: "🛡️ 群管面板",
    行组: [
      row(actBtn("gm1", "⚡撤回上一条", "recall"), btn("gm2", "开关入群欢迎", "入群欢迎"), btn("gm3", "本群信息", "本群信息")),
      row(btn("gm4", "撤回格式", "撤回#消息ID"), btn("gm5", "菜单", "菜单", 0))
    ]
  });
}


export async function groupInfo(ctx, t, event) {
  if (t.scope !== "group") { await reply(ctx, t, "本群信息仅群聊可用。", { 标题: "本群信息" }); return; }
  const g = t.group_openid;
  const wel = S(dget(ctx, P.入群欢迎, g, "开启")) !== "关闭";
  await reply(ctx, t, [
    "群 openid：`" + g + "`",
    "入群欢迎：" + (wel ? "已开启" : "已关闭"),
    "最近消息ID：" + (ds(ctx, P.最近消息, g, "") || "（无记录）"),
    "我的身份：" + (isGm(event) ? "群主 / 管理员" : "普通成员"),
    "",
    "提示：机器人的群管理能力受官方接口限制。"
  ].join("\n"), {
    标题: "本群信息", 行组: [row(actBtn("gn1", "⚡撤回上一条", "recall"), btn("gn2", "群管面板", "群管"))]
  });
}


export async function welcomeToggle(ctx, t, event) {
  if (t.scope !== "group") { await reply(ctx, t, "仅群聊可用。", { 标题: "入群欢迎" }); return; }
  if (!isGm(event)) { await reply(ctx, t, "只有群主或管理员可以修改本群设置。", { 标题: "权限不足" }); return; }
  const g = t.group_openid;
  const cur = S(dget(ctx, P.入群欢迎, g, "开启")) !== "关闭";
  dset(ctx, P.入群欢迎, g, cur ? "关闭" : "开启");
  await reply(ctx, t, "入群欢迎已" + (cur ? "关闭" : "开启") + "。", {
    标题: "🛡️ 入群欢迎", 按钮: [btn("go1", "再切一次", "入群欢迎"), btn("go2", "群管面板", "群管")]
  });
}


export async function recallOne(ctx, t, id) {
  const mid = S(id) || (t.scope === "group" ? ds(ctx, P.最近消息, t.group_openid, "") : "");
  if (!mid) { await reply(ctx, t, "没有可撤回的消息ID。\n用法：`撤回#消息ID`", { 标题: "撤回失败", 按钮: [btn("gr1", "群管面板", "群管")] }); return; }
  const tt = t.scope === "group" ? { scope: "group", group_openid: t.group_openid } : { scope: "c2c", user_openid: t.user_openid };
  try {
    await delMsg(ctx, tt, mid);
    await reply(ctx, t, "已撤回消息 " + mid, { 标题: "撤回成功" });
  } catch (e) {
    await reply(ctx, t, [
      "撤回失败：" + (e && e.message ? e.message : String(e)),
      "",
      "可能原因：",
      "- 不是机器人自己发的消息（撤回他人消息需机器人具备群管理权限）",
      "- 超过 2 分钟撤回时限",
      "- 消息ID 不正确"
    ].join("\n"), { 标题: "撤回失败", 按钮: [btn("gs1", "群管面板", "群管")] });
  }
}



/* ============================================================
 * 2.2.1 控制台扩展（对照 GF-plugin-xinjia 的控制台功能搬过来）
 *   概览 / 排行 / 会话消息 / 消息日志 / 配置 / Sharp 依赖 / 属性修改记录
 * ============================================================ */
export function 项目根(ctx) {
  const cands = [];
  try { if (自身目录) cands.push(path.resolve(自身目录, "..", "..")); } catch (e) { /* ignore */ }
  try { const d = S(ctx && ctx.dataPath); if (d) cands.push(path.resolve(d, "..", "..", "..")); } catch (e) { /* ignore */ }
  for (const c of cands) { try { if (c && fs.existsSync(path.join(c, "log", "gf"))) return c; } catch (e) { /* ignore */ } }
  return cands[0] || "";
}


export function 日志目录(ctx) { const r = 项目根(ctx); return r ? path.join(r, "log", "gf") : ""; }


export function 日志日期表(ctx) {
  const dir = 日志目录(ctx);
  const out = [];
  for (const sc of ["group", "private"]) {
    try {
      const d = path.join(dir, sc);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (!/\.jsonl$/.test(f)) continue;
        const dt = f.replace(/\.jsonl$/, "");
        if (out.indexOf(dt) < 0) out.push(dt);
      }
    } catch (e) { /* ignore */ }
  }
  return out.sort();
}


// 读当天 GF 消息日志（超大文件只读尾部 24MB，避免拖垮主进程）
export function 读日志行(ctx, date, scope, maxLines) {
  const dir = 日志目录(ctx);
  if (!dir) return [];
  const 文件 = path.join(dir, scope, S(date) + ".jsonl");
  try {
    if (!fs.existsSync(文件)) return [];
    const st = fs.statSync(文件);
    const 上限 = 24 * 1024 * 1024;
    let text;
    if (st.size > 上限) {
      const fd = fs.openSync(文件, "r");
      const buf = Buffer.alloc(上限);
      fs.readSync(fd, buf, 0, 上限, st.size - 上限);
      fs.closeSync(fd);
      text = buf.toString("utf8");
      text = text.slice(Math.max(0, text.indexOf("\n") + 1));
    } else text = fs.readFileSync(文件, "utf8");
    const 行 = text.split("\n").filter((x) => x.trim());
    const 限 = Math.max(1, Math.min(Number(maxLines) || 300, 5000));
    return 行.slice(-限).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}


export function 会话键(rec) { return (S(rec.scope) || "group") + ":" + (S(rec.groupId) || S(rec.userId) || ""); }


export function 会话聚合(ctx, date, limit) {
  const 表 = {};
  for (const sc of ["group", "private"]) {
    for (const rec of 读日志行(ctx, date, sc, 3000)) {
      const 键 = 会话键(rec);
      if (!键 || 键.slice(-1) === ":") continue;
      const it = 表[键] || (表[键] = { 键: 键, scope: S(rec.scope) || sc, id: S(rec.groupId) || S(rec.userId), 名称: "", 条数: 0, 最后: 0, 最后内容: "" });
      it.条数 += 1;
      const t = Number(rec.time) || Date.parse(rec.ts) || 0;
      if (t >= it.最后) { it.最后 = t; it.最后内容 = S(rec.content).replace(/\s+/g, " ").slice(0, 40); if (S(rec.userName)) it.名称 = S(rec.userName); }
    }
  }
  return Object.keys(表).map((k) => 表[k]).sort((a, b) => b.最后 - a.最后).slice(0, Math.max(1, Number(limit) || 50));
}


export function 读会话消息(ctx, date, scope, id, limit) {
  const out = [];
  for (const rec of 读日志行(ctx, date, scope, 5000)) {
    const 这条 = S(rec.groupId) || S(rec.userId);
    if (S(id) && 这条 !== S(id)) continue;
    out.push({
      时间: Number(rec.time) || Date.parse(rec.ts) || 0,
      方向: S(rec.eventType).indexOf("BOT") >= 0 ? "out" : "in",
      类型: S(rec.eventType),
      用户: S(rec.userName) || S(rec.userId),
      用户id: S(rec.userId),
      内容: S(rec.content),
      消息id: S(rec.msgId) || S(rec.messageId) || S(rec.id)
    });
  }
  out.sort((a, b) => a.时间 - b.时间);
  const 限 = Math.max(1, Math.min(Number(limit) || 100, 500));
  return out.slice(-限);
}


export async function 控制台发消息(ctx, 目标, 内容) {
  const t = Object.assign({}, 目标, { 无艾特: true });
  return sendMd(ctx, t, String(内容 || ""), null);
}


export function 控制台配置路径(ctx) { return path.join(S(ctx && ctx.dataPath), "config.json"); }


export function 读控制台配置(ctx) {
  const 默认 = {
    图片渲染: true, 渲染模式: "markdown", 调试: false, 备注: "",
    // 2.6.0：主人相关配置（控制台「插件配置」表单可改，无需改代码）
    最高权限者: 默认最高权限者,
    主人名单: "",
    全服倍率: 1,
    // 2.9.1（C2）：控制台登录密码（初始 12345678，首次登录后请尽快修改）与手动解锁 IP
    控制台密码: "12345678",
    控制台解锁IP: "",
    // 2.9.3：常驻公告 —— 每条消息「响应用时」下方追加的灰色公告，空字符串 = 关闭
    常驻公告: "",
    // 3.1.8：GitHub API 令牌 —— 填了就用认证请求（5000 次/小时），不填走匿名（60 次/小时）
    //   只需 public_repo / Read-only 权限；只用于「查版本」，不会写入任何东西
    GitHub令牌: ""
  };
  try {
    const f = 控制台配置路径(ctx);
    if (!fs.existsSync(f)) return 默认;
    const v = JSON.parse(fs.readFileSync(f, "utf8"));
    return v && typeof v === "object" ? Object.assign(默认, v) : 默认;
  } catch (e) { return 默认; }
}


export function 写控制台配置(ctx, o) {
  const 新 = Object.assign(读控制台配置(ctx), o || {});
  const f = 控制台配置路径(ctx);
  try { fs.writeFileSync(f, JSON.stringify(新, null, 2), "utf8"); } catch (e) { /* ignore */ }
  return 新;
}


// 2.6.0：主人配置 —— 控制台「插件配置」里填的 openid，运行时就生效（不必改代码）
//   · 最高权限者：覆盖出厂默认值
//   · 主人名单：逗号 / 换行 / 空格分隔，追加进主人名单（只增不减；要删用 `星甲删主人#openid` 或后台）
export function 解析主人串(v) {
  if (Array.isArray(v)) return v.map((x) => S(x)).filter(Boolean);
  return String(v === undefined || v === null ? "" : v).split(/[,，;；\s\u3000]+/).map((x) => S(x)).filter(Boolean);
}


export function 同步主人配置(ctx) {
  let c = {};
  try { c = 读控制台配置(ctx); } catch (e) { c = {}; }
  设最高权限者(S(c.最高权限者) || 默认最高权限者);
  const 追加 = 解析主人串(c.主人名单);
  if (追加.length) {
    const 现有 = ownerList(ctx);
    let 改 = false;
    for (const x of 追加) {
      if (x !== 最高权限者 && 现有.indexOf(x) < 0) { 现有.push(x); 改 = true; }
    }
    if (改) { try { dset(ctx, P.主人名单, "列表", 现有); } catch (e) { /* ignore */ } }
  }
  return { 最高权限者: 最高权限者, 主人: ownerList(ctx) };
}


export function sharp依赖目录(ctx) { return path.join(S(ctx && ctx.dataPath), "runtime-deps"); }


export function sharp状态(ctx) {
  const dir = sharp依赖目录(ctx);
  const 目标 = path.join(dir, "node_modules", "sharp");
  let 已装 = false, 版本 = "";
  try {
    已装 = fs.existsSync(目标);
    if (已装) {
      const pkg = JSON.parse(fs.readFileSync(path.join(目标, "package.json"), "utf8"));
      版本 = S(pkg && pkg.version);
    }
  } catch (e) { /* ignore */ }
  return { 目录: dir, 已安装: 已装, 版本: 版本 };
}


export function sharp安装(ctx) {
  const dir = sharp依赖目录(ctx);
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
  const 日志 = path.join(dir, "sharp-install.log");
  try {
    const 子进程 = child_process.spawn("npm", ["install", "sharp", "--no-audit", "--no-fund"], { cwd: dir, shell: true });
    const 写 = (d) => { try { fs.appendFileSync(日志, "[" + new Date().toISOString() + "] " + String(d) + "\n", "utf8"); } catch (e) { /* ignore */ } };
    写("开始安装 sharp");
    if (子进程.stdout) 子进程.stdout.on("data", (d) => 写(d.toString().trim()));
    if (子进程.stderr) 子进程.stderr.on("data", (d) => 写(d.toString().trim()));
    子进程.on("close", (code) => 写("安装结束，退出码 " + code));
    if (ctx.logger && ctx.logger.info) ctx.logger.info("[xjyl] 已在后台开始安装 sharp：" + dir);
    return { 已启动: true, 目录: dir, 日志: 日志 };
  } catch (e) {
    if (ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] sharp 安装触发失败:", e);
    return { 已启动: false, 错误: String(e && e.message ? e.message : e) };
  }
}


export function 排行(ctx, sort, limit) {
  const list = players(ctx).map((x) => ({
    id: x, 编号: gid(ctx, x), 昵称: ds(ctx, P.昵称, x, "无名"), 等级: dn(ctx, P.等级, x, 1),
    战力: pwrOf(ctx, x), 星羽: dn(ctx, P.星羽, x, 0), 星核: dn(ctx, P.星核, x, 0),
    存款: dn(ctx, P.存款, x, 0), 今日经验: 今日经验(ctx, x), 转生: dn(ctx, P.转生, x, 0)
  }));
  const 键 = ["战力", "等级", "星羽", "星核", "今日经验", "转生"].indexOf(sort) >= 0 ? sort : "战力";
  list.sort((a, b) => Number(b[键] || 0) - Number(a[键] || 0));
  return { 字段: 键, list: list.slice(0, Math.max(1, Math.min(Number(limit) || 50, 500))) };
}


export function 概览(ctx) {
  const list = players(ctx);
  const sum = { 玩家数: list.length, 星羽: 0, 存款: 0, 星核: 0, 贡献: 0, 封禁: 0, 今日经验: 0 };
  for (const x of list) {
    sum.星羽 += dn(ctx, P.星羽, x, 0);
    sum.存款 += dn(ctx, P.存款, x, 0);
    sum.星核 += dn(ctx, P.星核, x, 0);
    sum.贡献 += dn(ctx, P.贡献, x, 0);
    sum.今日经验 += 今日经验(ctx, x);
    if (isBanned(ctx, x)) sum.封禁 += 1;
  }
  sum.主人数 = ownerList(ctx).length;
  const today = ymd();
  const 小时 = new Array(24).fill(0);
  const 用户 = {};
  const 群 = {};
  for (const sc of ["group", "private"]) {
    for (const rec of 读日志行(ctx, today, sc, 5000)) {
      const t = Number(rec.time) || Date.parse(rec.ts) || 0;
      if (t) 小时[new Date(t).getHours()] += 1;
      if (S(rec.userId)) 用户[S(rec.userId)] = 1;
      if (S(rec.groupId)) 群[S(rec.groupId)] = 1;
    }
  }
  return {
    汇总: sum, 日期: today, 小时: 小时,
    今日消息: 小时.reduce((a, b) => a + b, 0),
    今日活跃: Object.keys(用户).length,
    今日群数: Object.keys(群).length,
    版本: 版本, 日志目录: 日志目录(ctx)
  };
}


export function 修改记录列表(ctx) {
  const 记录 = 修改记录(ctx);
  return Object.keys(记录).map((k) => ({
    id: k, 昵称: ds(ctx, P.昵称, k, "未知"), 字段: Object.keys(记录[k] || {}), 明细: 记录[k]
  }));
}
