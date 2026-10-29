import { firebaseConfig } from "./firebase-config.js";
import { enabledTopics, MONTHS, DEFAULT_DEPARTMENTS, departmentsForSite, LETTER_TYPES, presentPercents, periodIdFor, periodLabelFor } from "./schema.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, query, orderBy, doc, getDoc, setDoc, addDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = String(new Date().getMonth() + 1).padStart(2, "0");
const YEARS = [];
for (let y = CURRENT_YEAR - 2; y <= CURRENT_YEAR + 1; y++) YEARS.push(y);

// ── DOM refs ──────────────────────────────────────────────
const checkingMsg = document.getElementById("checkingMsg");
const adminShell = document.getElementById("adminShell");
const logoutBtn = document.getElementById("logoutBtn");
const roleBanner = document.getElementById("roleBanner");
const plantsPanel = document.getElementById("plantsPanel");
const manageAdminsPanel = document.getElementById("manageAdminsPanel");

// ── Category sidebar nav (click a category, only its panel shows) ─
const adminNavItems = document.querySelectorAll(".admin-nav-item");
const SUPER_ONLY_NAV_TARGETS = ["plantsPanel", "manageAdminsPanel"];

function setupAdminNav() {
  adminNavItems.forEach(btn => {
    const target = btn.dataset.target;
    const restricted = SUPER_ONLY_NAV_TARGETS.includes(target) && currentAdminRole !== "super";
    btn.style.display = restricted ? "none" : "";
    btn.addEventListener("click", () => showAdminPanel(target));
  });

  const firstVisible = [...adminNavItems].find(btn => btn.style.display !== "none");
  if (firstVisible) showAdminPanel(firstVisible.dataset.target);
}

function showAdminPanel(targetId) {
  document.querySelectorAll(".admin-content .admin-panel").forEach(p => p.classList.remove("panel-active"));
  document.getElementById(targetId)?.classList.add("panel-active");
  adminNavItems.forEach(b => b.classList.toggle("active", b.dataset.target === targetId));
  if (targetId === "panelDirectManpower") refreshDirectTotals();
}

const sitesList = document.getElementById("sitesList");
const newSiteName = document.getElementById("newSiteName");
const addSiteBtn = document.getElementById("addSiteBtn");

const newAdminUid = document.getElementById("newAdminUid");
const newAdminLabel = document.getElementById("newAdminLabel");
const newAdminRole = document.getElementById("newAdminRole");
const newAdminSiteWrap = document.getElementById("newAdminSiteWrap");
const newAdminSite = document.getElementById("newAdminSite");
const saveAdminBtn = document.getElementById("saveAdminBtn");
const adminsList = document.getElementById("adminsList");

const leaveSite = document.getElementById("leaveSite");
const leaveYear = document.getElementById("leaveYear");
const leaveTotalPlanDisplay = document.getElementById("leaveTotalPlanDisplay");
const leaveMonthTableBody = document.querySelector("#leaveMonthTable tbody");
const saveLeaveYearBtn = document.getElementById("saveLeaveYearBtn");

const manpowerSite = document.getElementById("manpowerSite");
const manpowerYear = document.getElementById("manpowerYear");
const manpowerMonthTableBody = document.querySelector("#manpowerMonthTable tbody");
const saveManpowerYearBtn = document.getElementById("saveManpowerYearBtn");

const feedbackSite = document.getElementById("feedbackSite");
const feedbackYear = document.getElementById("feedbackYear");
const feedbackMonthTableBody = document.querySelector("#feedbackMonthTable tbody");
const saveFeedbackYearBtn = document.getElementById("saveFeedbackYearBtn");

const presentSite = document.getElementById("presentSite");
const presentYear = document.getElementById("presentYear");
const presentMonthTableBody = document.querySelector("#presentMonthTable tbody");
const savePresentYearBtn = document.getElementById("savePresentYearBtn");

const directSite = document.getElementById("directSite");
const directYear = document.getElementById("directYear");
const directMonthTableBody = document.querySelector("#directMonthTable tbody");
const saveDirectYearBtn = document.getElementById("saveDirectYearBtn");

const shortageSite = document.getElementById("shortageSite");
const shortageYear = document.getElementById("shortageYear");
const shortageMonthTableBody = document.querySelector("#shortageMonthTable tbody");
const saveShortageYearBtn = document.getElementById("saveShortageYearBtn");

const nwElSite = document.getElementById("nwElSite");
const nwElYear = document.getElementById("nwElYear");
const nwElTable = document.getElementById("nwElTable");
const saveNwElYearBtn = document.getElementById("saveNwElYearBtn");

const injuriesSite = document.getElementById("injuriesSite");
const injuriesYear = document.getElementById("injuriesYear");
const injuriesMonthTableBody = document.querySelector("#injuriesMonthTable tbody");
const saveInjuriesYearBtn = document.getElementById("saveInjuriesYearBtn");

const disciplinarySite = document.getElementById("disciplinarySite");
const disciplinaryStartMonth = document.getElementById("disciplinaryStartMonth");
const disciplinaryStartYear = document.getElementById("disciplinaryStartYear");
const disciplinaryEndMonth = document.getElementById("disciplinaryEndMonth");
const disciplinaryEndYear = document.getElementById("disciplinaryEndYear");
const discDeptTableBody = document.querySelector("#disciplinaryDeptTable tbody");
const discLetterTableBody = document.querySelector("#disciplinaryLetterTable tbody");
const saveDisciplinaryBtn = document.getElementById("saveDisciplinaryBtn");

const formSite = document.getElementById("formSite");
const formMonth = document.getElementById("formMonth");
const formYear = document.getElementById("formYear");
const dynamicFormArea = document.getElementById("dynamicFormArea");
const saveReportBtn = document.getElementById("saveReportBtn");
const clearFormBtn = document.getElementById("clearFormBtn");

const reportsSiteFilter = document.getElementById("reportsSiteFilter");
const reportsList = document.getElementById("reportsList");
const toast = document.getElementById("toast");

let sitesCache = [];
let reportsCache = {}; // siteId -> { periodId: data }
let currentAdminRole = null;   // "super" | "site"
let currentAdminSiteId = null; // set when role === "site"

// ── Auth guard ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  if (!adminSnap.exists()) {
    // Signed in with Firebase Auth, but no access has been granted (or it was revoked).
    await signOut(auth);
    window.location.replace("login.html");
    return;
  }

  const adminData = adminSnap.data();
  currentAdminRole = adminData.role;
  currentAdminSiteId = adminData.siteId || null;

  checkingMsg.style.display = "none";
  adminShell.style.display = "block";
  setupAdminNav();

  await refreshSites();
});

logoutBtn.addEventListener("click", () => signOut(auth).then(() => window.location.replace("login.html")));

