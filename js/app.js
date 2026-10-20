import { departmentsForSite } from "./schema.js";
import { db, periodYear, pickDefaultPeriod, escapeHtml, loadSitesList, fetchSiteReportsMap } from "./dashboard-shared.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const siteSelect = document.getElementById("siteSelect");
const periodSelect = document.getElementById("periodSelect");
const stateMsg = document.getElementById("stateMsg");
const topicsWrap = document.getElementById("topicsWrap");
const disciplinaryLink = document.getElementById("disciplinaryLink");

let sites = [];
let currentSiteId = null;
let reportsById = {}; // periodId -> report data, for the currently loaded site

function setState(msg) {
  if (msg) {
    stateMsg.textContent = msg;
    stateMsg.style.display = "block";
    topicsWrap.style.display = "none";
  } else {
    stateMsg.style.display = "none";
    topicsWrap.style.display = "grid";
  }
}

async function loadSites() {
  sites = await loadSitesList();

  if (sites.length === 0) {
    setState("No plants yet. Go to Admin to add your first plant and monthly report.");
    return;
  }

  siteSelect.innerHTML = sites.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  const params = new URLSearchParams(location.search);
  const wanted = params.get("site");
  const defaultSite = sites.find(s => s.name === "YHT");
  currentSiteId = sites.some(s => s.id === wanted) ? wanted : (defaultSite ? defaultSite.id : sites[0].id);
  siteSelect.value = currentSiteId;

  await loadReportsForSite(currentSiteId, params.get("period"));
  await loadDisciplinarySummary(currentSiteId);
}

async function loadReportsForSite(siteId, wantedPeriod) {
  setState("Loading…");
  reportsById = await fetchSiteReportsMap(siteId);

  const periods = Object.keys(reportsById).sort((a, b) => b.localeCompare(a));

  if (periods.length === 0) {
    periodSelect.innerHTML = "";
    setState("No monthly reports yet for this plant. Add one from Admin.");
    return;
  }

  periodSelect.innerHTML = periods.map(p =>
    `<option value="${p}">${escapeHtml(reportsById[p].period || p)}</option>`
  ).join("");
  const chosenPeriod = pickDefaultPeriod(periods, wantedPeriod);
  periodSelect.value = chosenPeriod;

  render(siteId, chosenPeriod);
  setState(null);
}

// Sum a numeric field across every period in the same calendar year as
// `periodId`, up to and including it — i.e. year-to-date.
function ytdSum(periodId, key) {
  const year = periodYear(periodId);
  let ids = Object.keys(reportsById);
  if (year) ids = ids.filter(id => periodYear(id) === year);
  ids = ids.filter(id => id <= periodId).sort();
  return ids.reduce((sum, id) => sum + (Number(reportsById[id][key]) || 0), 0);
}

// ── Card chart helpers (shared look: dark/light blue, labels like the Excel prototype) ──
const XL_FONT = "Carlito, Calibri, 'Segoe UI', Arial, sans-serif";
const XL_DARK = "#3F63AE", XL_LIGHT = "#91A3D5", XL_TEXT = "#404040";
Chart.register(ChartDataLabels);
Chart.defaults.font.family = XL_FONT;
const xlCharts = {};

const setT = (id, text) => { document.getElementById(id).textContent = text; };
const plain = n => String(Math.round(n * 10) / 10);   // lines read "W: 3000", like the prototype

const xlFont = (ctx, ratio, min) => ({ size: Math.max(min, Math.round(ctx.chart.width * ratio)), weight: "400", family: XL_FONT });
const xlPiePadding = (w, h) => ({ left: w * 0.24, right: w * 0.24, top: h * 0.07, bottom: h * 0.07 });

// "Non-Worker (NW)" -> two lines, as in the prototype
const xlLabelLines = s => { const p = String(s).split(" ("); return p.length > 1 ? [p[0], "(" + p.slice(1).join(" (")] : [String(s)]; };

