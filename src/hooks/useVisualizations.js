import { useDataQuery } from '@dhis2/app-runtime'
import { resolveRelativePeriodCount } from '../utils/periodUtils'

const query = {
    visualizations: {
        resource: 'visualizations',
        params: {
            fields: 'id,displayName,type,columns[dimension,items[id,dimensionItemType]],rows[dimension,items[id,dimensionItemType]],filters[dimension,items[id,dimensionItemType]]',
            paging: false,
        },
    },
}

function countPeriodItems(dimArray) {
    const periodDim = dimArray?.find(d => d.dimension === 'pe')
    if (!periodDim?.items?.length) return 0
    return periodDim.items.reduce(
        (sum, item) => sum + resolveRelativePeriodCount(item.id),
        0
    )
}

function countOrgUnitItems(dimArray) {
    const ouDim = dimArray?.find(d => d.dimension === 'ou')
    return ouDim?.items?.length ?? 0
}

function hasDataDimension(dimArray) {
    return dimArray?.some(d => d.dimension === 'dx') ?? false
}

/**
 * Fetch all LINE visualizations that meet the criteria:
 * - type === 'LINE'
 * - periods (pe) in columns or rows: count between 3 and 12
 * - data (dx) as category (in rows or columns, exactly 1 item)
 * - org unit (ou) in filters with exactly 1 item
 */
export function useVisualizations() {
    const { data, loading, error } = useDataQuery(query)

    let visualizations = []

    if (data?.visualizations?.visualizations) {
        const all = data.visualizations.visualizations

        visualizations = all.filter(viz => {
            if (viz.type !== 'LINE') return false

            const allDims = [
                ...(viz.columns || []),
                ...(viz.rows || []),
                ...(viz.filters || []),
            ]

            // Periods must be in columns or rows (x-axis series)
            const periodCount = countPeriodItems([
                ...(viz.columns || []),
                ...(viz.rows || []),
            ])
            if (periodCount < 3 || periodCount > 12) return false

            // Data dimension must exist
            if (!hasDataDimension(allDims)) return false

            // Check data items count (exactly 1 data item = one line)
            const dxDim = allDims.find(d => d.dimension === 'dx')
            if (!dxDim || dxDim.items?.length !== 1) return false

            // Org unit must be in filters with exactly 1 item
            const ouCount = countOrgUnitItems(viz.filters || [])
            if (ouCount !== 1) return false

            return true
        })
    }

    return { visualizations, loading, error }
}
