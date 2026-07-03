import { STATUS } from './mockData'

// Independent safety-net checks run on the dashboard, regardless of the sheet's
// status. Returns an array of human-readable problem strings (empty = looks OK).
// These catch things that should probably be an error even if the sheet didn't
// flag them.
export function getOrderIssues(order) {
  const issues = []
  if (!order) return issues

  // Don't second-guess rows that are already booked or already flagged
  const alreadyFlagged = order.status === STATUS.ERROR || order.status === STATUS.BOOKING_FAILED
  const booked = order.status === STATUS.BOOKED || order.status === STATUS.BOOKING

  // --- Items / dimensions ---
  if (!order.items || order.items.length === 0) {
    issues.push('No items on this order')
  } else {
    order.items.forEach(it => {
      const label = it.sku || 'item'
      if (!it.sku) issues.push('An item is missing its part number')
      if (it.qty > 10) issues.push(`${label}: quantity is ${it.qty} (over 10 — check the slip)`)
      if (it.qty <= 0) issues.push(`${label}: quantity is 0`)
      if (it.h <= 0 || it.w <= 0 || it.l <= 0) issues.push(`${label}: missing dimensions`)
      if (it.kg <= 0) issues.push(`${label}: missing weight`)
    })
  }

  // --- Address ---
  if (!order.address?.street) issues.push('Missing street address')
  if (!order.address?.city) issues.push('Missing city')
  if (!order.address?.postalCode) issues.push('Missing postal code')

  // --- Contact ---
  if (!order.customer?.phone && !order.customer?.email) {
    issues.push('No phone or email for the customer')
  }

  // --- KZN warning (TCG frequently has issues delivering to KwaZulu-Natal) ---
  if (!booked) {
    const province = (order.address?.province || '').toLowerCase().trim()
    if (province === 'kzn' || province === 'kwazulu-natal' || province === 'kwazulu natal') {
      issues.push('Destination is KZN — TCG often has delivery issues here. Consider using EPX or Triangle, and double-check the address.')
    }
  }

  // --- Courier / quotes (only relevant once it's being quoted, not booked) ---
  if (!booked && !alreadyFlagged) {
    if (order.tcgQuote == null && order.epxQuote == null && order.status === STATUS.QUOTED) {
      issues.push('Status is Quoted but no quote amount is present')
    }
  }

  return issues
}

export function hasIssues(order) {
  return getOrderIssues(order).length > 0
}
