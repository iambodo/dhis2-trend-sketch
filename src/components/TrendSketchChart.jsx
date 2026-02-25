import React, { useEffect, useRef, useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Button, CircularLoader, NoticeBox, Switch } from '@dhis2/ui'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import { useSaveEstimate } from '../hooks/useSaveEstimate'
import { createChart, setupDrag, revealTrueLine, resetDrawing, plotPriorEstimates, clearPriorEstimates } from '../utils/drawUtils'
import classes from './TrendSketchChart.module.css'

const CHART_HEIGHT = 320
const MARGIN_TOP = 20
const MARGIN_BOTTOM = 50

function describeMetrics({ pearson, inverseEuclidean }) {
    const shapeDesc =
        pearson == null ? null :
        pearson >= 0.9 ? 'very similar in shape' :
        pearson >= 0.7 ? 'somewhat similar in shape' :
        pearson >= 0.4 ? 'loosely similar in shape' :
        'quite different in shape'

    const levelDesc =
        inverseEuclidean >= 0.8 ? 'very close to the target' :
        inverseEuclidean >= 0.5 ? 'reasonably close to the target' :
        inverseEuclidean >= 0.2 ? 'somewhat off target' :
        'significantly off target'

    if (shapeDesc == null) {
        return `Your estimate was ${levelDesc}.`
    }

    const connector = pearson >= 0.7 && inverseEuclidean >= 0.5 ? 'and' : 'but'
    return `Your estimate was ${shapeDesc} to the real data, ${connector} it was ${levelDesc}.`
}

