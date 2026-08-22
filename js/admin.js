import { firebaseConfig } from "./firebase-config.js";
import { CARD_GROUPS, emptyReport } from "./schema.js";
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

// ── DOM refs ──────────────────────────────────────────────
const checkingMsg = document.getElementById("checkingMsg");
const adminShell = document.getElementById("adminShell");
const logoutBtn = document.getElementById("logoutBtn");

const sitesList = document.getElementById("sitesList");
const newSiteName = document.getElementById("newSiteName");
const addSiteBtn = document.getElementById("addSiteBtn");

const formSite = document.getElementById("formSite");
const formPeriodId = document.getElementById("formPeriodId");
const formPeriodLabel = document.getElementById("formPeriodLabel");
const dynamicFormArea = document.getElementById("dynamicFormArea");
const saveReportBtn = document.getElementById("saveReportBtn");
const clearFormBtn = document.getElementById("clearFormBtn");

const reportsSiteFilter = document.getElementById("reportsSiteFilter");
const reportsList = document.getElementById("reportsList");
const toast = document.getElementById("toast");

let sitesCache = [];

// ── Auth guard ────────────────────────────────────────────
// This page is protected: no session → send to login.html.
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
    </li>`).join("") || `<li><span style="color:#8794a8;">No sites yet — add one above.</span></li>`;

  const options = sitesCache.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  formSite.innerHTML = options;
  reportsSiteFilter.innerHTML = options;

  sitesList.querySelectorAll("button.del").forEach(btn => {
    btn.addEventListener("click", () => deleteSite(btn.dataset.site));
  });

  if (sitesCache.length) await refreshReportsList();
}

addSiteBtn.addEventListener("click", async () => {
  const name = newSiteName.value.trim();
  if (!name) return;
  await addDoc(collection(db, "sites"), { name });
  newSiteName.value = "";
  showToast(`Added site "${name}"`);
  await refreshSites();
});

async function deleteSite(siteId) {
  const site = sitesCache.find(s => s.id === siteId);
  if (!confirm(`Delete "${site?.name}" and ALL its monthly reports? This cannot be undone.`)) return;
  const reportsSnap = await getDocs(collection(db, "sites", siteId, "reports"));
  await Promise.all(reportsSnap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "sites", siteId));
  showToast("Site deleted");
  await refreshSites();
}

// ── Dynamic form ──────────────────────────────────────────
function buildForm() {
  let html = "";
  for (const g of CARD_GROUPS) {
    html += `<div class="form-group-title">${escapeHtml(g.title)}</div>`;
    if (g.columns) {
      for (const c of g.columns) {
        html += inputField(c.key, `${g.title} — ${c.label}`, "number", true);
        html += inputField(c.subKey, `${g.title} — ${c.label} (YTD avg)`, "number", true);
      }
      continue;
    }
    for (const f of g.fields) {
      if (f.key === "period") continue; // handled by dedicated Period label field
      html += inputField(f.key, g.title, f.type === "text" ? "text" : "number", f.type !== "text");
    }
    if (g.sub) {
      html += inputField(g.sub.key, `${g.title} — ${g.sub.label.replace(":", "")}`, "number", true);
    }
  }
  dynamicFormArea.innerHTML = `<div class="form-grid">${html}</div>`;
}

function inputField(key, label, type, isNumber) {
  return `
    <div class="field">
      <label>${escapeHtml(label)}</label>
      <input type="${type}" id="field_${key}" data-key="${key}" ${isNumber ? 'step="any"' : ""}>
    </div>`;
}

buildForm();

function collectFormData() {
  const data = emptyReport();
  data.period = formPeriodLabel.value.trim();
  dynamicFormArea.querySelectorAll("input[data-key]").forEach(inp => {
    const key = inp.dataset.key;
    data[key] = inp.type === "number" ? (inp.value === "" ? 0 : Number(inp.value)) : inp.value;
  });
  return data;
}

function populateForm(data) {
  formPeriodLabel.value = data.period || "";
  dynamicFormArea.querySelectorAll("input[data-key]").forEach(inp => {
    const key = inp.dataset.key;
    inp.value = data[key] ?? "";
  });
}

clearFormBtn.addEventListener("click", () => {
  formPeriodId.value = "";
  formPeriodLabel.value = "";
  populateForm(emptyReport());
});

saveReportBtn.addEventListener("click", async () => {
  const siteId = formSite.value;
  const periodId = formPeriodId.value.trim();
  if (!siteId) { showToast("Add a site first"); return; }
  if (!periodId) { showToast("Enter a period ID, e.g. 2026-08"); return; }
  const data = collectFormData();
  try {
    await setDoc(doc(db, "sites", siteId, "reports", periodId), data);
    showToast(`Saved report ${periodId}`);
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
  const snap = await getDocs(collection(db, "sites", siteId, "reports"));
  if (snap.empty) {
    reportsList.innerHTML = `<li><span style="color:#8794a8;">No reports for this site yet.</span></li>`;
    return;
  }
  const sortedDocs = [...snap.docs].sort((a, b) => b.id.localeCompare(a.id));
  reportsList.innerHTML = sortedDocs.map(d => `
    <li>
      <span>${d.id} — ${escapeHtml(d.data().period || "")}</span>
      <span class="row-actions">
        <button class="edit" data-site="${siteId}" data-period="${d.id}">Edit</button>
        <button class="del" data-site="${siteId}" data-period="${d.id}">Delete</button>
      </span>
    </li>`).join("");

  reportsList.querySelectorAll("button.edit").forEach(btn => {
    btn.addEventListener("click", () => loadReportIntoForm(btn.dataset.site, btn.dataset.period));
  });
  reportsList.querySelectorAll("button.del").forEach(btn => {
    btn.addEventListener("click", () => deleteReport(btn.dataset.site, btn.dataset.period));
  });
}

async function loadReportIntoForm(siteId, periodId) {
  const snap = await getDoc(doc(db, "sites", siteId, "reports", periodId));
  if (!snap.exists()) return;
  formSite.value = siteId;
  formPeriodId.value = periodId;
  populateForm(snap.data());
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(`Loaded ${periodId} for editing`);
}

async function deleteReport(siteId, periodId) {
  if (!confirm(`Delete report ${periodId}? This cannot be undone.`)) return;
  await deleteDoc(doc(db, "sites", siteId, "reports", periodId));
  showToast("Report deleted");
  await refreshReportsList();
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
