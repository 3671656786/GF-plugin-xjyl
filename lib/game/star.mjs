// lib/game/star.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S, dget, dn, dset, kfmt, n, rnd, ymd } from "./../core/base.mjs?v=v1795261108802";
import { actBtn, btn, reply, row, 蓝字, 蓝链 } from "./../core/qq.mjs?v=v1795261108802";
import { P } from "./../core/util.mjs?v=v1795261108802";
import { 灰块 } from "././cook.mjs?v=v1795261108802";
import { addCoin, addCore, attrs, recPwr, 乘奖励, 加经验 } from "././player.mjs?v=v1795261108802";
import { tProg } from "././progress.mjs?v=v1795261108802";


/* ============================================================
 * 2.7.0（需求 5/6）新玩法：星灵伙伴 + 每日悬赏
 * · 星灵：长期养成线，用星羽喂养，按等级加 攻/防/血，补一个「钱有处花」的出口
 * · 悬赏：每天 3 条随机目标，复用每日任务的计数器，完成给额外星羽/星核/经验
 * ============================================================ */
// ---------- 星灵 ----------
export const 星灵等级上限 = 100;


export const 星灵每级 = { 攻: 8, 防: 4, 血: 15 };


export function 星灵状态(ctx, u) {
  const v = dget(ctx, P.星灵, u, null);
  const o = v && typeof v === "object" ? v : {};
  return {
    等级: Math.max(0, Math.min(星灵等级上限, Math.floor(n(o.等级, 0)))),
    经验: Math.max(0, Math.floor(n(o.经验, 0)))
  };
}


export function 存星灵(ctx, u, o) {
  dset(ctx, P.星灵, u, { 等级: Math.max(0, Math.min(星灵等级上限, Math.floor(n(o && o.等级, 0)))), 经验: Math.max(0, Math.floor(n(o && o.经验, 0))) });
}


export function 星灵加成(ctx, u) {
  const s = 星灵状态(ctx, u);
  return { 攻: s.等级 * 星灵每级.攻, 防: s.等级 * 星灵每级.防, 血: s.等级 * 星灵每级.血 };
}


export function 星灵升级费(等级) {
  return Math.max(200, Math.round(140 * Math.pow(等级 + 1, 1.42)));
}


export async function 星灵面板(ctx, t, u) {
  const s = 星灵状态(ctx, u);
  const p = attrs(ctx, u);
  const 加 = 星灵加成(ctx, u);
  const 费 = 星灵升级费(s.等级);
  const 满 = s.等级 >= 星灵等级上限;
  const 行 = [
    "**星灵 Lv." + s.等级 + "/" + 星灵等级上限 + "**" + (满 ? "（已满级）" : ""),
    "",
    "当前加成",
    "攻击 +" + kfmt(加.攻) + "　防御 +" + kfmt(加.防) + "　血量 +" + kfmt(加.血),
    "",
    "升级",
    满 ? "已经满级，不用再喂了。" : ("下一级花费 **" + kfmt(费) + "** 星羽　（你有 " + kfmt(p.星羽) + "）"),
    满 ? "" : ("升到 Lv." + (s.等级 + 1) + " 后：攻击 +" + kfmt((s.等级 + 1) * 星灵每级.攻) + "　血量 +" + kfmt((s.等级 + 1) * 星灵每级.血)),
    "",
    "星灵加成直接算进属性面板与战斗，不占装备位。",
    "相关：" + 蓝链([["星甲属性", "属性"], ["星甲银行", "取钱"], ["星甲星灵", "刷新"], ["星甲菜单", "菜单"]])
  ].filter((x) => x !== "");
  await reply(ctx, t, 灰块(行), {
    标题: "🐣 星灵",
    行组: [
      row(actBtn("sp1", "⚡升1级", "pet|1"), actBtn("sp2", "⚡升10级", "pet|10"), btn("sp3", "属性", "属性"), btn("sp4", "银行", "银行")),
      row(btn("sp5", "菜单", "星甲菜单"))
    ]
  });
}