function drawXlPie(key, canvasId, labels, values) {
  if (xlCharts[key]) xlCharts[key].destroy();
  const canvas = document.getElementById(canvasId);
  const empty = values.every(v => !(v > 0));
  const box = canvas.parentElement.getBoundingClientRect();
  xlCharts[key] = new Chart(canvas.getContext("2d"), {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: empty ? [1] : values,
        backgroundColor: empty ? ["#E4E8EF"] : [XL_DARK, XL_LIGHT],
        borderWidth: 2, borderColor: "#fff"
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: box.width ? xlPiePadding(box.width, box.height) : 8 },
      onResize: (chart, size) => { chart.options.layout.padding = xlPiePadding(size.width, size.height); chart.update("none"); },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: !empty },
        datalabels: empty ? { display: false } : {
          anchor: "end", align: "end", offset: 2, color: XL_TEXT, textAlign: "center",
          font: ctx => xlFont(ctx, 0.075, 9),
          formatter: (v, ctx) => v > 0 ? xlLabelLines(ctx.chart.data.labels[ctx.dataIndex]) : ""
        }
      }
    }
  });
}

function drawXlBars(key, canvasId, labels, datasets, { legend = false, valueLabels = false } = {}) {
  if (xlCharts[key]) xlCharts[key].destroy();
  xlCharts[key] = new Chart(document.getElementById(canvasId).getContext("2d"), {
    type: "bar",
    data: { labels, datasets: datasets.map(d => ({ borderRadius: 2, ...d })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 14 } },
      plugins: {
        legend: legend ? { position: "bottom", labels: { boxWidth: 9, boxHeight: 9, font: { size: 10 }, color: XL_TEXT } } : { display: false },
        datalabels: valueLabels ? {
          anchor: "end", align: ctx => (ctx.dataset.data[ctx.dataIndex] < 0 ? "bottom" : "top"),
          color: XL_TEXT, font: ctx => xlFont(ctx, 0.05, 9),
          formatter: v => v ? v.toLocaleString() : ""
        } : { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: XL_TEXT, font: { size: 10 } } },
        y: { display: false, beginAtZero: true }
      }
    }
  });
}

function fmtAvg(n) {
  if (n === null || n === undefined) return "–";
  return (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString();
}

function fmtSigned(n) {
  if (n === null || n === undefined) return "–";
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}

// Sewing Worker (Operator + Helper): actual minus standard. Negative = shortage.
function shortageFor(rec) {
  const stdOp = Number(rec.shortageStdOperator) || 0;
  const stdHelper = Number(rec.shortageStdHelper) || 0;
  const actOp = Number(rec.shortageActualOperator) || 0;
  const actHelper = Number(rec.shortageActualHelper) || 0;
  const stdTotal = stdOp + stdHelper;
  const actTotal = actOp + actHelper;
  const has = stdTotal > 0 && actTotal > 0;
  return {
    stdOp, stdHelper, actOp, actHelper, stdTotal, actTotal, has,
    opDiff: actOp - stdOp,
    helperDiff: actHelper - stdHelper,
    diff: actTotal - stdTotal
  };
}

// Sets a hero/line element's text and turns it red when the value is negative.
function setSignedText(id, text, value) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.toggle("negative", value !== null && value < 0);
}

