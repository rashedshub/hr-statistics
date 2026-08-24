import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export function currentPeriodId() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodYear(periodId) {
  const m = /^(\d{4})-(\d{2})$/.exec(periodId);
  return m ? m[1] : null;
}

// Always prefer the real current month; if no data has been entered for it yet,
// fall back to the most recent month at or before now that does have data;
// only if nothing qualifies do we fall back to whatever's newest overall.
export function pickDefaultPeriod(periods, wantedFromUrl) {
  if (wantedFromUrl && periods.includes(wantedFromUrl)) return wantedFromUrl;
  const nowId = currentPeriodId();
  if (periods.includes(nowId)) return nowId;
  const upToNow = periods.filter(p => p <= nowId).sort();
  if (upToNow.length) return upToNow[upToNow.length - 1];
  return periods[0];
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

export async function loadSitesList() {
  const snap = await getDocs(query(collection(db, "sites"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchSiteReportsMap(siteId) {
  const snap = await getDocs(collection(db, "sites", siteId, "reports"));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data(); });
  return map;
}
