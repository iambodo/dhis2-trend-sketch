import * as d3 from 'd3'

const MARGIN = { top: 20, right: 30, bottom: 50, left: 60 }

let clipIdCounter = 0

/**
 * Create the D3 chart inside the given SVG element.
 *
 * @param {SVGSVGElement} svgEl
 * @param {{ labels: string[], values: (number|null)[], drawStart: number }} data
 * @param {{ width: number, height: number, yAxisRange?: {min: number, max: number}|null }} options
 * @returns {{ xScale, yScale, innerWidth, innerHeight, clipId }}
 */
export function createChart(svgEl, data, options) {
    const { labels, values, drawStart } = data
    const { width, height, yAxisRange } = options

    const innerWidth = width - MARGIN.left - MARGIN.right
    const innerHeight = height - MARGIN.top - MARGIN.bottom
    const clipId = `ts-clip-${++clipIdCounter}`

    const svgSel = d3.select(svgEl)
    svgSel.selectAll('*').remove()
    svgSel.attr('width', width).attr('height', height)

    const g = svgSel
        .append('g')
        .attr('class', 'chart-g')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Clip path for revealing the true line
    g.append('defs')
        .append('clipPath')
        .attr('id', clipId)
        .append('rect')
        .attr('x', 0)
        .attr('y', -MARGIN.top)
        .attr('width', 0)
        .attr('height', height)

    // Scales
    const xScale = d3
        .scalePoint()
        .domain(labels)
        .range([0, innerWidth])
        .padding(0.5)

    let yDomainMin, yDomainMax
    if (yAxisRange) {
        yDomainMin = yAxisRange.min
        yDomainMax = yAxisRange.max
    } else {
        const knownVals = values.filter(v => v != null)
        const minVal = d3.min(knownVals) ?? 0
        const maxVal = d3.max(knownVals) ?? 1
        const pad = (maxVal - minVal) * 0.15 || Math.abs(maxVal) * 0.1 || 1
        yDomainMin = Math.max(0, minVal - pad)
        yDomainMax = maxVal + pad
    }

    const yScale = d3
        .scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0])
        .nice()

    // X axis
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-30)')
        .style('text-anchor', 'end')
        .style('font-size', '11px')

    // Y axis
    g.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale).ticks(6))
        .style('font-size', '11px')

    // Grey background for drawing area
    if (drawStart > 0 && drawStart < labels.length) {
        const x0 = xScale(labels[drawStart - 1])
        const x1 = xScale(labels[drawStart])
        const divX = (x0 + x1) / 2

        g.append('rect')
            .attr('class', 'draw-bg')
            .attr('x', divX)
            .attr('y', 0)
            .attr('width', innerWidth - divX)
            .attr('height', innerHeight)
            .attr('fill', '#f5f5f5')

        // Divider line
        g.append('line')
            .attr('class', 'divider')
            .attr('x1', divX).attr('x2', divX)
            .attr('y1', 0).attr('y2', innerHeight)
            .attr('stroke', '#aaa')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,3')
    }

    // Line generator
    const lineGen = d3.line()
        .x(d => xScale(d.label))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX)

    // Known (visible) data
    const knownData = labels.slice(0, drawStart)
        .map((label, i) => ({ label, value: values[i] }))
        .filter(d => d.value != null)

    g.append('path').datum(knownData)
        .attr('class', 'known-line')
        .attr('fill', 'none')
        .attr('stroke', '#2b6cb0')
        .attr('stroke-width', 2.5)
        .attr('d', lineGen)

    g.selectAll('.known-dot').data(knownData).enter()
        .append('circle').attr('class', 'known-dot')
        .attr('cx', d => xScale(d.label))
        .attr('cy', d => yScale(d.value))
        .attr('r', 3.5).attr('fill', '#2b6cb0')

    // True (hidden) data — clipped, entirely dashed including connector
    const trueData = labels.slice(drawStart)
        .map((label, i) => ({ label, value: values[drawStart + i] }))
        .filter(d => d.value != null)

    // Connector: last known → first true (dashed, clipped)
    if (knownData.length > 0 && trueData.length > 0) {
        g.append('path')
            .datum([knownData[knownData.length - 1], trueData[0]])
            .attr('class', 'true-connector')
            .attr('fill', 'none')
            .attr('stroke', '#276749')
            .attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '6,3')
            .attr('clip-path', `url(#${clipId})`)
            .attr('d', lineGen)
    }

    g.append('path').datum(trueData)
        .attr('class', 'true-line')
        .attr('fill', 'none')
        .attr('stroke', '#276749')
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '6,3')
        .attr('clip-path', `url(#${clipId})`)
        .attr('d', lineGen)

    g.selectAll('.true-dot').data(trueData).enter()
        .append('circle').attr('class', 'true-dot')
        .attr('cx', d => xScale(d.label))
        .attr('cy', d => yScale(d.value))
        .attr('r', 3.5).attr('fill', '#276749')
        .attr('clip-path', `url(#${clipId})`)

    // Value labels: first known value, last known value before hidden
    const labelOffset = -8
    if (knownData.length > 0) {
        // First value
        g.append('text')
            .attr('class', 'val-label val-label-first')
            .attr('x', xScale(knownData[0].label))
            .attr('y', yScale(knownData[0].value) + labelOffset)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#2b6cb0')
            .text(formatValue(knownData[0].value))

        // Last known value (only if different from first)
        if (knownData.length > 1) {
            const lastKnown = knownData[knownData.length - 1]
            g.append('text')
                .attr('class', 'val-label val-label-last-known')
                .attr('x', xScale(lastKnown.label))
                .attr('y', yScale(lastKnown.value) + labelOffset)
                .attr('text-anchor', 'middle')
                .style('font-size', '11px')
                .style('fill', '#2b6cb0')
                .text(formatValue(lastKnown.value))
        }
    }

    // User drawn line (empty — label added dynamically by setupDrag)
    g.append('path')
        .attr('class', 'user-line')
        .attr('fill', 'none')
        .attr('stroke', '#c05621')
        .attr('stroke-width', 2.5)

    return { xScale, yScale, innerWidth, innerHeight, clipId }
}

