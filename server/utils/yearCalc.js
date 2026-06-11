/**
 * IEM Photography Club — Academic Year Calculator
 *
 * Session: July 1 → May 31  (academic year name = July's calendar year)
 * Promotion trigger: June 1 each year (before new July session starts)
 *
 * Example (today = May 30, 2026):
 *   startYear=2023, endYear=2027 → 3rd Year  ✓
 * Example (today = June 1, 2026):
 *   startYear=2023, endYear=2027 → 4th Year  ✓ (promoted)
 * Example (today = June 1, 2027):
 *   startYear=2023, endYear=2027 → Passout   ✓
 */
export function computeAcademicYear(startYear, endYear, refDate = new Date()) {
  const month = refDate.getMonth() // 0=Jan … 5=Jun … 11=Dec
  const year  = refDate.getFullYear()

  // June (month=5) and above → we treat it as the upcoming academic year having started
  const academicBaseYear = month >= 5 ? year : year - 1

  const studyYear   = academicBaseYear - startYear + 1
  const totalYears  = endYear - startYear

  if (studyYear <= 0) {
    return { label: 'Not Started Yet', isPassout: false, isNotStarted: true, year: 0 }
  }
  if (studyYear > totalYears) {
    return { label: 'Passout', isPassout: true, isNotStarted: false, year: studyYear }
  }

  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th']
  const ord = ordinals[studyYear - 1] ?? `${studyYear}th`
  return { label: `${ord} Year`, isPassout: false, isNotStarted: false, year: studyYear }
}

/** Returns true if this student should be flagged Passout right now */
export function isPassout(startYear, endYear) {
  return computeAcademicYear(startYear, endYear).isPassout
}
