// lib/game/translate.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { S, n, 去星甲 } from "./../core/base.mjs?v=v1795259210803";
import { 英文别名, 英文码集 } from "././boss.mjs?v=v1795259210803";

export function 像英文码(m) { return 英文码集.indexOf(S(m).split("|")[0]) >= 0; }


// 2.5.23：战斗动作的中文指令（替代 ba|atk / ba|skill|2 / ba|flee 这类英文回调）
export function 战斗动作中文(b, c) {
  const a = S(b) || "atk";
  if (a === "atk" || a === "普攻" || a === "攻击") return "普攻";
  if (a === "heal" || a === "治疗") return "治疗";
  if (a === "flee" || a === "逃跑") return "逃跑";
  if (a === "skill") return "技能" + (Math.max(1, Math.min(8, Number(c) || 1)));
  return "普攻";
}


// 2.5.55：把 `2h` / `30m` / `1h30m` / `45s` 这类英文时长转成中文（给按钮回调串用）；非时长返回 ""
export function 英文时长转中文(文本) {
  const s = S(文本);
  if (!s || !/[hHmMsS]/.test(s)) return "";
  let 出 = "";
  const re = /([0-9]{1,6})([hHmMsS])/g;
  let m, 命中 = false;
  while ((m = re.exec(s))) {
    const n = Number(m[1]) || 0;
    const u = m[2].toLowerCase();
    出 += n + (u === "h" ? "小时" : (u === "m" ? "分钟" : "秒"));
    命中 = true;
  }
  return 命中 ? 出 : "";
}