function formatValue(v) {
    if (v == null) return ''
    if (Math.abs(v) >= 1000) return d3.format(',.0f')(v)
    if (Number.isInteger(v)) return String(v)
    return d3.format('.2~f')(v)
}

/**
 * Compute inverse Euclidean distance and Pearson correlation between two value arrays.
 * Inverse Euclidean = 1 / (1 + euclidean), so 1.0 = perfect match, approaching 0 = very far off.
 */
function computeMetrics(trueVals, userVals) {
    const n = trueVals.length
    if (n === 0) return null

    // Euclidean distance → invert so higher = better
    const euclidean = Math.sqrt(
        trueVals.reduce((sum, t, i) => sum + (t - userVals[i]) ** 2, 0)
    )
    const inverseEuclidean = 1 / (1 + euclidean)

    // Pearson correlation
    const meanT = trueVals.reduce((s, v) => s + v, 0) / n
    const meanU = userVals.reduce((s, v) => s + v, 0) / n
    const num = trueVals.reduce((s, t, i) => s + (t - meanT) * (userVals[i] - meanU), 0)
    const denT = Math.sqrt(trueVals.reduce((s, t) => s + (t - meanT) ** 2, 0))
    const denU = Math.sqrt(userVals.reduce((s, u) => s + (u - meanU) ** 2, 0))
    const pearson = (denT === 0 || denU === 0) ? null : num / (denT * denU)

    return { inverseEuclidean, pearson }
}

/**
 * Set up mouse/touch drag to let the user draw hidden periods.
 *
 * @param {Element} gEl
 * @param {{ xScale, yScale }} scales
 * @param {{ labels, values, drawStart }} data
 * @param {number} innerWidth
 * @param {number} innerHeight
 * @param {Function} onUpdate
 * @param {Function} onComplete  Called with (userPoints, metrics)
 */
