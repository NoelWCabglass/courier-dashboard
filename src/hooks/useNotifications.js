import { useMemo, useState, useCallback } from 'react'
import { STATUS } from '../mockData'

// Notifications are DERIVED from the orders the dashboard already loads — there
// is no separate feed to fetch and nothing extra hitting the server. Any order
// in a state that needs a human's attention becomes a notification. Read/unread
// state lives in localStorage so dismissals survive a refresh.

const STORAGE_KEY = 'cabglass_notif_read_v1'

// Each rule turns a matching order into a notification. severity drives colour;
// `type` keeps the id stable per (order, reason) so read-state sticks.
const RULES = [
  {
    type: 'error',
    severity: 'error',
    match: (o) => o.status === STATUS.ERROR,
    title: 'Order error',
    detail: (o) => o.errorMessage || 'This order hit an error during processing and was not quoted.',
  },
  {
    type: 'booking-failed',
    severity: 'error',
    match: (o) => o.status === STATUS.BOOKING_FAILED,
    title: 'Booking failed',
    detail: (o) => o.errorMessage || 'The courier rejected the booking. Review and try again.',
  },
  {
    type: 'booking-stuck',
    severity: 'warning',
    match: (o) => o.status === STATUS.BOOKING,
    title: 'Stuck mid-booking',
    detail: () => 'This order is mid-booking. If it stays here, confirm with TCG whether the shipment was created before clearing the status.',
  },
  {
    type: 'triangle',
    severity: 'warning',
    match: (o) => o.status === STATUS.TRIANGLE,
    title: 'Manual courier (Triangle)',
    detail: () => 'Flagged for Triangle — no automatic quote or booking. This one must be handled manually.',
  },
]

function buildNotifications(orders) {
  const list = []
  for (const o of orders || []) {
    for (const rule of RULES) {
      if (rule.match(o)) {
        list.push({
          id: `${o.psNo}::${rule.type}`,
          orderId: o.id,
          psNo: o.psNo,
          severity: rule.severity,
          title: rule.title,
          detail: rule.detail(o),
          timestamp: o.dateReceived,
        })
      }
    }
  }
  // Newest first
  return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

// Manually-injected test notifications (the "Send test" button). Kept in
// localStorage so they survive a refresh until dismissed.
const TEST_KEY = 'cabglass_notif_test_v1'

function loadReadIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || [])
  } catch {
    return new Set()
  }
}

function loadTest() {
  try {
    return JSON.parse(localStorage.getItem(TEST_KEY)) || []
  } catch {
    return []
  }
}

export function useNotifications(orders) {
  const [readIds, setReadIds] = useState(loadReadIds)
  const [testNotifs, setTestNotifs] = useState(loadTest)

  const persistTest = useCallback((arr) => {
    setTestNotifs(arr)
    try { localStorage.setItem(TEST_KEY, JSON.stringify(arr)) } catch {}
  }, [])

  // A demo notification so staff can see exactly how one looks.
  const sendTest = useCallback(() => {
    const n = {
      id: `test::${Date.now()}`,
      orderId: null,
      psNo: 'TEST',
      severity: 'info',
      title: 'Test notification',
      detail: 'This is a test so you can see how notifications look. Click it, or "Mark all read", to dismiss.',
      timestamp: new Date().toISOString(),
      isTest: true,
    }
    persistTest([n]) // replace, so repeated tests don't pile up
  }, [persistTest])

  const notifications = useMemo(() => {
    const derived = buildNotifications(orders)
    return [...testNotifs, ...derived].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [orders, testNotifs])

  const persist = useCallback((set) => {
    setReadIds(set)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
    } catch { /* storage full / disabled — read-state just won't persist */ }
  }, [])

  const markRead = useCallback((id) => {
    // Dismissing a test notification removes it outright.
    if (id.startsWith('test::')) {
      setTestNotifs(prev => {
        const arr = prev.filter(n => n.id !== id)
        try { localStorage.setItem(TEST_KEY, JSON.stringify(arr)) } catch {}
        return arr
      })
    }
    setReadIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    const next = new Set(readIds)
    notifications.forEach(n => next.add(n.id))
    persist(next)
    persistTest([]) // clear any test notifications too
  }, [notifications, readIds, persist, persistTest])

  const unreadCount = notifications.reduce((n, x) => n + (readIds.has(x.id) ? 0 : 1), 0)

  return {
    notifications,
    unreadCount,
    isRead: (id) => readIds.has(id),
    markRead,
    markAllRead,
    sendTest,
  }
}