function render(siteId, periodId) {
  const current = reportsById[periodId] || {};
  const year = periodYear(periodId);
  const upToNow = id => (!year || periodYear(id) === year) && id <= periodId;   // same year, through the selected month
  const selectedMonthIdx = parseInt(periodId.slice(5, 7), 10) - 1;

  // ── Manpower ─────────────────────────────────────────────────
  const workerManpower = Number(current.workerManpower) || 0;
  const nonWorkerManpower = Number(current.nonWorkerManpower) || 0;
  const closingManpower = Number(current.closingManpower) || (workerManpower + nonWorkerManpower);
  const ytdTotals = Object.keys(reportsById).filter(upToNow)
    .map(id => Number(reportsById[id].closingManpower) || 0).filter(v => v > 0);
  const ytdAvg = ytdTotals.length ? Math.round(ytdTotals.reduce((a, b) => a + b, 0) / ytdTotals.length) : 0;

  setT("manpowerBigNum", closingManpower.toLocaleString());
  setT("manpowerWorker", `W: ${plain(workerManpower)}`);
  setT("manpowerNonWorker", `NW: ${plain(nonWorkerManpower)}`);
  setT("manpowerYtdAvg", `YTD: ${ytdAvg.toLocaleString()}`);
  drawXlPie("manpower", "manpowerPie", ["Worker (W)", "Non-Worker (NW)"], [workerManpower, nonWorkerManpower]);

  // ── Direct Manpower (Indirect = Total − Direct) ───────────────
  const directCount = Number(current.directManpower) || 0;
  const indirectCount = closingManpower > 0 ? Math.max(closingManpower - directCount, 0) : 0;
  const directPct = closingManpower > 0 && directCount > 0 ? Math.round((directCount / closingManpower) * 1000) / 10 : null;
  const directPcts = Object.keys(reportsById).filter(upToNow).map(id => {
    const r = reportsById[id];
    const tot = Number(r.closingManpower) || 0, dir = Number(r.directManpower) || 0;
    return tot > 0 && dir > 0 ? (dir / tot) * 100 : null;
  }).filter(v => v !== null);
  const directYtdAvg = directPcts.length ? Math.round((directPcts.reduce((a, b) => a + b, 0) / directPcts.length) * 10) / 10 : null;

  setT("directBigPct", directPct === null ? "–" : `${directPct}%`);
  setT("directLineDirect", `Direct: ${plain(directCount)}`);
  setT("directLineIndirect", `Indirect: ${plain(indirectCount)}`);
  setT("directYtdAvg", `YTD: ${directYtdAvg === null ? "–" : directYtdAvg + "%"}`);
  drawXlPie("direct", "directChart", ["Direct", "Indirect"], [directCount, indirectCount]);

  // ── Manpower Excess / (Shortage) — Sewing Worker (Operator + Helper) ─
  const sf = shortageFor(current);
  const shortageDiffs = Object.keys(reportsById).filter(upToNow)
    .map(id => shortageFor(reportsById[id])).filter(r => r.has).map(r => r.diff);
  const shortageYtdAvg = shortageDiffs.length ? Math.round(shortageDiffs.reduce((a, b) => a + b, 0) / shortageDiffs.length) : null;

  setSignedText("shortageBigNum", sf.has ? fmtSigned(sf.diff) : "–", sf.has ? sf.diff : null);
  setSignedText("shortageOperator", `Sewing Operator: ${sf.has ? fmtSigned(sf.opDiff) : "–"}`, sf.has ? sf.opDiff : null);
  setSignedText("shortageHelper", `Sewing Helper: ${sf.has ? fmtSigned(sf.helperDiff) : "–"}`, sf.has ? sf.helperDiff : null);
  setT("shortageYtdAvg", `YTD: ${fmtSigned(shortageYtdAvg)}`);
  drawXlBars("shortage", "shortageChart", ["Operator", "Helper"], [
    { label: "Standard", data: sf.has ? [sf.stdOp, sf.stdHelper] : [0, 0], backgroundColor: XL_LIGHT },
    { label: "Actual", data: sf.has ? [sf.actOp, sf.actHelper] : [0, 0], backgroundColor: XL_DARK }
  ], { legend: true, valueLabels: true });

  // ── Leave Consumption ────────────────────────────────────────
  const totalElPlan = Number(current.totalElPlan) || 0;
  const monthElPlan = Number(current.monthElPlan) || 0;
  const monthElActual = Number(current.monthElActual) || 0;
  const ytdElActual = ytdSum(periodId, "monthElActual");
  const monthPct = monthElPlan > 0 ? Math.round((monthElActual / monthElPlan) * 1000) / 10 : 0;
  const ytdPct = totalElPlan > 0 ? Math.round((ytdElActual / totalElPlan) * 1000) / 10 : 0;

  setT("leaveMonthPct", `${monthPct}%`);
  setT("leaveActual", `Actual: ${plain(monthElActual)}`);
  setT("leavePlan", `Plan: ${plain(monthElPlan)}`);
  setT("leaveYtdPct", `YTD: ${ytdPct}%`);
  drawXlPie("leave", "leaveChart", ["Consumed", "Balance"], [ytdElActual, Math.max(totalElPlan - ytdElActual, 0)]);

  // ── Sick Leave ───────────────────────────────────────────────
  const monthSickDays = Number(current.monthSickDays) || 0;
  const monthSickEmployees = Number(current.monthSickEmployees) || 0;
  const monthHeadcount = Number(current.monthHeadcount) || 0;
  const ytdSickDays = ytdSum(periodId, "monthSickDays");
  const sickPct = monthHeadcount > 0 ? Math.round((monthSickEmployees / monthHeadcount) * 1000) / 10 : 0;

  setT("sickPct", `${sickPct}%`);
  setT("sickDays", `Days: ${plain(monthSickDays)}`);
  setT("sickEmployees", `Employees: ${plain(monthSickEmployees)}`);
  setT("sickYtdDays", `YTD: ${ytdSickDays.toLocaleString()}`);
  const sickSeries = buildMonthRows(periodId, ["monthSickDays"]).rows.map(r => r.monthSickDays);
  drawXlBars("sick", "sickChart", ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], [{
    label: "Sick days", data: sickSeries,
    backgroundColor: sickSeries.map((_, i) => i === selectedMonthIdx ? XL_DARK : XL_LIGHT)
  }]);

  // ── Present % ────────────────────────────────────────────────
  const presentTotalEmployees = Number(current.presentTotalEmployees) || 0;
  const presentTotalPresent = Number(current.presentTotalPresent) || 0;
  const presentSewingTotal = Number(current.presentSewingTotal) || 0;
  const presentSewingPresent = Number(current.presentSewingPresent) || 0;
  const presentOverallPct = presentTotalEmployees > 0 ? Math.round((presentTotalPresent / presentTotalEmployees) * 1000) / 10 : 0;
  const presentSewingPct = presentSewingTotal > 0 ? Math.round((presentSewingPresent / presentSewingTotal) * 1000) / 10 : 0;
  const presentPcts = Object.keys(reportsById).filter(upToNow).map(id => {
    const r = reportsById[id];
    const emp = Number(r.presentTotalEmployees) || 0, pr = Number(r.presentTotalPresent) || 0;
    return emp > 0 ? (pr / emp) * 100 : null;
  }).filter(v => v !== null);
  const presentYtdAvg = presentPcts.length ? Math.round((presentPcts.reduce((a, b) => a + b, 0) / presentPcts.length) * 10) / 10 : null;

  setT("presentOverallPct", `${presentOverallPct}%`);
  setT("presentLinePresent", `Present: ${plain(presentTotalPresent)}`);
  setT("presentSewingPct", `Sewing: ${presentSewingPct}%`);
  setT("presentYtdAvg", `YTD: ${presentYtdAvg === null ? "–" : presentYtdAvg + "%"}`);
  drawXlPie("present", "presentChart", ["Present", "Absent"], [presentTotalPresent, Math.max(presentTotalEmployees - presentTotalPresent, 0)]);

  // ── Injuries ─────────────────────────────────────────────────
  const injuriesTotalMonth = Number(current.injuriesTotal) || 0;
  const injuriesCriticalMonth = Number(current.injuriesCritical) || 0;
  const injuriesOthers = Math.max(injuriesTotalMonth - injuriesCriticalMonth, 0);
  const injuriesYtdTotal = ytdSum(periodId, "injuriesTotal");

  setT("injuriesTotalBigNum", injuriesTotalMonth.toLocaleString());
  setT("injuriesCriticalMonth", `Critical: ${plain(injuriesCriticalMonth)}`);
  setT("injuriesOthers", `Others: ${plain(injuriesOthers)}`);
  setT("injuriesYtdTotal", `YTD: ${injuriesYtdTotal.toLocaleString()}`);
  drawXlPie("injuries", "injuriesChart", ["Critical", "Others"], [injuriesCriticalMonth, injuriesOthers]);

  // ── Employees Feedback Received ──────────────────────────────
  const feedbackExternal = Number(current.feedbackExternal) || 0;
  const feedbackInternal = Number(current.feedbackInternal) || 0;
  const feedbackTotal = Number(current.feedbackTotal) || (feedbackExternal + feedbackInternal);
  const ytdFeedbackTotal = ytdSum(periodId, "feedbackTotal");

  setT("feedbackBigNum", feedbackTotal.toLocaleString());
  setT("feedbackExternal", `External: ${plain(feedbackExternal)}`);
  setT("feedbackInternal", `Internal: ${plain(feedbackInternal)}`);
  setT("feedbackYtdTotal", `YTD: ${ytdFeedbackTotal.toLocaleString()}`);
  drawXlPie("feedback", "feedbackChart", ["External", "Internal"], [feedbackExternal, feedbackInternal]);

  syncUrl(siteId, periodId);
}

