import * as ReactModule from "react";

const React = ReactModule && typeof ReactModule.createElement === "function" ? ReactModule : ReactModule.default || ReactModule;
const h = React.createElement;
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const STYLE_ID = "xjyl-admin-style";
const DEFAULT_API_BASE = "/api/Plugin/ext/GF-plugin-xjyl";

const CSS = `.xjyl-admin{--ink:#0b1220;--text:#0f172a;--heading:#1e293b;--muted:#64748b;--accent:#0f766e;--accent2:#0d9488;--soft:rgba(15,118,110,.12);--ok:#059669;--warn:#b45309;--fail:#dc2626;--card:rgba(255,255,255,.52);--mono:ui-monospace,Consolas,"Courier New",monospace;box-sizing:border-box;display:flex;height:100%;min-height:640px;overflow:hidden;color:var(--text);font-family:"Manrope","PingFang SC","Microsoft YaHei",system-ui,sans-serif;font-size:14px;line-height:1.5;background:radial-gradient(900px 520px at 6% -8%,rgba(45,212,191,.26),transparent 55%),radial-gradient(760px 460px at 98% 2%,rgba(56,189,248,.18),transparent 52%),radial-gradient(620px 420px at 72% 112%,rgba(165,243,252,.2),transparent 50%),linear-gradient(155deg,#e0f2fe,#ecfeff 42%,#e0f7f4)}
.xjyl-admin *,.xjyl-admin *::before,.xjyl-admin *::after{box-sizing:border-box}
.xjyl-admin ::-webkit-scrollbar{width:8px;height:8px}
.xjyl-admin ::-webkit-scrollbar-thumb{background:rgba(100,116,139,.28);border-radius:99px}
.xjyl-admin ::-webkit-scrollbar-track{background:transparent}
.xjyl-admin button{font-family:inherit}
.xjl-side{width:214px;flex:0 0 214px;display:flex;flex-direction:column;gap:2px;padding:16px 12px;overflow:auto;background:rgba(255,255,255,.34);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-right:1px solid rgba(255,255,255,.5)}
.xjl-brand{display:flex;flex-direction:column;gap:2px;padding:4px 10px 16px}
.xjl-brand .xjl-mark{font-size:1.3rem;font-weight:800;line-height:1.1;background:linear-gradient(120deg,#0f766e 10%,#0d9488,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}
.xjl-brand small{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(71,85,105,.65)}
.xjl-nav{display:flex;flex-direction:column;gap:3px}
.xjl-nav-item{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border-radius:11px;border:1px solid transparent;background:transparent;color:rgba(51,65,85,.9);font-size:13px;font-weight:600;text-align:left;cursor:pointer;transition:background .18s,color .18s,border-color .18s}
.xjl-nav-item:hover{background:rgba(255,255,255,.55);color:#0f172a}
.xjl-nav-item.active{background:rgba(20,184,166,.18);border-color:rgba(45,212,191,.45);color:#0f766e;box-shadow:0 4px 14px rgba(20,184,166,.14)}
.xjl-side-foot{margin-top:auto;padding:10px 10px 2px;font-size:10.5px;line-height:1.5;color:rgba(100,116,139,.85);word-break:break-all}
.xjl-main{flex:1;min-width:0;overflow:auto;padding:18px 20px 28px}
.xjl-page-title{margin:0;font-size:1.32rem;font-weight:800;color:var(--heading);letter-spacing:-.01em}
.xjl-page-sub{margin:3px 0 14px;font-size:12.5px;color:var(--muted)}
.xjl-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;padding:10px;border-radius:14px;background:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 18px rgba(148,163,184,.14)}
.xjl-field{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#334155;background:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.8);border-radius:10px;padding:4px 9px}
.xjl-input,.xjl-select{border:1px solid rgba(148,163,184,.35);background:#fff;border-radius:9px;padding:7px 9px;font:inherit;font-size:13px;color:var(--text);outline:none;min-width:0;transition:border-color .15s,box-shadow .15s}
.xjl-input:focus,.xjl-select:focus{border-color:#2dd4bf;box-shadow:0 0 0 3px rgba(45,212,191,.18)}
.xjl-input::placeholder{color:#94a3b8}
textarea.xjl-input{resize:vertical;line-height:1.55;width:100%}
.xjl-btn{font:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:8px 12px;cursor:pointer;border:1px solid rgba(148,163,184,.28);background:rgba(255,255,255,.72);color:#334155;transition:background .16s,border-color .16s,transform .12s,opacity .16s;white-space:nowrap}
.xjl-btn:hover{background:#fff}
.xjl-btn:active{transform:translateY(1px)}
.xjl-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.xjl-btn.xjl-primary{background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border-color:transparent;box-shadow:0 6px 16px rgba(15,118,110,.26)}
.xjl-btn.xjl-primary:hover{filter:brightness(1.06)}
.xjl-btn.xjl-ghost{background:transparent;border-color:rgba(15,118,110,.35);color:#0f766e}
.xjl-btn.xjl-ghost:hover{background:rgba(15,118,110,.09)}
.xjl-btn.xjl-danger{background:rgba(220,38,38,.1);border-color:rgba(220,38,38,.3);color:#b91c1c}
.xjl-btn.xjl-danger:hover{background:rgba(220,38,38,.18)}
.xjl-btn.xjl-sm{padding:5px 9px;font-size:12px;border-radius:8px}
.xjl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px;margin-bottom:14px}
.xjl-stat{display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:15px;background:rgba(255,255,255,.56);border:1px solid rgba(255,255,255,.62);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 26px rgba(148,163,184,.16);transition:transform .2s,box-shadow .2s}
.xjl-stat:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(148,163,184,.22)}
.xjl-stat .xjl-stat-label{font-size:12.5px;font-weight:600;color:#475569}
.xjl-stat .xjl-stat-value{font-size:1.45rem;font-weight:800;color:#0d9488;font-variant-numeric:tabular-nums;line-height:1.2}
.xjl-stat .xjl-stat-hint{font-size:11.5px;color:#94a3b8}
.xjl-card,.xjl-detail,.xjl-players>*{min-width:0}
.xjl-card{padding:14px;border-radius:16px;background:rgba(255,255,255,.54);border:1px solid rgba(255,255,255,.62);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 26px rgba(148,163,184,.16)}
.xjl-main > section > .xjl-card + .xjl-card{margin-top:12px}
.xjl-card h3{margin:0 0 10px;font-size:13.5px;font-weight:800;color:#1e293b;display:flex;align-items:center;gap:8px}
.xjl-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;align-items:start}
.xjl-chart{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;padding:10px 8px 4px;border-radius:12px;background:rgba(15,23,42,.035);border:1px solid rgba(255,255,255,.5)}
.xjl-chart-y{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;height:180px;font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums}
.xjl-chart-plot{height:180px;border-left:1px solid rgba(15,23,42,.1);border-bottom:1px solid rgba(15,23,42,.1);overflow:hidden}
.xjl-chart-plot svg{display:block;width:100%;height:180px}
.xjl-chart-x{grid-column:2;display:grid;grid-template-columns:repeat(24,minmax(0,1fr));font-size:10.5px;color:#94a3b8}
.xjl-chart-x span{text-align:center}
.xjl-players{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}
.xjl-table-wrap{overflow:auto;border-radius:12px;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.44);max-height:100%}
.xjl-table{width:100%;border-collapse:collapse;font-size:13px}
.xjl-table.min{min-width:660px}
.xjl-table.wide{min-width:1180px}
.xjl-table th{position:sticky;top:0;z-index:1;text-align:left;padding:9px 10px;font-size:11.5px;font-weight:700;color:#64748b;letter-spacing:.03em;background:rgba(255,255,255,.92);border-bottom:1px solid rgba(148,163,184,.22);white-space:nowrap}
.xjl-table td{padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.14);color:#1e293b;vertical-align:middle;white-space:nowrap}
.xjl-table tbody tr:last-child td{border-bottom:0}
.xjl-table tbody tr:hover{background:rgba(255,255,255,.6)}
.xjl-table tbody tr.active{background:rgba(13,148,136,.1);box-shadow:inset 3px 0 #0d9488}
.xjl-table td.xjl-num{text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono);font-size:12.5px}
.xjl-table td.xjl-wrap{white-space:normal;min-width:240px;overflow-wrap:anywhere}
.xjl-table tbody tr.clickable{cursor:pointer}
.xjl-mono{font-family:var(--mono);font-size:11.5px;color:#64748b}
.xjl-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:700;background:rgba(15,118,110,.12);color:#0f766e;white-space:nowrap}
.xjl-badge.ok{background:rgba(5,150,105,.13);color:#047857}
.xjl-badge.fail{background:rgba(220,38,38,.12);color:#b91c1c}
.xjl-badge.warn{background:rgba(180,83,9,.13);color:#b45309}
.xjl-badge.plain{background:rgba(100,116,139,.13);color:#475569}
.xjl-detail{display:flex;flex-direction:column;gap:12px;min-width:0}
.xjl-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.xjl-detail-name{font-size:1.05rem;font-weight:800;color:#1e293b;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.xjl-detail-sub{margin-top:3px;font-size:11.5px;color:#64748b;word-break:break-all}
.xjl-attr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px}
.xjl-attr{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.75);min-width:0}
.xjl-attr .k{font-size:11px;color:#64748b;font-weight:600}
.xjl-attr .v{font-size:14px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xjl-items{display:flex;flex-wrap:wrap;gap:6px;max-height:190px;overflow:auto;padding:2px}
.xjl-item{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:8px;font-size:12px;background:rgba(255,255,255,.62);border:1px solid rgba(148,163,184,.22);color:#475569}
.xjl-item b{font-family:var(--mono);font-weight:700;color:#0f766e}
.xjl-item.zero{opacity:.42}
.xjl-item.has{border-color:rgba(45,212,191,.5);background:rgba(204,251,241,.7)}
.xjl-form-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.xjl-hint{font-size:11.5px;color:#94a3b8;margin-top:6px;line-height:1.5}
.xjl-err{margin-top:10px;font-size:12.5px;font-weight:600;color:#b91c1c}
.xjl-empty{padding:26px 16px;text-align:center;font-size:12.5px;color:#94a3b8;border:1px dashed rgba(148,163,184,.4);border-radius:12px;background:rgba(255,255,255,.26)}
.xjl-loading{display:flex;align-items:center;gap:8px;padding:22px 12px;justify-content:center;font-size:12.5px;color:#64748b}
.xjl-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(13,148,136,.25);border-top-color:#0d9488;animation:xjl-spin .7s linear infinite}
@keyframes xjl-spin{to{transform:rotate(360deg)}}
.xjl-list{display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto}
.xjl-log-row{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.7);border:1px solid rgba(148,163,184,.18)}
.xjl-log-top{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:11.5px;color:#94a3b8}
.xjl-log-who{font-weight:700;color:#0f766e}
.xjl-log-text{margin-top:2px;font-size:12.5px;color:#334155;overflow-wrap:anywhere}
.xjl-owner-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:11px;background:rgba(255,255,255,.72);border:1px solid rgba(148,163,184,.2)}
.xjl-owner-id{font-family:var(--mono);font-size:12.5px;color:#334155;word-break:break-all;min-width:0}
.xjl-switch-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 13px;border-radius:12px;background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.7);margin-top:8px}
.xjl-switch-row .k{font-size:13px;font-weight:700;color:#1e293b}
.xjl-switch-row .d{margin-top:2px;font-size:11.5px;color:#94a3b8}
.xjl-switch{position:relative;width:44px;height:25px;flex:0 0 auto;border-radius:999px;border:0;cursor:pointer;background:#cbd5e1;transition:background .2s}
.xjl-switch.on{background:#0d9488}
.xjl-switch::after{content:"";position:absolute;top:3px;left:3px;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(15,23,42,.2);transition:transform .2s}
.xjl-switch.on::after{transform:translateX(19px)}
.xjl-modal-mask{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.34);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.xjl-modal{width:min(400px,100%);border-radius:16px;padding:18px;background:rgba(255,255,255,.94);border:1px solid rgba(255,255,255,.9);box-shadow:0 24px 60px rgba(15,23,42,.24)}
.xjl-modal h4{margin:0 0 8px;font-size:15px;font-weight:800;color:#0f172a}
.xjl-modal p{margin:0;font-size:13px;line-height:1.6;color:#475569;overflow-wrap:anywhere;white-space:pre-line}
.xjl-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
.xjl-toast{position:fixed;left:50%;top:20px;z-index:90;transform:translate(-50%,-10px);max-width:min(88vw,340px);padding:10px 16px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;text-align:center;background:rgba(11,18,32,.9);border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 30px rgba(15,23,42,.3);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.xjl-toast.show{opacity:1;transform:translate(-50%,0)}
.xjl-seg{display:inline-flex;flex-wrap:wrap;border:1px solid rgba(255,255,255,.8);border-radius:10px;overflow:hidden;background:rgba(255,255,255,.55)}
.xjl-seg button{border:0;background:transparent;padding:7px 11px;font-size:12.5px;font-weight:600;color:#475569;cursor:pointer;transition:background .15s,color .15s}
.xjl-seg button:hover{background:rgba(255,255,255,.7)}
.xjl-seg button.active{background:rgba(13,148,136,.18);color:#0f766e}
.xjl-kv{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:#475569}
.xjl-kv div{display:flex;gap:8px;justify-content:space-between;border-bottom:1px dashed rgba(148,163,184,.25);padding-bottom:5px;overflow-wrap:anywhere}
.xjl-kv div:last-child{border-bottom:0}
.xjl-kv b{font-weight:700;color:#1e293b;font-family:var(--mono);font-size:11.5px;text-align:right}
.xjl-idgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(238px,1fr));gap:8px}
.xjl-idrow{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.8);min-width:0}
.xjl-idrow .k{flex:0 0 auto;font-size:11.5px;font-weight:700;color:#64748b}
.xjl-idrow .v{flex:1 1 auto;min-width:0;font-size:12.5px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xjl-idrow .v.xjl-mono{font-family:var(--mono);font-size:11.5px;font-weight:600;color:#475569}
.xjl-copy{flex:0 0 auto;border:1px solid rgba(15,118,110,.28);background:rgba(15,118,110,.08);color:#0f766e;border-radius:7px;padding:2px 7px;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;transition:background .15s}
.xjl-copy:hover{background:rgba(15,118,110,.16)}
.xjl-block{margin-top:12px;padding-top:10px;border-top:1px dashed rgba(148,163,184,.32)}
.xjl-block-title{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:12.5px;font-weight:800;color:#334155}
.xjl-block-title .xjl-hint{margin:0;font-weight:600}
.xjl-mult{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px;padding:16px 18px;border-radius:15px;background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.72)}
.xjl-mult-big{display:flex;align-items:baseline;gap:4px;font-size:2.9rem;font-weight:800;line-height:1;color:#0d9488;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.xjl-mult-big.off{color:#94a3b8}
.xjl-mult-big small{font-size:.95rem;font-weight:700;color:#94a3b8;letter-spacing:0}
.xjl-mult-slider{flex:1 1 260px;min-width:180px;display:flex;flex-direction:column;gap:6px}
.xjl-slider{width:100%;height:6px;accent-color:#0d9488;cursor:pointer;margin:0}
.xjl-mult-marks{display:flex;justify-content:space-between;font-size:10.5px;color:#94a3b8;font-variant-numeric:tabular-nums}
.xjl-title-effects{display:flex;flex-wrap:wrap;gap:5px}
.xjl-tfx{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:7px;background:rgba(15,118,110,.09);color:#0f766e;font-size:11.5px;font-weight:700;font-family:var(--mono)}
.xjl-title-name{font-weight:800;color:#1e293b}
.xjl-title-list{display:flex;flex-wrap:wrap;gap:6px}
.xjl-entry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px}
.xjl-entry{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:5px 9px;border-radius:9px;background:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.75);min-width:0}
.xjl-entry .k{font-size:11.5px;font-weight:600;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xjl-entry .v{font-size:13px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;white-space:nowrap}
.xjl-entry.pct .v{color:#0d9488}
.xjl-entry.zero{opacity:.62}
.xjl-entry .soon{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;background:rgba(100,116,139,.14);color:#94a3b8;font-size:10.5px;font-weight:700;white-space:nowrap}
.xjl-entry-badges{display:flex;flex-wrap:wrap;gap:4px}
.xjl-ebadge{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:7px;background:rgba(15,118,110,.09);color:#0f766e;font-size:11px;font-weight:600;font-family:var(--mono)}
.xjl-ebadge b{font-weight:800}
.xjl-auth-shell{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(900px 520px at 6% -8%,rgba(45,212,191,.26),transparent 55%),radial-gradient(760px 460px at 98% 2%,rgba(56,189,248,.18),transparent 52%),linear-gradient(155deg,#e0f2fe,#ecfeff 42%,#e0f7f4)}
.xjl-auth-card{width:min(400px,100%);border-radius:18px;padding:24px;background:rgba(255,255,255,.94);border:1px solid rgba(255,255,255,.9);box-shadow:0 24px 60px rgba(15,23,42,.22);display:flex;flex-direction:column;gap:10px}
.xjl-auth-brand{display:flex;flex-direction:column;gap:2px;margin-bottom:2px}
.xjl-auth-brand .xjl-mark{font-size:1.45rem;font-weight:800;line-height:1.1;background:linear-gradient(120deg,#0f766e 10%,#0d9488,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}
.xjl-auth-brand small{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(71,85,105,.65)}
.xjl-auth-card label{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700;color:#475569}
.xjl-auth-card .xjl-hint{margin-top:0}
.xjl-check{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.xjl-check span{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;background:rgba(220,38,38,.1);color:#b91c1c}
.xjl-check span.ok{background:rgba(5,150,105,.13);color:#047857}
.xjl-acct{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(148,163,184,.32);display:flex;flex-direction:column;gap:4px}
.xjl-acct-title{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(100,116,139,.8);padding:0 12px 2px}
@media (min-width:1180px){.xjl-players{grid-template-columns:minmax(0,1.45fr) minmax(340px,1fr)}}
@media (max-width:860px){.xjyl-admin{flex-direction:column;height:auto;min-height:0;overflow:visible}.xjl-side{width:100%;flex:0 0 auto;flex-direction:row;align-items:center;gap:8px;padding:8px 10px;overflow:visible;border-right:0;border-bottom:1px solid rgba(255,255,255,.55);position:sticky;top:0;z-index:20}.xjl-brand{padding:0 4px;flex:0 0 auto}.xjl-brand .xjl-mark{font-size:1.05rem}.xjl-brand small{display:none}.xjl-nav{flex-direction:row;flex:1;overflow-x:auto;gap:6px;padding-bottom:2px}.xjl-nav-item{padding:7px 11px;white-space:nowrap;flex:0 0 auto}.xjl-side-foot{display:none}.xjl-main{padding:12px 12px 24px;overflow:visible}.xjl-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.xjl-page-title{font-size:1.15rem}.xjl-table.min,.xjl-table.wide{min-width:560px}.xjl-chart{grid-template-columns:34px minmax(0,1fr)}.xjl-entry-grid{grid-template-columns:minmax(0,1fr)}}
/* 3.1.16：手机端增强 —— 表格改为容器内横向滚动（不再撑破页面）、触摸目标加大、禁掉横向溢出 */
@media (max-width:600px){
  html,body{max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%}
  .xjyl-admin{max-width:100vw;overflow-x:hidden}
  .xjl-main{padding:10px 10px 84px;max-width:100%;overflow-x:hidden}
  .xjl-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .xjl-stat{padding:12px 10px}
  .xjl-stat b{font-size:1.15rem}
  .xjl-page-title{font-size:1.05rem;line-height:1.35}
  .xjl-table.min,.xjl-table.wide{min-width:0;width:100%;display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .xjl-table table{min-width:520px}
  [class*="table-wrap"],.xjl-tablebox{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
  .xjl-btn,.xjl-nav-item,button,select,input,textarea{min-height:40px;font-size:14px}
  .xjl-nav-item{padding:9px 12px}
  input,select,textarea{max-width:100%}
  .xjl-chart{grid-template-columns:1fr;gap:6px}
  .xjl-players{grid-template-columns:1fr}
  .xjl-entry-grid{grid-template-columns:1fr}
  .xjl-modal,.xjl-dialog,.xjl-panel{max-width:100vw;width:100%;box-sizing:border-box}
  .xjl-card,.xjl-panel,.xjl-stat{word-break:break-word;overflow-wrap:anywhere}
}`;

function injectStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function fmt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN");
}

function shortId(v) {
  const s = String(v || "");
  if (!s) return "—";
  return s.length <= 16 ? s : s.slice(0, 8) + "…" + s.slice(-6);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

const RARITY_TONE = {
  普通: ["rgba(100,116,139,.14)", "#475569"],
  精良: ["rgba(5,150,105,.14)", "#047857"],
  优秀: ["rgba(13,148,136,.14)", "#0f766e"],
  稀有: ["rgba(37,99,235,.14)", "#1d4ed8"],
  史诗: ["rgba(147,51,234,.14)", "#7e22ce"],
  传说: ["rgba(234,88,12,.15)", "#c2410c"],
  神话: ["rgba(220,38,38,.15)", "#b91c1c"]
};

function rarityTone(rarity) {
  return RARITY_TONE[String(rarity || "").trim()] || ["rgba(100,116,139,.13)", "#475569"];
}

function RarityBadge({ rarity }) {
  const tone = rarityTone(rarity);
  return h("span", { className: "xjl-badge", style: { background: tone[0], color: tone[1] } }, rarity || "—");
}

// 2.8.0：后端把「火力」并入「攻击力」、「耐久 / 耐久上限」改名为「血量 / 血量上限」
// 旧字段名仍作为别名返回，前端一律按新名展示；下拉里两者同时出现时只保留「攻击力」
const FIELD_RENAME = { 火力: "攻击力", 耐久: "血量", 耐久上限: "血量上限" };

function normalizeFields(list) {
  const src = Array.isArray(list) ? list : [];
  const out = [];
  const seen = {};
  for (let i = 0; i < src.length; i++) {
    const raw = String(src[i] === undefined || src[i] === null ? "" : src[i]).trim();
    if (!raw) continue;
    const name = FIELD_RENAME[raw] || raw;
    if (seen[name]) continue;
    seen[name] = true;
    out.push(name);
  }
  return out;
}

// 属性网格：[显示名, 玩家对象上的候选键…]（候选键按顺序取值，兼容后端改名过渡期）
const ATTR_DEFS = [
  ["编号", "编号"],
  ["昵称", "昵称"],
  ["等级", "等级"],
  ["经验", "经验"],
  ["星羽", "星羽"],
  ["存款", "存款"],
  ["星核", "星核"],
  ["贡献", "贡献"],
  ["攻击力", "攻击力", "攻击"],
  ["血量", "血量"],
  ["血量上限", "血量上限"],
  ["暴击", "暴击"],
  ["闪避", "闪避"],
  ["转生", "转生"],
  ["强化", "强化"],
  ["战力", "战力"],
  ["军衔", "军衔"],
  ["联盟", "联盟"],
  ["等级上限", "等级上限"],
  ["可强化", "可强化"]
];

// 战斗词条：前 4 条是数值型（不带 %），后 12 条是百分比型（两位小数）
const ENTRY_DEFS = [
  { 键: "攻击力", 类型: "数值" },
  { 键: "防御力", 类型: "数值" },
  { 键: "生命", 类型: "数值" },
  { 键: "血量", 类型: "数值" },
  { 键: "闪避率", 类型: "百分比" },
  { 键: "真伤概率", 类型: "百分比" },
  { 键: "吸血", 类型: "百分比" },
  { 键: "精准打击", 类型: "百分比" },
  { 键: "复活率", 类型: "百分比" },
  { 键: "重伤", 类型: "百分比" },
  { 键: "追击率", 类型: "百分比" },
  { 键: "追击伤害", 类型: "百分比" },
  { 键: "抗暴率", 类型: "百分比" },
  { 键: "闪击率", 类型: "百分比" },
  { 键: "反击率", 类型: "百分比" },
  { 键: "反击伤害", 类型: "百分比" },
  { 键: "反伤率", 类型: "百分比" },
  { 键: "狂暴真伤", 类型: "百分比" },
  { 键: "真实暴击", 类型: "百分比" }
];

// 数值型词条在「词条」对象缺失该键时，退回玩家对象上的最终属性
const ENTRY_ALIAS = { 攻击力: "攻击", 防御力: "防御", 生命: "血量上限", 血量: "血量" };

// 3.0.0 起词条已全面开放，后端全量下发，无「敬请期待」锁定词条。

function entryValue(player, key) {
  const p = player || {};
  const bag = p.词条 && typeof p.词条 === "object" ? p.词条 : null;
  if (bag) {
    const n = Number(bag[key]);
    if (Number.isFinite(n)) return n;
  }
  const alias = ENTRY_ALIAS[key];
  if (alias) {
    const v = Number(p[alias]);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function entryText(value, type) {
  const n = Number(value);
  if (!Number.isFinite(n)) return type === "百分比" ? "0.00%" : "0";
  return type === "百分比" ? n.toFixed(2) + "%" : fmt(Math.round(n));
}

function hasEntries(player) {
  const bag = player && player.词条;
  return !!(bag && typeof bag === "object");
}

function EntryPanel({ player }) {
  if (!hasEntries(player)) return null;
  const bag = player.词条 && typeof player.词条 === "object" ? player.词条 : {};
  return h(
    "div",
    { className: "xjl-card" },
    h("h3", null, "战斗词条", h("span", { className: "xjl-badge plain" }, ENTRY_DEFS.length + " 项")),
    h(
      "div",
      { className: "xjl-entry-grid" },
      ENTRY_DEFS.map((it) => {
        const raw = Number(bag[it.键]);
        const hasBag = Number.isFinite(raw);
        const v = hasBag ? raw : entryValue(player, it.键);
        const text = entryText(v, it.类型);
        const cls = "xjl-entry" + (it.类型 === "百分比" ? " pct" : "") + (hasBag && Number(v) > 0 ? "" : " zero");
        return h(
          "div",
          { className: cls, key: it.键, title: it.键 + "：" + text },
          h("span", { className: "k" }, it.键),
          h("span", { className: "v" }, text)
        );
      })
    ),
    h("p", { className: "xjl-hint" }, "来源为装备 / 称号 / 星灵，由系统自动汇总；百分比条按各自上限裁剪，网页端只读。")
  );
}

// 系统称号：后端改造中（可多个、带加成、自动发放），字段缺失时整块不显示
function systemTitlesOf(player) {
  const arr = player && player.系统称号;
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    if (it === undefined || it === null || it === "") continue;
    if (typeof it === "object") {
      const name = String(it.名 || it.称号 || it.名称 || "").trim();
      if (name) out.push({ 名: name, 稀有度: String(it.稀有度 || "").trim() });
    } else {
      const name = String(it).trim();
      if (name) out.push({ 名: name, 稀有度: "" });
    }
  }
  return out.length ? out : null;
}

function titleTone(rarity) {
  const r = String(rarity || "").trim();
  return r ? rarityTone(r) : null;
}

function TitleChips({ items }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  return h(
    "div",
    { className: "xjl-title-list" },
    list.map((t, i) => {
      const tone = titleTone(t && t.稀有度);
      return h(
        "span",
        { className: "xjl-badge", key: "t" + i, title: t && t.名 ? t.名 : "", style: tone ? { background: tone[0], color: tone[1] } : undefined },
        (t && t.名) || "—"
      );
    })
  );
}

function effectParts(effect) {
  const src = effect || {};
  const order = ["攻", "防", "血", "经验", "星羽", "掉落"];
  const keys = order.filter((k) => src[k] !== undefined && src[k] !== null).concat(Object.keys(src).filter((k) => order.indexOf(k) < 0));
  const out = [];
  for (const k of keys) {
    const v = Number(src[k]);
    if (!Number.isFinite(v) || v === 0) continue;
    out.push([k, (v > 0 ? "+" : "") + fmt(v)]);
  }
  return out;
}

function EffectTags({ effect }) {
  const parts = effectParts(effect);
  if (!parts.length) return h("span", { className: "xjl-hint", style: { margin: 0 } }, "无加成");
  return h(
    "div",
    { className: "xjl-title-effects" },
    parts.map((p) => h("span", { className: "xjl-tfx", key: p[0] }, p[0], p[1]))
  );
}

function copyText(text) {
  const s = String(text == null ? "" : text);
  if (!s) return Promise.reject(new Error("没有可复制的内容"));
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(s).catch(() => execCopy(s));
  }
  return execCopy(s);
}

function execCopy(s) {
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = s;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error("复制失败，请手动选择"));
    } catch (e) {
      reject(e);
    }
  });
}

function CopyBtn({ text, label, toast }) {
  return h(
    "button",
    {
      type: "button",
      className: "xjl-copy",
      title: String(text || ""),
      onClick: () => {
        copyText(text)
          .then(() => toast && toast("已复制到剪贴板"))
          .catch((e) => toast && toast(e && e.message ? e.message : String(e)));
      }
    },
    label || "复制"
  );
}

function useTitles(api) {
  const [titles, setTitles] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    api
      .get("/titles")
      .then((d) => {
        if (!alive) return;
        setTitles(d && Array.isArray(d.list) ? d.list : []);
        setErr("");
      })
      .catch((e) => {
        if (!alive) return;
        setTitles([]);
        setErr(e && e.message ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [api]);
  return [titles, err];
}

// ====================== 登录认证（与后端契约的对齐点集中在这组常量） ======================
// 契约假设：
// - POST {base}/login   body {password} → 200 返回 {token, 过期时间}（允许外包 {code:0,data} 壳）
//   401 = 密码错误（响应体可带剩余尝试次数）；423 = IP 被锁（响应体带剩余锁定时间）
// - POST {base}/password body {旧密码, 新密码} → 200 改密成功；400 = 复杂度不足（message 带原因）
// - 登录后所有请求自动带 Authorization: Bearer <token>（AUTH_HEADER / AUTH_PREFIX 一处改）
// - 401 → 清 token 回登录页；423 → 提示「IP 已被锁定至 HH:mm」
// - 初始密码 12345678，登录成功后强制改密；连续错 3 次锁 24h（后端实现，前端只做提示）
const AUTH_KEY = "xjyl-admin-auth";
const AUTH_HEADER = "Authorization"; // token 请求头名
const AUTH_PREFIX = "Bearer "; // token 前缀
const INITIAL_PASSWORD = "12345678"; // 初始密码，用于「需改密」兜底判断
const LOGIN_PATH = "/login";
const PASSWORD_PATH = "/password";

function readAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.token) return null;
    const exp = Number(obj.expiresAt);
    if (Number.isFinite(exp) && exp > 0 && Date.now() >= exp) return null; // 本地已过期
    return obj;
  } catch (e) {
    return null;
  }
}

function writeAuth(token, expiresAt) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: String(token), expiresAt: Number(expiresAt) || 0, savedAt: Date.now() }));
  } catch (e) {}
}

function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch (e) {}
}

// 401 时由请求层广播「登录态丢失」，Admin 监听后自动回到登录页
function notifyAuthLost() {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("xjyl-admin-auth-lost"));
    }
  } catch (e) {}
}

