// Shared WH notification helpers — imported by both WHUploadsPage (component)
// and App (for the notification bell), so WHUploadsPage can be lazy-loaded.

export function getNextDueDate(cat, lastUploadDate) {
  const now = new Date()
  const last = lastUploadDate ? new Date(lastUploadDate) : null
  if (cat.frequencyType === 'monthly') {
    const day = Math.max(1, Math.min(28, Number(cat.frequencyValue) || 1))
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), day)
    if (!last) return thisMonth
    const lastMonthDue = new Date(last.getFullYear(), last.getMonth(), day)
    if (last >= lastMonthDue) return new Date(now.getFullYear(), now.getMonth() + 1, day)
    return thisMonth
  }
  if (cat.frequencyType === 'weekly') {
    const interval = Math.max(1, Number(cat.frequencyValue) || 7)
    if (!last) return new Date(now.getTime() - 1)
    return new Date(last.getTime() + interval * 24 * 60 * 60 * 1000)
  }
  if (cat.frequencyType === 'days') {
    const interval = Math.max(1, Number(cat.frequencyValue) || 30)
    if (!last) return new Date(now.getTime() - 1)
    return new Date(last.getTime() + interval * 24 * 60 * 60 * 1000)
  }
  return null
}

export function getCategoryStatus(cat, uploads) {
  const catUploads = uploads.filter(u => u.categoryId === cat.id)
  const last = catUploads.length
    ? catUploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
    : null
  const nextDue = getNextDueDate(cat, last?.uploadedAt)
  if (!nextDue) return { status: 'ok', nextDue: null, last }
  const now = new Date()
  const daysUntilDue = Math.ceil((nextDue - now) / (1000 * 60 * 60 * 24))
  const reminder = Number(cat.reminderDaysBefore) || 3
  if (daysUntilDue < 0) return { status: 'overdue', nextDue, daysUntilDue, last }
  if (daysUntilDue <= reminder) return { status: 'due-soon', nextDue, daysUntilDue, last }
  return { status: 'ok', nextDue, daysUntilDue, last }
}

export const fmtShort = (d) =>
  d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((date - firstThursday) / (7 * 86400000))
  return { year: date.getUTCFullYear(), week }
}

export function isoWeekMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const w1Mon = new Date(jan4); w1Mon.setUTCDate(jan4.getUTCDate() - jan4Day)
  const mon = new Date(w1Mon); mon.setUTCDate(w1Mon.getUTCDate() + (week - 1) * 7)
  return mon
}

export function isoWeekDeadline(year, week) {
  const m = isoWeekMonday(year, week)
  const wed = new Date(m); wed.setUTCDate(m.getUTCDate() + 2)
  return new Date(wed.getUTCFullYear(), wed.getUTCMonth(), wed.getUTCDate(), 23, 59, 59)
}

export function aggregateWeekly(cat, uploads) {
  const now = new Date()
  const { year, week: currentWeek } = getISOWeek(now)
  let overdue = 0, done = 0
  for (let w = 1; w <= currentWeek; w++) {
    const key = `${year}-W${w}`
    const ups = uploads.filter(u => u.categoryId === cat.id && u.weekKey === key)
    if (ups.length) { done++; continue }
    if (now > isoWeekDeadline(year, w)) overdue++
  }
  const currentDone = uploads.some(u => u.categoryId === cat.id && u.weekKey === `${year}-W${currentWeek}`)
  const status = overdue > 0 ? 'overdue' : (!currentDone ? 'due-soon' : 'ok')
  const catUploads = uploads.filter(u => u.categoryId === cat.id)
  const last = catUploads.length ? catUploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0] : null
  return { status, overdue, done, total: currentWeek, currentWeek, year, last }
}

export function buildWHNotifications(categories, uploads, user, canEditWH) {
  if (!user) return []
  const out = []
  const mine = (cat) => cat.assignedUser ? cat.assignedUser === user.username : canEditWH
  for (const cat of (categories || []).filter(c => c.active !== false)) {
    if (!mine(cat)) continue
    if (cat.mode === 'weekly') {
      const agg = aggregateWeekly(cat, uploads)
      const periodKey = `${agg.year}-W${agg.currentWeek}`
      if (agg.overdue > 0) {
        out.push({ id: `wh::${cat.id}::overdue::${periodKey}`, whTab: true, severity: 'error',
          title: `${cat.name} overdue`,
          detail: `${agg.overdue} week${agg.overdue > 1 ? 's' : ''} not uploaded — most recent was due Wednesday.`,
          timestamp: isoWeekDeadline(agg.year, agg.currentWeek).toISOString() })
      } else if (agg.status === 'due-soon') {
        out.push({ id: `wh::${cat.id}::due::${periodKey}`, whTab: true, severity: 'warning',
          title: `${cat.name} due this week`,
          detail: `Week ${agg.currentWeek} upload is due by Wednesday.`,
          timestamp: isoWeekDeadline(agg.year, agg.currentWeek).toISOString() })
      }
    } else {
      const s = getCategoryStatus(cat, uploads)
      const periodKey = s.nextDue ? new Date(s.nextDue).toISOString().slice(0, 10) : 'na'
      if (s.status === 'overdue') {
        out.push({ id: `wh::${cat.id}::overdue::${periodKey}`, whTab: true, severity: 'error',
          title: `${cat.name} overdue`,
          detail: `Was due ${fmtShort(s.nextDue)}${s.last ? ` · last upload ${fmtShort(s.last.uploadedAt)}` : ' · never uploaded'}.`,
          timestamp: (s.nextDue || new Date()).toString() === 'Invalid Date' ? new Date().toISOString() : new Date(s.nextDue).toISOString() })
      } else if (s.status === 'due-soon') {
        out.push({ id: `wh::${cat.id}::due::${periodKey}`, whTab: true, severity: 'warning',
          title: `${cat.name} due soon`,
          detail: `Due ${fmtShort(s.nextDue)} (in ${s.daysUntilDue} day${s.daysUntilDue !== 1 ? 's' : ''}).`,
          timestamp: new Date(s.nextDue).toISOString() })
      }
    }
  }
  return out
}
