// pdf-backup.js — สร้างไฟล์สำรองข้อมูลเป็น PDF (A4 แนวนอน)
// วิธีทำ: สร้างหน้ากระดาษเป็น HTML (ใช้ฟอนต์ไทยของแอป จึงไม่เพี้ยน) -> แปลงเป็นภาพทีละหน้า -> รวมเป็น PDF
// ถ้าโหลดไลบรารีไม่ได้ (ออฟไลน์) จะเปิดหน้าต่างพิมพ์ให้เลือก "บันทึกเป็น PDF" แทน

const PAGE_W = 1123, PAGE_H = 794; // A4 landscape @96dpi
const FONT = "'Noto Sans Thai', 'Sarabun', Tahoma, sans-serif";
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

const CSS = `
.pdf-page{width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;padding:34px 40px 30px;background:#fff;color:#1B2A26;font-family:${FONT};font-size:12px;line-height:1.45;position:relative;overflow:hidden}
.pdf-page *{box-sizing:border-box}
.pdf-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #043F3D;padding-bottom:8px;margin-bottom:12px}
.pdf-head h1{margin:0;font-size:20px;color:#043F3D;font-weight:700}
.pdf-head span{font-size:11px;color:#68706B}
.pdf-foot{position:absolute;left:40px;right:40px;bottom:14px;display:flex;justify-content:space-between;font-size:10px;color:#99A09B}
.pdf-table{width:100%;border-collapse:collapse;table-layout:fixed}
.pdf-table th{background:#043F3D;color:#fff;font-weight:600;text-align:left;padding:5px 6px;font-size:11px}
.pdf-table td{padding:4px 6px;border-bottom:1px solid #E4E8E3;height:23px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.pdf-table tr:nth-child(even) td{background:#F6F7F5}
.pdf-table .r{text-align:right}
.pdf-table .neg{color:#B42318}
.pdf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:6px 0 18px}
.pdf-kpi{border:1px solid #E4E8E3;border-radius:10px;padding:12px 14px}
.pdf-kpi b{display:block;font-size:20px;color:#043F3D;margin-top:2px}
.pdf-kpi small{color:#68706B;font-size:11px}
.pdf-h2{font-size:14px;font-weight:700;color:#043F3D;margin:14px 0 6px}
.pdf-slips{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.pdf-slip{border:1px solid #E4E8E3;border-radius:8px;padding:6px;height:300px;display:flex;flex-direction:column}
.pdf-slip img{flex:1;min-height:0;width:100%;object-fit:contain;background:#F6F7F5;border-radius:4px}
.pdf-slip div{font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

function table(cols, rows) {
  return `<table class="pdf-table"><colgroup>${cols.map((c) => `<col style="width:${c.w}">`).join("")}</colgroup>` +
    `<thead><tr>${cols.map((c) => `<th class="${c.r ? "r" : ""}">${esc(c.h)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${cols.map((c, i) => {
      const v = r[i];
      const neg = c.r && typeof v === "number" && v < 0 ? " neg" : "";
      return `<td class="${c.r ? "r" : ""}${neg}">${esc(typeof v === "number" ? (c.n ? v.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : money(v)) : v)}</td>`;
    }).join("")}</tr>`).join("") + `</tbody></table>`;
}