export function setupDrag(gEl, scales, data, innerWidth, innerHeight, onUpdate, onComplete) {
    const { xScale, yScale } = scales
    const { labels, values, drawStart } = data
    const svgEl = gEl.closest('svg')

    const userPoints = labels.slice(drawStart).map(label => ({
        label,
        value: null,
        x: xScale(label),
    }))

    // Anchor point: last known value — makes the drawn line continuous
    const anchorPoint = drawStart > 0 && values[drawStart - 1] != null
        ? { label: labels[drawStart - 1], value: values[drawStart - 1], x: xScale(labels[drawStart - 1]) }
        : null

    const drawn = new Set()
    let isDrawing = false

    const lineGen = d3.line()
        .x(d => d.x)
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX)

    const gSel = d3.select(gEl)

    function renderUserLine() {
        const filledPoints = userPoints.filter(p => p.value != null)
        const pointsToRender = anchorPoint ? [anchorPoint, ...filledPoints] : filledPoints
        gSel.select('.user-line')
            .datum(pointsToRender)
            .attr('d', pointsToRender.length > 0 ? lineGen : null)

        // Update last-user-value label — fixed at right axis edge, Y tracks latest drawn value.
        // Rendered on the SVG root so it appears outside the clipped <g>.
        const svgSel = d3.select(svgEl)
        svgSel.select('.val-label-last-user').remove()
        if (filledPoints.length > 0) {
            const last = filledPoints[filledPoints.length - 1]
            // X is always just beyond the right axis; Y follows the latest drawn value
            const svgX = MARGIN.left + innerWidth + 6
            const svgY = MARGIN.top + yScale(last.value) + 4
            svgSel.append('text')
                .attr('class', 'val-label-last-user')
                .attr('x', svgX)
                .attr('y', svgY)
                .attr('text-anchor', 'start')
                .style('font-size', '11px')
                .style('fill', '#c05621')
                .style('pointer-events', 'none')
                .style('user-select', 'none')
                .text(formatValue(last.value))
        }
    }

    function processPointer(event, containerEl) {
        const [mx, my] = d3.pointer(event, containerEl)

        let closest = null
        let minDist = Infinity
        userPoints.forEach(p => {
            const d = Math.abs(p.x - mx)
            if (d < minDist) { minDist = d; closest = p }
        })

        if (!closest || minDist > xScale.step() * 0.75) return

        const [yBottom, yTop] = yScale.range()
        const clamped = Math.max(yTop, Math.min(my, yBottom))
        closest.value = yScale.invert(clamped)
        drawn.add(closest.label)

        renderUserLine()
        onUpdate([...userPoints])

        if (drawn.size === userPoints.length) {
            // All hidden periods drawn — compute metrics
            const trueVals = labels.slice(drawStart).map((_, i) => values[drawStart + i])
            const userVals = userPoints.map(p => p.value)
            const metrics = computeMetrics(trueVals, userVals)
            onComplete([...userPoints], metrics)
        }
    }

    gSel.append('rect')
        .attr('class', 'drag-overlay')
        .attr('x', 0).attr('y', 0)
        .attr('width', innerWidth).attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mousedown.drag', function (e) { isDrawing = true; processPointer(e, this) })
        .on('mousemove.drag', function (e) { if (isDrawing) processPointer(e, this) })
        .on('mouseup.drag', () => { isDrawing = false })
        .on('mouseleave.drag', () => { isDrawing = false })
        .on('touchstart.drag', function (e) {
            e.preventDefault()
            isDrawing = true
            processPointer(e.changedTouches[0], this)
        })
        .on('touchmove.drag', function (e) {
            e.preventDefault()
            if (isDrawing) processPointer(e.changedTouches[0], this)
        })
        .on('touchend.drag', () => { isDrawing = false })

    return userPoints
}

/**
 * Animate the clip path to reveal the true line left-to-right.
 */
export function revealTrueLine(gEl, clipId, fullWidth) {
    d3.select(gEl)
        .select(`#${clipId} rect`)
        .transition()
        .duration(1500)
        .ease(d3.easeLinear)
        .attr('width', fullWidth + 50)
}

/**
 * Remove the drag overlay and user line so drawing can be re-initialized.
 */
export function resetDrawing(gEl) {
    const gSel = d3.select(gEl)
    gSel.select('.user-line').attr('d', null)
    gSel.select('.drag-overlay').remove()
    // Label lives on the SVG root, not inside <g>
    const svgEl = gEl.closest('svg')
    if (svgEl) d3.select(svgEl).select('.val-label-last-user').remove()
}

