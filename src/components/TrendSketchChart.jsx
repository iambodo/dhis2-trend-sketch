import React, { useEffect, useRef, useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import { createChart, setupDrag, revealTrueLine, resetDrawing } from '../utils/drawUtils'
import classes from './TrendSketchChart.module.css'

const CHART_HEIGHT = 320
const MARGIN_TOP = 20
const MARGIN_BOTTOM = 50

export function TrendSketchChart({ vizId, hiddenPeriods, editMode, onPeriodsLoaded }) {
    const svgRef = useRef(null)
    const gRef = useRef(null)
    const containerRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(600)
    const [isComplete, setIsComplete] = useState(false)
    const [showTrue, setShowTrue] = useState(false)
    const [metrics, setMetrics] = useState(null)
    const scalesRef = useRef(null)
    const innerWidthRef = useRef(0)
    const clipIdRef = useRef(null)

    const { periods, values, dataLabel, title, subtitle, yAxisRange, loading, error } =
        useAnalyticsData(vizId)

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

    const buildChart = useCallback(() => {
        if (!svgRef.current || !periods.length || !values.length) return

        const labels = periods.map(p => p.label)

        setIsComplete(false)
        setShowTrue(false)
        setMetrics(null)

        const { xScale, yScale, innerWidth, innerHeight, clipId } = createChart(
            svgRef.current,
            { labels, values, drawStart },
            { width: containerWidth, height: CHART_HEIGHT, yAxisRange }
        )

        clipIdRef.current = clipId
        gRef.current = svgRef.current.querySelector('.chart-g')
        scalesRef.current = { xScale, yScale }
        innerWidthRef.current = innerWidth

        setupDrag(
            gRef.current,
            { xScale, yScale },
            { labels, values, drawStart },
            innerWidth,
            innerHeight,
            () => {},
            (_userPoints, m) => {
                setIsComplete(true)
                setShowTrue(true)
                setMetrics(m)
                revealTrueLine(gRef.current, clipId, innerWidth)
            }
        )
    }, [periods, values, drawStart, containerWidth, yAxisRange])

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
            (_userPoints, m) => {
                setIsComplete(true)
                setShowTrue(true)
                setMetrics(m)
                revealTrueLine(gRef.current, clipId, innerWidth)
            }
        )
    }, [periods, values, drawStart])

    if (!vizId) {
        return (
            <div className={classes.placeholder}>
                {editMode
                    ? 'Select a visualization to get started.'
                    : 'No visualization configured. Switch to edit mode to set one up.'}
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
                    {metrics && (
                        <div className={classes.metrics}>
                            <span>Euclidean distance: <strong>{metrics.euclidean.toPrecision(2)}</strong></span>
                            {metrics.pearson != null && (
                                <span>Pearson correlation: <strong>{metrics.pearson.toPrecision(2)}</strong></span>
                            )}
                        </div>
                    )}
                    <div className={classes.controlsRow}>
                        <Button onClick={handleReset} secondary small>
                            Reset drawing
                        </Button>
                        {showTrue && (
                            <span className={classes.revealNote}>
                                True values revealed.
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

TrendSketchChart.propTypes = {
    vizId: PropTypes.string,
    hiddenPeriods: PropTypes.number.isRequired,
    editMode: PropTypes.bool,
    onPeriodsLoaded: PropTypes.func,
}

TrendSketchChart.defaultProps = {
    editMode: false,
}