// ── Disciplinary Action — lightweight summary + link to its own page ──
// Not part of the monthly report cycle, so this loads once per site (not per period).
async function loadDisciplinarySummary(siteId) {
  const siteName = sites.find(s => s.id === siteId)?.name || "";
  disciplinaryLink.href = `disciplinary.html?site=${encodeURIComponent(siteId)}`;

  let data = {};
  try {
    const snap = await getDoc(doc(db, "sites", siteId, "meta", "disciplinary"));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    console.error(err);
  }

  const deptData = data.disciplinaryDept || {};
  const departments = departmentsForSite(siteName);
  let grandWorker = 0, grandNonWorker = 0, grandEmployees = 0;
  departments.forEach(d => {
    const v = deptData[d.key] || {};
    grandWorker += Number(v.worker) || 0;
    grandNonWorker += Number(v.nonWorker) || 0;
    grandEmployees += Number(v.employees) || 0;
  });
  const grandActions = grandWorker + grandNonWorker;
  const grandPct = grandEmployees > 0 ? Math.round((grandActions / grandEmployees) * 1000) / 10 : 0;

  setT("discGrandActions", grandActions.toLocaleString());
  setT("discWorker", `W: ${plain(grandWorker)}`);
  setT("discNonWorker", `NW: ${plain(grandNonWorker)}`);
  setT("discGrandPct", `Overall: ${grandPct}%`);
  setT("discPeriodLabel", data.periodLabel || "No summary period set yet");
  drawXlPie("disc", "discChart", ["Worker (W)", "Non-Worker (NW)"], [grandWorker, grandNonWorker]);
}

