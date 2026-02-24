import { useEffect, useState, useRef } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'
import { formatPeriodId } from '../utils/periodUtils'

const VIZ_FIELDS = [
    'id',
    'displayName',
    'columns[dimension,items[id,displayName]]',
    'rows[dimension,items[id,displayName]]',
    'filters[dimension,items[id,displayName]]',
].join(',')

function extractDimensions(visualization) {
    if (!visualization) return null

    const allDims = [
        ...(visualization.columns || []),
        ...(visualization.rows || []),
        ...(visualization.filters || []),
    ]
    const seriesDims = [
        ...(visualization.columns || []),
        ...(visualization.rows || []),
    ]

    const dxDim = allDims.find(d => d.dimension === 'dx')
    const peDim = seriesDims.find(d => d.dimension === 'pe')
    const ouDim = allDims.find(d => d.dimension === 'ou')

    if (!dxDim || !peDim || !ouDim) return null

    return {
        dxId: dxDim.items?.[0]?.id,
        dxName: dxDim.items?.[0]?.displayName || dxDim.items?.[0]?.id,
        periods: peDim.items?.map(i => i.id).join(';') || '',
        orderedPeriodIds: peDim.items?.map(i => i.id) || [],
        ouId: ouDim.items?.[0]?.id,
        vizName: visualization.displayName || '',
    }
}

const EMPTY = { periods: [], values: [], dataLabel: '', title: '', subtitle: '', loading: false, error: null }

/**
 * Fetch analytics data for the selected visualization.
 * Returns { periods, values, dataLabel, title, subtitle, loading, error }
 */
export function useAnalyticsData(vizId) {
    const engine = useDataEngine()
    const [result, setResult] = useState(EMPTY)
    const lastVizId = useRef(null)

    useEffect(() => {
        if (!vizId) {
            setResult(EMPTY)
            return
        }

        let cancelled = false
        lastVizId.current = vizId
        setResult(r => ({ ...r, loading: true, error: null }))

        // Step 1: fetch visualization config
        engine.query({
            visualization: {
                resource: `visualizations/${vizId}`,
                params: { fields: VIZ_FIELDS },
            },
        })
        .then(({ visualization }) => {
            if (cancelled) return

            const dims = extractDimensions(visualization)

            if (!dims) {
                setResult({ ...EMPTY, error: new Error('Could not extract dimensions from visualization') })
                return
            }

            // Step 2: fetch analytics — build URL with repeated dimension params
            const url = `analytics?dimension=dx:${dims.dxId}&dimension=pe:${dims.periods}&filter=ou:${dims.ouId}&skipMeta=false`

            return engine.query({
                analytics: { resource: url },
            }).then(({ analytics }) => {
                if (cancelled) return

                const rows = analytics.rows || []
                const headers = analytics.headers || []
                const metaData = analytics.metaData || {}

                const peIndex = headers.findIndex(h => h.name === 'pe')
                const valueIndex = headers.findIndex(h => h.name === 'value')

                if (peIndex === -1 || valueIndex === -1) {
                    setResult({ ...EMPTY, error: new Error('Unexpected analytics response shape') })
                    return
                }

                const valueMap = {}
                rows.forEach(row => {
                    valueMap[row[peIndex]] = parseFloat(row[valueIndex])
                })

                // Use server-resolved period IDs (handles relative periods)
                const resolvedPeriodIds =
                    metaData.dimensions?.pe?.length
                        ? metaData.dimensions.pe
                        : dims.orderedPeriodIds

                const periods = resolvedPeriodIds.map(id => ({
                    id,
                    label: formatPeriodId(id),
                }))
                const values = resolvedPeriodIds.map(id => valueMap[id] ?? null)

                const ouMeta = metaData.items?.[dims.ouId]
                setResult({
                    periods,
                    values,
                    dataLabel: dims.dxName,
                    title: dims.vizName,
                    subtitle: ouMeta?.name || '',
                    loading: false,
                    error: null,
                })
            })
        })
        .catch(err => {
            if (cancelled) return
            console.error('[useAnalyticsData] error:', err)
            setResult({ ...EMPTY, error: err })
        })

        return () => { cancelled = true }
    }, [vizId]) // eslint-disable-line react-hooks/exhaustive-deps

    return result
}
