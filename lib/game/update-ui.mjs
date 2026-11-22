/* ============================================================
 * lib/game/update-ui.mjs —— 在线更新的聊天交互（3.1.6）
 * ------------------------------------------------------------
 * 流程：
 *   ① 主人发 `星甲更新插件` → 查最新 Release → 显示版本对比 +
 *      【立即更新】按钮（聊天栏二次确认）
 *   ② 主人点【立即更新】→ 再提示「真的要现在更新吗」+【确认更新】
 *   ③ 主人点【确认更新】→ 下载 → 校验 → 备份 → 覆盖 → 回复结果 → 重载
 *
 * 权限：只有主人（最高权限者 / 主人名单）能执行更新；其他人只能看状态。
 * 下载源：4 个源可自选（每人网络环境不同），用 `星甲更新源 <序号|名称>` 切换。
 * 为什么要点两次：更新会立刻替换插件文件并重载机器人，属于不可逆操作。
 * ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { actBtn, btn, reply, row } from "./../core/qq.mjs?v=v1795356168697";
import { 版本, dget, dset } from "./../core/base.mjs?v=v1795356168697";
import { isOwner, 读控制台配置, 写控制台配置 } from "./../admin/admin.mjs?v=v1795356168697";
import { 查发布, 查最新版本, 查发布列表, 执行更新, 比较版本, 下载源表, 取源, 默认源键, 测所有源, 下载zip, 校验包, 设令牌, 读令牌 } from "./update.mjs?v=v1795356168697";
import { 解压到内存 } from "./../core/unzip.mjs?v=v1795356168697";
import { 灰块 } from "./cook.mjs?v=v1795356168697";

const 源存档 = "系统/更新源.json";

// 3.1.12：自动更新功能真正可用的最低版本 —— 低于它的版本在线更新链路不完善，
//   回退过去之后可能无法再用「星甲更新插件」把自己救回来（要手动装包）。
const 最低推荐版本 = "3.1.12";

// 某版本是否"不建议回退"（低于最低推荐版本）
function 不建议回退(目标版本) {
  return 比较版本(目标版本, 最低推荐版本) < 0;
}

// 3.1.8：把配置里的 GitHub 令牌注入到 update.mjs（有则认证请求，解除 60 次/小时限流）
function 应用令牌(ctx) {
  try {
    const c = 读控制台配置(ctx);
    设令牌(c && c.GitHub令牌 ? String(c.GitHub令牌) : "");
  } catch (e) { 设令牌(""); }
}

// 单行灰色（QQ 引用块样式），用于参数/时间等次要信息
function 灰字(s) { return "> " + String(s === undefined || s === null ? "" : s); }


// ---- 下载源偏好（存 dataPath，不随插件更新被覆盖）----
function 读源(ctx) {
  try {
    const v = dget(ctx, 源存档, "当前", "");
    return 取源(String(v || "")) ? String(v) : 默认源键;
  } catch (e) { return 默认源键; }
}

export function 写源(ctx, 键) {
  try { dset(ctx, 源存档, "当前", 键); } catch (e) { /* ignore */ }
}

export function 当前源(ctx) {
  return 取源(读源(ctx));
}


// 插件自己的目录（覆盖安装的目标）
export function 取插件目录(ctx) {
  return ctx && ctx.pluginPath ? String(ctx.pluginPath) : "";
}


/**
 * 安装源目录 `plugins/<插件ID>`
 * 宿主的多账号机制会把插件复制到 `plugins_two/<账号>/<插件ID>` 运行，并且**每次重载
 * 都从安装源强制覆盖到运行副本**。所以更新必须连安装源一起写，否则重载后会被
 * 旧代码覆盖回去（表现就是「更新没生效 / 降级降不下来」）。
 * 拿不到就返回空串，退化为只写运行副本。
 */
