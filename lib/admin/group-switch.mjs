// lib/admin/group-switch.mjs —— 3.3.5 群级开关：免前缀 / 免绑定
// 仅群主 / 管理员 / 主人可设；按群 openid 隔离，其他群不受影响。
import { S, ds, dset } from "./../core/base.mjs?v=v1795357425873";
import { reply, row, btn } from "./../core/qq.mjs?v=v1795357425873";
import { isGm } from "./../core/util.mjs?v=v1795357425873";
import { isOwner } from "./../admin/admin.mjs?v=v1795357425873";

const 档群开关 = "游戏数据/设置/群开关.json";   // key=群openid → { 免前缀:bool, 免绑定:bool }

export function 读群开关(ctx, 群) {
  const raw = ds(ctx, 档群开关, S(群), "");
  if (!raw) return { 免前缀: false, 免绑定: false };
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { 免前缀: !!o.免前缀, 免绑定: !!o.免绑定 };
  } catch (e) { return { 免前缀: false, 免绑定: false }; }
}
export function 免前缀开(ctx, 群) { return 读群开关(ctx, 群).免前缀; }
export function 免绑定开(ctx, 群) { return 读群开关(ctx, 群).免绑定; }

function 写群开关(ctx, 群, 键, 开) {
  const o = 读群开关(ctx, 群);
  o[键] = !!开;
  dset(ctx, 档群开关, S(群), JSON.stringify(o));
}

// 命令：类型 = "前缀" | "绑定"；开 = true/false
export async function 群开关命令(ctx, t, ev, 类型, 开) {
  const g = S(t && t.group_openid);
  if (!g) { await reply(ctx, t, "这个开关只能在群里设置。", { 标题: "⚙️ 群设置" }); return; }
  const ok = (() => { try { return isGm(ev) || isOwner(ctx, ev); } catch (e) { return false; } })();
  if (!ok) {
    await reply(ctx, t, "只有群主 / 管理员 / 主人可以设置本群开关。", { 标题: "⚙️ 权限不足" });
    return;
  }
  const 键 = 类型 === "前缀" ? "免前缀" : "免绑定";
  写群开关(ctx, g, 键, 开);
  const 名 = 类型 === "前缀" ? "免前缀" : "免绑定";
  // 开=true 表示「已免」，恢复命令词是「开启」；开=false 表示「要求中」，开启命令词是「关闭」
  const 恢复词 = 类型 === "前缀" ? "开启前缀" : "开启绑定";
  const 开启词 = 类型 === "前缀" ? "关闭前缀" : "关闭绑定";
  const 行 = [
    "## ⚙️ 本群" + 名 + "已" + (开 ? "开启" : "关闭"),
    "",
    (类型 === "前缀"
      ? (开 ? "> 本群发指令**带不带「星甲」都可以**。" : "> 本群已恢复：指令必须带「星甲」前缀。")
      : (开 ? "> 本群成员**无需绑定 QQ 号**即可使用全部功能。" : "> 本群已恢复：使用前必须绑定 QQ 号。")),
    "> 设置只对**本群**生效，其他群不受影响。",
    "",
    "> " + (开 ? "恢复设置" : "开启设置") + "：`星甲" + (开 ? 恢复词 : 开启词) + "`"
  ];
  await reply(ctx, t, 行.join("\n"), {
    标题: "⚙️ 本群" + 名 + (开 ? "开启" : "关闭"),
    行组: [row(
      btn("gs1", (免前缀开(ctx, g) ? "恢复" : "免") + "前缀", (免前缀开(ctx, g) ? "开启前缀" : "关闭前缀")),
      btn("gs2", (免绑定开(ctx, g) ? "恢复" : "免") + "绑定", (免绑定开(ctx, g) ? "开启绑定" : "关闭绑定"))
    )]
  });
}
