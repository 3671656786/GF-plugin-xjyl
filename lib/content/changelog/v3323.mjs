// lib/content/changelog/v3323.mjs —— 3.3.23 更新公告
export const 日志3323 = [
  {
    版本: "3.3.23",
    标题: "3.3.23 · 修复「回复耗时」不显示",
    正文: [
      "修复 v3.3.22 的 bug：消息底部只显示「响应用时」，新增的「回复耗时」一直不出现。",
      "**根因**：取 QQ 消息发送时间时只读 `event.d.timestamp`，而真实事件的时间戳在顶层 `event.timestamp`（项目其它模块一直用顶层字段）。事件带 `d` 却没有 `d.timestamp` 时取不到，回复耗时就被跳过。",
      "**修复**：改为依次兼容 `event.timestamp` / `event.d.timestamp` / `event.data.timestamp`，任一命中即用；仍保留 0~60 秒与 5 分钟窗口校验，异常时不显示、不产生离谱数字。现在两行耗时会同时正常显示。"
    ].join("\n")
  }
];
