import { firebaseConfig } from "./firebase-config.js";
import { enabledTopics, MONTHS, DEPARTMENTS, LETTER_TYPES, periodIdFor, periodLabelFor } from "./schema.js";
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

const injuriesSite = document.getElementById("injuriesSite");
const injuriesYear = document.getElementById("injuriesYear");
const injuriesMonthTableBody = document.querySelector("#injuriesMonthTable tbody");
const saveInjuriesYearBtn = document.getElementById("saveInjuriesYearBtn");

const disciplinarySite = document.getElementById("disciplinarySite");
const disciplinaryMonth = document.getElementById("disciplinaryMonth");
const disciplinaryYear = document.getElementById("disciplinaryYear");
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
  plantsPanel.style.display = currentAdminRole === "super" ? "" : "none";
  manageAdminsPanel.style.display = currentAdminRole === "super" ? "" : "none";

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
disciplinaryYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
disciplinaryYear.value = CURRENT_YEAR;
disciplinaryMonth.innerHTML = MONTHS.map(m => `<option value="${m.num}">${m.name}</option>`).join("");
disciplinaryMonth.value = CURRENT_MONTH;

leaveMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="leaveMonthPlan_${m.num}"></td>
    <td><input type="number" step="any" id="leaveMonthActual_${m.num}"></td>
  </tr>`).join("");

manpowerMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="manpowerWorker_${m.num}"></td>
    <td><input type="number" step="any" id="manpowerNonWorker_${m.num}"></td>
    <td><span class="row-total" id="manpowerTotal_${m.num}">0</span></td>
  </tr>`).join("");

MONTHS.forEach(m => {
  const recalc = () => updateManpowerRowTotal(m.num);
  document.getElementById(`manpowerWorker_${m.num}`).addEventListener("input", recalc);
  document.getElementById(`manpowerNonWorker_${m.num}`).addEventListener("input", recalc);
});

function updateManpowerRowTotal(num) {
  const worker = Number(document.getElementById(`manpowerWorker_${num}`).value) || 0;
  const nonWorker = Number(document.getElementById(`manpowerNonWorker_${num}`).value) || 0;
  const total = worker + nonWorker;
  document.getElementById(`manpowerTotal_${num}`).textContent = total.toLocaleString();
  return total;
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

// ── Present % — yearly table ────────────────────────────────
presentMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="presentTotalEmployees_${m.num}"></td>
    <td><input type="number" step="any" id="presentTotalPresent_${m.num}"></td>
    <td><span class="row-total" id="presentOverallPct_${m.num}">0%</span></td>
    <td><input type="number" step="any" id="presentSewingTotal_${m.num}"></td>
    <td><input type="number" step="any" id="presentSewingPresent_${m.num}"></td>
    <td><span class="row-total" id="presentSewingPct_${m.num}">0%</span></td>
  </tr>`).join("");

MONTHS.forEach(m => {
  const recalc = () => updatePresentRowPct(m.num);
  document.getElementById(`presentTotalEmployees_${m.num}`).addEventListener("input", recalc);
  document.getElementById(`presentTotalPresent_${m.num}`).addEventListener("input", recalc);
  document.getElementById(`presentSewingTotal_${m.num}`).addEventListener("input", recalc);
  document.getElementById(`presentSewingPresent_${m.num}`).addEventListener("input", recalc);
});

function updatePresentRowPct(num) {
  const totalEmployees = Number(document.getElementById(`presentTotalEmployees_${num}`).value) || 0;
  const totalPresent = Number(document.getElementById(`presentTotalPresent_${num}`).value) || 0;
  const sewingTotal = Number(document.getElementById(`presentSewingTotal_${num}`).value) || 0;
  const sewingPresent = Number(document.getElementById(`presentSewingPresent_${num}`).value) || 0;

  const overallPct = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 1000) / 10 : 0;
  const sewingPct = sewingTotal > 0 ? Math.round((sewingPresent / sewingTotal) * 1000) / 10 : 0;

  document.getElementById(`presentOverallPct_${num}`).textContent = `${overallPct}%`;
  document.getElementById(`presentSewingPct_${num}`).textContent = `${sewingPct}%`;
}

// ── Injuries — yearly table ──────────────────────────────────
injuriesMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="injuriesTotal_${m.num}"></td>
    <td><input type="number" step="any" id="injuriesCritical_${m.num}"></td>
  </tr>`).join("");

// ── Disciplinary Action — department table ─────────────────
discDeptTableBody.innerHTML = DEPARTMENTS.map(d => `
  <tr>
    <td>${d.name}</td>
    <td><input type="number" step="any" id="discDeptActions_${d.key}"></td>
    <td><input type="number" step="any" id="discDeptEmployees_${d.key}"></td>
    <td><span class="row-total" id="discDeptPct_${d.key}">0%</span></td>
  </tr>`).join("");

DEPARTMENTS.forEach(d => {
  const recalc = () => { updateDeptRowPct(d.key); updateDeptTotals(); };
  document.getElementById(`discDeptActions_${d.key}`).addEventListener("input", recalc);
  document.getElementById(`discDeptEmployees_${d.key}`).addEventListener("input", recalc);
});

