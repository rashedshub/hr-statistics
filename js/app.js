import { firebaseConfig } from "./firebase-config.js";
import { DEPARTMENTS, LETTER_TYPES } from "./schema.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const siteSelect = document.getElementById("siteSelect");
const periodSelect = document.getElementById("periodSelect");
const stateMsg = document.getElementById("stateMsg");
const topicsWrap = document.getElementById("topicsWrap");

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
  const snap = await getDocs(query(collection(db, "sites"), orderBy("name")));
  sites = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (sites.length === 0) {
    setState("No plants yet. Go to Admin to add your first plant and monthly report.");
    return;
  }

  siteSelect.innerHTML = sites.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  const params = new URLSearchParams(location.search);
  const wanted = params.get("site");
  currentSiteId = sites.some(s => s.id === wanted) ? wanted : sites[0].id;
  siteSelect.value = currentSiteId;

  await loadReportsForSite(currentSiteId, params.get("period"));
}

function currentPeriodId() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Always prefer the real current month; if no data has been entered for it yet,
// fall back to the most recent month at or before now that does have data;
// only if nothing qualifies do we fall back to whatever's newest overall.
function pickDefaultPeriod(periods, wantedFromUrl) {
  if (wantedFromUrl && periods.includes(wantedFromUrl)) return wantedFromUrl;
  const nowId = currentPeriodId();
  if (periods.includes(nowId)) return nowId;
  const upToNow = periods.filter(p => p <= nowId).sort();
  if (upToNow.length) return upToNow[upToNow.length - 1];
  return periods[0];
}

