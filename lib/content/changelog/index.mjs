// lib/content/changelog/index.mjs —— 更新公告聚合（需求 8：拆成多个小文件，放插件子文件夹）
import { 日志311 } from "./v311.mjs?v=v1795100379785";
import { 日志310 } from "./v310.mjs?v=v1795100379785";
import { 日志300 } from "./v300.mjs?v=v1795100379785";
import { 日志29 } from "./v29.mjs?v=v1795100379785";

// 数组第一条 = 最新
export const 更新日志 = [...日志311, ...日志310, ...日志300, ...日志29];
