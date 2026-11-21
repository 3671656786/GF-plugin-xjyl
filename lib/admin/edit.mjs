// lib/admin/edit.mjs —— 由 index.mjs 拆分（3.0.0）；本文件只放该模块自己的实现，跨模块依赖见顶部 import。
import { ownerList } from "././admin.mjs?v=v1795259210803";
import { S, dget, dn, ds, dset, kfmt, pushLog, 最高权限者 } from "./../core/base.mjs?v=v1795259210803";
import { actBtn, btn, reply, row, sendAudio } from "./../core/qq.mjs?v=v1795259210803";
import { P } from "./../core/util.mjs?v=v1795259210803";
import { players } from "./../game/alliance.mjs?v=v1795259210803";
import { byGid, hasAcc, pwrOf, recPwr } from "./../game/player.mjs?v=v1795259210803";


/* ---------- ⑥ 最高权限者：修改属性 / 一键清空 ---------- */
export function 是最高权限(ctx, u) { return S(u) === S(最高权限者) || ownerList(ctx).indexOf(S(u)) >= 0; }


export const 可改字段 = {
  等级: { 路径: () => P.等级, 默认: 1 }, 经验: { 路径: () => P.经验, 默认: 0 },
  星羽: { 路径: () => P.星羽, 默认: 500 }, 存款: { 路径: () => P.存款, 默认: 0 },
  星核: { 路径: () => P.星核, 默认: 0 }, 贡献: { 路径: () => P.贡献, 默认: 0 },
  // 2.8.0：火力已并入攻击力（旧的「火力」字段名保留为攻击力别名，网页控制台老页面不会报错）
  攻击力: { 路径: () => P.攻击, 默认: 200 }, 火力: { 路径: () => P.攻击, 默认: 200 },
  血量: { 路径: () => P.血量, 默认: 500 },
  血量上限: { 路径: () => P.血量上限, 默认: 500 }, 暴击: { 路径: () => P.暴击, 默认: 0 },
  闪避: { 路径: () => P.闪避, 默认: 0 }, 攻击: { 路径: () => P.攻击, 默认: 200 },
  防御: { 路径: () => P.防御, 默认: 100 }, 暴击率: { 路径: () => P.暴击率, 默认: 5 },
  暴伤: { 路径: () => P.暴伤, 默认: 150 }, 转生: { 路径: () => P.转生, 默认: 0 },
  强化: { 路径: () => P.强化, 默认: 0 }
};


export function 修改记录(ctx) { const v = dget(ctx, P.修改记录, "记录", {}); return v && typeof v === "object" ? v : {}; }


export function 存修改记录(ctx, o) { dset(ctx, P.修改记录, "记录", o); }


export function 找玩家键(ctx, 键) {
  const k = S(键);
  if (!k) return "";
  if (byGid(ctx, k)) return byGid(ctx, k);
  if (hasAcc(ctx, k)) return k;
  for (const u2 of players(ctx)) { if (S(ds(ctx, P.昵称, u2, "")) === k) return u2; }
  return "";
}


export function 修改属性面板(ctx, t, u, 目标) {
  const 键 = 目标 || u;
  const 行 = [
    "## 🔧 修改属性",
    "",
    "目标：" + 键 + "（" + ds(ctx, P.昵称, 键, "未开号") + "）",
    "",
    "用法：`修改属性#<目标编号或openid>#<字段>#<数值>`",
    "例：`修改属性#" + 键 + "#攻击#99999`",
    "",
    "**可改字段**",
    Object.keys(可改字段).join(" · "),
    "",
    "`一键清空修改` —— 把该玩家所有被改过的字段恢复默认"
  ];
  return reply(ctx, t, 行.join("\n"), {
    标题: "🔧 修改属性",
    行组: [
      row(actBtn("mm1", "⚡清空修改", "mmclear|" + 键), actBtn("mm2", "⚡属性", "info"), btn("mm3", "主人菜单", "主人菜单"))
    ]
  });
}


