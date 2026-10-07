// app.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { cloudConfigured, getSession, signIn, signOut, loadRemote, saveRemote } from "./cloud.js";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  Home,
  Plus,
  Package,
  BarChart2,
  Bell,
  Settings,
  Search,
  Filter,
  Upload,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileSpreadsheet,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
var DEFAULT_PLATFORMS = [
  { id: "shopee", name: "Shopee", color: "#EE4D2D", feePercent: 5 },
  { id: "lazada", name: "Lazada", color: "#0F146D", feePercent: 4 },
  { id: "tiktok", name: "TikTok Shop", color: "#111111", feePercent: 3.5 },
  { id: "facebook", name: "Facebook", color: "#1877F2", feePercent: 0 },
  { id: "lineoa", name: "Line OA", color: "#06C755", feePercent: 0 },
  { id: "offline", name: "\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E49\u0E32\u0E19/\u0E2D\u0E37\u0E48\u0E19\u0E46", color: "#B8862F", feePercent: 0 }
];
var NAV_ITEMS = [
  { id: "dashboard", label: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21", icon: Home },
  { id: "sales", label: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01", icon: Plus },
  { id: "products", label: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32", icon: Package },
  { id: "analytics", label: "\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C", icon: BarChart2 },
  { id: "recon", label: "ตรวจเช็ค", icon: Check }
];
var DATE_PRESETS = [
  { id: "today", label: "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49" },
  { id: "yesterday", label: "\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E27\u0E32\u0E19" },
  { id: "7d", label: "7 \u0E27\u0E31\u0E19" },
  { id: "month", label: "\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E19\u0E35\u0E49" },
  { id: "lastMonth", label: "\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E49\u0E27" },
  { id: "custom", label: "\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E2D\u0E07" }
];
var fmtCurrency = (n) => "\u0E3F" + (Math.round((n || 0) * 100) / 100).toLocaleString("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});
var fmtNumber = (n) => (n || 0).toLocaleString("th-TH");
var fmtDateShort = (d) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function getRange(preset, customStart, customEnd) {
  const now = /* @__PURE__ */ new Date();
  if (preset === "today") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }
  if (preset === "7d") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: startOfDay(s), end: endOfDay(now) };
  }
  if (preset === "month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfDay(s), end: endOfDay(now) };
  }
  if (preset === "lastMonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: startOfDay(s), end: endOfDay(e) };
  }
  if (preset === "custom" && customStart && customEnd) {
    return { start: startOfDay(customStart), end: endOfDay(customEnd) };
  }
  return { start: startOfDay(now), end: endOfDay(now) };
}
function getPreviousRange(start, end) {
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: startOfDay(prevStart), end: endOfDay(prevEnd) };
}
function computeSaleMetrics(sale, product, platform) {
  if (sale.status === "returned" || sale.status === "lost") {
    const uc = sale.unitCost != null ? sale.unitCost : product?.cost || 0;
    const extra = sale.lossExtra || 0;
    const comp = sale.status === "lost" ? sale.compensation || 0 : 0;
    const cost = sale.status === "returned" && sale.restocked ? 0 : uc * (sale.quantity || 0);
    return { gross: 0, coupon: 0, fee: 0, otherExpense: extra, netRevenue: comp - extra, cost, profit: comp - extra - cost };
  }
  const gross = (sale.price || 0) * (sale.quantity || 0);
  const coupon = sale.coupon || 0;
  const fee = sale.fee != null ? sale.fee : gross * ((platform?.feePercent || 0) / 100);
  const otherExpense = sale.otherExpense || 0;
  const netRevenue = gross - coupon - fee - otherExpense;
  const unitCost = sale.unitCost != null ? sale.unitCost : product?.cost || 0;
  const cost = unitCost * (sale.quantity || 0);
  const profit = netRevenue - cost;
  return { gross, coupon, fee, otherExpense, netRevenue, cost, profit };
}
function aggregate(sales, products, platforms) {
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p]));
  let gross = 0, coupon = 0, fee = 0, netRevenue = 0, cost = 0, profit = 0, orders = 0, loss = 0, lossCount = 0;
  const orderSet = /* @__PURE__ */ new Set();
  for (const s of sales) {
    const m = computeSaleMetrics(s, productMap[s.productId], platformMap[s.platformId]);
    if (s.status === "returned" || s.status === "lost") { lossCount++; loss -= m.profit; } else orderSet.add(s.orderId || s.id);
    gross += m.gross;
    coupon += m.coupon;
    fee += m.fee;
    netRevenue += m.netRevenue;
    cost += m.cost;
    profit += m.profit;
  }
  const margin = gross > 0 ? profit / gross * 100 : 0;
  return { gross, coupon, fee, netRevenue, cost, profit, orders: orderSet.size, margin, loss, lossCount };
}
function expenseForRange(expenses, start, end) {
  let total = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  const dayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (cur <= last) {
    const y = cur.getFullYear(), mo = cur.getMonth();
    const key = y + "-" + String(mo + 1).padStart(2, "0");
    const dim = new Date(y, mo + 1, 0).getDate();
    const ms = new Date(y, mo, 1), me = new Date(y, mo, dim, 23, 59, 59, 999);
    const os = start > ms ? start : ms, oe = end < me ? end : me;
    const days = Math.max(0, Math.round((dayOf(oe) - dayOf(os)) / 864e5) + 1);
    const monthSum = expenses.reduce((a, e) => a + (e.bill ? 0 : (e.recurring ? e.month <= key : e.month === key) ? e.amount : 0), 0);
    total += monthSum * days / dim;
    cur.setMonth(cur.getMonth() + 1);
  }
  const sd = dayOf(start), ed = dayOf(end);
  for (const e of expenses) if (e.bill) { const [y, m] = e.month.split("-").map(Number); const monthEnd = new Date(y, m, 0); if (monthEnd >= sd && monthEnd <= ed) total += e.amount; }
  return total;
}
function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const slipDb = () => new Promise((res, rej) => { const r = indexedDB.open("mies-slips", 1); r.onupgradeneeded = () => r.result.createObjectStore("slips"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const slipTx = async (mode, fn) => { const db = await slipDb(); return new Promise((res, rej) => { const t = db.transaction("slips", mode); const q = fn(t.objectStore("slips")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
const slipPut = (id, data) => slipTx("readwrite", (st) => st.put(data, id));
const slipGet = (id) => slipTx("readonly", (st) => st.get(id));
const slipDel = (id) => slipTx("readwrite", (st) => st.delete(id));
async function slipAll() {
  const db = await slipDb();
  return new Promise((res, rej) => { const out = {}; const q = db.transaction("slips").objectStore("slips").openCursor(); q.onsuccess = () => { const c = q.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; q.onerror = () => rej(q.error); });
}
function stableStr(v) {
  return JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x);
}
function mergeById(base, local, remote, fix) {
  const b = new Map((base || []).map((x) => [x.id, x]));
  const l = new Map((local || []).map((x) => [x.id, x]));
  const r = new Map((remote || []).map((x) => [x.id, x]));
  const out = [];
  for (const id of /* @__PURE__ */ new Set([...l.keys(), ...r.keys()])) {
    const lv = l.get(id), rv = r.get(id), bv = b.get(id);
    if (lv && !rv) { if (!bv) out.push(lv); }
    else if (rv && !lv) { if (!bv) out.push(rv); }
    else if (stableStr(lv) !== stableStr(bv)) out.push(fix ? fix(lv, rv, bv) : lv);
    else out.push(rv);
  }
  return out;
}
function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return (current - previous) / previous * 100;
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function Trend({ value, hasBaseline }) {
  if (!hasBaseline) return null;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return /* @__PURE__ */ React.createElement("span", { className: "trend " + (up ? "trend-up" : "trend-down") }, /* @__PURE__ */ React.createElement(Icon, { size: 13, strokeWidth: 2.5 }), Math.abs(value).toFixed(1), "%");
}
function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }) {
  return /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "empty-icon" }, /* @__PURE__ */ React.createElement(Icon, { size: 26, strokeWidth: 1.6 })), /* @__PURE__ */ React.createElement("div", { className: "empty-title" }, title), subtitle && /* @__PURE__ */ React.createElement("div", { className: "empty-subtitle" }, subtitle), actionLabel && /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: onAction }, /* @__PURE__ */ React.createElement(Plus, { size: 16 }), " ", actionLabel));
}
function StockDot({ status }) {
  const cls = status === "\u0E2B\u0E21\u0E14" ? "dot dot-danger" : status === "\u0E43\u0E01\u0E25\u0E49\u0E2B\u0E21\u0E14" ? "dot dot-warning" : "dot dot-success";
  return /* @__PURE__ */ React.createElement("span", { className: cls });
}
function getStockStatus(p) {
  if (p.stock <= 0) return "\u0E2B\u0E21\u0E14";
  if (p.stock <= (p.lowStockThreshold ?? 5)) return "\u0E43\u0E01\u0E25\u0E49\u0E2B\u0E21\u0E14";
  return "\u0E1B\u0E01\u0E15\u0E34";
}
function Sidebar({ active, onChange, lowStockCount }) {
  return /* @__PURE__ */ React.createElement("aside", { className: "sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar-brand" }, /* @__PURE__ */ React.createElement("div", { className: "brand-mark" }, "M"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "brand-name" }, "MIES TRADING"), /* @__PURE__ */ React.createElement("div", { className: "brand-sub" }, "Sales Dashboard"))), /* @__PURE__ */ React.createElement("nav", { className: "sidebar-nav" }, NAV_ITEMS.map((item) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: item.id,
      className: "sidebar-item " + (active === item.id ? "active" : ""),
      onClick: () => onChange(item.id)
    },
    /* @__PURE__ */ React.createElement(item.icon, { size: 18, strokeWidth: 2 }),
    /* @__PURE__ */ React.createElement("span", null, item.label),
    item.id === "products" && lowStockCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "nav-badge" }, lowStockCount)
  ))), /* @__PURE__ */ React.createElement("div", { className: "sidebar-footer" }, /* @__PURE__ */ React.createElement("button", { className: "sidebar-item" }, /* @__PURE__ */ React.createElement(Settings, { size: 18, strokeWidth: 2 }), /* @__PURE__ */ React.createElement("span", null, "Settings"))));
}
function BottomNav({ active, onChange }) {
  return /* @__PURE__ */ React.createElement("nav", { className: "bottom-nav" }, NAV_ITEMS.map((item) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: item.id,
      className: "bottom-nav-item " + (active === item.id ? "active" : ""),
      onClick: () => onChange(item.id)
    },
    /* @__PURE__ */ React.createElement(item.icon, { size: 20, strokeWidth: active === item.id ? 2.4 : 2 }),
    /* @__PURE__ */ React.createElement("span", null, item.label)
  )));
}
function Header({ title, subtitle, lowStockCount }) {
  return /* @__PURE__ */ React.createElement("header", { className: "app-header" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "header-title" }, title), subtitle && /* @__PURE__ */ React.createElement("div", { className: "header-subtitle" }, subtitle)), /* @__PURE__ */ React.createElement("div", { className: "header-actions" }, /* @__PURE__ */ React.createElement("button", { className: "icon-btn" }, /* @__PURE__ */ React.createElement(Bell, { size: 18 }), lowStockCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "icon-badge" })), /* @__PURE__ */ React.createElement("button", { className: "avatar-btn" }, "MI")));
}
function DateFilter({ preset, setPreset, customRange, setCustomRange }) {
  const [open, setOpen] = useState(false);
  const current = DATE_PRESETS.find((d) => d.id === preset);
  return /* @__PURE__ */ React.createElement("div", { className: "date-filter" }, /* @__PURE__ */ React.createElement("button", { className: "date-filter-trigger", onClick: () => setOpen((o) => !o) }, /* @__PURE__ */ React.createElement("span", null, current?.label), /* @__PURE__ */ React.createElement(ChevronDown, { size: 15, className: open ? "chev-open" : "" })), open && /* @__PURE__ */ React.createElement("div", { className: "date-filter-panel" }, DATE_PRESETS.map((d) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: d.id,
      className: "date-pill " + (preset === d.id ? "active" : ""),
      onClick: () => {
        setPreset(d.id);
        if (d.id !== "custom") setOpen(false);
      }
    },
    d.label
  )), preset === "custom" && /* @__PURE__ */ React.createElement("div", { className: "custom-range-row" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: customRange.start,
      onChange: (e) => setCustomRange({ ...customRange, start: e.target.value })
    }
  ), /* @__PURE__ */ React.createElement("span", null, "\u0E16\u0E36\u0E07"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: customRange.end,
      onChange: (e) => setCustomRange({ ...customRange, end: e.target.value })
    }
  ), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => setOpen(false) }, "\u0E15\u0E01\u0E25\u0E07"))));
}
function ProfitHero({ profit, trend, hasBaseline, expense, pending, loss, lossCount }) {
  return /* @__PURE__ */ React.createElement("div", { className: "hero-card" }, /* @__PURE__ */ React.createElement("div", { className: "hero-label" }, "NET PROFIT"), /* @__PURE__ */ React.createElement("div", { className: "hero-value" }, fmtCurrency(profit)), expense > 0 && /* @__PURE__ */ React.createElement("div", { className: "hero-trend-caption", style: { marginTop: 4 } }, "หักรายจ่าย/บิลแล้ว " + fmtCurrency(expense)), pending > 0 && /* @__PURE__ */ React.createElement("div", { className: "hero-trend-caption", style: { marginTop: 4 } }, "บิลเดือนนี้สะสม " + fmtCurrency(pending) + " (หักตอนสิ้นเดือน)"), lossCount > 0 && /* @__PURE__ */ React.createElement("div", { className: "hero-trend-caption", style: { marginTop: 4 } }, "รวมขาดทุนตีกลับ/สูญหายแล้ว " + fmtCurrency(loss) + " (" + lossCount + " รายการ)"), /* @__PURE__ */ React.createElement("div", { className: "hero-trend-row" }, /* @__PURE__ */ React.createElement(Trend, { value: trend, hasBaseline }), hasBaseline && /* @__PURE__ */ React.createElement("span", { className: "hero-trend-caption" }, "\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E0A\u0E48\u0E27\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32")), /* @__PURE__ */ React.createElement("svg", { className: "hero-deco", viewBox: "0 0 300 90", preserveAspectRatio: "none" }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M0,70 C40,50 60,80 100,55 C140,30 160,60 200,35 C240,10 260,45 300,20",
      fill: "none",
      stroke: "#B8862F",
      strokeOpacity: "0.35",
      strokeWidth: "2"
    }
  )));
}
function KPIGrid({ current, previous, hasBaseline }) {
  const items = [
    { label: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22", value: current.gross, prev: previous.gross },
    { label: "\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19", value: current.cost, prev: previous.cost },
    { label: "\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C", value: current.orders, prev: previous.orders, isCount: true },
    { label: "Margin", value: current.margin, prev: previous.margin, isPercent: true }
  ];
  return /* @__PURE__ */ React.createElement("div", { className: "kpi-grid" }, items.map((it) => /* @__PURE__ */ React.createElement("div", { className: "kpi-card", key: it.label }, /* @__PURE__ */ React.createElement("div", { className: "kpi-label" }, it.label), /* @__PURE__ */ React.createElement("div", { className: "kpi-value" }, it.isPercent ? it.value.toFixed(1) + "%" : it.isCount ? fmtNumber(it.value) : fmtCurrency(it.value)), /* @__PURE__ */ React.createElement(Trend, { value: pctChange(it.value, it.prev), hasBaseline }))));
}
function SalesChart({ sales, products, platforms }) {
  const [metric, setMetric] = useState("sales");
  const [range, setRange] = useState(7);
  const data = useMemo(() => {
    const days = [];
    const now = /* @__PURE__ */ new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({ key: startOfDay(d).getTime(), label: fmtDateShort(d) });
    }
    const byDay = {};
    days.forEach((d) => byDay[d.key] = { gross: 0, profit: 0 });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p]));
    sales.forEach((s) => {
      const k = startOfDay(s.date).getTime();
      if (byDay[k] == null) return;
      const m = computeSaleMetrics(s, productMap[s.productId], platformMap[s.platformId]);
      byDay[k].gross += m.gross;
      byDay[k].profit += m.profit;
    });
    return days.map((d) => ({
      label: d.label,
      value: metric === "sales" ? byDay[d.key].gross : byDay[d.key].profit
    }));
  }, [sales, products, platforms, range, metric]);
  const color = metric === "sales" ? "#173D35" : "#B8862F";
  return /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-head" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("div", { className: "chart-controls" }, /* @__PURE__ */ React.createElement("div", { className: "toggle-group" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: metric === "sales" ? "toggle active" : "toggle",
      onClick: () => setMetric("sales")
    },
    "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: metric === "profit" ? "toggle active" : "toggle",
      onClick: () => setMetric("profit")
    },
    "\u0E01\u0E33\u0E44\u0E23"
  )), /* @__PURE__ */ React.createElement("div", { className: "toggle-group" }, [7, 30].map((r) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: r,
      className: range === r ? "toggle toggle-sm active" : "toggle toggle-sm",
      onClick: () => setRange(r)
    },
    r,
    " \u0E27\u0E31\u0E19"
  ))))), /* @__PURE__ */ React.createElement("div", { className: "chart-wrap" }, /* @__PURE__ */ React.createElement(ResponsiveContainer, { width: "100%", height: 220 }, /* @__PURE__ */ React.createElement(AreaChart, { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "chartFill", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: color, stopOpacity: 0.28 }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: color, stopOpacity: 0 }))), /* @__PURE__ */ React.createElement(CartesianGrid, { strokeDasharray: "3 5", vertical: false, stroke: "#E3E6E2" }), /* @__PURE__ */ React.createElement(
    XAxis,
    {
      dataKey: "label",
      tick: { fontSize: 11, fill: "#68706B" },
      axisLine: false,
      tickLine: false,
      interval: range === 30 ? 4 : 0
    }
  ), /* @__PURE__ */ React.createElement(
    YAxis,
    {
      tick: { fontSize: 11, fill: "#68706B" },
      axisLine: false,
      tickLine: false,
      width: 44,
      tickFormatter: (v) => v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : v
    }
  ), /* @__PURE__ */ React.createElement(
    Tooltip,
    {
      formatter: (v) => fmtCurrency(v),
      contentStyle: {
        borderRadius: 12,
        border: "1px solid #E3E6E2",
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(15,43,38,0.12)"
      },
      labelStyle: { color: "#1C201D", fontWeight: 600 }
    }
  ), /* @__PURE__ */ React.createElement(Area, { type: "monotone", dataKey: "value", stroke: color, strokeWidth: 2.4, fill: "url(#chartFill)" })))));
}
function PlatformPerformance({ sales, products, platforms }) {
  const rows = useMemo(() => {
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    const totals = platforms.map((pl) => {
      const plSales = sales.filter((s) => s.platformId === pl.id);
      const agg = aggregate(plSales, products, platforms);
      return { ...pl, gross: agg.gross, profit: agg.profit };
    });
    const grandGross = totals.reduce((a, b) => a + b.gross, 0);
    return totals.filter((t) => t.gross > 0).map((t) => ({ ...t, share: grandGross > 0 ? t.gross / grandGross * 100 : 0 })).sort((a, b) => b.gross - a.gross);
  }, [sales, products, platforms]);
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  return /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-head" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E15\u0E32\u0E21\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07")), rows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22") : /* @__PURE__ */ React.createElement("div", { className: "platform-list" }, rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { className: "platform-row", key: r.id }, /* @__PURE__ */ React.createElement("div", { className: "platform-rank" }, i < 3 ? medals[i] : i + 1), /* @__PURE__ */ React.createElement("span", { className: "platform-dot", style: { background: r.color } }), /* @__PURE__ */ React.createElement("div", { className: "platform-info" }, /* @__PURE__ */ React.createElement("div", { className: "platform-name" }, r.name), /* @__PURE__ */ React.createElement("div", { className: "platform-bar-track" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "platform-bar-fill",
      style: { width: r.share + "%", background: r.color }
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "platform-figures" }, /* @__PURE__ */ React.createElement("div", { className: "platform-value" }, fmtCurrency(r.gross)), /* @__PURE__ */ React.createElement("div", { className: "platform-share" }, r.share.toFixed(0), "%"))))));
}
function TopProducts({ sales, products }) {
  const rows = useMemo(() => {
    const byProduct = {};
    sales.forEach((s) => {
      const p = products.find((pp) => pp.id === s.productId);
      if (!p) return;
      const m = computeSaleMetrics(s, p, null);
      if (!byProduct[p.id]) byProduct[p.id] = { product: p, qty: 0, gross: 0, profit: 0 };
      byProduct[p.id].qty += s.status === "returned" || s.status === "lost" ? 0 : s.quantity;
      byProduct[p.id].gross += m.gross;
      byProduct[p.id].profit += m.profit;
    });
    return Object.values(byProduct).sort((a, b) => b.gross - a.gross).slice(0, 5);
  }, [sales, products]);
  return /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-head" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E02\u0E32\u0E22\u0E14\u0E35")), rows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E02\u0E32\u0E22\u0E14\u0E35") : /* @__PURE__ */ React.createElement("div", { className: "top-product-list" }, rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { className: "top-product-row", key: r.product.id }, /* @__PURE__ */ React.createElement("div", { className: "rank-chip" }, i + 1), /* @__PURE__ */ React.createElement("div", { className: "tp-info" }, /* @__PURE__ */ React.createElement("div", { className: "tp-name" }, r.product.name), /* @__PURE__ */ React.createElement("div", { className: "tp-sub" }, fmtNumber(r.qty), " \u0E0A\u0E34\u0E49\u0E19")), /* @__PURE__ */ React.createElement("div", { className: "tp-figures" }, /* @__PURE__ */ React.createElement("div", { className: "tp-gross" }, fmtCurrency(r.gross)), /* @__PURE__ */ React.createElement("div", { className: "tp-profit" }, "\u0E01\u0E33\u0E44\u0E23 ", fmtCurrency(r.profit), r.gross > 0 ? " (" + (Math.round(r.profit / r.gross * 1000) / 10) + "%)" : ""))))));
}
function LowStockAlert({ products, onNavigate }) {
  const lowStock = products.filter((p) => getStockStatus(p) !== "\u0E1B\u0E01\u0E15\u0E34");
  if (lowStock.length === 0) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "alert-card", onClick: onNavigate }, /* @__PURE__ */ React.createElement("div", { className: "alert-icon" }, /* @__PURE__ */ React.createElement(AlertTriangle, { size: 18, strokeWidth: 2 })), /* @__PURE__ */ React.createElement("div", { className: "alert-text" }, "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E01\u0E25\u0E49\u0E2B\u0E21\u0E14 ", lowStock.length, " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"), /* @__PURE__ */ React.createElement(ChevronRight, { size: 16 }));
}
function RecentSales({ sales, products, platforms }) {
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p]));
  const rows = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  return /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-head" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14")), rows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22") : /* @__PURE__ */ React.createElement("div", { className: "tx-list" }, rows.map((s) => {
    const p = productMap[s.productId];
    const pl = platformMap[s.platformId];
    const m = computeSaleMetrics(s, p, pl);
    return /* @__PURE__ */ React.createElement("div", { className: "tx-row", key: s.id }, /* @__PURE__ */ React.createElement("span", { className: "tx-dot", style: { background: pl?.color || "#999" } }), /* @__PURE__ */ React.createElement("div", { className: "tx-info" }, /* @__PURE__ */ React.createElement("div", { className: "tx-name" }, p?.name || "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E21\u0E48\u0E1E\u0E1A"), /* @__PURE__ */ React.createElement("div", { className: "tx-sub" }, pl?.name, " \xB7 ", fmtDateShort(s.date), " \xB7 x", s.quantity)), /* @__PURE__ */ React.createElement("div", { className: "tx-figures" }, /* @__PURE__ */ React.createElement("div", { className: "tx-gross" }, fmtCurrency(m.gross)), /* @__PURE__ */ React.createElement("div", { className: "tx-profit" }, "\u0E01\u0E33\u0E44\u0E23 ", fmtCurrency(m.profit))));
  })));
}
function Dashboard({ sales, products, platforms, expenses, dateState, setDateState, onGoto }) {
  const { preset, customRange } = dateState;
  const { start, end } = getRange(preset, customRange.start, customRange.end);
  const filteredSales = sales.filter((s) => {
    const d = new Date(s.date);
    return d >= start && d <= end;
  });
  const { start: pStart, end: pEnd } = getPreviousRange(start, end);
  const prevSales = sales.filter((s) => {
    const d = new Date(s.date);
    return d >= pStart && d <= pEnd;
  });
  const withExp = (a, st, en) => { const e = expenseForRange(expenses || [], st, en); const profit = a.profit - e; return { ...a, profit, expense: e, margin: a.gross > 0 ? profit / a.gross * 100 : 0 }; };
  const current = withExp(aggregate(filteredSales, products, platforms), start, end);
  const previous = withExp(aggregate(prevSales, products, platforms), pStart, pEnd);
  const endKey = end.getFullYear() + "-" + String(end.getMonth() + 1).padStart(2, "0");
  const pendingBills = new Date(end.getFullYear(), end.getMonth() + 1, 0) > new Date(end.getFullYear(), end.getMonth(), end.getDate()) ? (expenses || []).filter((e) => e.bill && e.month === endKey).reduce((a, e) => a + e.amount, 0) : 0;
  const hasBaseline = prevSales.length > 0;
  if (sales.length === 0) {
    return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "MIES TRADING", subtitle: "Sales Overview", lowStockCount: 0 }), /* @__PURE__ */ React.createElement(
      EmptyState,
      {
        icon: BarChart2,
        title: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22",
        subtitle: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E39\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E18\u0E38\u0E23\u0E01\u0E34\u0E08\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13",
        actionLabel: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22",
        onAction: () => onGoto("sales")
      }
    ));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(
    Header,
    {
      title: "MIES TRADING",
      subtitle: "Sales Overview",
      lowStockCount: products.filter((p) => getStockStatus(p) !== "\u0E1B\u0E01\u0E15\u0E34").length
    }
  ), /* @__PURE__ */ React.createElement(
    DateFilter,
    {
      preset,
      setPreset: (p) => setDateState({ ...dateState, preset: p }),
      customRange,
      setCustomRange: (c) => setDateState({ ...dateState, customRange: c })
    }
  ), /* @__PURE__ */ React.createElement(
    ProfitHero,
    {
      profit: current.profit,
      trend: pctChange(current.profit, previous.profit),
      hasBaseline,
      expense: current.expense,
      pending: pendingBills,
      loss: current.loss,
      lossCount: current.lossCount
    }
  ), /* @__PURE__ */ React.createElement(KPIGrid, { current, previous, hasBaseline }), /* @__PURE__ */ React.createElement(SalesChart, { sales, products, platforms }), /* @__PURE__ */ React.createElement(LowStockAlert, { products, onNavigate: () => onGoto("products") }), /* @__PURE__ */ React.createElement(PlatformPerformance, { sales: filteredSales, products, platforms }), /* @__PURE__ */ React.createElement(TopProducts, { sales: filteredSales, products }), /* @__PURE__ */ React.createElement(RecentSales, { sales, products, platforms }));
}
const BKK = "Asia/Bangkok";
const bkkParts = (d) => { const o = {}; new Intl.DateTimeFormat("en-CA", { timeZone: BKK, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(d)).forEach((p) => { o[p.type] = p.value; }); return o; };
const bkkDate = (d) => { const o = bkkParts(d); return o.year + "-" + o.month + "-" + o.day; };
const hm = (d) => { const o = bkkParts(d); return o.hour + ":" + o.minute; };
const fmtBkkDate = (d) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: BKK });
function fmtTime(iso) { return !iso || String(iso).endsWith("T00:00:00.000Z") ? "" : hm(new Date(iso)); }
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    sc.onload = () => res(window.Tesseract);
    sc.onerror = () => rej(new Error("load"));
    document.head.appendChild(sc);
  });
}
function parseOrderText(raw, products, platforms) {
  const tone = /[\u0E48-\u0E4B]/g;
  const orig = raw.replace(/[฿\u00A0]/g, " ");
  const compact = orig.replace(tone, "").replace(/\s+/g, "");
  const num = (m) => { if (!m) return null; const v = parseFloat(m[1].replace(/,/g, "")); return isNaN(v) ? null : v; };
  const n = "\\D{0,4}?(\\d[\\d,]*(?:\\.\\d+)?)";
  const gross = num(compact.match(new RegExp("รวมคาสินคา" + n)));
  const net = num(compact.match(new RegExp("ยอดสุทธิ" + n)));
  let fee = num(compact.match(new RegExp("คาธรรมเนียมและคาบริการ" + n)));
  if (fee == null && gross != null && net != null && gross >= net) fee = Math.round((gross - net) * 100) / 100;
  const om = orig.toUpperCase().match(/\b(\d{6})\s?((?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,10})\b/);
  const orderNo = om ? om[1] + om[2] : "";
  let date = "";
  if (orderNo) { const yy = orderNo.slice(0, 2), mm = orderNo.slice(2, 4), dd = orderNo.slice(4, 6); if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) date = "20" + yy + "-" + mm + "-" + dd; }
  const qm = orig.match(/(?:^|\s)[xX×]\s?(\d{1,3})(?:\s|$)/m);
  const qty = qm ? parseInt(qm[1], 10) : 1;
  const up = orig.toUpperCase();
  const norm = (x) => String(x || "").toUpperCase().replace(/[\u0E48-\u0E4B]/g, "").replace(/[^A-Z0-9\u0E00-\u0E7F]/g, "");
  const hay = norm(orig);
  const bad = /ค่า|ยอด|Order|Adjustment|หมายเลข|COPY|ชำระ|ผู้ซื้อ|จัดส่ง|บริการ|ข้อมูล/i;
  const nameLine = orig.split("\n").map((l) => l.trim()).find((l) => l.length >= 8 && !bad.test(l) && (l.match(/[A-Za-z]{3,}/g) || []).length >= 2) || "";
  const scanName = nameLine.split("[")[0].replace(/[….]+$/, "").trim();
  const cands = products.map((p) => {
    const names = [p.name, ...String(p.aliases || "").split("\n")].map((x) => x.trim()).filter(Boolean);
    let score = 0;
    names.forEach((nm) => {
      const c = norm(nm);
      let sc = 0;
      if (c.length >= 4 && hay.includes(c)) sc = 100 + c.length;
      else sc = nm.toUpperCase().split(/[^A-Z0-9\u0E00-\u0E7F]+/).filter((w) => w.length >= 3).filter((w) => up.includes(w)).length;
      if (sc > score) score = sc;
    });
    const vtxt = (orig.match(/\[([^\]\n]{2,30})\]/) || [])[1];
    if (vtxt && score > 0 && norm(p.name).includes(norm(vtxt))) score += 200;
    if (p.sku && up.includes(String(p.sku).toUpperCase())) score += 3;
    return { id: p.id, name: p.name, score };
  }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, 3);
  const top = cands[0], second = cands[1];
  const productId = top && (top.score >= 100 || (top.score >= 2 && (!second || top.score > second.score))) ? top.id : "";
  const pl = platforms.find((p) => up.includes(p.name.toUpperCase())) || (compact.includes("คาธรรมเนียมและคาบริการ") ? platforms.find((p) => /shopee/i.test(p.name)) : null);
  const MONTHS = { "มค": 1, "กพ": 2, "มีค": 3, "มค1": 1, "เมย": 4, "พค": 5, "มิย": 6, "กค": 7, "สค": 8, "กย": 9, "ตค": 10, "พย": 11, "ธค": 12, "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12 };
  const parseDT = (str) => {
    let m = str.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s+(\d{1,2}):(\d{2})/);
    let d, mo, y, h, mi;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; h = +m[4]; mi = m[5]; }
    else {
      m = str.match(/(\d{1,2})\s*([ก-๙][ก-๙.\s]{0,9}?)\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (!m) return "";
      mo = MONTHS[m[2].replace(/[.\s\u0E48-\u0E4B]/g, "")]; if (!mo) return "";
      d = +m[1]; y = +m[3]; h = +m[4]; mi = m[5];
    }
    if (y > 2400) y -= 543;
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return "";
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0") + "T" + String(h).padStart(2, "0") + ":" + mi;
  };
  const li = orig.search(/เวลา(?:ที่)?สั่งซื้อ|Order\s*Time/i);
  const orderAt = (li >= 0 ? parseDT(orig.slice(li, li + 70)) : "") || parseDT(orig);
  const nl = orig.split("\n").map((l) => l.trim()).filter(Boolean);
  const ni = nl.findIndex((l) => l === nameLine);
  const userTok = (l) => {
    const t = l.replace(/[\u0E00-\u0E7F]/g, " ").replace(/[^A-Za-z0-9._\-]+$/, "").trim().split(/\s+/).filter(Boolean);
    const last = t[t.length - 1] || "";
    if (t.length > 2 || !/^[A-Za-z0-9._\-]{4,30}$/.test(last) || /^[-.]?[B฿]?\d+$/i.test(last) || /^[-.]/.test(last)) return "";
    return last.toUpperCase() === orderNo ? "" : last;
  };
  const pw = new Set();
  products.forEach((p) => [p.name, ...String(p.aliases || "").split("\n")].forEach((x) => String(x || "").toUpperCase().split(/[^A-Z0-9]+/).forEach((w) => { if (w) pw.add(w); })));
  const okTok = (t) => t && /[A-Za-z]/.test(t) && !pw.has(t.toUpperCase());
  const oi = orderNo ? nl.findIndex((l) => l.toUpperCase().replace(/\s+/g, "").includes(orderNo)) : -1;
  let customer = "";
  if (oi > 0) {
    for (let k = oi - 1; k >= Math.max(0, oi - 8) && !customer; k--) {
      if (bad.test(nl[k])) continue;
      const t = userTok(nl[k]);
      if (okTok(t)) customer = t;
    }
  }
  if (!customer) customer = nl.filter((l) => !bad.test(l)).map(userTok).find((t) => okTok(t) && /\d/.test(t)) || "";
  return { gross, net, fee, qty, orderNo, date, orderAt, customer, productId, cands, scanName, platformId: pl ? pl.id : "" };
}
function QuickSaleForm({ products, platforms, onSubmit, initial, onCancel, sales, onLearn }) {
  const todayStr = () => bkkDate(/* @__PURE__ */ new Date());
  const r2 = (n) => Math.round((n || 0) * 100) / 100;
  const [items, setItems] = useState([{ productId: initial?.productId || "", quantity: initial?.quantity ?? 1, price: initial ? String(initial.price) : "" }]);
  const setItem = (i, patch) => setItems((prev) => prev.map((x, k) => k === i ? { ...x, ...patch } : x));
  const productId = items[0].productId;
  const setProductId = (v) => setItem(0, { productId: v });
  const setQuantity = (v) => setItem(0, { quantity: v });
  const setPrice = (v) => setItem(0, { price: v });
  const [platformId, setPlatformId] = useState(initial?.platformId || "");
  const [coupon, setCoupon] = useState(initial?.coupon ?? 0);
  const [feeIn, setFeeIn] = useState(initial ? { mode: "baht", value: String(initial.fee ?? 0) } : { mode: "pct", value: "0" });
  const [otherIn, setOtherIn] = useState({ mode: "baht", value: initial ? String(initial.otherExpense || 0) : "" });
  const [feeTouched, setFeeTouched] = useState(!!initial);
  const [orderNo, setOrderNo] = useState(initial?.orderNo || "");
  const [customer, setCustomer] = useState(initial?.customer || "");
  const [orderAt, setOrderAt] = useState(initial?.orderAt ? bkkDate(initial.orderAt) + "T" + hm(initial.orderAt) : "");
  const [time, setTime] = useState(initial ? fmtTime(initial.date) : hm(/* @__PURE__ */ new Date()));
  const [scanMsg, setScanMsg] = useState("");
  const [scanInfo, setScanInfo] = useState(null);
  async function scan(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setScanMsg("กำลังโหลดตัวอ่านรูป (ครั้งแรกใช้เวลาสักครู่)…");
    try {
      const T = await loadTesseract();
      const worker = await T.createWorker("tha+eng", 1, { logger: (m) => { if (m.status === "recognizing text") setScanMsg("กำลังอ่านรูป… " + Math.round((m.progress || 0) * 100) + "%"); } });
      const { data } = await worker.recognize(f);
      await worker.terminate();
      const r = parseOrderText(data.text || "", products, platforms);
      if (r.productId) setProductId(r.productId);
      setScanInfo({ name: r.scanName, guess: r.productId, cands: r.cands });
      setQuantity(r.qty || 1);
      if (r.gross != null) setPrice(String(Math.round(r.gross / (r.qty || 1) * 100) / 100));
      if (r.platformId) setPlatformId(r.platformId);
      if (r.fee != null) { setFeeIn({ mode: "baht", value: String(r.fee) }); setFeeTouched(true); }
      if (r.date) setDate(r.date);
      if (r.orderNo) setOrderNo(r.orderNo);
      if (r.orderAt) setOrderAt(r.orderAt);
      if (r.customer && !customer.trim()) setCustomer(r.customer);
      const miss = [!r.productId && "สินค้า", r.gross == null && "ราคา", r.fee == null && "ค่าธรรมเนียม", !r.platformId && "Platform"].filter(Boolean);
      const dup = r.orderNo && (sales || []).some((x) => x.orderNo === r.orderNo);
      setScanMsg((dup ? "⚠ ออเดอร์นี้เคยบันทึกแล้ว! " : "") + "อ่านรูปเสร็จ กรุณาตรวจค่าให้ถูกต้องก่อนบันทึก" + (miss.length ? " (อ่านไม่ได้: " + miss.join(", ") + ")" : "") + (!r.productId && r.scanName ? " — เลือกสินค้าเอง ระบบจะจำชื่อ \"" + r.scanName + "\" ไว้ให้ครั้งต่อไป" : ""));
    } catch (err) { setScanMsg("อ่านรูปไม่สำเร็จ (ต้องต่ออินเทอร์เน็ตในครั้งแรก) กรอกเองได้เลย"); }
  }
  const [date, setDate] = useState(initial ? bkkDate(initial.date) : todayStr());
  const lines = items.map((it) => ({ ...it, product: products.find((p) => p.id === it.productId), g: (parseFloat(it.price) || 0) * (parseFloat(it.quantity) || 0) }));
  const gross = lines.reduce((a, l) => a + l.g, 0);
  function resolve(inp) {
    const v = parseFloat(inp.value) || 0;
    return inp.mode === "pct" ? { baht: Math.round(gross * v) / 100, pct: v } : { baht: v, pct: gross > 0 ? v / gross * 100 : 0 };
  }
  const fee = resolve(feeIn);
  const other = resolve(otherIn);
  const couponNum = parseFloat(coupon) || 0;
  const cn = (x) => String(x || "").trim().toLowerCase();
  const custInfo = (() => {
    if (!cn(customer)) return null;
    const mine = (sales || []).filter((x) => cn(x.customer) === cn(customer) && !x.status && !(initial && initial.orderId && x.orderId === initial.orderId) && !(initial && x.id === initial.id));
    return { n: new Set(mine.map((x) => x.orderId || x.id)).size, total: mine.reduce((a, x) => a + (x.price || 0) * (x.quantity || 0), 0) };
  })();
  const cost = lines.reduce((a, l) => a + (l.product?.cost || 0) * (parseFloat(l.quantity) || 0), 0);
  const profit = gross - couponNum - fee.baht - other.baht - cost;
  const canSubmit = platformId && lines.every((l) => l.productId && parseFloat(l.price) > 0 && parseFloat(l.quantity) > 0);
  function handlePlatformChange(id) {
    setPlatformId(id);
    if (!feeTouched) {
      const pl = platforms.find((p) => p.id === id);
      setFeeIn({ mode: "pct", value: String(pl?.feePercent || 0) });
    }
  }
  function submit() {
    if (!canSubmit) return;
    if (scanInfo && scanInfo.name && scanInfo.guess !== productId && onLearn) onLearn(productId, scanInfo.name);
    setScanInfo(null);
    const oid = initial ? initial.orderId : uid();
    const n = lines.length;
    const alloc = (total) => { let rest = r2(total); return lines.map((l, i) => { const v = i === n - 1 ? rest : r2(gross > 0 ? total * l.g / gross : total / n); rest = r2(rest - v); return v; }); };
    const cs = alloc(couponNum), fs = alloc(fee.baht), os = alloc(other.baht);
    const dateIso = (time ? new Date(date + "T" + time + ":00+07:00") : new Date(date)).toISOString();
    lines.forEach((l, i) => onSubmit({
      id: i === 0 && initial ? initial.id : uid(),
      orderId: oid,
      orderNo: orderNo.trim() || void 0,
      customer: customer.trim() || void 0,
      orderAt: orderAt ? (/* @__PURE__ */ new Date(orderAt + ":00+07:00")).toISOString() : void 0,
      createdAt: initial ? initial.createdAt : (/* @__PURE__ */ new Date()).toISOString(),
      productId: l.productId,
      platformId,
      quantity: parseFloat(l.quantity),
      price: parseFloat(l.price),
      coupon: cs[i],
      fee: fs[i],
      otherExpense: os[i],
      unitCost: initial && initial.productId === l.productId ? initial.unitCost ?? (l.product?.cost || 0) : l.product?.cost || 0,
      date: dateIso
    }));
    setItems([{ productId: "", quantity: 1, price: "" }]); setPlatformId(""); setCoupon(0);
    setFeeIn({ mode: "pct", value: "0" }); setOtherIn({ mode: "baht", value: "" });
    setOrderNo(""); setCustomer(""); setOrderAt("");
    setFeeTouched(false); setDate(todayStr()); setTime(hm(/* @__PURE__ */ new Date()));
  }
  const num = (props) => React.createElement("input", { type: "number", min: "0", step: "any", inputMode: "decimal", ...props });
  const amountPair = (label, inp, setInp, calc, touch) => React.createElement("div", { className: "field-row" },
    React.createElement("label", { className: "field" }, React.createElement("span", null, label + " (บาท)"),
      num({ value: inp.mode === "baht" ? inp.value : String(r2(calc.baht)), onChange: (e) => { setInp({ mode: "baht", value: e.target.value }); touch && touch(); } })),
    React.createElement("label", { className: "field" }, React.createElement("span", null, label + " (%)"),
      num({ value: inp.mode === "pct" ? inp.value : String(r2(calc.pct)), onChange: (e) => { setInp({ mode: "pct", value: e.target.value }); touch && touch(); } })));
  const pctTxt = (n) => " (" + r2(n) + "%)";
  const row = (label, val, cls) => React.createElement("div", { className: "ls-row" + (cls ? " " + cls : "") }, React.createElement("span", null, label), React.createElement("span", null, val));
  return /* @__PURE__ */ React.createElement("div", { className: "card section-card" },
    React.createElement("div", { className: "section-title", style: { marginBottom: 14 } }, initial ? "แก้ไขรายการขาย" : "บันทึกการขาย"),
    !initial && React.createElement("label", { className: "btn btn-outline btn-block", style: { cursor: "pointer", textAlign: "center", marginBottom: 6 } }, "📷 สแกนจากรูปหน้าออเดอร์ (OCR)", React.createElement("input", { type: "file", accept: "image/*", onChange: scan, style: { display: "none" } })),
    scanMsg && React.createElement("div", { style: { fontSize: 12.5, color: scanMsg.startsWith("⚠") ? "#B42318" : "#68706B", marginBottom: 10 } }, scanMsg),
    scanInfo && scanInfo.cands && scanInfo.cands.length > 0 && (scanInfo.cands.length > 1 || !scanInfo.guess) && React.createElement("div", { style: { marginBottom: 10 } },
      React.createElement("div", { style: { fontSize: 12, color: "#68706B", marginBottom: 4 } }, "สินค้าที่น่าจะใช่ (กดเลือก):"),
      scanInfo.cands.map((c) => { const pr = products.find((x) => x.id === c.id); return React.createElement("button", { key: c.id, type: "button", className: "btn btn-ghost btn-block", style: { display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", textAlign: "left", marginBottom: 4, border: c.id === productId ? "2px solid #0F2B26" : "1px solid #E1E5E0" }, onClick: () => setProductId(c.id) }, pr && pr.image ? React.createElement("img", { src: pr.image, alt: "", style: { width: 30, height: 30, objectFit: "cover", borderRadius: 6, flexShrink: 0 } }) : null, React.createElement("span", { style: { whiteSpace: "normal", fontSize: 13 } }, c.name)); })),
    React.createElement("div", { className: "form-grid" },
      ...items.map((it, i) => React.createElement("div", { key: i, style: items.length > 1 ? { border: "1px solid #E1E5E0", borderRadius: 12, padding: 10 } : void 0 },
        items.length > 1 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, fontWeight: 700, marginBottom: 6 } }, React.createElement("span", null, "รายการที่ " + (i + 1)), React.createElement("button", { type: "button", className: "icon-btn-sm", "aria-label": "ลบรายการ", onClick: () => setItems(items.filter((_, k) => k !== i)) }, React.createElement(Trash2, { size: 14 }))),
        React.createElement("label", { className: "field" }, React.createElement("span", null, "สินค้า"),
          React.createElement("select", { value: it.productId, onChange: (e) => setItem(i, { productId: e.target.value }) },
            React.createElement("option", { value: "" }, "เลือกสินค้า"),
            products.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.name, " (คงเหลือ ", p.stock, ")")))),
        React.createElement("div", { className: "field-row" },
          React.createElement("label", { className: "field" }, React.createElement("span", null, "จำนวน"),
            React.createElement("input", { type: "number", min: "1", value: it.quantity, onChange: (e) => setItem(i, { quantity: e.target.value }) })),
          React.createElement("label", { className: "field" }, React.createElement("span", null, "ราคาขาย/ชิ้น"),
            React.createElement("input", { type: "number", min: "0", step: "any", placeholder: "0", value: it.price, onChange: (e) => setItem(i, { price: e.target.value }) }))))),
      !initial && React.createElement("button", { type: "button", className: "btn btn-outline btn-block", onClick: () => setItems([...items, { productId: "", quantity: 1, price: "" }]) }, "+ เพิ่มสินค้าในออเดอร์เดียวกัน"),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "Platform"),
        React.createElement("select", { value: platformId, onChange: (e) => handlePlatformChange(e.target.value) },
          React.createElement("option", { value: "" }, "เลือก Platform"),
          platforms.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.name)))),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "คูปอง (บาท)"),
        num({ value: coupon, onChange: (e) => setCoupon(e.target.value) })),
      amountPair("ค่าธรรมเนียม", feeIn, setFeeIn, fee, () => setFeeTouched(true)),
      amountPair("รายจ่ายอื่นๆ", otherIn, setOtherIn, other, null),
      React.createElement("div", { className: "field-row" },
        React.createElement("label", { className: "field" }, React.createElement("span", null, "วันที่"),
          React.createElement("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value) })),
        React.createElement("label", { className: "field" }, React.createElement("span", null, "เวลาที่บันทึก"),
          React.createElement("input", { type: "time", value: time, onChange: (e) => setTime(e.target.value) }))),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "เลขออเดอร์ (ไม่บังคับ)"),
        React.createElement("input", { value: orderNo, onChange: (e) => setOrderNo(e.target.value) })),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "วันที่-เวลาสั่งซื้อ ตามแพลตฟอร์ม (ไม่บังคับ)"),
        React.createElement("input", { type: "datetime-local", value: orderAt, onChange: (e) => setOrderAt(e.target.value) })),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "ชื่อ / ID ลูกค้า (ไม่บังคับ)"),
        React.createElement("input", { list: "customer-names", value: customer, placeholder: "เช่น ชื่อผู้ซื้อใน Shopee", onChange: (e) => setCustomer(e.target.value) })),
      custInfo && React.createElement("div", { style: { fontSize: 12.5, color: custInfo.n > 0 ? "#1A7F4B" : "#68706B", fontWeight: 600 } }, custInfo.n > 0 ? "ลูกค้านี้เคยสั่งแล้ว " + custInfo.n + " ครั้ง (ยอดรวม " + fmtCurrency(custInfo.total) + ") ครั้งนี้เป็นครั้งที่ " + (custInfo.n + 1) : "ลูกค้าใหม่ ยังไม่เคยสั่ง"),
      React.createElement("datalist", { id: "customer-names" }, [...new Set((sales || []).map((x) => x.customer).filter(Boolean))].map((n) => React.createElement("option", { key: n, value: n })))),
    React.createElement("div", { className: "live-summary" },
      lines.length > 1 && row("จำนวนรายการในออเดอร์", lines.length + " รายการ"),
      row("ยอดขาย", fmtCurrency(gross)),
      row("ค่าธรรมเนียม" + pctTxt(fee.pct), "-" + fmtCurrency(fee.baht)),
      row("รายจ่ายอื่นๆ" + pctTxt(other.pct), "-" + fmtCurrency(other.baht)),
      row("คูปอง", "-" + fmtCurrency(couponNum)),
      row("ต้นทุน", "-" + fmtCurrency(cost)),
      row("กำไร" + (gross > 0 ? pctTxt(profit / gross * 100) : ""), fmtCurrency(profit), "ls-profit")),
    React.createElement("button", { className: "btn btn-primary btn-block", disabled: !canSubmit, onClick: submit }, React.createElement(Check, { size: 16 }), " บันทึกการขาย"), onCancel && React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: onCancel }, "ยกเลิก"));
}
const r2g = (n) => Math.round((n || 0) * 100) / 100;
function allocTo(rows, total, w) {
  const ws = rows.map(w);
  const sum = ws.reduce((a, b) => a + b, 0);
  let rest = r2g(total);
  return rows.map((_, i) => { const v = i === rows.length - 1 ? rest : r2g(sum > 0 ? total * ws[i] / sum : total / rows.length); rest = r2g(rest - v); return v; });
}
function buildOrders(sales) {
  const map = {};
  sales.forEach((s) => { if (s.status) return; const k = s.orderId || s.id; (map[k] || (map[k] = { key: k, rows: [] })).rows.push(s); });
  return Object.values(map).map((o) => {
    const r0 = o.rows[0];
    const expected = o.rows.reduce((a, s) => a + (s.price || 0) * (s.quantity || 0) - (s.coupon || 0) - (s.fee || 0), 0);
    const paid = o.rows.every((s) => s.paidDate);
    const paidAmount = o.rows.reduce((a, s) => a + (s.paidAmount || 0), 0);
    return { ...o, date: r0.date, platformId: r0.platformId, orderNo: r0.orderNo || "", expected: r2g(expected), fee: r2g(o.rows.reduce((a, s) => a + (s.fee || 0), 0)), paid, paidDate: paid ? r0.paidDate : "", paidAmount: r2g(paidAmount), diff: paid ? r2g(paidAmount - expected) : 0 };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  text = text.replace(/^\ufeff/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const ORDER_RE = /หมายเลขคำสั่งซื้อ|เลขคำสั่งซื้อ|หมายเลขออเดอร์|order\s*(id|no|number|sn)|order_id|หมายเลขคำสั่ง/i;
async function readReportFile(file) {
  if (/\.csv$/i.test(file.name)) { const rows = parseCsv(await file.text()); const hi = Math.max(0, rows.slice(0, 40).findIndex((r) => r.some((c) => ORDER_RE.test(String(c))))); return { rows, hi, sheet: "" }; }
  const X = window.XLSX || (await import("https://esm.sh/xlsx@0.18.5")).default || (await import("https://esm.sh/xlsx@0.18.5"));
  const wb = X.read(await file.arrayBuffer(), { type: "array" });
  let first = null;
  for (const name of wb.SheetNames) {
    const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    if (!first) first = { rows, hi: 0, sheet: name };
    const hi = rows.slice(0, 40).findIndex((r) => r.some((c) => ORDER_RE.test(String(c))));
    if (hi >= 0) return { rows, hi, sheet: name };
  }
  return first;
}
function ReportImport({ orders, platforms, onUpdates, onClose }) {
  const [data, setData] = useState(null);
  const [map, setMap] = useState({ order: -1, payout: -1, fee: -1, date: -1 });
  const [platformId, setPlatformId] = useState("");
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const num = (v) => { const x = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(x) ? 0 : x; };
  const nk = (v) => String(v ?? "").replace(/[\s"'=]/g, "").toUpperCase();
  const pdate = (v) => {
    const t = String(v || "");
    let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = t.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    if (m) { let y = +m[3]; if (y > 2400) y -= 543; return y + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0"); }
    return "";
  };
  async function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true); setMsg(""); setRes(null);
    try {
      const d = await readReportFile(f);
      const headers = (d.rows[d.hi] || []).map((h) => String(h));
      const g = (re) => headers.findIndex((h) => re.test(h));
      setMap({
        order: g(ORDER_RE),
        payout: g(/(จำนวนเงิน|ยอดเงิน)[^,]{0,12}(โอน|ได้รับ|ปล่อย|สุทธิ)|ยอดโอน|ยอดสุทธิ|total\s*(released|payout|settlement)|released\s*amount|settlement\s*amount|net\s*(amount|payout|income)|payout/i),
        fee: g(/ค่าธรรมเนียม(ทั้งหมด|รวม)|total\s*fee/i),
        date: g(/วันที่(โอน|ชำระเงิน|ปล่อย|ได้รับ)|release\s*date|payout\s*date|settle/i)
      });
      setData({ ...d, headers });
    } catch (err) { setMsg("อ่านไฟล์ไม่สำเร็จ (ไฟล์ .xlsx ต้องต่ออินเทอร์เน็ตในครั้งแรก หรือบันทึกเป็น .csv แล้วลองใหม่)"); }
    setBusy(false);
  }
  function match() {
    const rep = {};
    data.rows.slice(data.hi + 1).forEach((r) => {
      const k = nk(r[map.order]);
      if (!k) return;
      const o = rep[k] || (rep[k] = { payout: 0, fee: 0, date: "" });
      o.payout += map.payout >= 0 ? num(r[map.payout]) : 0;
      o.fee += map.fee >= 0 ? Math.abs(num(r[map.fee])) : 0;
      if (map.date >= 0 && !o.date) o.date = pdate(r[map.date]);
    });
    const mine = orders.filter((o) => o.platformId === platformId);
    const appMap = {};
    mine.forEach((o) => { if (o.orderNo) appMap[nk(o.orderNo)] = o; });
    const matched = [], missingApp = [];
    Object.entries(rep).forEach(([k, r]) => { const o = appMap[k]; if (o) matched.push({ o, r, diff: r2g(r.payout - o.expected), feeDiff: map.fee >= 0 ? r2g(r.fee - o.fee) : 0 }); else missingApp.push({ k, r }); });
    const missingRep = mine.filter((o) => o.orderNo && !o.paid && !rep[nk(o.orderNo)]);
    setRes({ matched, missingApp, missingRep, noNo: mine.filter((o) => !o.orderNo).length, total: Object.keys(rep).length });
  }
  function applyPaid() {
    const today = bkkDate(/* @__PURE__ */ new Date());
    const ups = res.matched.filter((m) => m.r.payout > 0).map((m) => ({ key: m.o.key, paid: { date: m.r.date || today, amount: m.r.payout } }));
    onUpdates(ups); setMsg("บันทึกรับเงินแล้ว " + ups.length + " ออเดอร์");
  }
  function applyFee() {
    const ups = res.matched.filter((m) => Math.abs(m.feeDiff) > 1).map((m) => ({ key: m.o.key, fee: m.r.fee }));
    onUpdates(ups); setMsg("ปรับค่าธรรมเนียมแล้ว " + ups.length + " ออเดอร์");
  }
  const sel = (label, key, optional) => React.createElement("label", { className: "field" }, React.createElement("span", null, label),
    React.createElement("select", { value: map[key], onChange: (e) => setMap({ ...map, [key]: parseInt(e.target.value, 10) }) },
      React.createElement("option", { value: -1 }, optional ? "- ไม่ใช้ -" : "- เลือกคอลัมน์ -"),
      data.headers.map((h, i) => h ? React.createElement("option", { key: i, value: i }, h) : null)));
  const list = (title, items, render) => items.length > 0 && React.createElement("div", { style: { marginTop: 10 } },
    React.createElement("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 4 } }, title + " (" + items.length + ")"),
    items.slice(0, 15).map(render),
    items.length > 15 && React.createElement("div", { style: { fontSize: 12, color: "#99A09B" } }, "…และอีก " + (items.length - 15) + " รายการ"));
  const line = (a, b, red) => React.createElement("div", { key: a, style: { display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0", color: red ? "#B42318" : void 0 } }, React.createElement("span", null, a), React.createElement("span", null, b));
  const bad = res ? res.matched.filter((m) => Math.abs(m.diff) > 1) : [];
  return React.createElement("div", { className: "modal-overlay", onClick: onClose }, React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, React.createElement("div", { className: "modal-body", style: { maxHeight: "85vh", overflowY: "auto" } },
    React.createElement("div", { className: "section-title", style: { marginBottom: 8 } }, "นำเข้ารายงานจากแพลตฟอร์ม"),
    React.createElement("div", { style: { fontSize: 12, color: "#68706B", marginBottom: 8 } }, "ใช้ไฟล์รายงานรายได้/การโอนเงินจาก Seller Center (.xlsx หรือ .csv) แอปจับคู่ด้วยเลขออเดอร์"),
    React.createElement("label", { className: "field" }, React.createElement("span", null, "แพลตฟอร์มของรายงานนี้"),
      React.createElement("select", { value: platformId, onChange: (e) => { setPlatformId(e.target.value); setRes(null); } }, React.createElement("option", { value: "" }, "เลือก Platform"), platforms.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.name)))),
    React.createElement("label", { className: "btn btn-outline btn-block", style: { cursor: "pointer", textAlign: "center", marginTop: 8 } }, busy ? "กำลังอ่านไฟล์…" : data ? "เลือกไฟล์ใหม่" : "เลือกไฟล์รายงาน", React.createElement("input", { type: "file", accept: ".xlsx,.xls,.csv", onChange: pick, style: { display: "none" } })),
    msg && React.createElement("div", { style: { fontSize: 12.5, margin: "8px 0", color: "#0F2B26", fontWeight: 600 } }, msg),
    data && React.createElement("div", { style: { marginTop: 10 } },
      React.createElement("div", { style: { fontSize: 12, color: "#68706B", marginBottom: 6 } }, "ตรวจว่าแอปเดาคอลัมน์ถูกไหม (" + (data.rows.length - data.hi - 1) + " แถว" + (data.sheet ? " · ชีต " + data.sheet : "") + ")"),
      React.createElement("div", { className: "form-grid" }, sel("คอลัมน์เลขออเดอร์", "order", false), sel("คอลัมน์ยอดเงินที่ได้รับ/โอน", "payout", false), sel("คอลัมน์ค่าธรรมเนียมรวม (ถ้ามี)", "fee", true), sel("คอลัมน์วันที่โอน (ถ้ามี)", "date", true)),
      React.createElement("button", { className: "btn btn-primary btn-block", style: { marginTop: 10 }, disabled: !platformId || map.order < 0 || map.payout < 0, onClick: match }, "จับคู่ออเดอร์")),
    res && React.createElement("div", { style: { marginTop: 12, borderTop: "1px solid #EEF0ED", paddingTop: 10 } },
      line("ในรายงาน", res.total + " ออเดอร์"), line("จับคู่กับในแอปได้", res.matched.length + " ออเดอร์"),
      line("ยอดตรง (ต่าง ≤ ฿1)", (res.matched.length - bad.length) + " ออเดอร์"), line("ยอดไม่ตรง", bad.length + " ออเดอร์", bad.length > 0),
      line("อยู่ในรายงานแต่ไม่มีในแอป", res.missingApp.length + " ออเดอร์", res.missingApp.length > 0),
      line("อยู่ในแอป (ยังไม่รับเงิน) แต่ไม่มีในรายงาน", res.missingRep.length + " ออเดอร์"),
      res.noNo > 0 && line("ออเดอร์ที่ไม่มีเลขออเดอร์ จับคู่ไม่ได้", res.noNo + " ออเดอร์"),
      list("ยอดเงินไม่ตรง", bad, (m) => line(m.o.orderNo, "แอป ฿" + m.o.expected + " / รายงาน ฿" + m.r.payout + " (ต่าง " + (m.diff > 0 ? "+" : "") + m.diff + ")", true)),
      list("ไม่มีในแอป (ควรลงเพิ่ม)", res.missingApp, (m) => line(m.k, "฿" + m.r.payout)),
      list("ไม่พบในรายงาน", res.missingRep, (o) => line(o.orderNo, "฿" + o.expected)),
      React.createElement("button", { className: "btn btn-primary btn-block", style: { marginTop: 12 }, disabled: res.matched.length === 0, onClick: applyPaid }, "ทำเครื่องหมาย \"รับเงินแล้ว\" ตามรายงาน (" + res.matched.length + ")"),
      map.fee >= 0 && res.matched.some((m) => Math.abs(m.feeDiff) > 1) && React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 8 }, onClick: applyFee }, "ปรับค่าธรรมเนียมตามรายงาน (" + res.matched.filter((m) => Math.abs(m.feeDiff) > 1).length + " ออเดอร์ที่ต่างกัน)")),
    React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 10 }, onClick: onClose }, "ปิด"))));
}
function ReconPage({ sales, products, platforms, onUpdates }) {
  const [pf, setPf] = useState("all");
  const [flt, setFlt] = useState("unpaid");
  const [limit, setLimit] = useState(20);
  const [payFor, setPayFor] = useState(null);
  const [form, setForm] = useState({ date: "", amount: "" });
  const [showImport, setShowImport] = useState(false);
  const orders = useMemo(() => buildOrders(sales), [sales]);
  const pm = Object.fromEntries(products.map((p) => [p.id, p]));
  const plm = Object.fromEntries(platforms.map((p) => [p.id, p]));
  const sumRows = platforms.map((pl) => {
    const os = orders.filter((o) => o.platformId === pl.id);
    const un = os.filter((o) => !o.paid), pd = os.filter((o) => o.paid);
    return { pl, count: os.length, unCount: un.length, waiting: un.reduce((a, o) => a + o.expected, 0), received: pd.reduce((a, o) => a + o.paidAmount, 0), diff: pd.reduce((a, o) => a + o.diff, 0) };
  }).filter((x) => x.count > 0);
  const list = orders.filter((o) => (pf === "all" || o.platformId === pf) && (flt === "all" || (flt === "unpaid" && !o.paid) || (flt === "paid" && o.paid) || (flt === "diff" && o.paid && Math.abs(o.diff) > 1)));
  const open = (o) => { setPayFor(o); setForm({ date: o.paid ? o.paidDate : bkkDate(/* @__PURE__ */ new Date()), amount: String(o.paid ? o.paidAmount : o.expected) }); };
  const chip = (id, label) => React.createElement("button", { key: id, className: "toggle" + (flt === id ? " active" : ""), onClick: () => { setFlt(id); setLimit(20); } }, label);
  return React.createElement("div", { className: "page-inner" },
    React.createElement(Header, { title: "ตรวจเช็ค", subtitle: "เทียบกับยอดเงินเข้าและรายงานแพลตฟอร์ม", lowStockCount: 0 }),
    React.createElement("button", { className: "btn btn-primary btn-block", onClick: () => setShowImport(true) }, "นำเข้ารายงานจากแพลตฟอร์ม (จับคู่ออเดอร์)"),
    React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
      React.createElement("div", { className: "section-title", style: { marginBottom: 8 } }, "สรุปเงินเข้าตามแพลตฟอร์ม"),
      sumRows.length === 0 && React.createElement("div", { className: "mini-empty" }, "ยังไม่มีออเดอร์"),
      sumRows.map((x) => React.createElement("div", { key: x.pl.id, style: { padding: "8px 0", borderTop: "1px solid #EEF0ED" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 } }, React.createElement("span", { style: { width: 10, height: 10, borderRadius: 5, background: x.pl.color } }), x.pl.name, React.createElement("span", { style: { fontWeight: 400, fontSize: 12, color: "#68706B" } }, x.count + " ออเดอร์")),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 } }, React.createElement("span", null, "รอรับเงิน (" + x.unCount + ")"), React.createElement("span", { style: { fontWeight: 700 } }, fmtCurrency(x.waiting))),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13 } }, React.createElement("span", null, "รับแล้ว"), React.createElement("span", null, fmtCurrency(x.received))),
        Math.abs(x.diff) > 1 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, color: x.diff < 0 ? "#B42318" : "#1A7F4B" } }, React.createElement("span", null, "ส่วนต่างจากที่คำนวณ"), React.createElement("span", null, (x.diff > 0 ? "+" : "") + fmtCurrency(x.diff)))))),
    React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        React.createElement("div", { className: "toggle-group" }, chip("unpaid", "รอรับเงิน"), chip("paid", "รับแล้ว"), chip("diff", "ยอดไม่ตรง"), chip("all", "ทั้งหมด")),
        React.createElement("select", { value: pf, onChange: (e) => { setPf(e.target.value); setLimit(20); }, style: { fontSize: 13, padding: "4px 8px", borderRadius: 8 } }, React.createElement("option", { value: "all" }, "ทุกแพลตฟอร์ม"), platforms.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.name)))),
      list.length === 0 && React.createElement("div", { className: "mini-empty" }, "ไม่มีรายการ"),
      list.slice(0, limit).map((o) => {
        const names = o.rows.map((s) => (pm[s.productId] || {}).name || "?").join(", ");
        const pl = plm[o.platformId];
        return React.createElement("div", { key: o.key, style: { display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: "1px solid #EEF0ED" } },
          React.createElement("span", { style: { width: 9, height: 9, borderRadius: 5, background: pl?.color || "#999", flexShrink: 0 } }),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: 13.5, fontWeight: 600, whiteSpace: "normal", wordBreak: "break-word" } }, o.orderNo || names),
            React.createElement("div", { style: { fontSize: 12, color: "#68706B" } }, fmtBkkDate(o.date) + " · คาดว่าได้ " + fmtCurrency(o.expected)),
            o.paid && React.createElement("div", { style: { fontSize: 12, color: Math.abs(o.diff) > 1 ? "#B42318" : "#1A7F4B" } }, "✓ รับแล้ว " + fmtCurrency(o.paidAmount) + " (" + fmtBkkDate(o.paidDate) + ")" + (Math.abs(o.diff) > 1 ? " ต่าง " + (o.diff > 0 ? "+" : "") + o.diff : ""))),
          React.createElement("button", { className: "btn btn-ghost", style: { padding: "4px 10px", fontSize: 12, minHeight: 0 }, onClick: () => open(o) }, o.paid ? "แก้ไข" : "รับเงิน"));
      }),
      list.length > limit && React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 8 }, onClick: () => setLimit(limit + 20) }, "แสดงเพิ่ม")),
    payFor && React.createElement("div", { className: "modal-overlay", onClick: () => setPayFor(null) }, React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, React.createElement("div", { className: "modal-body" },
      React.createElement("div", { className: "section-title", style: { marginBottom: 6 } }, "บันทึกรับเงิน"),
      React.createElement("div", { style: { fontSize: 12.5, color: "#68706B", marginBottom: 10 } }, (payFor.orderNo || "ออเดอร์") + " · คาดว่าได้ " + fmtCurrency(payFor.expected)),
      React.createElement("div", { className: "form-grid" },
        React.createElement("label", { className: "field" }, React.createElement("span", null, "วันที่ได้รับเงิน"), React.createElement("input", { type: "date", value: form.date, onChange: (e) => setForm({ ...form, date: e.target.value }) })),
        React.createElement("label", { className: "field" }, React.createElement("span", null, "ยอดที่ได้รับจริง (บาท)"), React.createElement("input", { type: "number", min: "0", step: "any", inputMode: "decimal", value: form.amount, onChange: (e) => setForm({ ...form, amount: e.target.value }) }))),
      React.createElement("button", { className: "btn btn-primary btn-block", style: { marginTop: 12 }, disabled: !form.date || !(parseFloat(form.amount) >= 0) || form.amount === "", onClick: () => { onUpdates([{ key: payFor.key, paid: { date: form.date, amount: parseFloat(form.amount) } }]); setPayFor(null); } }, "บันทึก"),
      payFor.paid && React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 8 }, onClick: () => { onUpdates([{ key: payFor.key, paid: null }]); setPayFor(null); } }, "ล้างสถานะรับเงิน"),
      React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: () => setPayFor(null) }, "ยกเลิก")))),
    showImport && React.createElement(ReportImport, { orders, platforms, onUpdates, onClose: () => setShowImport(false) }));
}
function StatusModal({ sale, productName, onClose, onSave }) {
  const [status, setStatus] = useState(sale.status || "ok");
  const [restock, setRestock] = useState(sale.status === "returned" ? !!sale.restocked : true);
  const [extra, setExtra] = useState(sale.lossExtra ? String(sale.lossExtra) : "");
  const [comp, setComp] = useState(sale.compensation ? String(sale.compensation) : "");
  const opt = (id, label) => React.createElement("button", { type: "button", key: id, className: "toggle" + (status === id ? " active" : ""), onClick: () => setStatus(id) }, label);
  const num = (label, value, set) => React.createElement("label", { className: "field" }, React.createElement("span", null, label), React.createElement("input", { type: "number", min: "0", step: "any", inputMode: "decimal", value, onChange: (e) => set(e.target.value) }));
  const note = (t) => React.createElement("div", { style: { fontSize: 12, color: "#68706B", margin: "8px 0" } }, t);
  function save() {
    onSave(status === "ok" ? { status: void 0, restocked: false, lossExtra: void 0, compensation: void 0 } : { status, restocked: status === "returned" && restock, lossExtra: parseFloat(extra) || 0, compensation: status === "lost" ? parseFloat(comp) || 0 : 0 });
  }
  return React.createElement("div", { className: "modal-overlay", onClick: onClose }, React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, React.createElement("div", { className: "modal-body" },
    React.createElement("div", { className: "section-title", style: { marginBottom: 10 } }, "สถานะ: " + productName),
    React.createElement("div", { className: "toggle-group", style: { marginBottom: 10 } }, opt("ok", "ปกติ"), opt("returned", "ตีกลับ"), opt("lost", "สูญหาย")),
    status === "returned" && React.createElement("div", null,
      note("ไม่นับยอดขายและค่าธรรมเนียมของรายการนี้ (แพลตฟอร์มคืนเงินผู้ซื้อ)"),
      React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 10 } }, React.createElement("input", { type: "checkbox", checked: restock, onChange: (e) => setRestock(e.target.checked) }), "สินค้ากลับมาขายได้ (คืนสต็อก)"),
      num("ค่าส่งตีกลับ / ค่าธรรมเนียมที่ไม่ได้คืน (บาท)", extra, setExtra),
      !restock && note("ไม่คืนสต็อก: ต้นทุนสินค้านับเป็นขาดทุน")),
    status === "lost" && React.createElement("div", null,
      note("ไม่คืนสต็อก ต้นทุนสินค้านับเป็นขาดทุน ไม่นับยอดขายรายการนี้"),
      num("เงินชดเชยจากแพลตฟอร์ม (บาท)", comp, setComp),
      num("ค่าใช้จ่ายอื่น (บาท)", extra, setExtra)),
    React.createElement("button", { className: "btn btn-primary btn-block", style: { marginTop: 14 }, onClick: save }, "บันทึกสถานะ"),
    React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: onClose }, "ยกเลิก"))));
}
function SalesHistory({ sales, products, platforms, onDelete, onEdit, onStatus }) {
  const [limit, setLimit] = useState(20);
  const [statusFor, setStatusFor] = useState(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p]));
  const rows = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  const sizes = {};
  sales.forEach((x) => { if (x.orderId) sizes[x.orderId] = (sizes[x.orderId] || 0) + 1; });
  if (rows.length === 0) return null;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (s) => {
    const p = productMap[s.productId] || {}, pl = platformMap[s.platformId] || {};
    return [s.orderNo, s.customer, p.name, p.sku, p.aliases, pl.name, bkkDate(s.date), fmtBkkDate(s.date), s.orderAt ? bkkDate(s.orderAt) : "", s.price, (s.price || 0) * (s.quantity || 0)].join(" ").toLowerCase();
  };
  const hit = new Set(terms.length ? rows.filter((s) => { const h = hay(s); return terms.every((t) => h.includes(t)); }).map((s) => s.orderId || s.id) : []);
  const shown = terms.length ? rows.filter((s) => hit.has(s.orderId || s.id)) : rows;
  return React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
    React.createElement("div", { className: "section-title", style: { marginBottom: 8 } }, "รายการที่บันทึกไว้ (" + rows.length + ")"),
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
      React.createElement("input", { type: "search", value: q, placeholder: "ค้นหา เลขออเดอร์ / ชื่อสินค้า / แพลตฟอร์ม / วันที่ / ยอด", onChange: (e) => setQ(e.target.value), style: { flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid #E1E5E0", font: "inherit", fontSize: 14 } }),
      q && React.createElement("button", { className: "btn btn-ghost", onClick: () => setQ("") }, "ล้าง")),
    terms.length > 0 && React.createElement("div", { style: { fontSize: 12.5, color: "#68706B", marginBottom: 8 } }, shown.length === 0 ? "ไม่พบรายการที่ตรงกับคำค้นหา" : "พบ " + shown.length + " รายการ (" + hit.size + " ออเดอร์)"),
    React.createElement("div", { className: "tx-list" }, shown.slice(0, terms.length ? 100 : limit).map((s) => {
      const p = productMap[s.productId];
      const pl = platformMap[s.platformId];
      const m = computeSaleMetrics(s, p, pl);
      return React.createElement("div", { className: "tx-row", key: s.id },
        React.createElement("span", { className: "tx-dot", style: { background: pl?.color || "#999" } }),
        React.createElement("div", { className: "tx-info" },
          React.createElement("div", { className: "tx-name", style: { whiteSpace: "normal", wordBreak: "break-word" } }, p?.name || "สินค้าไม่พบ"),
          React.createElement("div", { className: "tx-sub" }, pl?.name, " · ", fmtBkkDate(s.date), fmtTime(s.date) ? " " + fmtTime(s.date) : "", " · x", s.quantity, s.orderNo ? " · #" + s.orderNo : "", s.customer ? " · 👤 " + s.customer : "", s.orderAt ? " · สั่ง " + fmtBkkDate(s.orderAt) + " " + hm(s.orderAt) : "", sizes[s.orderId] > 1 ? " · ออเดอร์ " + sizes[s.orderId] + " รายการ" : "")),
        React.createElement("div", { className: "tx-figures" },
          React.createElement("div", { className: "tx-gross", style: s.status ? { color: "#B42318", fontSize: 12 } : void 0 }, s.status === "returned" ? "ตีกลับ" : s.status === "lost" ? "สูญหาย" : fmtCurrency(m.gross)),
          React.createElement("div", { className: "tx-profit", style: s.status ? { color: "#B42318" } : void 0 }, s.status ? "ขาดทุน " : "กำไร ", s.status ? fmtCurrency(-m.profit) : fmtCurrency(m.profit))),
        React.createElement("button", { className: "btn btn-ghost", "aria-label": "สถานะ", style: { marginRight: 6, padding: "2px 8px", fontSize: 12, minHeight: 0 }, onClick: () => setStatusFor(s) }, "สถานะ"), !s.status && React.createElement("button", { className: "icon-btn-sm", "aria-label": "แก้ไข", style: { marginRight: 6 }, onClick: () => setEditing(s) }, React.createElement(Edit2, { size: 14 })), React.createElement("button", { className: "icon-btn-sm", "aria-label": "ลบรายการ", onClick: () => {
          const grp = s.orderId && sizes[s.orderId] > 1 ? sales.filter((x) => x.orderId === s.orderId) : null;
          if (grp && window.confirm("ออเดอร์นี้มี " + grp.length + " รายการ\nตกลง = ลบทั้งออเดอร์\nยกเลิก = เลือกลบเฉพาะรายการนี้")) { grp.forEach((x) => onDelete(x.id)); return; }
          if (window.confirm("ลบรายการนี้? สต็อกสินค้าจะถูกคืนกลับ")) onDelete(s.id);
        } }, React.createElement(Trash2, { size: 14 })));
    })),
    !terms.length && rows.length > limit && React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 12 }, onClick: () => setLimit(limit + 20) }, "แสดงเพิ่ม"), editing && React.createElement("div", { className: "modal-overlay", onClick: () => setEditing(null) }, React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, React.createElement("div", { className: "modal-body" }, React.createElement(QuickSaleForm, { products, platforms, sales, initial: editing, onCancel: () => setEditing(null), onSubmit: (u) => { onEdit(u); setEditing(null); } })))), statusFor && React.createElement(StatusModal, { sale: statusFor, productName: (productMap[statusFor.productId] || {}).name || "", onClose: () => setStatusFor(null), onSave: (patch) => { onStatus(statusFor.id, patch); setStatusFor(null); } }));
}
function PlatformManager({ platforms, sales, onChange }) {
  const [editing, setEditing] = useState(null);
  const colors = ["#EE4D2D", "#0F146D", "#111111", "#1877F2", "#06C755", "#B8862F", "#8E44AD", "#E67E22", "#16A085", "#E91E63"];
  function save() {
    const name = (editing.name || "").trim();
    if (!name) return;
    const feePercent = parseFloat(editing.feePercent) || 0;
    if (editing.id) onChange(platforms.map((p) => p.id === editing.id ? { ...p, name, feePercent, color: editing.color } : p));
    else onChange([...platforms, { id: "p" + Date.now().toString(36), name, feePercent, color: editing.color }]);
    setEditing(null);
  }
  function remove(p) {
    const used = sales.filter((x) => x.platformId === p.id).length;
    if (used) { alert("ลบไม่ได้: มี " + used + " รายการขายใช้แพลตฟอร์มนี้อยู่"); return; }
    if (window.confirm("ลบ " + p.name + "?")) onChange(platforms.filter((x) => x.id !== p.id));
  }
  return React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } },
      React.createElement("div", { className: "section-title" }, "จัดการแพลตฟอร์ม"),
      React.createElement("button", { className: "btn btn-primary", onClick: () => setEditing({ name: "", feePercent: "0", color: colors[0] }) }, React.createElement(Plus, { size: 16 }), " เพิ่ม")),
    platforms.map((p) => React.createElement("div", { key: p.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #EEF0ED" } },
      React.createElement("span", { style: { width: 12, height: 12, borderRadius: 6, background: p.color, flexShrink: 0 } }),
      React.createElement("span", { style: { flex: 1, fontSize: 14, fontWeight: 600 } }, p.name),
      React.createElement("span", { style: { fontSize: 13, color: "#68706B", marginRight: 6 } }, p.feePercent + "%"),
      React.createElement("button", { className: "icon-btn-sm", "aria-label": "แก้ไข", onClick: () => setEditing({ ...p, feePercent: String(p.feePercent) }) }, React.createElement(Edit2, { size: 14 })),
      React.createElement("button", { className: "icon-btn-sm", "aria-label": "ลบ", onClick: () => remove(p) }, React.createElement(Trash2, { size: 14 })))),
    React.createElement("div", { style: { fontSize: 11.5, color: "#99A09B", marginTop: 8 } }, "แก้ % ค่าธรรมเนียมมีผลกับรายการที่บันทึกใหม่เท่านั้น รายการเก่าคงค่าเดิม"),
    editing && React.createElement("div", { className: "modal-overlay", onClick: () => setEditing(null) }, React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, React.createElement("div", { className: "modal-body" },
      React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, editing.id ? "แก้ไขแพลตฟอร์ม" : "เพิ่มแพลตฟอร์ม"),
      React.createElement("div", { className: "form-grid" },
        React.createElement("label", { className: "field" }, React.createElement("span", null, "ชื่อ"), React.createElement("input", { value: editing.name, onChange: (e) => setEditing({ ...editing, name: e.target.value }) })),
        React.createElement("label", { className: "field" }, React.createElement("span", null, "ค่าธรรมเนียม (%)"), React.createElement("input", { type: "number", min: "0", step: "any", inputMode: "decimal", value: editing.feePercent, onChange: (e) => setEditing({ ...editing, feePercent: e.target.value }) })),
        React.createElement("div", { className: "field" }, React.createElement("span", null, "สี"),
          React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, colors.map((c) => React.createElement("button", { key: c, type: "button", "aria-label": c, onClick: () => setEditing({ ...editing, color: c }), style: { width: 30, height: 30, borderRadius: 15, background: c, border: editing.color === c ? "3px solid #0F2B26" : "2px solid #fff", boxShadow: "0 0 0 1px #ccd" } }))))),
      React.createElement("button", { className: "btn btn-primary btn-block", style: { marginTop: 14 }, disabled: !editing.name.trim(), onClick: save }, "บันทึก"),
      React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: () => setEditing(null) }, "ยกเลิก")))));
}
function SlipImg({ id, style }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { let on = true; slipGet(id).then((d) => on && setSrc(d || "")).catch(() => on && setSrc("")); return () => { on = false; }; }, [id]);
  return src ? React.createElement("img", { src, alt: "slip", style }) : React.createElement("div", { style: { ...style, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#99A09B", background: "#F1F3F0" } }, src === null ? "..." : "ไม่พบสลิป");
}
function SlipViewer({ id, name, onClose }) {
  const [src, setSrc] = useState("");
  useEffect(() => { slipGet(id).then((d) => setSrc(d || "")).catch(() => {}); }, [id]);
  return React.createElement("div", { className: "modal-overlay", onClick: onClose }, React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, React.createElement("div", { className: "modal-body" },
    React.createElement("div", { className: "section-title", style: { marginBottom: 10 } }, "สลิป: " + name),
    src ? React.createElement("img", { src, alt: "slip", style: { width: "100%", borderRadius: 10 } }) : "...",
    src && React.createElement("a", { className: "btn btn-outline btn-block", style: { marginTop: 10, textAlign: "center", textDecoration: "none" }, href: src, download: "slip-" + name + ".jpg" }, "ดาวน์โหลดสลิป"),
    React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: onClose }, "ปิด"))));
}
function ExpenseManager({ expenses, onChange }) {
  const pad = (n) => String(n).padStart(2, "0");
  const todayY = () => bkkDate(/* @__PURE__ */ new Date());
  const [editing, setEditing] = useState(null);
  const [viewSlip, setViewSlip] = useState(null);
  const [sumMonth, setSumMonth] = useState("all");
  const [busy, setBusy] = useState(false);
  const when = (e) => e.bill ? new Date(e.date + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : (e.recurring ? "ทุกเดือน ตั้งแต่ " : "รายเดือน ") + new Date(e.month + "-01T00:00:00").toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
  const openNew = (bill) => setEditing({ id: "e" + Date.now().toString(36), isNew: true, bill, name: "", amount: "", date: todayY(), month: todayY().slice(0, 7), recurring: false, slip: false, slipData: null, slipRemoved: false });
  async function pickSlip(ev) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    setBusy(true);
    try { const d = await compressImage(f, 1000, 0.65); setEditing((x) => ({ ...x, slipData: d, slipRemoved: false })); } catch (err) { alert("เปิดรูปไม่ได้"); }
    setBusy(false);
  }
  async function save() {
    const name = (editing.name || "").trim();
    const amount = parseFloat(editing.amount) || 0;
    if (!name || amount <= 0 || (editing.bill ? !editing.date : !editing.month)) return;
    const hasSlip = editing.slipData ? true : editing.slipRemoved ? false : editing.slip;
    try {
      if (editing.slipData) await slipPut(editing.id, editing.slipData);
      else if (editing.slipRemoved) await slipDel(editing.id);
    } catch (err) { alert("บันทึกสลิปไม่สำเร็จ"); return; }
    const item = { id: editing.id, name, amount, bill: !!editing.bill, slip: hasSlip, ...editing.bill ? { date: editing.date, month: editing.date.slice(0, 7) } : { month: editing.month, recurring: !!editing.recurring } };
    onChange(editing.isNew ? [...expenses, item] : expenses.map((x) => x.id === item.id ? item : x));
    setEditing(null);
  }
  function remove(e) {
    if (!window.confirm("ลบ " + e.name + "?" + (e.slip ? " (สลิปจะถูกลบด้วย)" : ""))) return;
    if (e.slip) slipDel(e.id).catch(() => {});
    onChange(expenses.filter((x) => x.id !== e.id));
  }
  const rows = [...expenses].sort((a, b) => (a.date || a.month + "-01") < (b.date || b.month + "-01") ? 1 : -1);
  const inp = (label, props) => React.createElement("label", { className: "field" }, React.createElement("span", null, label), React.createElement("input", props));
  const bills = expenses.filter((e) => e.bill);
  const billMonths = [...new Set(bills.map((e) => e.month))].sort().reverse();
  const nameList = [...new Set(bills.map((e) => e.name.trim()))];
  const scope = sumMonth === "all" ? bills : bills.filter((e) => e.month === sumMonth);
  const grp = {};
  scope.forEach((e) => { const k = e.name.trim().toLowerCase(); if (!grp[k]) grp[k] = { name: e.name.trim(), count: 0, total: 0 }; grp[k].count += 1; grp[k].total += e.amount; });
  const sumRows = Object.values(grp).sort((a, b) => b.total - a.total);
  const grand = sumRows.reduce((a, g) => a + g.total, 0);
  const monthTxt = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  return React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" } },
      React.createElement("div", { className: "section-title" }, "รายจ่าย / บิล"),
      React.createElement("div", { style: { display: "flex", gap: 6 } },
        React.createElement("button", { className: "btn btn-primary", onClick: () => openNew(true) }, React.createElement(Plus, { size: 16 }), " บิล"),
        React.createElement("button", { className: "btn btn-outline", onClick: () => openNew(false) }, React.createElement(Plus, { size: 16 }), " รายเดือน"))),
    bills.length > 0 && React.createElement("div", { style: { background: "#F6F7F5", borderRadius: 12, padding: 12, marginBottom: 12 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 } },
        React.createElement("div", { style: { fontWeight: 700, fontSize: 13.5 } }, "สรุปบิลตามรายการ"),
        React.createElement("select", { value: sumMonth, onChange: (ev) => setSumMonth(ev.target.value), style: { fontSize: 13, padding: "4px 8px", borderRadius: 8 } },
          React.createElement("option", { value: "all" }, "ทุกเดือน"),
          billMonths.map((m) => React.createElement("option", { key: m, value: m }, monthTxt(m))))),
      sumRows.map((g) => React.createElement("div", { key: g.name, style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13.5 } },
        React.createElement("span", { style: { flex: 1, minWidth: 0 } }, g.name),
        React.createElement("span", { style: { color: "#68706B", fontSize: 12 } }, g.count + " บิล · " + (grand > 0 ? Math.round(g.total / grand * 1000) / 10 : 0) + "%"),
        React.createElement("span", { style: { fontWeight: 700, minWidth: 70, textAlign: "right" } }, fmtCurrency(g.total)))),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", borderTop: "1px solid #E1E5E0", marginTop: 6, paddingTop: 8, fontWeight: 800 } }, React.createElement("span", null, "รวมทั้งหมด (" + scope.length + " บิล)"), React.createElement("span", null, fmtCurrency(grand)))),
    React.createElement("datalist", { id: "bill-names" }, nameList.map((n) => React.createElement("option", { key: n, value: n }))),
    rows.length === 0 && React.createElement("div", { className: "mini-empty" }, "ยังไม่มีรายจ่าย กด \"บิล\" เพื่อลงตามวันที่จ่ายพร้อมแนบสลิป"),
    rows.map((e) => React.createElement("div", { key: e.id, style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid #EEF0ED" } },
      e.slip ? React.createElement("button", { type: "button", onClick: () => setViewSlip(e), style: { padding: 0, border: "none", background: "none", cursor: "pointer", flexShrink: 0 } }, React.createElement(SlipImg, { id: e.id, style: { width: 40, height: 40, objectFit: "cover", borderRadius: 8 } })) : null,
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        React.createElement("div", { style: { fontSize: 14, fontWeight: 600 } }, e.name),
        React.createElement("div", { style: { fontSize: 12, color: "#68706B" } }, when(e))),
      React.createElement("span", { style: { fontWeight: 700, fontSize: 14, marginRight: 4 } }, fmtCurrency(e.amount)),
      React.createElement("button", { className: "icon-btn-sm", "aria-label": "แก้ไข", onClick: () => setEditing({ ...e, amount: String(e.amount), slipData: null, slipRemoved: false }) }, React.createElement(Edit2, { size: 14 })),
      React.createElement("button", { className: "icon-btn-sm", "aria-label": "ลบ", onClick: () => remove(e) }, React.createElement(Trash2, { size: 14 })))),
    React.createElement("div", { style: { fontSize: 11.5, color: "#99A09B", marginTop: 8 } }, "บิลสะสมไว้ แล้วหักรวมทีเดียวตอนสิ้นเดือน / รายเดือนหักเฉลี่ยตามจำนวนวัน / สลิปเก็บในเครื่องนี้ (ไม่ขึ้นออนไลน์)"),
    viewSlip && React.createElement(SlipViewer, { id: viewSlip.id, name: viewSlip.name, onClose: () => setViewSlip(null) }),
    editing && React.createElement("div", { className: "modal-overlay", onClick: () => setEditing(null) }, React.createElement("div", { className: "modal", onClick: (ev) => ev.stopPropagation() }, React.createElement("div", { className: "modal-body" },
      React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, (editing.isNew ? "เพิ่ม" : "แก้ไข") + (editing.bill ? "บิล" : "รายจ่ายรายเดือน")),
      React.createElement("div", { className: "form-grid" },
        inp("รายการ", { list: "bill-names", value: editing.name, placeholder: "เช่น ค่าสินค้าล็อตใหม่", onChange: (ev) => setEditing({ ...editing, name: ev.target.value }) }),
        inp(editing.bill ? "จำนวนเงิน (บาท)" : "จำนวนเงิน (บาท/เดือน)", { type: "number", min: "0", step: "any", inputMode: "decimal", value: editing.amount, onChange: (ev) => setEditing({ ...editing, amount: ev.target.value }) }),
        editing.bill ? inp("วันที่จ่าย", { type: "date", value: editing.date, onChange: (ev) => setEditing({ ...editing, date: ev.target.value }) }) : inp("เดือน", { type: "month", value: editing.month, onChange: (ev) => setEditing({ ...editing, month: ev.target.value }) }),
        !editing.bill && React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 14 } }, React.createElement("input", { type: "checkbox", checked: !!editing.recurring, onChange: (ev) => setEditing({ ...editing, recurring: ev.target.checked }) }), "เกิดซ้ำทุกเดือน (ตั้งแต่เดือนนี้เป็นต้นไป)"),
        React.createElement("div", { className: "field" }, React.createElement("span", null, "สลิปการจ่ายเงิน"),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
            editing.slipData ? React.createElement("img", { src: editing.slipData, alt: "", style: { width: 64, height: 64, objectFit: "cover", borderRadius: 10 } }) : editing.slip && !editing.slipRemoved ? React.createElement(SlipImg, { id: editing.id, style: { width: 64, height: 64, objectFit: "cover", borderRadius: 10 } }) : React.createElement("div", { style: { width: 64, height: 64, borderRadius: 10, background: "#F1F3F0", fontSize: 11, color: "#99A09B", display: "flex", alignItems: "center", justifyContent: "center" } }, "ไม่มี"),
            React.createElement("label", { className: "btn btn-ghost", style: { cursor: "pointer" } }, busy ? "..." : editing.slipData || (editing.slip && !editing.slipRemoved) ? "เปลี่ยนสลิป" : "แนบสลิป", React.createElement("input", { type: "file", accept: "image/*", onChange: pickSlip, style: { display: "none" } })),
            (editing.slipData || (editing.slip && !editing.slipRemoved)) && React.createElement("button", { type: "button", className: "btn btn-ghost", onClick: () => setEditing({ ...editing, slipData: null, slipRemoved: true }) }, "ลบ")))),
      React.createElement("button", { className: "btn btn-primary btn-block", style: { marginTop: 14 }, onClick: save }, "บันทึก"),
      React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: () => setEditing(null) }, "ยกเลิก")))));
}
function DataBackup({ products, sales, platforms, expenses, onRestore }) {
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = () => { const d = /* @__PURE__ */ new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };
  const ymd = (v) => bkkDate(v);
  const salesTable = () => {
    const pm = Object.fromEntries(products.map((p) => [p.id, p]));
    const plm = Object.fromEntries(platforms.map((p) => [p.id, p]));
    const head = ["วันที่", "สินค้า", "SKU", "แพลตฟอร์ม", "จำนวน", "ราคา/ชิ้น", "ยอดขาย", "คูปอง", "ค่าธรรมเนียม", "รายจ่ายอื่นๆ", "ต้นทุน", "กำไร", "สถานะ", "เวลา", "ลูกค้า", "เลขออเดอร์", "สั่งซื้อตามแพลตฟอร์ม"];
    const rows = [...sales].sort((a, b) => new Date(a.date) - new Date(b.date)).map((s) => {
      const m = computeSaleMetrics(s, pm[s.productId], plm[s.platformId]);
      return [ymd(s.date), pm[s.productId]?.name || "", pm[s.productId]?.sku || "", plm[s.platformId]?.name || "", s.quantity, s.price, m.gross, m.coupon, m.fee, m.otherExpense, m.cost, m.profit, s.status === "returned" ? "ตีกลับ" : s.status === "lost" ? "สูญหาย" : "ปกติ", fmtTime(s.date), s.customer || "", s.orderNo || "", s.orderAt ? bkkDate(s.orderAt) + " " + hm(s.orderAt) : ""];
    });
    return [head, ...rows];
  };
  async function exportJson() {
    let slips = {};
    try { slips = await slipAll(); } catch (e) {}
    downloadFile("mies-backup-" + stamp() + ".json", JSON.stringify({ app: "mies", version: 2, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), products, sales, platforms, expenses, slips }), "application/json");
  }
  function exportCsv() {
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    downloadFile("mies-sales-" + stamp() + ".csv", "\ufeff" + salesTable().map((r) => r.map(q).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }
  async function exportXlsx() {
    try {
      const mod = await import("https://esm.sh/xlsx@0.18.5");
      const X = mod.utils ? mod : mod.default;
      const wb = X.utils.book_new();
      const bills = [...expenses].filter((e) => e.bill).sort((a, b) => a.date < b.date ? -1 : 1).map((e) => [e.date, e.name, e.amount, e.slip ? "มี" : "-"]);
      const monthly = expenses.filter((e) => !e.bill).map((e) => [e.name, e.amount, e.month, e.recurring ? "ทุกเดือน" : "เดือนเดียว"]);
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(salesTable()), "รายการขาย");
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["วันที่จ่าย", "รายการ", "จำนวนเงิน", "สลิป"], ...bills]), "บิลรายจ่าย");
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["รายการ", "จำนวนเงิน/เดือน", "เดือน", "ประเภท"], ...monthly]), "รายจ่ายรายเดือน");
      downloadFile("mies-report-" + stamp() + ".xlsx", X.write(wb, { bookType: "xlsx", type: "array" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (err) { alert("สร้างไฟล์ Excel ไม่ได้ (ต้องต่ออินเทอร์เน็ตในครั้งแรก) ลองใช้ CSV แทน"); }
  }
  function restore(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error("bad");
        if (window.confirm("กู้คืนข้อมูลจากไฟล์นี้? ข้อมูลปัจจุบันในแอปทั้งหมดจะถูกแทนที่ (สินค้า " + d.products.length + " รายการ, รายการขาย " + d.sales.length + " รายการ)")) {
          for (const [k, v] of Object.entries(d.slips || {})) await slipPut(k, v);
          onRestore(d);
        }
      } catch (err) { alert("ไฟล์สำรองไม่ถูกต้อง"); }
    };
    r.readAsText(f);
  }
  return React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
    React.createElement("div", { className: "section-title", style: { marginBottom: 10 } }, "ไฟล์ในเครื่อง / สำรองข้อมูล"),
    React.createElement("button", { className: "btn btn-primary btn-block", onClick: exportXlsx }, "ส่งออก Excel (.xlsx): ขาย + บิล + รายเดือน"),
    React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 8 }, onClick: exportJson }, "ไฟล์สำรองทั้งหมด (JSON รวมสลิป)"),
    React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: exportCsv }, "ส่งออกรายการขาย (CSV)"),
    React.createElement("label", { className: "btn btn-ghost btn-block", style: { marginTop: 8, cursor: "pointer", textAlign: "center" } }, "กู้คืนจากไฟล์สำรอง",
      React.createElement("input", { type: "file", accept: ".json,application/json", onChange: restore, style: { display: "none" } })),
    React.createElement("div", { style: { fontSize: 11, color: "#99A09B", marginTop: 10, textAlign: "center" } }, "เวอร์ชันแอป 33"));
}
function ImportModal({ products, platforms, onClose, onImport }) {
  const [step, setStep] = useState(1);
  const [platformId, setPlatformId] = useState(platforms[0]?.id || "");
  const [rawText, setRawText] = useState("");
  const [mapping, setMapping] = useState({ name: 0, quantity: 1, price: 2, coupon: -1, fee: -1, date: -1 });
  const [result, setResult] = useState(null);
  const rows = useMemo(
    () => rawText.trim().split("\n").filter(Boolean).map((line) => line.split(/\t|,/).map((c) => c.trim())),
    [rawText]
  );
  const header = rows[0] || [];
  const dataRows = rows.slice(1);
  const maxCols = header.length;
  const fieldLabels = {
    name: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32",
    quantity: "\u0E08\u0E33\u0E19\u0E27\u0E19",
    price: "\u0E23\u0E32\u0E04\u0E32",
    coupon: "\u0E04\u0E39\u0E1B\u0E2D\u0E07",
    fee: "\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21 (\u0E16\u0E49\u0E32\u0E21\u0E35\u0E43\u0E19\u0E44\u0E1F\u0E25\u0E4C)",
    date: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48"
  };
  const requiredFields = ["name", "quantity", "price"];
  function autoMapColumns(headerRow) {
    const lower = headerRow.map((h) => (h || "").toLowerCase());
    const find = (keywords) => {
      for (let i = 0; i < lower.length; i++) {
        if (keywords.some((k) => lower[i].includes(k))) return i;
      }
      return -1;
    };
    const guess = {
      name: find(["\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32", "product", "name", "sku", "item"]),
      quantity: find(["\u0E08\u0E33\u0E19\u0E27\u0E19", "qty", "quantity"]),
      price: find(["\u0E23\u0E32\u0E04\u0E32", "price", "amount", "\u0E22\u0E2D\u0E14"]),
      coupon: find(["\u0E04\u0E39\u0E1B\u0E2D\u0E07", "coupon", "\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14", "discount"]),
      fee: find(["\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21", "fee", "commission", "\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21"]),
      date: find(["\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48", "date", "\u0E40\u0E27\u0E25\u0E32", "time"])
    };
    requiredFields.forEach((k, i) => {
      if (guess[k] === -1) guess[k] = Math.min(i, headerRow.length - 1);
    });
    return guess;
  }
  function readData() {
    if (rows.length < 2) return;
    setMapping(autoMapColumns(header));
    setStep(2);
  }
  const mappingValid = requiredFields.every((k) => mapping[k] >= 0);
  function runImport() {
    const platform = platforms.find((p) => p.id === platformId);
    let imported = 0, skipped = 0, notFound = 0;
    const newSales = [];
    const stockDelta = {};
    dataRows.forEach((row) => {
      const name = row[mapping.name];
      const qty = parseFloat(row[mapping.quantity]);
      const price = parseFloat(row[mapping.price]);
      const coupon = mapping.coupon >= 0 ? parseFloat(row[mapping.coupon]) || 0 : 0;
      const dateRaw = mapping.date >= 0 ? row[mapping.date] : null;
      if (!name || isNaN(qty) || isNaN(price) || qty <= 0) {
        skipped++;
        return;
      }
      const product = products.find(
        (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase() || p.sku.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (!product) {
        notFound++;
        return;
      }
      let date = new Date(dateRaw);
      if (isNaN(date.getTime())) date = /* @__PURE__ */ new Date();
      const fileFee = mapping.fee >= 0 ? parseFloat(row[mapping.fee]) : NaN;
      const fee = !isNaN(fileFee) ? fileFee : price * qty * ((platform?.feePercent || 0) / 100);
      newSales.push({
        id: uid(),
        productId: product.id,
        platformId,
        quantity: qty,
        price,
        coupon,
        fee: Math.round(fee * 100) / 100,
        unitCost: product.cost || 0,
        date: date.toISOString()
      });
      stockDelta[product.id] = (stockDelta[product.id] || 0) + qty;
      imported++;
    });
    onImport(newSales, stockDelta);
    setResult({ imported, skipped, notFound });
    setStep(3);
  }
  return /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("div", { className: "modal-title" }, "\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C"), /* @__PURE__ */ React.createElement("button", { className: "icon-btn", onClick: onClose }, /* @__PURE__ */ React.createElement(X, { size: 18 }))), /* @__PURE__ */ React.createElement("div", { className: "step-indicator" }, ["Data", "Mapping", "Result"].map((label, i) => /* @__PURE__ */ React.createElement("div", { key: label, className: "step-chip " + (step === i + 1 ? "active" : step > i + 1 ? "done" : "") }, /* @__PURE__ */ React.createElement("span", { className: "step-num" }, String(i + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, label)))), step === 1 && /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Platform \u0E02\u0E2D\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49"), /* @__PURE__ */ React.createElement("select", { value: platformId, onChange: (e) => setPlatformId(e.target.value) }, platforms.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.name)))), /* @__PURE__ */ React.createElement("div", { className: "paste-area" }, /* @__PURE__ */ React.createElement(FileSpreadsheet, { size: 22, strokeWidth: 1.6 }), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      placeholder: "\u0E27\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 (\u0E04\u0E31\u0E48\u0E19\u0E14\u0E49\u0E27\u0E22 Tab \u0E2B\u0E23\u0E37\u0E2D , )\n\u0E41\u0E16\u0E27\u0E41\u0E23\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E31\u0E27\u0E15\u0E32\u0E23\u0E32\u0E07 \u0E40\u0E0A\u0E48\u0E19:\n\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32,\u0E08\u0E33\u0E19\u0E27\u0E19,\u0E23\u0E32\u0E04\u0E32,\u0E04\u0E39\u0E1B\u0E2D\u0E07,\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21,\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\n\n\u0E16\u0E49\u0E32\u0E44\u0E1F\u0E25\u0E4C\u0E08\u0E32\u0E01\u0E41\u0E1E\u0E25\u0E15\u0E1F\u0E2D\u0E23\u0E4C\u0E21\u0E21\u0E35\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21\u0E08\u0E23\u0E34\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E41\u0E25\u0E49\u0E27 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E43\u0E0A\u0E49\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E19\u0E31\u0E49\u0E19\u0E41\u0E17\u0E19\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 %",
      value: rawText,
      onChange: (e) => setRawText(e.target.value),
      rows: 8
    }
  )), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary btn-block", disabled: rows.length < 2, onClick: readData }, "\u0E2D\u0E48\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25")), step === 2 && /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "mapping-grid" }, Object.keys(fieldLabels).map((key) => /* @__PURE__ */ React.createElement("label", { className: "field", key }, /* @__PURE__ */ React.createElement("span", null, fieldLabels[key], requiredFields.includes(key) ? " *" : ""), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: mapping[key],
      onChange: (e) => setMapping({ ...mapping, [key]: parseInt(e.target.value) })
    },
    !requiredFields.includes(key) && /* @__PURE__ */ React.createElement("option", { value: -1 }, "\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C\u0E19\u0E35\u0E49"),
    header.map((h, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, "\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C ", i + 1, ": ", h || "(\u0E27\u0E48\u0E32\u0E07)"))
  )))), !mappingValid && /* @__PURE__ */ React.createElement("div", { className: "mini-empty", style: { padding: "0 0 10px", textAlign: "left" } }, "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 / \u0E08\u0E33\u0E19\u0E27\u0E19 / \u0E23\u0E32\u0E04\u0E32 \u0E43\u0E2B\u0E49\u0E04\u0E23\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32"), /* @__PURE__ */ React.createElement("div", { className: "preview-table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "preview-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, header.map((h, i) => /* @__PURE__ */ React.createElement("th", { key: i }, h)))), /* @__PURE__ */ React.createElement("tbody", null, dataRows.slice(0, 5).map((r, i) => /* @__PURE__ */ React.createElement("tr", { key: i }, r.map((c, j) => /* @__PURE__ */ React.createElement("td", { key: j }, c))))))), /* @__PURE__ */ React.createElement("div", { className: "modal-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: () => setStep(1) }, "\u0E22\u0E49\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", disabled: !mappingValid, onClick: runImport }, "\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25"))), step === 3 && result && /* @__PURE__ */ React.createElement("div", { className: "modal-body import-result" }, /* @__PURE__ */ React.createElement("div", { className: "result-icon" }, /* @__PURE__ */ React.createElement(Check, { size: 30, strokeWidth: 2.4 })), /* @__PURE__ */ React.createElement("div", { className: "result-title" }, "\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08"), /* @__PURE__ */ React.createElement("div", { className: "result-line" }, "\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32 ", result.imported, " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"), result.skipped > 0 && /* @__PURE__ */ React.createElement("div", { className: "result-line muted" }, "\u0E02\u0E49\u0E32\u0E21 ", result.skipped, " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"), result.notFound > 0 && /* @__PURE__ */ React.createElement("div", { className: "result-line muted" }, "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E21\u0E48\u0E1E\u0E1A ", result.notFound, " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"), /* @__PURE__ */ React.createElement("div", { className: "modal-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: onClose }, "\u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: onClose }, "\u0E14\u0E39\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22")))));
}
function SalesPage({ products, platforms, sales, onAddSale, onImport, onDeleteSale, onEditSale, onSetStatus, onLearnAlias, onPlatformsChange, expenses, onExpensesChange, onRestore }) {
  const [showImport, setShowImport] = useState(false);
  return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22", subtitle: fmtNumber(sales.length) + " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", lowStockCount: 0 }), /* @__PURE__ */ React.createElement("div", { className: "sales-toolbar" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-block", onClick: () => setShowImport(true) }, /* @__PURE__ */ React.createElement(Upload, { size: 16 }), " Import Orders")), /* @__PURE__ */ React.createElement(QuickSaleForm, { products, platforms, sales, onSubmit: onAddSale, onLearn: onLearnAlias }), /* @__PURE__ */ React.createElement(SalesHistory, { sales, products, platforms, onDelete: onDeleteSale, onEdit: onEditSale, onStatus: onSetStatus }), /* @__PURE__ */ React.createElement(PlatformManager, { platforms, sales, onChange: onPlatformsChange }), /* @__PURE__ */ React.createElement(ExpenseManager, { expenses: expenses || [], onChange: onExpensesChange }), /* @__PURE__ */ React.createElement(DataBackup, { products, sales, platforms, expenses: expenses || [], onRestore }), showImport && /* @__PURE__ */ React.createElement(
    ImportModal,
    {
      products,
      platforms,
      onClose: () => setShowImport(false),
      onImport
    }
  ));
}
function compressImage(file, maxSide = 240, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}
function ProductImageField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try { onChange(await compressImage(f)); } catch (err) { alert("\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E39\u0E1B\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49"); }
    setBusy(false);
  }
  return React.createElement("div", { className: "field" },
    React.createElement("span", null, "\u0E23\u0E39\u0E1B\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
      React.createElement("div", { style: { width: 72, height: 72, borderRadius: 12, background: "#F1F3F0", border: "1px solid #E1E5E0", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#99A09B", fontSize: 11 } },
        value ? React.createElement("img", { src: value, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } }) : "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E39\u0E1B"),
      React.createElement("label", { className: "btn btn-ghost", style: { cursor: "pointer" } },
        busy ? "..." : value ? "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E23\u0E39\u0E1B" : "\u0E40\u0E25\u0E37\u0E2D\u0E01/\u0E16\u0E48\u0E32\u0E22\u0E23\u0E39\u0E1B",
        React.createElement("input", { type: "file", accept: "image/*", onChange: pick, style: { display: "none" } })),
      value && React.createElement("button", { type: "button", className: "btn btn-ghost", onClick: () => onChange("") }, "\u0E25\u0E1A")));
}
function ProductForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [image, setImage] = useState(initial?.image || "");
  const [aliases, setAliases] = useState(initial?.aliases || "");
  const [sku, setSku] = useState(initial?.sku || "");
  const [cost, setCost] = useState(initial?.cost ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [stock, setStock] = useState(initial?.stock ?? "");
  const [lowStockThreshold, setLowStockThreshold] = useState(initial?.lowStockThreshold ?? 5);
  const canSave = name && sku && cost !== "" && price !== "" && stock !== "";
  function save() {
    if (!canSave) return;
    onSave({
      id: initial?.id || uid(),
      name,
      sku,
      cost: parseFloat(cost),
      price: parseFloat(price),
      stock: parseFloat(stock),
      lowStockThreshold: parseFloat(lowStockThreshold) || 5,
      image,
      aliases
    });
  }
  return /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("div", { className: "modal-title" }, initial ? "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" : "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), /* @__PURE__ */ React.createElement("button", { className: "icon-btn", onClick: onClose }, /* @__PURE__ */ React.createElement(X, { size: 18 }))), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "form-grid" }, /* @__PURE__ */ React.createElement(ProductImageField, { value: image, onChange: setImage }), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), /* @__PURE__ */ React.createElement("input", { value: name, onChange: (e) => setName(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "SKU"), /* @__PURE__ */ React.createElement("input", { value: sku, onChange: (e) => setSku(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "ชื่อใน Shopee / ชื่อเรียกอื่น (1 ชื่อต่อบรรทัด ใช้ช่วยสแกนรูป)"), /* @__PURE__ */ React.createElement("textarea", { rows: 3, value: aliases, onChange: (e) => setAliases(e.target.value), style: { width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #E1E5E0", font: "inherit" } })), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19"), /* @__PURE__ */ React.createElement("input", { type: "number", value: cost, onChange: (e) => setCost(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E23\u0E32\u0E04\u0E32\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("input", { type: "number", value: price, onChange: (e) => setPrice(e.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E2A\u0E15\u0E47\u0E2D\u0E01"), /* @__PURE__ */ React.createElement("input", { type: "number", value: stock, onChange: (e) => setStock(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E2B\u0E25\u0E37\u0E2D"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      value: lowStockThreshold,
      onChange: (e) => setLowStockThreshold(e.target.value)
    }
  )))), /* @__PURE__ */ React.createElement("div", { className: "modal-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: onClose }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", disabled: !canSave, onClick: save }, "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01")))));
}
function ProductsPage({ products, onSave, onDelete }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const status = getStockStatus(p);
    const matchesFilter = filter === "all" || status === filter;
    return matchesSearch && matchesFilter;
  });
  return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32", subtitle: fmtNumber(products.length) + " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", lowStockCount: 0 }), /* @__PURE__ */ React.createElement("div", { className: "products-toolbar" }, /* @__PURE__ */ React.createElement("div", { className: "search-box" }, /* @__PURE__ */ React.createElement(Search, { size: 16 }), /* @__PURE__ */ React.createElement(
    "input",
    {
      placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2B\u0E23\u0E37\u0E2D SKU",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-primary btn-icon-only",
      onClick: () => {
        setEditing(null);
        setShowForm(true);
      }
    },
    /* @__PURE__ */ React.createElement(Plus, { size: 18 })
  )), /* @__PURE__ */ React.createElement("div", { className: "filter-pills" }, ["all", "\u0E1B\u0E01\u0E15\u0E34", "\u0E43\u0E01\u0E25\u0E49\u0E2B\u0E21\u0E14", "\u0E2B\u0E21\u0E14"].map((f) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: f,
      className: "filter-pill " + (filter === f ? "active" : ""),
      onClick: () => setFilter(f)
    },
    f === "all" ? "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14" : f
  ))), products.length === 0 ? /* @__PURE__ */ React.createElement(
    EmptyState,
    {
      icon: Package,
      title: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32",
      subtitle: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22",
      actionLabel: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32",
      onAction: () => setShowForm(true)
    }
  ) : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E04\u0E49\u0E19\u0E2B\u0E32") : /* @__PURE__ */ React.createElement("div", { className: "product-cards" }, filtered.map((p) => {
    const status = getStockStatus(p);
    const marginPerUnit = p.price - p.cost;
    return /* @__PURE__ */ React.createElement("div", { className: "product-card", key: p.id }, /* @__PURE__ */ React.createElement("div", { className: "product-card-top" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", minWidth: 0 } }, p.image ? /* @__PURE__ */ React.createElement("img", { src: p.image, alt: "", style: { width: 48, height: 48, objectFit: "cover", borderRadius: 10, flexShrink: 0, border: "1px solid #E1E5E0" } }) : null, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "product-name" }, p.name), /* @__PURE__ */ React.createElement("div", { className: "product-sku" }, p.sku))), /* @__PURE__ */ React.createElement("div", { className: "product-actions" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "icon-btn-sm",
        onClick: () => {
          setEditing(p);
          setShowForm(true);
        }
      },
      /* @__PURE__ */ React.createElement(Edit2, { size: 14 })
    ), /* @__PURE__ */ React.createElement("button", { className: "icon-btn-sm", onClick: () => onDelete(p.id) }, /* @__PURE__ */ React.createElement(Trash2, { size: 14 })))), /* @__PURE__ */ React.createElement("div", { className: "product-card-figures" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "pcf-label" }, "\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "pcf-value" }, fmtCurrency(p.cost))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "pcf-label" }, "\u0E23\u0E32\u0E04\u0E32\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("div", { className: "pcf-value" }, fmtCurrency(p.price))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "pcf-label" }, "\u0E01\u0E33\u0E44\u0E23/\u0E0A\u0E34\u0E49\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "pcf-value accent" }, fmtCurrency(marginPerUnit)))), /* @__PURE__ */ React.createElement("div", { className: "product-card-bottom" }, /* @__PURE__ */ React.createElement(StockDot, { status }), /* @__PURE__ */ React.createElement("span", null, status, " \xB7 \u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D ", fmtNumber(p.stock))));
  })), showForm && /* @__PURE__ */ React.createElement(
    ProductForm,
    {
      initial: editing,
      onClose: () => setShowForm(false),
      onSave: (p) => {
        onSave(p);
        setShowForm(false);
      }
    }
  ));
}
function AnalyticsPage({ sales, products, platforms, dateState, setDateState }) {
  const { preset, customRange } = dateState;
  const { start, end } = getRange(preset, customRange.start, customRange.end);
  const filteredSales = sales.filter((s) => {
    const d = new Date(s.date);
    return d >= start && d <= end;
  });
  const agg = aggregate(filteredSales, products, platforms);
  const platformRows = platforms.map((pl) => {
    const plSales = filteredSales.filter((s) => s.platformId === pl.id);
    const a = aggregate(plSales, products, platforms);
    return { ...pl, ...a };
  }).filter((r) => r.orders > 0).sort((a, b) => b.gross - a.gross);
  const productRows = useMemo(() => {
    const byProduct = {};
    filteredSales.forEach((s) => {
      const p = products.find((pp) => pp.id === s.productId);
      if (!p) return;
      const m = computeSaleMetrics(s, p, platforms.find((pl) => pl.id === s.platformId));
      if (!byProduct[p.id]) byProduct[p.id] = { product: p, qty: 0, gross: 0, profit: 0 };
      byProduct[p.id].qty += s.status === "returned" || s.status === "lost" ? 0 : s.quantity;
      byProduct[p.id].gross += m.gross;
      byProduct[p.id].profit += m.profit;
    });
    return Object.values(byProduct).sort((a, b) => b.gross - a.gross);
  }, [filteredSales, products, platforms]);
  if (sales.length === 0) {
    return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C", subtitle: "Business Intelligence", lowStockCount: 0 }), /* @__PURE__ */ React.createElement(EmptyState, { icon: BarChart2, title: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C", subtitle: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22\u0E01\u0E48\u0E2D\u0E19" }));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C", subtitle: "Business Intelligence", lowStockCount: 0 }), /* @__PURE__ */ React.createElement(
    DateFilter,
    {
      preset,
      setPreset: (p) => setDateState({ ...dateState, preset: p }),
      customRange,
      setCustomRange: (c) => setDateState({ ...dateState, customRange: c })
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, "\u0E2A\u0E23\u0E38\u0E1B\u0E01\u0E32\u0E23\u0E40\u0E07\u0E34\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "finance-breakdown" }, /* @__PURE__ */ React.createElement("div", { className: "fb-row" }, /* @__PURE__ */ React.createElement("span", null, "Gross Revenue"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(agg.gross))), /* @__PURE__ */ React.createElement("div", { className: "fb-row muted" }, /* @__PURE__ */ React.createElement("span", null, "Coupon"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(agg.coupon))), /* @__PURE__ */ React.createElement("div", { className: "fb-row muted" }, /* @__PURE__ */ React.createElement("span", null, "Platform Fee"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(agg.fee))), /* @__PURE__ */ React.createElement("div", { className: "fb-row strong" }, /* @__PURE__ */ React.createElement("span", null, "Net Revenue"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(agg.netRevenue))), /* @__PURE__ */ React.createElement("div", { className: "fb-row muted" }, /* @__PURE__ */ React.createElement("span", null, "Cost"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(agg.cost))), /* @__PURE__ */ React.createElement("div", { className: "fb-row profit" }, /* @__PURE__ */ React.createElement("span", null, "Net Profit"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(agg.profit))))), /* @__PURE__ */ React.createElement(SalesChart, { sales, products, platforms }), /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, "\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07"), platformRows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49") : /* @__PURE__ */ React.createElement("div", { className: "analysis-table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "analysis-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Platform"), /* @__PURE__ */ React.createElement("th", null, "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("th", null, "\u0E01\u0E33\u0E44\u0E23"), /* @__PURE__ */ React.createElement("th", null, "Margin"))), /* @__PURE__ */ React.createElement("tbody", null, platformRows.map((r) => /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "table-dot", style: { background: r.color } }), r.name), /* @__PURE__ */ React.createElement("td", null, fmtCurrency(r.gross)), /* @__PURE__ */ React.createElement("td", null, fmtCurrency(r.profit)), /* @__PURE__ */ React.createElement("td", null, r.margin.toFixed(1), "%"))))))), /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, "Margin Analysis \u0E15\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), productRows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49") : /* @__PURE__ */ React.createElement("div", { className: "margin-list" }, [...productRows].map((r) => ({ ...r, _m: r.gross > 0 ? r.profit / r.gross * 100 : -999 })).sort((a, b) => b._m - a._m).map((r) => {
    const margin = r.gross > 0 ? r.profit / r.gross * 100 : 0;
    return /* @__PURE__ */ React.createElement("div", { className: "margin-row", key: r.product.id }, /* @__PURE__ */ React.createElement("div", { className: "margin-name" }, r.product.name, React.createElement("div", { style: { fontSize: 11.5, fontWeight: 400, color: "#68706B" } }, "ยอดขาย " + fmtCurrency(r.gross) + " · กำไร " + fmtCurrency(r.profit))), /* @__PURE__ */ React.createElement("div", { className: "margin-bar-track" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "margin-bar-fill",
        style: { width: Math.max(margin, 2) + "%" }
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "margin-pct" }, margin.toFixed(1), "%"));
  }))), /* @__PURE__ */ React.createElement(PlatformFeeReport, { sales, products, platforms }), /* @__PURE__ */ React.createElement(CustomerStats, { sales, products }));
}
function PlatformFeeReport({ sales, products, platforms }) {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => bkkDate(d);
  const now = /* @__PURE__ */ new Date();
  const [mode, setMode] = useState("day");
  const [from, setFrom] = useState(bkkDate(now).slice(0, 8) + "01");
  const [to, setTo] = useState(ymd(now));
  const [limit, setLimit] = useState(14);
  const pct = (f, g) => g > 0 ? Math.round(f / g * 1000) / 10 + "%" : "-";
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p]));
  const groups = useMemo(() => {
    const map = {};
    sales.forEach((sl) => {
      const day = ymd(sl.date);
      if (mode === "custom" && (day < from || day > to)) return;
      const key = mode === "day" ? day : mode === "month" ? day.slice(0, 7) : "range";
      const m = computeSaleMetrics(sl, productMap[sl.productId], platformMap[sl.platformId]);
      if (!map[key]) map[key] = { key, byPlatform: {}, gross: 0, fee: 0 };
      const g = map[key];
      if (!g.byPlatform[sl.platformId]) g.byPlatform[sl.platformId] = { gross: 0, fee: 0, orders: 0 };
      const b = g.byPlatform[sl.platformId];
      b.gross += m.gross; b.fee += m.fee; b.orders += 1;
      g.gross += m.gross; g.fee += m.fee;
    });
    return Object.values(map).sort((a, b) => a.key < b.key ? 1 : -1);
  }, [sales, products, platforms, mode, from, to]);
  const labelOf = (key) => {
    if (key === "range") return from + " \u2192 " + to;
    if (mode === "month") return new Date(key + "-01T00:00:00").toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    return new Date(key + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" });
  };
  const modes = [["day", "\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19"], ["month", "\u0E23\u0E32\u0E22\u0E40\u0E14\u0E37\u0E2D\u0E19"], ["custom", "\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E2D\u0E07"]];
  const shown = mode === "custom" ? groups : groups.slice(0, limit);
  return React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 } },
      React.createElement("div", { className: "section-title" }, "\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21\u0E41\u0E1E\u0E25\u0E15\u0E1F\u0E2D\u0E23\u0E4C\u0E21 (%)"),
      React.createElement("div", { className: "toggle-group" }, modes.map(([id, label]) =>
        React.createElement("button", { key: id, className: "toggle" + (mode === id ? " active" : ""), onClick: () => setMode(id) }, label)))),
    mode === "custom" && React.createElement("div", { className: "field-row", style: { marginBottom: 12 } },
      React.createElement("label", { className: "field" }, React.createElement("span", null, "\u0E08\u0E32\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48"),
        React.createElement("input", { type: "date", value: from, onChange: (e) => setFrom(e.target.value) })),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "\u0E16\u0E36\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48"),
        React.createElement("input", { type: "date", value: to, onChange: (e) => setTo(e.target.value) }))),
    shown.length === 0 && React.createElement("div", { className: "mini-empty" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49"),
    shown.map((g) => React.createElement("div", { key: g.key, style: { padding: "10px 0", borderTop: "1px solid #EEF0ED" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13.5, marginBottom: 6 } },
        React.createElement("span", null, labelOf(g.key)),
        React.createElement("span", null, "\u0E23\u0E27\u0E21 ", pct(g.fee, g.gross), " \u00B7 ", fmtCurrency(g.fee))),
      Object.entries(g.byPlatform).sort((a, b) => b[1].gross - a[1].gross).map(([pid, b]) => {
        const pl = platformMap[pid];
        return React.createElement("div", { key: pid, style: { display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 } },
          React.createElement("span", { style: { width: 9, height: 9, borderRadius: 5, background: pl?.color || "#999", flexShrink: 0 } }),
          React.createElement("span", { style: { flex: 1, minWidth: 0 } }, pl?.name || "-"),
          React.createElement("span", { style: { color: "#68706B", fontSize: 12 } }, fmtCurrency(b.fee), " / ", fmtCurrency(b.gross)),
          React.createElement("span", { style: { fontWeight: 700, width: 54, textAlign: "right" } }, pct(b.fee, b.gross)));
      }))),
    mode !== "custom" && groups.length > limit && React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 8 }, onClick: () => setLimit(limit + 14) }, "\u0E41\u0E2A\u0E14\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21"),
    React.createElement("div", { style: { fontSize: 11.5, color: "#99A09B", marginTop: 10 } }, "% = \u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21 \u00F7 \u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 (\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E31\u0E01\u0E04\u0E39\u0E1B\u0E2D\u0E07)"));
}
function SettingsPanel({ products, sales, platforms, setPlatforms, onRestore }) {
  const [newName, setNewName] = useState("");
  const palette = ["#E85D3A", "#1877F2", "#06C755", "#8E44AD", "#16A085", "#D35400"];
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const used = (id) => sales.some((x) => x.platformId === id);
  const upd = (id, patch) => setPlatforms(platforms.map((p) => p.id === id ? { ...p, ...patch } : p));
  function add() {
    const n = newName.trim();
    if (!n) return;
    setPlatforms([...platforms, { id: "pf_" + uid(), name: n, color: palette[platforms.length % palette.length], feePercent: 0 }]);
    setNewName("");
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportJson() { download("mies-backup-" + day + ".json", JSON.stringify({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), products, sales, platforms }), "application/json"); }
  function exportCsv() {
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const head = ["วันที่", "แพลตฟอร์ม", "สินค้า", "SKU", "จำนวน", "ราคา/ชิ้น", "ยอดขาย", "คูปอง", "ค่าธรรมเนียม", "รายจ่ายอื่นๆ", "ต้นทุน", "กำไร"];
    const rows = [...sales].sort((a, b) => new Date(a.date) - new Date(b.date)).map((x) => {
      const p = products.find((t) => t.id === x.productId), pl = platforms.find((t) => t.id === x.platformId);
      const m = computeSaleMetrics(x, p, pl);
      return [new Date(x.date).toISOString().slice(0, 10), pl?.name, p?.name, p?.sku, x.quantity, x.price, m.gross, m.coupon, m.fee, m.otherExpense, m.cost, m.profit];
    });
    download("mies-sales-" + day + ".csv", "\ufeff" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }
  function restore(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error("bad");
        if (window.confirm("แทนที่ข้อมูลปัจจุบันทั้งหมดด้วยไฟล์สำรองนี้?")) onRestore(d);
      } catch (err) { alert("ไฟล์สำรองไม่ถูกต้อง"); }
    };
    r.readAsText(f);
  }
  const inp = { padding: 8, borderRadius: 8, border: "1px solid #E1E5E0", fontSize: 14, minWidth: 0 };
  return React.createElement("div", { className: "page-inner" },
    React.createElement("div", { className: "card section-card" },
      React.createElement("div", { className: "section-title", style: { marginBottom: 10 } }, "แพลตฟอร์ม / ค่าธรรมเนียม (%)"),
      platforms.map((pl) => React.createElement("div", { key: pl.id, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
        React.createElement("span", { style: { width: 10, height: 10, borderRadius: 5, background: pl.color, flexShrink: 0 } }),
        React.createElement("input", { style: { ...inp, flex: 1 }, value: pl.name, onChange: (e) => upd(pl.id, { name: e.target.value }) }),
        React.createElement("input", { style: { ...inp, width: 64 }, type: "number", min: "0", step: "any", inputMode: "decimal", value: pl.feePercent, onChange: (e) => upd(pl.id, { feePercent: e.target.value === "" ? "" : parseFloat(e.target.value) }) }),
        React.createElement("span", null, "%"),
        React.createElement("button", { className: "icon-btn-sm", disabled: used(pl.id), title: used(pl.id) ? "มีรายการขายอยู่ ลบไม่ได้" : "ลบ", style: { opacity: used(pl.id) ? 0.3 : 1 }, onClick: () => window.confirm("ลบแพลตฟอร์มนี้?") && setPlatforms(platforms.filter((x) => x.id !== pl.id)) }, React.createElement(Trash2, { size: 14 })))),
      React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } },
        React.createElement("input", { style: { ...inp, flex: 1 }, placeholder: "ชื่อแพลตฟอร์มใหม่", value: newName, onChange: (e) => setNewName(e.target.value) }),
        React.createElement("button", { className: "btn btn-primary", onClick: add }, "เพิ่ม")),
      React.createElement("div", { style: { fontSize: 11.5, color: "#99A09B", marginTop: 8 } }, "แก้ % มีผลกับรายการขายใหม่เท่านั้น รายการเก่าไม่เปลี่ยน")),
    React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
      React.createElement("div", { className: "section-title", style: { marginBottom: 10 } }, "สำรอง / ส่งออกข้อมูล"),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
        React.createElement("button", { className: "btn btn-outline btn-block", onClick: exportJson }, "ดาวน์โหลดไฟล์สำรอง (.json)"),
        React.createElement("button", { className: "btn btn-outline btn-block", onClick: exportCsv }, "ส่งออกรายการขาย (.csv เปิดใน Excel)"),
        React.createElement("label", { className: "btn btn-outline btn-block", style: { cursor: "pointer", textAlign: "center" } }, "กู้คืนจากไฟล์สำรอง (.json)",
          React.createElement("input", { type: "file", accept: ".json,application/json", onChange: restore, style: { display: "none" } })))));
}
function CustomerStats({ sales, products }) {
  const [sort, setSort] = useState("orders");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(15);
  const pm = Object.fromEntries(products.map((p) => [p.id, p]));
  const cn = (x) => String(x || "").trim().toLowerCase();
  const { list, anon } = useMemo(() => {
    const map = {}, anonSet = new Set();
    sales.forEach((s) => {
      if (s.status) return;
      const k = cn(s.customer);
      const ok = s.orderId || s.id;
      if (!k) { anonSet.add(ok); return; }
      const c = map[k] || (map[k] = { name: String(s.customer).trim(), orders: {}, total: 0, last: s.date });
      (c.orders[ok] || (c.orders[ok] = { key: ok, date: s.date, orderNo: s.orderNo, rows: [], amount: 0 })).rows.push(s);
      c.orders[ok].amount += (s.price || 0) * (s.quantity || 0);
      c.total += (s.price || 0) * (s.quantity || 0);
      if (new Date(s.date) > new Date(c.last)) c.last = s.date;
    });
    return { list: Object.values(map).map((c) => ({ ...c, count: Object.keys(c.orders).length })), anon: anonSet.size };
  }, [sales]);
  const repeat = list.filter((c) => c.count >= 2).length;
  const shown = list.filter((c) => !cn(q) || cn(c.name).includes(cn(q))).sort((a, b) => sort === "orders" ? b.count - a.count || b.total - a.total : sort === "total" ? b.total - a.total : new Date(b.last) - new Date(a.last));
  const tg = (id, label) => React.createElement("button", { key: id, className: "toggle" + (sort === id ? " active" : ""), onClick: () => setSort(id) }, label);
  return React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
    React.createElement("div", { className: "section-title", style: { marginBottom: 6 } }, "สถิติลูกค้า"),
    list.length === 0 ? React.createElement("div", { className: "mini-empty" }, "ยังไม่มีข้อมูลลูกค้า ใส่ชื่อ/ID ลูกค้าตอนบันทึกการขายเพื่อดูสถิติ") : React.createElement("div", null,
      React.createElement("div", { style: { fontSize: 13, color: "#68706B", marginBottom: 8 } }, "ลูกค้า " + list.length + " คน · ซื้อซ้ำ " + repeat + " คน (" + Math.round(repeat / list.length * 100) + "%)" + (anon > 0 ? " · ไม่ระบุชื่อ " + anon + " ออเดอร์" : "")),
      React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 } },
        React.createElement("div", { className: "toggle-group" }, tg("orders", "สั่งบ่อยสุด"), tg("total", "ยอดสูงสุด"), tg("last", "ล่าสุด")),
        React.createElement("input", { type: "search", value: q, placeholder: "ค้นหาชื่อลูกค้า", onChange: (e) => { setQ(e.target.value); setLimit(15); }, style: { flex: 1, minWidth: 120, padding: "6px 10px", borderRadius: 10, border: "1px solid #E1E5E0", font: "inherit", fontSize: 13 } })),
      shown.slice(0, limit).map((c) => React.createElement("div", { key: c.name, style: { borderTop: "1px solid #EEF0ED", padding: "8px 0" } },
        React.createElement("button", { type: "button", onClick: () => setOpen(open === c.name ? null : c.name), style: { all: "unset", display: "flex", alignItems: "center", gap: 8, width: "100%", cursor: "pointer" } },
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, wordBreak: "break-word" } }, c.name, c.count >= 2 && React.createElement("span", { style: { marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#1A7F4B", background: "#E6F4EC", borderRadius: 8, padding: "1px 7px" } }, "ซื้อซ้ำ")),
            React.createElement("div", { style: { fontSize: 12, color: "#68706B" } }, "ล่าสุด " + fmtBkkDate(c.last))),
          React.createElement("div", { style: { textAlign: "right" } }, React.createElement("div", { style: { fontWeight: 700, fontSize: 14 } }, c.count + " ครั้ง"), React.createElement("div", { style: { fontSize: 12, color: "#68706B" } }, fmtCurrency(c.total)))),
        open === c.name && React.createElement("div", { style: { marginTop: 6, background: "#F6F7F5", borderRadius: 10, padding: "6px 10px" } },
          Object.values(c.orders).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20).map((o) => React.createElement("div", { key: o.key, style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "3px 0" } },
            React.createElement("span", { style: { minWidth: 0, wordBreak: "break-word" } }, fmtBkkDate(o.date) + (o.orderNo ? " · #" + o.orderNo : "") + " · " + o.rows.map((r) => (pm[r.productId] || {}).name || "?").join(", ")),
            React.createElement("span", { style: { fontWeight: 600, flexShrink: 0 } }, fmtCurrency(o.amount))))))),
      shown.length > limit && React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 8 }, onClick: () => setLimit(limit + 15) }, "แสดงเพิ่ม")));
}
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr("");
    try { onLogin(await signIn(email.trim(), password)); }
    catch (e) { setErr(e.message || "เข้าสู่ระบบไม่สำเร็จ"); }
    setBusy(false);
  }
  const box = { width: "100%", boxSizing: "border-box", padding: 12, marginBottom: 10, borderRadius: 10, border: "1px solid #ccd", fontSize: 16 };
  return React.createElement("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F7F5", fontFamily: "-apple-system, sans-serif" } },
    React.createElement("div", { style: { width: 300 } },
      React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: "#0F2B26", marginBottom: 14 } }, "MIES \u2013 \u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A"),
      React.createElement("input", { style: box, type: "email", placeholder: "Email", value: email, onChange: (e) => setEmail(e.target.value) }),
      React.createElement("input", { style: box, type: "password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() }),
      err && React.createElement("div", { style: { color: "#B42318", fontSize: 13, marginBottom: 8 } }, err),
      React.createElement("button", { className: "btn btn-primary btn-block", disabled: busy || !email || !password, onClick: submit }, busy ? "..." : "Login")));
}
var STORAGE_KEY = "mies_dashboard_v1";
function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read stored data", e);
    return null;
  }
}
function App() {
  const stored = loadStoredState();
  const [products, setProducts] = useState(stored?.products || []);
  const [platforms, setPlatforms] = useState(stored?.platforms || DEFAULT_PLATFORMS);
  const [sales, setSales] = useState(stored?.sales || []);
  const [expenses, setExpenses] = useState(stored?.expenses || []);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dateState, setDateState] = useState({
    preset: "today",
    customRange: { start: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), end: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) }
  });
  const cloudOn = cloudConfigured();
  const [session, setSession] = useState(cloudOn ? getSession() : null);
  const [ready, setReady] = useState(!cloudOn);
  const [syncMsg, setSyncMsg] = useState("");
  function handleAuthError(e) {
    if (e && e.message === "session expired") { signOut(); setSession(null); setReady(false); return true; }
    return false;
  }
  const baseRef = useRef(null);
  const latestRef = useRef(null);
  latestRef.current = { products, sales, platforms, expenses };
  const norm = (d) => ({ products: d.products || [], sales: d.sales || [], platforms: d.platforms || [], expenses: d.expenses || [] });
  function mergeWithRemote(remote) {
    const l = latestRef.current, b = baseRef.current || {}, r = norm(remote);
    const m = {
      products: mergeById(b.products, l.products, r.products, (lv, rv, bv) => bv ? { ...lv, stock: rv.stock + (lv.stock - bv.stock) } : lv),
      sales: mergeById(b.sales, l.sales, r.sales),
      platforms: mergeById(b.platforms, l.platforms, r.platforms),
      expenses: mergeById(b.expenses, l.expenses, r.expenses)
    };
    setProducts(m.products); setSales(m.sales); setPlatforms(m.platforms.length ? m.platforms : DEFAULT_PLATFORMS); setExpenses(m.expenses);
    baseRef.current = r;
  }
  useEffect(() => {
    if (!cloudOn || !session) return;
    let cancelled = false;
    setSyncMsg("กำลังโหลดข้อมูล…");
    loadRemote().then((remote) => {
      if (cancelled) return;
      if (remote) {
        const r = norm(remote);
        setProducts(r.products); setSales(r.sales); if (r.platforms.length) setPlatforms(r.platforms); setExpenses(r.expenses);
        baseRef.current = r;
      } else if (products.length || sales.length) {
        saveRemote({ products, sales, platforms, expenses }).then(() => { baseRef.current = { products, sales, platforms, expenses }; }).catch(() => {});
      }
      setReady(true); setSyncMsg("");
    }).catch((e) => {
      if (cancelled || handleAuthError(e)) return;
      setSyncMsg("ออฟไลน์ – ใช้ข้อมูลในเครื่อง (รีเฟรชเมื่อออนไลน์)");
    });
    return () => { cancelled = true; };
  }, [session]);
  useEffect(() => {
    if (!cloudOn || !session || !ready) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      loadRemote().then((remote) => {
        if (remote && stableStr(norm(remote)) !== stableStr(baseRef.current)) { mergeWithRemote(remote); setSyncMsg("อัปเดตข้อมูลจากอีกเครื่องแล้ว"); }
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [session, ready]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales, platforms, expenses }));
    } catch (e) {
      console.warn("Could not save data", e);
    }
    if (!cloudOn || !session || !ready) return;
    const t = setTimeout(() => {
      const cur = { products, sales, platforms, expenses };
      setSyncMsg("กำลังบันทึก…");
      saveRemote(cur).then(async (r) => {
        if (r && r.conflict) {
          const remote = await loadRemote();
          if (remote) { mergeWithRemote(remote); setSyncMsg("รวมข้อมูลจากอีกเครื่องแล้ว"); }
        } else { baseRef.current = cur; setSyncMsg("บันทึกออนไลน์แล้ว ✓"); }
      }).catch((e) => { if (!handleAuthError(e)) setSyncMsg("บันทึกออนไลน์ไม่สำเร็จ"); });
    }, 800);
    return () => clearTimeout(t);
  }, [products, sales, platforms, expenses, session, ready]);
  useEffect(() => {
    if (!ready) return;
    setSales((prev) => prev.some((x) => x.unitCost == null && products.some((p) => p.id === x.productId)) ? prev.map((x) => { const p = products.find((q) => q.id === x.productId); return x.unitCost == null && p ? { ...x, unitCost: p.cost || 0 } : x; }) : prev);
  }, [ready]);
  const lowStockCount = products.filter((p) => getStockStatus(p) !== "\u0E1B\u0E01\u0E15\u0E34").length;
  function handleAddSale(sale) {
    setSales((prev) => [...prev, sale]);
    setProducts(
      (prev) => prev.map((p) => p.id === sale.productId ? { ...p, stock: p.stock - sale.quantity } : p)
    );
  }
  function handleEditSale(u) {
    const old = sales.find((x) => x.id === u.id);
    if (!old) return;
    setSales((prev) => prev.map((x) => x.id === u.id ? { ...u, paidDate: x.paidDate, paidAmount: x.paidAmount } : u.orderId && x.orderId === u.orderId ? { ...x, customer: u.customer, orderNo: u.orderNo } : x));
    setProducts((prev) => prev.map((p) => {
      let st = p.stock;
      if (p.id === old.productId) st += old.quantity;
      if (p.id === u.productId) st -= u.quantity;
      return st === p.stock ? p : { ...p, stock: st };
    }));
  }
  function handleRestore(d) {
    setProducts(d.products);
    setSales(d.sales);
    if (Array.isArray(d.platforms) && d.platforms.length) setPlatforms(d.platforms);
    setExpenses(Array.isArray(d.expenses) ? d.expenses : []);
  }
  function handleSetStatus(id, patch) {
    const old = sales.find((x) => x.id === id);
    if (!old) return;
    const wasBack = old.restocked ? old.quantity : 0;
    const nowBack = patch.restocked ? old.quantity : 0;
    setSales((prev) => prev.map((x) => {
      if (x.id !== id) return x;
      const n = { ...x, ...patch };
      if (!patch.status) { delete n.status; delete n.restocked; delete n.lossExtra; delete n.compensation; }
      return n;
    }));
    if (nowBack !== wasBack) setProducts((prev) => prev.map((p) => p.id === old.productId ? { ...p, stock: p.stock + nowBack - wasBack } : p));
  }
  function handleLearnAlias(productId, text) {
    const nz = (x) => String(x).toUpperCase().replace(/[^A-Z0-9\u0E00-\u0E7F]/g, "");
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      const have = [p.name, ...String(p.aliases || "").split("\n")].map(nz);
      if (have.includes(nz(text))) return p;
      return { ...p, aliases: [p.aliases || "", text].filter(Boolean).join("\n") };
    }));
  }
  function handleOrderUpdates(updates) {
    const byKey = {};
    updates.forEach((u) => { byKey[u.key] = u; });
    setSales((prev) => {
      const groups = {};
      prev.forEach((x) => { const k = x.orderId || x.id; (groups[k] || (groups[k] = [])).push({ ...x }); });
      Object.keys(byKey).forEach((k) => {
        const rows = groups[k];
        if (!rows) return;
        const u = byKey[k];
        const normal = rows.filter((x) => !x.status);
        if (u.fee != null && normal.length) { const fs = allocTo(normal, u.fee, (x) => (x.price || 0) * (x.quantity || 0)); normal.forEach((x, i) => { x.fee = fs[i]; }); }
        if (u.paid === null) rows.forEach((x) => { delete x.paidDate; delete x.paidAmount; });
        else if (u.paid && normal.length) { const ps = allocTo(normal, u.paid.amount, (x) => Math.max(0, (x.price || 0) * (x.quantity || 0) - (x.coupon || 0) - (x.fee || 0))); normal.forEach((x, i) => { x.paidDate = u.paid.date; x.paidAmount = ps[i]; }); }
      });
      const byId = {};
      Object.values(groups).forEach((rows) => rows.forEach((x) => { byId[x.id] = x; }));
      return prev.map((x) => byId[x.id] || x);
    });
  }
  function handleDeleteSale(id) {
    const sale = sales.find((x) => x.id === id);
    if (!sale) return;
    setSales((prev) => prev.filter((x) => x.id !== id));
    setProducts((prev) => prev.map((p) => p.id === sale.productId ? { ...p, stock: p.stock + (sale.status ? 0 : sale.quantity) } : p));
  }
  function handleRestore(d) {
    setProducts(d.products); setSales(d.sales);
    if (Array.isArray(d.platforms) && d.platforms.length) setPlatforms(d.platforms);
  }
  function handleImport(newSales, stockDelta) {
    setSales((prev) => [...prev, ...newSales]);
    setProducts(
      (prev) => prev.map((p) => stockDelta[p.id] ? { ...p, stock: p.stock - stockDelta[p.id] } : p)
    );
  }
  function handleSaveProduct(product) {
    const old = products.find((p) => p.id === product.id);
    if (old && (old.cost || 0) !== (product.cost || 0) && sales.some((x) => x.productId === product.id)) {
      if (window.confirm("ต้นทุนเปลี่ยนจาก " + (old.cost || 0) + " เป็น " + (product.cost || 0) + " บาท\nปรับรายการขายเก่าของสินค้านี้ให้ใช้ต้นทุนใหม่ด้วยไหม?\n(ตกลง = ปรับทั้งหมด / ยกเลิก = ใช้กับรายการใหม่เท่านั้น)")) {
        setSales((prev) => prev.map((x) => x.productId === product.id ? { ...x, unitCost: product.cost || 0 } : x));
      }
    }
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists ? prev.map((p) => p.id === product.id ? product : p) : [...prev, product];
    });
  }
  function handleDeleteProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }
  if (cloudOn && !session) return /* @__PURE__ */ React.createElement("div", { className: "mies-app" }, /* @__PURE__ */ React.createElement("style", null, CSS), /* @__PURE__ */ React.createElement(LoginScreen, { onLogin: setSession }));
  return /* @__PURE__ */ React.createElement("div", { className: "mies-app" }, /* @__PURE__ */ React.createElement("style", null, CSS), cloudOn && /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 4px)", right: 8, zIndex: 50, fontSize: 11, color: "#68706B", background: "rgba(255,255,255,.85)", padding: "2px 8px", borderRadius: 8 } }, syncMsg, " ", /* @__PURE__ */ React.createElement("a", { href: "#", style: { color: "#0F2B26" }, onClick: (e) => { e.preventDefault(); signOut(); setSession(null); setReady(false); } }, "\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A")), /* @__PURE__ */ React.createElement("div", { className: "app-shell" }, /* @__PURE__ */ React.createElement(Sidebar, { active: activeTab, onChange: setActiveTab, lowStockCount }), /* @__PURE__ */ React.createElement("main", { className: "main-content" }, activeTab === "dashboard" && /* @__PURE__ */ React.createElement(
    Dashboard,
    {
      sales,
      products,
      platforms,
      expenses,
      dateState,
      setDateState,
      onGoto: setActiveTab
    }
  ), activeTab === "sales" && /* @__PURE__ */ React.createElement(
    SalesPage,
    {
      products,
      platforms,
      sales,
      onAddSale: handleAddSale,
      onImport: handleImport,
      onDeleteSale: handleDeleteSale,
      onEditSale: handleEditSale,
      onSetStatus: handleSetStatus,
      onLearnAlias: handleLearnAlias,
      onPlatformsChange: setPlatforms,
      expenses,
      onExpensesChange: setExpenses,
      onRestore: handleRestore
    }
  ), activeTab === "products" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ProductsPage, { products, onSave: handleSaveProduct, onDelete: handleDeleteProduct }), /* @__PURE__ */ React.createElement(SettingsPanel, { products, sales, platforms, setPlatforms, onRestore: handleRestore })), activeTab === "recon" && /* @__PURE__ */ React.createElement(ReconPage, { sales, products, platforms, onUpdates: handleOrderUpdates }), activeTab === "analytics" && /* @__PURE__ */ React.createElement(
    AnalyticsPage,
    {
      sales,
      products,
      platforms,
      dateState,
      setDateState
    }
  ))), /* @__PURE__ */ React.createElement(BottomNav, { active: activeTab, onChange: setActiveTab }));
}
var CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');