// ── Reusable month-by-month detail modal ───────────────────
const detailModal = document.getElementById("detailModal");
const detailModalClose = document.getElementById("detailModalClose");
const detailModalTitle = document.getElementById("detailModalTitle");
const detailModalTableHead = document.getElementById("detailModalTableHead");
const detailModalTableBody = document.getElementById("detailModalTableBody");
let detailChart = null;

detailModalClose.addEventListener("click", closeDetailModal);
detailModal.addEventListener("click", (e) => { if (e.target === detailModal) closeDetailModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailModal();
});

function closeDetailModal() {
  detailModal.style.display = "none";
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Builds the 12-month row data for the currently selected year, using
// whichever fields the caller asks for (each becomes a table column + chart series).
function buildMonthRows(periodId, fieldKeys) {
  const year = periodYear(periodId);
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, "0");
    const id = year ? `${year}-${num}` : null;
    const rec = (id && reportsById[id]) || null;
    const row = { label: MONTH_NAMES[i - 1], hasData: !!rec };
    fieldKeys.forEach(k => { row[k] = rec ? (Number(rec[k]) || 0) : 0; });
    rows.push(row);
  }
  return { year, rows };
}

// config = { title, columns: [{key,label,format?}], datasets: [{key,label,color}], chartType }
function openDetailModal(config) {
  detailModalTitle.textContent = config.title;

  const headCells = ["Month", ...config.columns.map(c => c.label)];
  detailModalTableHead.innerHTML = `<tr>${headCells.map(h => `<th>${h}</th>`).join("")}</tr>`;

  detailModalTableBody.innerHTML = config.rows.map(row => {
    const cells = config.columns.map(c => {
      if (!row.hasData) return "<td>—</td>";
      const val = c.format ? c.format(row) : (row[c.key] ?? 0).toLocaleString();
      return `<td>${val}</td>`;
    }).join("");
    return `<tr><td>${row.label}</td>${cells}</tr>`;
  }).join("");

  if (config.footer) {
    detailModalTableBody.innerHTML += `<tr class="detail-footer-row"><td>${config.footer.label}</td>${
      config.footer.cells.map(c => `<td>${c}</td>`).join("")}</tr>`;
  }
  detailModal.querySelector(".modal-box").classList.toggle("modal-wide", !!config.wide);

  const ctx = document.getElementById("detailModalChart").getContext("2d");
  if (detailChart) detailChart.destroy();
  detailChart = new Chart(ctx, {
    type: config.chartType || "bar",
    data: {
      labels: config.rows.map(r => r.label.slice(0, 3)),
      datasets: config.datasets.map(d => ({
        label: d.label,
        data: config.rows.map(r => r[d.key]),
        backgroundColor: d.color,
        borderColor: d.color,
        borderRadius: config.chartType === "line" ? undefined : 3,
        tension: config.chartType === "line" ? 0.3 : undefined
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { size: 11.5 } } }, datalabels: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  });

  detailModal.style.display = "flex";
}

// ── Leave Consumption detail ────────────────────────────────
const leavePanel = document.getElementById("leavePanel");
leavePanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, ["monthElPlan", "monthElActual"]);
  rows.forEach(r => { r.pct = r.monthElPlan > 0 ? Math.round((r.monthElActual / r.monthElPlan) * 1000) / 10 : 0; });
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Leave Consumption — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "monthElPlan", label: "Plan" },
      { key: "monthElActual", label: "Actual" },
      { key: "pct", label: "%", format: r => r.pct + "%" }
    ],
    datasets: [
      { key: "monthElPlan", label: "Plan", color: "#a9c4e8" },
      { key: "monthElActual", label: "Actual", color: "#3b6fae" }
    ],
    chartType: "bar"
  });
});