export function 取源目录(ctx) {
  const id = String((ctx && ctx.pluginName) || "GF-plugin-xjyl");

  // ① 框架环境里的项目根目录 + plugins/<插件ID> —— 最可靠。
  //    宿主把项目根放在 ctx.frameworkEnv.projectRoot（PATHS.root），安装源恒等于
  //    <root>/plugins/<插件ID>，与账号数、插件数都无关。
  try {
    const fe = ctx && ctx.frameworkEnv;
    const 根 = fe && fe.projectRoot ? String(fe.projectRoot) : "";
    if (根) {
      const p = path.join(根, "plugins", id);
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* 走下一级 */ }

  // ② 正规路径：pluginManager.getPluginPath() + 插件ID
  //    注意：多账号宿主（AccountPluginManagerBase）**没有**这个方法，
  //    所以这里必须判空，不能假定它存在。
  try {
    const pm = ctx && ctx.pluginManager;
    const 根 = pm && typeof pm.getPluginPath === "function" ? String(pm.getPluginPath() || "") : "";
    if (根 && id) {
      const p = path.join(根, id);
      if (fs.existsSync(p) && path.resolve(p) !== path.resolve(String(ctx.pluginPath || ""))) return p;
    }
  } catch (e) { /* 走下一级 */ }

  // ③ 兜底：从「运行副本」路径反推安装源
  //    运行副本结构是 plugins_two/<账号>/<插件ID>，安装源是 plugins/<插件ID>。
  //    反推要点：**账号段要去掉**（只把 plugins_two 换成 plugins 会多留一层账号目录，
  //    得到 plugins/<账号>/<插件ID> 这种不存在的路径），而且换完必须校验存在。
  try {
    const 运行 = String((ctx && ctx.pluginPath) || "");
    if (!运行) return "";
    const 段 = 运行.split(/[\\/]+/).filter(Boolean);
    const i = 段.lastIndexOf("plugins_two");
    if (i >= 0) {
      // plugins_two/<账号>/<插件ID> → plugins/<插件ID>
      const 新段 = 段.slice(0, i).concat(["plugins", id]);
      const p = 新段.join(path.sep);
      if (fs.existsSync(p)) return p;
      // 插件ID 可能与目录名不一致（改名过的老目录），再试一次用目录名本身
      const 名 = 段[段.length - 1];
      const p2 = 段.slice(0, i).concat(["plugins", 名]).join(path.sep);
      if (名 && fs.existsSync(p2)) return p2;
    }
    // ④ 运行副本本身就在 plugins/ 下（宿主没有多账号机制）
    const j = 段.lastIndexOf("plugins");
    if (j >= 0 && 段.length === j + 2 && fs.existsSync(运行)) return 运行;
  } catch (e) { /* ignore */ }
  return "";
}


// 非主人：只能查看状态
async function 无权限提示(ctx, t) {
  await reply(ctx, t, [
    "🔒 **只有主人可以更新插件**",
    "",
    "当前在线版本：**v" + 版本 + "**",
    "",
    "如果你就是主人，请让管理员把你的 openid 加进「主人名单」。"
  ].join("\n"), {
    标题: "🔄 插件更新",
    行组: [row(btn("upn1", "更新公告", "更新公告"), btn("upn2", "菜单", "菜单"))]
  });
}


// ① 发起更新：查版本 + 展示对比 + 第一次确认
export async function 更新插件(ctx, t, u, ev, 目标版本) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const 源 = 当前源(ctx);
  const 查 = await 查发布(目标版本);
  if (!查.ok) {
    await reply(ctx, t, [
      "🔍 **检查更新失败**",
      "",
      查.原因,
      "",
      灰块([
        "关掉代理后点【重新检查】即可",
        "也可以到 GitHub 手动下载",
      ]),
      "",
      "https://github.com/3671656786/GF-plugin-xjyl/releases"
    ].join("\n"), {
      标题: "🔄 插件更新",
      行组: [row(btn("up1", "重新检查", "更新插件"), btn("up2", "切换下载源", "更新源"), btn("up3", "版本列表", "更新版本"))]
    });
    return;
  }
  const 比较 = 比较版本(查.版本, 版本);
  if (比较 === 0) {
    await reply(ctx, t, [
      "✅ **已经是最新版本**",
      "",
      "当前版本 **v" + 版本 + "** · 最新版本 **v" + 查.版本 + "**",
      "",
      灰块([
        "下载源：" + 源.名 + "（" + 源.地区 + "）",
        查.发布时间 ? "发布时间：" + 查.发布时间.slice(0, 10) : "",
      ].filter(Boolean)),
      "",
      "想看以前的版本？点【版本列表】可以查看公告或装回旧版本。"
    ].join("\n"), {
      标题: "🔄 插件更新",
      行组: [row(btn("up4", "版本列表", "更新版本"), btn("up5", "切换下载源", "更新源"), btn("up6", "菜单", "菜单"))]
    });
    return;
  }
  const 是降级 = 比较 < 0;
  await reply(ctx, t, [
    是降级 ? "⬇️ **准备回退到旧版本**" : "🆕 **发现新版本**",
    "",
    "当前版本 **v" + 版本 + "** → 目标版本 **v" + 查.版本 + "**",
    查.标题 ? 灰字("标题：" + String(查.标题).replace(/^v[\d.]+\s*·?\s*/, "")) : "",
    "",
    灰块([
      查.发布时间 ? "发布时间：" + 查.发布时间.slice(0, 10) : "",
      "下载源：" + 源.名 + "（" + 源.地区 + "）",
      查.资产大小 ? "包大小：" + Math.round(查.资产大小 / 1024) + " KB" : "",
      是降级 ? (不建议回退(查.版本)
        ? "⚠️ **不建议回退到 v" + 最低推荐版本 + " 之前的版本** —— 那些版本的在线更新链路不完善，回退后可能没法再用「星甲更新插件」把自己更新回来（要手动装包）"
        : "⚠️ 回退到旧版本可能缺少新功能，确认要想清楚") : "",
    ].filter(Boolean)),
    "",
    "⚠️ **更新会替换插件文件并自动重载机器人**，聊天会短暂中断，运行数据**不会丢失**。",
    "",
    "确认要" + (是降级 ? "回退" : "更新") + "吗？点下面【立即" + (是降级 ? "回退" : "更新") + "】进入最后一步确认。"
  ].join("\n"), {
    标题: "🔄 插件更新",
    行组: [
      row(actBtn("upgo", "⬆️ 立即" + (是降级 ? "回退" : "更新"), "updateconfirm|" + 查.版本), actBtn("upno1", "看公告", "updateann|" + 查.版本), btn("upno2", "版本列表", "更新版本")),
      row(btn("upmenu", "菜单", "菜单")),
    ]
  });
}


