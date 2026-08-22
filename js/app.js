import { firebaseConfig } from "./firebase-config.js";
import { CARD_GROUPS } from "./schema.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const siteSelect = document.getElementById("siteSelect");
const periodSelect = document.getElementById("periodSelect");
const siteNameLabel = document.getElementById("siteNameLabel");
const grid = document.getElementById("grid");
const stateMsg = document.getElementById("stateMsg");

let sites = [];
let currentSiteId = null;

function setState(msg) {
  if (msg) {
    stateMsg.textContent = msg;
    stateMsg.style.display = "block";
    grid.style.display = "none";
  } else {
    stateMsg.style.display = "none";
    grid.style.display = "grid";
  }
}

async function loadSites() {
  const snap = await getDocs(query(collection(db, "sites"), orderBy("name")));
  sites = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (sites.length === 0) {
    setState("No sites yet. Go to Admin to add your first site and monthly report.");
    return;
  }

  siteSelect.innerHTML = sites.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  const params = new URLSearchParams(location.search);
  const wanted = params.get("site");
  currentSiteId = sites.some(s => s.id === wanted) ? wanted : sites[0].id;
  siteSelect.value = currentSiteId;
  siteNameLabel.textContent = sites.find(s => s.id === currentSiteId)?.name || "—";

  await loadPeriodsForSite(currentSiteId, params.get("period"));
}

async function loadPeriodsForSite(siteId, wantedPeriod) {
  setState("Loading periods…");
  const snap = await getDocs(query(collection(db, "sites", siteId, "reports"), orderBy("__name__", "desc")));
  const periods = snap.docs.map(d => d.id);

  if (periods.length === 0) {
    periodSelect.innerHTML = "";
    setState("No monthly reports yet for this site. Add one from Admin.");
    return;
  }

  periodSelect.innerHTML = periods.map(p => `<option value="${p}">${p}</option>`).join("");
  const chosen = periods.includes(wantedPeriod) ? wantedPeriod : periods[0];
  periodSelect.value = chosen;
  await loadReport(siteId, chosen);
}

async function loadReport(siteId, periodId) {
  setState("Loading data…");
  const snap = await getDoc(doc(db, "sites", siteId, "reports", periodId));
  if (!snap.exists()) {
    setState("That report could not be found.");
    return;
  }
  renderDashboard(snap.data());
  setState(null);
  syncUrl(siteId, periodId);
}

function syncUrl(siteId, periodId) {
  const params = new URLSearchParams();
  params.set("site", siteId);
  params.set("period", periodId);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function fmt(val, type, signed) {
  if (val === undefined || val === null || val === "") return "—";
  if (type === "text") return val;
  const n = Number(val);
  const sign = signed && n > 0 ? "+" : "";
  const out = type === "percent" ? `${n}%` : `${sign}${n.toLocaleString()}`;
  return out;
}

function ringSvg(pct, small) {
  const size = small ? 52 : 82;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  const offset = c - (clamped / 100) * c;
  return `
  <div class="ring-wrap ${small ? "small" : ""}">
    <svg viewBox="0 0 ${size} ${size}">
      <circle class="ring-track" cx="${size/2}" cy="${size/2}" r="${r}"></circle>
      <circle class="ring-fill" cx="${size/2}" cy="${size/2}" r="${r}"
        stroke-dasharray="${c}" stroke-dashoffset="${c}" data-final-offset="${offset}"></circle>
    </svg>
    <div class="ring-label">${clamped}%</div>
  </div>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function renderDashboard(data) {
  const cards = CARD_GROUPS.map(g => {
    if (g.columns) {
      // Employee Turnover style card: two side-by-side columns, no ring
      const cols = g.columns.map(c => `
        <div class="turnover-col">
          <div class="col-label">${escapeHtml(c.label)}</div>
          <div class="big-value">${fmt(data[c.key], "percent")}</div>
          ${c.subLabel ? `<div class="sub-row"><span>${escapeHtml(c.subLabel)}</span> <b>${fmt(data[c.subKey], "percent")}</b></div>`
                       : `<div class="sub-row"><span></span> <b>${fmt(data[c.subKey], "percent")}</b></div>`}
        </div>`).join("");
      return `
      <div class="card g-${g.area}">
        <div class="card-head">
          <div class="card-icon"><i data-lucide="${g.icon}"></i></div>
          <div><div class="card-title">${escapeHtml(g.title)}</div></div>
        </div>
        <div class="card-body">${cols}</div>
      </div>`;
    }

    const f = g.fields[0];
    const val = data[f.key];
    const negative = f.signed && Number(val) < 0;
    const subVal = g.sub ? data[g.sub.key] : undefined;

    let bodyHtml;
    let subHtml = "";

    if (f.ring && g.sub?.ring) {
      // main ring + small ring side by side (e.g. Present, Training, Direct Manpower, Leave)
      bodyHtml = `
        <div class="card-body">
          ${ringSvg(val, false)}
          <div style="text-align:right;">
            <div style="font-size:11.5px;color:var(--muted);margin-bottom:4px;">${escapeHtml(g.sub.label)}</div>
            ${ringSvg(subVal, true)}
          </div>
        </div>`;
    } else if (f.ring) {
      bodyHtml = `<div class="card-body">${ringSvg(val, false)}</div>`;
    } else {
      bodyHtml = `
        <div class="card-body">
          <div class="big-value ${negative ? "negative" : ""}">${fmt(val, f.type, f.signed)}</div>
        </div>`;
    }

    if (g.sub && !g.sub.ring) {
      const subNeg = g.sub.signed && Number(subVal) < 0;
      subHtml = `<div class="sub-row ${subNeg ? "negative" : ""}"><span>${escapeHtml(g.sub.label)}</span> <b>${fmt(subVal, g.sub.type, g.sub.signed)}</b></div>`;
    }

    const captionHtml = g.caption ? `<div class="card-caption">${escapeHtml(g.caption)}</div>` : "";
    const noteHtml = g.note ? `<div class="period-note">${escapeHtml(g.note)}</div>` : "";

    return `
      <div class="card g-${g.area}">
        <div class="card-head">
          <div class="card-icon"><i data-lucide="${g.icon}"></i></div>
          <div>
            <div class="card-title">${escapeHtml(g.title)}</div>
            ${captionHtml}
          </div>
        </div>
        ${bodyHtml}
        ${subHtml}
        ${noteHtml}
      </div>`;
  }).join("");

  grid.innerHTML = cards;
  if (window.lucide) lucide.createIcons();

  // animate rings after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll(".ring-fill").forEach(c => {
        c.style.strokeDashoffset = c.dataset.finalOffset;
      });
    });
  });
}

siteSelect.addEventListener("change", async () => {
  currentSiteId = siteSelect.value;
  siteNameLabel.textContent = sites.find(s => s.id === currentSiteId)?.name || "—";
  await loadPeriodsForSite(currentSiteId);
});

periodSelect.addEventListener("change", async () => {
  await loadReport(currentSiteId, periodSelect.value);
});

setState("Loading dashboard…");
loadSites().catch(err => {
  console.error(err);
  setState("Could not load data. Check the Firebase config in js/firebase-config.js and your Firestore security rules.");
});