async function loadReportsForSite(siteId, wantedPeriod) {
  setState("Loading…");
  const snap = await getDocs(collection(db, "sites", siteId, "reports"));
  reportsById = {};
  snap.docs.forEach(d => { reportsById[d.id] = d.data(); });

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

function periodYear(periodId) {
  const m = /^(\d{4})-(\d{2})$/.exec(periodId);
  return m ? m[1] : null;
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

function render(siteId, periodId) {
  const current = reportsById[periodId] || {};

  // ── Leave Consumption ──────────────────────────────────────
  const totalElPlan = Number(current.totalElPlan) || 0;
  const monthElPlan = Number(current.monthElPlan) || 0;
  const monthElActual = Number(current.monthElActual) || 0;
  const ytdElActual = ytdSum(periodId, "monthElActual");

  const monthPct = monthElPlan > 0 ? Math.round((monthElActual / monthElPlan) * 1000) / 10 : 0;
  const ytdPct = totalElPlan > 0 ? Math.round((ytdElActual / totalElPlan) * 1000) / 10 : 0;

  document.getElementById("leaveTotalPlan").textContent = totalElPlan.toLocaleString();
  document.getElementById("leaveMonthActual").textContent = monthElActual.toLocaleString();
  document.getElementById("leaveYtdActual").textContent = ytdElActual.toLocaleString();
  setBar("leaveMonthBar", "leaveMonthPct", monthPct);
  setBar("leaveYtdBar", "leaveYtdPct", ytdPct);

  // ── Sick Leave ──────────────────────────────────────────────
  const monthSickDays = Number(current.monthSickDays) || 0;
  const monthSickEmployees = Number(current.monthSickEmployees) || 0;
  const monthHeadcount = Number(current.monthHeadcount) || 0;
  const ytdSickDays = ytdSum(periodId, "monthSickDays");
  const sickPct = monthHeadcount > 0 ? Math.round((monthSickEmployees / monthHeadcount) * 1000) / 10 : 0;

  document.getElementById("sickMonthDays").textContent = monthSickDays.toLocaleString();
  document.getElementById("sickYtdDays").textContent = ytdSickDays.toLocaleString();
  document.getElementById("sickPct").textContent = `${sickPct}%`;

  // ── Total Manpower ──────────────────────────────────────────
  const workerManpower = Number(current.workerManpower) || 0;
  const nonWorkerManpower = Number(current.nonWorkerManpower) || 0;
  const closingManpower = Number(current.closingManpower) || (workerManpower + nonWorkerManpower);
  const year = periodYear(periodId);
  let prevManpower = null;
  if (year) {
    const monthNum = parseInt(periodId.slice(5, 7), 10);
    if (monthNum > 1) {
      const prevId = `${year}-${String(monthNum - 1).padStart(2, "0")}`;
      if (reportsById[prevId]) prevManpower = Number(reportsById[prevId].closingManpower) || 0;
    }
  }
  let ytdIds = Object.keys(reportsById);
  if (year) ytdIds = ytdIds.filter(id => periodYear(id) === year);
  ytdIds = ytdIds.filter(id => id <= periodId && Number(reportsById[id].closingManpower) > 0);
  const ytdAvg = ytdIds.length
    ? Math.round(ytdIds.reduce((sum, id) => sum + Number(reportsById[id].closingManpower), 0) / ytdIds.length)
    : 0;

  document.getElementById("manpowerWorker").textContent = workerManpower.toLocaleString();
  document.getElementById("manpowerNonWorker").textContent = nonWorkerManpower.toLocaleString();
  document.getElementById("manpowerPrevMonth").textContent = prevManpower === null ? "—" : prevManpower.toLocaleString();
  document.getElementById("manpowerYtdAvg").textContent = ytdAvg.toLocaleString();
  document.getElementById("manpowerBigNum").textContent = closingManpower.toLocaleString();

  // ── Employees Feedback Received ─────────────────────────────
  const feedbackExternal = Number(current.feedbackExternal) || 0;
  const feedbackInternal = Number(current.feedbackInternal) || 0;
  const feedbackTotal = Number(current.feedbackTotal) || (feedbackExternal + feedbackInternal);
  const ytdFeedbackTotal = ytdSum(periodId, "feedbackTotal");

  document.getElementById("feedbackExternal").textContent = feedbackExternal.toLocaleString();
  document.getElementById("feedbackInternal").textContent = feedbackInternal.toLocaleString();
  document.getElementById("feedbackYtdTotal").textContent = ytdFeedbackTotal.toLocaleString();
  document.getElementById("feedbackBigNum").textContent = feedbackTotal.toLocaleString();

  // ── Disciplinary Action (card summary — detail is in the modal) ─
  const deptData = current.disciplinaryDept || {};
  let grandActions = 0, grandEmployees = 0;
  DEPARTMENTS.forEach(d => {
    const v = deptData[d.key] || {};
    grandActions += Number(v.actions) || 0;
    grandEmployees += Number(v.employees) || 0;
  });
  const grandPct = grandEmployees > 0 ? Math.round((grandActions / grandEmployees) * 1000) / 10 : 0;
  const prod = deptData["production"] || {};
  const prodActions = Number(prod.actions) || 0;
  const prodEmployees = Number(prod.employees) || 0;
  const prodPct = prodEmployees > 0 ? Math.round((prodActions / prodEmployees) * 1000) / 10 : 0;

  document.getElementById("discGrandActions").textContent = grandActions.toLocaleString();
  document.getElementById("discGrandPct").textContent = `${grandPct}%`;
  document.getElementById("discGrandEmployees").textContent = grandEmployees.toLocaleString();
  document.getElementById("discProductionActions").textContent = prodActions.toLocaleString();
  document.getElementById("discProductionPct").textContent = `${prodPct}%`;

  drawDisciplinaryCharts(deptData, current.disciplinaryLetter || {});

  syncUrl(siteId, periodId);
}

function setBar(barId, labelId, pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const bar = document.getElementById(barId);
  const label = document.getElementById(labelId);
  label.textContent = `${pct}%`;
  requestAnimationFrame(() => { bar.style.width = `${clamped}%`; });
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

// ── Total Manpower detail ───────────────────────────────────
const manpowerPanel = document.getElementById("manpowerPanel");
manpowerPanel.addEventListener("click", () => {
  const { year, rows } = buildMonthRows(periodSelect.value, ["workerManpower", "nonWorkerManpower", "closingManpower"]);
  const siteName = sites.find(s => s.id === currentSiteId)?.name || "";
  openDetailModal({
    title: `Total Manpower — ${siteName}${year ? " " + year : ""}`,
    rows,
    columns: [
      { key: "workerManpower", label: "Worker" },
      { key: "nonWorkerManpower", label: "Non-Worker" },
      { key: "closingManpower", label: "Total" }
    ],
    datasets: [
      { key: "workerManpower", label: "Worker", color: "#3b6fae" },
      { key: "nonWorkerManpower", label: "Non-Worker", color: "#e8b23b" }
    ],
    chartType: "bar"
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

// ── Disciplinary Action charts (inline, always visible — YTD figures) ──
Chart.register(ChartDataLabels);
let discCharts = {};

const DEPT_COLORS = ["#2A56C6", "#0F9E90", "#DB9A2C", "#7C5CFC", "#2E8FA3", "#D8514F", "#1FA971"];
const TYPE_COLORS = ["#D8514F", "#DB9A2C", "#7C5CFC", "#2E8FA3", "#2A56C6", "#0F9E90", "#93A1B5"];

function destroyDiscChart(key) {
  if (discCharts[key]) { discCharts[key].destroy(); delete discCharts[key]; }
}

function drawDisciplinaryCharts(deptData, letterData) {
  const deptLabels = DEPARTMENTS.map(d => d.name);
  const deptActions = DEPARTMENTS.map(d => Number((deptData[d.key] || {}).actions) || 0);
  const deptRates = DEPARTMENTS.map(d => {
    const v = deptData[d.key] || {};
    const actions = Number(v.actions) || 0, emp = Number(v.employees) || 0;
    return emp > 0 ? Math.round((actions / emp) * 1000) / 10 : 0;
  });

  destroyDiscChart("dept");
  discCharts.dept = new Chart(document.getElementById("discDeptPieChart").getContext("2d"), {
    type: "pie",
    data: { labels: deptLabels, datasets: [{ data: deptActions, backgroundColor: DEPT_COLORS }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { font: { size: 10.5 }, boxWidth: 11 } },
        datalabels: {
          color: "#fff", font: { weight: 700, size: 10.5 },
          formatter: v => v > 0 ? v : ""
        }
      }
    }
  });

  destroyDiscChart("rate");
  discCharts.rate = new Chart(document.getElementById("discDeptRateBarChart").getContext("2d"), {
    type: "bar",
    data: { labels: deptLabels, datasets: [{ label: "% receiving action", data: deptRates, backgroundColor: "#2A56C6", borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: "top", color: "#16233A", font: { weight: 700, size: 10.5 },
          formatter: v => v > 0 ? v + "%" : ""
        }
      },
      layout: { padding: { top: 16 } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => v + "%" } },
        x: { ticks: { font: { size: 9.5 } } }
      }
    }
  });

  const letterLabels = LETTER_TYPES.map(t => t.name);
  const nonWorkerCounts = LETTER_TYPES.map(t => Number((letterData[t.key] || {}).nonWorker) || 0);
  const workerCounts = LETTER_TYPES.map(t => Number((letterData[t.key] || {}).worker) || 0);
  const pieLabelPlugin = { color: "#fff", font: { weight: 700, size: 9.5 }, formatter: v => v > 0 ? v : "" };

  destroyDiscChart("typeNonWorker");
  discCharts.typeNonWorker = new Chart(document.getElementById("discTypeNonWorkerPieChart").getContext("2d"), {
    type: "pie",
    data: { labels: letterLabels, datasets: [{ data: nonWorkerCounts, backgroundColor: TYPE_COLORS }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, datalabels: pieLabelPlugin }
    }
  });

  destroyDiscChart("typeWorker");
  discCharts.typeWorker = new Chart(document.getElementById("discTypeWorkerPieChart").getContext("2d"), {
    type: "pie",
    data: { labels: letterLabels, datasets: [{ data: workerCounts, backgroundColor: TYPE_COLORS }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 9 }, boxWidth: 9 } },
        datalabels: pieLabelPlugin
      }
    }
  });

  const totalNonWorker = nonWorkerCounts.reduce((a, b) => a + b, 0);
  const totalWorker = workerCounts.reduce((a, b) => a + b, 0);
  const totalBoth = totalNonWorker + totalWorker;
  const nonWorkerShare = totalBoth > 0 ? Math.round((totalNonWorker / totalBoth) * 1000) / 10 : 0;
  const workerShare = totalBoth > 0 ? Math.round((totalWorker / totalBoth) * 1000) / 10 : 0;

  destroyDiscChart("workerVsNonWorker");
  discCharts.workerVsNonWorker = new Chart(document.getElementById("discWorkerVsNonWorkerBarChart").getContext("2d"), {
    type: "bar",
    data: { labels: ["Non-Worker", "Worker"], datasets: [{ data: [nonWorkerShare, workerShare], backgroundColor: ["#93A1B5", "#2A56C6"], borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: "top", color: "#16233A", font: { weight: 700, size: 11 },
          formatter: v => v > 0 ? v + "%" : ""
        }
      },
      layout: { padding: { top: 16 } },
      scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } } }
    }
  });
}

function syncUrl(siteId, periodId) {
  const params = new URLSearchParams();
  params.set("site", siteId);
  params.set("period", periodId);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

siteSelect.addEventListener("change", async () => {
  currentSiteId = siteSelect.value;
  await loadReportsForSite(currentSiteId);
});

periodSelect.addEventListener("change", () => {
  render(currentSiteId, periodSelect.value);
});

setState("Loading dashboard…");
loadSites().catch(err => {
  console.error(err);
  setState("Could not load data. Check the Firebase config in js/firebase-config.js and your Firestore security rules.");
});