function fmtHHmm(d) {
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

// 423 锁定提示：兼容响应体里的 锁定至/lockedUntil（字符串）或 剩余锁定时间/剩余/retryAfter/remaining（毫秒或秒）
function describeLock(body) {
  const b = body && typeof body === "object" ? body : {};
  const base = String(b.message || b.msg || b.error || "").trim();
  let until = "";
  const fixed = b.锁定至 || b.lockedUntil || b.unlockAt;
  if (typeof fixed === "string" && fixed) {
    until = fixed;
  } else {
    const n = Number(b.剩余锁定时间 || b.剩余时间 || b.剩余 || b.retryAfter || b.remainingMs || b.remaining);
    if (Number.isFinite(n) && n > 0) until = fmtHHmm(new Date(Date.now() + (n > 1e6 ? n : n * 1000)));
  }
  const suffix = until ? "IP 已被锁定至 " + until : "IP 已被锁定，请联系管理员在插件配置中解锁";
  return base ? base + (until ? "（至 " + until + "）" : "") : suffix;
}

// 密码复杂度：大写 + 小写 + 数字 + 特殊符号 + ≥8 位（逐项打勾用）
const PWD_RULES = [
  ["大写字母", (s) => /[A-Z]/.test(s)],
  ["小写字母", (s) => /[a-z]/.test(s)],
  ["数字", (s) => /[0-9]/.test(s)],
  ["特殊符号", (s) => /[^A-Za-z0-9]/.test(s)],
  ["至少 8 位", (s) => s.length >= 8]
];

function pwdIssues(s) {
  const v = String(s || "");
  return PWD_RULES.filter((r) => !r[1](v)).map((r) => r[0]);
}

// 过期时间兼容：毫秒/秒时间戳或 ISO 字符串；解析失败按 0（由后端 401 兜底）
function parseExpiry(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function parseAuthResponse(body) {
  const b = body && typeof body === "object" ? body : {};
  const data = b.data && typeof b.data === "object" ? b.data : b; // 兼容 {code:0,data} 外壳
  const token = data.token || data.Token || data.access_token;
  if (!token) return null;
  const exp = parseExpiry(data.过期时间 !== undefined ? data.过期时间 : data.expiresAt !== undefined ? data.expiresAt : data.expireAt);
  return { token: String(token), expiresAt: exp, needChange: !!(data.需改密 || data.needChange || data.needChangePassword) };
}

async function postAuthJson(apiBase, getFetch, path, payload, token) {
  const f = getFetch();
  if (typeof f !== "function") throw new Error("当前环境缺少 fetch 能力");
  const url = String(apiBase || "").replace(/\/+$/, "") + path;
  const headers = { "Content-Type": "application/json" };
  if (token) headers[AUTH_HEADER] = AUTH_PREFIX + token;
  let res;
  try {
    res = await f(url, { method: "POST", credentials: "include", headers: headers, body: JSON.stringify(payload || {}) });
  } catch (e) {
    throw new Error("后端未就绪，请稍后再试");
  }
  const text = await res.text().catch(() => "");
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = null;
    }
  }
  return { res: res, body: body };
}

// 登录：区分「密码错误（剩余 N 次）」「IP 已锁定」「后端未就绪」
async function requestLogin(apiBase, getFetch, password) {
  const r = await postAuthJson(apiBase, getFetch, LOGIN_PATH, { password: String(password || "") });
  if (r.res.status === 401) {
    const b = r.body || {};
    const left = Number(b.剩余次数 || b.remaining || b.attemptsLeft || b.attempts);
    throw new Error(Number.isFinite(left) && left > 0 ? "密码错误（剩余 " + left + " 次尝试）" : "密码错误");
  }
  if (r.res.status === 423) throw new Error(describeLock(r.body));
  if (r.res.status === 400) throw new Error((r.body && (r.body.message || r.body.msg)) || "请求格式有误");
  if (!r.res.ok) throw new Error((r.body && (r.body.message || r.body.msg || r.body.error)) || "登录失败（HTTP " + r.res.status + "）");
  const parsed = parseAuthResponse(r.body);
  if (!parsed) throw new Error("后端未就绪（响应缺少 token）");
  return parsed;
}

// 修改密码：400 时透出后端给出的具体原因；401 视为会话过期回登录页
async function requestChangePassword(apiBase, getFetch, oldPwd, newPwd) {
  const auth = readAuth();
  const r = await postAuthJson(apiBase, getFetch, PASSWORD_PATH, { 旧密码: String(oldPwd || ""), 新密码: String(newPwd || "") }, auth ? auth.token : "");
  if (r.res.status === 401) {
    clearAuth();
    notifyAuthLost();
    throw new Error("登录已过期，请重新登录后再修改密码");
  }
  if (r.res.status === 400) throw new Error((r.body && (r.body.message || r.body.msg || r.body.error)) || "新密码复杂度不足");
  if (r.res.status === 423) throw new Error(describeLock(r.body));
  if (!r.res.ok) throw new Error((r.body && (r.body.message || r.body.msg || r.body.error)) || "修改密码失败（HTTP " + r.res.status + "）");
  const b = r.body && typeof r.body === "object" ? r.body : {};
  if (b.code !== undefined && b.code !== 0) throw new Error(b.message || "修改密码失败");
  return true;
}

function makeApi(apiBase, getFetch) {
  const base = String(apiBase || "").replace(/\/+$/, "");

  async function run(url, init) {
    const f = getFetch();
    if (typeof f !== "function") throw new Error("当前环境缺少 fetch 能力");
    // 已登录时所有请求自动附带 token
    const auth = readAuth();
    if (auth && auth.token) {
      const headers = Object.assign({}, init && init.headers ? init.headers : {});
      headers[AUTH_HEADER] = AUTH_PREFIX + auth.token;
      init = Object.assign({}, init, { headers: headers });
    }
    let res;
    try {
      res = await f(url, init);
    } catch (e) {
      throw new Error("网络请求失败：" + (e && e.message ? e.message : String(e)));
    }
    const text = await res.text().catch(() => "");
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (e) {
        body = null;
      }
    }
    if (res.status === 401) {
      clearAuth();
      notifyAuthLost();
      throw new Error("登录已过期，请重新登录");
    }
    if (res.status === 423) throw new Error(describeLock(body));
    if (!res.ok) {
      const msg = body && (body.message || body.msg || body.error);
      throw new Error(msg ? String(msg) : "HTTP " + res.status);
    }
    if (body === null) throw new Error("服务端返回了非 JSON 内容");
    if (body.code !== 0) throw new Error(body.message || "请求失败（code " + body.code + "）");
    return body.data;
  }

  return {
    get(path, query) {
      const sp = new URLSearchParams();
      if (query) {
        for (const k of Object.keys(query)) {
          const v = query[k];
          if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
        }
      }
      const qs = sp.toString();
      return run(base + path + (qs ? "?" + qs : ""), { method: "GET", credentials: "include" });
    },
    post(path, body) {
      return run(base + path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    }
  };
}

function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(Math.max(320, Math.round(el.clientWidth || 320)));
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function HourChart({ hours }) {
  const [plotRef, width] = useElementWidth();
  const data = useMemo(() => {
    const arr = (Array.isArray(hours) ? hours : []).map((x) => Number(x) || 0);
    while (arr.length < 24) arr.push(0);
    return arr.slice(0, 24);
  }, [hours]);
  const max = Math.max(1, ...data);
  const chartH = 180;
  const padY = 10;
  const plotW = Math.max(1, width - 2);
  const plotH = chartH - padY * 2;
  const pts = data.map((v, i) => [(i / 23) * plotW, padY + (1 - v / max) * plotH]);
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = line + " L" + plotW.toFixed(1) + "," + (padY + plotH).toFixed(1) + " L0," + (padY + plotH).toFixed(1) + " Z";
  const gridY = [0, 0.5, 1].map((f) => (padY + (1 - f) * plotH).toFixed(1));

  return h(
    "div",
    { className: "xjl-chart" },
    h(
      "div",
      { className: "xjl-chart-y" },
      [max, Math.round(max / 2), 0].map((v, i) => h("span", { key: i }, fmt(v)))
    ),
    h(
      "div",
      { className: "xjl-chart-plot", ref: plotRef },
      width
        ? h(
            "svg",
            { viewBox: "0 0 " + width + " " + chartH, width: width, height: chartH, role: "img", "aria-label": "24 小时消息分布" },
            gridY.map((y, i) =>
              h("line", { key: "g" + i, x1: 0, y1: y, x2: plotW, y2: y, stroke: "rgba(100,116,139,.22)", strokeWidth: 1, strokeDasharray: "4 4" })
            ),
            h("path", { d: area, fill: "rgba(13,148,136,.16)" }),
            h("path", { d: line, fill: "none", stroke: "#0d9488", strokeWidth: 2.4, strokeLinejoin: "round", strokeLinecap: "round" }),
            pts.map((p, i) =>
              i % 3 === 0 ? h("circle", { key: "p" + i, cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 2.6, fill: "#0f766e", opacity: 0.85 }) : null
            )
          )
        : null
    ),
    h(
      "div",
      { className: "xjl-chart-x" },
      Array.from({ length: 24 }, (_, i) => h("span", { key: i }, i % 3 === 0 ? i + "h" : ""))
    )
  );
}

function PageHead({ title, sub }) {
  return h(
    "div",
    null,
    h("h1", { className: "xjl-page-title" }, title),
    sub ? h("p", { className: "xjl-page-sub" }, sub) : null
  );
}

function Stat({ label, value, hint }) {
  return h(
    "div",
    { className: "xjl-stat" },
    h("span", { className: "xjl-stat-label" }, label),
    h("span", { className: "xjl-stat-value" }, value),
    hint ? h("span", { className: "xjl-stat-hint" }, hint) : null
  );
}

function Loading({ text }) {
  return h("div", { className: "xjl-loading" }, h("span", { className: "xjl-spin" }), text || "加载中…");
}

function Empty({ text }) {
  return h("div", { className: "xjl-empty" }, text || "暂无数据");
}

function ErrLine({ text }) {
  return text ? h("div", { className: "xjl-err" }, text) : null;
}

function Confirm({ open, title, message, confirmText, onCancel, onConfirm, busy }) {
  if (!open) return null;
  return h(
    "div",
    { className: "xjl-modal-mask", onClick: busy ? undefined : onCancel },
    h(
      "div",
      { className: "xjl-modal", onClick: (e) => e.stopPropagation() },
      h("h4", null, title || "请确认"),
      h("p", null, message || ""),
      h(
        "div",
        { className: "xjl-modal-actions" },
        h("button", { type: "button", className: "xjl-btn", onClick: onCancel, disabled: !!busy }, "取消"),
        h(
          "button",
          { type: "button", className: "xjl-btn xjl-danger", onClick: onConfirm, disabled: !!busy },
          busy ? "处理中…" : confirmText || "确认"
        )
      )
    )
  );
}

function Overview({ api, toast }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    setErr("");
    api
      .get("/dashboard")
      .then((d) => setData(d || {}))
      .catch((e) => {
        const msg = e && e.message ? e.message : String(e);
        setErr(msg);
        toast(msg);
      })
      .finally(() => setBusy(false));
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const sum = (data && data.汇总) || {};
  const hours = (data && data.小时) || [];

  return h(
    "section",
    null,
    h(PageHead, { title: "概览", sub: "玩家数据与今日活跃一览" }),
    data
      ? h(
          "div",
          { className: "xjl-stats" },
          h(Stat, { label: "玩家数", value: fmt(sum.玩家数), hint: "已建档玩家" }),
          h(Stat, { label: "星羽总额", value: fmt(sum.星羽), hint: "全服持有星羽" }),
          h(Stat, { label: "存款总额", value: fmt(sum.存款), hint: "全服银行存款" }),
          h(Stat, { label: "星核总额", value: fmt(sum.星核) }),
          h(Stat, { label: "封禁数", value: fmt(sum.封禁), hint: "当前封禁玩家" }),
          h(Stat, { label: "今日经验", value: fmt(sum.今日经验), hint: "全服今日获得" })
        )
      : busy
        ? h(Loading, null)
        : h(Empty, { text: "暂无概览数据" }),
    h(ErrLine, { text: err }),
    data
      ? h(
          "div",
          { className: "xjl-card", style: { marginTop: 12 } },
          h("h3", null, "今日消息时段分布"),
          h(HourChart, { hours: hours })
        )
      : h(Loading, null),
    h(
      "div",
      { className: "xjl-grid2", style: { marginTop: 12 } },
      h(
        "div",
        { className: "xjl-stats", style: { marginBottom: 0 } },
        h(Stat, { label: "今日消息", value: fmt(data && data.今日消息) }),
        h(Stat, { label: "今日活跃", value: fmt(data && data.今日活跃), hint: "个用户" }),
        h(Stat, { label: "今日群数", value: fmt(data && data.今日群数), hint: "个群" })
      ),
      h(
        "div",
        { className: "xjl-card", style: { boxShadow: "none", background: "rgba(255,255,255,.42)" } },
        h("h3", null, "运行信息"),
        h(
          "div",
          { className: "xjl-kv" },
          h("div", null, h("span", null, "日期"), h("b", null, (data && data.日期) || todayStr())),
          h("div", null, h("span", null, "版本"), h("b", null, (data && data.版本) || "—")),
          h("div", null, h("span", null, "日志目录"), h("b", null, (data && data.日志目录) || "—"))
        )
      )
    ),
    h(
      "div",
      { className: "xjl-toolbar", style: { marginTop: 12, marginBottom: 0 } },
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "数据来自插件实时统计，可随时刷新"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: busy }, busy ? "刷新中…" : "刷新")
    )
  );
}

