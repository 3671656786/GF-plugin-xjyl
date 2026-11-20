// lib/game/econ.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S, dall, dget, dn, dset, fmt, kfmt, n, pushLog, wait, ymd } from "./../core/base.mjs?v=v1795172705997";
import { actBtn, btn, reply, row, 蓝字, 蓝链 } from "./../core/qq.mjs?v=v1795172705997";
import { P } from "./../core/util.mjs?v=v1795172705997";
import { CORE_SHOP } from "././alliance.mjs?v=v1795172705997";
import { mine } from "././casual.mjs?v=v1795172705997";
import { 加世界资金, 扣世界资金, 补货提示 } from "././credit.mjs?v=v1795172705997";
import { 商店找, 商店购买, 商店每页, 商店表 } from "././dungeon.mjs?v=v1795172705997";
import { GOODS } from "././farm.mjs?v=v1795172705997";
import { 搜索排序, 搜索分页, 页码窗口, 背包持有 } from "././equip.mjs?v=v1795172705997";
import { addCoin, addCore, allItems, attrs, byGid, gid, giveItem, hasItem, pwrOf, takeItem } from "././player.mjs?v=v1795172705997";
import { tInc } from "././progress.mjs?v=v1795172705997";

// 2.9.8（需求 3）：**取消** 2.9.4 加的「单次最多 999 个」硬上限 —— 买多少就是多少，不截断、不提示。
//   只保留防呆：数量取整（正数）、夹到安全整数区间，避免 1e30 这种输入把总价算成 Infinity / 出现小数。
//   调用方拿到的是**整数** k，总价 = 单价 × k 再 Math.round，保证落档金额永远是整数。
export const 单次购买安全上限 = Number.MAX_SAFE_INTEGER;


export function 购买数量(cnt) {
  const n = Number(cnt);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.floor(n)), 单次购买安全上限);
}


export async function buyItem(ctx, t, u, name, cnt) {
  const it = S(name);
  const g = GOODS.filter((x) => x.名 === it)[0];
  // 2.5.17：GOODS 里没有的商品（碧髓回春液/玄元凝血膏/九幽血髓酿/太虚还魂汤…）改走商店表，避免「商店不卖」
  if (!g) {
    if (typeof 商店找 === "function" && 商店找(it)) { await 商店购买(ctx, t, u, it, cnt); return; }
    await reply(ctx, t, "商店不卖【" + it + "】。\n可买：" + GOODS.map((x) => x.名).join(" / "), { 标题: "购买失败" }); return;
  }
  const k = 购买数量(cnt);
  const total = Math.round(g.价 * k);
  const p = attrs(ctx, u);
  if (p.星羽 < total) {
    await reply(ctx, t, "星羽不足：需要 " + kfmt(total) + "，你有 " + kfmt(p.星羽) + "。", {
      标题: "购买失败", 按钮: [actBtn("pu1", "⚡挖矿", "mine"), btn("pu2", "副本", "副本"), btn("pu3", "银行", "银行系统")]
    });
    return;
  }
  addCoin(ctx, u, -total);
  // 3.1.15：系统商店买东西 = 系统收入 → 进世界金（与 商店购买 同一口径，补齐 GOODS 这条路径）
  try { 加世界资金(ctx, total, "系统商店购买 " + it + "×" + k); } catch (e) { /* ignore */ }
  giveItem(ctx, u, it, k);
  await reply(ctx, t, "购买【" + it + "】×" + k + "\n花费 " + kfmt(total) + " 星羽\n持有：" + hasItem(ctx, u, it), {
    标题: "🛒 购买成功",
    行组: [row(btn("pv1", "再买1个", "购买#" + it + "#1"), btn("pv2", "商店", "商店"), btn("pv3", "使用道具", "使用道具"))]
  });
}


/* ============================================================
 * 3.0.0（需求 22/24）：商店关键词搜索 —— `星甲商店 <关键词>` / `星甲商店搜索 <关键词>`
 * ------------------------------------------------------------
 * · 匹配：商品名大小写不敏感包含匹配（`种子` 命中「星芽种子」「小麦种子」）
 * · 排序：完全匹配 > 名称开头 > 名称包含（同级保持商店原顺序，编号不跳）
 * · 分页：每页 5 条，页脚「关键词命中 N 件 · 第 x/y 页」
 * · 编号：**全局连续编号**（= 商店表下标 + 1，与 `星甲商店` 面板左侧编号同一口径），
 *   所以 `星甲购买<编号> <数量>` 在面板和搜索结果里指的是同一件商品。
 * · 主商店面板仍由 lib/game/dungeon.mjs 的 商店面板() 渲染（本次不改该文件），
 *   这里只新增「搜索入口」，两者共用同一份 商店表 与编号。
 */
export const 商店搜索每页 = 5;


// 商店商品的「当前持有」：装备看背包、其余看道具计数（与 商店购买() 的回执口径一致）
export function 商店持有(ctx, u, 名) {
  try {
    const it = 商店表.filter((x) => x.名 === 名)[0];
    if (it && it.类 === "装备") return 背包持有(ctx, u, 名);
    return hasItem(ctx, u, 名);
  } catch (e) { return 0; }
}


