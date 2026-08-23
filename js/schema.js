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
    title: "Total Manpower",
    icon: "users",
    enabled: true,
    customAdminUI: true, // has its own year-at-a-glance table in admin.js — skipped by the generic form
    fields: [
      { key: "workerManpower", label: "Worker (headcount)", type: "number" },
      { key: "nonWorkerManpower", label: "Non-Worker (headcount)", type: "number" },
      { key: "closingManpower", label: "Total closing manpower (derived: Worker + Non-Worker)", type: "number" }
    ]
  },

  // ── Not built yet — next topics to add, one at a time ──────
  { id: "directManpower", title: "Direct Manpower", icon: "user-check", enabled: false, fields: [] },
  { id: "manpowerShortage", title: "Manpower excess/(shortage)", icon: "shield-alert", enabled: false, fields: [] },
  { id: "present", title: "Present", icon: "user-round-check", enabled: false, fields: [] },
  { id: "training", title: "Training", icon: "presentation", enabled: false, fields: [] },
  { id: "turnover", title: "Employee Turnover", icon: "refresh-cw", enabled: false, fields: [] },
  { id: "injuries", title: "Injuries", icon: "user-round-x", enabled: false, fields: [] },
  { id: "attendance", title: "Attendance through manual adjustment", icon: "pencil-line", enabled: false, fields: [] },
  { id: "cash", title: "Cash payment on wages", icon: "banknote", enabled: false, fields: [] },
  { id: "unpaid", title: "Employees with unpaid wage", icon: "credit-card-off", enabled: false, fields: [] },
  { id: "zt", title: "ZT issues", icon: "ban", enabled: false, fields: [] },
  { id: "hours", title: "Workers with excessive working hours", icon: "clock", enabled: false, fields: [] },
  { id: "feedback", title: "Employees Feedback Received", icon: "message-circle", enabled: false, fields: [] },
  { id: "oneonone", title: "Workers one-on-one interview", icon: "users-round", enabled: false, fields: [] },
  { id: "disciplinary", title: "Outstanding Disciplinary", icon: "scale", enabled: false, fields: [] }
];

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