.mies-app {
  --primary: #0F2B26;
  --secondary: #173D35;
  --accent: #B8862F;
  --accent-light: #E8C77E;
  --bg: #F6F7F5;
  --card: #FFFFFF;
  --text: #1C201D;
  --text-secondary: #68706B;
  --success: #2F7D5E;
  --success-bg: #E7F2EC;
  --warning: #B8862F;
  --warning-bg: #FBF1DD;
  --danger: #B5534A;
  --danger-bg: #F7E9E7;
  --border: #E7E9E5;
  --radius: 16px;
  font-family: 'Noto Sans Thai', -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.mies-app * { box-sizing: border-box; }

.app-shell { display: flex; min-height: 100vh; }

.main-content { flex: 1; min-width: 0; padding-bottom: 84px; }

.page-inner { max-width: 640px; margin: 0 auto; padding: 16px 16px 24px; display: flex; flex-direction: column; gap: 16px; }

/* Header */
.app-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 2px; }
.header-title { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
.header-subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.icon-btn { position: relative; width: 38px; height: 38px; border-radius: 12px; border: 1px solid var(--border); background: var(--card); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text); }
.icon-badge { position: absolute; top: 7px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background: var(--danger); border: 1.5px solid var(--card); }
.avatar-btn { width: 38px; height: 38px; border-radius: 12px; background: var(--primary); color: var(--accent-light); font-size: 12px; font-weight: 700; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; }