// ── Static dropdown setup (Month / Year — no typing needed) ─
leaveYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
leaveYear.value = CURRENT_YEAR;
formYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
formYear.value = CURRENT_YEAR;
formMonth.innerHTML = MONTHS.map(m => `<option value="${m.num}">${m.name}</option>`).join("");
formMonth.value = CURRENT_MONTH;
manpowerYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
manpowerYear.value = CURRENT_YEAR;
feedbackYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
feedbackYear.value = CURRENT_YEAR;
presentYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
presentYear.value = CURRENT_YEAR;
injuriesYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
injuriesYear.value = CURRENT_YEAR;
nwElYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
nwElYear.value = CURRENT_YEAR;
directYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
directYear.value = CURRENT_YEAR;
shortageYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
shortageYear.value = CURRENT_YEAR;
const monthOptionsHtml = MONTHS.map(m => `<option value="${m.num}">${m.name}</option>`).join("");
disciplinaryStartMonth.innerHTML = monthOptionsHtml;
disciplinaryStartMonth.value = "07"; // default: July, since that's the common fiscal-year start
disciplinaryStartYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
disciplinaryStartYear.value = CURRENT_YEAR;
disciplinaryEndMonth.innerHTML = monthOptionsHtml;
disciplinaryEndMonth.value = "06";
disciplinaryEndYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
disciplinaryEndYear.value = CURRENT_YEAR + 1;

leaveMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="leaveMonthPlan_${m.num}"></td>
    <td><input type="number" step="any" id="leaveMonthActual_${m.num}"></td>
  </tr>`).join("");

// Manpower entry: Worker / Non-Worker (Total = W + NW) plus Sewing Operator, Sewing Helper, External.
const MANPOWER_INPUTS = ["Worker", "NonWorker", "SewingOp", "SewingHelper", "External"];
const mpVal = (k, num) => Number(document.getElementById(`manpower${k}_${num}`).value) || 0;

manpowerMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><span class="row-total" id="manpowerTotal_${m.num}">–</span></td>
    <td><input type="number" step="any" id="manpowerWorker_${m.num}"></td>
    <td><input type="number" step="any" id="manpowerNonWorker_${m.num}"></td>
    <td><input type="number" step="any" id="manpowerSewingOp_${m.num}"></td>
    <td><input type="number" step="any" id="manpowerSewingHelper_${m.num}"></td>
    <td><input type="number" step="any" id="manpowerExternal_${m.num}"></td>
  </tr>`).join("");

MONTHS.forEach(m => {
  MANPOWER_INPUTS.forEach(k => {
    document.getElementById(`manpower${k}_${m.num}`).addEventListener("input", () => updateManpowerRowTotal(m.num));
  });
});

function fmtAvg(n) {
  if (n === null || n === undefined) return "–";
  return (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString();
}

function updateManpowerRowTotal(num) {
  const total = mpVal("Worker", num) + mpVal("NonWorker", num);
  document.getElementById(`manpowerTotal_${num}`).textContent = total > 0 ? total.toLocaleString() : "–";
  updateManpowerAverages();
  return total;
}

// Average row: mean of the months that have a value (blank / 0 months are skipped).
function updateManpowerAverages() {
  const columns = {
    Total: num => mpVal("Worker", num) + mpVal("NonWorker", num),
    Worker: num => mpVal("Worker", num),
    NonWorker: num => mpVal("NonWorker", num),
    SewingOp: num => mpVal("SewingOp", num),
    SewingHelper: num => mpVal("SewingHelper", num),
    External: num => mpVal("External", num)
  };
  for (const [key, getter] of Object.entries(columns)) {
    const vals = MONTHS.map(m => getter(m.num)).filter(v => v > 0);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    document.getElementById(`manpowerAvg${key}`).textContent = fmtAvg(avg);
  }
}

feedbackMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="feedbackExternal_${m.num}"></td>
    <td><input type="number" step="any" id="feedbackInternal_${m.num}"></td>
    <td><span class="row-total" id="feedbackTotal_${m.num}">0</span></td>
  </tr>`).join("");

MONTHS.forEach(m => {
  const recalc = () => updateFeedbackRowTotal(m.num);
  document.getElementById(`feedbackExternal_${m.num}`).addEventListener("input", recalc);
  document.getElementById(`feedbackInternal_${m.num}`).addEventListener("input", recalc);
});

function updateFeedbackRowTotal(num) {
  const external = Number(document.getElementById(`feedbackExternal_${num}`).value) || 0;
  const internal = Number(document.getElementById(`feedbackInternal_${num}`).value) || 0;
  const total = external + internal;
  document.getElementById(`feedbackTotal_${num}`).textContent = total.toLocaleString();
  return total;
}

// ── Present % — yearly table (percentages typed in directly, like the Excel sheet) ─
const PRESENT_COLS = [
  { k: "Worker", pc: "worker", field: "presentPctWorker", label: "Worker" },
  { k: "NonWorker", pc: "nonWorker", field: "presentPctNonWorker", label: "Non-Worker" },
  { k: "Sewing", pc: "sewing", field: "presentPctSewing", label: "Sewing Worker" },
  { k: "Total", pc: "total", field: "presentPctTotal", label: "Total" }
];

presentMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    ${PRESENT_COLS.map(c => `<td><input type="number" step="0.1" min="0" max="100" placeholder="%" id="present${c.k}_${m.num}"></td>`).join("")}
  </tr>`).join("");

MONTHS.forEach(m => PRESENT_COLS.forEach(c => {
  document.getElementById(`present${c.k}_${m.num}`).addEventListener("input", updatePresentAverages);
}));

// Average row: mean of the months that have a value (blank / 0 months are skipped).
function updatePresentAverages() {
  PRESENT_COLS.forEach(c => {
    const vals = MONTHS.map(m => Number(document.getElementById(`present${c.k}_${m.num}`).value) || 0).filter(v => v > 0);
    document.getElementById(`presentAvg${c.k}`).textContent =
      vals.length ? `${fmtAvg(vals.reduce((a, b) => a + b, 0) / vals.length)}%` : "–";
  });
}

// ── Direct Manpower — yearly table ───────────────────────────
// Total Manpower per month comes from the saved Total Manpower entry (closingManpower),
// kept in rowTotals so the Direct % column can recalculate live as the admin types.
let directRowTotals = {};

directMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="directManpower_${m.num}"></td>
    <td><span class="row-total" id="directTotal_${m.num}">–</span></td>
    <td><span class="row-total" id="directPct_${m.num}">–</span></td>
  </tr>`).join("");

MONTHS.forEach(m => {
  document.getElementById(`directManpower_${m.num}`).addEventListener("input", () => updateDirectRow(m.num));
});

function updateDirectRow(num) {
  const direct = Number(document.getElementById(`directManpower_${num}`).value) || 0;
  const total = directRowTotals[num] || 0;
  document.getElementById(`directTotal_${num}`).textContent = total > 0 ? total.toLocaleString() : "–";
  const pct = total > 0 ? Math.round((direct / total) * 1000) / 10 : null;
  document.getElementById(`directPct_${num}`).textContent = pct === null ? "–" : `${pct}%`;
}

// ── Manpower Excess/(Shortage) — yearly table (Sewing Operator + Helper) ─
const SHORTAGE_INPUTS = ["StdOp", "StdHelper", "ActOp", "ActHelper"];

shortageMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="shortageStdOp_${m.num}"></td>
    <td><input type="number" step="any" id="shortageStdHelper_${m.num}"></td>
    <td><span class="row-total" id="shortageStdTotal_${m.num}">–</span></td>
    <td><input type="number" step="any" id="shortageActOp_${m.num}"></td>
    <td><input type="number" step="any" id="shortageActHelper_${m.num}"></td>
    <td><span class="row-total" id="shortageActTotal_${m.num}">–</span></td>
    <td><span class="row-total" id="shortageResult_${m.num}">–</span></td>
  </tr>`).join("");

MONTHS.forEach(m => {
  SHORTAGE_INPUTS.forEach(k => {
    document.getElementById(`shortage${k}_${m.num}`).addEventListener("input", () => updateShortageRow(m.num));
  });
});

function updateShortageRow(num) {
  const val = k => Number(document.getElementById(`shortage${k}_${num}`).value) || 0;
  const stdTotal = val("StdOp") + val("StdHelper");
  const actTotal = val("ActOp") + val("ActHelper");
  document.getElementById(`shortageStdTotal_${num}`).textContent = stdTotal > 0 ? stdTotal.toLocaleString() : "–";
  document.getElementById(`shortageActTotal_${num}`).textContent = actTotal > 0 ? actTotal.toLocaleString() : "–";

  const resultEl = document.getElementById(`shortageResult_${num}`);
  if (stdTotal > 0 && actTotal > 0) {
    const diff = actTotal - stdTotal;
    resultEl.textContent = diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
    resultEl.style.color = diff < 0 ? "var(--negative)" : "";
  } else {
    resultEl.textContent = "–";
    resultEl.style.color = "";
  }
}

// ── NW EL Plan vs Consumption — department-wise yearly table ────
// Mirrors the Excel sheet: months down the side; Planned / Enjoyed / % for the Total and for each department.
// Uses the default (combined "Accounting & Finance") department list, same as the sheet.
const NWEL_DEPTS = DEFAULT_DEPARTMENTS;
const nwNum = id => Number(document.getElementById(id).value) || 0;
const fmtNw = n => (n > 0 ? (Math.round(n * 10) / 10).toLocaleString() : "–");
const pctNw = (e, p) => (p > 0 ? `${Math.round((e / p) * 100)}%` : "–");
const setNw = (id, text) => { document.getElementById(id).textContent = text; };

nwElTable.innerHTML = `
  <thead>
    <tr>
      <th rowspan="2" class="sticky-col">Month</th>
      <th colspan="3" class="grp grp-total">Total</th>
      ${NWEL_DEPTS.map(d => `<th colspan="3" class="grp">${d.name}</th>`).join("")}
    </tr>
    <tr>${Array(NWEL_DEPTS.length + 1).fill('<th class="gstart">Planned</th><th>Enjoyed</th><th>%</th>').join("")}</tr>
  </thead>
  <tbody>
    ${MONTHS.map(m => `
    <tr>
      <td class="sticky-col">${m.name}</td>
      <td class="gstart"><span class="row-total" id="nwElTotP_${m.num}">–</span></td>
      <td><span class="row-total" id="nwElTotE_${m.num}">–</span></td>
      <td class="pct"><span class="row-total" id="nwElTotPct_${m.num}">–</span></td>
      ${NWEL_DEPTS.map(d => `
      <td class="gstart"><input type="number" step="any" id="nwElP_${d.key}_${m.num}"></td>
      <td><input type="number" step="any" id="nwElE_${d.key}_${m.num}"></td>
      <td class="pct"><span class="row-total" id="nwElPct_${d.key}_${m.num}">–</span></td>`).join("")}
    </tr>`).join("")}
  </tbody>
  <tfoot>
    <tr>
      <td class="sticky-col">Total</td>
      <td class="gstart"><span class="row-total" id="nwElFootP_all">–</span></td>
      <td><span class="row-total" id="nwElFootE_all">–</span></td>
      <td class="pct"><span class="row-total" id="nwElFootPct_all">–</span></td>
      ${NWEL_DEPTS.map(d => `
      <td class="gstart"><span class="row-total" id="nwElFootP_${d.key}">–</span></td>
      <td><span class="row-total" id="nwElFootE_${d.key}">–</span></td>
      <td class="pct"><span class="row-total" id="nwElFootPct_${d.key}">–</span></td>`).join("")}
    </tr>
    <tr>
      <td class="sticky-col">Total Leave (Plan)</td>
      <td class="gstart" colspan="2"><span class="row-total" id="nwElTL_all">–</span></td>
      <td class="pct"><span class="row-total" id="nwElTLPct_all">–</span></td>
      ${NWEL_DEPTS.map(d => `
      <td class="gstart" colspan="2"><input type="number" step="any" id="nwElTL_${d.key}" placeholder="days"></td>
      <td class="pct"><span class="row-total" id="nwElTLPct_${d.key}">–</span></td>`).join("")}
    </tr>
  </tfoot>`;

MONTHS.forEach(m => NWEL_DEPTS.forEach(d => {
  ["P", "E"].forEach(k => {
    document.getElementById(`nwEl${k}_${d.key}_${m.num}`).addEventListener("input", () => updateNwElRow(m.num));
  });
}));

NWEL_DEPTS.forEach(d => {
  document.getElementById(`nwElTL_${d.key}`).addEventListener("input", updateNwElFoot);
});

function updateNwElRow(num) {
  let totP = 0, totE = 0;
  NWEL_DEPTS.forEach(d => {
    const p = nwNum(`nwElP_${d.key}_${num}`), e = nwNum(`nwElE_${d.key}_${num}`);
    totP += p; totE += e;
    setNw(`nwElPct_${d.key}_${num}`, pctNw(e, p));
  });
  setNw(`nwElTotP_${num}`, fmtNw(totP));
  setNw(`nwElTotE_${num}`, fmtNw(totE));
  setNw(`nwElTotPct_${num}`, pctNw(totE, totP));
  updateNwElFoot();
}