export async function 商店搜索(ctx, t, u, 词, 页参) {
  // 只发了 `星甲商店搜索` / `星甲物品搜索` 时，路由会先把「搜索」当成关键词传进来 —— 这里还原成「没带关键词」
  const 原词 = S(词);
  const 键 = /^(?:搜索|查找|查询|找)$/.test(原词) ? "" : 原词;
  const p = attrs(ctx, u);
  // 没带关键词（比如只发了 `星甲商店搜索`）→ 给用法 + 常用关键词，不要回「没有名字带「」的商品」
  if (!键) {
    await reply(ctx, t, [
      "用法：`星甲商店 <关键词>` / `星甲商店搜索 <关键词>`（多页时加 `#页码`，如 `星甲商店搜索#种子#2`）",
      "",
      "常用关键词：" + 蓝链([["商店搜索#种子", "种子"], ["商店搜索#药", "药"], ["商店搜索#卡", "卡"], ["商店搜索#芯片", "芯片"], ["商店搜索#宝箱", "宝箱"]]),
      "",
      "全部商品：发 `星甲商店`（按编号翻页）；按编号直接买：`星甲购买<编号> <数量>`"
    ].join("\n"), {
      标题: "🛒 商店搜索",
      行组: [row(btn("ss0", "全部商品", "商店"), btn("ss1", "星核商店", "星核商店"), btn("ss2", "背包", "背包"), btn("ss3", "星甲菜单", "星甲菜单"))]
    });
    return;
  }
  const 命中 = 搜索排序(商店表, 键);
  if (!命中.length) {
    await reply(ctx, t, [
      "商店里没有名字带「" + 键 + "」的商品。",
      "",
      "可以试试：" + 蓝链([["商店搜索#种子", "种子"], ["商店搜索#药", "药"], ["商店搜索#卡", "卡"], ["商店搜索#芯片", "芯片"], ["商店搜索#鱼饵", "鱼饵"]]),
      "",
      "也可以发 `星甲商店` 按编号翻页看全部商品。"
    ].join("\n"), {
      标题: "🛒 商店搜索",
      行组: [row(btn("ss0", "全部商品", "商店"), btn("ss1", "星核商店", "星核商店"), btn("ss2", "背包", "背包"), btn("ss3", "星甲菜单", "星甲菜单"))]
    });
    return;
  }
  const 分页 = 搜索分页(命中, 商店搜索每页, 页参);
  const 首号 = 商店表.indexOf(分页.本页[0]) + 1;
  const 行 = [
    "用户:" + gid(ctx, u) + "　星羽:" + kfmt(p.星羽) + "　星核:" + p.星核,
    "",
    "**搜索「" + 键 + "」** —— 点蓝色编号买 1 个；买多个发 `星甲购买<编号> <数量>`（如 `星甲购买" + 首号 + " 5`）",
    ""
  ];
  for (const x of 分页.本页) {
    const 号 = 商店表.indexOf(x) + 1;
    行.push("■ " + 蓝字("购买#" + 号 + "#1", 号 + ".") + " **" + x.名 + "**　" + kfmt(x.价) + " " + x.币 + "　持有 " + kfmt(商店持有(ctx, u, x.名)));
    行.push("　" + (x.说明 || ""));
    行.push("　" + 蓝字("购买#" + 号 + "#1", "买1个") + "　" + 蓝字("购买#" + 号 + "#5", "买5个") + "　" + 蓝字("购买#" + 号 + "#10", "买10个"));
  }
  行.push("");
  行.push("关键词命中 " + 命中.length + " 件 · 第 " + 分页.页 + "/" + 分页.总页 + " 页");
  const 页键 = "商店搜索#" + 键 + "#";
  const 页链 = 蓝链(页码窗口(分页.页, 分页.总页).map((n) => [页键 + n, n === 分页.页 ? "[" + n + "]" : String(n)]));
  行.push("翻页：" + (分页.页 > 1 ? 蓝字(页键 + (分页.页 - 1), "上一页") + "  " : "") + 页链 + (分页.页 < 分页.总页 ? "  " + 蓝字(页键 + (分页.页 + 1), "下一页") : ""));
  行.push("换个词：发 `星甲商店 <关键词>`（也可以 `星甲商店搜索 <关键词>`）");
  const 行组 = [];
  if (分页.页 > 1 || 分页.页 < 分页.总页) {
    const 纽 = [];
    if (分页.页 > 1) 纽.push(btn("ssp", "⬅ 上一页", 页键 + (分页.页 - 1)));
    if (分页.页 < 分页.总页) 纽.push(btn("ssn", "下一页 ➡", 页键 + (分页.页 + 1)));
    行组.push(row.apply(null, 纽));
  }
  行组.push(row(btn("ssa", "全部商品", "商店"), btn("ssb", "星核商店", "星核商店"), btn("ssc", "背包", "背包"), btn("ssd", "星甲菜单", "星甲菜单")));
  await reply(ctx, t, 行.join("\n"), { 标题: "🛒 商店搜索 " + 分页.页 + "/" + 分页.总页, 行组: 行组 });
}


export async function exchangeItem(ctx, t, u, name, cnt) {
  const it = S(name);
  const g = CORE_SHOP.filter((x) => x.名 === it)[0];
  if (!g) { await reply(ctx, t, "星核兑换暂不支持【" + it + "】。\n可换：" + CORE_SHOP.map((x) => x.名).join(" / "), { 标题: "兑换失败" }); return; }
  const k = 购买数量(cnt);
  const need = Math.round(g.核 * k);
  const p = attrs(ctx, u);
  if (p.星核 < need) {
    await reply(ctx, t, "星核不足：需要 " + need + "，你有 " + p.星核 + "。\n星核主要来自副本与陨石碎片。", {
      标题: "兑换失败", 按钮: [btn("ex1", "副本", "副本"), btn("ex2", "使用陨石碎片", "使用陨石碎片1")]
    });
    return;
  }
  addCore(ctx, u, -need);
  giveItem(ctx, u, it, k);
  await reply(ctx, t, "用 " + need + " 星核兑换【" + it + "】×" + k, {
    标题: "💎 兑换成功", 按钮: [btn("ew1", "继续兑换", "兑换#强化组件#1"), btn("ew2", "商店", "商店")]
  });
}


export function hallList(ctx) { const v = dget(ctx, P.交易行, "列表", []); return Array.isArray(v) ? v : []; }


export function hallSave(ctx, list) { dset(ctx, P.交易行, "列表", list.slice(0, 200)); }


// 2.9.13（U1/U2/U3）交易行税率
export const 交易行上架税率 = 0.02;

   // 上架税 = 挂牌总价 × 2%（取整），卖家出，进世界资金；下架（未售出）全额退回，售出不退
export const 交易行购买税率 = 0.05;

   // 购买税 = 成交价 × 5%（取整），买家出（买家付 成交价+税），卖家拿全额；旧「卖家扣 5%」口径作废