// 版本列表：列出所有历史版本（可看公告、可装指定版本）
export async function 更新版本(ctx, t, u, ev, 页) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const 列 = await 查发布列表(30);
  if (!列.ok) {
    await reply(ctx, t, [
      "🔍 **获取版本列表失败**",
      "",
      列.原因,
      "",
      灰块(["可以稍后重试，或直接开 GitHub Releases 页面"])
    ].join("\n"), {
      标题: "📦 版本列表",
      行组: [row(btn("uv1", "重试", "更新版本"), btn("uv2", "菜单", "菜单"))]
    });
    return;
  }
  const 全部 = 列.列表;
  const 每页 = 8;
  const 总页 = Math.max(1, Math.ceil(全部.length / 每页));
  const 页码 = Math.max(1, Math.min(总页, Math.floor(Number(页) || 1)));
  const 本页 = 全部.slice((页码 - 1) * 每页, 页码 * 每页);

  const 行 = [
    "📦 **历史版本**（共 " + 全部.length + " 个 · 第 " + 页码 + "/" + 总页 + " 页）",
    "",
    灰块([
      "当前运行：v" + 版本,
      "⚠️ 标「不建议」的版本低于 v" + 最低推荐版本 + "，在线更新链路不完善",
    ]),
    ""
  ];
  本页.forEach((x, i) => {
    const 序号 = (页码 - 1) * 每页 + i + 1;
    const 标记 = x.版本 === 版本 ? " ← 当前" : "";
    const 类型 = 比较版本(x.版本, 版本) > 0 ? "🆕" : "📄";
    const 警示 = (x.版本 !== 版本 && 不建议回退(x.版本)) ? " ⚠️不建议" : "";
    行.push(序号 + ". " + 类型 + " **v" + x.版本 + "**" + 标记 + 警示 + (x.标题 ? " · " + String(x.标题).replace(/^v[\d.]+\s*·?\s*/, "") : ""));
    行.push("   " + 灰字("发布 " + (x.发布时间 ? x.发布时间.slice(0, 10) : "未知") + (x.有包 ? "" : " · 无压缩包") + (警示 ? " · 低于 v" + 最低推荐版本 + "，不建议回退" : "")));
  });

  const 行组 = [];
  // 每行最多 4 个按钮：查看公告 + 装这个版本
  const 按钮 = [];
  本页.forEach((x, i) => {
    const 序号 = (页码 - 1) * 每页 + i + 1;
    按钮.push(actBtn("uvc" + 序号, "v" + x.版本 + " 公告", "updateann|" + x.版本));
  });
  for (let i = 0; i < 按钮.length; i += 4) 行组.push(row.apply(null, 按钮.slice(i, i + 4)));

  const 装按钮 = [];
  本页.forEach((x, i) => {
    if (!x.有包 || x.版本 === 版本) return;
    const 序号 = (页码 - 1) * 每页 + i + 1;
    装按钮.push(btn("uvi" + 序号, (不建议回退(x.版本) ? "⚠ 装 v" : "装 v") + x.版本, "更新到 " + x.版本));
  });
  for (let i = 0; i < 装按钮.length; i += 4) 行组.push(row.apply(null, 装按钮.slice(i, i + 4)));

  const 翻页 = [];
  if (页码 > 1) 翻页.push(btn("uvp" + (页码 - 1), "⬅ 上一页", "更新版本#" + (页码 - 1)));
  if (页码 < 总页) 翻页.push(btn("uvp" + (页码 + 1), "下一页 ➡", "更新版本#" + (页码 + 1)));
  翻页.push(btn("uvhome", "回最新", "更新插件"), btn("uvmenu", "菜单", "菜单"));
  行组.push(row.apply(null, 翻页));

  await reply(ctx, t, 行.join("\n"), { 标题: "📦 版本列表", 行组: 行组 });
}


