import React from 'react'
import PropTypes from 'prop-types'
import { CircularLoader, NoticeBox, SingleSelectField, SingleSelectOption, Switch } from '@dhis2/ui'
import { useVisualizations } from '../hooks/useVisualizations'
import classes from './EditPanel.module.css'

export function EditPanel({
    selectedVizId,
    hiddenPeriods,
    totalPeriods,
    datastoreExists,
    saveEstimates,
    onVizChange,
    onHiddenPeriodsChange,
    onSaveEstimatesChange,
}) {
    const { visualizations, loading, error } = useVisualizations()

    if (loading) {
        return (
            <div className={classes.panel}>
                <CircularLoader small />
            </div>
        )
    }

    if (error) {
        return (
            <div className={classes.panel}>
                <NoticeBox error title="Failed to load visualizations">
                    {error.message}
                </NoticeBox>
            </div>
        )
    }

    const sliderMax = totalPeriods > 1 ? totalPeriods - 1 : 1

    return (
        <div className={classes.panel}>
            <div className={classes.field}>
                <SingleSelectField
                    label="Visualization"
                    selected={selectedVizId || ''}
                    onChange={({ selected }) => onVizChange(selected)}
                    placeholder="Select a line visualization…"
                    filterable
                    noMatchText="No matching visualizations"
                    dense
                >
                    {visualizations.map(viz => (
                        <SingleSelectOption
                            key={viz.id}
                            value={viz.id}
                            label={viz.displayName}
                        />
                    ))}
                </SingleSelectField>
            </div>

            {selectedVizId && totalPeriods > 1 && (
                <div className={classes.sliderField}>
                    <label className={classes.sliderLabel} htmlFor="hidden-periods-slider">
                        Hidden periods: <strong>{hiddenPeriods}</strong>
                    </label>
                    <input
                        id="hidden-periods-slider"
                        type="range"
                        min={1}
                        max={sliderMax}
                        step={1}
                        value={hiddenPeriods}
                        onChange={e => onHiddenPeriodsChange(Number(e.target.value))}
                        className={classes.slider}
                    />
                    <div className={classes.sliderHints}>
                        <span>1</span>
                        <span>{sliderMax}</span>
                    </div>
                </div>
            )}

            {datastoreExists && selectedVizId && (
                <div className={classes.toggleField}>
                    <Switch
                        label="Save estimates"
                        checked={saveEstimates}
                        onChange={({ checked }) => onSaveEstimatesChange(checked)}
                        dense
                    />
                </div>
            )}
        </div>
    )
}

EditPanel.propTypes = {
    selectedVizId: PropTypes.string,
    hiddenPeriods: PropTypes.number.isRequired,
    totalPeriods: PropTypes.number.isRequired,
    datastoreExists: PropTypes.bool,
    saveEstimates: PropTypes.bool,
    onVizChange: PropTypes.func.isRequired,
    onHiddenPeriodsChange: PropTypes.func.isRequired,
    onSaveEstimatesChange: PropTypes.func.isRequired,
}

EditPanel.defaultProps = {
    datastoreExists: false,
    saveEstimates: false,
}