// 2.9.13（U1/F1）交易行面板重写：
//   · 每件在售商品 = 蓝色可点链接（点一下填好 `星甲购买上架#货号#1`，发出去直接进购买），
//     保留文本指令 `星甲购买上架#编号#数量` 兼容；
//   · 「我的上架」只出现一次（旧版在没有自己商品时 下钮 与 tr3 重复出现两次）；
//   · 商品多时每页 10 条翻页（`交易行#页码`）。
export const 交易行每页条数 = 10;


export async function hallPanel(ctx, t, u, 页参) {
  const list = hallList(ctx);
  const mine = list.filter((x) => x.卖家 === u);
  const 总页 = Math.max(1, Math.ceil(list.length / 交易行每页条数));
  let 页 = Math.max(1, Math.floor(Number(页参) || 1));
  if (页 > 总页) 页 = 总页;
  const 本页 = list.slice((页 - 1) * 交易行每页条数, 页 * 交易行每页条数);
  const lines = [
    "在售 " + list.length + " 件 · 我的 " + mine.length + " 件",
    "税则：上架税 2%（下架退回）· 购买税 5%（买家承担）",
    "",
    "**货架**（点蓝色货号直接买 1 件；买多件发 `星甲购买上架#货号#数量`）"
  ];
  if (!list.length) lines.push("（空空的，发 `上架#道具#数量#单价` 摆货）");
  for (const x of 本页) {
    // U1：整条商品渲染成蓝色链接 —— 点击即把购买指令填进聊天栏
    lines.push(蓝字("购买上架#" + x.编号 + "#1", "【" + x.编号 + "】" + x.道具 + "×" + x.数量 + " · 单价" + x.单价 + " · 卖家#" + x.卖家编号));
  }
  if (总页 > 1) lines.push("", "第 " + 页 + "/" + 总页 + " 页 · 发 " + 蓝字("交易行#" + (页 < 总页 ? 页 + 1 : 1), "交易行#" + (页 < 总页 ? 页 + 1 : 1)) + " 翻页");
  lines.push("", "`上架#稀有鱼#2#300` · `购买上架#3#1` · `下架#3`");
  // F1 去重：「我的上架」整行只放一次 —— 有自己的货时 下钮 显示下架，没有时按钮行只保留 我的上架
  const 首我的 = mine[0];
  const 行一 = 首我的
    ? [btn("tr2", "下架【" + 首我的.编号 + "】", "下架#" + 首我的.编号), btn("tr3", "我的上架", "我的上架")]
    : [btn("tr3", "我的上架", "我的上架")];
  const 翻页组 = [];
  if (页 > 1) 翻页组.push(btn("tr7", "⬅ 上一页", "交易行#" + (页 - 1)));
  if (页 < 总页) 翻页组.push(btn("tr8", "下一页 ➡", "交易行#" + (页 + 1)));
  if (翻页组.length) 行一.push.apply(行一, 翻页组);
  await reply(ctx, t, lines.join("\n"), {
    标题: "🏪 交易行",
    行组: [
      row.apply(null, 行一),
      row(btn("tr4", "上架稀有鱼", "上架#稀有鱼#1#200"), btn("tr5", "商店", "商店"), btn("tr6", "菜单", "菜单"))
    ]
  });
}


export async function hallPut(ctx, t, u, name, cnt, price) {
  const it = S(name);
  if (allItems().indexOf(it) < 0) {
    await reply(ctx, t, "不能上架【" + it + "】。\n可上架：" + allItems().join(" / "), { 标题: "上架失败" });
    return;
  }
  const k = Math.floor(Number(cnt) || 0), pv = Math.floor(Number(price) || 0);
  if (k <= 0 || pv <= 0) { await reply(ctx, t, "数量和单价都要是正整数。例：`上架#稀有鱼#2#300`", { 标题: "上架失败" }); return; }
  if (hasItem(ctx, u, it) < k) { await reply(ctx, t, "你只有 " + hasItem(ctx, u, it) + " 个【" + it + "】。", { 标题: "上架失败" }); return; }
  // 2.9.13（U2）：上架税 = 挂牌总价 × 2%（取整），卖家出、进世界资金；下架（未售出）全额退回，售出不退
  const 挂牌总价 = pv * k;
  const 上架税 = Math.round(挂牌总价 * 交易行上架税率);
  const p = attrs(ctx, u);
  if (p.星羽 < 上架税) {
    await reply(ctx, t, "星羽不足：上架需交税 " + 上架税 + "（挂牌总价 " + kfmt(挂牌总价) + " × 2%），你有 " + kfmt(p.星羽) + "。", { 标题: "上架失败" });
    return;
  }
  takeItem(ctx, u, it, k);
  if (上架税 > 0) {
    addCoin(ctx, u, -上架税);
    加世界资金(ctx, 上架税, "交易行上架税 " + it + "×" + k + "（" + gid(ctx, u) + "）");
  }
  const no = dn(ctx, P.交易行序号, "序号", 1000) + 1;
  dset(ctx, P.交易行序号, "序号", no);
  const list = hallList(ctx);
  list.push({ 编号: no, 道具: it, 数量: k, 单价: pv, 卖家: u, 卖家编号: dn(ctx, P.游戏ID, u, 0), 上架税: 上架税, 数量0: k, 时间: fmt() });
  hallSave(ctx, list);
  await reply(ctx, t, "已上架【" + it + "】×" + k + " · 单价 " + pv + " · 货号【" + no + "】\n已交上架税 " + 上架税 + "（下架退回）\n买家成交时另付 5% 购买税，你拿到的是全额货款。", {
    标题: "🏪 上架成功", 按钮: [btn("ts1", "交易行", "交易行"), btn("ts2", "我的上架", "我的上架")]
  });
}


