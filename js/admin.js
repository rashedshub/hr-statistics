import { firebaseConfig } from "./firebase-config.js";
import { enabledTopics, MONTHS, periodIdFor, periodLabelFor } from "./schema.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, query, orderBy, doc, setDoc, addDoc, deleteDoc
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

const sitesList = document.getElementById("sitesList");
const newSiteName = document.getElementById("newSiteName");
const addSiteBtn = document.getElementById("addSiteBtn");

const leaveSite = document.getElementById("leaveSite");
const leaveYear = document.getElementById("leaveYear");
const leaveTotalPlanInput = document.getElementById("leaveTotalPlanInput");
const leaveMonthTableBody = document.querySelector("#leaveMonthTable tbody");
const saveLeaveYearBtn = document.getElementById("saveLeaveYearBtn");

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

// ── Auth guard ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    checkingMsg.style.display = "none";
    adminShell.style.display = "block";
    await refreshSites();
  } else {
    window.location.replace("login.html");
  }
});

logoutBtn.addEventListener("click", () => signOut(auth).then(() => window.location.replace("login.html")));

// ── Static dropdown setup (Month / Year — no typing needed) ─
leaveYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
leaveYear.value = CURRENT_YEAR;
formYear.innerHTML = YEARS.map(y => `<option value="${y}">${y}</option>`).join("");
formYear.value = CURRENT_YEAR;
formMonth.innerHTML = MONTHS.map(m => `<option value="${m.num}">${m.name}</option>`).join("");
formMonth.value = CURRENT_MONTH;

leaveMonthTableBody.innerHTML = MONTHS.map(m => `
  <tr>
    <td>${m.name}</td>
    <td><input type="number" step="any" id="leaveMonthPlan_${m.num}"></td>
    <td><input type="number" step="any" id="leaveMonthActual_${m.num}"></td>
  </tr>`).join("");

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
  leaveSite.innerHTML = options;
  formSite.innerHTML = options;
  reportsSiteFilter.innerHTML = options;

  sitesList.querySelectorAll("button.del").forEach(btn => {
    btn.addEventListener("click", () => deleteSite(btn.dataset.site));
  });

  if (sitesCache.length) {
    await fetchSiteReports(leaveSite.value);
    loadLeaveYearTable();
    await refreshReportsList();
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

  let totalPlan = "";
  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)];
    if (rec && rec.totalElPlan) totalPlan = rec.totalElPlan;
  }
  leaveTotalPlanInput.value = totalPlan;

  for (const m of MONTHS) {
    const rec = reports[periodIdFor(year, m.num)] || {};
    document.getElementById(`leaveMonthPlan_${m.num}`).value = rec.monthElPlan || "";
    document.getElementById(`leaveMonthActual_${m.num}`).value = rec.monthElActual || "";
  }
}

saveLeaveYearBtn.addEventListener("click", async () => {
  const siteId = leaveSite.value;
  if (!siteId) { showToast("Add a plant first"); return; }
  const year = leaveYear.value;
  const totalPlan = Number(leaveTotalPlanInput.value) || 0;

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
    showToast(`Saved Leave Consumption for ${year}`);
    await fetchSiteReports(siteId);
    await refreshReportsList();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check console / security rules");
  } finally {
    saveLeaveYearBtn.disabled = false;
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