/**
 * Plot prior estimate lines, a mean line, and ±1 SD band over the drawing area.
 * Lines start from the anchor point (last known value) so they bridge the connector gap.
 *
 * @param {Element} gEl           — the .chart-g element
 * @param {Array}   priorEntries  — array of { data: [{period, value}] }
 * @param {Array}   periodsSlice  — array of { id, label } for the hidden periods
 * @param {{ xScale, yScale }} scales
 * @param {{ label: string, value: number }|null} anchorPoint — last known data point
 */
export function plotPriorEstimates(gEl, priorEntries, periodsSlice, scales, anchorPoint) {
    const { xScale, yScale } = scales

    // Remove any existing overlay first
    const gSel = d3.select(gEl)
    gSel.select('.prior-overlay').remove()

    if (!priorEntries.length || !periodsSlice.length) return

    const overlay = gSel.append('g').attr('class', 'prior-overlay')

    // Build a value matrix: allSeries[i] = array of values (one per period), null if missing
    const allSeries = priorEntries.map(entry => {
        const byPeriod = {}
        ;(entry.data || []).forEach(d => { byPeriod[d.period] = d.value })
        return periodsSlice.map(p => byPeriod[p.id] != null ? byPeriod[p.id] : null)
    })

    // Line generator (includes anchor point for continuity across connector gap)
    const lineGen = d3.line()
        .defined(d => d.value != null)
        .x(d => xScale(d.label))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX)

    // Per-period mean and SD across ALL entries (including those beyond cap)
    const meanSD = periodsSlice.map((_, pi) => {
        const vals = allSeries.map(s => s[pi]).filter(v => v != null)
        if (vals.length === 0) return { mean: null, sd: 0 }
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length
        const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
        return { mean, sd: Math.sqrt(variance) }
    })

    // ±1 SD band — light yellow, layered behind all lines
    const bandData = periodsSlice
        .map((p, i) => ({ label: p.label, ...meanSD[i] }))
        .filter(d => d.mean != null)

    if (bandData.length > 1) {
        const bandWithAnchor = anchorPoint
            ? [{ label: anchorPoint.label, mean: anchorPoint.value, sd: 0 }, ...bandData]
            : bandData

        const areaGen = d3.area()
            .defined(d => d.mean != null)
            .x(d => xScale(d.label))
            .y0(d => yScale(Math.max(yScale.domain()[0], d.mean - d.sd)))
            .y1(d => yScale(Math.min(yScale.domain()[1], d.mean + d.sd)))
            .curve(d3.curveMonotoneX)

        overlay.append('path')
            .datum(bandWithAnchor)
            .attr('class', 'prior-band')
            .attr('fill', '#fef9c3')
            .attr('opacity', 0.6)
            .attr('d', areaGen)
    }

    // Individual lines — cap at 10 most recent, bridge from anchor point
    const toPlot = allSeries.length > 10 ? allSeries.slice(-10) : allSeries
    toPlot.forEach(series => {
        const hiddenPoints = periodsSlice.map((p, i) => ({ label: p.label, value: series[i] }))
        const points = anchorPoint ? [anchorPoint, ...hiddenPoints] : hiddenPoints
        overlay.append('path')
            .datum(points)
            .attr('class', 'prior-line')
            .attr('fill', 'none')
            .attr('stroke', '#d8b4fe')
            .attr('stroke-width', 1)
            .attr('opacity', 0.5)
            .attr('d', lineGen)
    })

    // Mean line (drawn on top), bridge from anchor point
    if (bandData.length > 1) {
        const meanLineGen = d3.line()
            .defined(d => d.mean != null)
            .x(d => xScale(d.label))
            .y(d => yScale(d.mean))
            .curve(d3.curveMonotoneX)

        const meanWithAnchor = anchorPoint
            ? [{ label: anchorPoint.label, mean: anchorPoint.value }, ...bandData]
            : bandData

        overlay.append('path')
            .datum(meanWithAnchor)
            .attr('class', 'prior-mean')
            .attr('fill', 'none')
            .attr('stroke', '#7c3aed')
            .attr('stroke-width', 2.5)
            .attr('d', meanLineGen)
    }
}

/**
 * Remove the prior estimates overlay.
 */
export function clearPriorEstimates(gEl) {
    d3.select(gEl).select('.prior-overlay').remove()
}
