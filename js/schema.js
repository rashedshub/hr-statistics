// ─────────────────────────────────────────────────────────────
// Dashboard topics, built one at a time.
// Each topic has its own admin fields and its own render logic
// in app.js. Flip `enabled: true` here once a topic's dashboard
// panel has been built, so it starts showing up for everyone.
// ─────────────────────────────────────────────────────────────

export const TOPICS = [
  {
    id: "leave",
    title: "Leave Consumption",
    icon: "calendar-clock",
    enabled: true,
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

  // ── Not built yet — next topics to add, one at a time ──────
  { id: "manpower", title: "Manpower", icon: "users", enabled: false, fields: [] },
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
