import { departmentsForSite, LETTER_TYPES } from "./schema.js";
import { db, escapeHtml, loadSitesList } from "./dashboard-shared.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const siteSelect = document.getElementById("siteSelect");
const stateMsg = document.getElementById("stateMsg");
const discPageWrap = document.getElementById("discPageWrap");
const discPeriodSubtitle = document.getElementById("discPeriodSubtitle");

let sites = [];
let currentSiteId = null;

// Standard modern categorical palette — used consistently across every chart on this page.
const PALETTE = ["#2563EB", "#0EA5A5", "#F59E0B", "#8B5CF6", "#EC4899", "#10B981", "#64748B", "#F97316"];

function setState(msg) {
  if (msg) {
    stateMsg.textContent = msg;
    stateMsg.style.display = "block";
    discPageWrap.style.display = "none";
  } else {
    stateMsg.style.display = "none";
    discPageWrap.style.display = "block";
  }
}

async function loadSites() {
  sites = await loadSitesList();

  if (sites.length === 0) {
    setState("No plants yet. Go to Admin to add your first plant.");
    return;
  }

  siteSelect.innerHTML = sites.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  const params = new URLSearchParams(location.search);
  const wanted = params.get("site");
  currentSiteId = sites.some(s => s.id === wanted) ? wanted : sites[0].id;
  siteSelect.value = currentSiteId;

  await loadAndRender(currentSiteId);
}

async function loadAndRender(siteId) {
  setState("Loading…");

  const siteName = sites.find(s => s.id === siteId)?.name || "";
  let data = {};
  try {
    const snap = await getDoc(doc(db, "sites", siteId, "meta", "disciplinary"));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    console.error(err);
    setState("Could not load data. Check the Firebase config and your Firestore security rules.");
    return;
  }

  render(siteName, data);
  syncUrl(siteId);
  setState(null);
}

function render(siteName, data) {
  const departments = departmentsForSite(siteName);
  const deptData = data.disciplinaryDept || {};
  const letterData = data.disciplinaryLetter || {};

  discPeriodSubtitle.textContent = data.periodLabel
    ? `Summary period: ${data.periodLabel}`
    : "No summary period set yet — add one from Admin.";

  let grandWorker = 0, grandNonWorker = 0, grandEmployees = 0;
  departments.forEach(d => {
    const v = deptData[d.key] || {};
    grandWorker += Number(v.worker) || 0;
    grandNonWorker += Number(v.nonWorker) || 0;
    grandEmployees += Number(v.employees) || 0;
  });
  const grandActions = grandWorker + grandNonWorker;
  const grandPct = grandEmployees > 0 ? Math.round((grandActions / grandEmployees) * 1000) / 10 : 0;
  const prod = deptData["production"] || {};
  const prodActions = (Number(prod.worker) || 0) + (Number(prod.nonWorker) || 0);
  const prodEmployees = Number(prod.employees) || 0;
  const prodPct = prodEmployees > 0 ? Math.round((prodActions / prodEmployees) * 1000) / 10 : 0;

  document.getElementById("discGrandActions").textContent = grandActions.toLocaleString();
  document.getElementById("discGrandPct").textContent = `${grandPct}%`;
  document.getElementById("discGrandEmployees").textContent = grandEmployees.toLocaleString();
  document.getElementById("discGrandWorker").textContent = grandWorker.toLocaleString();
  document.getElementById("discGrandNonWorker").textContent = grandNonWorker.toLocaleString();
  document.getElementById("discProductionActions").textContent = prodActions.toLocaleString();
  document.getElementById("discProductionPct").textContent = `${prodPct}%`;

  drawDeptTable(departments, deptData);
  drawCharts(departments, deptData, letterData);
}