// Total row: sums down every month, per department and overall.
// Total Leave (Plan) row: the % is Enjoyed ÷ Total Leave for the year.
function updateNwElFoot() {
  let allP = 0, allE = 0, allTL = 0;
  NWEL_DEPTS.forEach(d => {
    let p = 0, e = 0;
    MONTHS.forEach(m => { p += nwNum(`nwElP_${d.key}_${m.num}`); e += nwNum(`nwElE_${d.key}_${m.num}`); });
    const tl = nwNum(`nwElTL_${d.key}`);
    setNw(`nwElFootP_${d.key}`, fmtNw(p));
    setNw(`nwElFootE_${d.key}`, fmtNw(e));
    setNw(`nwElFootPct_${d.key}`, pctNw(e, p));
    setNw(`nwElTLPct_${d.key}`, pctNw(e, tl));
    allP += p; allE += e; allTL += tl;
  });
  setNw("nwElFootP_all", fmtNw(allP));
  setNw("nwElFootE_all", fmtNw(allE));
  setNw("nwElFootPct_all", pctNw(allE, allP));
  setNw("nwElTL_all", fmtNw(allTL));
  setNw("nwElTLPct_all", pctNw(allE, allTL));
}

// ── Injuries — yearly table ──────────────────────────────────
injuriesMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="injuriesTotal_${m.num}"></td>
    <td><input type="number" step="any" id="injuriesCritical_${m.num}"></td>
  </tr>`).join("");

// ── Disciplinary Action — department table (rows depend on the selected plant) ─
let currentDeptList = []; // set by buildDeptTable(), used by the row/total functions below

function buildDeptTable(siteName) {
  currentDeptList = departmentsForSite(siteName);

  discDeptTableBody.innerHTML = currentDeptList.map(d => `
    <tr>
      <td>${d.name}</td>
      <td><input type="number" step="any" id="discDeptWorker_${d.key}"></td>
      <td><input type="number" step="any" id="discDeptNonWorker_${d.key}"></td>
      <td><span class="row-total" id="discDeptRowTotal_${d.key}">0</span></td>
      <td><input type="number" step="any" id="discDeptEmployees_${d.key}"></td>
      <td><span class="row-total" id="discDeptPct_${d.key}">0%</span></td>
    </tr>`).join("");

  currentDeptList.forEach(d => {
    const recalc = () => { updateDeptRow(d.key); updateDeptTotals(); };
    document.getElementById(`discDeptWorker_${d.key}`).addEventListener("input", recalc);
    document.getElementById(`discDeptNonWorker_${d.key}`).addEventListener("input", recalc);
    document.getElementById(`discDeptEmployees_${d.key}`).addEventListener("input", recalc);
  });
}

function updateDeptRow(key) {
  const worker = Number(document.getElementById(`discDeptWorker_${key}`).value) || 0;
  const nonWorker = Number(document.getElementById(`discDeptNonWorker_${key}`).value) || 0;
  const employees = Number(document.getElementById(`discDeptEmployees_${key}`).value) || 0;
  const total = worker + nonWorker;
  const pct = employees > 0 ? Math.round((total / employees) * 1000) / 10 : 0;
  document.getElementById(`discDeptRowTotal_${key}`).textContent = total.toLocaleString();
  document.getElementById(`discDeptPct_${key}`).textContent = `${pct}%`;
}

function updateDeptTotals() {
  let totalWorker = 0, totalNonWorker = 0, totalEmployees = 0;
  currentDeptList.forEach(d => {
    totalWorker += Number(document.getElementById(`discDeptWorker_${d.key}`).value) || 0;
    totalNonWorker += Number(document.getElementById(`discDeptNonWorker_${d.key}`).value) || 0;
    totalEmployees += Number(document.getElementById(`discDeptEmployees_${d.key}`).value) || 0;
  });
  const grandTotal = totalWorker + totalNonWorker;
  const grandPct = totalEmployees > 0 ? Math.round((grandTotal / totalEmployees) * 1000) / 10 : 0;
  document.getElementById("discDeptTotalWorker").textContent = totalWorker.toLocaleString();
  document.getElementById("discDeptTotalNonWorker").textContent = totalNonWorker.toLocaleString();
  document.getElementById("discDeptTotalActions").textContent = grandTotal.toLocaleString();
  document.getElementById("discDeptTotalEmployees").textContent = totalEmployees.toLocaleString();
  document.getElementById("discDeptTotalPct").textContent = `${grandPct}%`;
}

// ── Disciplinary Action — letter-type table (Production only) ─
discLetterTableBody.innerHTML = LETTER_TYPES.map(t => `
  <tr>
    <td>${t.name}</td>
    <td><input type="number" step="any" id="discLetterNonWorker_${t.key}"></td>
    <td><input type="number" step="any" id="discLetterWorker_${t.key}"></td>
  </tr>`).join("");

LETTER_TYPES.forEach(t => {
  document.getElementById(`discLetterNonWorker_${t.key}`).addEventListener("input", updateLetterTotals);
  document.getElementById(`discLetterWorker_${t.key}`).addEventListener("input", updateLetterTotals);
});

function updateLetterTotals() {
  let totalNonWorker = 0, totalWorker = 0;
  LETTER_TYPES.forEach(t => {
    totalNonWorker += Number(document.getElementById(`discLetterNonWorker_${t.key}`).value) || 0;
    totalWorker += Number(document.getElementById(`discLetterWorker_${t.key}`).value) || 0;
  });
  document.getElementById("discLetterTotalNonWorker").textContent = totalNonWorker.toLocaleString();
  document.getElementById("discLetterTotalWorker").textContent = totalWorker.toLocaleString();

  const grand = totalNonWorker + totalWorker;
  const nonWorkerShare = grand > 0 ? Math.round((totalNonWorker / grand) * 1000) / 10 : 0;
  const workerShare = grand > 0 ? Math.round((totalWorker / grand) * 1000) / 10 : 0;
  document.getElementById("discWorkerShareHint").textContent =
    grand > 0 ? `Non-Worker ${nonWorkerShare}% · Worker ${workerShare}%` : "–";
}

// Recalculate the Total EL (Plan) display live as any month's Plan changes.
MONTHS.forEach(m => {
  document.getElementById(`leaveMonthPlan_${m.num}`).addEventListener("input", updateTotalPlanDisplay);
});

function updateTotalPlanDisplay() {
  const total = MONTHS.reduce((sum, m) => sum + (Number(document.getElementById(`leaveMonthPlan_${m.num}`).value) || 0), 0);
  leaveTotalPlanDisplay.textContent = total.toLocaleString();
  return total;
}

// ── Sites ─────────────────────────────────────────────────
async function refreshSites() {
  const snap = await getDocs(query(collection(db, "sites"), orderBy("name")));
  sitesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  sitesList.innerHTML = sitesCache.map(s => `
    <li>
      <span>${escapeHtml(s.name)}</span>
      <span class="row-actions">
        <button class="del" data-site="${s.id}">Delete</button>
      </span>
    </li>`).join("") || `<li><span style="color:#8794a8;">No plants yet — add one above.</span></li>`;

  const options = sitesCache.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  [leaveSite, nwElSite, manpowerSite, directSite, shortageSite, feedbackSite, presentSite, injuriesSite, disciplinarySite, formSite, reportsSiteFilter]
    .forEach(sel => applySiteOptions(sel, options));
  newAdminSite.innerHTML = options; // Manage Admins panel — super admins only, always full list

  sitesList.querySelectorAll("button.del").forEach(btn => {
    btn.addEventListener("click", () => deleteSite(btn.dataset.site));
  });

  updateRoleBanner();

  const scopedSiteId = currentAdminRole === "site" ? currentAdminSiteId : null;
  const hasValidScope = currentAdminRole === "super" || sitesCache.some(s => s.id === scopedSiteId);

  if (sitesCache.length && hasValidScope) {
    await fetchSiteReports(leaveSite.value);
    loadLeaveYearTable();
    loadNwElYearTable();
    loadManpowerYearTable();
    loadDirectYearTable();
    loadShortageYearTable();
    loadFeedbackYearTable();
    loadPresentYearTable();
    loadInjuriesYearTable();
    await loadDisciplinaryForm();
    await refreshReportsList();
  } else if (!hasValidScope) {
    showToast("Your assigned plant could not be found. Contact your administrator.");
  }

  if (currentAdminRole === "super") await refreshAdminsList();
}

// For Plant Admins, locks a <select> to their one assigned plant (and disables it).
// Super Admins get the full list, editable as normal.
function applySiteOptions(selectEl, allOptionsHtml) {
  if (currentAdminRole === "site") {
    const site = sitesCache.find(s => s.id === currentAdminSiteId);
    selectEl.innerHTML = site
      ? `<option value="${site.id}">${escapeHtml(site.name)}</option>`
      : `<option value="">(assigned plant not found)</option>`;
    if (site) selectEl.value = site.id;
    selectEl.disabled = true;
  } else {
    selectEl.innerHTML = allOptionsHtml;
    selectEl.disabled = false;
  }
}

function updateRoleBanner() {
  if (currentAdminRole === "super") {
    roleBanner.textContent = "Signed in as Super Admin — full access to every plant.";
  } else {
    const siteName = sitesCache.find(s => s.id === currentAdminSiteId)?.name;
    roleBanner.textContent = siteName
      ? `Signed in as Plant Admin — scoped to ${siteName} only.`
      : "Signed in as Plant Admin — your assigned plant could not be found.";
  }
}

addSiteBtn.addEventListener("click", async () => {
  const name = newSiteName.value.trim();
  if (!name) return;
  await addDoc(collection(db, "sites"), { name });
  newSiteName.value = "";
  showToast(`Added plant "${name}"`);
  await refreshSites();
});

async function deleteSite(siteId) {
  const site = sitesCache.find(s => s.id === siteId);
  if (!confirm(`Delete "${site?.name}" and ALL its monthly reports? This cannot be undone.`)) return;
  const reportsSnap = await getDocs(collection(db, "sites", siteId, "reports"));
  await Promise.all(reportsSnap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "sites", siteId));
  showToast("Plant deleted");
  delete reportsCache[siteId];
  await refreshSites();
}

// ── Manage Admins (super admins only) ───────────────────────
newAdminRole.addEventListener("change", () => {
  newAdminSiteWrap.style.display = newAdminRole.value === "site" ? "" : "none";
});

async function refreshAdminsList() {
  const snap = await getDocs(collection(db, "admins"));
  const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

  adminsList.innerHTML = rows.map(r => {
    const accessLabel = r.role === "super"
      ? "Super Admin"
      : `Plant Admin — ${escapeHtml(sitesCache.find(s => s.id === r.siteId)?.name || r.siteId || "unknown plant")}`;
    return `
      <li>
        <span>${escapeHtml(r.label || r.uid)} <span style="color:#8794a8;">(${accessLabel})</span></span>
        <span class="row-actions">
          <button class="del" data-uid="${r.uid}">Revoke</button>
        </span>
      </li>`;
  }).join("") || `<li><span style="color:#8794a8;">No admins granted yet — add yourself first as Super Admin via the Firebase Console.</span></li>`;

  adminsList.querySelectorAll("button.del").forEach(btn => {
    btn.addEventListener("click", () => revokeAdmin(btn.dataset.uid));
  });
}

saveAdminBtn.addEventListener("click", async () => {
  const uid = newAdminUid.value.trim();
  if (!uid) { showToast("Enter a User UID"); return; }
  const role = newAdminRole.value;
  const siteId = role === "site" ? newAdminSite.value : null;
  if (role === "site" && !siteId) { showToast("Choose a plant"); return; }

  saveAdminBtn.disabled = true;
  try {
    await setDoc(doc(db, "admins", uid), {
      role,
      siteId,
      label: newAdminLabel.value.trim() || null,
      updatedAt: new Date().toISOString()
    });
    showToast("Admin access granted");
    newAdminUid.value = "";
    newAdminLabel.value = "";
    await refreshAdminsList();
  } catch (err) {
    console.error(err);
    showToast("Failed to save — check console");
  } finally {
    saveAdminBtn.disabled = false;
  }
});

async function revokeAdmin(uid) {
  const isSelf = uid === auth.currentUser?.uid;
  const msg = isSelf
    ? "This is YOUR OWN account. Revoking it will lock you out immediately. Continue?"
    : "Revoke this admin's access?";
  if (!confirm(msg)) return;

  await deleteDoc(doc(db, "admins", uid));
  showToast("Access revoked");

  if (isSelf) {
    await signOut(auth);
    window.location.replace("login.html");
    return;
  }
  await refreshAdminsList();
}

// ── Shared reports cache (used by both the yearly table and the list) ─
async function fetchSiteReports(siteId) {
  if (!siteId) return {};
  const snap = await getDocs(collection(db, "sites", siteId, "reports"));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data(); });
  reportsCache[siteId] = map;
  return map;
}

// ── Leave Consumption — yearly table ───────────────────────
leaveSite.addEventListener("change", async () => {
  await fetchSiteReports(leaveSite.value);
  loadLeaveYearTable();
});
leaveYear.addEventListener("change", loadLeaveYearTable);

function loadLeaveYearTable() {
  const siteId = leaveSite.value;
  const year = leaveYear.value;
  const reports = reportsCache[siteId] || {};

  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    document.getElementById(`leaveMonthPlan_${m.num}`).value = rec.monthElPlan || "";
    document.getElementById(`leaveMonthActual_${m.num}`).value = rec.monthElActual || "";
  }
  updateTotalPlanDisplay();
}

saveLeaveYearBtn.addEventListener("click", async () => {
  const siteId = leaveSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = leaveYear.value;
  const totalPlan = updateTotalPlanDisplay(); // sum of all 12 months' Plan

  saveLeaveYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const planVal = Number(document.getElementById(`leaveMonthPlan_${m.num}`).value) || 0;
      const actualVal = Number(document.getElementById(`leaveMonthActual_${m.num}`).value) || 0;
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        {
          period: periodLabelFor(year, m.name),
          totalElPlan: totalPlan,
          monthElPlan: planVal,
          monthElActual: actualVal
        },
        { merge: true }
      );
    }));
    showToast(`Saved Leave Consumption for ${year} (Total EL Plan: ${totalPlan.toLocaleString()})`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveLeaveYearBtn.disabled = false;
  }
});

// ── Total Manpower — yearly table ──────────────────────────
manpowerSite.addEventListener("change", async () => {
  await fetchSiteReports(manpowerSite.value);
  loadManpowerYearTable();
});
manpowerYear.addEventListener("change", loadManpowerYearTable);

function loadManpowerYearTable() {
  const siteId = manpowerSite.value;
  const year = manpowerYear.value;
  const reports = reportsCache[siteId] || {};

  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    document.getElementById(`manpowerWorker_${m.num}`).value = rec.workerManpower || "";
    document.getElementById(`manpowerNonWorker_${m.num}`).value = rec.nonWorkerManpower || "";
    document.getElementById(`manpowerSewingOp_${m.num}`).value = rec.sewingOperatorManpower || "";
    document.getElementById(`manpowerSewingHelper_${m.num}`).value = rec.sewingHelperManpower || "";
    document.getElementById(`manpowerExternal_${m.num}`).value = rec.externalManpower || "";
    updateManpowerRowTotal(m.num);
  }
}

saveManpowerYearBtn.addEventListener("click", async () => {
  const siteId = manpowerSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = manpowerYear.value;

  saveManpowerYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const workerVal = Number(document.getElementById(`manpowerWorker_${m.num}`).value) || 0;
      const nonWorkerVal = Number(document.getElementById(`manpowerNonWorker_${m.num}`).value) || 0;
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        {
          period: periodLabelFor(year, m.name),
          workerManpower: workerVal,
          nonWorkerManpower: nonWorkerVal,
          closingManpower: workerVal + nonWorkerVal,
          sewingOperatorManpower: mpVal("SewingOp", m.num),
          sewingHelperManpower: mpVal("SewingHelper", m.num),
          externalManpower: mpVal("External", m.num)
        },
        { merge: true }
      );
    }));
    showToast(`Saved Manpower for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveManpowerYearBtn.disabled = false;
  }
});