// 看某个版本的更新公告
export async function 更新公告某版本(ctx, t, u, ev, 版本号) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const v = String(版本号 || "").replace(/^v/, "").trim();
  if (!v) {
    await reply(ctx, t, "用法：`星甲更新公告v 3.1.5`", {
      标题: "📄 版本公告",
      行组: [row(btn("ua1", "版本列表", "更新版本"), btn("ua2", "菜单", "菜单"))]
    });
    return;
  }
  const 查 = await 查发布(v);
  if (!查.ok) {
    await reply(ctx, t, ["❌ **查不到 v" + v + "**", "", 查.原因].join("\n"), {
      标题: "📄 版本公告",
      行组: [row(btn("ua3", "版本列表", "更新版本"), btn("ua4", "菜单", "菜单"))]
    });
    return;
  }
  // GitHub 的 release body 就是当时的更新公告
  const 正文 = String(查.说明 || "").trim();
  const 行 = [
    "**v" + 查.版本 + "**" + (查.标题 ? " · " + String(查.标题).replace(/^v[\d.]+\s*·?\s*/, "") : ""),
    "",
    正文 || "（这个版本没有写公告）",
    "",
    灰块([
      "发布时间：" + (查.发布时间 ? 查.发布时间.slice(0, 10) : "未知"),
      查.资产大小 ? "包大小：" + Math.round(查.资产大小 / 1024) + " KB" : "这个版本没有压缩包",
    ].filter(Boolean))
  ];
  const 行组 = [row(btn("ua5", "版本列表", "更新版本"), btn("ua6", "回最新", "更新插件"), btn("ua7", "菜单", "菜单"))];
  if (查.版本 !== 版本) {
    行组.unshift(row(btn("ua8", "装这个版本", "更新到 " + 查.版本)));
  }
  await reply(ctx, t, 行.join("\n"), { 标题: "📄 v" + 查.版本 + " 更新公告", 行组: 行组 });
}


// ② 第一次确认之后：再要一次明确确认
export async function 更新确认(ctx, t, u, ev, 目标版本) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const 源 = 当前源(ctx);
  const 查 = await 查发布(目标版本);
  if (!查.ok) {
    await reply(ctx, t, ["🔍 **再次检查失败**", "", 查.原因].join("\n"), {
      标题: "🔄 插件更新",
      行组: [row(btn("up7", "重试", "更新插件"), btn("up8", "换个源", "更新源"), btn("up9", "菜单", "菜单"))]
    });
    return;
  }
  if (查.版本 === 版本) {
    await reply(ctx, t, "✅ 当前已经是 v" + 版本 + "，不需要再装了。", {
      标题: "🔄 插件更新",
      行组: [row(btn("up10", "版本列表", "更新版本"), btn("up11", "菜单", "菜单"))]
    });
    return;
  }
  const 是降级 = 比较版本(查.版本, 版本) < 0;
  await reply(ctx, t, [
    "⚠️ **最后确认**",
    "",
    "即将把插件从 **v" + 版本 + "** " + (是降级 ? "回退" : "更新") + "到 **v" + 查.版本 + "**。",
    "",
    灰块([
      "下载源：" + 源.名 + "（" + 源.地区 + "）",
      查.资产大小 ? "包大小：" + Math.round(查.资产大小 / 1024) + " KB" : "",
    ].filter(Boolean)),
    "",
    "· 会先自动备份当前插件目录（出问题可回滚）",
    "· 完成后机器人**自动重载**，几秒后恢复",
    "· 运行数据不会丢失",
    是降级 ? "· ⚠️ 回退后新版本的功能会消失" : "",
    是降级 && 不建议回退(查.版本)
      ? "· ⚠️ **v" + 查.版本 + " 低于 v" + 最低推荐版本 + "，在线更新链路不完善；回退后可能只能手动装回新版**"
      : "",
    "",
    "确定请点【确认" + (是降级 ? "回退" : "更新") + "】；还没想好就点【取消】。"
  ].filter(x => x !== "").join("\n"), {
    标题: "⚠️ 确认" + (是降级 ? "回退" : "更新") + "到 v" + 查.版本,
    行组: [row(actBtn("upok", "✅ 确认" + (是降级 ? "回退" : "更新"), "updatedo|" + 查.版本), btn("upcancel", "取消", "菜单"))]
  });
}