function PlayerDetail({ api, id, fields, items, titles, toast, onChanged, onRefresh, onSelectId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [field, setField] = useState(fields.indexOf("等级") >= 0 ? "等级" : fields[0] || "等级");
  const [value, setValue] = useState("");
  const [item, setItem] = useState(items[0] || "");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState("");
  const [askReset, setAskReset] = useState(false);
  const [askUnbind, setAskUnbind] = useState(false);
  const [askTransfer, setAskTransfer] = useState(false);
  const [numInput, setNumInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [openidInput, setOpenidInput] = useState("");
  const [targetOpenid, setTargetOpenid] = useState("");
  const [acctErr, setAcctErr] = useState("");

  const load = useCallback(
    (quiet) => {
      if (!quiet) setLoading(true);
      setErr("");
      return api
        .get("/player", { id: id })
        .then((d) => setData(d || null))
        .catch((e) => setErr(e && e.message ? e.message : String(e)))
        .finally(() => setLoading(false));
    },
    [api, id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const player = data && data.玩家 ? data.玩家 : null;

  useEffect(() => {
    if (!player) return;
    const v = player[field];
    setValue(v === undefined || v === null ? "" : String(v));
  }, [field, data]);

  const openid = player ? String(player.openid || player.id || "") : "";
  const playerNumber = player && player.编号 !== undefined && player.编号 !== null ? String(player.编号) : "";
  // 账号类接口按契约使用「当前玩家编号」定位（后端 byGid 同时支持编号与 openid），无编号时退回 id
  const acctId = playerNumber || id;
  const unbound = !!(player && player.已解绑);
  // 定制称号：主人发放的自由文本（无加成，每人 1 个）
  const customTitle = player ? String(player.称号 || "") : "";
  // 系统称号：系统自动发放（可多个、带加成），只读
  const sysTitles = systemTitlesOf(player);
  const curTitle = useMemo(() => {
    const name = customTitle;
    if (!name) return null;
    return (titles || []).filter((t) => t && String(t.名) === name)[0] || { 名: name, 稀有度: "" };
  }, [customTitle, titles]);

  useEffect(() => {
    setNumInput(playerNumber);
    setOpenidInput(openid);
  }, [playerNumber, openid]);

  useEffect(() => {
    setTitleInput(customTitle);
  }, [customTitle]);

  const save = () => {
    if (!player) return;
    const num = Number(value);
    if (value === "" || !Number.isFinite(num)) {
      toast("请输入数字");
      return;
    }
    const v = Math.floor(num);
    setBusy("field");
    api
      .post("/player/update", { id: id, field: field, value: v })
      .then((d) => {
        const up = d && d.玩家;
        if (up) {
          setData((prev) => (prev ? Object.assign({}, prev, { 玩家: up }) : prev));
          onChanged(up);
        }
        toast("已设置 " + field + " = " + fmt(v));
        load(true);
      })
      .catch((e) => toast(e && e.message ? e.message : String(e)))
      .finally(() => setBusy(""));
  };

  const give = (sign) => {
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) {
      toast("数量必须是正整数");
      return;
    }
    if (!item) {
      toast("请选择道具");
      return;
    }
    setBusy("item");
    api
      .post("/player/items", { id: id, item: item, count: sign * n })
      .then((d) => {
        if (d && d.道具) setData((prev) => (prev ? Object.assign({}, prev, { 道具: d.道具 }) : prev));
        toast((sign > 0 ? "已发放 " : "已扣除 ") + item + " × " + fmt(n));
        load(true);
      })
      .catch((e) => toast(e && e.message ? e.message : String(e)))
      .finally(() => setBusy(""));
  };

  const toggleBan = () => {
    if (!player) return;
    const banned = !player.封禁;
    setBusy("ban");
    api
      .post("/player/ban", { id: id, banned: banned })
      .then((d) => {
        const up = d && d.玩家;
        if (up) {
          setData((prev) => (prev ? Object.assign({}, prev, { 玩家: up }) : prev));
          onChanged(up);
        }
        toast(banned ? "已封禁该玩家" : "已解除封禁");
        load(true);
      })
      .catch((e) => toast(e && e.message ? e.message : String(e)))
      .finally(() => setBusy(""));
  };

  const doReset = () => {
    setBusy("reset");
    api
      .post("/player/reset", { id: id })
      .then((d) => {
        const up = d && d.玩家;
        if (up) {
          setData((prev) => (prev ? Object.assign({}, prev, { 玩家: up }) : prev));
          onChanged(up);
        }
        setAskReset(false);
        toast("玩家数据已重置");
        load(true);
      })
      .catch((e) => {
        setAskReset(false);
        toast(e && e.message ? e.message : String(e));
      })
      .finally(() => setBusy(""));
  };

  const applyPlayer = (up) => {
    if (!up) return;
    setData((prev) => (prev ? Object.assign({}, prev, { 玩家: up }) : prev));
    if (onChanged) onChanged(up);
    const nextId = String(up.id || "");
    if (nextId && nextId !== String(id) && typeof onSelectId === "function") {
      onSelectId(nextId);
      return;
    }
    load(true);
    if (typeof onRefresh === "function") onRefresh();
  };

  const act = (path, body, key, okText, done) => {
    setBusy(key);
    setAcctErr("");
    api
      .post(path, body)
      .then((d) => {
        const up = d && d.玩家;
        applyPlayer(up);
        if (typeof done === "function") done();
        toast(okText);
      })
      .catch((e) => {
        const m = e && e.message ? e.message : String(e);
        setAcctErr(m);
        toast(m);
        if (typeof done === "function") done();
      })
      .finally(() => setBusy(""));
  };

  const saveNumber = () => {
    if (!player) return;
    const raw = String(numInput || "").trim();
    if (!/^\d+$/.test(raw)) {
      const m = "新编号必须是 1 ~ 999999999 的整数";
      setAcctErr(m);
      toast(m);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 999999999) {
      const m = "新编号超出范围，只能是 1 ~ 999999999";
      setAcctErr(m);
      toast(m);
      return;
    }
    if (playerNumber && String(n) === playerNumber) {
      toast("编号未变化");
      return;
    }
    act("/player/number", { id: acctId, number: String(n) }, "number", "编号已改为 #" + n + "（不能与其他玩家重复）");
  };

  const saveTitle = () => {
    if (!player) return;
    const pick = String(titleInput || "").trim();
    if (!pick) {
      const m = "请输入要发放的定制称号";
      setAcctErr(m);
      toast(m);
      return;
    }
    act("/player/title", { id: acctId, title: pick }, "title", "已发放定制称号「" + pick + "」");
  };

  const clearTitle = () => {
    if (!player) return;
    act("/player/title", { id: acctId, title: "" }, "title", "已清除该玩家的定制称号");
  };

  const doUnbind = () => {
    act("/player/unbind", { id: acctId }, "unbind", "已解绑该账号，旧号数据保留", () => setAskUnbind(false));
  };

  const doRebind = () => {
    const next = String(openidInput || "").trim();
    if (!next) {
      const m = "请输入要改绑的 openid";
      setAcctErr(m);
      toast(m);
      return;
    }
    if (next === openid) {
      toast("openid 未变化");
      return;
    }
    act("/player/rebind", { id: acctId, openid: next }, "rebind", "已改绑到新的 openid");
  };

  const doTransfer = () => {
    const next = String(targetOpenid || "").trim();
    if (!next) {
      const m = "请输入接收数据的 openid";
      setAcctErr(m);
      toast(m);
      return;
    }
    act("/player/transfer", { id: acctId, openid: next }, "transfer", "旧号数据已转移给目标 openid", () => setAskTransfer(false));
  };

  if (loading && !data) {
    return h("div", { className: "xjl-card" }, h(Loading, { text: "读取玩家详情…" }));
  }
  if (!player) {
    return h(
      "div",
      { className: "xjl-card" },
      h(ErrLine, { text: err || "找不到该玩家" }),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: () => load(false) }, "重试")
    );
  }

  const bag = (data && data.道具) || {};
  const logs = (data && data.最近管理) || [];

  return h(
    "div",
    { className: "xjl-detail" },
    h(
      "div",
      { className: "xjl-card" },
      h(
        "div",
        { className: "xjl-detail-head" },
        h(
          "div",
          null,
          h(
            "div",
            { className: "xjl-detail-name" },
            player.昵称 || "未命名",
            player.封禁 ? h("span", { className: "xjl-badge fail" }, "已封禁") : h("span", { className: "xjl-badge ok" }, "正常"),
            unbound ? h("span", { className: "xjl-badge warn" }, "已解绑") : null,
            curTitle ? h(RarityBadge, { rarity: curTitle.稀有度 }) : null,
            player.称号 ? h("span", { className: "xjl-badge plain" }, player.称号) : null,
            player.军衔 ? h("span", { className: "xjl-badge plain" }, player.军衔) : null,
            player.联盟 ? h("span", { className: "xjl-badge" }, player.联盟) : null
          ),
          h("div", { className: "xjl-detail-sub", title: openid }, "openid：" + (openid || "—"))
        ),
        h("button", { type: "button", className: "xjl-btn xjl-sm", onClick: onClose }, "关闭")
      ),
      h(
        "div",
        { className: "xjl-attr-grid", style: { marginTop: 12 } },
        ATTR_DEFS.map((def) => {
          const label = def[0];
          let v;
          for (let i = 1; i < def.length; i++) {
            const raw = player[def[i]];
            if (raw !== undefined && raw !== null) {
              v = raw;
              break;
            }
          }
          const isNum = typeof v === "number";
          return h(
            "div",
            { className: "xjl-attr", key: label },
            h("div", { className: "k" }, label),
            h("div", { className: "v", title: String(v === undefined || v === null ? "—" : v) }, isNum ? fmt(v) : v === undefined || v === null || v === "" ? "—" : String(v))
          );
        })
      )
    ),
    h(EntryPanel, { player: player }),
    h(
      "div",
      { className: "xjl-card" },
      h(
        "h3",
        null,
        "账号与身份",
        unbound ? h("span", { className: "xjl-badge warn" }, "已解绑") : h("span", { className: "xjl-badge ok" }, "已绑定")
      ),
      h(
        "div",
        { className: "xjl-idgrid" },
        h(
          "div",
          { className: "xjl-idrow" },
          h("span", { className: "k" }, "玩家编号"),
          h("span", { className: "v", title: playerNumber }, playerNumber ? "#" + playerNumber : "—"),
          playerNumber ? h(CopyBtn, { text: playerNumber, toast: toast }) : null
        ),
        h(
          "div",
          { className: "xjl-idrow" },
          h("span", { className: "k" }, "openid"),
          h("span", { className: "v xjl-mono", title: openid }, openid ? shortId(openid) : "—"),
          openid ? h(CopyBtn, { text: openid, toast: toast }) : null
        ),
        h(
          "div",
          { className: "xjl-idrow" },
          h("span", { className: "k" }, "定制称号"),
          h(
            "span",
            { className: "v", style: { display: "flex", alignItems: "center", gap: 6 } },
            curTitle ? h(RarityBadge, { rarity: curTitle.稀有度 }) : null,
            customTitle || "无定制称号"
          )
        ),
        sysTitles
          ? h(
              "div",
              { className: "xjl-idrow" },
              h("span", { className: "k" }, "系统称号"),
              h(
                "span",
                { className: "v", style: { display: "block", whiteSpace: "normal" } },
                h(TitleChips, { items: sysTitles })
              )
            )
          : null,
        h(
          "div",
          { className: "xjl-idrow" },
          h("span", { className: "k" }, "绑定状态"),
          h("span", { className: "v" }, unbound ? "已解绑 · 旧号数据保留" : "已绑定当前 openid")
        )
      ),
      h(
        "div",
        { className: "xjl-block" },
        h("div", { className: "xjl-block-title" }, "修改编号", h("span", { className: "xjl-hint" }, "1 ~ 999999999，不能与其他玩家重复")),
        h(
          "div",
          { className: "xjl-form-row", style: { marginTop: 0 } },
          h(
            "label",
            { className: "xjl-field" },
            "新编号",
            h("input", {
              className: "xjl-input",
              style: { width: 150 },
              inputMode: "numeric",
              maxLength: 9,
              value: numInput,
              placeholder: "如 10086",
              onChange: (e) => setNumInput(String(e.target.value || "").replace(/[^\d]/g, "")),
              onKeyDown: (e) => {
                if (e.key === "Enter") saveNumber();
              }
            })
          ),
          h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: saveNumber, disabled: busy === "number" }, busy === "number" ? "保存中…" : "保存编号")
        )
      ),
      h(
        "div",
        { className: "xjl-block" },
        h(
          "div",
          { className: "xjl-block-title" },
          "定制称号",
          h("span", { className: "xjl-hint" }, "主人发放 · 无加成 · 每人 1 个")
        ),
        h(
          "div",
          { className: "xjl-form-row", style: { marginTop: 0 } },
          h(
            "label",
            { className: "xjl-field", style: { flex: "1 1 240px" } },
            "称号内容",
            h("input", {
              className: "xjl-input",
              style: { flex: 1, minWidth: 0 },
              value: titleInput,
              maxLength: 24,
              placeholder: "输入任意称号文字",
              onChange: (e) => setTitleInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") saveTitle();
              }
            })
          ),
          h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: saveTitle, disabled: busy === "title" }, busy === "title" ? "保存中…" : "保存"),
          h("button", { type: "button", className: "xjl-btn", onClick: clearTitle, disabled: busy === "title" || !customTitle }, "清除")
        ),
        h("p", { className: "xjl-hint" }, "定制称号是自由文本，不再受称号表限制（称号一览仅作效果参考）；与系统称号共存，互不覆盖。")
      ),
      sysTitles
        ? h(
            "div",
            { className: "xjl-block" },
            h(
              "div",
              { className: "xjl-block-title" },
              "系统称号",
              h("span", { className: "xjl-badge plain" }, sysTitles.length + " 个"),
              h("span", { className: "xjl-hint" }, "只读")
            ),
            h(TitleChips, { items: sysTitles }),
            h("p", { className: "xjl-hint" }, "系统称号带战斗加成，由系统按条件自动发放，网页端不提供编辑入口。")
          )
        : null,
      h(
        "div",
        { className: "xjl-block" },
        h("div", { className: "xjl-block-title" }, "改绑 openid", h("span", { className: "xjl-hint" }, "把该编号的数据改绑到新的 openid")),
        h(
          "div",
          { className: "xjl-form-row", style: { marginTop: 0 } },
          h(
            "label",
            { className: "xjl-field", style: { flex: "1 1 240px" } },
            "openid",
            h("input", {
              className: "xjl-input",
              style: { flex: 1, minWidth: 0 },
              value: openidInput,
              placeholder: "粘贴新的完整 openid",
              onChange: (e) => setOpenidInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") doRebind();
              }
            })
          ),
          h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: doRebind, disabled: busy === "rebind" }, busy === "rebind" ? "改绑中…" : "保存改绑")
        ),
        h("p", { className: "xjl-hint" }, "目标 openid 已有其他账号时会失败，请先解绑目标账号再改绑。")
      ),
      h(
        "div",
        { className: "xjl-block" },
        h(
          "div",
          { className: "xjl-block-title" },
          "转移旧号数据",
          unbound ? h("span", { className: "xjl-badge warn" }, "可转移") : h("span", { className: "xjl-badge plain" }, "需先解绑")
        ),
        h(
          "div",
          { className: "xjl-form-row", style: { marginTop: 0 } },
          h(
            "label",
            { className: "xjl-field", style: { flex: "1 1 240px" } },
            "目标 openid",
            h("input", {
              className: "xjl-input",
              style: { flex: 1, minWidth: 0 },
              value: targetOpenid,
              placeholder: "接收数据的 openid",
              disabled: !unbound,
              onChange: (e) => setTargetOpenid(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter" && unbound) setAskTransfer(true);
              }
            })
          ),
          h(
            "button",
            { type: "button", className: "xjl-btn xjl-ghost", onClick: () => setAskTransfer(true), disabled: !unbound || busy === "transfer" },
            busy === "transfer" ? "转移中…" : "转移数据"
          )
        ),
        h(
          "p",
          { className: "xjl-hint" },
          unbound
            ? "把该旧号的数据整份复制给目标 openid；目标若已有账号会失败，需先解绑目标账号。"
            : "只有「已解绑」的旧号才能转移数据，请先解绑当前账号。"
        )
      ),
      h(
        "div",
        { className: "xjl-block" },
        h("div", { className: "xjl-block-title" }, "解绑账号", h("span", { className: "xjl-badge fail" }, "危险操作")),
        h(
          "div",
          { className: "xjl-form-row", style: { marginTop: 0 } },
          h(
            "button",
            { type: "button", className: "xjl-btn xjl-danger", onClick: () => setAskUnbind(true), disabled: unbound || busy === "unbind" },
            unbound ? "当前已解绑" : busy === "unbind" ? "解绑中…" : "解绑账号"
          )
        ),
        h("p", { className: "xjl-hint" }, "解绑后该用户可用原 openid 开新号；旧号数据保留，可在此查看、改绑或转移给别的 openid。")
      ),
      h(ErrLine, { text: acctErr })
    ),
    h(
      "div",
      { className: "xjl-card" },
      h("h3", null, "编辑属性"),
      h(
        "div",
        { className: "xjl-form-row", style: { marginTop: 0 } },
        h(
          "label",
          { className: "xjl-field" },
          "字段",
          h(
            "select",
            { className: "xjl-select", value: field, onChange: (e) => setField(e.target.value) },
            fields.map((f) => h("option", { key: f, value: f }, f))
          )
        ),
        h(
          "label",
          { className: "xjl-field" },
          "数值",
          h("input", {
            className: "xjl-input",
            type: "number",
            step: "1",
            style: { width: 130 },
            value: value,
            placeholder: "未记录",
            onChange: (e) => setValue(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") save();
            }
          })
        ),
        h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: save, disabled: busy === "field" }, busy === "field" ? "保存中…" : "保存")
      ),
      h("p", { className: "xjl-hint" }, "可编辑字段由插件定义（共 " + fields.length + " 项）；部分字段未在玩家对象中返回，显示为「—」仍可直接赋值。")
    ),
    h(
      "div",
      { className: "xjl-card" },
      h("h3", null, "背包道具"),
      h(
        "div",
        { className: "xjl-items" },
        Object.keys(bag).length === 0
          ? h("span", { className: "xjl-hint", style: { margin: 0 } }, "暂无道具数据")
          : Object.keys(bag)
              .sort((a, b) => Number(bag[b]) - Number(bag[a]))
              .map((name) =>
                h(
                  "span",
                  { className: "xjl-item" + (Number(bag[name]) > 0 ? " has" : " zero"), key: name, title: name },
                  name,
                  h("b", null, fmt(bag[name]))
                )
              )
      ),
      h(
        "div",
        { className: "xjl-form-row" },
        h(
          "label",
          { className: "xjl-field" },
          "道具",
          items.length
            ? h(
                "select",
                { className: "xjl-select", value: item, onChange: (e) => setItem(e.target.value) },
                items.map((it) => h("option", { key: it, value: it }, it))
              )
            : h("input", {
                className: "xjl-input",
                style: { width: 130 },
                value: item,
                placeholder: "道具名",
                onChange: (e) => setItem(e.target.value)
              })
        ),
        h(
          "label",
          { className: "xjl-field" },
          "数量",
          h("input", {
            className: "xjl-input",
            type: "number",
            step: "1",
            min: "1",
            style: { width: 96 },
            value: count,
            onChange: (e) => setCount(e.target.value)
          })
        ),
        h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: () => give(1), disabled: busy === "item" }, "发放"),
        h("button", { type: "button", className: "xjl-btn xjl-danger", onClick: () => give(-1), disabled: busy === "item" }, "扣除")
      ),
      h("p", { className: "xjl-hint" }, "数量为正整数；「扣除」会按负数调用接口，余额不足时的表现由插件规则决定。")
    ),
    h(
      "div",
      { className: "xjl-card" },
      h(
        "div",
        { className: "xjl-detail-head", style: { marginBottom: 8 } },
        h("h3", { style: { margin: 0 } }, "最近管理记录"),
        h(
          "div",
          { style: { display: "flex", gap: 8 } },
          h(
            "button",
            { type: "button", className: "xjl-btn xjl-sm " + (player.封禁 ? "xjl-primary" : "xjl-danger"), onClick: toggleBan, disabled: busy === "ban" },
            busy === "ban" ? "处理中…" : player.封禁 ? "解除封禁" : "封禁玩家"
          ),
          h("button", { type: "button", className: "xjl-btn xjl-sm xjl-danger", onClick: () => setAskReset(true), disabled: busy === "reset" }, "重置玩家")
        )
      ),
      logs.length
        ? h(
            "div",
            { className: "xjl-list" },
            logs.map((lg, i) =>
              h(
                "div",
                { className: "xjl-log-row", key: i },
                h(
                  "div",
                  { className: "xjl-log-top" },
                  h("span", null, lg.时间 || "—"),
                  h("span", { className: "xjl-log-who" }, lg.操作者 || "系统")
                ),
                h("div", { className: "xjl-log-text" }, lg.内容 || "")
              )
            )
          )
        : h(Empty, { text: "暂无管理记录" })
    ),
    h(Confirm, {
      open: askReset,
      title: "重置玩家数据",
      message: "将把「" + (player.昵称 || player.编号) + "」的全部可编辑属性恢复为初始值，背包道具不受影响。此操作不可撤销，确认继续？",
      confirmText: "确认重置",
      busy: busy === "reset",
      onCancel: () => setAskReset(false),
      onConfirm: doReset
    }),
    h(Confirm, {
      open: askUnbind,
      title: "解绑账号",
      message:
        "即将解绑「" + (player.昵称 || "未命名") + "（#" + (playerNumber || "—") + "）」。\n\n" +
        "解绑后该用户可用原 openid 开新号；旧号数据保留，可在此查看、改绑或转移给别的 openid。\n" +
        "此操作会立即生效，确认继续？",
      confirmText: "确认解绑",
      busy: busy === "unbind",
      onCancel: () => setAskUnbind(false),
      onConfirm: doUnbind
    }),
    h(Confirm, {
      open: askTransfer,
      title: "转移旧号数据",
      message:
        "将把旧号「" + (player.昵称 || "未命名") + "（#" + (playerNumber || "—") + "）」的数据整份复制给 openid：" +
        (targetOpenid || "（未填写）") +
        "。\n若目标已有账号会失败，需先解绑目标账号。确认继续？",
      confirmText: "确认转移",
      busy: busy === "transfer",
      onCancel: () => setAskTransfer(false),
      onConfirm: doTransfer
    })
  );
}

