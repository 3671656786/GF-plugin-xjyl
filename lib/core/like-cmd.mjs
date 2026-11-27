// lib/core/like-cmd.mjs —— 3.3.5：判断一条文本是否「像本插件指令」
// 用于「免前缀」群：无前缀的普通聊天不要进 dispatch（否则会被开头的绑定检查拦下弹「请先绑定账号」）。
// 从完整菜单组 / 完全菜单组动态提取命令主体，避免手写清单与指令分支漂移。
import { S } from "./base.mjs?v=v1795793040169";
import { 完整菜单组, 完全菜单组 } from "./../ui/menu.mjs?v=v1795793040169";

function 提取词表() {
  const set = new Set();
  const 收 = (cmd) => {
    let s = S(cmd).trim().replace(/^星甲/, "");
    if (!s) return;
    // 拆掉参数占位与多个写法：探索5 / 探索10、挑战#N、背包（...）、技能#1~8
    s = s.split("#")[0].split("（")[0].split("(")[0];
    for (const 段 of s.split("/")) {
      const w = 段.trim().replace(/[0-9~～]+$/, "").trim();   // 去掉尾部数字（探索5→探索）
      if (w) set.add(w);
    }
  };
  for (const g of (Array.isArray(完整菜单组) ? 完整菜单组 : [])) for (const it of (g.条 || [])) if (Array.isArray(it)) 收(it[0]);
  for (const g of (Array.isArray(完全菜单组) ? 完全菜单组 : [])) for (const it of (g.条 || [])) if (Array.isArray(it)) 收(it[0]);
  // 常见动态/简写指令（菜单里写法不完全覆盖的）
  for (const w of ["签到", "属性", "背包", "菜单", "帮助", "指南", "积分", "余额", "面板", "详情", "列表", "帮助", "取消", "停止", "开启", "关闭"]) set.add(w);
  return set;
}

const 词表 = 提取词表();

// 是否像指令：去掉星甲前缀、参数分隔符后，命令主体在词表里（或整体就是一个已知词）
export function 像指令(text) {
  let s = S(text).trim().replace(/^星甲[\s#：:]*/, "");
  if (!s) return true;                                  // 空串按菜单处理
  // 取开头命令词：中文/字母连续段（到第一个 # 或空格或数字参数前）
  const m = s.match(/^([\u4e00-\u9fa5A-Za-z]+)/);
  if (!m) return /^https?:\/\//i.test(s);               // 纯链接/符号：交给解析逻辑
  const 词 = m[1];
  if (词表.has(词)) return true;
  // 词表条目可能是「探索」「挑战」这类，消息写成「探索5」「挑战3」已在上面正则去掉数字
  for (const w of 词表) if (w && (s === w || s.startsWith(w))) return true;
  return false;
}

export { 词表 };