export async function hallBuy(ctx, t, u, no, cnt) {
  const list = hallList(ctx);
  let idx = -1;
  for (let i = 0; i < list.length; i++) if (String(list[i].编号) === S(no)) { idx = i; break; }
  if (idx < 0) { await reply(ctx, t, "货号【" + no + "】不存在或已售出。", { 标题: "购买失败" }); return; }
  const g = list[idx];
  if (g.卖家 === u) { await reply(ctx, t, "这是你自己的货，用 `下架#编号` 取回。", { 标题: "购买失败" }); return; }
  const k = Math.max(1, Math.floor(Number(cnt) || 1));
  if (g.数量 < k) { await reply(ctx, t, "该货只剩 " + g.数量 + " 件。", { 标题: "购买失败" }); return; }
  const total = g.单价 * k;
  // 2.9.13（U3）：购买税 = 成交价 × 5%（取整），**买家承担**（买家付 成交价+税），卖家拿全额；税进世界资金。
  //   旧口径「卖家扣 5%」作废（见 2.9.13 更新日志）。
  const 税 = Math.ceil(total * 交易行购买税率);
  const 实付 = total + 税;
  const p = attrs(ctx, u);
  if (p.星羽 < 实付) { await reply(ctx, t, "星羽不足：需付 " + kfmt(实付) + "（货款 " + kfmt(total) + " + 购买税 " + 税 + "），你有 " + kfmt(p.星羽) + "。", { 标题: "购买失败" }); return; }
  addCoin(ctx, u, -实付);
  addCoin(ctx, g.卖家, total);
  if (税 > 0) 加世界资金(ctx, 税, "交易行购买税 " + g.道具 + "×" + k + "（" + gid(ctx, u) + "）");
  giveItem(ctx, u, g.道具, k);
  g.数量 -= k;
  if (g.数量 <= 0) list.splice(idx, 1);
  hallSave(ctx, list);
  tInc(ctx, u, "交易行");
  await reply(ctx, t, "买入【" + g.道具 + "】×" + k + "\n支出 " + kfmt(实付) + " 星羽（货款 " + kfmt(total) + " + 购买税 " + 税 + "，税进世界资金）", {
    标题: "🏪 购买成功", 按钮: [btn("tt1", "交易行", "交易行"), btn("tt2", "使用道具", "使用道具")]
  });
}


export async function hallCancel(ctx, t, u, no) {
  const list = hallList(ctx);
  let idx = -1;
  for (let i = 0; i < list.length; i++) if (String(list[i].编号) === S(no)) { idx = i; break; }
  if (idx < 0) { await reply(ctx, t, "货号【" + no + "】不存在。", { 标题: "下架失败" }); return; }
  const g = list[idx];
  if (g.卖家 !== u) { await reply(ctx, t, "这不是你的货。", { 标题: "下架失败" }); return; }
  list.splice(idx, 1);
  hallSave(ctx, list);
  giveItem(ctx, u, g.道具, g.数量);
  // 2.9.13（U2）：下架（未售出）按未售数量退回上架税（全部未售 = 全额退；部分售出的已售部分不退）。
  //   从世界资金出；资金见底也照退，差额记日志。
  const 税0 = Math.max(0, Math.floor(Number(g.上架税) || 0));
  const 原数 = Math.max(0, Math.floor(Number(g.数量0) || 0));
  const 退税 = 税0 > 0 ? Math.round(税0 * g.数量 / Math.max(1, 原数 || g.数量)) : 0;
  let 退注 = "";
  if (退税 > 0) {
    if (!扣世界资金(ctx, 退税, "交易行下架退回上架税 " + g.道具 + "（" + gid(ctx, u) + "）")) {
      pushLog(ctx, "世界资金", "下架退回上架税时资金见底（已照退 " + 退税 + "）");
    }
    addCoin(ctx, u, 退税);
    退注 = "\n已退回上架税 " + 退税 + "。";
  }
  await reply(ctx, t, "已下架【" + g.道具 + "】×" + g.数量 + "，道具已退回。" + 退注, { 标题: "下架成功" });
}


export async function hallMine(ctx, t, u) {
  const list = hallList(ctx).filter((x) => x.卖家 === u);
  if (!list.length) { await reply(ctx, t, "你还没有上架任何东西。\n例：`上架#稀有鱼#2#300`", { 标题: "我的上架" }); return; }
  await reply(ctx, t, list.map((x) => "【" + x.编号 + "】" + x.道具 + "×" + x.数量 + " · 单价" + x.单价).join("\n"), {
    标题: "我的上架", 按钮: [btn("tu1", "下架【" + list[0].编号 + "】", "下架#" + list[0].编号), btn("tu2", "交易行", "交易行")]
  });
}


/* ============================================================
 * 2.9.9（需求 E）金融市场升级：1 只基金 → 10 只股票
 * ------------------------------------------------------------
 * · 每只独立：名称 / 当前价（整数星羽）/ 历史净值曲线（最近 24 个价位）
 * · 波动：后台时钟每 60 秒扫一次，每只每 30 分钟一跳 —— 随机游走 ±波幅，**单次涨跌 ±10% 封顶**
 * · 事件联动（节流 10 分钟/股，单次同样 ±10% 封顶）：BOSS 击杀→星舰重工、副本通关→深空能源、
 *   赌场大奖→极光传媒、每日签到→天穹银行、挖矿→暗域矿业
 * · 停牌：单日累计（对日初价）±25% → 自动停牌 4 小时，期间不可买卖，面板显示「停牌中」
 * · 分红：每 24 小时按持仓市值 × 股息率% ÷ 30 派息（各股股息率 0.5%~3% 不同），
 *   钱从「世界资金」出（见底当股跳过）；买入本金进世界资金、卖出从世界资金付款（留 1% 手续费）
 * · 指令：`星甲股票`（行情 + 持仓）/ `星甲买入#股名#金额` / `星甲卖出#股名#份额|全部`
 * · 旧基金：启动迁移 —— 旧份额/成本 → 「01 星河基金」持仓，旧档清零（幂等）；
 *   `买入基金#N` / `卖出基金#N` 保留拦截，回「已升级为股票」提示
 * ============================================================ */
export const 股票跳间隔毫秒 = 30 * 60 * 1000;


export const 股票单次涨跌停 = 0.10;


export const 股票停牌阈值 = 0.25;


export const 股票停牌毫秒 = 4 * 3600 * 1000;


export const 股票派息毫秒 = 24 * 3600 * 1000;


export const 股票手续费 = 0.01;


export const 股事件节流毫秒 = 10 * 60 * 1000;