// ctx: { products, sales, platforms, expenses, slips, h: { computeSaleMetrics, bkkDate, fmtTime, expenseParts, expCatShort, expCategory } }
export function buildPages(ctx) {
  const { products, sales, platforms, expenses, slips, h } = ctx;
  const pm = Object.fromEntries(products.map((p) => [p.id, p]));
  const plm = Object.fromEntries(platforms.map((p) => [p.id, p]));
  const now = new Date();
  const stampTxt = h.bkkDate(now) + " " + now.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  const pages = []; // { title, body }

  const statusTxt = (s) => (s === "returned" ? "ตีกลับ" : s === "lost" ? "สูญหาย" : s === "cancelled" ? "ยกเลิก" : "ปกติ");
  const sorted = [...sales].sort((a, b) => new Date(a.date) - new Date(b.date));
  const saleRows = sorted.map((s) => {
    const m = h.computeSaleMetrics(s, pm[s.productId], plm[s.platformId]);
    return [h.bkkDate(s.date) + " " + (h.fmtTime(s.date) || ""), pm[s.productId]?.name || "-", plm[s.platformId]?.name || "-", s.quantity, s.price, m.gross, m.fee, m.cost, m.profit, statusTxt(s.status), s.orderNo || ""];
  });
  const tot = saleRows.reduce((a, r, i) => {
    const s = sorted[i]; const m = h.computeSaleMetrics(s, pm[s.productId], plm[s.platformId]);
    a.gross += m.gross; a.fee += m.fee; a.cost += m.cost; a.profit += m.profit; return a;
  }, { gross: 0, fee: 0, cost: 0, profit: 0 });
  const bills = expenses.filter((e) => e.bill).sort((a, b) => (a.date < b.date ? -1 : 1));
  const monthly = expenses.filter((e) => !e.bill);
  const expTotal = expenses.reduce((a, e) => a + (e.amount || 0), 0);

  // หน้าสรุป
  pages.push({
    title: "สรุปข้อมูลสำรอง",
    body: `<div class="pdf-kpis">
      <div class="pdf-kpi"><small>ยอดขายรวม</small><b>฿${money(tot.gross)}</b></div>
      <div class="pdf-kpi"><small>ค่าธรรมเนียมแพลตฟอร์ม</small><b>฿${money(tot.fee)}</b></div>
      <div class="pdf-kpi"><small>ต้นทุนสินค้า</small><b>฿${money(tot.cost)}</b></div>
      <div class="pdf-kpi"><small>กำไรจากการขาย</small><b>฿${money(tot.profit)}</b></div></div>
      <div class="pdf-kpis">
      <div class="pdf-kpi"><small>จำนวนสินค้า</small><b>${products.length.toLocaleString("th-TH")}</b></div>
      <div class="pdf-kpi"><small>จำนวนรายการขาย</small><b>${sales.length.toLocaleString("th-TH")}</b></div>
      <div class="pdf-kpi"><small>บิลรายจ่าย / รายจ่ายรายเดือน</small><b>${bills.length} / ${monthly.length}</b></div>
      <div class="pdf-kpi"><small>รายจ่ายรวม (ตามที่บันทึก)</small><b>฿${money(expTotal)}</b></div></div>
      <div class="pdf-h2">แพลตฟอร์ม</div>` +
      table([{ h: "ชื่อ", w: "40%" }, { h: "ค่าธรรมเนียม (%)", w: "20%", r: true, n: 1 }, { h: "จำนวนรายการขาย", w: "20%", r: true, n: 1 }, { h: "ยอดขาย", w: "20%", r: true }],
        platforms.map((p) => {
          let n = 0, g = 0;
          sorted.forEach((s, i) => { if (s.platformId === p.id) { n++; g += saleRows[i][5]; } });
          return [p.name, p.feePercent ?? 0, n, g];
        })) +
      `<div style="margin-top:14px;color:#68706B;font-size:11px">ไฟล์นี้เป็นสำเนาเพื่ออ่านและเก็บเป็นหลักฐาน หากต้องการกู้คืนข้อมูลกลับเข้าแอป ให้ใช้ไฟล์สำรอง JSON</div>`
  });

  // สินค้า
  const prodCols = [{ h: "สินค้า", w: "34%" }, { h: "SKU", w: "16%" }, { h: "ต้นทุน", w: "12%", r: true }, { h: "ราคาขาย", w: "12%", r: true }, { h: "คงเหลือ", w: "13%", r: true, n: 1 }, { h: "แจ้งเตือนเมื่อเหลือ", w: "13%", r: true, n: 1 }];
  const prodRows = [...products].sort((a, b) => String(a.name).localeCompare(String(b.name), "th")).map((p) => [p.name, p.sku || "", p.cost, p.price, p.stock, p.lowStockThreshold ?? 5]);
  chunk(prodRows, 24).forEach((c, i, all) => pages.push({ title: `สินค้า (${i + 1}/${all.length})`, body: table(prodCols, c) }));

  // รายการขาย
  const saleCols = [{ h: "วันที่/เวลา", w: "12%" }, { h: "สินค้า", w: "22%" }, { h: "แพลตฟอร์ม", w: "10%" }, { h: "จำนวน", w: "6%", r: true, n: 1 }, { h: "ราคา/ชิ้น", w: "9%", r: true }, { h: "ยอดขาย", w: "9%", r: true }, { h: "ค่าธรรมเนียม", w: "8%", r: true }, { h: "ต้นทุน", w: "8%", r: true }, { h: "กำไร", w: "8%", r: true }, { h: "สถานะ", w: "6%" }, { h: "เลขออเดอร์", w: "12%" }];
  chunk(saleRows, 24).forEach((c, i, all) => pages.push({ title: `รายการขาย (${i + 1}/${all.length})`, body: table(saleCols, c) }));

  // บิลรายจ่าย
  const billCols = [{ h: "วันที่จ่าย", w: "12%" }, { h: "รายการ", w: "28%" }, { h: "จำนวนเงิน", w: "12%", r: true }, { h: "หมวด", w: "16%" }, { h: "รายการย่อยในบิล", w: "28%" }, { h: "สลิป", w: "4%" }];
  const billRows = bills.map((e) => [e.date, e.name, e.amount, [...new Set(h.expenseParts(e).map((p) => h.expCatShort(p.cat)))].join(", "), (e.items || []).map((i) => i.name + " " + i.amount).join(", "), e.slip ? "มี" : "-"]);
  chunk(billRows, 24).forEach((c, i, all) => pages.push({ title: `บิลรายจ่าย (${i + 1}/${all.length})`, body: table(billCols, c) }));

  // รายจ่ายรายเดือน
  const monCols = [{ h: "รายการ", w: "40%" }, { h: "จำนวนเงิน/เดือน", w: "18%", r: true }, { h: "เริ่มเดือน", w: "14%" }, { h: "ประเภท", w: "14%" }, { h: "หมวด", w: "14%" }];
  const monRows = monthly.map((e) => [e.name, e.amount, e.month, e.recurring ? "ทุกเดือน" : "เดือนเดียว", h.expCatShort(h.expCategory(e.name, e.cat))]);
  chunk(monRows, 24).forEach((c, i, all) => pages.push({ title: `รายจ่ายรายเดือน (${i + 1}/${all.length})`, body: table(monCols, c) }));

  // สลิป
  const slipItems = bills.concat(monthly).filter((e) => e.slip && slips && slips[e.id]);
  chunk(slipItems, 8).forEach((c, i, all) => pages.push({
    title: `สลิปการจ่ายเงิน (${i + 1}/${all.length})`,
    body: `<div class="pdf-slips">${c.map((e) => `<div class="pdf-slip"><img src="${esc(slips[e.id])}"><div><b>${esc(e.name)}</b></div><div>${esc(e.date || e.month || "")} · ฿${money(e.amount)}</div></div>`).join("")}</div>`
  }));

  const total = pages.length;
  return pages.map((p, i) => `<div class="pdf-page"><div class="pdf-head"><h1>MIES TRADING · ${esc(p.title)}</h1><span>สำรองเมื่อ ${esc(stampTxt)}</span></div>${p.body}<div class="pdf-foot"><span>MIES Dashboard</span><span>หน้า ${i + 1} / ${total}</span></div></div>`);
}

