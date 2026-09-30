// app.jsx
import React, { useState, useMemo, useEffect } from "react";
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
  const netRevenue = gross - coupon - fee;
  const cost = (product?.cost || 0) * (sale.quantity || 0);
  const profit = netRevenue - cost;
  return { gross, coupon, fee, netRevenue, cost, profit };
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
  return /* @__PURE__ */ React.createElement("aside", { className: "sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar-brand" }, /* @__PURE__ */ React.createElement("div", { className: "brand-mark" }, "M"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "brand-name" }, "MIES Enterprise"), /* @__PURE__ */ React.createElement("div", { className: "brand-sub" }, "Sales Dashboard"))), /* @__PURE__ */ React.createElement("nav", { className: "sidebar-nav" }, NAV_ITEMS.map((item) => /* @__PURE__ */ React.createElement(
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
function ProfitHero({ profit, trend, hasBaseline }) {
  return /* @__PURE__ */ React.createElement("div", { className: "hero-card" }, /* @__PURE__ */ React.createElement("div", { className: "hero-label" }, "NET PROFIT"), /* @__PURE__ */ React.createElement("div", { className: "hero-value" }, fmtCurrency(profit)), /* @__PURE__ */ React.createElement("div", { className: "hero-trend-row" }, /* @__PURE__ */ React.createElement(Trend, { value: trend, hasBaseline }), hasBaseline && /* @__PURE__ */ React.createElement("span", { className: "hero-trend-caption" }, "\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E0A\u0E48\u0E27\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32")), /* @__PURE__ */ React.createElement("svg", { className: "hero-deco", viewBox: "0 0 300 90", preserveAspectRatio: "none" }, /* @__PURE__ */ React.createElement(
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
  return /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-head" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E02\u0E32\u0E22\u0E14\u0E35")), rows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mini-empty" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E02\u0E32\u0E22\u0E14\u0E35") : /* @__PURE__ */ React.createElement("div", { className: "top-product-list" }, rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { className: "top-product-row", key: r.product.id }, /* @__PURE__ */ React.createElement("div", { className: "rank-chip" }, i + 1), /* @__PURE__ */ React.createElement("div", { className: "tp-info" }, /* @__PURE__ */ React.createElement("div", { className: "tp-name" }, r.product.name), /* @__PURE__ */ React.createElement("div", { className: "tp-sub" }, fmtNumber(r.qty), " \u0E0A\u0E34\u0E49\u0E19")), /* @__PURE__ */ React.createElement("div", { className: "tp-figures" }, /* @__PURE__ */ React.createElement("div", { className: "tp-gross" }, fmtCurrency(r.gross)), /* @__PURE__ */ React.createElement("div", { className: "tp-profit" }, "\u0E01\u0E33\u0E44\u0E23 ", fmtCurrency(r.profit)))))));
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
function Dashboard({ sales, products, platforms, dateState, setDateState, onGoto }) {
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
  const current = aggregate(filteredSales, products, platforms);
  const previous = aggregate(prevSales, products, platforms);
  const hasBaseline = prevSales.length > 0;
  if (sales.length === 0) {
    return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "MIES Enterprise", subtitle: "Sales Overview", lowStockCount: 0 }), /* @__PURE__ */ React.createElement(
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
      title: "MIES Enterprise",
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
      hasBaseline
    }
  ), /* @__PURE__ */ React.createElement(KPIGrid, { current, previous, hasBaseline }), /* @__PURE__ */ React.createElement(SalesChart, { sales, products, platforms }), /* @__PURE__ */ React.createElement(LowStockAlert, { products, onNavigate: () => onGoto("products") }), /* @__PURE__ */ React.createElement(PlatformPerformance, { sales: filteredSales, products, platforms }), /* @__PURE__ */ React.createElement(TopProducts, { sales: filteredSales, products }), /* @__PURE__ */ React.createElement(RecentSales, { sales, products, platforms }));
}
function QuickSaleForm({ products, platforms, onSubmit }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [coupon, setCoupon] = useState(0);
  const [fee, setFee] = useState(0);
  const [date, setDate] = useState((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const [feeTouched, setFeeTouched] = useState(false);
  const product = products.find((p) => p.id === productId);
  const platform = platforms.find((p) => p.id === platformId);
  const gross = (parseFloat(price) || 0) * (parseFloat(quantity) || 0);
  function handlePlatformChange(id) {
    setPlatformId(id);
    if (!feeTouched) {
      const pl = platforms.find((p) => p.id === id);
      setFee(Math.round(gross * ((pl?.feePercent || 0) / 100) * 100) / 100);
    }
  }
  const cost = (product?.cost || 0) * (parseFloat(quantity) || 0);
  const profit = gross - coupon - fee - cost;
  const canSubmit = productId && platformId && parseFloat(price) > 0 && parseFloat(quantity) > 0;
  function submit() {
    if (!canSubmit) return;
    onSubmit({
      id: uid(),
      productId,
      platformId,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      coupon: parseFloat(coupon) || 0,
      fee: parseFloat(fee) || 0,
      date: new Date(date).toISOString()
    });
    setProductId("");
    setQuantity(1);
    setPrice("");
    setPlatformId("");
    setCoupon(0);
    setFee(0);
    setFeeTouched(false);
    setDate((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "card section-card" }, /* @__PURE__ */ React.createElement("div", { className: "section-title", style: { marginBottom: 14 } }, "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("div", { className: "form-grid" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), /* @__PURE__ */ React.createElement("select", { value: productId, onChange: (e) => setProductId(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), products.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.name, " (\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D ", p.stock, ")")))), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E08\u0E33\u0E19\u0E27\u0E19"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: "1",
      value: quantity,
      onChange: (e) => setQuantity(e.target.value)
    }
  )), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E23\u0E32\u0E04\u0E32\u0E02\u0E32\u0E22/\u0E0A\u0E34\u0E49\u0E19"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: "0",
      placeholder: "0",
      value: price,
      onChange: (e) => {
        setPrice(e.target.value);
      }
    }
  ))), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Platform"), /* @__PURE__ */ React.createElement("select", { value: platformId, onChange: (e) => handlePlatformChange(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01 Platform"), platforms.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.name)))), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E04\u0E39\u0E1B\u0E2D\u0E07 (\u0E1A\u0E32\u0E17)"), /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", value: coupon, onChange: (e) => setCoupon(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21 (\u0E1A\u0E32\u0E17)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: "0",
      value: fee,
      onChange: (e) => {
        setFee(e.target.value);
        setFeeTouched(true);
      }
    }
  ))), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48"), /* @__PURE__ */ React.createElement("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "live-summary" }, /* @__PURE__ */ React.createElement("div", { className: "ls-row" }, /* @__PURE__ */ React.createElement("span", null, "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(gross))), /* @__PURE__ */ React.createElement("div", { className: "ls-row" }, /* @__PURE__ */ React.createElement("span", null, "\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(fee))), /* @__PURE__ */ React.createElement("div", { className: "ls-row" }, /* @__PURE__ */ React.createElement("span", null, "\u0E04\u0E39\u0E1B\u0E2D\u0E07"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(coupon))), /* @__PURE__ */ React.createElement("div", { className: "ls-row" }, /* @__PURE__ */ React.createElement("span", null, "\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19"), /* @__PURE__ */ React.createElement("span", null, "-", fmtCurrency(cost))), /* @__PURE__ */ React.createElement("div", { className: "ls-row ls-profit" }, /* @__PURE__ */ React.createElement("span", null, "\u0E01\u0E33\u0E44\u0E23"), /* @__PURE__ */ React.createElement("span", null, fmtCurrency(profit)))), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary btn-block", disabled: !canSubmit, onClick: submit }, /* @__PURE__ */ React.createElement(Check, { size: 16 }), " \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22"));
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
function SalesPage({ products, platforms, sales, onAddSale, onImport }) {
  const [showImport, setShowImport] = useState(false);
  return /* @__PURE__ */ React.createElement("div", { className: "page-inner" }, /* @__PURE__ */ React.createElement(Header, { title: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22", subtitle: fmtNumber(sales.length) + " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", lowStockCount: 0 }), /* @__PURE__ */ React.createElement("div", { className: "sales-toolbar" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-block", onClick: () => setShowImport(true) }, /* @__PURE__ */ React.createElement(Upload, { size: 16 }), " Import Orders")), /* @__PURE__ */ React.createElement(QuickSaleForm, { products, platforms, onSubmit: onAddSale }), showImport && /* @__PURE__ */ React.createElement(
    ImportModal,
    {
      products,
      platforms,
      onClose: () => setShowImport(false),
      onImport
    }
  ));
}
function ProductForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
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
      lowStockThreshold: parseFloat(lowStockThreshold) || 5
    });
  }
  return /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("div", { className: "modal-title" }, initial ? "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" : "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), /* @__PURE__ */ React.createElement("button", { className: "icon-btn", onClick: onClose }, /* @__PURE__ */ React.createElement(X, { size: 18 }))), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "form-grid" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"), /* @__PURE__ */ React.createElement("input", { value: name, onChange: (e) => setName(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "SKU"), /* @__PURE__ */ React.createElement("input", { value: sku, onChange: (e) => setSku(e.target.value) })), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19"), /* @__PURE__ */ React.createElement("input", { type: "number", value: cost, onChange: (e) => setCost(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E23\u0E32\u0E04\u0E32\u0E02\u0E32\u0E22"), /* @__PURE__ */ React.createElement("input", { type: "number", value: price, onChange: (e) => setPrice(e.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "field-row" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E2A\u0E15\u0E47\u0E2D\u0E01"), /* @__PURE__ */ React.createElement("input", { type: "number", value: stock, onChange: (e) => setStock(e.target.value) })), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E2B\u0E25\u0E37\u0E2D"), /* @__PURE__ */ React.createElement(
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
    return /* @__PURE__ */ React.createElement("div", { className: "product-card", key: p.id }, /* @__PURE__ */ React.createElement("div", { className: "product-card-top" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "product-name" }, p.name), /* @__PURE__ */ React.createElement("div", { className: "product-sku" }, p.sku)), /* @__PURE__ */ React.createElement("div", { className: "product-actions" }, /* @__PURE__ */ React.createElement(
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
    )), /* @__PURE__ */ React.createElement("div", { className: "margin-pct" }, margin.toFixed(0), "%"));
  }))));
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
  const [platforms] = useState(DEFAULT_PLATFORMS);
  const [sales, setSales] = useState(stored?.sales || []);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dateState, setDateState] = useState({
    preset: "7d",
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
  useEffect(() => {
    if (!cloudOn || !session) return;
    let cancelled = false;
    setSyncMsg("\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u2026");
    loadRemote().then((remote) => {
      if (cancelled) return;
      if (remote) { setProducts(remote.products || []); setSales(remote.sales || []); }
      else if (products.length || sales.length) { saveRemote({ products, sales }).catch(() => {}); }
      setReady(true); setSyncMsg("");
    }).catch((e) => {
      if (cancelled || handleAuthError(e)) return;
      setSyncMsg("\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C \u2013 \u0E43\u0E0A\u0E49\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07 (\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C)");
    });
    return () => { cancelled = true; };
  }, [session]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales }));
    } catch (e) {
      console.warn("Could not save data", e);
    }
    if (!cloudOn || !session || !ready) return;
    const t = setTimeout(() => {
      setSyncMsg("\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u2026");
      saveRemote({ products, sales })
        .then(() => setSyncMsg("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E41\u0E25\u0E49\u0E27 \u2713"))
        .catch((e) => { if (!handleAuthError(e)) setSyncMsg("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08"); });
    }, 800);
    return () => clearTimeout(t);
  }, [products, sales, session, ready]);
  const lowStockCount = products.filter((p) => getStockStatus(p) !== "\u0E1B\u0E01\u0E15\u0E34").length;
  function handleAddSale(sale) {
    setSales((prev) => [...prev, sale]);
    setProducts(
      (prev) => prev.map((p) => p.id === sale.productId ? { ...p, stock: p.stock - sale.quantity } : p)
    );
  }
  function handleImport(newSales, stockDelta) {
    setSales((prev) => [...prev, ...newSales]);
    setProducts(
      (prev) => prev.map((p) => stockDelta[p.id] ? { ...p, stock: p.stock - stockDelta[p.id] } : p)
    );
  }
  function handleSaveProduct(product) {
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
      onImport: handleImport
    }
  ), activeTab === "products" && /* @__PURE__ */ React.createElement(ProductsPage, { products, onSave: handleSaveProduct, onDelete: handleDeleteProduct }), activeTab === "analytics" && /* @__PURE__ */ React.createElement(
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
.margin-pct { font-size: 12px; font-weight: 700; width: 34px; text-align: right; flex-shrink: 0; }

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