/* Sidebar */
.sidebar { width: 240px; flex-shrink: 0; background: var(--primary); color: #fff; display: none; flex-direction: column; padding: 22px 14px; position: sticky; top: 0; height: 100vh; }
.sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 22px; }
.brand-mark { width: 36px; height: 36px; border-radius: 10px; background: var(--accent); color: var(--primary); font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.brand-name { font-size: 14px; font-weight: 700; }
.brand-sub { font-size: 11px; color: rgba(255,255,255,0.55); }
.sidebar-nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.sidebar-item { display: flex; align-items: center; gap: 11px; padding: 11px 12px; border-radius: 11px; border: none; background: transparent; color: rgba(255,255,255,0.68); font-size: 14px; font-weight: 500; cursor: pointer; text-align: left; width: 100%; position: relative; font-family: inherit; }
.sidebar-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
.sidebar-item.active { background: rgba(184,134,47,0.16); color: var(--accent-light); font-weight: 600; }
.nav-badge { margin-left: auto; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 20px; }
.sidebar-footer { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 10px; }

/* Bottom nav */
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: var(--card); border-top: 1px solid var(--border); display: flex; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); z-index: 40; }
.bottom-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 0; background: none; border: none; color: var(--text-secondary); font-size: 11px; font-weight: 500; cursor: pointer; font-family: inherit; min-height: 44px; }
.bottom-nav-item.active { color: var(--primary); font-weight: 700; }

