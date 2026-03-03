import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { EditPanel } from './components/EditPanel'
import { TrendSketchChart } from './components/TrendSketchChart'
import { useDatastoreNamespace } from './hooks/useDatastoreNamespace'
import { usePluginConfig } from './hooks/usePluginConfig'
import classes from './Plugin.module.css'
import './locales'

const DEFAULT_VIZ_ID = 'NxyEVic2BOh'
const DEFAULT_HIDDEN_PERIODS = 3

function Plugin({ dashboardItemId, dashboardMode }) {
    // When dashboardMode is not provided, use defaults directly
    const noContext = dashboardMode == null
    const editMode = dashboardMode === 'edit'

    const [selectedVizId, setSelectedVizId] = useState(noContext ? DEFAULT_VIZ_ID : null)
    const [hiddenPeriods, setHiddenPeriods] = useState(noContext ? DEFAULT_HIDDEN_PERIODS : 3)
    const [saveEstimates, setSaveEstimates] = useState(true)
    const [totalPeriods, setTotalPeriods] = useState(0)

    const { exists: datastoreExists } = useDatastoreNamespace('trend-sketch')

    // Config is stored in the DHIS2 datastore, keyed by dashboardItemId so each
    // plugin instance on a dashboard persists its own settings independently.
    // In dev mode (no dashboardItemId), falls back to 'dev' as the key.
    const { config, loading: configLoading, saveConfig } = usePluginConfig(dashboardItemId ?? 'dev')

    // Apply loaded config to state once available
    useEffect(() => {
        if (configLoading || !config) return
        if (config.selectedVizId) setSelectedVizId(config.selectedVizId)
        if (config.hiddenPeriods != null) setHiddenPeriods(config.hiddenPeriods)
        if (config.saveEstimates != null) setSaveEstimates(config.saveEstimates)
    }, [configLoading]) // eslint-disable-line react-hooks/exhaustive-deps

    function handleVizChange(vizId) {
        setSelectedVizId(vizId)
        setHiddenPeriods(3)
        saveConfig({ selectedVizId: vizId, hiddenPeriods: 3, saveEstimates })
    }

    function handleHiddenPeriodsChange(value) {
        setHiddenPeriods(value)
        saveConfig({ selectedVizId, hiddenPeriods: value, saveEstimates })
    }

    function handleSaveEstimatesChange(value) {
        setSaveEstimates(value)
        saveConfig({ selectedVizId, hiddenPeriods, saveEstimates: value })
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
