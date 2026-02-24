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
 * Compute Euclidean distance and Pearson correlation between two value arrays.
 * Both arrays must be the same length with no nulls.
 */
function computeMetrics(trueVals, userVals) {
    const n = trueVals.length
    if (n === 0) return null

    // Euclidean distance
    const euclidean = Math.sqrt(
        trueVals.reduce((sum, t, i) => sum + (t - userVals[i]) ** 2, 0)
    )

    // Pearson correlation
    const meanT = trueVals.reduce((s, v) => s + v, 0) / n
    const meanU = userVals.reduce((s, v) => s + v, 0) / n
    const num = trueVals.reduce((s, t, i) => s + (t - meanT) * (userVals[i] - meanU), 0)
    const denT = Math.sqrt(trueVals.reduce((s, t) => s + (t - meanT) ** 2, 0))
    const denU = Math.sqrt(userVals.reduce((s, u) => s + (u - meanU) ** 2, 0))
    const pearson = (denT === 0 || denU === 0) ? null : num / (denT * denU)

    return { euclidean, pearson }
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

        // Update last-user-value label
        gSel.select('.val-label-last-user').remove()
        if (filledPoints.length > 0) {
            const last = filledPoints[filledPoints.length - 1]
            gSel.append('text')
                .attr('class', 'val-label val-label-last-user')
                .attr('x', last.x)
                .attr('y', yScale(last.value) - 8)
                .attr('text-anchor', 'middle')
                .style('font-size', '11px')
                .style('fill', '#c05621')
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
    gSel.select('.val-label-last-user').remove()
    gSel.select('.drag-overlay').remove()
}