export async function 改属性(ctx, t, u, 目标键, 字段名, 值) {
  const 键 = 找玩家键(ctx, 目标键);
  if (!键) { await reply(ctx, t, "找不到玩家：" + S(目标键) + "\n可以填游戏编号（`查编号#1234`）或 openid。", { 标题: "🔧 修改失败" }); return; }
  const f = S(字段名);
  const cfg = 可改字段[f];
  if (!cfg) { await reply(ctx, t, "不支持的字段：" + f + "\n可用：" + Object.keys(可改字段).join(" · "), { 标题: "🔧 修改失败" }); return; }
  const v = Number(值);
  if (!Number.isFinite(v)) { await reply(ctx, t, "数值必须是数字。", { 标题: "🔧 修改失败" }); return; }
  const 新 = Math.max(0, Math.floor(v));
  const 旧值 = dn(ctx, cfg.路径(), 键, cfg.默认);
  dset(ctx, cfg.路径(), 键, 新);
  const 记录 = 修改记录(ctx);
  const mine2 = 记录[键] && typeof 记录[键] === "object" ? 记录[键] : {};
  mine2[f] = { 原值: 旧值, 新值: 新, 时间: Date.now() };
  记录[键] = mine2;
  存修改记录(ctx, 记录);
  recPwr(ctx, 键);
  pushLog(ctx, u, "修改属性 " + 键 + " " + f + " " + 旧值 + "→" + 新);
  await reply(ctx, t, ["**修改成功**", "", "玩家：" + ds(ctx, P.昵称, 键, 键), "字段：" + f, "数值：" + 旧值 + " → **" + 新 + "**", "", "当前战力：" + pwrOf(ctx, 键)].join("\n"), {
    标题: "🔧 修改属性",
    行组: [row(actBtn("mm4", "⚡一键清空修改", "mmclear|" + 键), actBtn("mm5", "⚡看属性", "info"), btn("mm6", "主人菜单", "主人菜单"))]
  });
}


export async function 清空修改(ctx, t, u, 目标键) {
  const 键 = 找玩家键(ctx, 目标键) || S(目标键);
  const 记录 = 修改记录(ctx);
  const mine2 = 记录[键];
  const 字段s = mine2 && typeof mine2 === "object" ? Object.keys(mine2) : [];
  if (!字段s.length) {
    await reply(ctx, t, "该玩家没有被修改过的属性记录。", { 标题: "🔧 清空修改", 按钮: [btn("mm7", "主人菜单", "主人菜单")] });
    return;
  }
  for (const f of 字段s) {
    const cfg = 可改字段[f];
    if (!cfg) continue;
    dset(ctx, cfg.路径(), 键, cfg.默认);
  }
  delete 记录[键];
  存修改记录(ctx, 记录);
  recPwr(ctx, 键);
  pushLog(ctx, u, "一键清空修改 " + 键 + "（" + 字段s.length + " 项）");
  await reply(ctx, t, ["**已清空被修改的属性**", "", "玩家：" + ds(ctx, P.昵称, 键, 键), "恢复字段：" + 字段s.join(" · "), "", "当前：Lv." + dn(ctx, P.等级, 键, 1) + " · 攻击 " + dn(ctx, P.攻击, 键, 200) + " · 防御 " + dn(ctx, P.防御, 键, 100) + " · 星羽 " + kfmt(dn(ctx, P.星羽, 键, 0)), "", "（其他玩家不受影响）"].join("\n"), {
    标题: "🔧 一键清空",
    行组: [row(btn("mm8", "主人菜单", "主人菜单"), btn("mm9", "排行榜", "排行榜"))]
  });
}



/* ---------- ⑦ 音乐：时长过长 / 链接受限时优雅降级 ---------- */
export async function 安全发音频(ctx, t, url, note) {
  try { await sendAudio(ctx, t, url, note); return true; }
  catch (e) {
    if (ctx.logger && ctx.logger.warn) ctx.logger.warn("[xjyl] 音频发送失败（时长过长或链接受限）:", e);
    try {
      await reply(ctx, t, [
        "**音频发送失败**（QQ 语音上限约 60 秒，长音频会被平台拒绝）",
        "",
        "可以直接点链接收听：",
        "`" + S(url) + "`"
      ].join("\n"), { 标题: "🎵 " + S(note) });
    } catch (e2) { /* 忽略 */ }
    return false;
  }
}
