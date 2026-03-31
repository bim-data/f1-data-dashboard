// js/api.js
import { BASE } from './constants.js';

// Encapsulated state! These cannot be accessed outside this file unless we export them.
let apiCache = {};
let LOCAL_DB = {};

export async function loadLocalDB(year) {
    try {
        const dbResponse = await fetch(`data/f1_db_${year}.json`);
        if (dbResponse.ok) {
            LOCAL_DB = await dbResponse.json();
            console.log(`Loaded local database for ${year}`);
        } else {
            console.log(`No local database found for ${year}, falling back entirely to Live API.`);
            LOCAL_DB = {};
        }
    } catch (e) {
        console.log("Could not load local DB, using Live API.");
        LOCAL_DB = {};
    }
}

// Intercepts API calls to check our local static database first
export async function fetchJSON(url) {
    // 1. Check in-memory cache (Fastest)
    if (apiCache[url]) return apiCache[url];

    // 2. Check browser session storage
    const cachedData = sessionStorage.getItem(url);
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        apiCache[url] = parsed;
        return parsed;
    }

    const relativeEndpoint = url.replace(BASE, '');

    // 3A. Check EXACT match in our static DB
    if (LOCAL_DB && LOCAL_DB[relativeEndpoint]) {
        apiCache[url] = LOCAL_DB[relativeEndpoint];
        return LOCAL_DB[relativeEndpoint];
    }

    // 3B. THE SMART FILTER: If the UI asks for a specific driver, grab the bulk DB data and filter it!
    if (LOCAL_DB && (relativeEndpoint.includes('&driver_number=') || relativeEndpoint.includes('&team_name='))) {
        const baseEndpoint = relativeEndpoint.split('&driver_number=')[0].split('&team_name=')[0];
        
        if (LOCAL_DB[baseEndpoint]) {
            const allData = LOCAL_DB[baseEndpoint];
            const urlParams = new URLSearchParams(relativeEndpoint.split('?')[1]);
            const dNum = urlParams.get('driver_number');
            const tName = urlParams.get('team_name');

            let filteredData = allData;
            if (dNum) filteredData = filteredData.filter(item => String(item.driver_number) === String(dNum));
            if (tName) filteredData = filteredData.filter(item => item.team_name === tName);

            apiCache[url] = filteredData;
            return filteredData;
        }
    }

    // 4. Fallback: Ask the live OpenF1 API
    console.log("Fallback to Live API:", relativeEndpoint);
    const r = await fetch(url);
    if (r.status === 429) throw new Error("Rate limit exceeded. Please wait a moment.");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let data = await r.json();

    if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (Array.isArray(data.data)) data = data.data;
        else if (Array.isArray(data.response)) data = data.response;
        else if (Array.isArray(data.items)) data = data.items;
    }

    try { sessionStorage.setItem(url, JSON.stringify(data)); } catch (e) { }
    apiCache[url] = data;
    return data;
}

// --- SPECIFIC DATA FETCHERS ---

export async function getPitStopData(sessionKey, driverNumber = null) {
    const allStops = await fetchJSON(`${BASE}/pit_stops?session_key=${sessionKey}`).catch(() => []);
    let results = allStops;
    if (driverNumber) results = allStops.filter(p => p.driver_number === driverNumber);
    return results.sort((a, b) => a.lap_number - b.lap_number);
}

export async function getStintData(sessionKey, driverNumber = null) {
    const allStints = await fetchJSON(`${BASE}/stints?session_key=${sessionKey}`).catch(() => []);
    let results = allStints;
    if (driverNumber) results = allStints.filter(s => s.driver_number === driverNumber);
    return results.sort((a, b) => {
        if (a.driver_number === b.driver_number) return a.stint_number - b.stint_number;
        return a.driver_number - b.driver_number;
    });
}

export async function getLapAnalysisData(sessionKey, driverNumber = null) {
    const allLaps = await fetchJSON(`${BASE}/laps?session_key=${sessionKey}`).catch(() => []);
    let results = allLaps;
    if (driverNumber) results = allLaps.filter(l => l.driver_number === driverNumber);
    return results.sort((a, b) => a.lap_number - b.lap_number);
}

export async function getSafetyCarPeriods(sessionKey, referenceLaps) {
    const rcData = await fetchJSON(`${BASE}/race_control?session_key=${sessionKey}`).catch(() => []);
    let periods = [];
    let currentPeriod = null;

    rcData.sort((a,b) => new Date(a.date) - new Date(b.date));

    rcData.forEach(rc => {
        const msg = (rc.message || '').toUpperCase();
        
        const isVSC = msg.includes('VIRTUAL SAFETY CAR DEPLOYED') || msg.includes('VSC DEPLOYED');
        const isSC = msg.includes('SAFETY CAR DEPLOYED') && !isVSC;
        const isClear = msg.includes('TRACK CLEAR');

        if (isSC || isVSC) {
            const type = isSC ? 'SC' : 'VSC';
            if (!currentPeriod || currentPeriod.type !== type) {
                if (currentPeriod) {
                    currentPeriod.endTime = new Date(rc.date);
                    periods.push(currentPeriod);
                }
                currentPeriod = { type, startTime: new Date(rc.date) };
            }
        } else if (isClear) {
            if (currentPeriod) {
                currentPeriod.endTime = new Date(rc.date);
                periods.push(currentPeriod);
                currentPeriod = null;
            }
        }
    });

    const sortedLaps = referenceLaps.filter(l => l.date_start).sort((a,b) => new Date(a.date_start) - new Date(b.date_start));
    
    if (currentPeriod && sortedLaps.length > 0) {
        currentPeriod.endTime = new Date(sortedLaps[sortedLaps.length-1].date_start);
        periods.push(currentPeriod);
    }

    if (sortedLaps.length === 0) return [];

    return periods.map(p => {
        let sLap = 1;
        let eLap = sortedLaps[sortedLaps.length-1].lap_number;

        let foundStart = false;
        for (let i=0; i<sortedLaps.length; i++) {
            if (new Date(sortedLaps[i].date_start) >= p.startTime) { 
                sLap = sortedLaps[i].lap_number; 
                foundStart = true;
                break; 
            }
        }
        
        if (!foundStart && p.startTime > new Date(sortedLaps[sortedLaps.length-1].date_start)) {
            return null; 
        }

        for (let i=0; i<sortedLaps.length; i++) {
            if (new Date(sortedLaps[i].date_start) >= p.endTime) { 
                eLap = sortedLaps[i].lap_number; 
                break; 
            }
        }

        if (eLap === sLap) eLap += 0.5; 

        return { type: p.type, startLap: sLap, endLap: eLap };
    }).filter(p => p !== null && p.endLap > p.startLap);
}