// ── Sick Leave detail ────────────────────────────────────────
const sickPanel = document.getElementById("sickPanel");
sickPanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, ["monthSickDays", "monthSickEmployees", "monthHeadcount"]);
  rows.forEach(r => { r.pct = r.monthHeadcount > 0 ? Math.round((r.monthSickEmployees / r.monthHeadcount) * 1000) / 10 : 0; });
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Sick Leave — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "monthSickDays", label: "Sick Days" },
      { key: "monthSickEmployees", label: "Employees" },
      { key: "monthHeadcount", label: "Headcount" },
      { key: "pct", label: "%", format: r => r.pct + "%" }
    ],
    datasets: [
      { key: "monthSickDays", label: "Sick Days", color: "#DB9A2C" }
    ],
    chartType: "bar"
  });
});

// ── Present % detail ─────────────────────────────────────────
const presentPanel = document.getElementById("presentPanel");
presentPanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, [
    "presentTotalEmployees", "presentTotalPresent", "presentSewingTotal", "presentSewingPresent"
  ]);
  rows.forEach(r => {
    r.overallPct = r.presentTotalEmployees > 0 ? Math.round((r.presentTotalPresent / r.presentTotalEmployees) * 1000) / 10 : 0;
    r.sewingPct = r.presentSewingTotal > 0 ? Math.round((r.presentSewingPresent / r.presentSewingTotal) * 1000) / 10 : 0;
  });
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Present % — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "overallPct", label: "Overall %", format: r => r.overallPct + "%" },
      { key: "sewingPct", label: "Sewing %", format: r => r.sewingPct + "%" },
      { key: "presentTotalEmployees", label: "Total Employees" },
      { key: "presentSewingTotal", label: "Sewing Headcount" }
    ],
    datasets: [
      { key: "overallPct", label: "Overall %", color: "#16A34A" },
      { key: "sewingPct", label: "Sewing %", color: "#86EFAC" }
    ],
    chartType: "line"
  });
});

// ── Injuries detail ──────────────────────────────────────────
const injuriesPanel = document.getElementById("injuriesPanel");
injuriesPanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, ["injuriesTotal", "injuriesCritical"]);
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Injuries — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "injuriesTotal", label: "Total" },
      { key: "injuriesCritical", label: "Critical" }
    ],
    datasets: [
      { key: "injuriesTotal", label: "Total", color: "#E11D48" },
      { key: "injuriesCritical", label: "Critical", color: "#7F1D1D" }
    ],
    chartType: "bar"
  });
});

// ── Direct Manpower detail ───────────────────────────────────
const directPanel = document.getElementById("directPanel");
directPanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, ["directManpower", "closingManpower"]);
  rows.forEach(r => {
    r.directPct = r.closingManpower > 0 && r.directManpower > 0 ? Math.round((r.directManpower / r.closingManpower) * 1000) / 10 : 0;
  });
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Direct Manpower — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "directManpower", label: "Direct" },
      { key: "closingManpower", label: "Total" },
      { key: "directPct", label: "Direct %", format: r => r.directPct + "%" }
    ],
    datasets: [
      { key: "directPct", label: "Direct %", color: "#4F46E5" }
    ],
    chartType: "line"
  });
});

