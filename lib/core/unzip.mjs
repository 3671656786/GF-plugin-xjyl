/* ============================================================
 * lib/core/unzip.mjs —— 纯 Node zip 解压（零依赖、跨平台）
 * ------------------------------------------------------------
 * 为什么自己写：Windows 自带的 tar（GNU tar）不支持 zip；PowerShell 的
 * Expand-Archive 只能在 Windows 上用。自写一份就不依赖任何外部命令，
 * 宿主是 Node 环境，zlib 一定有。
 *
 * 只支持在线更新真正需要的两种压缩方式：
 *   method 0 = Stored（不压缩）· method 8 = Deflate（zlib inflateRaw）
 *
 * 用法：
 *   const 条目 = 解压到内存(buffer);   // Map<相对路径, Buffer>
 *   解压到目录(buffer, 目标目录);        // 直接写文件
 * ============================================================ */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const EOCD签名 = 0x06054b50;      // End of Central Directory
const 中央目录签名 = 0x02014b50;  // Central Directory File Header
const 本地头签名 = 0x04034b50;    // Local File Header


// 找 EOCD（从尾部往前找，注释区最多 64KB）
function 找EOCD(buf) {
  const 起点 = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= 起点; i--) {
    if (buf.readUInt32LE(i) === EOCD签名) return i;
  }
  return -1;
}


/**
 * 解压 zip 到内存
 * @param {Buffer} buf zip 文件内容
 * @returns {{ ok: boolean, 原因?: string, 条目?: Map<string, Buffer> }}
 */
export function 解压到内存(buf) {
  if (!buf || buf.length < 22) return { ok: false, 原因: "文件太短，不是有效的 zip" };
  const eocd = 找EOCD(buf);
  if (eocd < 0) return { ok: false, 原因: "找不到 zip 中央目录结尾（EOCD），文件可能损坏" };

  const 条目数 = buf.readUInt16LE(eocd + 10);
  const 中央目录大小 = buf.readUInt32LE(eocd + 12);
  const 中央目录偏移 = buf.readUInt32LE(eocd + 16);
  if (中央目录偏移 + 中央目录大小 > buf.length) return { ok: false, 原因: "zip 中央目录偏移越界，文件可能损坏" };

  const 结果 = new Map();
  let p = 中央目录偏移;
  for (let i = 0; i < 条目数; i++) {
    if (p + 46 > buf.length) break;
    if (buf.readUInt32LE(p) !== 中央目录签名) break;
    const 压缩方式 = buf.readUInt16LE(p + 10);
    const 压缩大小 = buf.readUInt32LE(p + 20);
    const 原始大小 = buf.readUInt32LE(p + 24);
    const 文件名长度 = buf.readUInt16LE(p + 28);
    const 扩展长度 = buf.readUInt16LE(p + 30);
    const 注释长度 = buf.readUInt16LE(p + 32);
    const 本地头偏移 = buf.readUInt32LE(p + 42);
    const 名 = buf.slice(p + 46, p + 46 + 文件名长度).toString("utf8");
    p += 46 + 文件名长度 + 扩展长度 + 注释长度;

    if (!名 || 名.endsWith("/")) continue;                    // 目录项跳过
    if (名.includes("..") || path.isAbsolute(名)) continue;   // 防路径穿越
    if (原始大小 > 200 * 1024 * 1024) return { ok: false, 原因: "zip 内含超大文件（" + 名 + "），已中止" };

    // 读本地头，拿到真正的数据起点
    if (本地头偏移 + 30 > buf.length) return { ok: false, 原因: "本地头偏移越界：" + 名 };
    if (buf.readUInt32LE(本地头偏移) !== 本地头签名) return { ok: false, 原因: "本地头签名不匹配：" + 名 };
    const 本地名长度 = buf.readUInt16LE(本地头偏移 + 26);
    const 本地扩展长度 = buf.readUInt16LE(本地头偏移 + 28);
    const 数据起点 = 本地头偏移 + 30 + 本地名长度 + 本地扩展长度;
    const 数据 = buf.slice(数据起点, 数据起点 + 压缩大小);

    try {
      if (压缩方式 === 0) {
        结果.set(名, Buffer.from(数据));
      } else if (压缩方式 === 8) {
        结果.set(名, zlib.inflateRawSync(数据));
      } else {
        return { ok: false, 原因: "不支持的压缩方式 " + 压缩方式 + "（" + 名 + "）" };
      }
    } catch (e) {
      return { ok: false, 原因: "解压失败：" + 名 + "（" + e.message + "）" };
    }
  }
  if (!结果.size) return { ok: false, 原因: "zip 里没有可解压的文件" };
  return { ok: true, 条目: 结果 };
}


/**
 * 解压 zip 到指定目录（逐文件写入；不删除目标目录里已存在的其他文件）
 * @returns {{ ok: boolean, 原因?: string, 写了几个?: number }}
 */
export function 解压到目录(buf, 目标目录) {
  const r = 解压到内存(buf);
  if (!r.ok) return r;
  let n = 0;
  for (const [名, 内容] of r.条目) {
    const 目标 = path.join(目标目录, 名);
    // 二次校验：拼出来的路径必须仍在目标目录内
    const 相对 = path.relative(目标目录, 目标);
    if (相对.startsWith("..") || path.isAbsolute(相对)) continue;
    fs.mkdirSync(path.dirname(目标), { recursive: true });
    fs.writeFileSync(目标, 内容);
    n += 1;
  }
  return { ok: true, 写了几个: n };
}