// ③ 真正执行：下载 → 校验 → 备份 → 覆盖 → 回复 → 重载
export async function 更新执行(ctx, t, u, ev, 目标版本) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const 插件目录 = 取插件目录(ctx);
  if (!插件目录) {
    await reply(ctx, t, "❌ 找不到插件目录，无法在线更新。请到 GitHub 手动下载安装。", {
      标题: "🔄 插件更新",
      行组: [row(btn("up11", "菜单", "菜单"))]
    });
    return;
  }
  const 源 = 当前源(ctx);
  const 源目录 = 取源目录(ctx);
  // 自检：安装源和运行目录是同一个路径 = 识别失败（双写退化成了只写运行副本，
  // 重载必被旧代码覆盖）。这种情况必须**明确拦下**，不能再默默写完假装成功。
  const 源识别失败 = !源目录 || (path.resolve(源目录) === path.resolve(插件目录));
  await reply(ctx, t, "⏳ 正在通过 **" + 源.名 + "** 下载并安装 **v" + (目标版本 || "最新版") + "** …\n（下载 + 校验 + 备份 + 覆盖，约需 10~60 秒）", {
    标题: "🔄 正在更新",
    无耗时: true
  });

  // 把「目标 / 源 / 两个目录」记进日志 —— 真实环境出问题时要能一眼看出写对地方没有
  const 记日志 = (s) => { try { ctx.logger && ctx.logger.info && ctx.logger.info(s); } catch (e) { /* ignore */ } };
  记日志("[xjyl] 更新开始：目标 v" + (目标版本 || "最新") + " · 源 " + 源.名 +
    " · 运行目录 " + 插件目录 + " · 安装源 " + (源目录 || "（未识别，只写运行副本）") +
    (源识别失败 ? " · ⚠️安装源识别失败，本次更新无法保证生效" : ""));

  if (源识别失败) {
    await reply(ctx, t, [
      "❌ **无法安全更新**：识别不到插件的安装源目录",
      "",
      "宿主会在每次重载时用**安装源**（`plugins/<插件ID>/`）覆盖运行副本，" +
        "所以只写运行副本的话，更新完会被旧代码覆盖回去。",
      "",
      灰块([
        "运行目录：" + 插件目录,
        "安装源：未识别",
        "",
        "这通常意味着宿主换了目录结构。请到 GitHub 手动下载安装新版：",
        "https://github.com/3671656786/GF-plugin-xjyl/releases",
      ]),
    ].join("\n"), {
      标题: "🔄 插件更新失败",
      行组: [row(btn("up12", "换个源重试", "更新源"), btn("up13", "菜单", "菜单"))]
    });
    return;
  }

  const r = await 执行更新(插件目录, 目标版本, 源.键, 源目录);
  记日志("[xjyl] 更新结果：" + (r.ok ? "成功 v" + r.新版本 : "失败@" + r.阶段 + "：" + String(r.原因).replace(/\n/g, " / ")));
  if (!r.ok) {
    await reply(ctx, t, [
      "❌ **更新失败**（" + r.阶段 + "）",
      "",
      r.原因,
      "",
      灰块([
        "当前版本仍是 v" + 版本 + "，可正常使用；失败的写入已回滚到备份",
        ...(Array.isArray(r.试过) ? r.试过.map((x) => x.源 + "：" + x.原因) : []),
      ]),
      "",
      "GitHub 手动下载：https://github.com/3671656786/GF-plugin-xjyl/releases"
    ].join("\n"), {
      标题: "🔄 插件更新失败",
      行组: [row(btn("up12", "换个源重试", "更新源"), btn("up13", "再试一次", "更新插件"), btn("up14", "菜单", "菜单"))]
    });
    return;
  }

  // 把「到底写到了哪、写后磁盘上是什么版本」摊开给主人看 —— 之前只有一句「更新完成」，
  //   分不清是真装上了还是被宿主用旧副本覆盖回去了。
  const 回读行 = (r.回读 || []).map((x) => x.角色 + "：磁盘 v" + (x.版本 || "未知") + (x.版本 === r.新版本 ? " ✓" : " ✗"));
  await reply(ctx, t, [
    "✅ **更新完成**",
    "",
    "**v" + r.旧版本 + "** → **v" + r.新版本 + "**",
    "已写入 " + r.写了 + " 个文件" + (r.源 ? "（下载源：" + r.源 + "）" : ""),
    r.换过源 ? 灰字("ℹ️ " + String(r.提示 || "").replace(/\n/g, " ")) : "",
    "",
    "**写入位置**（都已校验版本）",
    灰块(回读行),
    "",
    灰块([
      "源目录 = 宿主重载时的复制来源，不写它会被旧代码覆盖回去",
      "备份：见下方路径，出问题可手动回滚",
    ]),
    "备份：`" + String(r.备份 || "").replace(/\n/g, "`\n`") + "`",
    "",
    "正在重载机器人，几秒后恢复…"
  ].join("\n"), {
    标题: "🔄 插件已更新",
    无耗时: true
  });

  // 延迟重载：先让上面的消息发出去，再让宿主重载本插件
  重载自己(ctx, 2500);
}