export async function 星灵升级(ctx, t, u, 次数) {
  const k = Math.max(1, Math.min(50, Math.floor(Number(次数) || 1)));
  let s = 星灵状态(ctx, u);
  if (s.等级 >= 星灵等级上限) { await reply(ctx, t, "星灵已经满级了。", { 标题: "🐣 星灵", 按钮: [btn("sp9", "回星灵", "星灵")] }); return; }
  const 起始 = s.等级;
  let 花 = 0, 升 = 0;
  for (let i = 0; i < k; i++) {
    if (s.等级 >= 星灵等级上限) break;
    const 费 = 星灵升级费(s.等级);
    const 现有 = dn(ctx, P.星羽, u, 0);
    if (现有 < 费) break;
    addCoin(ctx, u, -费);
    花 += 费;
    s.等级 += 1;
    升 += 1;
  }
  if (!升) {
    const 费 = 星灵升级费(s.等级);
    await reply(ctx, t, "星羽不够。升下一级需要 **" + kfmt(费) + "**，你现在有 " + kfmt(dn(ctx, P.星羽, u, 0)) + "。\n缺钱可以 " + 蓝字("星甲挖矿", "挖矿") + " / " + 蓝字("星甲打工", "打工") + " / " + 蓝字("星甲钓鱼", "钓鱼") + "。", { 标题: "🐣 星羽不足", 按钮: [btn("sp6", "挖矿", "挖矿"), btn("sp7", "打工", "打工"), btn("sp8", "星灵", "星灵")] });
    return;
  }
  存星灵(ctx, u, s);
  recPwr(ctx, u);
  const 加 = 星灵加成(ctx, u);
  await reply(ctx, t, [
    "**星灵升级完成**",
    "",
    "Lv." + 起始 + " → **Lv." + s.等级 + "**（+" + 升 + " 级）",
    "花费：" + kfmt(花) + " 星羽（剩余 " + kfmt(dn(ctx, P.星羽, u, 0)) + "）",
    "当前加成：攻击 +" + kfmt(加.攻) + " · 防御 +" + kfmt(加.防) + " · 血量 +" + kfmt(加.血)
  ].join("\n"), { 标题: "🐣 星灵升级", 按钮: [row(actBtn("sp1", "⚡再升1级", "pet|1"), actBtn("sp2", "⚡再升10级", "pet|10"), btn("sp3", "星灵", "星灵"))] });
}



// ---------- 每日悬赏 ----------
export const 悬赏模板 = [
  { key: "副本", 名: "通关副本", 范围: [3, 6], 币: 900, 核: 2, 经: 600 },
  { key: "打装备", 名: "击败 BOSS", 范围: [1, 3], 币: 1400, 核: 3, 经: 900 },
  { key: "挖矿", 名: "挖矿", 范围: [3, 8], 币: 600, 核: 1, 经: 300 },
  { key: "探索", 名: "探索", 范围: [5, 10], 币: 700, 核: 1, 经: 400 },
  { key: "钓鱼", 名: "钓鱼", 范围: [3, 8], 币: 500, 核: 1, 经: 260 },
  { key: "打坐", 名: "打坐", 范围: [1, 2], 币: 450, 核: 1, 经: 220 },
  { key: "使用道具", 名: "使用道具", 范围: [3, 6], 币: 400, 核: 1, 经: 200 }
];


export function 悬赏数据(ctx, u) {
  const 今日 = ymd();
  const v = dget(ctx, P.悬赏, u, null);
  if (v && typeof v === "object" && S(v.日期) === 今日 && Array.isArray(v.列表) && v.列表.length) return v;
  const 池 = 悬赏模板.slice();
  const 列表 = [];
  for (let i = 0; i < 3 && 池.length; i++) {
    const idx = rnd(0, 池.length - 1);
    const tpl = 池.splice(idx, 1)[0];
    列表.push({
      key: tpl.key, 名: tpl.名, 需: rnd(tpl.范围[0], tpl.范围[1]),
      币: tpl.币, 核: tpl.核, 经: tpl.经, 领: false
    });
  }
  const o = { 日期: 今日, 列表 };
  dset(ctx, P.悬赏, u, o);
  return o;
}


