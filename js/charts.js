// js/charts.js


/**
 * Universal Drag-to-Zoom logic for Chart.js
 * Automatically uses 2D (XY) bounding box zoom for single charts, 
 * and 1D (X-only) synchronized column zoom for multiple stacked charts.
 */
export function enableChartZoom(wrapperId, brushId, resetBtnId, chartInstances, minZoomPixels = 15) {
    const chartWrapper = document.getElementById(wrapperId);
    const brush = document.getElementById(brushId);
    const resetBtn = document.getElementById(resetBtnId);
    
    if (!chartWrapper || !brush || !resetBtn || !chartInstances) return;

    // Convert single chart to array for easier handling
    const charts = Array.isArray(chartInstances) ? chartInstances : [chartInstances];
    
    // Auto-detect mode: Single charts can zoom both X and Y. Stacked charts only zoom X.
    const zoomMode = charts.length > 1 ? 'x' : 'xy';

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    chartWrapper.onmousedown = (e) => {
        isDragging = true;
        const rect = chartWrapper.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
        brush.style.left = startX + 'px';
        brush.style.width = '0px';
        brush.style.display = 'block';
        
        if (zoomMode === 'xy') {
            brush.style.top = startY + 'px';
            brush.style.height = '0px';
            brush.style.bottom = 'auto'; // Override any inline bottom constraints
        } else {
            brush.style.top = '0px';
            brush.style.bottom = '0px';
            brush.style.height = 'auto';
        }
    };

    chartWrapper.onmousemove = (e) => {
        if (!isDragging) return;
        const rect = chartWrapper.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        
        brush.style.left = Math.min(startX, currentX) + 'px';
        brush.style.width = Math.abs(currentX - startX) + 'px';
        
        if (zoomMode === 'xy') {
            const currentY = e.clientY - rect.top;
            brush.style.top = Math.min(startY, currentY) + 'px';
            brush.style.height = Math.abs(currentY - startY) + 'px';
        }
    };

    const finishDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        brush.style.display = 'none';

        const rect = chartWrapper.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        
        const minPixelX = Math.min(startX, endX);
        const maxPixelX = Math.max(startX, endX);
        
        let minPixelY, maxPixelY;
        if (zoomMode === 'xy') {
            const endY = e.clientY - rect.top;
            minPixelY = Math.min(startY, endY);
            maxPixelY = Math.max(startY, endY);
        }

        // Require at least a small drag box to trigger zoom (prevents accidental clicks)
        const zoomX = (maxPixelX - minPixelX) >= minZoomPixels;
        const zoomY = zoomMode === 'xy' && (maxPixelY - minPixelY) >= minZoomPixels;
        
        if (!zoomX && !zoomY) return;

        let zoomed = false;

        charts.forEach(chart => {
            if (!chart.scales.x || !chart.scales.y) return;
            
            // Use Chart.js built-in pixel-to-value converters!
            // This perfectly handles inverted/reversed scales automatically.
            if (zoomX) {
                const valX1 = chart.scales.x.getValueForPixel(minPixelX);
                const valX2 = chart.scales.x.getValueForPixel(maxPixelX);
                chart.options.scales.x.min = Math.min(valX1, valX2);
                chart.options.scales.x.max = Math.max(valX1, valX2);
                zoomed = true;
            }
            
            if (zoomY) {
                const valY1 = chart.scales.y.getValueForPixel(minPixelY);
                const valY2 = chart.scales.y.getValueForPixel(maxPixelY);
                chart.options.scales.y.min = Math.min(valY1, valY2);
                chart.options.scales.y.max = Math.max(valY1, valY2);
                zoomed = true;
            }
            
            if (zoomed) chart.update('none');
        });
        
        if (zoomed) resetBtn.style.display = 'block';
    };

    chartWrapper.onmouseup = finishDrag;
    chartWrapper.onmouseleave = finishDrag;

    resetBtn.onclick = () => {
        charts.forEach(chart => {
            delete chart.options.scales.x.min;
            delete chart.options.scales.x.max;
            if (zoomMode === 'xy') {
                delete chart.options.scales.y.min;
                delete chart.options.scales.y.max;
            }
            chart.update('none');
        });
        resetBtn.style.display = 'none';
    };
}