// 下载源选择（列出 4 个源 + 一键 Ping 测延迟）
export async function 更新源(ctx, t, u, ev, 参数) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const 当前 = 读源(ctx);
  const p = String(参数 || "").trim();

  // 带参数 → 直接切换
  if (p) {
    const 序号 = Number(p);
    let 目标 = null;
    if (序号 >= 1 && 序号 <= 下载源表.length) 目标 = 下载源表[序号 - 1];
    else {
      const 匹配 = 下载源表.find(x => x.键 === p || x.名.indexOf(p) >= 0 || String(序号Of(x)) === p);
      if (匹配) 目标 = 匹配;
    }
    if (!目标) {
      await reply(ctx, t, "❌ 没找到这个下载源。发 `星甲更新源` 看列表。", {
        标题: "🌐 下载源",
        行组: [row(btn("ups1", "下载源列表", "更新源"), btn("ups2", "菜单", "菜单"))]
      });
      return;
    }
    写源(ctx, 目标.键);
    await reply(ctx, t, [
      "🌐 下载源已切换为 **" + 目标.名 + "**（" + 目标.地区 + "）",
      "",
      目标.说明,
      "",
      "下次更新会用这个源（**固定通道**，不会自动换源）。",
      "发 `星甲更新插件` 开始更新。"
    ].join("\n"), {
      标题: "🌐 下载源",
      行组: [row(btn("ups3", "开始更新", "更新插件"), actBtn("ups4", "一键 Ping", "updateping"), btn("ups5", "菜单", "菜单"))]
    });
    return;
  }

  // 不带参数 → 列出 4 个源
  const 行组 = [];
  const 按钮 = [];
  下载源表.forEach((x, i) => {
    const 标记 = x.键 === 当前 ? " ✅ 当前" : "";
    按钮.push(btn("ups" + i, (i + 1) + "." + x.名 + 标记, "更新源#" + (i + 1)));
  });
  行组.push(row.apply(null, 按钮.slice(0, 2)));
  行组.push(row.apply(null, 按钮.slice(2, 4)));
  行组.push(row(btn("upsx", "开始更新", "更新插件"), actBtn("upsy", "一键 Ping", "updateping"), actBtn("upsw", "测试所选", "updatetest")));
  行组.push(row(btn("upsz", "菜单", "菜单")));

  await reply(ctx, t, [
    "🌐 **选择下载源**（每人网络环境不同，不合适就换一个）",
    "",
    下载源表.map((x, i) => (i + 1) + ". **" + x.名 + "**（" + x.地区 + "）" + (x.键 === 当前 ? " ✅ 当前" : "") + " — " + x.说明).join("\n"),
    "",
    "发 `星甲更新源 1~4` 或直接点下面的按钮切换。",
    "不确定选哪个？点【一键 Ping】测延迟选最快的；点【测试所选】完整下载一次验证这个源真能用。",
    "",
    灰块(["下载会优先用你选的源；万一它暂时不可用（比如镜像还没同步到最新版），会自动换下一个可用源并告诉你"]),
    "",
    "当前在线版本 **v" + 版本 + "**"
  ].join("\n"), {
    标题: "🌐 下载源",
    行组: 行组
  });
}


// 一键 Ping：并发测所有源的延迟，按快到慢排序
export async function 更新测速(ctx, t, u, ev) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const 当前 = 读源(ctx);
  await reply(ctx, t, "⏱ 正在测速（4 个源并发测试，约 5~10 秒）…", {
    标题: "🌐 测速",
    无耗时: true
  });
  const 结果 = await 测所有源();
  const 行 = 结果.map((r, i) => {
    const 标记 = 下载源表.find(x => x.名 === r.源);
    const 是当前 = 标记 && 标记.键 === 当前;
    const 图标 = r.通 ? "🟢" : "🔴";
    return (i + 1) + ". " + 图标 + " **" + r.源 + "** — " + (r.通 ? "**" + r.毫秒 + " ms**" : r.说明) + (是当前 ? " ✅ 当前" : "");
  });
  const 可用 = 结果.filter(r => r.通);
  const 最快 = 可用[0];
  const 最快源 = 最快 ? 下载源表.find(x => x.名 === 最快.源) : null;
  await reply(ctx, t, [
    "⏱ **测速结果**（按延迟从低到高）",
    "",
    行.join("\n"),
    "",
    最快源
      ? "🏆 最快：**" + 最快源.名 + "**（" + 最快.毫秒 + " ms）" + (最快源.键 === 当前 ? " · 已经是当前源" : " · 发 `星甲更新源 " + (序号Of(最快源)) + "` 切过去")
      : "⚠️ 这次一个源都没通。检查网络 / 代理，或稍后再试。",
    "",
    "**下载固定走你选的源**，不会自动换源。"
  ].join("\n"), {
    标题: "🌐 测速结果",
    行组: [
      row(btn("upg1", "源列表", "更新源"), btn("upg2", "开始更新", "更新插件"), btn("upg3", "菜单", "菜单")),
      最快源 && 最快源.键 !== 当前 ? row(btn("upg4", "切到最快的", "更新源#" + 序号Of(最快源))) : row(actBtn("upg5", "重新测速", "updateping"))
    ]
  });
}