/* Cards */
.card { background: var(--card); border-radius: var(--radius); border: 1px solid var(--border); }
.section-card { padding: 16px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.section-title { font-size: 16px; font-weight: 700; }

/* Date filter */
.date-filter { position: relative; }
.date-filter-trigger { display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 9px 13px; font-size: 13px; font-weight: 600; color: var(--text); cursor: pointer; font-family: inherit; }
.chev-open { transform: rotate(180deg); transition: transform 0.15s; }
.date-filter-panel { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 10px; box-shadow: 0 12px 32px rgba(15,43,38,0.14); display: flex; flex-wrap: wrap; gap: 6px; width: 260px; }
.date-pill { padding: 7px 11px; border-radius: 20px; border: 1px solid var(--border); background: var(--bg); font-size: 12.5px; font-weight: 500; color: var(--text); cursor: pointer; font-family: inherit; }
.date-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.custom-range-row { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 4px; font-size: 12px; flex-wrap: wrap; }
.custom-range-row input { border: 1px solid var(--border); border-radius: 8px; padding: 6px; font-size: 12px; font-family: inherit; }

/* Hero */
.hero-card { position: relative; overflow: hidden; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 20px; padding: 22px 20px; color: #fff; }
.hero-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.55); }
.hero-value { font-size: 38px; font-weight: 800; color: var(--accent-light); margin-top: 6px; letter-spacing: -0.01em; }
.hero-trend-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.hero-trend-caption { font-size: 12px; color: rgba(255,255,255,0.55); }
.hero-deco { position: absolute; bottom: 0; right: 0; width: 60%; height: 60px; opacity: 0.7; }