function Players({ api, meta, toast }) {
  const rawFields = meta && Array.isArray(meta.字段) && meta.字段.length ? meta.字段 : ["等级", "经验", "星羽", "存款", "星核", "贡献", "攻击力", "血量", "血量上限", "暴击", "闪避", "转生", "强化"];
  const fields = useMemo(() => normalizeFields(rawFields), [rawFields]);
  const items = meta && Array.isArray(meta.道具) ? meta.道具 : [];
  const [titles] = useTitles(api);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState("战力");
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);

  const load = useCallback(
    (kw, st, quiet) => {
      if (!quiet) setLoading(true);
      setErr("");
      return api
        .get("/players", { q: kw, sort: st, limit: 200 })
        .then((d) => {
          setList((d && d.list) || []);
          setTotal(Number(d && d.total) || 0);
        })
        .catch((e) => setErr(e && e.message ? e.message : String(e)))
        .finally(() => setLoading(false));
    },
    [api]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      load(q, sort, false);
    }, q ? 320 : 0);
    return () => clearTimeout(t);
  }, [q, sort, load]);

  const patch = useCallback((updated) => {
    if (!updated) return;
    setList((prev) => prev.map((x) => (x.id === updated.id ? Object.assign({}, x, updated) : x)));
  }, []);

  const refresh = useCallback(() => {
    load(q, sort, true);
  }, [load, q, sort]);

  const selectId = useCallback((nextId) => {
    setSel(nextId || null);
    load(q, sort, true);
  }, [load, q, sort]);

  const rarityOf = useMemo(() => {
    const map = {};
    (titles || []).forEach((t) => {
      if (t && t.名) map[String(t.名)] = String(t.稀有度 || "");
    });
    return map;
  }, [titles]);

  const sortOptions = ["战力", "等级", "星羽", "星核", "存款", "贡献", "经验", "转生", "强化"];

  return h(
    "section",
    null,
    h(PageHead, { title: "玩家管理", sub: "搜索玩家后可修改属性、发放道具、管理编号称号与账号绑定、封禁或重置" }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h(
        "label",
        { className: "xjl-field", style: { flex: "1 1 220px", minWidth: 180, maxWidth: 420 } },
        "搜索",
        h("input", {
          className: "xjl-input",
          style: { flex: 1, minWidth: 0 },
          value: q,
          placeholder: "昵称 / 编号 / openid",
          onChange: (e) => setQ(e.target.value)
        })
      ),
      h(
        "label",
        { className: "xjl-field" },
        "排序",
        h(
          "select",
          { className: "xjl-select", value: sort, onChange: (e) => setSort(e.target.value) },
          sortOptions.map((s) => h("option", { key: s, value: s }, s))
        )
      ),
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "共 " + fmt(total) + " 位，展示前 200 位"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: () => load(q, sort, false), disabled: loading }, loading ? "加载中…" : "刷新")
    ),
    h(
      "div",
      { className: "xjl-players" },
      h(
        "div",
        { className: "xjl-card", style: { padding: 10 } },
        loading && list.length === 0
          ? h(Loading, null)
          : list.length === 0
            ? h(Empty, { text: q ? "没有匹配的玩家" : "暂无玩家数据" })
            : h(
                "div",
                { className: "xjl-table-wrap", style: { maxHeight: "62vh" } },
                h(
                  "table",
                  { className: "xjl-table min" },
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      null,
                      ["编号", "昵称", "等级", "战力", "星羽", "存款", "星核", "称号", "状态"].map((c, i) =>
                        h("th", { key: c, style: i >= 2 && i <= 6 ? { textAlign: "right" } : undefined }, c)
                      )
                    )
                  ),
                  h(
                    "tbody",
                    null,
                    list.map((p) => {
                      const sys = systemTitlesOf(p) || [];
                      return h(
                        "tr",
                        {
                          key: p.id,
                          className: "clickable" + (sel === p.id ? " active" : ""),
                          onClick: () => setSel(p.id)
                        },
                        h("td", { className: "xjl-num" }, p.编号 === undefined ? "—" : p.编号),
                        h(
                          "td",
                          { title: String(p.id || "") },
                          h(
                            "div",
                            { style: { display: "flex", flexDirection: "column", lineHeight: 1.25 } },
                            h("span", null, p.昵称 || "未命名"),
                            h("span", { className: "xjl-mono" }, shortId(p.id))
                          )
                        ),
                        h("td", { className: "xjl-num" }, fmt(p.等级)),
                        h("td", { className: "xjl-num" }, fmt(p.战力)),
                        h("td", { className: "xjl-num" }, fmt(p.星羽)),
                        h("td", { className: "xjl-num" }, fmt(p.存款)),
                        h("td", { className: "xjl-num" }, fmt(p.星核)),
                        h(
                          "td",
                          null,
                          h(
                            "span",
                            { style: { display: "inline-flex", gap: 5, flexWrap: "wrap", alignItems: "center" } },
                            p.称号
                              ? h(
                                  "span",
                                  {
                                    className: "xjl-badge",
                                    style: (() => {
                                      const tone = rarityTone(rarityOf[p.称号]);
                                      return { background: tone[0], color: tone[1] };
                                    })()
                                  },
                                  p.称号
                                )
                              : null,
                            sys.map((t, i) =>
                              h(
                                "span",
                                {
                                  className: "xjl-badge plain",
                                  key: "s" + i,
                                  title: "系统称号：" + t.名,
                                  style: t.稀有度 ? (() => {
                                    const tone = rarityTone(t.稀有度);
                                    return { background: tone[0], color: tone[1] };
                                  })() : undefined
                                },
                                t.名
                              )
                            ),
                            !p.称号 && !sys.length ? h("span", { className: "xjl-mono" }, "—") : null
                          )
                        ),
                        h(
                          "td",
                          null,
                          h(
                            "span",
                            { style: { display: "inline-flex", gap: 5, flexWrap: "wrap" } },
                            p.封禁 ? h("span", { className: "xjl-badge fail" }, "封禁") : null,
                            p.已解绑 ? h("span", { className: "xjl-badge warn" }, "已解绑") : null,
                            !p.封禁 && !p.已解绑 ? h("span", { className: "xjl-badge ok" }, "正常") : null
                          )
                        )
                      );
                    })
                  )
                )
              ),
        h(ErrLine, { text: err })
      ),
      sel
        ? h(PlayerDetail, {
            key: sel,
            api: api,
            id: sel,
            fields: fields,
            items: items,
            titles: titles,
            toast: toast,
            onChanged: patch,
            onRefresh: refresh,
            onSelectId: selectId,
            onClose: () => setSel(null)
          })
        : h(
            "div",
            { className: "xjl-card" },
            h("h3", null, "玩家详情"),
            h(Empty, { text: "点击左侧任意玩家查看属性、背包与管理记录" })
          )
    )
  );
}

function Rankings({ api, toast }) {
  const [sort, setSort] = useState("战力");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const opts = ["战力", "等级", "星羽", "星核", "今日经验", "转生"];

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/rankings", { sort: sort, limit: 50 })
      .then((d) => setData(d || null))
      .catch((e) => {
        const msg = e && e.message ? e.message : String(e);
        setErr(msg);
        toast(msg);
      })
      .finally(() => setLoading(false));
  }, [api, sort, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const list = (data && data.list) || [];
  const cols = ["等级", "战力", "星羽", "星核", "存款", "今日经验", "转生"];

  return h(
    "section",
    null,
    h(PageHead, { title: "排行榜", sub: "按不同指标查看全服前 50 名" }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h(
        "div",
        { className: "xjl-seg" },
        opts.map((o) =>
          h("button", { key: o, type: "button", className: sort === o ? "active" : "", onClick: () => setSort(o) }, o)
        )
      ),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: loading }, loading ? "加载中…" : "刷新")
    ),
    h(
      "div",
      { className: "xjl-card", style: { padding: 10 } },
      loading && list.length === 0
        ? h(Loading, null)
        : list.length === 0
          ? h(Empty, { text: "暂无排行数据" })
          : h(
              "div",
              { className: "xjl-table-wrap", style: { maxHeight: "68vh" } },
              h(
                "table",
                { className: "xjl-table min" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", { style: { width: 56 } }, "排名"),
                    h("th", null, "昵称"),
                    h("th", null, "编号"),
                    cols.map((c) =>
                      h("th", { key: c, style: { textAlign: "right" } }, c)
                    )
                  )
                ),
                h(
                  "tbody",
                  null,
                  list.map((p, i) =>
                    h(
                      "tr",
                      { key: p.id || i },
                      h("td", { className: "xjl-num", style: { color: i < 3 ? "#0f766e" : undefined, fontWeight: i < 3 ? 700 : 400 } }, i + 1),
                      h("td", { title: String(p.id || "") }, p.昵称 || "未命名"),
                      h("td", { className: "xjl-mono" }, p.编号 === undefined ? "—" : p.编号),
                      cols.map((c) =>
                        h("td", { key: c, className: "xjl-num", style: c === sort ? { color: "#0f766e", fontWeight: 700 } : undefined }, fmt(p[c]))
                      )
                    )
                  )
                )
              )
            ),
      h(ErrLine, { text: err })
    )
  );
}

// BOSS / 玩家词条徽章：数值型键不带 %，其余按百分比两位小数；字段缺失时不渲染
const ENTRY_NUMERIC = { 攻击力: 1, 防御力: 1, 生命: 1, 血量: 1 };

function entryBadges(bag) {
  if (!bag || typeof bag !== "object") return null;
  const keys = Object.keys(bag).filter((k) => bag[k] !== undefined && bag[k] !== null && bag[k] !== "");
  if (!keys.length) return null;
  return h(
    "div",
    { className: "xjl-entry-badges" },
    keys.map((k) => {
      const n = Number(bag[k]);
      const text = Number.isFinite(n) ? (ENTRY_NUMERIC[k] ? fmt(Math.round(n)) : n.toFixed(2) + "%") : String(bag[k]);
      return h("span", { className: "xjl-ebadge", key: k, title: k + "：" + text }, k, h("b", null, text));
    })
  );
}

function Dungeons({ api, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/dungeons")
      .then((d) => setData(d || null))
      .catch((e) => {
        const msg = e && e.message ? e.message : String(e);
        setErr(msg);
        toast(msg);
      })
      .finally(() => setLoading(false));
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const list = (data && data.list) || [];
  const normal = list.filter((d) => Number(d.编号) < 200);
  const boss = list.filter((d) => Number(d.编号) >= 200);
  const cols = ["编号", "名称", "等级", "战力", "血量", "伤害", "防御", "暴击率", "暴伤", "技能伤害", "冷却", "需币", "需花", "经验", "星羽", "星核", "掉率", "专属武器", "专属护甲"];
  const bossCols = cols.concat(["词条"]);
  const isTextCol = (c) => c === "名称" || c === "专属武器" || c === "专属护甲" || c === "词条";

  const table = (rows, title, hint, useCols) => {
    const theCols = useCols || cols;
    return h(
      "div",
      { className: "xjl-card", style: { padding: 10 } },
      h("h3", { style: { padding: "4px 4px 0" } }, title, h("span", { className: "xjl-badge plain" }, rows.length + " 项")),
      hint ? h("p", { className: "xjl-hint", style: { margin: "0 4px 8px" } }, hint) : null,
      rows.length === 0
        ? h(Empty, { text: "暂无数据" })
        : h(
            "div",
            { className: "xjl-table-wrap" },
            h(
              "table",
              { className: "xjl-table wide" },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  theCols.map((c) => h("th", { key: c, style: isTextCol(c) ? undefined : { textAlign: "right" } }, c))
                )
              ),
              h(
                "tbody",
                null,
                rows.map((d) =>
                  h(
                    "tr",
                    { key: d.编号 },
                    theCols.map((c) => {
                      if (c === "词条") {
                        const badges = entryBadges(d.词条);
                        return h("td", { key: c }, badges || h("span", { className: "xjl-mono" }, "—"));
                      }
                      const v = d[c];
                      const text = isTextCol(c) ? (v === "" || v === undefined || v === null ? "—" : String(v)) : fmt(v);
                      return h("td", { key: c, className: isTextCol(c) ? undefined : "xjl-num" }, text);
                    })
                  )
                )
              )
            )
          )
    );
  };

  return h(
    "section",
    null,
    h(PageHead, { title: "副本数据", sub: "副本与 BOSS 配置、掉落与冷却" }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "数据为插件内置配置，仅供查阅"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: loading }, loading ? "加载中…" : "刷新")
    ),
    loading && list.length === 0 ? h(Loading, null) : null,
    h(ErrLine, { text: err }),
    data && data.保底
      ? h(
          "div",
          { className: "xjl-stats" },
          h(Stat, { label: "普通 BOSS 保底", value: fmt(data.保底.普通次数), hint: "次数 · 爆率 " + String(data.保底.普通爆率) }),
          h(Stat, { label: "传说 BOSS 保底", value: fmt(data.保底.传说次数), hint: "次数 · 爆率 " + String(data.保底.传说爆率) })
        )
      : null,
    list.length ? table(normal, "副本", "编号小于 200 的普通副本") : null,
    list.length ? table(boss, "BOSS", "编号 200 及以上的 BOSS 副本；词条按段位由简单到难，后端未下发时该列显示 —", bossCols) : null
  );
}