// 测试当前选中的源能否真正下载（完整走一遍，验证这个源可用）
export async function 更新测所选(ctx, t, u, ev) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  应用令牌(ctx);
  const 源 = 当前源(ctx);
  await reply(ctx, t, "🧪 正在测试当前源 **" + 源.名 + "**（完整下载一次，约 5~30 秒）…", {
    标题: "🧪 测试所选源",
    无耗时: true
  });
  const 查 = await 查最新版本();
  if (!查.ok) {
    await reply(ctx, t, "❌ 取版本信息失败：" + 查.原因, {
      标题: "🧪 测试所选源",
      行组: [row(btn("upz1", "换个源", "更新源"), btn("upz2", "菜单", "菜单"))]
    });
    return;
  }
  const 下 = await 下载zip(源.键, 查);
  if (!下.ok) {
    await reply(ctx, t, [
      "❌ **当前源不可用**：" + 源.名,
      "",
      下.原因,
      "",
      "换个源试试：`星甲更新源`（可以先 Ping 测延迟）"
    ].join("\n"), {
      标题: "🧪 测试所选源",
      行组: [row(actBtn("upz3", "一键 Ping", "updateping"), btn("upz4", "换源", "更新源"), btn("upz5", "菜单", "菜单"))]
    });
    return;
  }
  const 解 = 解压到内存(下.内容);
  const 校 = 解.ok ? 校验包(解.条目, 查.版本) : { ok: false, 原因: 解.原因 };
  await reply(ctx, t, 校.ok
    ? [
      "✅ **当前源可用**：" + 源.名,
      "",
      "完整下载 + 解压 + 校验都通过（" + Math.round(下.内容.length / 1024) + " KB，v" + 查.版本 + "）",
      "通道：" + (下.通道 || "-"),
      "",
      "可以放心更新了。"
    ].join("\n")
    : [
      "⚠️ 下载成功但**校验没通过**：" + 源.名,
      "",
      校.原因,
      "",
      "为安全起见已拒绝安装，请换一个源。"
    ].join("\n"), {
    标题: "🧪 测试所选源",
    行组: [row(btn("upz6", "开始更新", "更新插件"), actBtn("upz7", "一键 Ping", "updateping"), btn("upz8", "菜单", "菜单"))]
  });
}


// 序号辅助（按名字匹配时用）
function 序号Of(x) { return 下载源表.indexOf(x) + 1; }


// 调宿主管理器重载本插件（ctx.pluginManager 由宿主注入）
export function 重载自己(ctx, 延迟毫秒) {
  const 插件ID = "GF-plugin-xjyl";
  setTimeout(async () => {
    try {
      const pm = ctx && ctx.pluginManager;
      if (pm && typeof pm.reloadPlugin === "function") {
        const ok = await pm.reloadPlugin(插件ID);
        if (ctx && ctx.logger && ctx.logger.info) {
          ctx.logger.info("[xjyl] 在线更新后重载插件：" + (ok ? "成功" : "返回 false"));
        }
      } else if (ctx && ctx.logger && ctx.logger.warn) {
        ctx.logger.warn("[xjyl] 未能自动重载（宿主未提供 pluginManager.reloadPlugin），请在控制台手动重载插件");
      }
    } catch (e) {
      if (ctx && ctx.logger && ctx.logger.error) ctx.logger.error("[xjyl] 重载失败：", e);
    }
  }, 延迟毫秒 || 2500);
}