export function 悬赏进度(ctx, u, item) {
  try { return Math.max(0, Number(tProg(ctx, u)[item.key]) || 0); } catch (e) { return 0; }
}


export async function 悬赏面板(ctx, t, u) {
  const d = 悬赏数据(ctx, u);
  const 行 = ["**今日悬赏**（" + d.日期 + " · 每天 0 点刷新）", ""];
  let 可领 = 0;
  d.列表.forEach((it, i) => {
    const 进 = Math.min(it.需, 悬赏进度(ctx, u, it));
    const 完成 = 进 >= it.需;
    if (完成 && !it.领) 可领 += 1;
    行.push((it.领 ? "🎁" : 完成 ? "✅" : "⬜") + " **" + (i + 1) + ". " + it.名 + " " + it.需 + " 次**　进度 " + 进 + "/" + it.需 + (it.领 ? "（已领）" : 完成 ? "（可领）" : ""));
    行.push("　奖励：星羽 " + kfmt(it.币) + " · 星核 " + it.核 + " · 经验 " + kfmt(it.经));
  });
  行.push("", 可领 ? ("👉 有 **" + 可领 + "** 条可以领，点下面「⚡领取悬赏」。") : "👉 完成后回来领取；进度与每日任务共用，做日常时顺手就完成了。");
  await reply(ctx, t, 灰块(行), {
    标题: "📜 每日悬赏",
    行组: [
      row(actBtn("bq1", "⚡领取悬赏", "bounty"), btn("bq2", "每日任务", "每日任务"), btn("bq3", "副本", "副本"), btn("bq4", "菜单", "星甲菜单"))
    ]
  });
}


export async function 悬赏领取(ctx, t, u) {
  const d = 悬赏数据(ctx, u);
  const 得 = [];
  let 币 = 0, 核 = 0, 经 = 0;
  for (const it of d.列表) {
    if (it.领) continue;
    if (悬赏进度(ctx, u, it) < it.需) continue;
    it.领 = true;
    币 += it.币; 核 += it.核; 经 += it.经;
    得.push(it.名 + " ×" + it.需);
  }
  if (!得.length) {
    await reply(ctx, t, "现在没有可领取的悬赏。\n发 " + 蓝字("星甲悬赏", "悬赏") + " 看看还差多少。", { 标题: "📜 悬赏" });
    return;
  }
  dset(ctx, P.悬赏, u, d);
  addCoin(ctx, u, 乘奖励(ctx, u, "星羽", 币));
  if (核 > 0) addCore(ctx, u, 乘奖励(ctx, u, "星核", 核));
  const up = 加经验(ctx, u, 经);
  await reply(ctx, t, [
    "**悬赏奖励已领取**",
    "",
    ...得.map((x) => "✅ " + x),
    "",
    "星羽 +" + kfmt(乘奖励(ctx, u, "星羽", 币)) + " · 星核 +" + 乘奖励(ctx, u, "星核", 核) + " · 经验 +" + kfmt(经) + (up ? "（升 " + up + " 级）" : "")
  ].join("\n"), { 标题: "📜 悬赏完成", 按钮: [row(btn("bq9", "再看悬赏", "悬赏"), btn("bq10", "每日任务", "每日任务"), btn("bq11", "菜单", "星甲菜单"))] });
}