export const 股票表 = [
  { 代码: "01", 名: "星河基金", 股息率: 3.0, 波幅: 0.035, 底: 60, 起: 100 },
  { 代码: "02", 名: "星舰重工", 股息率: 2.2, 波幅: 0.07,  底: 40, 起: 150 },
  { 代码: "03", 名: "暗域矿业", 股息率: 1.8, 波幅: 0.06,  底: 30, 起: 80 },
  { 代码: "04", 名: "星港航运", 股息率: 1.5, 波幅: 0.05,  底: 35, 起: 90 },
  { 代码: "05", 名: "极光传媒", 股息率: 2.5, 波幅: 0.08,  底: 25, 起: 70 },
  { 代码: "06", 名: "深空能源", 股息率: 1.2, 波幅: 0.045, 底: 45, 起: 120 },
  { 代码: "07", 名: "天穹银行", 股息率: 0.8, 波幅: 0.025, 底: 80, 起: 200 },
  { 代码: "08", 名: "陨铁锻造", 股息率: 1.6, 波幅: 0.055, 底: 30, 起: 85 },
  { 代码: "09", 名: "银河药房", 股息率: 1.0, 波幅: 0.04,  底: 40, 起: 110 },
  { 代码: "10", 名: "星穹科技", 股息率: 2.0, 波幅: 0.065, 底: 35, 起: 95 }
];


export function 股票找(键) {
  const k = S(键).trim();
  if (!k) return null;
  return 股票表.filter((x) => x.名 === k || x.代码 === k)[0]
    || 股票表.filter((x) => x.代码.replace(/^0/, "") === k.replace(/^0/, "") && /^[0-9]+$/.test(k))[0]
    || 股票表.filter((x) => x.名.indexOf(k) >= 0)[0]
    || null;
}


export function 股票行情(ctx) {
  let v = dget(ctx, P.股票行情, "表", null);
  if (!v || typeof v !== "object") v = {};
  const 今 = ymd();
  let 脏 = false;
  for (const it of 股票表) {
    if (!v[it.代码]) {
      v[it.代码] = { 名: it.名, 价: it.起, 曲线: [it.起], 停牌至: 0, 日初价: it.起, 日期: 今, 上次跳: 0, 事件: "" };
      脏 = true;
      continue;
    }
    const r = v[it.代码];
    if (r.名 !== it.名) { r.名 = it.名; 脏 = true; }
    if (r.日期 !== 今) { r.日期 = 今; r.日初价 = Math.max(1, Math.round(Number(r.价) || it.起)); 脏 = true; }
    if (!Array.isArray(r.曲线)) { r.曲线 = [Math.max(1, Math.round(Number(r.价) || it.起))]; 脏 = true; }
  }
  if (脏) dset(ctx, P.股票行情, "表", v);
  return v;
}


export function 存股票行情(ctx, v) { dset(ctx, P.股票行情, "表", v); }


export function 读股票持仓(ctx, u) {
  const v = dget(ctx, P.股票持仓, u, null);
  return v && typeof v === "object" ? v : {};
}


export function 存股票持仓(ctx, u, 持) { dset(ctx, P.股票持仓, u, 持); }


// 2.9.10（需求 1）：管理员价格上下限 —— 波动 tick 与事件联动都夹在 [下限,上限]（0 = 不设，默认无限）
//   仅管理员可见（GET /stocks 管理接口）；玩家侧面板 / 行情一律不显示。
export function 读股票上下限(ctx, 代码) {
  const v = dget(ctx, P.股票上下限, S(代码), null);
  const o = v && typeof v === "object" ? v : {};
  return { 上: Number(o.上) > 0 ? Math.floor(Number(o.上)) : 0, 下: Number(o.下) > 0 ? Math.floor(Number(o.下)) : 0 };
}


// 设 / 清上下限：传 0 / 空 = 取消该边；两边都设时要求 上 > 下。返回 { 上, 下 }
export function 设股票上下限(ctx, 代码, 上限, 下限) {
  const 上 = Number(上限) > 0 ? Math.floor(Number(上限)) : 0;
  const 下 = Number(下限) > 0 ? Math.floor(Number(下限)) : 0;
  if (上 > 0 && 下 > 0 && 上 <= 下) return null;
  dset(ctx, P.股票上下限, S(代码), { 上: 上, 下: 下 });
  return { 上: 上, 下: 下 };
}


// 把管理员上下限夹到价格上（股票跳 / 股事件共用）
export function 股价夹限(ctx, it, 新) {
  const 界 = 读股票上下限(ctx, it.代码);
  let v = 新;
  if (界.下 > 0) v = Math.max(v, 界.下);
  if (界.上 > 0) v = Math.min(v, 界.上);
  return Math.max(1, Math.round(v));
}


// 单次跳变：随机游走 ±波幅，clamp 到 ±10%；对日初价累计 ±25% → 停牌 4 小时
export function 股票跳(ctx, 行, it, now, 事由) {
  const 随机 = (Math.random() * 2 - 1) * it.波幅;
  const chg = Math.max(-股票单次涨跌停, Math.min(股票单次涨跌停, 随机));
  const 旧 = Math.max(1, Math.round(Number(行.价) || it.起));
  // 2.9.10（需求 1）：先按随机游走算，再夹进管理员上下限（下限仍不低于股价底值）
  let 新 = Math.max(it.底, Math.round(旧 * (1 + chg)));
  新 = 股价夹限(ctx, it, 新);
  行.价 = 新;
  行.上次跳 = now;
  行.曲线 = (Array.isArray(行.曲线) ? 行.曲线 : []).concat([新]).slice(-24);
  行.事件 = S(事由).slice(0, 30);
  const 累 = 行.日初价 > 0 ? (新 - 行.日初价) / 行.日初价 : 0;
  let 停了 = false;
  if (Math.abs(累) >= 股票停牌阈值 && now >= (Number(行.停牌至) || 0)) {
    行.停牌至 = now + 股票停牌毫秒;
    停了 = true;
  }
  return { 代码: it.代码, 名: it.名, 旧: 旧, 新: 新, 累: 累, 停了: 停了 };
}


