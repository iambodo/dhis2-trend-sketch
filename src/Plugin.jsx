import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { EditPanel } from './components/EditPanel'
import { TrendSketchChart } from './components/TrendSketchChart'
import { useDatastoreNamespace } from './hooks/useDatastoreNamespace'
import classes from './Plugin.module.css'
import './locales'

const STORAGE_KEY_PREFIX = 'dhis2-trend-sketch-'
const DEV_FALLBACK_KEY = 'dhis2-trend-sketch-dev'

// Config is stored in localStorage keyed by dashboardItemId (a stable unique ID
// provided by the DHIS2 dashboard per plugin instance). In dev mode (no dashboard
// context), a fixed fallback key is used since there is only one instance.
function readLocalCache(key) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function writeLocalCache(key, data) {
    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data))
    } catch {
        // ignore
    }
}

const DEFAULT_VIZ_ID = 'NxyEVic2BOh'
const DEFAULT_HIDDEN_PERIODS = 3

function Plugin({ dashboardItemId, dashboardMode }) {
    // When dashboardMode is not provided, use defaults directly
    const noContext = dashboardMode == null
    const editMode = dashboardMode === 'edit'

    // Use dashboardItemId as the storage key when available; fall back to a
    // fixed dev key when running outside a real dashboard context.
    const storageKey = dashboardItemId ?? DEV_FALLBACK_KEY

    const [selectedVizId, setSelectedVizId] = useState(noContext ? DEFAULT_VIZ_ID : null)
    const [hiddenPeriods, setHiddenPeriods] = useState(noContext ? DEFAULT_HIDDEN_PERIODS : 3)
    const [saveEstimates, setSaveEstimates] = useState(true)
    const [totalPeriods, setTotalPeriods] = useState(0)

    const { exists: datastoreExists } = useDatastoreNamespace('trend-sketch')

    // Restore saved config from localStorage on mount
    useEffect(() => {
        if (noContext) return
        const cached = readLocalCache(storageKey)
        if (cached?.selectedVizId) setSelectedVizId(cached.selectedVizId)
        if (cached?.hiddenPeriods != null) setHiddenPeriods(cached.hiddenPeriods)
        if (cached?.saveEstimates != null) setSaveEstimates(cached.saveEstimates)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    function handleVizChange(vizId) {
        setSelectedVizId(vizId)
        setHiddenPeriods(3)
        writeLocalCache(storageKey, { selectedVizId: vizId, hiddenPeriods: 3, saveEstimates })
    }

    function handleHiddenPeriodsChange(value) {
        setHiddenPeriods(value)
        writeLocalCache(storageKey, { selectedVizId, hiddenPeriods: value, saveEstimates })
    }

    function handleSaveEstimatesChange(value) {
        setSaveEstimates(value)
        writeLocalCache(storageKey, { selectedVizId, hiddenPeriods, saveEstimates: value })
    }

    return (
        <div className={classes.plugin}>
            {editMode && (
                <EditPanel
                    selectedVizId={selectedVizId}
                    hiddenPeriods={hiddenPeriods}
                    totalPeriods={totalPeriods}
                    datastoreExists={datastoreExists}
                    saveEstimates={saveEstimates}
                    onVizChange={handleVizChange}
                    onHiddenPeriodsChange={handleHiddenPeriodsChange}
                    onSaveEstimatesChange={handleSaveEstimatesChange}
                />
            )}
            <TrendSketchChart
                vizId={selectedVizId}
                hiddenPeriods={hiddenPeriods}
                editMode={editMode}
                saveEstimates={saveEstimates}
                onPeriodsLoaded={setTotalPeriods}
            />
        </div>
    )
}

Plugin.propTypes = {
    dashboardItemId: PropTypes.string,
    dashboardMode: PropTypes.oneOf(['view', 'edit', 'print']),
}

export default Plugin