function TitlesPanel({ titles, err }) {
  const list = Array.isArray(titles) ? titles : [];
  return h(
    "div",
    { className: "xjl-card", style: { padding: 10 } },
    h("h3", { style: { padding: "4px 4px 0" } }, "称号一览", h("span", { className: "xjl-badge plain" }, list.length + " 个")),
    h("p", { className: "xjl-hint", style: { margin: "0 4px 8px" } }, "系统称号由系统自动发放（只读）；主人的「定制称号」在玩家详情「账号与身份」里自由填写。稀有度仅用于展示。"),
    err ? h(ErrLine, { text: err }) : null,
    list.length === 0
      ? h(Empty, { text: "暂无称号数据" })
      : h(
          "div",
          { className: "xjl-table-wrap", style: { maxHeight: "56vh" } },
          h(
            "table",
            { className: "xjl-table min" },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                h("th", { style: { width: 120 } }, "称号"),
                h("th", { style: { width: 92 } }, "稀有度"),
                h("th", null, "效果"),
                h("th", null, "说明")
              )
            ),
            h(
              "tbody",
              null,
              list.map((t, i) =>
                h(
                  "tr",
                  { key: String(t.名 || "t") + i },
                  h("td", null, h("span", { className: "xjl-title-name" }, String(t.名 || "—"))),
                  h("td", null, h(RarityBadge, { rarity: t.稀有度 })),
                  h("td", null, h(EffectTags, { effect: t.效果 })),
                  h("td", { className: "xjl-wrap", style: { color: "#64748b" } }, String(t.说明 || "—"))
                )
              )
            )
          )
        )
  );
}