// 分红：每 24 小时按 持仓市值 × 股息率% ÷ 30 派息，钱从世界资金出（见底当股跳过）
export function 股票派息(ctx, now) {
  const 上次 = dn(ctx, P.股票分红, "上次", 0);
  if (上次 && now - 上次 < 股票派息毫秒) return null;
  dset(ctx, P.股票分红, "上次", now);
  const 行表 = 股票行情(ctx);
  const 全部 = dall(ctx, P.股票持仓);
  const 汇总 = { 派了: 0, 总额: 0, 跳过: 0 };
  for (const u of Object.keys(全部 || {})) {
    const 持 = 全部[u];
    if (!持 || typeof 持 !== "object") continue;
    let 共 = 0;
    for (const it of 股票表) {
      const c = 持[it.代码];
      if (!c || !(Number(c.份额) > 0)) continue;
      const 价 = Math.max(1, Math.round(Number((行表[it.代码] || {}).价) || it.起));
      const 息 = Math.floor(c.份额 * 价 * (it.股息率 / 100) / 30);
      if (息 <= 0) continue;
      if (!扣世界资金(ctx, 息, "股票分红 " + it.名 + " → " + gid(ctx, u))) { 汇总.跳过 += 1; continue; }
      addCoin(ctx, u, 息);
      共 += 息;
    }
    if (共 > 0) { pushLog(ctx, u, "股票分红 +" + kfmt(共) + " 星羽（走世界资金）"); 汇总.派了 += 1; 汇总.总额 += 共; }
  }
  return 汇总;
}


// 时钟心跳：到点的股各跳一次 + 检查派息
export function 股票tick(ctx, now) {
  now = Number(now) || Date.now();
  const 行表 = 股票行情(ctx);
  const 跳了 = [];
  for (const it of 股票表) {
    const 行 = 行表[it.代码];
    if (!行) continue;
    if (now - (Number(行.上次跳) || 0) < 股票跳间隔毫秒) continue;
    跳了.push(股票跳(ctx, 行, it, now, ""));
  }
  存股票行情(ctx, 行表);
  股票派息(ctx, now);
  return 跳了;
}


// 事件联动：单次 ±10% 封顶 + 每股 10 分钟节流
export function 股事件(ctx, 代码, pct, 事由) {
  const it = 股票表.filter((x) => x.代码 === 代码 || x.名 === 代码)[0];
  if (!it) return null;
  const now = Date.now();
  const 上次 = dn(ctx, P.股票事件, it.代码, 0);
  if (上次 && now - 上次 < 股事件节流毫秒) return null;
  dset(ctx, P.股票事件, it.代码, now);
  const 行表 = 股票行情(ctx);
  const 行 = 行表[it.代码];
  if (!行) return null;
  const c = Math.max(-股票单次涨跌停, Math.min(股票单次涨跌停, Number(pct) || 0));
  const 旧 = Math.max(1, Math.round(Number(行.价) || it.起));
  // 2.9.10（需求 1）：事件联动同样夹进管理员上下限
  let 新 = Math.max(it.底, Math.round(旧 * (1 + c)));
  新 = 股价夹限(ctx, it, 新);
  行.价 = 新;
  行.曲线 = (Array.isArray(行.曲线) ? 行.曲线 : []).concat([新]).slice(-24);
  行.事件 = S(事由).slice(0, 30);
  存股票行情(ctx, 行表);
  return { 名: it.名, 旧: 旧, 新: 新 };
}


// 旧基金迁移：份额/成本 → 01 星河基金，旧档清零（幂等）
export function 迁移旧基金(ctx) {
  const 全 = dall(ctx, P.基金份额);
  if (!全 || typeof 全 !== "object") return 0;
  let n = 0;
  for (const u of Object.keys(全)) {
    const 份额 = Math.max(0, Math.floor(Number(全[u]) || 0));
    if (份额 <= 0) continue;
    const 成本 = Math.max(0, Math.floor(Number(dn(ctx, P.基金成本, u, 0)) || 0));
    const 持 = 读股票持仓(ctx, u);
    const c = 持["01"] || { 份额: 0, 成本: 0 };
    c.份额 += 份额; c.成本 += 成本;
    持["01"] = c;
    存股票持仓(ctx, u, 持);
    dset(ctx, P.基金份额, u, 0);
    dset(ctx, P.基金成本, u, 0);
    pushLog(ctx, u, "旧基金持仓迁移 → 01 星河基金 " + 份额 + " 份（成本 " + kfmt(成本) + "）");
    n += 1;
  }
  return n;
}