// 把按钮可能插入的英文/回调串翻译成中文指令；翻译不了返回原串
export function 译指令(原始) {
  let s = 去星甲(S(原始));
  if (!s) return s;
  s = s.replace(/^(?:xjylact|mkact)[:：]?/i, "");
  if (/^https?:\/\//i.test(s)) return 原始;
  const parts = s.split("|").map((x) => S(x)).filter((x) => x !== "");
  if (parts.length > 1) {
    const [a, b, c] = parts;
    if (英文别名[a]) {
      const 中文 = 英文别名[a];
      if (中文 === "副本列表") return "副本列表#" + (Number(b) || 1);
      if (中文 === "背包") return "背包#" + (Number(b) || 1);
      // 2.5.23：战斗动作改中文
      if (中文 === "战斗" && b) return 战斗动作中文(b, c);
      // 2.5.23：做菜要带 # 与份数
      if (中文 === "做菜") return "做菜#" + (b || "") + "#" + (Number(c) || 1);
      // 2.5.40：农场 —— plant|种子|地块 / plantall|种子 / buy|种子|数量
      if (中文 === "种植") return "种植#" + (b || "") + (c ? "#" + c : "");
      if (中文 === "一键种菜") return "一键种菜#" + (b || "星芽种子");
      if (中文 === "购买") return "购买#" + (b || "") + "#" + (Number(c) || 1);
      if (中文 === "收获" || 中文 === "卖作物" || 中文 === "农场") return 中文;
      if (中文 === "挑战进度" || 中文 === "取消挑战" || 中文 === "队伍挑战" || 中文 === "战斗" || 中文 === "逃跑" || 中文 === "经验" || 中文 === "一键整理" || 中文 === "BOSS列表") return 中文;
      return 中文 + (b ? b : "");
    }
    if (a === "explore") return "探索" + (Number(b) || 5);
    // 2.5.9：修复「一键自动」按钮会发出 `autoatk|10` 这种没翻译的英文串
    // 2.5.55：`autoatk|2h` / `autoatk|30m` / `autoatk|1h30m` → 一键出招2小时 / 30分钟 / 1小时30分钟
    if (a === "autoatk") {
      const 时 = 英文时长转中文(b);
      return "一键出招" + (时 || (Number(b) || 10));
    }
    // 2.5.26：无CD快速出招已移除；映射仍保留，dispatch 收到后会回「已移除」提示
    if (a === "autoatkfast" || a === "fastatk") return "快速出招" + (Number(b) || 10);
    if (a === "dg" || a === "xgstart") return "挑战" + (Number(b) || 101);
    if (a === "upeq") return "升级装备#" + (b || "") + "#" + (Number(c) || 1);
    if (a === "useitem") return "使用#" + (b || "") + "#" + (c || 1);
    if (a === "mmclear") return "一键清空修改" + (b ? "#" + b : "");
    if (a === "shop") return "商店#" + (Number(b) || 1);
    if (a === "dgl") return (c === "boss" ? "BOSS列表#" : "副本列表#") + (Number(b) || 1);
    // 2.5.23：战斗动作改中文（ba|atk → 普攻）
    if (a === "ba") return 战斗动作中文(b || "atk", c);
    // 2.5.21：补全其余英文按钮码的中文翻译（手打 `星甲bet|大|10` 这类也能生效）
    if (a === "bet") return "猜大小#" + (S(b) || "大") + "#" + (S(c) || 10);
    if (a === "donate") return "联盟捐献 " + (Number(b) || 500);
    if (a === "usecoin") return "使用幸运币" + (Number(b) || 1);
    if (a === "cook") return "做菜#" + (b || "") + "#" + (Number(c) || 1);
    if (a === "gold" || a === "goldok") return "兑换金币" + (b ? "#" + b : "");
    if (a === "sp") return "超能力" + (b === "不按" ? "不按" : "按下");
    if (a === "fight") return "匹配挑战";
    if (a === "cookpanel") return "做菜";
    if (a === "baguse") return "使用道具";
    if (a === "teamfight") return "队伍挑战";
    if (a === "goldall") return "兑换金币";
    if (a === "questall") return "一键领奖";
    if (a === "recall") return "撤回上一条";
    if (a === "xgpanel") return "战斗";
    if (a === "xgflee") return "逃跑";
    if (a === "bagtidy") return "一键整理";
    if (a === "acauto" || a === "acprogress" || a === "accancel") return "一键挑战" + (Number(b) || 101);
    if (a === "addpt") return "加点#" + (b || "") + (c ? "#" + c : "");
    // 3.1.21：宠物 / 金库系列按钮码补全中文翻译（3.1.14 加金库时漏了，导致按钮填入英文 petvaultsw|on）
    if (a === "petvaultsw") return "宠物金库开关 " + (S(b) || "on");
    if (a === "petvault") return "宠物金库";
    if (a === "petbank") return "宠物存钱" + (b ? " " + b : "");
    if (a === "petallow") return "宠物允许购买 " + (S(b) || "on");
    if (a === "petseedpref") return "宠物播种偏好 " + [b, c].filter(Boolean).join(" ");
    if (a === "petbuyfood") return "宠物买食 " + [b, c].filter(Boolean).join(" ");
    if (a === "petwork") return "宠物出战" + (b ? " " + b : "");
    if (a === "petfeed") return "宠物喂食" + (b ? " " + b : "");
    if (a === "petadopt") return "宠物领养" + (b ? " " + b : "");
    if (a === "petautofeed") return "宠物自动喂" + (b ? " " + b : "");
    if (a === "petpanel" || a === "pethome" || a === "pethelp" || a === "petrest" || a === "pethomebuild") {
      return ({ petpanel: "宠物面板", pethome: "宠物小屋", pethelp: "宠物帮助", petrest: "宠物休息", pethomebuild: "建造小屋" })[a];
    }
  }
  const 单 = parts[0] || s;
  if (英文别名[单]) return 英文别名[单];
  // 2.5.21：单词形式的英文按钮码（没有 | 分隔）
  if (s === "bagtidy") return "一键整理";
  if (s === "baguse") return "使用道具";
  if (s === "teamfight") return "队伍挑战";
  if (s === "questall") return "一键领奖";
  if (s === "recall") return "撤回上一条";
  if (s === "goldall") return "兑换金币";
  if (s === "cookpanel") return "做菜";
  if (s === "xgpanel") return "战斗";
  if (s === "xgflee") return "逃跑";
  if (s === "autodetail") return "出招详情";
  // 3.1.21：宠物系列单词码
  if (s === "petpanel") return "宠物面板";
  if (s === "pethelp") return "宠物帮助";
  if (s === "pethome") return "宠物小屋";
  if (s === "pethomebuild") return "建造小屋";
  if (s === "petrest") return "宠物休息";
  if (s === "petvault") return "宠物金库";
  // 2.6.0 修复：`autostop`（⚡停止出招按钮）原来没有翻译 → 填入 `星甲autostop`，
  //   dispatch 无人接 → 自动出招停不下来，还每 2 秒继续扣 1 张自动卡。
  if (s === "autostop") return "停止出招";
  if (s === "autoatk") return "一键出招" + 10;
  if (s === "autoatkfast" || s === "fastatk") return "快速出招" + 10;
  // 2.5.28：天下楼按钮
  if (s === "tower" || s === "towerpanel") return "天下楼";
  if (s === "towerfight" || s === "towerstart") return "天下楼挑战";
  // 2.5.32：更新公告按钮
  if (s === "changelog" || s === "clog" || s === "news") return "更新公告";
  // 2.2.6：剥掉前缀后可能只剩泛化词，做一次归一
  if (s === "系统") return "菜单";
  return 原始;
}