function Multiplier({ api, toast }) {
  const [data, setData] = useState(null);
  const [val, setVal] = useState(1);
  const [text, setText] = useState("1.0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState(false);
  const [titles, titleErr] = useTitles(api);

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/server")
      .then((d) => {
        const raw = Number(d && d.倍率);
        const n = Number.isFinite(raw) && raw > 0 ? Math.round(raw * 10) / 10 : 1;
        setData(d || null);
        setVal(n);
        setText(n.toFixed(1));
      })
      .catch((e) => {
        const m = e && e.message ? e.message : String(e);
        setErr(m);
        toast(m);
      })
      .finally(() => setLoading(false));
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setNum = (v) => {
    let n = Number(v);
    if (!Number.isFinite(n)) return;
    n = Math.round(n * 10) / 10;
    if (n < 1) n = 1;
    if (n > 2) n = 2;
    setVal(n);
    setText(n.toFixed(1));
  };

  const typeNum = (s) => {
    setText(s);
    const n = Number(s);
    if (s !== "" && Number.isFinite(n) && n >= 1 && n <= 2) setVal(Math.round(n * 10) / 10);
  };

  const commitNum = () => {
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setText(val.toFixed(1));
      return;
    }
    setNum(n);
  };

  const save = () => {
    const v = Math.round(Number(val) * 10) / 10;
    const valid = Number.isFinite(v) && (v === 1 || (v >= 1.1 && v <= 2));
    if (!valid) {
      const m = "倍率只能是 1.0（关闭）或 1.1 ~ 2.0";
      setErr(m);
      toast(m);
      return;
    }
    setBusy(true);
    setAsk(false);
    api
      .post("/server/multiplier", { 倍率: v })
      .then((d) => {
        const raw = Number(d && d.倍率);
        const n = Number.isFinite(raw) ? Math.round(raw * 10) / 10 : v;
        setData((prev) => Object.assign({}, prev || {}, { 倍率: n, 倍率生效时间: (d && d.倍率生效时间) || new Date().toLocaleString("zh-CN") }));
        setVal(n);
        setText(n.toFixed(1));
        toast(n > 1 ? "全服倍率已设为 ×" + n.toFixed(1) + "，将于结算时生效" : "已关闭全服奖励加成");
        load();
      })
      .catch((e) => toast(e && e.message ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const quick = [1, 1.2, 1.5, 2];
  const active = !!(data && Number(data.倍率) > 1);
  const applyAt = (data && data.倍率生效时间) || "未记录";
  const note = (data && data.倍率说明) || "作用于所有玩家的副本 / BOSS / 天下楼结算奖励（经验、星羽、金币、星核、掉落数量）。";

  return h(
    "section",
    null,
    h(PageHead, { title: "全服倍率", sub: "统一调整全服结算奖励倍率，保存后于下一次结算生效" }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "范围 1.0（关闭）~ 2.0，步进 0.1"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: loading || busy }, loading ? "加载中…" : "刷新")
    ),
    loading && !data ? h(Loading, null) : null,
    h(ErrLine, { text: err }),
    h(
      "div",
      { className: "xjl-card" },
      h("h3", null, "当前倍率", active ? h("span", { className: "xjl-badge ok" }, "生效中") : h("span", { className: "xjl-badge plain" }, "未开启")),
      h(
        "div",
        { className: "xjl-mult" },
        h(
          "div",
          { className: "xjl-mult-big" + (val > 1 ? "" : " off") },
          "×" + val.toFixed(1),
          h("small", null, val > 1 ? "全服奖励" : "无加成")
        ),
        h(
          "div",
          { className: "xjl-mult-slider" },
          h("input", {
            type: "range",
            className: "xjl-slider",
            min: 1,
            max: 2,
            step: 0.1,
            value: val,
            "aria-label": "全服倍率",
            onChange: (e) => setNum(e.target.value)
          }),
          h(
            "div",
            { className: "xjl-mult-marks" },
            h("span", null, "×1.0"),
            h("span", null, "×1.5"),
            h("span", null, "×2.0")
          )
        ),
        h(
          "label",
          { className: "xjl-field" },
          "倍率",
          h("input", {
            className: "xjl-input",
            type: "number",
            step: "0.1",
            min: "1",
            max: "2",
            style: { width: 88 },
            value: text,
            onChange: (e) => typeNum(e.target.value),
            onBlur: commitNum
          })
        )
      ),
      h(
        "div",
        { className: "xjl-form-row" },
        h(
          "div",
          { className: "xjl-seg" },
          quick.map((q) =>
            h(
              "button",
              {
                key: q,
                type: "button",
                className: Math.abs(val - q) < 0.001 ? "active" : "",
                onClick: () => setNum(q)
              },
              "×" + q.toFixed(1)
            )
          )
        ),
        h(
          "button",
          { type: "button", className: "xjl-btn xjl-primary", onClick: () => setAsk(true), disabled: busy || !data },
          busy ? "保存中…" : "保存倍率"
        )
      ),
      h("p", { className: "xjl-hint" }, note),
      h("p", { className: "xjl-hint" }, "上次生效时间：" + applyAt)
    ),
    h(
      "div",
      { className: "xjl-stats", style: { marginTop: 12 } },
      h(Stat, { label: "当前倍率", value: "×" + val.toFixed(1), hint: val > 1 ? "结算奖励已加成" : "未开启加成" }),
      h(Stat, { label: "作用范围", value: "全服", hint: "副本 / BOSS / 天下楼" }),
      h(Stat, { label: "生效时机", value: "结算时", hint: "保存后下一次结算生效" })
    ),
    h(TitlesPanel, { titles: titles, err: titleErr }),
    h(Confirm, {
      open: ask,
      title: "确认修改全服倍率",
      message:
        (val > 1
          ? "全服奖励 ×" + val.toFixed(1) + " 将于结算时生效。"
          : "保存后关闭全服奖励加成（×1.0）。") +
        "\n作用于所有玩家的副本 / BOSS / 天下楼结算奖励（经验、星羽、金币、星核、掉落数量）。",
      confirmText: "确认保存",
      busy: busy,
      onCancel: () => setAsk(false),
      onConfirm: save
    })
  );
}

function Owners({ api, meta, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [askRemove, setAskRemove] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/owners")
      .then((d) => setData(d || null))
      .catch((e) => setErr(e && e.message ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const act = (id, action) => {
    const target = String(id || "").trim();
    if (!target) {
      toast("请输入 openid");
      return;
    }
    setBusy(action + ":" + target);
    api
      .post("/owners", { id: target, action: action })
      .then((d) => {
        if (d) setData({ 最高权限者: d.最高权限者, 主人: d.主人 || [] });
        setAskRemove("");
        if (action === "add") setInput("");
        toast(action === "add" ? "已添加主人" : "已移除主人");
      })
      .catch((e) => {
        setAskRemove("");
        toast(e && e.message ? e.message : String(e));
      })
      .finally(() => setBusy(""));
  };

  const high = (data && data.最高权限者) || (meta && meta.最高权限者) || "";
  const owners = (data && data.主人) || [];

  return h(
    "section",
    null,
    h(PageHead, { title: "主人管理", sub: "最高权限者与主人名单，可增删普通主人" }),
    h(
      "div",
      { className: "xjl-grid2" },
      h(
        "div",
        { className: "xjl-card" },
        h("h3", null, "最高权限者"),
        h(
          "div",
          { className: "xjl-owner-row" },
          h("span", { className: "xjl-owner-id", title: high }, high || "未配置"),
          h("span", { className: "xjl-badge" }, "不可移除")
        ),
        h("p", { className: "xjl-hint" }, "最高权限者由插件配置决定，网页端仅展示，不能在此增删。")
      ),
      h(
        "div",
        { className: "xjl-card" },
        h("h3", null, "主人列表", h("span", { className: "xjl-badge plain" }, owners.length + " 位")),
        h(
          "div",
          { className: "xjl-form-row", style: { marginTop: 0, marginBottom: 10 } },
          h(
            "label",
            { className: "xjl-field", style: { flex: "1 1 240px" } },
            "openid",
            h("input", {
              className: "xjl-input",
              style: { flex: 1, minWidth: 0 },
              value: input,
              placeholder: "粘贴完整 openid",
              onChange: (e) => setInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") act(input, "add");
              }
            })
          ),
          h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: () => act(input, "add"), disabled: busy.indexOf("add") === 0 }, "添加主人")
        ),
        loading && !data
          ? h(Loading, null)
          : owners.length === 0
            ? h(Empty, { text: "暂无其他主人" })
            : h(
                "div",
                { className: "xjl-list" },
                owners.map((id) =>
                  h(
                    "div",
                    { className: "xjl-owner-row", key: id },
                    h("span", { className: "xjl-owner-id", title: id }, id),
                    h(
                      "button",
                      { type: "button", className: "xjl-btn xjl-sm xjl-danger", onClick: () => setAskRemove(id), disabled: busy === "remove:" + id },
                      "移除"
                    )
                  )
                )
              ),
        h(ErrLine, { text: err })
      )
    ),
    h(Confirm, {
      open: !!askRemove,
      title: "移除主人",
      message: "确认将 openid " + askRemove + " 从主人名单中移除？移除后该用户将失去管理权限。",
      confirmText: "确认移除",
      busy: busy === "remove:" + askRemove,
      onCancel: () => setAskRemove(""),
      onConfirm: () => act(askRemove, "remove")
    })
  );
}

function Logs({ api, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // 2.9.3：常驻公告（每条回复「响应用时」下方的灰字，留空关闭）
  const [sticky, setSticky] = useState("");
  const [stickyBusy, setStickyBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/logs")
      .then((d) => setData(d || null))
      .catch((e) => setErr(e && e.message ? e.message : String(e)))
      .finally(() => setLoading(false));
    api
      .get("/config")
      .then((d) => setSticky(String((d && d.配置 && d.配置["常驻公告"]) || "")))
      .catch(() => { /* 读不到就保持原值 */ });
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const stickyLines = (() => {
    const s = String(sticky || "").replace(/\r\n?/g, "\n").trim();
    return s ? s.split("\n").length : 0;
  })();

  const saveSticky = () => {
    const s = String(sticky || "").replace(/\r\n?/g, "\n");
    if (stickyLines > 5) {
      toast("常驻公告最多 5 行（当前 " + stickyLines + " 行）");
      return;
    }
    setStickyBusy(true);
    api
      .post("/announce/sticky", { 文本: s })
      .then((d) => {
        setSticky(String((d && d.常驻公告) || ""));
        toast(s.trim() ? "常驻公告已保存" : "常驻公告已关闭");
      })
      .catch((e) => toast(e && e.message ? e.message : String(e)))
      .finally(() => setStickyBusy(false));
  };

  const publish = () => {
    const s = String(text || "").trim();
    if (!s) {
      toast("公告内容不能为空");
      return;
    }
    setBusy(true);
    api
      .post("/announce", { text: s })
      .then((d) => {
        setData((prev) => (prev ? Object.assign({}, prev, { 公告: d && d.公告 ? d.公告 : prev.公告 }) : prev));
        setText("");
        toast("公告已发布");
        load();
      })
      .catch((e) => toast(e && e.message ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const logs = (data && data.日志) || [];
  const notices = (data && data.公告) || [];

  return h(
    "section",
    null,
    h(PageHead, { title: "日志与公告", sub: "最近 50 条管理日志与全服公告" }),
    h(
      "div",
      { className: "xjl-grid2" },
      h(
        "div",
        { className: "xjl-card", style: { padding: 10 } },
        h("h3", { style: { padding: "4px 4px 0" } }, "管理日志", h("span", { className: "xjl-badge plain" }, logs.length + " 条")),
        loading && !data
          ? h(Loading, null)
          : logs.length === 0
            ? h(Empty, { text: "暂无管理日志" })
            : h(
                "div",
                { className: "xjl-table-wrap", style: { maxHeight: "64vh" } },
                h(
                  "table",
                  { className: "xjl-table min" },
                  h("thead", null, h("tr", null, h("th", { style: { width: 132 } }, "时间"), h("th", { style: { width: 88 } }, "操作者"), h("th", null, "内容"))),
                  h(
                    "tbody",
                    null,
                    logs.map((lg, i) =>
                      h(
                        "tr",
                        { key: i },
                        h("td", { className: "xjl-mono" }, lg.时间 || "—"),
                        h("td", null, lg.操作者 || "系统"),
                        h("td", { className: "xjl-wrap" }, lg.内容 || "")
                      )
                    )
                  )
                )
              ),
        h(ErrLine, { text: err })
      ),
      h(
        "div",
        { className: "xjl-card" },
        h("h3", null, "发布公告"),
        h("textarea", {
          className: "xjl-input",
          rows: 5,
          value: text,
          placeholder: "输入要推送给全服玩家的公告内容",
          onChange: (e) => setText(e.target.value)
        }),
        h(
          "div",
          { className: "xjl-form-row" },
          h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: publish, disabled: busy }, busy ? "发布中…" : "发布公告"),
          h("button", { type: "button", className: "xjl-btn", onClick: () => setText(""), disabled: busy || !text }, "清空")
        ),
        h("h3", { style: { marginTop: 16 } }, "历史公告", h("span", { className: "xjl-badge plain" }, notices.length + " 条")),
        notices.length === 0
          ? h(Empty, { text: "暂无公告" })
          : h(
              "div",
              { className: "xjl-list", style: { maxHeight: 300 } },
              notices.map((n, i) =>
                h(
                  "div",
                  { className: "xjl-log-row", key: i },
                  h("div", { className: "xjl-log-top" }, h("span", null, n.时间 || "—")),
                  h("div", { className: "xjl-log-text" }, n.内容 || "")
                )
              )
            )
      ),
      h(
        "div",
        { className: "xjl-card" },
        h("h3", null, "常驻公告", h("span", { className: "xjl-badge plain" }, stickyLines + "/5 行")),
        h("p", { className: "xjl-hint", style: { margin: "0 4px 8px" } },
          "以灰色字显示在每条回复的「响应用时」下方。支持换行，最多 5 行（超出不保存），留空即关闭。"),
        h("textarea", {
          className: "xjl-input",
          rows: 5,
          value: sticky,
          placeholder: "例如：\n加群 123456789 领福利\n每晚 8 点开团本\n（留空 = 关闭常驻公告）",
          onChange: (e) => setSticky(e.target.value)
        }),
        h(
          "div",
          { className: "xjl-form-row" },
          h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: saveSticky, disabled: stickyBusy }, stickyBusy ? "保存中…" : "保存常驻公告"),
          h("button", { type: "button", className: "xjl-btn", onClick: () => setSticky(""), disabled: stickyBusy || !sticky }, "清空（关闭）"),
          h("span", { className: "xjl-hint" }, sticky.trim() ? "当前已开启" : "当前已关闭（留空即关闭）")
        )
      )
    )
  );
}

function Settings({ api, toast }) {
  const [conf, setConf] = useState(null);
  const [sharp, setSharp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // 3.1.8：GitHub API 令牌 —— 输入值单独存，不回显已保存的明文
  const [令牌输入, set令牌输入] = useState("");
  const [令牌可见, set令牌可见] = useState(false);
  const [令牌状态, set令牌状态] = useState({ 已设置: false, 展示: "" });
  const [令牌busy, set令牌busy] = useState(false);
  const [令牌结果, set令牌结果] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/config")
      .then((d) => {
        setConf((d && d.配置) || {});
        setSharp((d && d.sharp) || null);
        set令牌状态({
          已设置: !!(d && d.GitHub令牌已设置),
          展示: String((d && d.GitHub令牌展示) || "")
        });
      })
      .catch((e) => setErr(e && e.message ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setConf((prev) => Object.assign({}, prev || {}, { [k]: v }));

  const save = () => {
    if (!conf) return;
    setBusy(true);
    api
      .post("/config", {
        图片渲染: !!conf.图片渲染,
        渲染模式: String(conf.渲染模式 || ""),
        调试: !!conf.调试,
        备注: String(conf.备注 || "")
      })
      .then((d) => {
        if (d && d.配置) setConf(d.配置);
        toast("配置已保存");
      })
      .catch((e) => toast(e && e.message ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  // 保存令牌（空 = 清除）
  const saveToken = () => {
    const v = String(令牌输入 || "").trim();
    if (v && !/^gh[pousr]_[A-Za-z0-9]{20,}$/.test(v)) {
      set令牌结果("❌ 格式不对：GitHub 令牌应以 ghp_ 或 github_pat_ 开头");
      return;
    }
    set令牌busy(true);
    set令牌结果("");
    api
      .post("/config", { GitHub令牌: v })
      .then((d) => {
        const 展示 = d && d.GitHub令牌已设置
          ? String(d.GitHub令牌展示 || "")
          : (v ? v.slice(0, 4) + "…" + v.slice(-4) : "");
        set令牌状态({ 已设置: !!(d && d.GitHub令牌已设置) || !!v, 展示: 展示 });
        set令牌输入("");
        set令牌可见(false);
        set令牌结果(v ? "✅ 已保存，额度提升到 5000 次/小时" : "🧹 已清除令牌，回到匿名 60 次/小时");
        toast(v ? "Token 已保存" : "Token 已清除");
      })
      .catch((e) => set令牌结果("❌ 保存失败：" + (e && e.message ? e.message : String(e))))
      .finally(() => set令牌busy(false));
  };

  const modes = ["markdown", "text", "image"];

  return h(
    "section",
    null,
    h(PageHead, { title: "设置", sub: "图片渲染、调试开关与 sharp 运行环境" }),
    loading && !conf
      ? h(Loading, null)
      : h(
          "div",
          { className: "xjl-grid2" },
          h(
            "div",
            { className: "xjl-card" },
            h("h3", null, "插件配置"),
            h(
              "div",
              { className: "xjl-switch-row", style: { marginTop: 0 } },
              h("div", null, h("div", { className: "k" }, "图片渲染"), h("div", { className: "d" }, "关闭后部分功能只返回纯文本")),
              h("button", {
                type: "button",
                className: "xjl-switch" + (conf && conf.图片渲染 ? " on" : ""),
                onClick: () => set("图片渲染", !(conf && conf.图片渲染)),
                "aria-label": "切换图片渲染"
              })
            ),
            h(
              "div",
              { className: "xjl-switch-row" },
              h("div", null, h("div", { className: "k" }, "调试模式"), h("div", { className: "d" }, "输出更详细的运行日志")),
              h("button", {
                type: "button",
                className: "xjl-switch" + (conf && conf.调试 ? " on" : ""),
                onClick: () => set("调试", !(conf && conf.调试)),
                "aria-label": "切换调试模式"
              })
            ),
            h(
              "div",
              { className: "xjl-switch-row", style: { alignItems: "flex-start" } },
              h("div", null, h("div", { className: "k" }, "渲染模式"), h("div", { className: "d" }, "控制消息内容的解析方式")),
              h(
                "select",
                {
                  className: "xjl-select",
                  value: (conf && conf.渲染模式) || "markdown",
                  onChange: (e) => set("渲染模式", e.target.value)
                },
                modes
                  .concat(conf && conf.渲染模式 && modes.indexOf(conf.渲染模式) < 0 ? [conf.渲染模式] : [])
                  .map((m) => h("option", { key: m, value: m }, m))
              )
            ),
            h("h3", { style: { marginTop: 16 } }, "备注"),
            h("textarea", {
              className: "xjl-input",
              rows: 4,
              value: (conf && conf.备注) || "",
              placeholder: "给其他管理员的备注信息",
              onChange: (e) => set("备注", e.target.value)
            }),
            h(
              "div",
              { className: "xjl-form-row" },
              h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: save, disabled: busy }, busy ? "保存中…" : "保存配置"),
              h("button", { type: "button", className: "xjl-btn", onClick: load, disabled: busy }, "重新读取")
            ),
            h(ErrLine, { text: err }),
            // ---- 3.1.8：GitHub API Token ----
            h("h3", { style: { marginTop: 18 } }, "GitHub API Token"),
            h(
              "div",
              { style: { display: "flex", gap: 8, alignItems: "center" } },
              h("input", {
                className: "xjl-input",
                type: 令牌可见 ? "text" : "password",
                placeholder: 令牌状态.已设置 ? "已保存 " + 令牌状态.展示 + "（留空不动，输入新的可替换）" : "ghp_… 粘贴你的 GitHub Token",
                value: 令牌输入,
                onChange: (e) => set令牌输入(e.target.value),
                style: { flex: 1, minWidth: 0 }
              }),
              h(
                "button",
                {
                  type: "button",
                  className: "xjl-btn xjl-ghost xjl-sm",
                  title: 令牌可见 ? "隐藏" : "显示",
                  onClick: () => set令牌可见(!令牌可见)
                },
                令牌可见 ? "隐藏" : "显示"
              ),
              h(
                "button",
                { type: "button", className: "xjl-btn xjl-primary", onClick: saveToken, disabled: 令牌busy },
                令牌busy ? "保存中…" : "保存"
              ),
              令牌状态.已设置
                ? h(
                    "button",
                    { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: () => { set令牌输入(""); saveToken(); }, disabled: 令牌busy },
                    "清除"
                  )
                : null
            ),
            h(
              "p",
              { className: "xjl-hint", style: { marginTop: 8 } },
              "去 ",
              h("a", { href: "https://github.com/settings/tokens", target: "_blank", rel: "noreferrer" }, "github.com/settings/tokens"),
              " 新建 Token（需 public_repo / Read-only 权限）。",
              h("br"),
              "不填时匿名额度 60 次/小时；填了提升到 5000 次/小时。令牌只存本机、只用于查版本。"
            ),
            令牌结果 ? h("p", { className: "xjl-hint", style: { marginTop: 6 } }, 令牌结果) : null
          ),
          h(
            "div",
            { className: "xjl-card" },
            h("h3", null, "sharp 运行环境"),
            h(
              "div",
              { className: "xjl-kv" },
              h("div", null, h("span", null, "状态"), h("b", null, sharp && sharp.已安装 ? "已安装" : "未安装")),
              h("div", null, h("span", null, "版本"), h("b", null, (sharp && sharp.版本) || "—")),
              h("div", null, h("span", null, "目录"), h("b", null, (sharp && sharp.目录) || "—"))
            ),
            h(
              "div",
              { className: "xjl-form-row" },
              h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: busy }, "刷新状态")
            ),
            h(
              "p",
              { className: "xjl-hint" },
              sharp && sharp.已安装
                ? "sharp 已就绪，图片渲染功能可正常使用。"
                : "未检测到 sharp 时，插件会自动降级为纯文本输出；安装请使用主人指令或在控制台执行依赖安装。"
            )
          )
        )
  );
}

// ====================== 登录门与改密界面 ======================
function PasswordChecklist({ value }) {
  const v = String(value || "");
  return h(
    "div",
    { className: "xjl-check" },
    PWD_RULES.map((r) => {
      const ok = r[1](v);
      return h("span", { key: r[0], className: ok ? "ok" : "" }, (ok ? "✓" : "○") + " " + r[0]);
    })
  );
}

function LoginView({ apiBase, getFetch, onLogin }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    if (busy) return;
    const p = String(pwd || "");
    if (!p) {
      setErr("请输入密码");
      return;
    }
    setBusy(true);
    setErr("");
    requestLogin(apiBase, getFetch, p)
      .then((r) => {
        writeAuth(r.token, r.expiresAt);
        // 后端给了「需改密」标志就按它来；没给则按「当前密码等于初始密码」兜底
        onLogin(!!(r.needChange || p === INITIAL_PASSWORD));
      })
      .catch((e) => setErr(e && e.message ? e.message : "后端未就绪，请稍后再试"))
      .finally(() => setBusy(false));
  };

  return h(
    "div",
    { className: "xjl-auth-shell" },
    h(
      "form",
      {
        className: "xjl-auth-card",
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        }
      },
      h("div", { className: "xjl-auth-brand" }, h("span", { className: "xjl-mark" }, "星甲娱乐"), h("small", null, "player console · 登录")),
      h(
        "label",
        null,
        "管理密码",
        h("input", {
          className: "xjl-input",
          type: "password",
          autoComplete: "current-password",
          value: pwd,
          autoFocus: true,
          placeholder: "请输入控制台密码",
          disabled: busy,
          onChange: (e) => setPwd(e.target.value)
        })
      ),
      h("div", { style: { margin: "-4px 0 10px", color: "#f59e0b", fontSize: "12px" } }, "初始密码：12345678（登录后请立即修改）"),
      h("button", { type: "submit", className: "xjl-btn xjl-primary", disabled: busy }, busy ? "登录中…" : "登录"),
      h(ErrLine, { text: err }),
      h("p", { className: "xjl-hint" }, "初始密码 12345678，首次登录后必须修改；连续输错 3 次会锁定当前 IP 24 小时。")
    )
  );
}

function ChangePasswordView({ apiBase, getFetch, forced, onDone, onCancel }) {
  const [oldPwd, setOld] = useState(forced ? INITIAL_PASSWORD : "");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const issues = pwdIssues(pwd);
  const same = pwd.length > 0 && pwd === confirm;
  const canSubmit = !busy && issues.length === 0 && same && String(oldPwd).length > 0;

  const submit = () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr("");
    requestChangePassword(apiBase, getFetch, oldPwd, pwd)
      .then(() => onDone())
      .catch((e) => setErr(e && e.message ? e.message : "修改失败，请稍后再试"))
      .finally(() => setBusy(false));
  };

  return h(
    "form",
    {
      className: "xjl-auth-card",
      onSubmit: (e) => {
        e.preventDefault();
        submit();
      }
    },
    h("div", { className: "xjl-auth-brand" }, h("span", { className: "xjl-mark" }, "修改密码"), h("small", null, forced ? "首次登录必须修改密码" : "change password")),
    h(
      "label",
      null,
      "旧密码",
      h("input", {
        className: "xjl-input",
        type: "password",
        autoComplete: "current-password",
        value: oldPwd,
        autoFocus: true,
        disabled: busy,
        onChange: (e) => setOld(e.target.value)
      })
    ),
    h(
      "label",
      null,
      "新密码",
      h("input", {
        className: "xjl-input",
        type: "password",
        autoComplete: "new-password",
        value: pwd,
        disabled: busy,
        onChange: (e) => setPwd(e.target.value)
      })
    ),
    h(PasswordChecklist, { value: pwd }),
    h(
      "label",
      null,
      "确认新密码",
      h("input", {
        className: "xjl-input",
        type: "password",
        autoComplete: "new-password",
        value: confirm,
        disabled: busy,
        onChange: (e) => setConfirm(e.target.value)
      })
    ),
    confirm && !same ? h(ErrLine, { text: "两次输入的密码不一致" }) : null,
    h(ErrLine, { text: err }),
    h(
      "div",
      { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
      forced
        ? null
        : h(
            "button",
            {
              type: "button",
              className: "xjl-btn",
              onClick: onCancel,
              disabled: busy
            },
            "取消"
          ),
      h("button", { type: "submit", className: "xjl-btn xjl-primary", disabled: !canSubmit }, busy ? "提交中…" : "确认修改")
    ),
    forced ? h("p", { className: "xjl-hint" }, "当前仍在使用初始密码，修改完成前无法进入控制台。") : null
  );
}

// ====================== 扩展面板（后端字段缺失时自动隐藏对应内容） ======================
function kvRowsFrom(obj, skip) {
  const src = obj && typeof obj === "object" ? obj : {};
  const out = [];
  for (const k of Object.keys(src)) {
    if (skip && skip.indexOf(k) >= 0) continue;
    const v = src[k];
    if (v === undefined || v === null || typeof v === "object") continue;
    out.push([k, typeof v === "number" ? fmt(v) : String(v)]);
  }
  return out;
}

function kvCard(title, rows, badge) {
  if (!rows || !rows.length) return null;
  return h(
    "div",
    { className: "xjl-card" },
    h("h3", null, title, badge ? h("span", { className: "xjl-badge warn" }, badge) : null),
    h("div", { className: "xjl-kv" }, rows.map((r, i) => h("div", { key: r[0] + i }, h("span", null, r[0]), h("b", null, r[1]))))
  );
}

// 通用表格：列名取自前几行数据的键并集；对象值显示 —；cap 控制行数上限
function genericTable(rows, cap) {
  const list = (Array.isArray(rows) ? rows : []).slice(0, cap || 20);
  if (!list.length) return h(Empty, { text: "暂无数据" });
  const cols = [];
  const seen = {};
  for (const row of list.slice(0, 5)) {
    for (const k of Object.keys(row || {})) {
      if (!seen[k]) {
        seen[k] = true;
        cols.push(k);
      }
    }
  }
  const isText = (k) => k === "昵称" || k === "名称" || k === "openid" || k === "id";
  return h(
    "div",
    { className: "xjl-table-wrap" },
    h(
      "table",
      { className: "xjl-table min" },
      h("thead", null, h("tr", null, cols.map((c) => h("th", { key: c, style: isText(c) ? undefined : { textAlign: "right" } }, c)))),
      h(
        "tbody",
        null,
        list.map((row, i) =>
          h(
            "tr",
            { key: i },
            cols.map((c) => {
              const v = row ? row[c] : undefined;
              const text =
                v === undefined || v === null || v === "" || typeof v === "object"
                  ? "—"
                  : typeof v === "number"
                    ? fmt(v)
                    : String(v);
              return h("td", { key: c, className: isText(c) ? undefined : "xjl-num" }, text);
            })
          )
        )
      )
    )
  );
}

// 玩法配置：GET /economy 返回什么展示什么（倍率 / 赌场赢输上限 / 农场参数…缺字段隐藏）
function EconomyPanel({ api }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/economy")
      .then((d) => setData(d || null))
      .catch((e) => {
        setData(null);
        setErr(e && e.message ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const casino = data && typeof data.赌场 === "object" ? data.赌场 : null;
  const farm = data && typeof data.农场 === "object" ? data.农场 : null;
  const topRows = data ? kvRowsFrom(data, ["赌场", "农场"]) : [];
  const casinoRows = casino ? kvRowsFrom(casino) : [];
  const farmRows = farm ? kvRowsFrom(farm) : [];
  const hasAny = !!(topRows.length || casinoRows.length || farmRows.length);

  return h(
    "section",
    null,
    h(PageHead, { title: "玩法配置", sub: "全服倍率、赌场与农场参数（只读，具体上限由插件配置解锁）" }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "后端下发什么就展示什么，未下发的项自动隐藏"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: loading }, loading ? "加载中…" : "刷新")
    ),
    loading && !data ? h(Loading, null) : null,
    h(ErrLine, { text: err }),
    !loading && !hasAny ? h(Empty, { text: "后端暂未提供 /economy 接口，内容自动隐藏" }) : null,
    hasAny
      ? h(
          "div",
          { className: "xjl-grid2" },
          kvCard("通用参数", topRows),
          casinoRows.length ? kvCard("赌场", casinoRows, "只读") : null,
          casinoRows.length ? h("div", { className: "xjl-card" }, h("p", { className: "xjl-hint" }, "今日赢 / 输上限由插件配置解锁，网页端仅展示当前进度，不提供修改入口。")) : null,
          farmRows.length ? kvCard("农场参数", farmRows) : null
        )
      : null
  );
}

// 活跃统计：GET /activity（最近 24h），小时曲线 / 汇总数字 / 用户列表，缺啥隐藏
function ActivityPanel({ api }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/activity")
      .then((d) => setData(d || null))
      .catch((e) => {
        setData(null);
        setErr(e && e.message ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const hours = data && Array.isArray(data.小时) ? data.小时 : null;
  const stats = data ? kvRowsFrom(data, ["小时", "列表", "list", "用户", "users"]) : [];
  const list = data
    ? Array.isArray(data.列表)
      ? data.列表
      : Array.isArray(data.list)
        ? data.list
        : Array.isArray(data.用户)
          ? data.用户
          : []
    : [];

  return h(
    "section",
    null,
    h(PageHead, { title: "活跃统计", sub: "最近 24 小时全服活跃（后端未就绪时自动隐藏内容）" }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "仅统计最近 24 小时"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: loading }, loading ? "加载中…" : "刷新")
    ),
    loading && !data ? h(Loading, null) : null,
    h(ErrLine, { text: err }),
    stats.length
      ? h(
          "div",
          { className: "xjl-stats" },
          stats.slice(0, 8).map((r, i) => h(Stat, { key: r[0] + i, label: r[0], value: r[1] }))
        )
      : null,
    hours ? h("div", { className: "xjl-card", style: { marginTop: 12 } }, h("h3", null, "24 小时消息分布"), h(HourChart, { hours: hours })) : null,
    list.length
      ? h(
          "div",
          { className: "xjl-card", style: { padding: 10, marginTop: 12 } },
          h("h3", { style: { padding: "4px 4px 0" } }, "活跃用户", h("span", { className: "xjl-badge plain" }, list.length + " 条")),
          genericTable(list, 50)
        )
      : null,
    !loading && !stats.length && !hours && !list.length ? h(Empty, { text: "后端暂未提供 /activity 接口，内容自动隐藏" }) : null
  );
}

// 农场总览：GET /farm Top20 表格
function FarmPanel({ api }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    api
      .get("/farm")
      .then((d) => setData(d || null))
      .catch((e) => {
        setData(null);
        setErr(e && e.message ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const list = data
    ? Array.isArray(data)
      ? data
      : Array.isArray(data.榜单)
        ? data.榜单
        : Array.isArray(data.list)
          ? data.list
          : Array.isArray(data.玩家)
            ? data.玩家
            : []
    : [];

  return h(
    "section",
    null,
    h(PageHead, { title: "农场总览", sub: "农场数据 Top 20（后端未就绪时自动隐藏内容）" }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "仅展示前 20 名"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load, disabled: loading }, loading ? "加载中…" : "刷新")
    ),
    loading && !data ? h(Loading, null) : null,
    h(ErrLine, { text: err }),
    list.length
      ? h(
          "div",
          { className: "xjl-card", style: { padding: 10 } },
          h("h3", { style: { padding: "4px 4px 0" } }, "农场排行", h("span", { className: "xjl-badge plain" }, Math.min(list.length, 20) + " 名")),
          genericTable(list, 20)
        )
      : !loading
        ? h(Empty, { text: "后端暂未提供 /farm 接口，内容自动隐藏" })
        : null
  );
}

/* ============================================================
 * 2.9.8（需求 1）词条激活面板
 *   GET  /titles/state  → 全部词条键（键 / 类型 / 上限 / 说明）+ 各玩家已激活情况
 *   POST /titles/grant  → 激活（词条 传数组可批量）
 *   POST /titles/revoke → 撤销（同上）
 *   三个接口都在后端的 token 守卫后面：无 token → 401 → run() 抛错 → 上层踢回登录页
 * ============================================================ */
function EntriesPanel({ api, toast }) {
  const [players, setPlayers] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState("");
  const [pick, setPick] = useState({});
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(function () {
    setLoading(true);
    setErr("");
    api
      .get("/players", { limit: 1000 })
      .then(function (d) {
        setPlayers((d && d.list) || []);
      })
      .catch(function () {
        setPlayers([]);
      })
      .then(function () {
        return api.get("/titles/state");
      })
      .then(function (d) {
        setData(d || null);
      })
      .catch(function (e) {
        setErr(e && e.message ? e.message : String(e));
      })
      .finally(function () {
        setLoading(false);
      });
  }, [api]);

  useEffect(function () {
    load();
  }, [load]);

  const keys = (data && data["键表"]) || [];
  const actives = (data && data["玩家"]) || [];
  function actOf(openid) {
    for (const x of actives) {
      if (x && String(x["openid"]) === String(openid)) return x["激活"] || {};
    }
    return {};
  }

  function act(verb) {
    const list = Object.keys(pick).filter(function (k) {
      return pick[k];
    });
    if (!sel) {
      toast("请先选择玩家");
      return;
    }
    if (!list.length) {
      toast("请先勾选词条");
      return;
    }
    setBusy(verb);
    const body = { player: sel, 词条: list };
    if (verb === "grant" && String(value || "").trim()) body.value = String(value).trim();
    api
      .post(verb === "revoke" ? "/titles/revoke" : "/titles/grant", body)
      .then(function () {
        setPick({});
        toast(verb === "revoke" ? "已撤销 " + list.length + " 条" : "已激活 " + list.length + " 条");
        return load();
      })
      .catch(function (e) {
        toast(e && e.message ? e.message : String(e));
      })
      .finally(function () {
        setBusy("");
      });
  }

  function 全选未激活() {
    const a = actOf(sel);
    const next = {};
    for (const k of Object.keys(pick)) next[k] = pick[k];
    for (const it of keys) {
      const key = String(it["键"] || "");
      if (it["类型"] === "百分比" && !Object.prototype.hasOwnProperty.call(a, key)) next[key] = true;
    }
    setPick(next);
  }

  const 当前激活 = actOf(sel);
  const 列表 = keys.map(function (k) {
    const key = String(k["键"] || "");
    const on = Object.prototype.hasOwnProperty.call(当前激活, key);
    const val = on ? Number(当前激活[key]) || 0 : 0;
    const 底 = on
      ? h("span", { className: "xjl-badge ok" }, "已激活 " + String(val) + "%")
      : h("span", { className: "xjl-badge plain" }, "未激活");
    const 说明 = String(k["类型"] || "") + " · 上限 " + String(k["上限"] || 0) + (k["说明"] ? " · " + String(k["说明"]) : "");
    const 内 = h(
      "span",
      { style: { minWidth: 0 } },
      h("b", null, key),
      " ",
      底,
      h("br", null),
      h("span", { style: { color: "#64748b", fontSize: 12 } }, 说明)
    );
    const 框 = {
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      padding: "6px 8px",
      borderRadius: 10,
      marginBottom: 6,
      background: on ? "rgba(5,150,105,.10)" : "rgba(100,116,139,.07)"
    };
    return h(
      "label",
      { key: key, style: 框 },
      h("input", {
        type: "checkbox",
        checked: !!pick[key],
        onChange: function (e) {
          const next = {};
          for (const x of Object.keys(pick)) next[x] = pick[x];
          next[key] = e.target.checked;
          setPick(next);
        }
      }),
      内
    );
  });

  const 玩家选项 = (players.length
    ? players.map(function (p) {
        return h("option", { key: String(p["openid"]), value: String(p["openid"]) }, "#" + String(p["编号"] || "—") + " " + String(p["昵称"] || "无名"));
      })
    : [h("option", { key: "empty", value: "" }, "（暂无玩家）")]);

  const 已激活块 = actives.map(function (x) {
    const act = x["激活"] || {};
    const 明细 = Object.keys(act)
      .map(function (k) {
        return String(k) + " " + String(Number(act[k]) || 0) + "%";
      })
      .join(" · ");
    return h(
      "div",
      { key: String(x["openid"]), style: { padding: "8px 10px", borderRadius: 10, background: "rgba(100,116,139,.07)", marginBottom: 6 } },
      h("b", null, "#" + String(x["编号"] || "—")),
      " " + String(x["昵称"] || "无名"),
      h("br", null),
      h("span", { style: { color: "#64748b", fontSize: 12 } }, 明细)
    );
  });

  return h(
    "section",
    null,
    h(PageHead, {
      title: "词条激活",
      sub: "给指定玩家手动解禁「敬请期待」词条（测试用）；激活后玩家侧正常显示并真实参与战斗计算，撤销即恢复灰色"
    }),
    h(
      "div",
      { className: "xjl-toolbar" },
      h(
        "label",
        { className: "xjl-field", style: { flex: "1 1 240px" } },
        "玩家",
        h(
          "select",
          {
            className: "xjl-select",
            style: { flex: 1, minWidth: 0 },
            value: sel,
            onChange: function (e) {
              setSel(e.target.value || "");
              setPick({});
            }
          },
          玩家选项
        )
      ),
      h(
        "label",
        { className: "xjl-field" },
        "数值（%）",
        h("input", {
          className: "xjl-input",
          type: "number",
          step: "1",
          min: "0",
          style: { width: "96px" },
          placeholder: "10",
          value: value,
          onChange: function (e) {
            setValue(e.target.value);
          }
        })
      ),
      h("span", { className: "xjl-hint", style: { margin: 0 } }, "留空 = 默认 10%，实际值按该词条上限裁剪"),
      h("button", { type: "button", className: "xjl-btn xjl-ghost xjl-sm", onClick: load }, "刷新")
    ),
    h(
      "div",
      { className: "xjl-grid2" },
      h(
        "div",
        { className: "xjl-card" },
        h("h3", null, "全部词条", h("span", { className: "xjl-badge plain" }, keys.length + " 条")),
        h("p", { className: "xjl-hint" }, "勾选后点「激活 / 撤销」。未激活的玩家侧显示为灰色「敬请期待」；已激活的会标出数值。"),
        loading && !data
          ? h(Loading, null)
          : keys.length === 0
            ? h(Empty, { text: "后端暂未提供 /titles/state 接口" })
            : h("div", null, 列表),
        h(
          "div",
          { className: "xjl-form-row" },
          h("button", { type: "button", className: "xjl-btn xjl-primary", onClick: function () { act("grant"); }, disabled: !!busy }, "激活"),
          h("button", { type: "button", className: "xjl-btn", onClick: function () { act("revoke"); }, disabled: !!busy }, "撤销"),
          h("button", { type: "button", className: "xjl-btn xjl-ghost", onClick: 全选未激活 }, "全选未激活")
        ),
        h(ErrLine, { text: err })
      ),
      h(
        "div",
        { className: "xjl-card" },
        h("h3", null, "已激活一览"),
        h("p", { className: "xjl-hint" }, "全服当前被管理员手动激活的词条，按玩家分组。"),
        loading && !data
          ? h(Loading, null)
          : actives.length === 0
            ? h(Empty, { text: "暂无玩家被手动激活词条" })
            : h("div", null, 已激活块)
      )
    )
  );
}

export default function Admin(props) {
  const safeProps = props || {};
  const apiBase = safeProps.apiBase ? String(safeProps.apiBase) : DEFAULT_API_BASE;

  const externalFetch = typeof safeProps.fetch === "function" ? safeProps.fetch : null;
  const fetchRef = useRef(externalFetch);
  fetchRef.current = externalFetch;

  const getFetch = useCallback(() => {
    if (typeof fetchRef.current === "function") return fetchRef.current;
    if (typeof window !== "undefined" && typeof window.fetch === "function") return window.fetch.bind(window);
    return null;
  }, []);

  const api = useMemo(() => makeApi(apiBase, getFetch), [apiBase, getFetch]);

  const [view, setView] = useState("overview");
  const [toastText, setToastText] = useState("");
  const [meta, setMeta] = useState(null);
  const toastTimer = useRef(0);

  // —— 登录门状态 ——
  const [authed, setAuthed] = useState(() => !!readAuth());
  const [forceChange, setForceChange] = useState(false);
  const [showChange, setShowChange] = useState(false);

  useEffect(() => {
    injectStyle();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const toast = useCallback((msg) => {
    setToastText(String(msg || ""));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(""), 2800);
  }, []);

  // 请求层遇到 401 时广播，自动回到登录页
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return undefined;
    const onLost = () => {
      setAuthed(false);
      setForceChange(false);
      setShowChange(false);
    };
    window.addEventListener("xjyl-admin-auth-lost", onLost);
    return () => window.removeEventListener("xjyl-admin-auth-lost", onLost);
  }, []);

  useEffect(() => {
    if (!authed) return undefined;
    let alive = true;
    api
      .get("/meta")
      .then((d) => {
        if (alive) setMeta(d || null);
      })
      .catch(() => {
        if (alive) setMeta(null);
      });
    return () => {
      alive = false;
    };
  }, [api, authed]);

  const onLogin = useCallback((needChange) => {
    setForceChange(!!needChange);
    setShowChange(false);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuthed(false);
    setForceChange(false);
    setShowChange(false);
    setView("overview");
    setMeta(null);
  }, []);

  const nav = [
    ["overview", "概览"],
    ["players", "玩家管理"],
    ["rankings", "排行榜"],
    ["dungeons", "副本数据"],
    ["server", "全服倍率"],
    ["economy", "玩法配置"],
    ["activity", "活跃统计"],
    ["farm", "农场总览"],
    ["owners", "主人管理"],
    ["logs", "日志与公告"],
    ["settings", "设置"]
  ];

  let body = null;
  if (view === "overview") body = h(Overview, { api: api, toast: toast });
  else if (view === "players") body = h(Players, { api: api, meta: meta, toast: toast });
  else if (view === "rankings") body = h(Rankings, { api: api, toast: toast });
  else if (view === "dungeons") body = h(Dungeons, { api: api, toast: toast });
  else if (view === "server") body = h(Multiplier, { api: api, toast: toast });
  else if (view === "economy") body = h(EconomyPanel, { api: api, toast: toast });
  else if (view === "activity") body = h(ActivityPanel, { api: api, toast: toast });
  else if (view === "farm") body = h(FarmPanel, { api: api, toast: toast });
  else if (view === "owners") body = h(Owners, { api: api, meta: meta, toast: toast });
  else if (view === "logs") body = h(Logs, { api: api, toast: toast });
  else body = h(Settings, { api: api, toast: toast });

  // 未登录：只渲染登录页
  if (!authed) {
    return h(
      "div",
      { className: "xjyl-admin" },
      h(LoginView, { apiBase: apiBase, getFetch: getFetch, onLogin: onLogin }),
      h("div", { className: "xjl-toast" + (toastText ? " show" : "") }, toastText)
    );
  }

  // 用初始密码登录后强制改密，改完才能进控制台
  if (forceChange) {
    return h(
      "div",
      { className: "xjyl-admin" },
      h(
        "div",
        { className: "xjl-auth-shell" },
        h(ChangePasswordView, {
          apiBase: apiBase,
          getFetch: getFetch,
          forced: true,
          onDone: () => {
            setForceChange(false);
            toast("密码已修改，请牢记新密码");
          },
          onCancel: null
        })
      ),
      h("div", { className: "xjl-toast" + (toastText ? " show" : "") }, toastText)
    );
  }

  return h(
    "div",
    { className: "xjyl-admin" },
    h(
      "aside",
      { className: "xjl-side" },
      h("div", { className: "xjl-brand" }, h("span", { className: "xjl-mark" }, "星甲娱乐"), h("small", null, "player console")),
      h(
        "div",
        { className: "xjl-nav" },
        nav.map((item) =>
          h(
            "button",
            {
              key: item[0],
              type: "button",
              className: "xjl-nav-item" + (view === item[0] ? " active" : ""),
              onClick: () => setView(item[0])
            },
            item[1]
          )
        )
      ),
      h(
        "div",
        { className: "xjl-acct" },
        h("div", { className: "xjl-acct-title" }, "账号"),
        h("button", { type: "button", className: "xjl-nav-item", onClick: () => setShowChange(true) }, "修改密码"),
        h("button", { type: "button", className: "xjl-nav-item", onClick: logout }, "退出登录")
      ),
      h("div", { className: "xjl-side-foot" }, "接口：" + (apiBase || "同源根"))
    ),
    h("main", { className: "xjl-main" }, body),
    h("div", { className: "xjl-toast" + (toastText ? " show" : "") }, toastText),
    showChange
      ? h(
          "div",
          {
            className: "xjl-modal-mask",
            onClick: (e) => {
              if (e.target === e.currentTarget) setShowChange(false);
            }
          },
          h(
            "div",
            {
              onClick: (e) => e.stopPropagation(),
              style: { display: "flex", width: "min(400px,100%)" }
            },
            h(ChangePasswordView, {
              apiBase: apiBase,
              getFetch: getFetch,
              forced: false,
              onDone: () => {
                setShowChange(false);
                toast("密码已修改，请牢记新密码");
              },
              onCancel: () => setShowChange(false)
            })
          )
        )
      : null
  );
}
