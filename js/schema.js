// ─────────────────────────────────────────────────────────────
// Dashboard topics, built one at a time.
// Each topic has its own admin fields and its own render logic
// in app.js. Flip `enabled: true` here once a topic's dashboard
// panel has been built, so it starts showing up for everyone.
// ─────────────────────────────────────────────────────────────

export const MONTHS = [
  { num: "01", name: "January" }, { num: "02", name: "February" }, { num: "03", name: "March" },
  { num: "04", name: "April" },   { num: "05", name: "May" },      { num: "06", name: "June" },
  { num: "07", name: "July" },    { num: "08", name: "August" },   { num: "09", name: "September" },
  { num: "10", name: "October" }, { num: "11", name: "November" }, { num: "12", name: "December" }
];

export function periodIdFor(year, monthNum) {
  return `${year}-${monthNum}`;
}

export function periodLabelFor(year, monthName) {
  return `${monthName} ${String(year).slice(-2)}`;
}

export const TOPICS = [
  {
    id: "leave",
    title: "Leave Consumption",
    icon: "calendar-clock",
    enabled: true,
    customAdminUI: true, // has its own year-at-a-glance table in admin.js — skipped by the generic form
    fields: [
      { key: "totalElPlan", label: "Total EL (Plan) — annual", type: "number" },
      { key: "monthElPlan", label: "This Month Plan", type: "number" },
      { key: "monthElActual", label: "This Month Actual (consumed)", type: "number" }
    ]
  },
  {
    id: "nwEl",
    title: "NW Plan vs Consumption",
    icon: "calendar-check",
    enabled: true,
    customAdminUI: true, // own department-wise yearly table in admin.js; stored as nwElDept in the monthly report
    fields: [
      { key: "nwElDept", label: "Per department: { planned, enjoyed } (Non-Worker, Asst. Officer to above)", type: "map" },
      { key: "nwElTotalLeave", label: "Total Leave (Plan) per department for the year — saved on every month of that year", type: "map" },
      { key: "nwElPlannedTotal", label: "Planned, all departments (derived)", type: "number" },
      { key: "nwElEnjoyedTotal", label: "Enjoyed, all departments (derived)", type: "number" }
    ]
  },
  {
    id: "sickLeave",
    title: "Sick Leave",
    icon: "thermometer",
    enabled: true,
    fields: [
      { key: "monthSickDays", label: "This Month — sick leave days taken", type: "number" },
      { key: "monthSickEmployees", label: "This Month — employees on sick leave", type: "number" },
      { key: "monthHeadcount", label: "This Month — total headcount", type: "number" }
    ]
  },
  {
    id: "manpower",
    title: "Manpower",
    icon: "users",
    enabled: true,
    customAdminUI: true, // has its own year-at-a-glance table in admin.js — skipped by the generic form
    fields: [
      { key: "workerManpower", label: "Worker (headcount)", type: "number" },
      { key: "nonWorkerManpower", label: "Non-Worker (headcount)", type: "number" },
      { key: "closingManpower", label: "Total (W+NW) — derived: Worker + Non-Worker", type: "number" },
      { key: "sewingOperatorManpower", label: "Sewing Operator (headcount)", type: "number" },
      { key: "sewingHelperManpower", label: "Sewing Helper (headcount)", type: "number" },
      { key: "externalManpower", label: "External (headcount)", type: "number" }
    ]
  },

  {
    id: "feedback",
    title: "Employees Feedback Received",
    icon: "message-circle",
    enabled: true,
    customAdminUI: true, // has its own year-at-a-glance table in admin.js — skipped by the generic form
    fields: [
      { key: "feedbackExternal", label: "External channel (this month)", type: "number" },
      { key: "feedbackInternal", label: "Internal channel (this month)", type: "number" },
      { key: "feedbackTotal", label: "Total (derived: External + Internal)", type: "number" }
    ]
  },
  {
    id: "present",
    title: "Present %",
    icon: "user-round-check",
    enabled: true,
    customAdminUI: true, // own yearly table in admin.js — percentages are entered directly per month
    fields: [
      { key: "presentPctWorker", label: "Present % — Worker", type: "number" },
      { key: "presentPctNonWorker", label: "Present % — Non-Worker", type: "number" },
      { key: "presentPctSewing", label: "Present % — Sewing Worker", type: "number" },
      { key: "presentPctTotal", label: "Present % — Total", type: "number" }
    ]
  },
  {
    id: "injuries",
    title: "Injuries",
    icon: "user-round-x",
    enabled: true,
    customAdminUI: true, // has its own year-at-a-glance table in admin.js — skipped by the generic form
    fields: [
      { key: "injuriesTotal", label: "Total injuries (this month)", type: "number" },
      { key: "injuriesCritical", label: "Critical injuries (this month)", type: "number" }
    ]
  },

  {
    id: "directManpower",
    title: "Direct Manpower",
    icon: "user-check",
    enabled: true,
    customAdminUI: true, // own yearly table in admin.js. % = directManpower / closingManpower (from Total Manpower)
    fields: [
      { key: "directManpower", label: "Direct manpower (headcount)", type: "number" }
    ]
  },
  {
    id: "manpowerShortage",
    title: "Manpower excess/(shortage)",
    icon: "shield-alert",
    enabled: true,
    customAdminUI: true, // own yearly table in admin.js. Sewing worker (Operator + Helper) actual vs standard
    fields: [
      { key: "shortageStdOperator", label: "Standard manpower — Sewing Operator", type: "number" },
      { key: "shortageStdHelper", label: "Standard manpower — Sewing Helper", type: "number" },
      { key: "shortageActualOperator", label: "Actual manpower — Sewing Operator", type: "number" },
      { key: "shortageActualHelper", label: "Actual manpower — Sewing Helper", type: "number" }
    ]
  },

  // ── Not built yet — next topics to add, one at a time ──────
  { id: "training", title: "Training", icon: "presentation", enabled: false, fields: [] },
  { id: "turnover", title: "Employee Turnover", icon: "refresh-cw", enabled: false, fields: [] },
  { id: "attendance", title: "Attendance through manual adjustment", icon: "pencil-line", enabled: false, fields: [] },
  { id: "cash", title: "Cash payment on wages", icon: "banknote", enabled: false, fields: [] },
  { id: "unpaid", title: "Employees with unpaid wage", icon: "credit-card-off", enabled: false, fields: [] },
  { id: "zt", title: "ZT issues", icon: "ban", enabled: false, fields: [] },
  { id: "hours", title: "Workers with excessive working hours", icon: "clock", enabled: false, fields: [] },
  { id: "oneonone", title: "Workers one-on-one interview", icon: "users-round", enabled: false, fields: [] }
];

