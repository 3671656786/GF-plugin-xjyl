// lib/compat.mjs —— 旧版导出别名（其它插件/旧代码按老名字引用时用）

import { btn, row, segMd, segText } from "./core/qq.mjs?v=v1795534610437";

export {
  row as 行,
  btn as 钮,
  segMd as 段_md,
  segText as 段_文本
};