// ── Employees Feedback Received — yearly table ─────────────
feedbackSite.addEventListener("change", async () => {
  await fetchSiteReports(feedbackSite.value);
  loadFeedbackYearTable();
});
feedbackYear.addEventListener("change", loadFeedbackYearTable);

function loadFeedbackYearTable() {
  const siteId = feedbackSite.value;
  const year = feedbackYear.value;
  const reports = reportsCache[siteId] || {};

  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    document.getElementById(`feedbackExternal_${m.num}`).value = rec.feedbackExternal || "";
    document.getElementById(`feedbackInternal_${m.num}`).value = rec.feedbackInternal || "";
    updateFeedbackRowTotal(m.num);
  }
}

saveFeedbackYearBtn.addEventListener("click", async () => {
  const siteId = feedbackSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = feedbackYear.value;

  saveFeedbackYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const externalVal = Number(document.getElementById(`feedbackExternal_${m.num}`).value) || 0;
      const internalVal = Number(document.getElementById(`feedbackInternal_${m.num}`).value) || 0;
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        {
          period: periodLabelFor(year, m.name),
          feedbackExternal: externalVal,
          feedbackInternal: internalVal,
          feedbackTotal: externalVal + internalVal
        },
        { merge: true }
      );
    }));
    showToast(`Saved Employees Feedback Received for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveFeedbackYearBtn.disabled = false;
  }
});

// ── Present % — yearly load/save ────────────────────────────
presentSite.addEventListener("change", async () => {
  await fetchSiteReports(presentSite.value);
  loadPresentYearTable();
});
presentYear.addEventListener("change", loadPresentYearTable);

function loadPresentYearTable() {
  const reports = reportsCache[presentSite.value] || {};
  for (const m of MONTHS) {
    const pc = presentPercents(reports[periodIdFor(presentYear.value, m.num)] || {});
    PRESENT_COLS.forEach(c => {
      document.getElementById(`present${c.k}_${m.num}`).value = pc[c.pc] ?? "";
    });
  }
  updatePresentAverages();
}

savePresentYearBtn.addEventListener("click", async () => {
  const siteId = presentSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = presentYear.value;

  // Percentages only make sense between 0 and 100 — catch a typo before it is saved.
  for (const m of MONTHS) {
    for (const c of PRESENT_COLS) {
      const v = Number(document.getElementById(`present${c.k}_${m.num}`).value) || 0;
      if (v < 0 || v > 100) { showToast(`${m.name}, ${c.label}: enter a percentage between 0 and 100`); return; }
    }
  }

  savePresentYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const data = { period: periodLabelFor(year, m.name) };
      PRESENT_COLS.forEach(c => { data[c.field] = Number(document.getElementById(`present${c.k}_${m.num}`).value) || 0; });
      return setDoc(doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)), data, { merge: true });
    }));
    showToast(`Saved Present % for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    savePresentYearBtn.disabled = false;
  }
});