export async function 股票面板(ctx, t, u) {
  股票tick(ctx);   // 面板时懒推进一次（时钟没跑也能动）
  const 行表 = 股票行情(ctx);
  const 持 = 读股票持仓(ctx, u);
  const now = Date.now();
  const 行 = [
    "## 💹 星甲股市",
    "",
    "每 30 分钟一跳（随机游走，**单次 ±10% 封顶**）· 单日累计 ±25% 自动停牌 4 小时",
    "分红每 24 小时按持仓市值自动派发（走世界资金）· 卖出收 1% 手续费",
    ""
  ];
  let 总市值 = 0, 总成本 = 0, 持几 = 0;
  for (const it of 股票表) {
    const r = 行表[it.代码];
    const 停 = now < (Number(r.停牌至) || 0);
    const 累 = r.日初价 > 0 ? Math.round((r.价 - r.日初价) / r.日初价 * 100) : 0;
    const c = 持[it.代码];
    const 份 = c && Number(c.份额) > 0 ? Number(c.份额) : 0;
    const 市值 = 份 > 0 ? 份 * Math.max(1, Math.round(Number(r.价) || it.起)) : 0;
    总市值 += 市值;
    if (份 > 0) { 总成本 += Number(c.成本) || 0; 持几 += 1; }
    // 3.1.0：股票名 / 买入 / 卖出 都是蓝色可点（点名字看行情，点买入卖出直接填指令）
    const 名链 = 蓝字("买入#" + it.名 + "#1000", it.代码 + " " + it.名);
    const 操作链 = "　" + 蓝字("买入#" + it.名 + "#1000", "买1000") + " " + 蓝字("卖出#" + it.名 + "#全部", "全卖") + (份 > 0 ? " " + 蓝字("卖出#" + it.名 + "#" + 份, "卖出") : "");
    行.push((停 ? "⏸" : "📈") + " " + 名链 + "　" + kfmt(Math.max(1, Math.round(Number(r.价) || it.起))) + " 星羽（今日 " + (累 >= 0 ? "+" : "") + 累 + "% · 股息率 " + it.股息率 + "%）" + (停 ? "　🚫 **停牌中**" : "") + (份 > 0 ? "　持有 " + 份 + " 份（市值 " + kfmt(市值) + "）" : "") + 操作链 + (r.事件 && !停 ? "　" + r.事件 : ""));
  }
  行.push("", "**我的持仓**：" + 持几 + " 只 · 市值 " + kfmt(总市值) + " · 成本 " + kfmt(总成本) + " · 盈亏 " + (总市值 - 总成本 >= 0 ? "+" : "") + kfmt(总市值 - 总成本));
  行.push("");
  行.push("指令：`星甲买入#星舰重工#5000`（花 5000 星羽按现价买入）/ `星甲卖出#星舰重工#10`（也可 `#全部`）");
  const 前3 = 股票表.slice(0, 3).map((it) => btn("stk" + it.代码, "买" + it.名.slice(0, 3), "买入#" + it.名 + "#1000"));
  await reply(ctx, t, 行.join("\n"), {
    标题: "💹 星甲股市",
    行组: [
      row.apply(null, 前3.concat([btn("stkall", "全部行情", "股票")])),
      row(btn("stk1", "银行", "银行系统"), btn("stk2", "交易行", "交易行"), btn("stk3", "商店", "商店"), btn("stk4", "星甲菜单", "星甲菜单"))
    ]
  });
}


export async function 股票买入(ctx, t, u, 股名, 金额) {
  const it = 股票找(股名);
  if (!it) {
    await reply(ctx, t, "没有这只股票：【" + S(股名) + "】\n发 `星甲股票` 看 10 只股票行情（用名称或代码，如 `星甲买入#星舰重工#5000`、`星甲买入#02#5000`）。", { 标题: "💹 买入失败", 按钮: [btn("sb1", "股票行情", "股票")] });
    return;
  }
  股票tick(ctx);
  const 行表 = 股票行情(ctx);
  const 行 = 行表[it.代码];
  const now = Date.now();
  if (now < (Number(行.停牌至) || 0)) {
    await reply(ctx, t, "**" + it.名 + "** 停牌中（单日波动过大），还需 " + wait(Number(行.停牌至) - now) + "。\n停牌期间不能买入 / 卖出。", { 标题: "🚫 停牌中", 按钮: [btn("sb2", "股票行情", "股票")] });
    return;
  }
  const 钱 = Math.floor(Number(金额) || 0);
  if (钱 < 100) { await reply(ctx, t, "买入金额至少 100 星羽，例：`星甲买入#" + it.名 + "#1000`", { 标题: "💹 买入失败" }); return; }
  const 价 = Math.max(1, Math.round(Number(行.价) || it.起));
  const 份 = Math.floor(钱 / 价);
  if (份 <= 0) { await reply(ctx, t, "当前价 " + 价 + " 星羽/份，" + kfmt(钱) + " 星羽买不起 1 份。\n例：`星甲买入#" + it.名 + "#1000`", { 标题: "💹 买入失败" }); return; }
  const p = attrs(ctx, u);
  const 实花 = 份 * 价;
  if (p.星羽 < 实花) {
    await reply(ctx, t, "星羽不足：" + 份 + " 份需要 " + kfmt(实花) + "（单价 " + 价 + "），你有 " + kfmt(p.星羽) + "。", { 标题: "💹 买入失败", 行组: [row(btn("sb3", "挖矿", "挖矿"), btn("sb4", "打工", "打工"), btn("sb5", "股票行情", "股票"))] });
    return;
  }
  addCoin(ctx, u, -实花);
  // 2.9.9（需求 F）：买入本金进世界资金（市场对手盘）
  加世界资金(ctx, 实花, "股票买入 " + it.名 + "×" + 份 + " @ " + 价 + "（" + gid(ctx, u) + "）");
  const 持 = 读股票持仓(ctx, u);
  const c = 持[it.代码] || { 份额: 0, 成本: 0 };
  c.份额 = (Number(c.份额) || 0) + 份;
  c.成本 = (Number(c.成本) || 0) + 实花;
  持[it.代码] = c;
  存股票持仓(ctx, u, 持);
  pushLog(ctx, u, "买入股票 " + it.名 + " ×" + 份 + " @ " + 价 + "（-" + kfmt(实花) + " 星羽）");
  await reply(ctx, t, [
    "买入 **" + it.名 + "** ×" + 份 + " 份 @ " + 价 + " 星羽",
    "花费 " + kfmt(实花) + " 星羽（本金进世界资金）",
    "持仓 " + c.份额 + " 份 · 成本 " + kfmt(c.成本),
    "",
    "分红每 24 小时自动派发（股息率 " + it.股息率 + "%）；`星甲卖出#" + it.名 + "#" + c.份额 + "` 可卖出。"
  ].join("\n"), {
    标题: "💹 买入成功",
    行组: [row(btn("sc1", "股票行情", "股票"), btn("sc2", "再买1000", "买入#" + it.名 + "#1000"), btn("sc3", "卖出一半", "卖出#" + it.名 + "#" + Math.max(1, Math.floor(c.份额 / 2))))]
  });
}