function updateDeptRowPct(key) {
  const actions = Number(document.getElementById(`discDeptActions_${key}`).value) || 0;
  const employees = Number(document.getElementById(`discDeptEmployees_${key}`).value) || 0;
  const pct = employees > 0 ? Math.round((actions / employees) * 1000) / 10 : 0;
  document.getElementById(`discDeptPct_${key}`).textContent = `${pct}%`;
}

function updateDeptTotals() {
  let totalActions = 0, totalEmployees = 0;
  DEPARTMENTS.forEach(d => {
    totalActions += Number(document.getElementById(`discDeptActions_${d.key}`).value) || 0;
    totalEmployees += Number(document.getElementById(`discDeptEmployees_${d.key}`).value) || 0;
  });
  const totalPct = totalEmployees > 0 ? Math.round((totalActions / totalEmployees) * 1000) / 10 : 0;
  document.getElementById("discDeptTotalActions").textContent = totalActions.toLocaleString();
  document.getElementById("discDeptTotalEmployees").textContent = totalEmployees.toLocaleString();
  document.getElementById("discDeptTotalPct").textContent = `${totalPct}%`;
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
  [leaveSite, manpowerSite, feedbackSite, presentSite, injuriesSite, disciplinarySite, formSite, reportsSiteFilter]
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
    loadManpowerYearTable();
    loadFeedbackYearTable();
    loadPresentYearTable();
    loadInjuriesYearTable();
    loadDisciplinaryForm();
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
          closingManpower: workerVal + nonWorkerVal
        },
        { merge: true }
      );
    }));
    showToast(`Saved Total Manpower for ${year}`);
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
  const siteId = presentSite.value;
  const year = presentYear.value;
  const reports = reportsCache[siteId] || {};

  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    document.getElementById(`presentTotalEmployees_${m.num}`).value = rec.presentTotalEmployees || "";
    document.getElementById(`presentTotalPresent_${m.num}`).value = rec.presentTotalPresent || "";
    document.getElementById(`presentSewingTotal_${m.num}`).value = rec.presentSewingTotal || "";
    document.getElementById(`presentSewingPresent_${m.num}`).value = rec.presentSewingPresent || "";
    updatePresentRowPct(m.num);
  }
}

savePresentYearBtn.addEventListener("click", async () => {
  const siteId = presentSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = presentYear.value;

  savePresentYearBtn.disabled = true;
  try {
    await Promise.all(MONTHS.map(m => {
      const totalEmployees = Number(document.getElementById(`presentTotalEmployees_${m.num}`).value) || 0;
      const totalPresent = Number(document.getElementById(`presentTotalPresent_${m.num}`).value) || 0;
      const sewingTotal = Number(document.getElementById(`presentSewingTotal_${m.num}`).value) || 0;
      const sewingPresent = Number(document.getElementById(`presentSewingPresent_${m.num}`).value) || 0;
      return setDoc(
        doc(db, "sites", siteId, "reports", periodIdFor(year, m.num)),
        {
          period: periodLabelFor(year, m.name),
          presentTotalEmployees: totalEmployees,
          presentTotalPresent: totalPresent,
          presentSewingTotal: sewingTotal,
          presentSewingPresent: sewingPresent
        },
        { merge: true }
      );
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

// ── Disciplinary Action — single-month load/save ────────────
disciplinarySite.addEventListener("change", async () => {
  await fetchSiteReports(disciplinarySite.value);
  loadDisciplinaryForm();
});
disciplinaryMonth.addEventListener("change", loadDisciplinaryForm);
disciplinaryYear.addEventListener("change", loadDisciplinaryForm);

function loadDisciplinaryForm() {
  const siteId = disciplinarySite.value;
  const periodId = periodIdFor(disciplinaryYear.value, disciplinaryMonth.value);
  const rec = (reportsCache[siteId] || {})[periodId] || {};
  const deptData = rec.disciplinaryDept || {};
  const letterData = rec.disciplinaryLetter || {};

  DEPARTMENTS.forEach(d => {
    const v = deptData[d.key] || {};
    document.getElementById(`discDeptActions_${d.key}`).value = v.actions || "";
    document.getElementById(`discDeptEmployees_${d.key}`).value = v.employees || "";
    updateDeptRowPct(d.key);
  });
  updateDeptTotals();

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
  const periodId = periodIdFor(disciplinaryYear.value, disciplinaryMonth.value);
  const monthName = MONTHS.find(m => m.num === disciplinaryMonth.value)?.name || disciplinaryMonth.value;

  const disciplinaryDept = {};
  DEPARTMENTS.forEach(d => {
    disciplinaryDept[d.key] = {
      actions: Number(document.getElementById(`discDeptActions_${d.key}`).value) || 0,
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

  saveDisciplinaryBtn.disabled = true;
  try {
    await setDoc(
      doc(db, "sites", siteId, "reports", periodId),
      { period: periodLabelFor(disciplinaryYear.value, monthName), disciplinaryDept, disciplinaryLetter },
      { merge: true }
    );
    showToast(`Saved Disciplinary Action for ${periodId}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
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
  if (siteId === manpowerSite.value) loadManpowerYearTable();
  if (siteId === feedbackSite.value) loadFeedbackYearTable();
  if (siteId === presentSite.value) loadPresentYearTable();
  if (siteId === injuriesSite.value) loadInjuriesYearTable();
  if (siteId === disciplinarySite.value) loadDisciplinaryForm();
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