function drawDeptTable(departments, deptData) {
  const rows = departments.map(d => {
    const v = deptData[d.key] || {};
    const worker = Number(v.worker) || 0;
    const nonWorker = Number(v.nonWorker) || 0;
    const employees = Number(v.employees) || 0;
    const total = worker + nonWorker;
    const pct = employees > 0 ? Math.round((total / employees) * 1000) / 10 : 0;
    return { name: d.name, worker, nonWorker, total, employees, pct };
  });
  const grand = rows.reduce((acc, r) => ({
    worker: acc.worker + r.worker, nonWorker: acc.nonWorker + r.nonWorker,
    total: acc.total + r.total, employees: acc.employees + r.employees
  }), { worker: 0, nonWorker: 0, total: 0, employees: 0 });
  const grandPct = grand.employees > 0 ? Math.round((grand.total / grand.employees) * 1000) / 10 : 0;

  const body = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${r.worker.toLocaleString()}</td>
      <td>${r.nonWorker.toLocaleString()}</td>
      <td>${r.total.toLocaleString()}</td>
      <td>${r.employees.toLocaleString()}</td>
      <td>${r.pct}%</td>
    </tr>`).join("");
  const footer = `
    <tr style="font-weight:700;border-top:2px solid var(--line);">
      <td>Grand Total</td>
      <td>${grand.worker.toLocaleString()}</td>
      <td>${grand.nonWorker.toLocaleString()}</td>
      <td>${grand.total.toLocaleString()}</td>
      <td>${grand.employees.toLocaleString()}</td>
      <td>${grandPct}%</td>
    </tr>`;

  document.getElementById("discDeptTableBody").innerHTML = body + footer;
}

// ── Charts ──────────────────────────────────────────────────
Chart.register(ChartDataLabels);
let charts = {};

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function drawCharts(departments, deptData, letterData) {
  const deptLabels = departments.map(d => d.name);
  const deptActions = departments.map(d => {
    const v = deptData[d.key] || {};
    return (Number(v.worker) || 0) + (Number(v.nonWorker) || 0);
  });
  const deptRates = departments.map(d => {
    const v = deptData[d.key] || {};
    const total = (Number(v.worker) || 0) + (Number(v.nonWorker) || 0);
    const emp = Number(v.employees) || 0;
    return emp > 0 ? Math.round((total / emp) * 1000) / 10 : 0;
  });

  destroyChart("dept");
  charts.dept = new Chart(document.getElementById("discDeptPieChart").getContext("2d"), {
    type: "pie",
    data: { labels: deptLabels, datasets: [{ data: deptActions, backgroundColor: PALETTE, borderWidth: 2, borderColor: "#fff" }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { font: { size: 13 }, boxWidth: 13, padding: 16 } },
        datalabels: { color: "#fff", font: { weight: 700, size: 13 }, formatter: v => v > 0 ? v : "" }
      }
    }
  });

  destroyChart("rate");
  charts.rate = new Chart(document.getElementById("discDeptRateBarChart").getContext("2d"), {
    type: "bar",
    data: { labels: deptLabels, datasets: [{ label: "% receiving action", data: deptRates, backgroundColor: PALETTE, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor: "end", align: "top", color: "#16233A", font: { weight: 700, size: 12.5 }, formatter: v => v > 0 ? v + "%" : "" }
      },
      layout: { padding: { top: 22 } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => v + "%", font: { size: 12 } }, grid: { color: "#EEF1F5" } },
        x: { ticks: { font: { size: 12 } }, grid: { display: false } }
      }
    }
  });

  const letterLabels = LETTER_TYPES.map(t => t.name);
  const nonWorkerCounts = LETTER_TYPES.map(t => Number((letterData[t.key] || {}).nonWorker) || 0);
  const workerCounts = LETTER_TYPES.map(t => Number((letterData[t.key] || {}).worker) || 0);
  const pieDataLabel = { color: "#fff", font: { weight: 700, size: 12 }, formatter: v => v > 0 ? v : "" };

  destroyChart("typeNonWorker");
  charts.typeNonWorker = new Chart(document.getElementById("discTypeNonWorkerPieChart").getContext("2d"), {
    type: "pie",
    data: { labels: letterLabels, datasets: [{ data: nonWorkerCounts, backgroundColor: PALETTE, borderWidth: 2, borderColor: "#fff" }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11.5 }, boxWidth: 11, padding: 12 } },
        datalabels: pieDataLabel
      }
    }
  });

  destroyChart("typeWorker");
  charts.typeWorker = new Chart(document.getElementById("discTypeWorkerPieChart").getContext("2d"), {
    type: "pie",
    data: { labels: letterLabels, datasets: [{ data: workerCounts, backgroundColor: PALETTE, borderWidth: 2, borderColor: "#fff" }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11.5 }, boxWidth: 11, padding: 12 } },
        datalabels: pieDataLabel
      }
    }
  });

  const totalNonWorker = nonWorkerCounts.reduce((a, b) => a + b, 0);
  const totalWorker = workerCounts.reduce((a, b) => a + b, 0);
  const totalBoth = totalNonWorker + totalWorker;
  const nonWorkerShare = totalBoth > 0 ? Math.round((totalNonWorker / totalBoth) * 1000) / 10 : 0;
  const workerShare = totalBoth > 0 ? Math.round((totalWorker / totalBoth) * 1000) / 10 : 0;

  destroyChart("workerVsNonWorker");
  charts.workerVsNonWorker = new Chart(document.getElementById("discWorkerVsNonWorkerBarChart").getContext("2d"), {
    type: "bar",
    data: { labels: ["Non-Worker", "Worker"], datasets: [{ data: [nonWorkerShare, workerShare], backgroundColor: [PALETTE[6], PALETTE[0]], borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor: "end", align: "top", color: "#16233A", font: { weight: 700, size: 14 }, formatter: v => v > 0 ? v + "%" : "" }
      },
      layout: { padding: { top: 22 } },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%", font: { size: 12 } }, grid: { color: "#EEF1F5" } },
        x: { ticks: { font: { size: 13 } }, grid: { display: false } }
      }
    }
  });
}

function syncUrl(siteId) {
  const params = new URLSearchParams();
  params.set("site", siteId);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

siteSelect.addEventListener("change", async () => {
  currentSiteId = siteSelect.value;
  await loadAndRender(currentSiteId);
});

setState("Loading…");
loadSites().catch(err => {
  console.error(err);
  setState("Could not load data. Check the Firebase config in js/firebase-config.js and your Firestore security rules.");
});