export async function 股票卖出(ctx, t, u, 股名, 份额) {
  const it = 股票找(股名);
  if (!it) {
    await reply(ctx, t, "没有这只股票：【" + S(股名) + "】\n发 `星甲股票` 看 10 只股票行情。", { 标题: "💹 卖出失败", 按钮: [btn("sd1", "股票行情", "股票")] });
    return;
  }
  股票tick(ctx);
  const 行表 = 股票行情(ctx);
  const 行 = 行表[it.代码];
  const now = Date.now();
  if (now < (Number(行.停牌至) || 0)) {
    await reply(ctx, t, "**" + it.名 + "** 停牌中（单日波动过大），还需 " + wait(Number(行.停牌至) - now) + "。\n停牌期间不能买入 / 卖出。", { 标题: "🚫 停牌中", 按钮: [btn("sd2", "股票行情", "股票")] });
    return;
  }
  const 持 = 读股票持仓(ctx, u);
  const c = 持[it.代码];
  if (!c || !(Number(c.份额) > 0)) { await reply(ctx, t, "你没有持有 **" + it.名 + "**。发 `星甲股票` 看行情。", { 标题: "💹 卖出失败" }); return; }
  const s = S(份额).toLowerCase();
  const k = s === "全部" || s === "全" ? c.份额 : Math.min(Math.max(0, Math.floor(Number(s) || 0)), c.份额);
  if (!(k > 0)) { await reply(ctx, t, "份额要填正整数或「全部」，例：`星甲卖出#" + it.名 + "#10`、`星甲卖出#" + it.名 + "#全部`", { 标题: "💹 卖出失败" }); return; }
  const 价 = Math.max(1, Math.round(Number(行.价) || it.起));
  const 毛 = k * 价;
  const 费 = Math.ceil(毛 * 股票手续费);
  const 实得 = 毛 - 费;
  // 2.9.9（需求 F）：卖出由世界资金付款（手续费 1% 留在世界资金），资金见底时暂停卖出
  if (!扣世界资金(ctx, 实得, "股票卖出 " + it.名 + "×" + k + "（" + gid(ctx, u) + "）")) {
    await reply(ctx, t, [
      "❌ 卖出暂缓 —— 世界资金已见底，暂时付不起卖出款。",
      "",
      补货提示(ctx)
    ].join("\n"), { 标题: "🌐 世界资金见底", 行组: [row(btn("sd3", "世界资金", "世界资金"), btn("sd4", "官方群", "官方群"))] });
    return;
  }
  addCoin(ctx, u, 实得);
  const 成本Cut = c.份额 > 0 ? Math.round((Number(c.成本) || 0) * (k / c.份额)) : 0;
  c.份额 = (Number(c.份额) || 0) - k;
  c.成本 = Math.max(0, (Number(c.成本) || 0) - 成本Cut);
  持[it.代码] = c;
  存股票持仓(ctx, u, 持);
  pushLog(ctx, u, "卖出股票 " + it.名 + " ×" + k + " @ " + 价 + "（+" + kfmt(实得) + " 星羽，手续费 " + kfmt(费) + "，盈亏 " + (实得 - 成本Cut >= 0 ? "+" : "") + kfmt(实得 - 成本Cut) + "）");
  await reply(ctx, t, [
    "卖出 **" + it.名 + "** ×" + k + " 份 @ " + 价 + " 星羽",
    "毛额 " + kfmt(毛) + " · 手续费 1% -" + kfmt(费) + " · **实得 " + kfmt(实得) + " 星羽**",
    "本次盈亏 " + (实得 - 成本Cut >= 0 ? "+" : "") + kfmt(实得 - 成本Cut) + "（成本 " + kfmt(成本Cut) + "）",
    "剩余持仓 " + c.份额 + " 份"
  ].join("\n"), {
    标题: "💹 卖出成功",
    行组: [row(btn("se1", "股票行情", "股票"), btn("se2", "银行", "银行系统"), btn("se3", "星甲菜单", "星甲菜单"))]
  });
}


export async function rob(ctx, t, u, to) {
  const tu = byGid(ctx, S(to));
  if (!tu || tu === u) { await reply(ctx, t, "打劫对象无效。", { 标题: "打劫失败" }); return; }
  // 2.6.0（平衡）：打劫原来**没有任何冷却与次数限制**，可以对着同一个目标无限点，
  //   期望收益为正（成功抢 15%、失败赔 8%），等于一台刷星羽的机器。
  //   现在：同一人 90 秒冷却；被抢的人 10 分钟内不会被同一个人反复抢。
  const 剩 = Math.max(0, dn(ctx, P.打劫冷却, u, 0) - Date.now());
  if (剩 > 0) { await reply(ctx, t, "刚抢完还没喘过气，请等 **" + wait(剩) + "** 再来。", { 标题: "🥷 打劫冷却" }); return; }
  const 目标剩 = Math.max(0, dn(ctx, P.打劫冷却, u + "_" + tu, 0) - Date.now());
  if (目标剩 > 0) { await reply(ctx, t, "这个人最近被你抢过了，换个目标吧（" + wait(目标剩) + " 后可再抢）。", { 标题: "🥷 打劫冷却" }); return; }
  const me = attrs(ctx, u), you = attrs(ctx, tu);
  if (you.星羽 < 100) { await reply(ctx, t, "对方太穷了，放过他吧。", { 标题: "打劫" }); return; }
  // 先上冷却，成功失败都算（防止失败后立刻重试刷概率）
  dset(ctx, P.打劫冷却, u, Date.now() + 90 * 1000);
  dset(ctx, P.打劫冷却, u + "_" + tu, Date.now() + 10 * 60 * 1000);
  const rate = Math.max(0.1, Math.min(0.75, pwrOf(ctx, u) / Math.max(1, pwrOf(ctx, tu)) * 0.45));
  if (Math.random() < rate) {
    const got = Math.floor(you.星羽 * 0.15);
    addCoin(ctx, tu, -got);
    addCoin(ctx, u, got);
    await reply(ctx, t, "打劫成功，从 " + you.昵称 + " 身上抢到 " + kfmt(got) + " 星羽。", {
      标题: "🥷 打劫成功", 按钮: [btn("rb1", "再抢一次", "打劫#" + you.编号)]
    });
    return;
  }
  const fine = Math.floor(me.星羽 * 0.08);
  addCoin(ctx, u, -fine);
  addCoin(ctx, tu, fine);
  await reply(ctx, t, "打劫失败，逃跑时掉了 " + kfmt(fine) + " 星羽（赔给对方）。", { 标题: "🥷 打劫失败" });
}
