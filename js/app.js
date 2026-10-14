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
  applyStage();
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
    stdTotal, actTotal, has,
    opDiff: actOp - stdOp,
    helperDiff: actHelper - stdHelper,
    diff: actTotal - stdTotal
  };
}

function setBarWidth(barId, pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const bar = document.getElementById(barId);
  requestAnimationFrame(() => { bar.style.width = `${clamped}%`; });
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

  // ── Direct Manpower ──────────────────────────────────────────
  // Direct % = direct ÷ total (closing) manpower, so it depends on Total Manpower being entered.
  const directCount = Number(current.directManpower) || 0;
  const directPct = closingManpower > 0 ? Math.round((directCount / closingManpower) * 1000) / 10 : null;
  const directPcts = Object.keys(reportsById)
    .filter(id => (!year || periodYear(id) === year) && id <= periodId)
    .map(id => {
      const r = reportsById[id];
      const tot = Number(r.closingManpower) || 0;
      const dir = Number(r.directManpower) || 0;
      return tot > 0 && dir > 0 ? (dir / tot) * 100 : null;
    })
    .filter(v => v !== null);
  const directYtdAvg = directPcts.length
    ? Math.round((directPcts.reduce((a, b) => a + b, 0) / directPcts.length) * 10) / 10
    : null;

  document.getElementById("directBigPct").textContent = directPct === null ? "–" : `${directPct}%`;
  document.getElementById("directCount").textContent = directCount.toLocaleString();
  document.getElementById("directTotal").textContent = closingManpower > 0 ? closingManpower.toLocaleString() : "–";
  document.getElementById("directYtdAvg").textContent = directYtdAvg === null ? "–" : `${directYtdAvg}%`;
  setBarWidth("directBar", directPct || 0);

  // ── Manpower Excess / (Shortage) — Sewing Worker (Operator + Helper) ─
  const sf = shortageFor(current);
  const shortageDiffs = Object.keys(reportsById)
    .filter(id => (!year || periodYear(id) === year) && id <= periodId)
    .map(id => shortageFor(reportsById[id]))
    .filter(r => r.has)
    .map(r => r.diff);
  const shortageYtdAvg = shortageDiffs.length
    ? Math.round(shortageDiffs.reduce((a, b) => a + b, 0) / shortageDiffs.length)
    : null;

  const setSigned = (id, value) => {
    const el = document.getElementById(id);
    el.textContent = fmtSigned(value);
    el.classList.toggle("negative", value !== null && value < 0);
  };
  setSigned("shortageBigNum", sf.has ? sf.diff : null);
  setSigned("shortageOperator", sf.has ? sf.opDiff : null);
  setSigned("shortageHelper", sf.has ? sf.helperDiff : null);
  setSigned("shortageYtdAvg", shortageYtdAvg);
  document.getElementById("shortageLabel").textContent =
    !sf.has ? "Enter standard & actual in Admin"
    : sf.diff < 0 ? "Shortage this month"
    : sf.diff > 0 ? "Excess this month" : "On target this month";
  document.getElementById("shortageStandard").textContent = sf.stdTotal > 0 ? sf.stdTotal.toLocaleString() : "–";
  document.getElementById("shortageActual").textContent = sf.actTotal > 0 ? sf.actTotal.toLocaleString() : "–";

  // ── Employees Feedback Received ─────────────────────────────
  const feedbackExternal = Number(current.feedbackExternal) || 0;
  const feedbackInternal = Number(current.feedbackInternal) || 0;
  const feedbackTotal = Number(current.feedbackTotal) || (feedbackExternal + feedbackInternal);
  const ytdFeedbackTotal = ytdSum(periodId, "feedbackTotal");

  document.getElementById("feedbackExternal").textContent = feedbackExternal.toLocaleString();
  document.getElementById("feedbackInternal").textContent = feedbackInternal.toLocaleString();
  document.getElementById("feedbackYtdTotal").textContent = ytdFeedbackTotal.toLocaleString();
  document.getElementById("feedbackBigNum").textContent = feedbackTotal.toLocaleString();

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
  let grandActions = 0, grandEmployees = 0;
  departments.forEach(d => {
    const v = deptData[d.key] || {};
    grandActions += (Number(v.worker) || 0) + (Number(v.nonWorker) || 0);
    grandEmployees += Number(v.employees) || 0;
  });
  const grandPct = grandEmployees > 0 ? Math.round((grandActions / grandEmployees) * 1000) / 10 : 0;

  document.getElementById("discGrandActions").textContent = grandActions.toLocaleString();
  document.getElementById("discGrandPct").textContent = `${grandPct}%`;
  document.getElementById("discPeriodLabel").textContent = data.periodLabel || "No summary period set yet";
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
  await loadDisciplinarySummary(currentSiteId);
});

periodSelect.addEventListener("change", () => {
  render(currentSiteId, periodSelect.value);
});

// ── One-page "slide" view + full-screen presentation mode ────
// The card grid is laid out on a fixed 1600x960 stage and scaled to fit the window,
// so everything shows on one screen with no scrolling. Windows too small to read it
// (or narrow phones) keep the normal scrolling layout — except in full screen, which
// always uses the stage.
const STAGE_W = 1600, STAGE_H = 960, STAGE_MARGIN = 12;
const STAGE_MIN_SCALE = 0.62, STAGE_MAX_SCALE = 2.5, STAGE_MIN_WIDTH = 900;
const topbarEl = document.querySelector(".hs-topbar");
const fullscreenBtn = document.getElementById("fullscreenBtn");

function applyStage() {
  const isFs = !!document.fullscreenElement;
  document.body.classList.toggle("is-fullscreen", isFs);

  const availW = window.innerWidth - STAGE_MARGIN * 2;
  const availH = window.innerHeight - topbarEl.offsetHeight - STAGE_MARGIN * 2;
  const scale = Math.min(availW / STAGE_W, availH / STAGE_H, STAGE_MAX_SCALE);
  const useStage = window.innerWidth >= STAGE_MIN_WIDTH && (isFs || scale >= STAGE_MIN_SCALE);
  document.body.classList.toggle("stage-mode", useStage);

  if (useStage) {
    const offset = STAGE_MARGIN + Math.max(0, (availH - STAGE_H * scale) / 2);
    topicsWrap.style.setProperty("--stage-scale", scale.toFixed(4));
    topicsWrap.style.setProperty("--stage-offset", `${offset.toFixed(1)}px`);
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(err => console.error(err));
  } else {
    document.exitFullscreen?.();
  }
}

if (!document.fullscreenEnabled) fullscreenBtn.style.display = "none";
fullscreenBtn.addEventListener("click", toggleFullscreen);
window.addEventListener("resize", applyStage);
document.addEventListener("fullscreenchange", applyStage);
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
