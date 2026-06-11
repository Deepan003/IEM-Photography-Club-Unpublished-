/** Frontend mirror of server/utils/yearCalc.js — same logic, no Node deps */

// ── Session helpers ───────────────────────────────────────────────────────────
// Academic session runs June 1 → May 31.
// e.g. June 2025 – May 2026 = "2025-26"

/** Best date field from an event / competition / activity object */
export function getPrimaryItemDate(item) {
  return item?.eventDates?.[0] || item?.eventDate || item?.startDate || (item?.dates || [])[0] || item?.createdAt || null
}

/** "2024-25" style session string for a given date */
export function getItemSession(date) {
  if (!date) return null
  const d  = new Date(date)
  const yr = d.getFullYear()
  const mo = d.getMonth() + 1   // 1-indexed
  return mo >= 6
    ? `${yr}-${String(yr + 1).slice(-2)}`
    : `${yr - 1}-${String(yr).slice(-2)}`
}

/** Session string for today */
export function currentSession() {
  return getItemSession(new Date())
}

/** True if item's primary date belongs to the current academic session */
export function isCurrentSession(item) {
  const d = getPrimaryItemDate(item)
  return !!d && getItemSession(d) === currentSession()
}

export function computeAcademicYear(startYear, endYear, refDate = new Date()) {
  const month = refDate.getMonth()
  const year  = refDate.getFullYear()
  const academicBaseYear = month >= 5 ? year : year - 1
  const studyYear  = academicBaseYear - Number(startYear) + 1
  const totalYears = Number(endYear) - Number(startYear)

  if (!startYear || !endYear || isNaN(studyYear)) return { label: '', isPassout: false }
  if (studyYear <= 0)        return { label: 'Not Started', isPassout: false }
  if (studyYear > totalYears) return { label: 'Passout', isPassout: true, year: studyYear }

  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th']
  const ord = ordinals[studyYear - 1] ?? `${studyYear}th`
  return { label: `${ord} Year`, isPassout: false, year: studyYear }
}
