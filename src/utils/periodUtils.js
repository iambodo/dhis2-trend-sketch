const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Convert a DHIS2 period ID to a human-readable label.
 * '2024'    → '2024'
 * '202401'  → 'Jan 2024'
 * '2024Q1'  → 'Q1 2024'
 * '2024W12' → 'W12 2024'
 */
export function formatPeriodId(id) {
    if (!id) return id

    // Weekly: 2024W12
    const weekMatch = id.match(/^(\d{4})W(\d{1,2})$/)
    if (weekMatch) {
        return `W${weekMatch[2]} ${weekMatch[1]}`
    }

    // Quarterly: 2024Q1
    const quarterMatch = id.match(/^(\d{4})Q(\d)$/)
    if (quarterMatch) {
        return `Q${quarterMatch[2]} ${quarterMatch[1]}`
    }

    // Monthly: 202401
    const monthMatch = id.match(/^(\d{4})(\d{2})$/)
    if (monthMatch) {
        const monthIndex = parseInt(monthMatch[2], 10) - 1
        const monthName = MONTH_NAMES[monthIndex] || monthMatch[2]
        return `${monthName} ${monthMatch[1]}`
    }

    // Yearly: 2024
    const yearMatch = id.match(/^\d{4}$/)
    if (yearMatch) {
        return id
    }

    // Financial year: 2024Oct or similar — return as-is for now
    return id
}

const RELATIVE_PERIOD_COUNTS = {
    THIS_WEEK: 1, LAST_WEEK: 1, LAST_4_WEEKS: 4, LAST_12_WEEKS: 12, LAST_52_WEEKS: 52,
    THIS_BIWEEK: 1, LAST_BIWEEK: 1, LAST_4_BIWEEKS: 4,
    THIS_MONTH: 1, LAST_MONTH: 1, LAST_3_MONTHS: 3, LAST_6_MONTHS: 6, LAST_12_MONTHS: 12,
    THIS_BIMONTH: 1, LAST_BIMONTH: 1, LAST_3_BIMONTHS: 3, LAST_6_BIMONTHS: 6,
    THIS_QUARTER: 1, LAST_QUARTER: 1, LAST_4_QUARTERS: 4,
    THIS_SIX_MONTH: 1, LAST_SIX_MONTH: 1, LAST_2_SIXMONTHS: 2,
    THIS_YEAR: 1, LAST_YEAR: 1, LAST_5_YEARS: 5, LAST_10_YEARS: 10,
    THIS_FINANCIAL_YEAR: 1, LAST_FINANCIAL_YEAR: 1,
    LAST_5_FINANCIAL_YEARS: 5, LAST_10_FINANCIAL_YEARS: 10,
    MONTHS_LAST_YEAR: 12, QUARTERS_LAST_YEAR: 4,
}

export function resolveRelativePeriodCount(id) {
    if (!id) return 1
    // Fixed period IDs = 1 each
    if (/^\d{4}$/.test(id)) return 1           // yearly: 2024
    if (/^\d{6}$/.test(id)) return 1           // monthly: 202401
    if (/^\d{4}Q\d$/.test(id)) return 1        // quarterly: 2024Q1
    if (/^\d{4}W\d{1,2}$/.test(id)) return 1  // weekly: 2024W12
    if (/^\d{4}S\d$/.test(id)) return 1        // sixmonthly: 2024S1
    if (/^\d{4}B\d$/.test(id)) return 1        // bimonthly: 2024B2
    if (/^\d{4}[A-Z]/.test(id)) return 1       // financial years: 2024Oct

    if (id in RELATIVE_PERIOD_COUNTS) return RELATIVE_PERIOD_COUNTS[id]

    // Variable-count: depends on current date
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentQuarter = Math.ceil(currentMonth / 3)
    if (id === 'MONTHS_THIS_YEAR') return currentMonth
    if (id === 'QUARTERS_THIS_YEAR') return currentQuarter
    if (id === 'BIMONTHS_THIS_YEAR') return Math.ceil(currentMonth / 2)

    return 1 // unknown — conservative fallback
}
