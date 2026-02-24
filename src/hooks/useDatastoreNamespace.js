import { useEffect, useState } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'

/**
 * Checks if a given namespace exists in the DHIS2 datastore.
 * Returns { exists: boolean, loading: boolean, error: Error|null }
 */
export function useDatastoreNamespace(namespace) {
    const engine = useDataEngine()
    const [state, setState] = useState({ exists: false, loading: true, error: null })

    useEffect(() => {
        let cancelled = false

        engine.query({
            namespaces: { resource: 'dataStore' },
        })
        .then(({ namespaces }) => {
            if (cancelled) return
            const exists = Array.isArray(namespaces) && namespaces.includes(namespace)
            setState({ exists, loading: false, error: null })
        })
        .catch(err => {
            if (cancelled) return
            setState({ exists: false, loading: false, error: err })
        })

        return () => { cancelled = true }
    }, [namespace]) // eslint-disable-line react-hooks/exhaustive-deps

    return state
}
