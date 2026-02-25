import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { EditPanel } from './components/EditPanel'
import { TrendSketchChart } from './components/TrendSketchChart'
import { useDatastoreNamespace } from './hooks/useDatastoreNamespace'
import classes from './Plugin.module.css'
import './locales'

const STORAGE_KEY_PREFIX = 'dhis2-trend-sketch-'

// Generate a stable per-instance ID stored in sessionStorage so each plugin
// instance on a dashboard gets its own isolated localStorage slot in dev mode.
function getInstanceId() {
    const key = 'dhis2-trend-sketch-instance-id'
    let id = sessionStorage.getItem(key)
    if (!id) {
        id = Math.random().toString(36).slice(2, 10)
        sessionStorage.setItem(key, id)
    }
    return id
}

function readLocalCache(instanceId) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + instanceId)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function writeLocalCache(instanceId, data) {
    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + instanceId, JSON.stringify(data))
    } catch {
        // ignore
    }
}

const DEFAULT_VIZ_ID = 'NxyEVic2BOh'
const DEFAULT_HIDDEN_PERIODS = 3

function Plugin({ dashboardMode, onCacheableDataLoad, setCacheableData }) {
    // When dashboardMode is not provided, use defaults directly
    const noContext = dashboardMode == null
    const editMode = dashboardMode === 'edit'
    const [selectedVizId, setSelectedVizId] = useState(noContext ? DEFAULT_VIZ_ID : null)
    const [hiddenPeriods, setHiddenPeriods] = useState(noContext ? DEFAULT_HIDDEN_PERIODS : 3)
    const [saveEstimates, setSaveEstimates] = useState(true)
    const [totalPeriods, setTotalPeriods] = useState(0)
    // Stable per-instance ID for isolated localStorage in dev (one per page load)
    const instanceId = useState(() => getInstanceId())[0]

    const { exists: datastoreExists } = useDatastoreNamespace('trend-sketch')

    // Restore cached config on mount (only when dashboard context exists)
    useEffect(() => {
        if (noContext) return
        if (onCacheableDataLoad) {
            // Real dashboard: each plugin instance has its own cacheable store
            onCacheableDataLoad(cachedData => {
                if (cachedData?.selectedVizId) {
                    setSelectedVizId(cachedData.selectedVizId)
                }
                if (cachedData?.hiddenPeriods != null) {
                    setHiddenPeriods(cachedData.hiddenPeriods)
                }
                if (cachedData?.saveEstimates != null) {
                    setSaveEstimates(cachedData.saveEstimates)
                }
            })
        } else {
            // Dev fallback: restore from instance-scoped localStorage
            const cached = readLocalCache(instanceId)
            if (cached?.selectedVizId) setSelectedVizId(cached.selectedVizId)
            if (cached?.hiddenPeriods != null) setHiddenPeriods(cached.hiddenPeriods)
            if (cached?.saveEstimates != null) setSaveEstimates(cached.saveEstimates)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    function handleVizChange(vizId) {
        setSelectedVizId(vizId)
        setHiddenPeriods(3)
        persistCache({ selectedVizId: vizId, hiddenPeriods: 3, saveEstimates })
    }

    function handleHiddenPeriodsChange(value) {
        setHiddenPeriods(value)
        persistCache({ selectedVizId, hiddenPeriods: value, saveEstimates })
    }

    function handleSaveEstimatesChange(value) {
        setSaveEstimates(value)
        persistCache({ selectedVizId, hiddenPeriods, saveEstimates: value })
    }

    function persistCache(data) {
        if (setCacheableData) {
            // Real dashboard: setCacheableData is already instance-scoped by the platform
            setCacheableData(data)
        } else {
            writeLocalCache(instanceId, data)
        }
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
    dashboardMode: PropTypes.oneOf(['view', 'edit', 'print']),
    onCacheableDataLoad: PropTypes.func,
    setCacheableData: PropTypes.func,
}

export default Plugin