// ── Manpower Excess / (Shortage) detail ──────────────────────
const shortagePanel = document.getElementById("shortagePanel");
shortagePanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, [
    "shortageStdOperator", "shortageStdHelper", "shortageActualOperator", "shortageActualHelper"
  ]);
  rows.forEach(r => {
    const f = shortageFor(r);
    r.sf = f;
    r.opDiffC = f.has ? f.opDiff : 0;
    r.helperDiffC = f.has ? f.helperDiff : 0;
  });
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Excess / (Shortage), Sewing Worker — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "std", label: "Standard", format: r => r.sf.stdTotal.toLocaleString() },
      { key: "act", label: "Actual", format: r => r.sf.actTotal.toLocaleString() },
      { key: "opDiffC", label: "Operator", format: r => r.sf.has ? fmtSigned(r.sf.opDiff) : "–" },
      { key: "helperDiffC", label: "Helper", format: r => r.sf.has ? fmtSigned(r.sf.helperDiff) : "–" },
      { key: "total", label: "Total", format: r => r.sf.has ? fmtSigned(r.sf.diff) : "–" }
    ],
    datasets: [
      { key: "opDiffC", label: "Operator", color: "#EA580C" },
      { key: "helperDiffC", label: "Helper", color: "#FDBA74" }
    ],
    chartType: "bar"
  });
});

// ── Manpower detail (table of everything entered, with Average row) ──
const manpowerPanel = document.getElementById("manpowerPanel");
manpowerPanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, [
    "workerManpower", "nonWorkerManpower", "closingManpower",
    "sewingOperatorManpower", "sewingHelperManpower", "externalManpower"
  ]);
  rows.forEach(r => { r.totalMp = r.closingManpower > 0 ? r.closingManpower : r.workerManpower + r.nonWorkerManpower; });

  const dash = key => r => r[key] > 0 ? r[key].toLocaleString() : "–";
  const avgOf = key => {
    const vals = rows.map(r => r[key]).filter(v => v > 0);
    return vals.length ? fmtAvg(vals.reduce((a, b) => a + b, 0) / vals.length) : "–";
  };
  const columns = [
    { key: "totalMp", label: "Total (W+NW)" },
    { key: "workerManpower", label: "Worker (W)" },
    { key: "nonWorkerManpower", label: "Non-Worker (NW)" },
    { key: "sewingOperatorManpower", label: "Sewing Operator" },
    { key: "sewingHelperManpower", label: "Sewing Helper" },
    { key: "externalManpower", label: "External" }
  ].map(c => ({ ...c, format: dash(c.key) }));

  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Manpower — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns,
    footer: { label: "Average", cells: columns.map(c => avgOf(c.key)) },
    datasets: [
      { key: "workerManpower", label: "Worker (W)", color: "#2A56C6" },
      { key: "nonWorkerManpower", label: "Non-Worker (NW)", color: "#9DB4EC" }
    ],
    chartType: "bar",
    wide: true
  });
});

// ── Employees Feedback Received detail ──────────────────────
const feedbackPanel = document.getElementById("feedbackPanel");
feedbackPanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, ["feedbackExternal", "feedbackInternal", "feedbackTotal"]);
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Employees Feedback Received — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "feedbackExternal", label: "External" },
      { key: "feedbackInternal", label: "Internal" },
      { key: "feedbackTotal", label: "Total" }
    ],
    datasets: [
      { key: "feedbackExternal", label: "External", color: "#7C5CFC" },
      { key: "feedbackInternal", label: "Internal", color: "#C4B5FD" }
    ],
    chartType: "bar"
  });
});

function syncUrl(siteId, periodId) {
  const params = new URLSearchParams();
  params.set("site", siteId);
  params.set("period", periodId);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

siteSelect.addEventListener("change", async () => {
  currentSiteId = siteSelect.value;
  await loadReportsForSite(currentSiteId);
  await loadDisciplinarySummary(currentSiteId);
});

periodSelect.addEventListener("change", () => {
  render(currentSiteId, periodSelect.value);
});

// ── Full-screen presentation mode ────────────────────────────
const fullscreenBtn = document.getElementById("fullscreenBtn");

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(err => console.error(err));
  } else {
    document.exitFullscreen?.();
  }
}

if (!document.fullscreenEnabled) fullscreenBtn.style.display = "none";
fullscreenBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  document.body.classList.toggle("is-fullscreen", !!document.fullscreenElement);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "f" && e.key !== "F") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
  if (detailModal.style.display === "flex") return;
  toggleFullscreen();
});

setState("Loading dashboard…");
loadSites().catch(err => {
  console.error(err);
  setState("Could not load data. Check the Firebase config in js/firebase-config.js and your Firestore security rules.");
});