/* ============================================================
 * 十三·七、2.9.6（需求 8/9/10/11）信用体系 · 贷款 · 世界资金
 * ------------------------------------------------------------
 * 信用分：新号 1 分，上限 100；0 分时大部分功能被拦（dispatch 里统一拦截）。
 *   加分：每日签到 +1 · 通关普通副本 +1 · 击败 BOSS +2 ·
 *         捐款每 1 万星羽 +1（单次最多 +5）· 到期前按时还清贷款 +3
 *   扣分：贷款逾期后**每满一天 -1**，直至 0
 * 贷款：同时只能有一笔，还完才能贷下一笔；额度 = 信用分 × 10 万（硬上限 1000 万）；
 *       利率 0.01% / 小时，按整小时累计；最久 3 天。
 *       放贷从「世界资金」出账，收回的利息回流「世界资金」。
 * 世界资金：初始 100 亿。来源 = 玩家商店购物 / 玩家捐款 / 贷款利息 / 交易行成交税（5%）/ 股票买入 / 赌场·骰子·抽卡收入 / 控制台添加；
 *           支出 = 放贷 / 银行利息 / 商店回收物品 / 股票卖出与分红 / 转盘·赌场·骰子赔付。为 0 时不可贷款、不发利息、不回收物品。
 * 数据全部写 dataPath（插件目录重载会被覆盖，所以一处都不落在插件目录）。
 * ============================================================ */
export const 信用默认 = 1;


export const 信用上限 = 100;


export const 贷款最高额 = 20000000;

                  // 2000 万：单笔硬上限（信用分 × 10 万 + 奖励分 × 1 万）
export const 贷款每分额度 = 100000;

                  // 信用分每 1 分 = 10 万（3.1.3 保持不变）
export const 奖励分每分额度 = 10000;

                  // 奖励分每 1 分 = 1 万
export const 贷款小时利率 = 0.0001;

                  // 基础小时利率（阶梯见 贷款阶梯利率：第 N 天 = N × 0.01% / 小时）
export const 贷款最久毫秒 = 14 * 24 * 3600 * 1000;

   // 最久 14 天（3.1.3：3 天 → 14 天）

/* ---------- 3.1.3 贷款阶梯利息 ----------
 * 第 N 天（借出后的第 N 个 24 小时）的小时利率 = N × 0.01%
 *   第 1 天 0.01%/小时 · 第 5 天 0.05%/小时 · 第 10 天 0.1%/小时 · 第 14 天 0.14%/小时
 * 超过 14 天一律按 0.15%/小时，并额外扣 5 点信用分。
 */
export const 贷款阶梯天数 = 14;

                  // 阶梯到第 14 天为止
export const 贷款超期利率 = 0.0015;

                  // 超过 14 天：0.15% / 小时
export const 贷款超期扣分 = 5;

                  // 超过 14 天额外扣 5 点信用分

// 第 N 天的小时利率（N 从 1 开始）；超过阶梯天数返回超期利率
export function 贷款阶梯利率(第几天) {
  const N = Math.max(1, Math.floor(Number(第几天) || 1));
  if (N > 贷款阶梯天数) return 贷款超期利率;
  return N * 贷款小时利率;
}

export const 世界资金初始 = 100000000000;

             // 初始 1000 亿（3.1.4）
export const 捐款加分单位 = 10000;

                   // 每捐 1 万星羽 +1 分
export const 捐款单次加分上限 = 5;


export const 信用等级 = [
  { 下: 0, 上: 0, 名: "失信", 说明: "只保留打工 / 挖矿 / 探索 / 钓鱼 / 卖物品 / 还款，还清后自动恢复" },
  { 下: 1, 上: 19, 名: "起步", 说明: "新号起点，签到 + 刷副本就能稳步上涨" },
  { 下: 20, 上: 49, 名: "良好", 说明: "贷款额度 " + kfmt(20 * 贷款每分额度) + " ~ " + kfmt(49 * 贷款每分额度) },
  { 下: 50, 上: 79, 名: "优秀", 说明: "贷款额度 " + kfmt(50 * 贷款每分额度) + " ~ " + kfmt(79 * 贷款每分额度) },
  { 下: 80, 上: 99, 名: "卓越", 说明: "贷款额度 " + kfmt(80 * 贷款每分额度) + " ~ " + kfmt(99 * 贷款每分额度) },
  { 下: 100, 上: 100, 名: "传奇", 说明: "满分，贷款额度拉满 " + kfmt(贷款最高额) }
];


export function 信用档(分) {
  for (const x of 信用等级) if (分 >= x.下 && 分 <= x.上) return x;
  return 信用等级[1];
}
