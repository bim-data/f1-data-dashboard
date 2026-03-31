// js/telemetry.js

// Mathematically derive track corners from GPS telemetry
export function calculateTrackCorners(trackX, trackY) {
    const NUM_POINTS = trackX.length - 1;
    const headings = [], curvatures = [], smoothCurv = [];
    
    // 1. Calculate heading direction
    for(let i=0; i<=NUM_POINTS; i++) {
        if (i===0) headings.push(0);
        else headings.push(Math.atan2(trackY[i] - trackY[i-1], trackX[i] - trackX[i-1]));
    }

    // 2. Calculate angular change (curvature)
    for(let i=0; i<=NUM_POINTS; i++) {
        if (i===0) curvatures.push(0);
        else {
            let diff = headings[i] - headings[i-1];
            while(diff > Math.PI) diff -= 2*Math.PI;
            while(diff < -Math.PI) diff += 2*Math.PI;
            curvatures.push(Math.abs(diff));
        }
    }

    // 3. Smooth the noise out of the GPS data
    const w = 2;
    for(let i=0; i<=NUM_POINTS; i++) {
        let sum = 0, count = 0;
        for(let j=Math.max(0, i-w); j<=Math.min(NUM_POINTS, i+w); j++){
            sum += curvatures[j]; count++;
        }
        smoothCurv.push(sum/count);
    }

    // 4. Find the peaks (apexes)
    const corners = [];
    let turnCount = 1;
    for(let i=3; i<NUM_POINTS-3; i++) {
        let isPeak = true;
        for(let j=-3; j<=3; j++) {
            if(smoothCurv[i+j] > smoothCurv[i]) { isPeak = false; break; }
        }
        if (isPeak && smoothCurv[i] > 0.035) {
            if(corners.length === 0 || (i - corners[corners.length-1].index) > 6) {
                corners.push({ index: i, text: 'T' + turnCount });
                turnCount++;
            }
        }
    }
    return corners;
}