async function loadLibs() {
  const [c, j] = await Promise.all([import("https://esm.sh/html2canvas@1.4.1"), import("https://esm.sh/jspdf@2.5.1")]);
  return { html2canvas: c.default || c, jsPDF: j.jsPDF || (j.default && j.default.jsPDF) || j.default };
}

function printFallback(pagesHtml) {
  const w = window.open("", "_blank");
  if (!w) { alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up แล้วลองใหม่"); return; }
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>mies-backup</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet"><style>@page{size:A4 landscape;margin:0}body{margin:0}.pdf-page{page-break-after:always}${CSS}</style></head><body>${pagesHtml.join("")}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 1200);
}

// onProgress(done, total) เรียกทุกหน้า
export async function exportPdf(ctx, fileName, onProgress) {
  const pagesHtml = buildPages(ctx);
  let libs;
  try { libs = await loadLibs(); } catch (e) { printFallback(pagesHtml); return "print"; }
  const { html2canvas, jsPDF } = libs;
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-${PAGE_W + 200}px;top:0;width:${PAGE_W}px;z-index:-1`;
  host.innerHTML = `<style>${CSS}</style>`;
  document.body.appendChild(host);
  try {
    try { await document.fonts.load("12px 'Noto Sans Thai'"); await document.fonts.ready; } catch (e) {}
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [PAGE_W, PAGE_H], compress: true, hotfixes: ["px_scaling"] });
    for (let i = 0; i < pagesHtml.length; i++) {
      const el = document.createElement("div");
      el.innerHTML = pagesHtml[i];
      host.appendChild(el);
      const canvas = await html2canvas(el.firstChild, { scale: 1.6, backgroundColor: "#ffffff", useCORS: true, logging: false });
      if (i > 0) pdf.addPage([PAGE_W, PAGE_H], "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
      canvas.width = canvas.height = 0;
      host.removeChild(el);
      if (onProgress) onProgress(i + 1, pagesHtml.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    pdf.save(fileName);
    return "pdf";
  } finally { host.remove(); }
}
