import { useState, useEffect, useRef, useCallback } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'

const NAMESPACE = 'trend-sketch'

/**
 * Reads plugin config from api/dataStore/trend-sketch/config-{itemKey} on mount,
 * and exposes a saveConfig() function to write it back.
 *
 * itemKey — dashboardItemId when on a real dashboard, 'dev' as a fallback.
 */
export function usePluginConfig(itemKey) {
    const engine = useDataEngine()
    const dsKey = `config-${itemKey}`
    const keyExistsRef = useRef(false)
    const [config, setConfig] = useState(null) // null = still loading
    const [loading, setLoading] = useState(true)

    // Load on mount
    useEffect(() => {
        let cancelled = false
        engine
            .query({ data: { resource: `dataStore/${NAMESPACE}/${dsKey}` } })
            .then(({ data }) => {
                if (cancelled) return
                keyExistsRef.current = true
                setConfig(data)
                setLoading(false)
            })
            .catch((err) => {
                if (cancelled) return
                // 404 = key doesn't exist yet — that's fine, start with no config
                const is404 =
                    err?.details?.httpStatusCode === 404 ||
                    err?.message?.includes('404')
                if (is404) {
                    keyExistsRef.current = false
                    setConfig(null)
                }
                setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const saveConfig = useCallback(
        async (newConfig) => {
            const mutation = keyExistsRef.current
                ? {
                      type: 'update',
                      resource: `dataStore/${NAMESPACE}/${dsKey}`,
                      data: newConfig,
                  }
                : {
                      type: 'create',
                      resource: `dataStore/${NAMESPACE}/${dsKey}`,
                      data: newConfig,
                  }
            await engine.mutate(mutation)
            keyExistsRef.current = true
        },
        [engine, dsKey] // eslint-disable-line react-hooks/exhaustive-deps
    )

    return { config, loading, saveConfig }
}
