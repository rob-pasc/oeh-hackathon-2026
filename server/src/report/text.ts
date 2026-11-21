// Checks on AI-written text shared by the explanation (feature 004 FR-005) and the category call
// (feature 008 FR-012): no euro or CO2e figures, no calculator claims, and no Windows 11 talk for
// Mac or Linux devices (feature 007 FR-015).

// Normalize subscript ₂ and nonbreaking spaces before matching either unit order.
const currencyFigure = /(?:€|\beur(?:os?)?(?![a-z]))\s*[:=]?\s*[-+]?\s*\d|\d\s*(?:€|eur(?:os?)?\b)/iu
const hardwareQuantity = /\b\d+(?:[.,]\d+)?\s*(?:[kmgt]i?b|[kmg]hz|cores?|threads?|slots?)\b/giu
const carbonUnit = /co2(?:eq|e)?|carbon dioxide(?: equivalent)?/giu
export function hasNoFigure(text: string): boolean {
  const normalized = text.normalize('NFKC')
  // Remove the unit first so the 2 in CO2e alone never counts as a figure.
  const withoutCarbonUnit = normalized.replace(carbonUnit, '')
  return !currencyFigure.test(normalized) &&
    (withoutCarbonUnit === normalized || !/\d/u.test(withoutCarbonUnit.replace(hardwareQuantity, '')))
}

// Displacement and calculated impact estimates belong to the assessment. A retrieval
// citation cannot establish which baseline the calculator credited for this device.
export const calculatorClaim = /\b(?:displacement|credited baseline|avoided purchase|(?:avoid|displace)s? (?:a |the )?new purchase|calculat(?:or|ed) (?:output|impact|estimate)|(?:emissions|impact) estimate (?:in|from) (?:this|the|our) (?:data|table|calculator))\b/i

// A Mac or Linux report must not say a CPU is or is not supported by Windows 11 (feature 007
// FR-015); the prompt asks for that, and this removes any text that still does.
export const windows11 = /\bwindows\s*11\b/iu
