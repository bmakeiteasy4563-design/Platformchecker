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
  { id: "analytics", label: "\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C", icon: BarChart2 }
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
  let gross = 0, coupon = 0, fee = 0, netRevenue = 0, cost = 0, profit = 0, orders = sales.length;
  for (const s of sales) {
    const m = computeSaleMetrics(s, productMap[s.productId], platformMap[s.platformId]);
    gross += m.gross;
    coupon += m.coupon;
    fee += m.fee;
    netRevenue += m.netRevenue;
    cost += m.cost;
    profit += m.profit;
  }
  const margin = gross > 0 ? profit / gross * 100 : 0;
  return { gross, coupon, fee, netRevenue, cost, profit, orders, margin };
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
  for (const e of expenses) if (e.bill) { const d = /* @__PURE__ */ new Date(e.date + "T00:00:00"); if (d >= sd && d <= ed) total += e.amount; }
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
function ProfitHero({ profit, trend, hasBaseline, expense }) {
  return /* @__PURE__ */ React.createElement("div", { className: "hero-card" }, /* @__PURE__ */ React.createElement("div", { className: "hero-label" }, "NET PROFIT"), /* @__PURE__ */ React.createElement("div", { className: "hero-value" }, fmtCurrency(profit)), expense > 0 && /* @__PURE__ */ React.createElement("div", { className: "hero-trend-caption", style: { marginTop: 4 } }, "หักรายจ่ายรายเดือนแล้ว " + fmtCurrency(expense)), /* @__PURE__ */ React.createElement("div", { className: "hero-trend-row" }, /* @__PURE__ */ React.createElement(Trend, { value: trend, hasBaseline }), hasBaseline && /* @__PURE__ */ React.createElement("span", { className: "hero-trend-caption" }, "\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E0A\u0E48\u0E27\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32")), /* @__PURE__ */ React.createElement("svg", { className: "hero-deco", viewBox: "0 0 300 90", preserveAspectRatio: "none" }, /* @__PURE__ */ React.createElement(
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
      byProduct[p.id].qty += s.quantity;
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
      expense: current.expense
    }
  ), /* @__PURE__ */ React.createElement(KPIGrid, { current, previous, hasBaseline }), /* @__PURE__ */ React.createElement(SalesChart, { sales, products, platforms }), /* @__PURE__ */ React.createElement(LowStockAlert, { products, onNavigate: () => onGoto("products") }), /* @__PURE__ */ React.createElement(PlatformPerformance, { sales: filteredSales, products, platforms }), /* @__PURE__ */ React.createElement(TopProducts, { sales: filteredSales, products }), /* @__PURE__ */ React.createElement(RecentSales, { sales, products, platforms }));
}
function QuickSaleForm({ products, platforms, onSubmit, initial, onCancel }) {
  const todayStr = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const r2 = (n) => Math.round((n || 0) * 100) / 100;
  const [productId, setProductId] = useState(initial?.productId || "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [platformId, setPlatformId] = useState(initial?.platformId || "");
  const [coupon, setCoupon] = useState(initial?.coupon ?? 0);
  const [feeIn, setFeeIn] = useState(initial ? { mode: "baht", value: String(initial.fee ?? 0) } : { mode: "pct", value: "0" });
  const [otherIn, setOtherIn] = useState({ mode: "baht", value: initial ? String(initial.otherExpense || 0) : "" });
  const [feeTouched, setFeeTouched] = useState(!!initial);
  const [date, setDate] = useState(initial ? (() => { const d = new Date(initial.date); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })() : todayStr());
  const product = products.find((p) => p.id === productId);
  const gross = (parseFloat(price) || 0) * (parseFloat(quantity) || 0);
  function resolve(inp) {
    const v = parseFloat(inp.value) || 0;
    return inp.mode === "pct" ? { baht: Math.round(gross * v) / 100, pct: v } : { baht: v, pct: gross > 0 ? v / gross * 100 : 0 };
  }
  const fee = resolve(feeIn);
  const other = resolve(otherIn);
  const couponNum = parseFloat(coupon) || 0;
  const cost = (product?.cost || 0) * (parseFloat(quantity) || 0);
  const profit = gross - couponNum - fee.baht - other.baht - cost;
  const canSubmit = productId && platformId && parseFloat(price) > 0 && parseFloat(quantity) > 0;
  function handlePlatformChange(id) {
    setPlatformId(id);
    if (!feeTouched) {
      const pl = platforms.find((p) => p.id === id);
      setFeeIn({ mode: "pct", value: String(pl?.feePercent || 0) });
    }
  }
  function submit() {
    if (!canSubmit) return;
    onSubmit({
      id: initial?.id || uid(),
      productId,
      platformId,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      coupon: couponNum,
      fee: r2(fee.baht),
      otherExpense: r2(other.baht),
      unitCost: initial && initial.productId === productId ? initial.unitCost ?? (product?.cost || 0) : product?.cost || 0,
      date: new Date(date).toISOString()
    });
    setProductId(""); setQuantity(1); setPrice(""); setPlatformId(""); setCoupon(0);
    setFeeIn({ mode: "pct", value: "0" }); setOtherIn({ mode: "baht", value: "" });
    setFeeTouched(false); setDate(todayStr());
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
    React.createElement("div", { className: "form-grid" },
      React.createElement("label", { className: "field" }, React.createElement("span", null, "สินค้า"),
        React.createElement("select", { value: productId, onChange: (e) => setProductId(e.target.value) },
          React.createElement("option", { value: "" }, "เลือกสินค้า"),
          products.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.name, " (คงเหลือ ", p.stock, ")")))),
      React.createElement("div", { className: "field-row" },
        React.createElement("label", { className: "field" }, React.createElement("span", null, "จำนวน"),
          React.createElement("input", { type: "number", min: "1", value: quantity, onChange: (e) => setQuantity(e.target.value) })),
        React.createElement("label", { className: "field" }, React.createElement("span", null, "ราคาขาย/ชิ้น"),
          React.createElement("input", { type: "number", min: "0", step: "any", placeholder: "0", value: price, onChange: (e) => setPrice(e.target.value) }))),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "Platform"),
        React.createElement("select", { value: platformId, onChange: (e) => handlePlatformChange(e.target.value) },
          React.createElement("option", { value: "" }, "เลือก Platform"),
          platforms.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.name)))),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "คูปอง (บาท)"),
        num({ value: coupon, onChange: (e) => setCoupon(e.target.value) })),
      amountPair("ค่าธรรมเนียม", feeIn, setFeeIn, fee, () => setFeeTouched(true)),
      amountPair("รายจ่ายอื่นๆ", otherIn, setOtherIn, other, null),
      React.createElement("label", { className: "field" }, React.createElement("span", null, "วันที่"),
        React.createElement("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value) }))),
    React.createElement("div", { className: "live-summary" },
      row("ยอดขาย", fmtCurrency(gross)),
      row("ค่าธรรมเนียม" + pctTxt(fee.pct), "-" + fmtCurrency(fee.baht)),
      row("รายจ่ายอื่นๆ" + pctTxt(other.pct), "-" + fmtCurrency(other.baht)),
      row("คูปอง", "-" + fmtCurrency(couponNum)),
      row("ต้นทุน", "-" + fmtCurrency(cost)),
      row("กำไร" + (gross > 0 ? pctTxt(profit / gross * 100) : ""), fmtCurrency(profit), "ls-profit")),
    React.createElement("button", { className: "btn btn-primary btn-block", disabled: !canSubmit, onClick: submit }, React.createElement(Check, { size: 16 }), " บันทึกการขาย"), onCancel && React.createElement("button", { className: "btn btn-ghost btn-block", style: { marginTop: 8 }, onClick: onCancel }, "ยกเลิก"));
}
function SalesHistory({ sales, products, platforms, onDelete, onEdit }) {
  const [limit, setLimit] = useState(20);
  const [editing, setEditing] = useState(null);
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p]));
  const rows = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (rows.length === 0) return null;
  return React.createElement("div", { className: "card section-card", style: { marginTop: 14 } },
    React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, "รายการที่บันทึกไว้"),
    React.createElement("div", { className: "tx-list" }, rows.slice(0, limit).map((s) => {
      const p = productMap[s.productId];
      const pl = platformMap[s.platformId];
      const m = computeSaleMetrics(s, p, pl);
      return React.createElement("div", { className: "tx-row", key: s.id },
        React.createElement("span", { className: "tx-dot", style: { background: pl?.color || "#999" } }),
        React.createElement("div", { className: "tx-info" },
          React.createElement("div", { className: "tx-name" }, p?.name || "สินค้าไม่พบ"),
          React.createElement("div", { className: "tx-sub" }, pl?.name, " · ", fmtDateShort(s.date), " · x", s.quantity)),
        React.createElement("div", { className: "tx-figures" },
          React.createElement("div", { className: "tx-gross" }, fmtCurrency(m.gross)),
          React.createElement("div", { className: "tx-profit" }, "กำไร ", fmtCurrency(m.profit))),
        React.createElement("button", { className: "icon-btn-sm", "aria-label": "แก้ไข", style: { marginRight: 6 }, onClick: () => setEditing(s) }, React.createElement(Edit2, { size: 14 })), React.createElement("button", { className: "icon-btn-sm", "aria-label": "ลบรายการ", onClick: () => {
          if (window.confirm("ลบรายการนี้? สต็อกสินค้าจะถูกคืนกลับ")) onDelete(s.id);
        } }, React.createElement(Trash2, { size: 14 })));
    })),
    rows.length > limit && React.createElement("button", { className: "btn btn-outline btn-block", style: { marginTop: 12 }, onClick: () => setLimit(limit + 20) }, "แสดงเพิ่ม"), editing && React.createElement("div", { className: "modal-overlay", onClick: () => setEditing(null) }, React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, React.createElement("div", { className: "modal-body" }, React.createElement(QuickSaleForm, { products, platforms, initial: editing, onCancel: () => setEditing(null), onSubmit: (u) => { onEdit(u); setEditing(null); } })))));
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
  const todayY = () => { const d = /* @__PURE__ */ new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
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
    React.createElement("div", { style: { fontSize: 11.5, color: "#99A09B", marginTop: 8 } }, "บิลหักจากกำไรในวันที่จ่าย / รายเดือนหักเฉลี่ยตามจำนวนวัน / สลิปเก็บในเครื่องนี้ (ไม่ขึ้นออนไลน์)"),
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
  const ymd = (v) => { const d = new Date(v); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const salesTable = () => {
    const pm = Object.fromEntries(products.map((p) => [p.id, p]));
    const plm = Object.fromEntries(platforms.map((p) => [p.id, p]));
    const head = ["วันที่", "สินค้า", "SKU", "แพลตฟอร์ม", "จำนวน", "ราคา/ชิ้น", "ยอดขาย", "คูปอง", "ค่าธรรมเนียม", "รายจ่ายอื่นๆ", "ต้นทุน", "กำไร"];
    const rows = [...sales].sort((a, b) => new Date(a.date) - new Date(b.date)).map((s) => {
      const m = computeSaleMetrics(s, pm[s.productId], plm[s.platformId]);
      return [ymd(s.date), pm[s.productId]?.name || "", pm[s.productId]?.sku || "", plm[s.platformId]?.name || "", s.quantity, s.price, m.gross, m.coupon, m.fee, m.otherExpense, m.cost, m.profit];
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
    React.createElement("div", { style: { fontSize: 11, color: "#99A09B", marginTop: 10, textAlign: "center" } }, "เวอร์ชันแอป 20"));
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
function SalesPage({ products, platforms, sales, onAddSale, onImport, onDeleteSale, onEditSale, onPlatformsChange, expenses, onExpensesChange, onRestore }) {
  const [showImport, setShowImport] = useState(false);
  return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22", subtitle: fmtNumber(sales.length) + " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", lowStockCount: 0 }), /* @__PURE__ */ React.createElement("div", { className: "sales-toolbar" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-block", onClick: () => setShowImport(true) }, /* @__PURE__ */ React.createElement(Upload, { size: 16 }), " Import Orders")), /* @__PURE__ */ React.createElement(QuickSaleForm, { products, platforms, onSubmit: onAddSale }), /* @__PURE__ */ React.createElement(SalesHistory, { sales, products, platforms, onDelete: onDeleteSale, onEdit: onEditSale }), /* @__PURE__ */ React.createElement(PlatformManager, { platforms, sales, onChange: onPlatformsChange }), /* @__PURE__ */ React.createElement(ExpenseManager, { expenses: expenses || [], onChange: onExpensesChange }), /* @__PURE__ */ React.createElement(DataBackup, { products, sales, platforms, expenses: expenses || [], onRestore }), showImport && /* @__PURE__ */ React.createElement(
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
      image
    });
  }
  return /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("div", { className: "modal-title" }, initial ? "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" : "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), /* @__PURE__ */ React.createElement("button", { className: "icon-btn", onClick: onClose }, /* @__PURE__ */ React.createElement(X, { size: 18 }))), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "form-grid" }, /* @__PURE__ */ React.createElement(ProductImageField, { value: image, onChange: setImage }), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), /* @__PURE__ */ React.createElement("input", { value: name, onChange: (e) => setName(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "SKU"), /* @__PURE__ */ React.createElement("input", { value: sku, onChange: (e) => setSku(e.target.value) })), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19"), /* @__PURE__ */ React.createElement("input", { type: "number", value: cost, onChange: (e) => setCost(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E23\u0E32\u0E04\u0E32\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("input", { type: "number", value: price, onChange: (e) => setPrice(e.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E2A\u0E15\u0E47\u0E2D\u0E01"), /* @__PURE__ */ React.createElement("input", { type: "number", value: stock, onChange: (e) => setStock(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E2B\u0E25\u0E37\u0E2D"), /* @__PURE__ */ React.createElement(
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
      byProduct[p.id].qty += s.quantity;
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
  ), /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, "\u0E2A\u0E23\u0E38\u0E1B\u0E01\u0E32\u0E23\u0E40\u0E07\u0E34\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "finance-breakdown" }, /* @__PURE__ */ React.createElement("div", { className: "fb-row" }, /* @__PURE__ */ React.createElement("span", null, "Gross Revenue"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(agg.gross))), /* @__PURE__ */ React.createElement("div", { className: "fb-row muted" }, /* @__PURE__ */ React.createElement("span", null, "Coupon"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(agg.coupon))), /* @__PURE__ */ React.createElement("div", { className: "fb-row muted" }, /* @__PURE__ */ React.createElement("span", null, "Platform Fee"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(agg.fee))), /* @__PURE__ */ React.createElement("div", { className: "fb-row strong" }, /* @__PURE__ */ React.createElement("span", null, "Net Revenue"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(agg.netRevenue))), /* @__PURE__ */ React.createElement("div", { className: "fb-row muted" }, /* @__PURE__ */ React.createElement("span", null, "Cost"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(agg.cost))), /* @__PURE__ */ React.createElement("div", { className: "fb-row profit" }, /* @__PURE__ */ React.createElement("span", null, "Net Profit"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(agg.profit))))), /* @__PURE__ */ React.createElement(SalesChart, { sales, products, platforms }), /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, "\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07"), platformRows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49") : /* @__PURE__ */ React.createElement("div", { className: "analysis-table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "analysis-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Platform"), /* @__PURE__ */ React.createElement("th", null, "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("th", null, "\u0E01\u0E33\u0E44\u0E23"), /* @__PURE__ */ React.createElement("th", null, "Margin"))), /* @__PURE__ */ React.createElement("tbody", null, platformRows.map((r) => /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "table-dot", style: { background: r.color } }), r.name), /* @__PURE__ */ React.createElement("td", null, fmtCurrency(r.gross)), /* @__PURE__ */ React.createElement("td", null, fmtCurrency(r.profit)), /* @__PURE__ */ React.createElement("td", null, r.margin.toFixed(1), "%"))))))), /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-title", style: { marginBottom: 12 } }, "Margin Analysis \u0E15\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), productRows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49") : /* @__PURE__ */ React.createElement("div", { className: "margin-list" }, productRows.slice(0, 8).map((r) => {
    const margin = r.gross > 0 ? r.profit / r.gross * 100 : 0;
    return /* @__PURE__ */ React.createElement("div", { className: "margin-row", key: r.product.id }, /* @__PURE__ */ React.createElement("div", { className: "margin-name" }, r.product.name), /* @__PURE__ */ React.createElement("div", { className: "margin-bar-track" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "margin-bar-fill",
        style: { width: Math.max(margin, 2) + "%" }
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "margin-pct" }, margin.toFixed(1), "%"));
  }))), /* @__PURE__ */ React.createElement(PlatformFeeReport, { sales, products, platforms }));
}
function PlatformFeeReport({ sales, products, platforms }) {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => { const x = new Date(d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
  const now = /* @__PURE__ */ new Date();
  const [mode, setMode] = useState("day");
  const [from, setFrom] = useState(now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-01");
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
    setSales((prev) => prev.map((x) => x.id === u.id ? u : x));
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
  function handleDeleteSale(id) {
    const sale = sales.find((x) => x.id === id);
    if (!sale) return;
    setSales((prev) => prev.filter((x) => x.id !== id));
    setProducts((prev) => prev.map((p) => p.id === sale.productId ? { ...p, stock: p.stock + sale.quantity } : p));
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
      onPlatformsChange: setPlatforms,
      expenses,
      onExpensesChange: setExpenses,
      onRestore: handleRestore
    }
  ), activeTab === "products" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ProductsPage, { products, onSave: handleSaveProduct, onDelete: handleDeleteProduct }), /* @__PURE__ */ React.createElement(SettingsPanel, { products, sales, platforms, setPlatforms, onRestore: handleRestore })), activeTab === "analytics" && /* @__PURE__ */ React.createElement(
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
.margin-row { display: flex; align-items: center; gap: 10px; }
.margin-name { font-size: 12.5px; font-weight: 600; width: 84px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.margin-bar-track { flex: 1; height: 7px; background: var(--bg); border-radius: 20px; overflow: hidden; }
.margin-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-light)); border-radius: 20px; }
.margin-pct { font-size: 12px; font-weight: 700; width: 48px; text-align: right; flex-shrink: 0; }

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
