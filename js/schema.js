// ─────────────────────────────────────────────────────────────
// Single source of truth for every KPI field on the dashboard.
// Add a field here and it automatically appears in both the
// public dashboard and the admin entry form.
//
// type: "text"   -> plain text value (e.g. "Dec/24")
//       "number" -> plain number, no % sign
//       "percent"-> number rendered with a % sign (and a ring if ring:true)
// ring: draw an animated circular progress indicator
// sub:  optional secondary value shown under the main number
//       { key, label, type }
// ─────────────────────────────────────────────────────────────

export const CARD_GROUPS = [
  {
    area: "period",
    icon: "calendar",
    title: "Period",
    fields: [{ key: "period", type: "text", big: true }],
    note: "*YTD - Year to Date\n*FY - Fiscal Year"
  },
  {
    area: "manpower",
    icon: "users",
    title: "Manpower",
    fields: [{ key: "manpower", type: "number" }],
    sub: { key: "manpowerYtdAvg", label: "YTD (Average):", type: "number" }
  },
  {
    area: "directmp",
    icon: "user-check",
    title: "Direct Manpower",
    fields: [{ key: "directManpower", type: "percent", ring: true }],
    sub: { key: "directManpowerYtdAvg", label: "YTD (Average):", type: "percent", ring: true, small: true }
  },
  {
    area: "shortage",
    icon: "shield-alert",
    title: "Manpower excess/ (shortage)",
    fields: [{ key: "manpowerShortage", type: "number", signed: true }],
    sub: { key: "manpowerShortageYtdAvg", label: "YTD (Average):", type: "number", signed: true }
  },
  {
    area: "present",
    icon: "user-round-check",
    title: "Present",
    fields: [{ key: "present", type: "percent", ring: true }],
    sub: { key: "presentYtdAvg", label: "YTD (Average):", type: "percent", ring: true, small: true }
  },
  {
    area: "training",
    icon: "presentation",
    title: "Training",
    caption: "% completion vs plan",
    fields: [{ key: "training", type: "percent", ring: true }],
    sub: { key: "trainingFY", label: "FY:", type: "percent", ring: true, small: true }
  },
  {
    area: "turnover",
    icon: "refresh-cw",
    title: "Employee Turnover",
    wide: true,
    columns: [
      {
        label: "After probation",
        key: "turnoverAfterProbation",
        subKey: "turnoverAfterProbationYtdAvg",
        subLabel: "YTD (Average):"
      },
      {
        label: "Total: before and after probation",
        key: "turnoverTotal",
        subKey: "turnoverTotalYtdAvg",
        subLabel: ""
      }
    ]
  },
  {
    area: "leave",
    icon: "calendar-clock",
    title: "Leave Consumption",
    fields: [{ key: "leaveConsumption", type: "percent", ring: true }],
    sub: { key: "leaveConsumptionFY", label: "FY:", type: "percent", ring: true, small: true }
  },
  {
    area: "injuries",
    icon: "user-round-x",
    title: "Injuries",
    fields: [{ key: "injuries", type: "number" }],
    sub: { key: "injuriesYtdCumulative", label: "YTD (Cumulative):", type: "number" }
  },
  {
    area: "attendance",
    icon: "pencil-line",
    title: "Attendance through manual adjustment",
    fields: [{ key: "attendanceManual", type: "number" }],
    sub: { key: "attendanceManualYtdCumulative", label: "YTD (Cumulative):", type: "number" }
  },
  {
    area: "cash",
    icon: "banknote",
    title: "Cash payment on wages",
    fields: [{ key: "cashPayment", type: "number" }],
    sub: { key: "cashPaymentYtdCumulative", label: "YTD (Cumulative):", type: "number" }
  },
  {
    area: "unpaid",
    icon: "credit-card-off",
    title: "Employees with unpaid wage",
    fields: [{ key: "unpaidWage", type: "number" }],
    sub: { key: "unpaidWageYtdOutstanding", label: "YTD Outstanding:", type: "number" }
  },
  {
    area: "zt",
    icon: "ban",
    title: "ZT issues",
    fields: [{ key: "ztIssues", type: "number" }],
    sub: { key: "ztIssuesYtdOutstanding", label: "YTD Outstanding:", type: "number" }
  },
  {
    area: "hours",
    icon: "clock",
    title: "Workers with excessive working hours",
    fields: [{ key: "excessiveHours", type: "percent" }]
  },
  {
    area: "feedback",
    icon: "message-circle",
    title: "Employees Feedback Received",
    fields: [{ key: "feedback", type: "number" }],
    sub: { key: "feedbackYtdCumulative", label: "YTD (Cumulative):", type: "number" }
  },
  {
    area: "oneonone",
    icon: "users-round",
    title: "Workers one-on-one interview",
    fields: [{ key: "oneOnOne", type: "number" }],
    sub: { key: "oneOnOneYtdCumulative", label: "YTD (Cumulative):", type: "number" }
  },
  {
    area: "disciplinary",
    icon: "scale",
    title: "Outstanding Disciplinary",
    caption: "(>45 Days)",
    fields: [{ key: "disciplinary", type: "number" }]
  }
];

// Flat list of every simple field key (for building the admin form + empty record)
export function emptyReport() {
  const rec = {};
  for (const g of CARD_GROUPS) {
    if (g.fields) for (const f of g.fields) rec[f.key] = f.type === "text" ? "" : 0;
    if (g.sub) rec[g.sub.key] = 0;
    if (g.columns) for (const c of g.columns) { rec[c.key] = 0; rec[c.subKey] = 0; }
  }
  return rec;
}