// Department (function) list for Disciplinary Action.
// Most plants use the default list; specific plants can have their own
// breakdown — e.g. YHT splits "Accounting & Finance" into two departments.
export const DEFAULT_DEPARTMENTS = [
  { key: "accounting", name: "Accounting & Finance" },
  { key: "administration", name: "Administration" },
  { key: "commercial", name: "Commercial" },
  { key: "hr", name: "HR" },
  { key: "production", name: "Production" },
  { key: "quality", name: "Quality" },
  { key: "sales", name: "Sales" }
];

// Keyed by exact plant name (as entered in the Plants panel).
export const DEPARTMENT_OVERRIDES = {
  "YHT": [
    { key: "accounts", name: "Accounts" },
    { key: "administration", name: "Administration" },
    { key: "commercial", name: "Commercial" },
    { key: "finance", name: "Finance" },
    { key: "hr", name: "HR" },
    { key: "production", name: "Production" },
    { key: "quality", name: "Quality" },
    { key: "sales", name: "Sales" }
  ]
};

export function departmentsForSite(siteName) {
  return DEPARTMENT_OVERRIDES[siteName] || DEFAULT_DEPARTMENTS;
}

// Fixed disciplinary-letter-type list (Production only) — same for every plant.
export const LETTER_TYPES = [
  { key: "dismissal", name: "Dismissal" },
  { key: "finalWarning", name: "Final Warning" },
  { key: "stoppageIncrement", name: "Stoppage of Increment" },
  { key: "strongWarning", name: "Strong Warning" },
  { key: "warningLetter", name: "Warning Letter" },
  { key: "cautionary", name: "Cautionary" },
  { key: "verbalWarning", name: "Verbal Warning" },
  { key: "advisoryNote", name: "Advisory Note" },
  { key: "advisoryNote1", name: "Advisory Note -1" },
  { key: "advisoryNote2", name: "Advisory Note -2" },
  { key: "advisoryNote3", name: "Advisory Note -3" },
  { key: "sternWarningLetter", name: "Stern Warning Letter" }
];

// Disciplinary Action is NOT part of the monthly report cycle — it's a single
// summary record per plant, covering whatever period the admin sets (e.g.
// "July 2025 to June 2026"), overwritten in place rather than saved per month.
// It lives at sites/{siteId}/meta/disciplinary — see admin.js / disciplinary.js.
export const DISCIPLINARY_META = { title: "Disciplinary Action", icon: "scale" };

// Present % per month, as numbers (null = not entered). Months saved under the older headcount-based
// entry (presentTotalEmployees / presentTotalPresent, presentSewingTotal / presentSewingPresent) still
// show their Total and Sewing %, until the month is saved again in the new percentage form.
export function presentPercents(rec) {
  rec = rec || {};
  const entered = key => rec[key] !== undefined && rec[key] !== null;
  const val = key => (Number(rec[key]) > 0 ? Number(rec[key]) : null);
  const ratio = (num, den) => (Number(den) > 0 && Number(num) > 0 ? Math.round((Number(num) / Number(den)) * 1000) / 10 : null);
  return {
    worker: val("presentPctWorker"),
    nonWorker: val("presentPctNonWorker"),
    sewing: entered("presentPctSewing") ? val("presentPctSewing") : ratio(rec.presentSewingPresent, rec.presentSewingTotal),
    total: entered("presentPctTotal") ? val("presentPctTotal") : ratio(rec.presentTotalPresent, rec.presentTotalEmployees)
  };
}

export function enabledTopics() {
  return TOPICS.filter(t => t.enabled);
}

// Blank report object covering every enabled topic's fields, plus period label.
export function emptyReport() {
  const rec = { period: "" };
  for (const t of enabledTopics()) {
    for (const f of t.fields) rec[f.key] = 0;
  }
  return rec;
}
