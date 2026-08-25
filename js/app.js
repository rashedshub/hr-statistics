import { DEPARTMENTS } from "./schema.js";
import { periodYear, pickDefaultPeriod, escapeHtml, loadSitesList, fetchSiteReportsMap } from "./dashboard-shared.js";

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
  currentSiteId = sites.some(s => s.id === wanted) ? wanted : sites[0].id;
  siteSelect.value = currentSiteId;

  await loadReportsForSite(currentSiteId, params.get("period"));
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

  // ── Present % ────────────────────────────────────────────────
  const presentTotalEmployees = Number(current.presentTotalEmployees) || 0;
  const presentTotalPresent = Number(current.presentTotalPresent) || 0;
  const presentSewingTotal = Number(current.presentSewingTotal) || 0;
  const presentSewingPresent = Number(current.presentSewingPresent) || 0;
  const presentOverallPct = presentTotalEmployees > 0 ? Math.round((presentTotalPresent / presentTotalEmployees) * 1000) / 10 : 0;
  const presentSewingPct = presentSewingTotal > 0 ? Math.round((presentSewingPresent / presentSewingTotal) * 1000) / 10 : 0;

  document.getElementById("presentOverallPct").textContent = `${presentOverallPct}%`;
  document.getElementById("presentTotalEmployees").textContent = presentTotalEmployees.toLocaleString();
  document.getElementById("presentTotalPresent").textContent = presentTotalPresent.toLocaleString();
  document.getElementById("presentSewingPct").textContent = `${presentSewingPct}%`;
  document.getElementById("presentSewingPresent").textContent = presentSewingPresent.toLocaleString();

  // ── Injuries ─────────────────────────────────────────────────
  const injuriesTotalMonth = Number(current.injuriesTotal) || 0;
  const injuriesCriticalMonth = Number(current.injuriesCritical) || 0;
  const injuriesYtdTotal = ytdSum(periodId, "injuriesTotal");
  const injuriesYtdCritical = ytdSum(periodId, "injuriesCritical");

  document.getElementById("injuriesTotalBigNum").textContent = injuriesTotalMonth.toLocaleString();
  document.getElementById("injuriesYtdTotal").textContent = injuriesYtdTotal.toLocaleString();
  document.getElementById("injuriesCriticalMonth").textContent = injuriesCriticalMonth.toLocaleString();
  document.getElementById("injuriesYtdCritical").textContent = injuriesYtdCritical.toLocaleString();

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

  // ── Disciplinary Action — lightweight summary + link to its own page ─
  const deptData = current.disciplinaryDept || {};
  let grandActions = 0, grandEmployees = 0;
  DEPARTMENTS.forEach(d => {
    const v = deptData[d.key] || {};
    grandActions += Number(v.actions) || 0;
    grandEmployees += Number(v.employees) || 0;
  });
  const grandPct = grandEmployees > 0 ? Math.round((grandActions / grandEmployees) * 1000) / 10 : 0;

  document.getElementById("discGrandActions").textContent = grandActions.toLocaleString();
  document.getElementById("discGrandPct").textContent = `${grandPct}%`;
  disciplinaryLink.href = `disciplinary.html?site=${encodeURIComponent(siteId)}&period=${encodeURIComponent(periodId)}`;

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

function syncUrl(siteId, periodId) {
  const params = new URLSearchParams();
  params.set("site", siteId);
  params.set("period", periodId);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
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
