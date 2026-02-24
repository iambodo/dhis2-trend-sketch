import { useState, useCallback } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'

const NAMESPACE = 'trend-sketch'

function todayString() {
    return new Date().toISOString().slice(0, 10)
}

/**
 * Hook for saving user estimates to the DHIS2 datastore.
 *
 * saveEstimate(contextKey, periodsSlice, userPoints) — reads existing data,
 * appends the current user's entry, then writes back via POST (new) or PUT (existing).
 *
 * periodsSlice: array of period objects { id, label } for the hidden periods
 * userPoints:   array of y-values (numbers) matching periodsSlice order
 */
export function useSaveEstimate() {
    const engine = useDataEngine()
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)

    const saveEstimate = useCallback(async (contextKey, periodsSlice, userPoints) => {
        setSaving(true)
        setSaveError(null)

        try {
            // 1. Get current user
            const { me } = await engine.query({
                me: { resource: 'me', params: { fields: 'username' } },
            })
            const username = me.username

            // 2. Try to read existing key
            let existing = null
            let keyExists = false
            try {
                const resp = await engine.query({
                    data: { resource: `dataStore/${NAMESPACE}/${contextKey}` },
                })
                existing = resp.data
                keyExists = true
            } catch (err) {
                // 404 means key doesn't exist yet — that's fine
                if (err?.details?.httpStatusCode === 404 || err?.message?.includes('404')) {
                    existing = { users: [] }
                    keyExists = false
                } else {
                    throw err
                }
            }

            // 3. Build new entry
            const data = periodsSlice.map((p, i) => ({
                period: p.id,
                value: userPoints[i] ?? 0,
            }))
            const newEntry = {
                user: username,
                date: todayString(),
                data,
            }

            const updated = {
                users: [...(existing.users || []), newEntry],
            }

            // 4. POST (new key) or PUT (existing key)
            const mutation = keyExists
                ? {
                    type: 'update',
                    resource: `dataStore/${NAMESPACE}/${contextKey}`,
                    data: updated,
                }
                : {
                    type: 'create',
                    resource: `dataStore/${NAMESPACE}/${contextKey}`,
                    data: updated,
                }

            await engine.mutate(mutation)
        } catch (err) {
            console.error('[useSaveEstimate] error:', err)
            setSaveError(err)
            throw err
        } finally {
            setSaving(false)
        }
    }, [engine]) // eslint-disable-line react-hooks/exhaustive-deps

    return { saveEstimate, saving, saveError }
}