// Unify, interpolate, and perfectly align telemetry traces using Piecewise Dual-Anchoring
export function processTelemetryMath(dataArray, numPoints = 300) {
    const processed = dataArray.map(d => {
        let locTrace = [];
        let trace = [];
        let t0 = new Date(d.lap.date_start).getTime();

        if (d.isFastF1) {
            locTrace = d.trace.map(pt => ({ time: pt.time, x: pt.x, y: pt.y }));
            trace = d.trace.map(pt => ({...pt}));
        } else {
            // OpenF1 Fallback Integration
            const sortedCar = [...(d.car || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
            let cumDist = 0;
            if (sortedCar.length > 0) {
                const firstT = (new Date(sortedCar[0].date).getTime() - t0) / 1000;
                if (firstT > 0) {
                    cumDist = (sortedCar[0].speed / 3.6) * firstT;
                    trace.push({ time: 0, speed: sortedCar[0].speed, rawDist: 0 }); 
                }
            }
            sortedCar.forEach((c, i) => {
                const t = (new Date(c.date).getTime() - t0) / 1000;
                if (t < -1) return; 
                if (i > 0) {
                    const prevCar = sortedCar[i-1];
                    const prevT = (new Date(prevCar.date).getTime() - t0) / 1000;
                    const dt = t - prevT;
                    if (dt > 0) {
                        const v = ((c.speed + prevCar.speed) / 2) / 3.6; 
                        cumDist += v * dt;
                    }
                }
                trace.push({ time: t, speed: c.speed, rawDist: cumDist });
            });

            const sortedLoc = [...(d.loc || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
            locTrace = sortedLoc.map(l => ({
                time: (new Date(l.date).getTime() - t0) / 1000,
                x: l.x, y: l.y
            }));
        }

        // --- BULLETPROOF LAP 1 TRIMMER & TURN 1 FINDER ---
        let t1ApexDist = 0;
        if ((d.lap.lap_number === 1 || d.lap.is_pit_out_lap) && trace.length > 0) {
            
            let first100Idx = 0;
            for (let i = 0; i < trace.length; i++) {
                if (trace[i].speed > 100) {
                    first100Idx = i;
                    break;
                }
            }

            let launchIdx = 0;
            for (let i = first100Idx; i >= 0; i--) {
                if (trace[i].speed < 5) {
                    launchIdx = i;
                    break;
                }
            }

            if (launchIdx > 0) {
                const distOffset = trace[launchIdx].rawDist;
                const timeOffset = trace[launchIdx].time;
                trace = trace.slice(launchIdx);
                trace.forEach(pt => {
                    pt.rawDist -= distOffset;
                    pt.time -= timeOffset;
                });
                
                locTrace = locTrace.filter(l => l.time >= timeOffset);
                locTrace.forEach(l => l.time -= timeOffset);
            }

            let peakIdx = 0;
            let maxSpd = 0;
            for (let i = 0; i < Math.min(trace.length, 1000); i++) {
                if (trace[i].speed > maxSpd) {
                    maxSpd = trace[i].speed;
                    peakIdx = i;
                }
                if (maxSpd > 150 && trace[i].speed < maxSpd - 30) break;
            }

            let minSpd = maxSpd;
            let apexIdx = peakIdx;
            for (let i = peakIdx; i < Math.min(trace.length, peakIdx + 500); i++) {
                if (!trace[i]) break;
                if (trace[i].speed < minSpd) {
                    minSpd = trace[i].speed;
                    apexIdx = i;
                }
                if (trace[i].speed > minSpd + 30) break;
            }

            t1ApexDist = trace[apexIdx] ? trace[apexIdx].rawDist : 0;
        }

        const rawTotalDist = trace.length > 0 ? trace[trace.length-1].rawDist : 1;
        trace.forEach(pt => pt.pct = pt.rawDist / rawTotalDist);

        return { ...d, trace, locTrace, rawTotalDist, t1ApexDist };
    });

    // --- PIECEWISE DUAL-ANCHOR ENGINE ---
    let baseTotalDist = processed[0].rawTotalDist;
    let baseT1Dist = processed[0].t1ApexDist || 0;

    processed.forEach(p => {
        const isShortLap = p.lap.lap_number === 1 || p.lap.is_pit_out_lap;

        p.trace.forEach(pt => {
            if (isShortLap && p.t1ApexDist > 0 && p.rawTotalDist > p.t1ApexDist) {
                if (pt.rawDist <= p.t1ApexDist) {
                    const segmentPct = pt.rawDist / p.t1ApexDist;
                    pt.normDist = segmentPct * baseT1Dist;
                } else {
                    const segmentPct = (pt.rawDist - p.t1ApexDist) / (p.rawTotalDist - p.t1ApexDist);
                    pt.normDist = baseT1Dist + (segmentPct * (baseTotalDist - baseT1Dist));
                }
            } else {
                pt.normDist = pt.pct * baseTotalDist;
            }
        });
    });

    // --- UNIFORM RESAMPLING ---
    const chartRange = baseTotalDist * 0.995;
    const step = chartRange / numPoints;
    
    const baseTrace = processed[0].trace;
    const baseLoc = processed[0].locTrace;

    const getAtDist = (arr, targetDist) => {
        if(arr.length === 0) return {time: null, speed: null};
        if(targetDist <= arr[0].normDist) return arr[0]; 
        if(targetDist >= arr[arr.length-1].normDist) return arr[arr.length-1];

        let idx = arr.findIndex(item => item.normDist >= targetDist);
        if(idx <= 0) return arr[0];
        
        let p1 = arr[idx-1], p2 = arr[idx];
        let fraction = (targetDist - p1.normDist) / (p2.normDist - p1.normDist) || 0;
        return {
            time: p1.time + fraction * (p2.time - p1.time),
            speed: p1.speed + fraction * (p2.speed - p1.speed)
        };
    };

    const getLocAtTime = (arr, t) => {
        if (arr.length === 0 || t === null) return {x:0, y:0};
        if(t <= arr[0].time) return arr[0];
        if(t >= arr[arr.length-1].time) return arr[arr.length-1];

        let idx = arr.findIndex(item => item.time >= t);
        if(idx <= 0) return arr[0];
        
        let p1 = arr[idx-1], p2 = arr[idx];
        let fraction = (t - p1.time) / (p2.time - p1.time) || 0;
        return {
            x: p1.x + fraction * (p2.x - p1.x),
            y: p1.y + fraction * (p2.y - p1.y)
        };
    };

    const chartLabels = [];
    const trackX = [];
    const trackY = [];
    const uniformData = processed.map(p => ({ dNum: p.dNum, lap: p.lap, speedData: [], deltaData: [] }));

    for (let i = 0; i <= numPoints; i++) {
        const targetDist = i * step; 
        chartLabels.push((targetDist / 1000).toFixed(2) + 'km');

        const basePt = getAtDist(baseTrace, targetDist);
        const locPt = getLocAtTime(baseLoc, basePt.time);
        
        trackX.push(locPt.x);
        trackY.push(locPt.y);

        uniformData.forEach((ud, idx) => {
            const pt = getAtDist(processed[idx].trace, targetDist);
            ud.speedData.push(pt.speed);
            
            if (pt.time !== null && basePt.time !== null) {
                ud.deltaData.push(pt.time - basePt.time);
            } else {
                ud.deltaData.push(null);
            }
        });
    }

    const corners = trackX.some(x => x !== 0) ? calculateTrackCorners(trackX, trackY) : [];
    return { chartLabels, uniformData, corners };
}