// ── Direct Manpower — yearly load/save ──────────────────────
directSite.addEventListener("change", async () => {
  await fetchSiteReports(directSite.value);
  loadDirectYearTable();
});
directYear.addEventListener("change", loadDirectYearTable);

function loadDirectYearTable() {
  const siteId = directSite.value;
  const year = directYear.value;
  const reports = reportsCache[siteId] || {};

  directRowTotals = {};
  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    directRowTotals[m.num] = Number(rec.closingManpower) || 0;
    document.getElementById(`directManpower_${m.num}`).value = rec.directManpower || "";
    updateDirectRow(m.num);
  }
}

// Re-reads only the read-only Total Manpower column (e.g. after Total Manpower was just saved),
// without touching anything the admin has typed into the input column.
function refreshDirectTotals() {
  const reports = reportsCache[directSite.value] || {};
  for (const m of MONTHS) {
    const rec = reports[periodIdFor(directYear.value, m.num)] || {};
    directRowTotals[m.num] = Number(rec.closingManpower) || 0;
    updateDirectRow(m.num);
  }
}

saveDirectYearBtn.addEventListener("click", async () => {
  const siteId = directSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = directYear.value;

  saveDirectYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const directVal = Number(document.getElementById(`directManpower_${m.num}`).value) || 0;
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        { period: periodLabelFor(year, m.name), directManpower: directVal },
        { merge: true }
      );
    }));
    showToast(`Saved Direct Manpower for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveDirectYearBtn.disabled = false;
  }
});

// ── Manpower Excess/(Shortage) — yearly load/save ───────────
shortageSite.addEventListener("change", async () => {
  await fetchSiteReports(shortageSite.value);
  loadShortageYearTable();
});
shortageYear.addEventListener("change", loadShortageYearTable);

function loadShortageYearTable() {
  const siteId = shortageSite.value;
  const year = shortageYear.value;
  const reports = reportsCache[siteId] || {};

  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    document.getElementById(`shortageStdOp_${m.num}`).value = rec.shortageStdOperator || "";
    document.getElementById(`shortageStdHelper_${m.num}`).value = rec.shortageStdHelper || "";
    document.getElementById(`shortageActOp_${m.num}`).value = rec.shortageActualOperator || "";
    document.getElementById(`shortageActHelper_${m.num}`).value = rec.shortageActualHelper || "";
    updateShortageRow(m.num);
  }
}

saveShortageYearBtn.addEventListener("click", async () => {
  const siteId = shortageSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = shortageYear.value;

  saveShortageYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const val = k => Number(document.getElementById(`shortage${k}_${m.num}`).value) || 0;
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        {
          period: periodLabelFor(year, m.name),
          shortageStdOperator: val("StdOp"),
          shortageStdHelper: val("StdHelper"),
          shortageActualOperator: val("ActOp"),
          shortageActualHelper: val("ActHelper")
        },
        { merge: true }
      );
    }));
    showToast(`Saved Excess / (Shortage) for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveShortageYearBtn.disabled = false;
  }
});