export function TrendSketchChart({ vizId, hiddenPeriods, editMode, saveEstimates, onPeriodsLoaded }) {
    const svgRef = useRef(null)
    const gRef = useRef(null)
    const containerRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(600)
    const [isComplete, setIsComplete] = useState(false)
    const [showTrue, setShowTrue] = useState(false)
    const [metrics, setMetrics] = useState(null)
    const [showComparison, setShowComparison] = useState(false)
    // Store user points for submission
    const userPointsRef = useRef([])
    const scalesRef = useRef(null)
    const innerWidthRef = useRef(0)
    const clipIdRef = useRef(null)

    const { periods, values, ouId, dataLabel, title, subtitle, yAxisRange, loading, error } =
        useAnalyticsData(vizId)

    const { saveEstimate, saving, saveError, priorEstimates } = useSaveEstimate()

    // Notify parent of total period count
    useEffect(() => {
        if (onPeriodsLoaded && periods.length > 0) {
            onPeriodsLoaded(periods.length)
        }
    }, [periods.length, onPeriodsLoaded])

    // Observe container width for responsive chart
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const observer = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect?.width
            if (w && w > 0) setContainerWidth(w)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const drawStart = Math.max(0, periods.length - hiddenPeriods)

    // Sync prior estimates overlay whenever comparison toggle or data changes
    useEffect(() => {
        if (!gRef.current || !scalesRef.current || !showTrue) return
        const periodsSlice = periods.slice(drawStart)
        const anchorPoint = drawStart > 0 && values[drawStart - 1] != null
            ? { label: periods[drawStart - 1].label, value: values[drawStart - 1] }
            : null
        if (showComparison && priorEstimates.length > 0) {
            plotPriorEstimates(gRef.current, priorEstimates, periodsSlice, scalesRef.current, anchorPoint)
        } else {
            clearPriorEstimates(gRef.current)
        }
    }, [showComparison, priorEstimates, showTrue]) // eslint-disable-line react-hooks/exhaustive-deps

    // Build context window key: {vizId}_{ouId}_{firstPeriodId}_{lastPeriodId}
    function buildContextKey() {
        if (!vizId || !ouId || !periods.length) return null
        const firstHidden = periods[drawStart]?.id
        const lastHidden = periods[periods.length - 1]?.id
        if (!firstHidden || !lastHidden) return null
        return `${vizId}_${ouId}_${firstHidden}_${lastHidden}`
    }

    const buildChart = useCallback(() => {
        if (!svgRef.current || !periods.length || !values.length) return

        const labels = periods.map(p => p.label)

        setIsComplete(false)
        setShowTrue(false)
        setMetrics(null)
        userPointsRef.current = []

        const { xScale, yScale, innerWidth, innerHeight, clipId } = createChart(
            svgRef.current,
            { labels, values, drawStart },
            { width: containerWidth, height: CHART_HEIGHT, yAxisRange }
        )

        clipIdRef.current = clipId
        gRef.current = svgRef.current.querySelector('.chart-g')
        scalesRef.current = { xScale, yScale }
        innerWidthRef.current = innerWidth

        if (!editMode) {
            setupDrag(
                gRef.current,
                { xScale, yScale },
                { labels, values, drawStart },
                innerWidth,
                innerHeight,
                () => {},
                (drawnPoints, m) => {
                    userPointsRef.current = drawnPoints
                    setIsComplete(true)
                    setMetrics(m)
                    // Only auto-reveal if saveEstimates is not active
                    if (!saveEstimates) {
                        setShowTrue(true)
                        revealTrueLine(gRef.current, clipId, innerWidth)
                    }
                }
            )
        }
    }, [periods, values, drawStart, containerWidth, yAxisRange, saveEstimates, editMode])

    useEffect(() => {
        buildChart()
    }, [buildChart])

    const handleReset = useCallback(() => {
        if (!gRef.current || !scalesRef.current) return

        resetDrawing(gRef.current)

        if (clipIdRef.current) {
            const clipRect = gRef.current.querySelector(`#${clipIdRef.current} rect`)
            if (clipRect) clipRect.setAttribute('width', '0')
        }

        setIsComplete(false)
        setShowTrue(false)
        setMetrics(null)
        setShowComparison(false)
        clearPriorEstimates(gRef.current)
        userPointsRef.current = []

        const labels = periods.map(p => p.label)
        const { xScale, yScale } = scalesRef.current
        const innerWidth = innerWidthRef.current
        const innerHeight = CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
        const clipId = clipIdRef.current

        setupDrag(
            gRef.current,
            { xScale, yScale },
            { labels, values, drawStart },
            innerWidth,
            innerHeight,
            () => {},
            (drawnPoints, m) => {
                userPointsRef.current = drawnPoints
                setIsComplete(true)
                setMetrics(m)
                if (!saveEstimates) {
                    setShowTrue(true)
                    revealTrueLine(gRef.current, clipId, innerWidth)
                }
            }
        )
    }, [periods, values, drawStart, saveEstimates])

    const handleSubmit = useCallback(async () => {
        const contextKey = buildContextKey()
        if (!contextKey) return

        const periodsSlice = periods.slice(drawStart)
        const pts = userPointsRef.current

        // Guard: ensure all periods are filled
        if (!pts || pts.length < periodsSlice.length) {
            return
        }

        // Extract numeric values from the point objects { label, value, x }
        const yValues = pts.map(p => (typeof p === 'object' ? p.value : p) ?? 0)

        try {
            await saveEstimate(contextKey, periodsSlice, yValues)
            // On success: reveal the true line
            setShowTrue(true)
            if (gRef.current && clipIdRef.current && innerWidthRef.current) {
                revealTrueLine(gRef.current, clipIdRef.current, innerWidthRef.current)
            }
        } catch {
            // saveError state is set inside useSaveEstimate
        }
    }, [periods, drawStart, ouId, vizId, saveEstimate]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!vizId) {
        return (
            <div className={classes.editPlaceholder}>
                Edit dashboard to select a single series line graph for trend sketching.
            </div>
        )
    }

    if (loading) {
        return (
            <div className={classes.loading}>
                <CircularLoader />
            </div>
        )
    }

    if (error) {
        return (
            <NoticeBox error title="Failed to load data">
                {error.message}
            </NoticeBox>
        )
    }

    if (!periods.length) {
        return (
            <div className={classes.placeholder}>
                No data returned for this visualization.
            </div>
        )
    }

    // Whether to show the submit button instead of auto-reveal
    const requiresSubmit = saveEstimates && !showTrue

    return (
        <div className={classes.chartWrapper}>
            <div className={classes.chartMeta}>
                {title && <h3 className={classes.title}>{title}</h3>}
                {subtitle && <span className={classes.subtitle}>{subtitle}</span>}
                {dataLabel && <span className={classes.dataLabel}>{dataLabel}</span>}
            </div>

            <div ref={containerRef} className={classes.svgContainer}>
                <svg ref={svgRef} className={classes.svg} />
            </div>

            {!editMode && !isComplete && hiddenPeriods > 0 && (
                <div className={classes.instruction}>
                    Draw the remaining <strong>{hiddenPeriods}</strong> period
                    {hiddenPeriods !== 1 ? 's' : ''} by clicking and dragging on the chart.
                </div>
            )}

            {isComplete && (
                <div className={classes.controls}>
                    {metrics && (!saveEstimates || showTrue) && (
                        <div className={classes.metrics}>
                            <p className={classes.metricsText}>
                                {describeMetrics(metrics)}
                            </p>
                            <p className={classes.metricsNumbers}>
                                Pearson correlation: <strong>{metrics.pearson != null ? metrics.pearson.toPrecision(2) : 'n/a'}</strong>
                                {' · '}
                                Inverse Euclidean distance: <strong>{metrics.inverseEuclidean.toPrecision(2)}</strong>
                            </p>
                        </div>
                    )}
                    <div className={classes.controlsRow}>
                        {requiresSubmit && (
                            <Button
                                onClick={handleSubmit}
                                primary
                                small
                                loading={saving}
                                disabled={saving}
                            >
                                Submit estimate
                            </Button>
                        )}
                        {showTrue && priorEstimates.length > 0 && (
                            <Switch
                                label="Compare to others"
                                checked={showComparison}
                                onChange={({ checked }) => setShowComparison(checked)}
                                dense
                            />
                        )}
                        <Button onClick={handleReset} secondary small>
                            Reset drawing
                        </Button>
                        {showTrue && (
                            <span className={classes.revealNote}>
                                True values revealed.
                            </span>
                        )}
                    </div>
                    {saveError && (
                        <p className={classes.saveError}>
                            Failed to save estimate: {saveError.message}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

TrendSketchChart.propTypes = {
    vizId: PropTypes.string,
    hiddenPeriods: PropTypes.number.isRequired,
    editMode: PropTypes.bool,
    saveEstimates: PropTypes.bool,
    onPeriodsLoaded: PropTypes.func,
}

TrendSketchChart.defaultProps = {
    editMode: false,
    saveEstimates: true,
}
