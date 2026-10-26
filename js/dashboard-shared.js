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

// The month before the current one, e.g. in October this is "2026-09" (December -> January rolls back a year).
export function previousPeriodId(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// The dashboard opens on LAST month (the last completed month), not the month in progress.
// If last month has no data yet, fall back to the most recent earlier month that does;
// if there is nothing at or before last month, use whatever is newest overall.
// A month asked for explicitly (e.g. a shared link) always wins.
export function pickDefaultPeriod(periods, wantedFromUrl, now = new Date()) {
  if (wantedFromUrl && periods.includes(wantedFromUrl)) return wantedFromUrl;
  const target = previousPeriodId(now);
  if (periods.includes(target)) return target;
  const upToTarget = periods.filter(p => p <= target).sort();
  if (upToTarget.length) return upToTarget[upToTarget.length - 1];
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
