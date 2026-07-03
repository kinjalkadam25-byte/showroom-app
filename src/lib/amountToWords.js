const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
}

function threeDigits(n) {
  if (n < 100) return twoDigits(n)
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '')
}

// Converts a non-negative amount into Indian-style words (lakh/crore grouping).
// Only handles the rupee part; paise are ignored (rounded to nearest rupee),
// which matches how the reference document expresses "Rs.Two Lakh Ten Thousand Only".
export function amountToWordsINR(amount) {
  const num = Math.round(Number(amount) || 0)
  if (num === 0) return 'Zero'

  const crore   = Math.floor(num / 10000000)
  const lakh    = Math.floor((num % 10000000) / 100000)
  const thousand = Math.floor((num % 100000) / 1000)
  const rest     = num % 1000

  const parts = []
  if (crore)    parts.push(threeDigits(crore) + ' Crore')
  if (lakh)     parts.push(threeDigits(lakh) + ' Lakh')
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand')
  if (rest)     parts.push(threeDigits(rest))

  return parts.join(' ')
}
