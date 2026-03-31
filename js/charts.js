// js/charts.js

/**
 * Universal Drag-to-Zoom logic for Chart.js
 * Works with a single chart or an array of synchronized charts.
 */
export function enableChartZoom(wrapperId, brushId, resetBtnId, chartInstances, minZoomThreshold = 5) {
    const chartWrapper = document.getElementById(wrapperId);
    const brush = document.getElementById(brushId);
    const resetBtn = document.getElementById(resetBtnId);
    
    if (!chartWrapper || !brush || !resetBtn || !chartInstances) return;

    // Convert single chart to array for easier handling
    const charts = Array.isArray(chartInstances) ? chartInstances : [chartInstances];

    let isDragging = false;
    let startX = 0;

    chartWrapper.onmousedown = (e) => {
        isDragging = true;
        const rect = chartWrapper.getBoundingClientRect();
        startX = e.clientX - rect.left;
        brush.style.left = startX + 'px';
        brush.style.width = '0px';
        brush.style.display = 'block';
    };

    chartWrapper.onmousemove = (e) => {
        if (!isDragging) return;
        const rect = chartWrapper.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        brush.style.left = Math.min(startX, currentX) + 'px';
        brush.style.width = Math.abs(currentX - startX) + 'px';
    };

    const finishDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        brush.style.display = 'none';

        const rect = chartWrapper.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        
        const minPixelX = Math.min(startX, endX);
        const maxPixelX = Math.max(startX, endX);

        if (maxPixelX - minPixelX < 15) return; 

        // Use the first chart to calculate the bounding box percentages
        const primaryChart = charts[0];
        if (!primaryChart || !primaryChart.chartArea) return;
        const area = primaryChart.chartArea;

        let pctStart = (minPixelX - area.left) / area.width;
        let pctEnd = (maxPixelX - area.left) / area.width;
        
        pctStart = Math.max(0, Math.min(1, pctStart));
        pctEnd = Math.max(0, Math.min(1, pctEnd));

        const currentMin = primaryChart.options.scales.x.min ?? 0;
        const currentMax = primaryChart.options.scales.x.max ?? (primaryChart.data.labels.length - 1);
        const currentRange = currentMax - currentMin;

        const newMin = Math.round(currentMin + pctStart * currentRange);
        const newMax = Math.round(currentMin + pctEnd * currentRange);

        if (newMax - newMin > minZoomThreshold) {
            charts.forEach(chart => {
                chart.options.scales.x.min = newMin;
                chart.options.scales.x.max = newMax;
                chart.update('none');
            });
            resetBtn.style.display = 'block';
        }
    };

    chartWrapper.onmouseup = finishDrag;
    chartWrapper.onmouseleave = finishDrag;

    resetBtn.onclick = () => {
        charts.forEach(chart => {
            delete chart.options.scales.x.min;
            delete chart.options.scales.x.max;
            chart.update('none');
        });
        resetBtn.style.display = 'none';
    };
}