// ── NW EL Plan vs Consumption — yearly load/save ─────────────
nwElSite.addEventListener("change", async () => {
  await fetchSiteReports(nwElSite.value);
  loadNwElYearTable();
});
nwElYear.addEventListener("change", loadNwElYearTable);

function loadNwElYearTable() {
  const reports = reportsCache[nwElSite.value] || {};

  // Total Leave (Plan) is one figure per department for the year, saved on every month of that year.
  let totalLeave = {};
  for (const m of MONTHS) {
    const rec = reports[periodIdFor(nwElYear.value, m.num)];
    if (rec && rec.nwElTotalLeave) { totalLeave = rec.nwElTotalLeave; break; }
  }
  NWEL_DEPTS.forEach(d => { document.getElementById(`nwElTL_${d.key}`).value = totalLeave[d.key] || ""; });

  for (const m of MONTHS) {
    const map = (reports[periodIdFor(nwElYear.value, m.num)] || {}).nwElDept || {};
    NWEL_DEPTS.forEach(d => {
      const v = map[d.key] || {};
      document.getElementById(`nwElP_${d.key}_${m.num}`).value = v.planned || "";
      document.getElementById(`nwElE_${d.key}_${m.num}`).value = v.enjoyed || "";
    });
    updateNwElRow(m.num);
  }
}

saveNwElYearBtn.addEventListener("click", async () => {
  const siteId = nwElSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = nwElYear.value;

  saveNwElYearBtn.disabled = true;
  try {
    const nwElTotalLeave = {};
    let totalLeaveAll = 0;
    NWEL_DEPTS.forEach(d => { nwElTotalLeave[d.key] = nwNum(`nwElTL_${d.key}`); totalLeaveAll += nwElTotalLeave[d.key]; });

    await Promise.all(MONTHS.map(m => {
      const nwElDept = {};
      let totalPlanned = 0, totalEnjoyed = 0;
      NWEL_DEPTS.forEach(d => {
        const planned = nwNum(`nwElP_${d.key}_${m.num}`), enjoyed = nwNum(`nwElE_${d.key}_${m.num}`);
        nwElDept[d.key] = { planned, enjoyed };
        totalPlanned += planned; totalEnjoyed += enjoyed;
      });
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        { period: periodLabelFor(year, m.name), nwElDept, nwElPlannedTotal: totalPlanned, nwElEnjoyedTotal: totalEnjoyed, nwElTotalLeave, nwElTotalLeaveAll: totalLeaveAll },
        { merge: true }
      );
    }));
    showToast(`Saved NW Plan vs Consumption for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveNwElYearBtn.disabled = false;
  }
});

// ── Injuries — yearly load/save ─────────────────────────────
injuriesSite.addEventListener("change", async () => {
  await fetchSiteReports(injuriesSite.value);
  loadInjuriesYearTable();
});
injuriesYear.addEventListener("change", loadInjuriesYearTable);

function loadInjuriesYearTable() {
  const siteId = injuriesSite.value;
  const year = injuriesYear.value;
  const reports = reportsCache[siteId] || {};

  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    document.getElementById(`injuriesTotal_${m.num}`).value = rec.injuriesTotal || "";
    document.getElementById(`injuriesCritical_${m.num}`).value = rec.injuriesCritical || "";
  }
}

saveInjuriesYearBtn.addEventListener("click", async () => {
  const siteId = injuriesSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = injuriesYear.value;

  saveInjuriesYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const totalVal = Number(document.getElementById(`injuriesTotal_${m.num}`).value) || 0;
      const criticalVal = Number(document.getElementById(`injuriesCritical_${m.num}`).value) || 0;
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        {
          period: periodLabelFor(year, m.name),
          injuriesTotal: totalVal,
          injuriesCritical: criticalVal
        },
        { merge: true }
      );
    }));
    showToast(`Saved Injuries for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveInjuriesYearBtn.disabled = false;
  }
});

// ── Disciplinary Action — single summary record per plant ───
disciplinarySite.addEventListener("change", () => loadDisciplinaryForm());

function siteNameFor(siteId) {
  return sitesCache.find(s => s.id === siteId)?.name || "";
}

async function loadDisciplinaryForm() {
  const siteId = disciplinarySite.value;
  if (!siteId) return;

  buildDeptTable(siteNameFor(siteId));

  let data = {};
  try {
    const snap = await getDoc(doc(db, "sites", siteId, "meta", "disciplinary"));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    console.error(err);
  }

  disciplinaryStartMonth.value = data.startMonth || "07";
  disciplinaryStartYear.value = data.startYear || CURRENT_YEAR;
  disciplinaryEndMonth.value = data.endMonth || "06";
  disciplinaryEndYear.value = data.endYear || (CURRENT_YEAR + 1);

  const deptData = data.disciplinaryDept || {};
  currentDeptList.forEach(d => {
    const v = deptData[d.key] || {};
    document.getElementById(`discDeptWorker_${d.key}`).value = v.worker || "";
    document.getElementById(`discDeptNonWorker_${d.key}`).value = v.nonWorker || "";
    document.getElementById(`discDeptEmployees_${d.key}`).value = v.employees || "";
    updateDeptRow(d.key);
  });
  updateDeptTotals();

  const letterData = data.disciplinaryLetter || {};
  LETTER_TYPES.forEach(t => {
    const v = letterData[t.key] || {};
    document.getElementById(`discLetterNonWorker_${t.key}`).value = v.nonWorker || "";
    document.getElementById(`discLetterWorker_${t.key}`).value = v.worker || "";
  });
  updateLetterTotals();
}

