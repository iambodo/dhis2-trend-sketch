import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { EditPanel } from './components/EditPanel'
import { TrendSketchChart } from './components/TrendSketchChart'
import classes from './Plugin.module.css'
import './locales'

const LOCAL_STORAGE_KEY = 'dhis2-trend-sketch-config'

function readLocalCache() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function writeLocalCache(data) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
    } catch {
        // ignore
    }
}

function Plugin({ dashboardMode, onCacheableDataLoad, setCacheableData }) {
    const editMode = dashboardMode === 'edit'
    const [selectedVizId, setSelectedVizId] = useState(null)
    const [hiddenPeriods, setHiddenPeriods] = useState(3)
    const [totalPeriods, setTotalPeriods] = useState(0)

    // Restore cached config on mount
    useEffect(() => {
        if (onCacheableDataLoad) {
            onCacheableDataLoad(cachedData => {
                if (cachedData?.selectedVizId) {
                    setSelectedVizId(cachedData.selectedVizId)
                }
                if (cachedData?.hiddenPeriods != null) {
                    setHiddenPeriods(cachedData.hiddenPeriods)
                }
            })
        } else {
            // Dev fallback: restore from localStorage
            const cached = readLocalCache()
            if (cached?.selectedVizId) setSelectedVizId(cached.selectedVizId)
            if (cached?.hiddenPeriods != null) setHiddenPeriods(cached.hiddenPeriods)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    function handleVizChange(vizId) {
        setSelectedVizId(vizId)
        setHiddenPeriods(3)
        persistCache({ selectedVizId: vizId, hiddenPeriods: 3 })
    }

    function handleHiddenPeriodsChange(value) {
        setHiddenPeriods(value)
        persistCache({ selectedVizId, hiddenPeriods: value })
    }

    function persistCache(data) {
        if (setCacheableData) {
            setCacheableData(data)
        } else {
            writeLocalCache(data)
        }
    }

    return (
        <div className={classes.plugin}>
            {editMode && (
                <EditPanel
                    selectedVizId={selectedVizId}
                    hiddenPeriods={hiddenPeriods}
                    totalPeriods={totalPeriods}
                    onVizChange={handleVizChange}
                    onHiddenPeriodsChange={handleHiddenPeriodsChange}
                />
            )}
            <TrendSketchChart
                vizId={selectedVizId}
                hiddenPeriods={hiddenPeriods}
                editMode={editMode}
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
