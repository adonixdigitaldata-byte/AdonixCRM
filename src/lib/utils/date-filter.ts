export type DateFilterPreset =
  | 'ALL'
  | 'TODAY'
  | 'PAST_3_DAYS'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'CUSTOM'
  | string

export interface DateFilterOption {
  value: string
  label: string
}

export const DATE_FILTER_PRESETS: DateFilterOption[] = [
  { value: 'ALL', label: 'All Time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'PAST_3_DAYS', label: 'Past 3 Days' },
  { value: 'THIS_WEEK', label: 'This Week' },
  { value: 'THIS_MONTH', label: 'This Month' },
]

/**
 * Returns ISO strings { start, end } for Supabase / SQL queries.
 */
export function getDateFilterBounds(
  filter: string,
  customStart?: string,
  customEnd?: string
): { start?: string; end?: string } {
  if (!filter || filter === 'ALL') {
    return {}
  }

  const now = new Date()

  if (filter === 'TODAY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }

  if (filter === 'PAST_3_DAYS') {
    // 3 calendar days: today, yesterday, and the day before yesterday
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }

  if (filter === 'THIS_WEEK') {
    // Monday as start of week
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }

  if (filter === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }

  if (filter.startsWith('month:') || /^\d{4}-\d{2}$/.test(filter)) {
    const monthKey = filter.replace('month:', '')
    const [yStr, mStr] = monthKey.split('-')
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10)
    if (!isNaN(y) && !isNaN(m)) {
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
      const end = new Date(y, m, 0, 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
  }

  if (filter === 'CUSTOM') {
    let start: string | undefined
    let end: string | undefined
    if (customStart) {
      const [sy, sm, sd] = customStart.split('-').map(Number)
      start = new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString()
    }
    if (customEnd) {
      const [ey, em, ed] = customEnd.split('-').map(Number)
      end = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString()
    }
    return { start, end }
  }

  return {}
}

/**
 * Checks if a given date string or Date object satisfies the filter condition.
 */
export function isDateInFilterRange(
  dateInput: string | Date | null | undefined,
  filter: string,
  customStart?: string,
  customEnd?: string
): boolean {
  if (!filter || filter === 'ALL') {
    return true
  }
  if (!dateInput) {
    return false
  }

  let itemDate: Date
  if (dateInput instanceof Date) {
    itemDate = dateInput
  } else {
    // If it's pure YYYY-MM-DD, parse safely in local time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      const [y, m, d] = dateInput.trim().split('-').map(Number)
      itemDate = new Date(y, m - 1, d, 12, 0, 0)
    } else {
      itemDate = new Date(dateInput)
    }
  }

  if (isNaN(itemDate.getTime())) {
    return false
  }

  const now = new Date()

  if (filter === 'TODAY') {
    return (
      itemDate.getFullYear() === now.getFullYear() &&
      itemDate.getMonth() === now.getMonth() &&
      itemDate.getDate() === now.getDate()
    )
  }

  if (filter === 'PAST_3_DAYS') {
    const start3DaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return itemDate >= start3DaysAgo && itemDate <= endOfToday
  }

  if (filter === 'THIS_WEEK') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0)
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999)
    return itemDate >= startOfWeek && itemDate <= endOfWeek
  }

  if (filter === 'THIS_MONTH') {
    return (
      itemDate.getFullYear() === now.getFullYear() &&
      itemDate.getMonth() === now.getMonth()
    )
  }

  if (filter.startsWith('month:') || /^\d{4}-\d{2}$/.test(filter)) {
    const monthKey = filter.replace('month:', '')
    const [yStr, mStr] = monthKey.split('-')
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10)
    return itemDate.getFullYear() === y && itemDate.getMonth() === m - 1
  }

  if (filter === 'CUSTOM') {
    if (customStart) {
      const [sy, sm, sd] = customStart.split('-').map(Number)
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0)
      if (itemDate < start) return false
    }
    if (customEnd) {
      const [ey, em, ed] = customEnd.split('-').map(Number)
      const end = new Date(ey, em - 1, ed, 23, 59, 59, 999)
      if (itemDate > end) return false
    }
    return true
  }

  return true
}

/**
 * Extracts month options with counts from an array of records.
 */
export function extractAvailableMonths<T>(
  items: T[],
  dateGetter: (item: T) => string | null | undefined
): Array<{ value: string; label: string; count: number }> {
  const monthMap = new Map<string, number>()
  for (const item of items) {
    const raw = dateGetter(item)
    if (!raw) continue
    const dateStr = raw.trim()
    let d: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, day] = dateStr.split('-').map(Number)
      d = new Date(y, m - 1, day, 12, 0, 0)
    } else {
      d = new Date(dateStr)
    }
    if (isNaN(d.getTime())) continue
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${y}-${m}`
    monthMap.set(key, (monthMap.get(key) || 0) + 1)
  }

  const result = Array.from(monthMap.entries()).map(([value, count]) => {
    const [y, m] = value.split('-')
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    return {
      value,
      label: `${label} (${count})`,
      count,
    }
  })

  result.sort((a, b) => b.value.localeCompare(a.value))
  return result
}