saveDisciplinaryBtn.addEventListener("click", async () => {
  const siteId = disciplinarySite.value;
  if (!siteId) { showToast("Add a plant first"); return; }

  const disciplinaryDept = {};
  currentDeptList.forEach(d => {
    disciplinaryDept[d.key] = {
      worker: Number(document.getElementById(`discDeptWorker_${d.key}`).value) || 0,
      nonWorker: Number(document.getElementById(`discDeptNonWorker_${d.key}`).value) || 0,
      employees: Number(document.getElementById(`discDeptEmployees_${d.key}`).value) || 0
    };
  });
  const disciplinaryLetter = {};
  LETTER_TYPES.forEach(t => {
    disciplinaryLetter[t.key] = {
      nonWorker: Number(document.getElementById(`discLetterNonWorker_${t.key}`).value) || 0,
      worker: Number(document.getElementById(`discLetterWorker_${t.key}`).value) || 0
    };
  });

  const startMonth = disciplinaryStartMonth.value;
  const startYear = Number(disciplinaryStartYear.value);
  const endMonth = disciplinaryEndMonth.value;
  const endYear = Number(disciplinaryEndYear.value);
  const startName = MONTHS.find(m => m.num === startMonth)?.name || startMonth;
  const endName = MONTHS.find(m => m.num === endMonth)?.name || endMonth;
  const periodLabel = `${startName} ${startYear} to ${endName} ${endYear}`;

  saveDisciplinaryBtn.disabled = true;
  try {
    await setDoc(
      doc(db, "sites", siteId, "meta", "disciplinary"),
      { startMonth, startYear, endMonth, endYear, periodLabel, disciplinaryDept, disciplinaryLetter }
    );
    showToast(`Saved Disciplinary Action summary (${periodLabel})`);
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveDisciplinaryBtn.disabled = false;
  }
});

// ── Generic monthly form (everything except Leave) ─────────
function buildForm() {
  let html = "";
  for (const topic of enabledTopics().filter(t => !t.customAdminUI)) {
    html += `<div class="form-group-title">${escapeHtml(topic.title)}</div>`;
    for (const f of topic.fields) {
      html += `
        <div class="field">
          <label>${escapeHtml(f.label)}</label>
          <input type="number" step="any" id="field_${f.key}" data-key="${f.key}">
        </div>`;
    }
  }
  dynamicFormArea.innerHTML = html
    ? `<div class="form-grid">${html}</div>`
    : `<p class="hint">No other monthly-entry topics are enabled yet.</p>`;
}
buildForm();

function monthNameFor(num) {
  return MONTHS.find(m => m.num === num)?.name || num;
}

function collectFormData() {
  const data = { period: periodLabelFor(formYear.value, monthNameFor(formMonth.value)) };
  dynamicFormArea.querySelectorAll("input[data-key]").forEach(inp => {
    data[inp.dataset.key] = inp.value === "" ? 0 : Number(inp.value);
  });
  return data;
}

function populateGenericFields(data) {
  dynamicFormArea.querySelectorAll("input[data-key]").forEach(inp => {
    inp.value = data[inp.dataset.key] ?? "";
  });
}

clearFormBtn.addEventListener("click", () => {
  populateGenericFields({});
});

saveReportBtn.addEventListener("click", async () => {
  const siteId = formSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const periodId = periodIdFor(formYear.value, formMonth.value);
  const data = collectFormData();
  try {
    // merge: true — this doc may already hold Leave Consumption fields
    // saved from the yearly table; we only want to update this topic's fields.
    await setDoc(doc(db, "sites", siteId, "reports", periodId), data, { merge: true });
    showToast(`Saved report ${periodId}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  }
});

// ── Existing reports list ────────────────────────────────
reportsSiteFilter.addEventListener("change", refreshReportsList);

async function refreshReportsList() {
  const siteId = reportsSiteFilter.value || (sitesCache[0] && sitesCache[0].id);
  if (!siteId) { reportsList.innerHTML = ""; return; }
  const reports = reportsCache[siteId] || await fetchSiteReports(siteId);
  const ids = Object.keys(reports);

  if (ids.length === 0) {
    reportsList.innerHTML = `<li><span style="color:#8794a8;">No reports for this plant yet.</span></li>`;
    return;
  }
  const sortedIds = ids.sort((a, b) => b.localeCompare(a));
  reportsList.innerHTML = sortedIds.map(id => `
    <li>
      <span>${id} — ${escapeHtml(reports[id].period || "")}</span>
      <span class="row-actions">
        <button class="edit" data-site="${siteId}" data-period="${id}">Edit</button>
        <button class="del" data-site="${siteId}" data-period="${id}">Delete</button>
      </span>
    </li>`).join("");

  reportsList.querySelectorAll("button.edit").forEach(btn => {
    btn.addEventListener("click", () => loadReportIntoForm(btn.dataset.site, btn.dataset.period));
  });
  reportsList.querySelectorAll("button.del").forEach(btn => {
    btn.addEventListener("click", () => deleteReport(btn.dataset.site, btn.dataset.period));
  });
}

function loadReportIntoForm(siteId, periodId) {
  const rec = (reportsCache[siteId] || {})[periodId];
  if (!rec) return;
  const [year, monthNum] = periodId.split("-");
  formSite.value = siteId;
  formYear.value = year;
  formMonth.value = monthNum;
  populateGenericFields(rec);
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(`Loaded ${periodId} into "Monthly report — other topics" for editing`);
}

async function deleteReport(siteId, periodId) {
  if (!confirm(`Delete report ${periodId}? This cannot be undone.`)) return;
  await deleteDoc(doc(db, "sites", siteId, "reports", periodId));
  showToast("Report deleted");
  await fetchSiteReports(siteId);
  await refreshReportsList();
  if (siteId === leaveSite.value) loadLeaveYearTable();
  if (siteId === nwElSite.value) loadNwElYearTable();
  if (siteId === manpowerSite.value) loadManpowerYearTable();
  if (siteId === directSite.value) loadDirectYearTable();
  if (siteId === shortageSite.value) loadShortageYearTable();
  if (siteId === feedbackSite.value) loadFeedbackYearTable();
  if (siteId === presentSite.value) loadPresentYearTable();
  if (siteId === injuriesSite.value) loadInjuriesYearTable();
}

// ── Utils ─────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