.trend { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; font-weight: 700; }
.trend-up { color: #6FCF97; }
.trend-down { color: #E39C94; }
.kpi-card .trend-up { color: var(--success); }
.kpi-card .trend-down { color: var(--danger); }

/* KPI grid */
.kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.kpi-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 13px 14px; }
.kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.kpi-value { font-size: 19px; font-weight: 700; margin: 3px 0 5px; }

/* Chart */
.chart-controls { display: flex; gap: 8px; flex-wrap: wrap; }
.toggle-group { display: flex; background: var(--bg); border-radius: 10px; padding: 3px; gap: 2px; }
.toggle { border: none; background: transparent; padding: 6px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-secondary); cursor: pointer; font-family: inherit; }
.toggle.active { background: var(--card); color: var(--primary); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.toggle-sm { padding: 6px 10px; }
.chart-wrap { margin-top: 6px; }

.mini-empty { color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px 0; }

/* Platform performance */
.platform-list { display: flex; flex-direction: column; gap: 12px; }
.platform-row { display: flex; align-items: center; gap: 10px; }
.platform-rank { width: 22px; font-size: 14px; text-align: center; flex-shrink: 0; color: var(--text-secondary); font-weight: 700; }
.platform-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.platform-info { flex: 1; min-width: 0; }
.platform-name { font-size: 13.5px; font-weight: 600; margin-bottom: 5px; }
.platform-bar-track { height: 6px; background: var(--bg); border-radius: 20px; overflow: hidden; }
.platform-bar-fill { height: 100%; border-radius: 20px; }
.platform-figures { text-align: right; flex-shrink: 0; }
.platform-value { font-size: 13.5px; font-weight: 700; }
.platform-share { font-size: 11.5px; color: var(--text-secondary); }

/* Top products */
.top-product-list { display: flex; flex-direction: column; gap: 12px; }
.top-product-row { display: flex; align-items: center; gap: 11px; }
.rank-chip { width: 26px; height: 26px; border-radius: 8px; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text-secondary); flex-shrink: 0; }
.tp-info { flex: 1; min-width: 0; }
.tp-name { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-sub { font-size: 11.5px; color: var(--text-secondary); }
.tp-figures { text-align: right; flex-shrink: 0; }
.tp-gross { font-size: 13.5px; font-weight: 700; }
.tp-profit { font-size: 11px; color: var(--success); }

/* Alert */
.alert-card { display: flex; align-items: center; gap: 10px; background: var(--warning-bg); border: 1px solid rgba(184,134,47,0.25); border-radius: 14px; padding: 13px 14px; cursor: pointer; }
.alert-icon { width: 30px; height: 30px; border-radius: 9px; background: rgba(184,134,47,0.18); color: var(--warning); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.alert-text { flex: 1; font-size: 13.5px; font-weight: 600; color: #7A5B21; }

/* Transactions */
.tx-list { display: flex; flex-direction: column; gap: 12px; }
.tx-row { display: flex; align-items: center; gap: 10px; }
.tx-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.tx-info { flex: 1; min-width: 0; }
.tx-name { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-sub { font-size: 11.5px; color: var(--text-secondary); }
.tx-figures { text-align: right; flex-shrink: 0; }
.tx-gross { font-size: 13.5px; font-weight: 700; }
.tx-profit { font-size: 11px; color: var(--success); }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; font-size: 13.5px; font-weight: 600; padding: 11px 16px; cursor: pointer; border: 1px solid transparent; font-family: inherit; min-height: 44px; transition: opacity 0.15s, transform 0.05s; }
.btn:active { transform: scale(0.98); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-outline { background: var(--card); color: var(--primary); border-color: var(--border); }
.btn-ghost { background: transparent; color: var(--text-secondary); }
.btn-block { width: 100%; }
.btn-sm { padding: 7px 12px; min-height: 34px; font-size: 12.5px; }
.btn-icon-only { width: 44px; height: 44px; padding: 0; border-radius: 12px; flex-shrink: 0; }

/* Empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 20px; gap: 6px; }
.empty-icon { width: 52px; height: 52px; border-radius: 16px; background: var(--card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); margin-bottom: 6px; }
.empty-title { font-size: 15px; font-weight: 700; }
.empty-subtitle { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; max-width: 260px; }

/* Forms */
.form-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px; }
.field-row { display: flex; gap: 10px; }
.field-row .field { flex: 1; min-width: 0; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field span { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.field input, .field select { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 14px; font-family: inherit; background: var(--card); color: var(--text); min-height: 44px; width: 100%; }
.field input:focus, .field select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

.live-summary { background: var(--bg); border-radius: 14px; padding: 13px 14px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
.ls-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.ls-row.ls-profit { border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 8px; font-size: 16px; font-weight: 800; color: var(--primary); }

/* Sales toolbar */
.sales-toolbar { display: flex; }

/* Products page */
.products-toolbar { display: flex; gap: 10px; align-items: center; }
.search-box { flex: 1; display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px 13px; color: var(--text-secondary); min-height: 44px; }
.search-box input { border: none; outline: none; flex: 1; font-size: 13.5px; font-family: inherit; background: transparent; color: var(--text); }
.filter-pills { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 2px; }
.filter-pill { flex-shrink: 0; padding: 7px 13px; border-radius: 20px; border: 1px solid var(--border); background: var(--card); font-size: 12.5px; font-weight: 600; color: var(--text-secondary); cursor: pointer; font-family: inherit; }
.filter-pill.active { background: var(--primary); border-color: var(--primary); color: #fff; }

.product-cards { display: flex; flex-direction: column; gap: 10px; }
.product-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px; }
.product-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.product-name { font-size: 14px; font-weight: 700; }
.product-sku { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
.product-actions { display: flex; gap: 6px; }
.icon-btn-sm { width: 30px; height: 30px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-secondary); }
.product-card-figures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 10px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 10px; }
.pcf-label { font-size: 10.5px; color: var(--text-secondary); }
.pcf-value { font-size: 13px; font-weight: 700; margin-top: 2px; }
.pcf-value.accent { color: var(--success); }
.product-card-bottom { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-secondary); font-weight: 500; }

.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-success { background: var(--success); }
.dot-warning { background: var(--warning); }
.dot-danger { background: var(--danger); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,43,38,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
.modal { background: var(--card); width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto; border-radius: 22px 22px 0 0; padding: 18px 18px 26px; animation: slideUp 0.2s ease; }
@media (min-width: 640px) { .modal-overlay { align-items: center; } .modal { border-radius: 20px; margin: 20px; } }
@keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.modal-title { font-size: 17px; font-weight: 700; }
.modal-body { display: flex; flex-direction: column; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }

/* Step indicator */
.step-indicator { display: flex; gap: 6px; margin-bottom: 16px; }
.step-chip { flex: 1; display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 10px; background: var(--bg); font-size: 11px; font-weight: 600; color: var(--text-secondary); }
.step-chip .step-num { font-size: 10px; font-weight: 700; color: var(--text-secondary); }
.step-chip.active { background: var(--primary); color: #fff; }
.step-chip.active .step-num { color: var(--accent-light); }
.step-chip.done { background: var(--success-bg); color: var(--success); }

.paste-area { border: 1.5px dashed var(--border); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-secondary); margin: 12px 0 14px; }
.paste-area textarea { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 10px; font-size: 12.5px; font-family: monospace; resize: vertical; color: var(--text); }

.mapping-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.preview-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 14px; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.preview-table th, .preview-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.preview-table th { background: var(--bg); color: var(--text-secondary); font-weight: 600; }

.import-result { align-items: center; text-align: center; padding: 10px 0; }
.result-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--success-bg); color: var(--success); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
.result-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
.result-line { font-size: 13.5px; margin-bottom: 3px; }
.result-line.muted { color: var(--text-secondary); }

/* Analytics */
.finance-breakdown { display: flex; flex-direction: column; gap: 8px; }
.fb-row { display: flex; justify-content: space-between; font-size: 13.5px; padding: 3px 0; }
.fb-row.muted { color: var(--text-secondary); font-size: 12.5px; }
.fb-row.strong { font-weight: 700; border-top: 1px dashed var(--border); padding-top: 8px; }
.fb-row.profit { font-weight: 800; font-size: 16px; color: var(--primary); border-top: 1px solid var(--border); padding-top: 10px; margin-top: 2px; }

.analysis-table-wrap { overflow-x: auto; }
.analysis-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.analysis-table th, .analysis-table td { padding: 9px 8px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.analysis-table th { color: var(--text-secondary); font-weight: 600; font-size: 11.5px; }
.table-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 7px; }

.margin-list { display: flex; flex-direction: column; gap: 11px; }
.margin-row { display: grid; grid-template-columns: 1fr auto; gap: 5px 10px; align-items: center; }
.margin-name { grid-column: 1; grid-row: 1; font-size: 13px; font-weight: 600; min-width: 0; white-space: normal; word-break: break-word; line-height: 1.35; }
.margin-bar-track { grid-column: 1 / -1; grid-row: 2; height: 7px; background: var(--bg); border-radius: 20px; overflow: hidden; }
.margin-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-light)); border-radius: 20px; }
.margin-pct { grid-column: 2; grid-row: 1; font-size: 14px; font-weight: 700; text-align: right; }

/* Responsive */
@media (min-width: 900px) {
  .sidebar { display: flex; }
  .bottom-nav { display: none; }
  .main-content { padding-bottom: 0; }
  .page-inner { max-width: 1280px; padding: 28px 32px; }
  .kpi-grid { grid-template-columns: repeat(4, 1fr); }
  .hero-value { font-size: 44px; }
}

@media (max-width: 380px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .hero-value { font-size: 32px; }
}
`;
var rootEl = document.getElementById("root");
createRoot(rootEl).render(/* @__PURE__ */ React.createElement(App, null));
window.__miesLoaded = true;
export {
  App as default
};