// 设置 / 清除 GitHub API 令牌（3.1.8）
// 有令牌 → 认证请求 5000 次/小时；无令牌 → 匿名 60 次/小时（够用但容易打光）
export async function 更新令牌(ctx, t, u, ev, 参数) {
  if (!isOwner(ctx, ev)) { await 无权限提示(ctx, t); return; }
  const p = String(参数 || "").trim();
  const 配置 = 读控制台配置(ctx);
  const 已有 = String(配置.GitHub令牌 || "");

  // 不带参数 → 显示当前状态与设置方法
  if (!p) {
    await reply(ctx, t, [
      已有
        ? "当前状态：**已设置**（" + 已有.slice(0, 4) + "…" + 已有.slice(-4) + "）· 额度 **5000 次/小时**"
        : "当前状态：**未设置** · 匿名额度 **60 次/小时**（容易打光）",
      "",
      "**为什么要设**",
      灰块([
        "GitHub 匿名 API 每小时只有 60 次，反复点「检查更新」很快就用完",
        "填一个令牌可以提到 5000 次/小时，基本用不完",
      ]),
      "",
      "**怎么设置**",
      "1. 打开 https://github.com/settings/tokens 新建 Token",
      "2. 权限选 **public_repo**（或 Read-only 即可，不需要写权限）",
      "3. 发 `星甲设置令牌 ghp_你的令牌`",
      "",
      灰块([
        "令牌只存在本机插件配置里，只用于「查版本」，不会写任何东西",
        "想取消：发 星甲清除令牌",
      ])
    ].join("\n"), {
      标题: "🔑 GitHub API 令牌",
      行组: [
        row(btn("tk1", "更新插件", "更新插件"), btn("tk2", "版本列表", "更新版本"), btn("tk3", "菜单", "菜单")),
        已有 ? row(btn("tk4", "清除令牌", "清除令牌")) : row(btn("tk5", "查看设置方法", "设置令牌"))
      ]
    });
    return;
  }

  // 清除
  if (/^(清除|清空|删除|取消|off|reset)$/i.test(p)) {
    写控制台配置(ctx, { GitHub令牌: "" });
    应用令牌(ctx);
    await reply(ctx, t, [
      "🧹 **已清除 GitHub 令牌**",
      "",
      "现在回到匿名额度 **60 次/小时**。",
      灰块(["如果发现检查更新变慢或提示限流，可以再设回来"])
    ].join("\n"), {
      标题: "🔑 GitHub API 令牌",
      行组: [row(btn("tk6", "重新设置", "设置令牌"), btn("tk7", "菜单", "菜单"))]
    });
    return;
  }

  // 校验格式
  if (!/^gh[pousr]_[A-Za-z0-9]{20,}$/.test(p)) {
    await reply(ctx, t, [
      "❌ **令牌格式不对**",
      "",
      "GitHub 的令牌应该长这样：`ghp_` 开头 + 一长串字母数字（`github_pat_` 开头也支持）。",
      "",
      灰块(["常见错误：复制时多了空格、只复制了一部分、或者复制的是别的平台的 key"])
    ].join("\n"), {
      标题: "🔑 GitHub API 令牌",
      行组: [row(btn("tk8", "查看设置方法", "设置令牌"), btn("tk9", "菜单", "菜单"))]
    });
    return;
  }

  // 保存并当场验证
  写控制台配置(ctx, { GitHub令牌: p });
  应用令牌(ctx);
  await reply(ctx, t, "🔍 已保存，正在用这个令牌验证…", { 标题: "🔑 验证令牌", 无耗时: true });

  const 查 = await 查发布("");
  if (查.ok) {
    // 顺便报一下剩余额度
    let 额度 = "";
    try {
      const r = await fetch("https://api.github.com/rate_limit", {
        headers: { "Authorization": "Bearer " + p, "Accept": "application/vnd.github+json", "User-Agent": "xjyl" },
      });
      if (r.ok) {
        const j = await r.json();
        const c = j && j.resources && j.resources.core;
        if (c) 额度 = "剩余额度 **" + c.remaining + " / " + c.limit + "** 次每小时";
      }
    } catch (e) { /* 额度查询失败不影响结果 */ }
    await reply(ctx, t, [
      "✅ **令牌已保存，验证通过**",
      "",
      "最新版本 **v" + 查.版本 + "**",
      额度 ? 额度 : "",
      "",
      灰块(["令牌只存本机，只用于查版本；不需要了发 星甲清除令牌"])
    ].filter(x => x !== "").join("\n"), {
      标题: "🔑 GitHub API 令牌",
      行组: [row(btn("tk10", "检查更新", "更新插件"), btn("tk11", "版本列表", "更新版本"), btn("tk12", "菜单", "菜单"))]
    });
  } else {
    await reply(ctx, t, [
      "⚠️ **令牌已保存，但验证没通过**",
      "",
      查.原因,
      "",
      灰块([
        "常见原因：令牌权限不足（需要 public_repo 或只读）、令牌已过期、或网络/代理问题",
        "令牌仍然保存了，修好后再点【重新验证】",
      ])
    ].join("\n"), {
      标题: "🔑 GitHub API 令牌",
      行组: [row(btn("tk13", "重新验证", "设置令牌"), btn("tk14", "清除令牌", "清除令牌"), btn("tk15", "菜单", "菜单"))]
    });
  }
}

