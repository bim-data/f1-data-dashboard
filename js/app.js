// js/app.js
import * as Constants from './constants.js';
import * as Utils from './utils.js';
import * as API from './api.js';
import * as Telemetry from './telemetry.js';
import * as Charts from './charts.js';

// --- APPLICATION STATE ---
const NOW = new Date();
const delay = (ms) => new Promise(res => setTimeout(res, ms));

let currentYear = 2026;
let currentMeeting = null;
let currentSession = null;
let allMeetings = [];
let orderedDriversList = []; 
let driverChartInstance = null;
let currentDriverView = null; 
let previousView = 'view-drivers';
let championshipRanks = {}; 
let racePositionChartInstance = null;
let engineSuppliersLoaded = false;
window.cachedEngineStats = null;
window.sessionEngineDataCache = window.sessionEngineDataCache || {};

// --- VIEW MANAGEMENT & BREADCRUMBS ---
window.showView = function(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

window.updateBreadcrumb = function() {
    const bc = document.getElementById('breadcrumb');
    let html = `<span onclick="goHome()">Season</span>`;
    if (currentMeeting) {
        html += `<span class="bc-sep">›</span><span>${currentMeeting.circuit_short_name}</span>`;
    }
    bc.innerHTML = html;
};

window.goHome = function() {
    currentMeeting = null;
    currentSession = null;
    window.updateBreadcrumb();
    window.showView('view-season');
    window.switchSeasonTab('weekends');
    window.scrollTo(0, 0); 
};

window.toggleTheme = function() {
    const body = document.body;
    const isDark = body.dataset.theme === 'dark';
    body.dataset.theme = isDark ? 'light' : 'dark';
    document.getElementById('theme-btn').textContent = isDark ? '☾ Dark' : '☀ Light';
    
    if (document.getElementById('view-driver-detail').classList.contains('active') && currentDriverView) {
        window.viewDriverDetails(currentDriverView);
    }
    
    if (document.getElementById('view-drivers').classList.contains('active')) {
        const lapTimesTab = document.getElementById('subtab-content-lap-times');
        if (lapTimesTab && lapTimesTab.classList.contains('active')) {
            window.renderPaceAnalysisTab('subtab-content-lap-times'); 
        }
    }
};

window.toggleStandings = function() {
    const layout = document.getElementById('main-layout');
    const btn = document.getElementById('standings-toggle');
    const isHidden = layout.classList.toggle('hide-standings');
    btn.textContent = isHidden ? 'Show Standings' : 'Hide Standings';
};

window.toggleMobileStandings = function(panelId) {
    const panel = document.getElementById(panelId);
    if (panel.classList.contains('mobile-modal-active')) {
        panel.classList.remove('mobile-modal-active');
        document.body.style.overflow = ''; 
    } else {
        document.querySelectorAll('.standings-panel').forEach(p => p.classList.remove('mobile-modal-active'));
        panel.classList.add('mobile-modal-active');
        document.body.style.overflow = 'hidden'; 
    }
};

// --- TAB SWITCHING ---
window.switchSeasonTab = function(tabId) {
    document.querySelectorAll('#season-main-tabs .session-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`season-tab-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('#view-season > .subtab-content').forEach(content => content.classList.remove('active'));
    const activeContent = document.getElementById(`season-tab-content-${tabId}`);
    if (activeContent) activeContent.classList.add('active');

    if (tabId === 'summary') {
        window.switchSeasonSummaryTab('championship');
    }
};

window.switchSeasonChampSubTab = function(tabId) {
    document.querySelectorAll('#season-champ-subtabs .subtab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`season-champ-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('#season-championship-battle-area .subtab-content').forEach(content => content.classList.remove('active'));
    const activeContent = document.getElementById(`season-champ-content-${tabId}`);
    if (activeContent) activeContent.classList.add('active');

    // --- THE FIX: Force Chart.js to recalculate dimensions now that the container is visible! ---
    if (tabId === 'driver') {
        if (window.champDriverChartInst) window.champDriverChartInst.resize();
        if (window.champDriverAreaChartInst) window.champDriverAreaChartInst.resize();
    } else if (tabId === 'team') {
        if (window.champTeamChartInst) window.champTeamChartInst.resize();
        if (window.champTeamAreaChartInst) window.champTeamAreaChartInst.resize();
    }
};

window.switchSeasonSummaryTab = function(tabId) {
    document.querySelectorAll('#season-summary-subtabs .subtab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`season-summary-tab-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('#season-tab-content-summary .subtab-content').forEach(content => content.classList.remove('active'));
    const activeContent = document.getElementById(`season-summary-tab-content-${tabId}`);
    if (activeContent) activeContent.classList.add('active');

    if (tabId === 'engines') {
        document.querySelectorAll('[id^="engine-violin-"]').forEach(panel => {
            panel.style.display = 'none';
            panel.innerHTML = '';         
        });
        
        if (typeof engineViolinCache !== 'undefined') {
            for (let key in engineViolinCache) engineViolinCache[key] = false;
        }

        if (typeof window.renderEngineTiles === 'function' && window.cachedEngineStats) {
            window.renderEngineTiles(null);
        }

        window.renderEngineSuppliers();
    } else if (tabId === 'championship') {
        // --- THE FIX: Resize the charts when the parent tab actually becomes visible! ---
        const activeChampBtn = document.querySelector('#season-champ-subtabs .subtab-btn.active');
        // Check if we are currently looking at the driver or team sub-tab
        const champTabId = activeChampBtn ? activeChampBtn.id.replace('season-champ-btn-', '') : 'driver';
        
        // Re-trigger the sub-tab logic, which contains our .resize() commands!
        window.switchSeasonChampSubTab(champTabId);
    }
};

window.switchDriverSubTab = function(tabId) {
    document.querySelectorAll('#driver-subtabs-container .subtab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`driver-subtab-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('#driver-subtabs-wrapper .subtab-content').forEach(content => content.classList.remove('active'));
    const activeContent = document.getElementById(`driver-subtab-content-${tabId}`);
    if (activeContent) activeContent.classList.add('active');

    if (tabId === 'places' && currentDriverView) {
        window.renderRacePositionChart('driver-subtab-content-places', currentDriverView);
    }
    if (tabId === 'lap-times' && currentDriverView && currentSession) {
        window.renderPaceAnalysisTab('driver-subtab-content-lap-times'); 
    }
    // --- THE FIX: Route the new tab to the generic Dominance function! ---
    if (tabId === 'lap-comparisons' && currentDriverView && currentSession) {
        window.renderTrackDominance('ddom', currentDriverView);
    }
};

window.switchSubTab = function(tabId) {
    document.querySelectorAll('.subtab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`subtab-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('.subtab-content').forEach(content => content.classList.remove('active'));
    
    const content = document.getElementById(`subtab-content-${tabId}`);
    if (content) {
        content.classList.add('active');
    } else {
        const newContent = document.createElement('div');
        newContent.id = `subtab-content-${tabId}`;
        newContent.className = 'subtab-content active';
        document.getElementById('subtabs-wrapper').appendChild(newContent);
    }

    const containerId = `subtab-content-${tabId}`;
    if (tabId === 'lap-chart') {
        window.renderRacePositionChart(containerId, null);
    } else if (tabId === 'pit-stops' || tabId === 'run-plans') {
        window.renderSessionStints(containerId);
    } else if (tabId === 'lap-times') {
        window.renderPaceAnalysisTab(containerId); 
    } else if (tabId === 'track-dominance') {
        window.renderTrackDominance(); 
    } else if (tabId === 'lap-comparisons') {
        window.renderLapComparisons(containerId);
    }
};

window.switchProfileSubTab = function(tabId) {
    document.querySelectorAll('#profile-subtabs-container .subtab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`profile-subtab-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('#profile-subtabs-wrapper .subtab-content').forEach(content => content.classList.remove('active'));
    const activeContent = document.getElementById(`profile-subtab-content-${tabId}`);
    if (activeContent) activeContent.classList.add('active');
};

window.switchTeamSubTab = function(tabId) {
    document.querySelectorAll('#team-subtabs-container .subtab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`team-subtab-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('#team-subtabs-wrapper .subtab-content').forEach(content => content.classList.remove('active'));
    const activeContent = document.getElementById(`team-subtab-content-${tabId}`);
    if (activeContent) activeContent.classList.add('active');
};

window.switchQualiTab = function(btn, phaseId) {
    document.querySelectorAll('.quali-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.quali-group').forEach(g => g.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('group-' + phaseId).classList.add('active');
};

window.updateDriverSubTabsForSession = function() {
    const sn = (currentSession?.session_name || '').toLowerCase();
    const isRace = (sn.includes('race') || sn.includes('sprint')) && !sn.includes('qualifying') && !sn.includes('shoot');
    const isQuali = sn.includes('qualifying') || sn.includes('shoot');

    // 1. Build the Tab Buttons
    const container = document.getElementById('driver-subtabs-container');
    if (container) {
        let html = `<button class="subtab-btn active" id="driver-subtab-btn-tire-strategy" onclick="switchDriverSubTab('tire-strategy')">Lap Times</button>`;
        if (isRace) {
            html += `<button class="subtab-btn" id="driver-subtab-btn-places" onclick="switchDriverSubTab('places')">Positions Gained/Lost</button>`;
        }
        if (isQuali) {
            html += `<button class="subtab-btn" id="driver-subtab-btn-lap-comparisons" onclick="switchDriverSubTab('lap-comparisons')">Lap Comparison</button>`;
        }
        container.innerHTML = html;
    }

    // 2. ALWAYS inject/rebuild the HTML layout to ensure the correct Driver Number is permanently baked into the onchange event
    const wrapper = document.getElementById('driver-subtabs-wrapper');
    if (wrapper) {
        let compTab = document.getElementById('driver-subtab-content-lap-comparisons');
        
        // If it doesn't exist, create the wrapper div
        if (!compTab) {
            compTab = document.createElement('div');
            compTab.id = 'driver-subtab-content-lap-comparisons';
            compTab.className = 'subtab-content';
            wrapper.appendChild(compTab);
        }

        // Rebuild the inner HTML every time so it always has the correct currentDriverView
        // Rebuild the inner HTML every time so it always has the correct currentDriverView
        compTab.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 1rem;">
          <div class="standings-title" style="margin-bottom: 0.5rem; font-size: 0.8rem;">Compare Lap With</div>
          
          <div style="display: flex; gap: 1.5rem; align-items: center;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span id="ddom-name-a" style="font-family:'Barlow Condensed'; font-size:1.3rem; font-weight:700; color:var(--text);"></span>
              <span id="ddom-time-a" style="font-family:'Barlow Condensed'; font-size:1.3rem; color:var(--text);"></span>
            </div>
            <span style="font-family:'Barlow Condensed'; font-size:1.2rem; font-weight:700; color:var(--text-dim);">VS</span>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span id="ddom-time-b" style="font-family:'Barlow Condensed'; font-size:1.3rem; color:var(--text);"></span>
              <select id="ddom-driver-b" class="theme-toggle" style="appearance: auto; padding: 0.5rem;" onchange="window.renderTrackDominance('ddom', ${currentDriverView})"></select>
            </div>
          </div>
        </div>
        
        <div id="ddom-loading" class="loading" style="display:none;"><div class="spinner"></div>Analyzing Telemetry...</div>
        
        <div id="ddom-results" style="display:none;">
          <div id="ddom-trace-container" style="width: 100%; margin-bottom: 2.5rem;">
            <div class="standings-title" style="margin-bottom: 0.5rem; text-align: left;">Telemetry Trace</div>
            <div id="ddom-trace-body" style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1rem;"></div>
          </div>
          
          <div style="max-width: 1000px; margin: 0 auto;">
            <div class="standings-title" style="margin-bottom: 0.5rem; text-align: left;">Sector Comparison</div>
            <div style="display: flex; gap: 1.5rem; align-items: flex-start; justify-content: center; flex-wrap: wrap;">
              
              <div style="flex: 1; min-width: 400px; max-width: 600px; background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem 1rem; text-align:center; position: relative;">
                <button id="ddom-toggle-times-btn" class="theme-toggle" onclick="window.toggleMiniSectors('ddom')" style="position: absolute; top: 1.25rem; right: 1.25rem; padding: 0.3rem 0.8rem; z-index: 10;">Show Sector Times</button>
                <div id="ddom-analysis" class="stats-bar" style="margin-bottom:1.5rem; justify-content:flex-start; gap: 3rem; padding-bottom:1.5rem; border-bottom:1px solid var(--border); text-align: left;"></div>
                <canvas id="ddom-trackMapCanvas" width="800" height="400" style="max-width:100%; height:auto; margin: 0 auto; display: block;"></canvas>
                <div id="ddom-map-legend" style="display:flex; justify-content:center; gap:1.5rem; margin-top:1.5rem; font-family:'Barlow Condensed'; font-size:0.9rem; font-weight:700;"></div>
              </div>

              <div id="ddom-mini-sectors-wrapper" style="display:none; width: 320px; flex-shrink: 0;">
                <div id="ddom-mini-sectors" style="background:var(--surface); border:1px solid var(--border); border-radius:4px; overflow-y:auto; max-height: 535px;"></div>
              </div>

            </div>
          </div>

        </div>
        `;
    }
};

// --- INITIALIZATION ---
window.changeYear = async function(year) {
    currentYear = parseInt(year);
    const logoYear = document.querySelector('.logo-year');
    if (logoYear) logoYear.textContent = currentYear;
    const viewTitle = document.querySelector('#view-season .view-title');
    if (viewTitle) viewTitle.textContent = `${currentYear} Formula One World Championship`;
    
    window.goHome();
    document.getElementById('season-grid').innerHTML = `<div class="loading"><div class="spinner"></div>Fetching calendar</div>`;
    document.getElementById('season-summary-leaders').innerHTML = `<div class="loading" style="grid-column: 1 / -1; padding: 2rem;"><div class="spinner"></div>Loading championship leaders...</div>`;
    document.getElementById('season-championship-battle-area').innerHTML = `Championship battle timeline coming soon...`;
    
    // --- THE FIX: WIPE THE ENGINE SUPPLIER CACHE ---
    engineSuppliersLoaded = false;
    window.cachedEngineStats = null;
    window.sessionEngineDataCache = {};
    const engineArea = document.getElementById('season-engines-area');
    if (engineArea) engineArea.innerHTML = `<div class="loading"><div class="spinner"></div>Loading engine data...</div>`;
    // -----------------------------------------------

    document.getElementById('standings-drivers').innerHTML = `<div class="standings-header"><span class="standings-title">Drivers</span></div><div class="loading" style="padding:2rem 1rem"><div class="spinner"></div></div>`;
    document.getElementById('standings-constructors').innerHTML = `<div class="standings-header"><span class="standings-title">Constructors</span></div><div class="loading" style="padding:2rem 1rem"><div class="spinner"></div></div>`;
    document.getElementById('season-sub').textContent = 'Loading calendar...';
    
    await API.loadLocalDB(currentYear);
    window.loadSeason();
};

async function startApp() {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    // --- THE FIX: Force the dropdown to sync with the JS state on refresh! ---
    const yearSelect = document.getElementById('year-select');
    if (yearSelect) yearSelect.value = currentYear;

    await API.loadLocalDB(currentYear);
    window.loadSeason();
    window.scrollTo(0, 0);
}

// --- SEASON LOADING & RENDERING ---
window.loadSeason = async function() {
    try {
        const meetings = await API.fetchJSON(`${Constants.BASE}/meetings?year=${currentYear}`);
        allMeetings = meetings.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
        
        let rwCount = 0;
        allMeetings.forEach(m => {
            m.is_testing = (m.meeting_name || '').toLowerCase().includes('testing');
            if (!m.is_testing) {
                rwCount++;
                m.race_week = rwCount; 
            }
        });

        window.renderSeason();
        window.loadStandings();
    } catch (e) {
        document.getElementById('season-grid').innerHTML = `<div class="error-msg">Could not load season data. ${e.message}</div>`;
    }
};

window.renderSeason = function() {
    const raceMeetings = allMeetings.filter(m => !m.is_testing);
    const testMeetings = allMeetings.filter(m => m.is_testing);

    const pastRaces = raceMeetings.filter(m => new Date(m.date_end) < NOW);
    const futureRaces = raceMeetings.filter(m => new Date(m.date_end) >= NOW);
    const nextRace = futureRaces[0];

    document.getElementById('season-sub').textContent = `${pastRaces.length} races completed · ${futureRaces.length} remaining`;
    
    const generateCards = (meetings, nextEvent) => {
        if (meetings.length === 0) return `<div style="grid-column: 1/-1; padding: 2rem; color: var(--text-dim);">No events scheduled.</div>`;
        
        return meetings.map((m) => {
            const isPast = new Date(m.date_end) < NOW;
            const isNext = nextEvent && m.meeting_key === nextEvent.meeting_key;
            let cls = isPast ? '' : isNext ? 'next-race' : 'future-race';
            const onclick = (isPast || isNext) ? `onclick="selectMeeting(${m.meeting_key})"` : '';
            
            const imgHtml = m.circuit_image
                ? `<img src="${m.circuit_image}" alt="${m.circuit_short_name}" onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>Circuit</div>'">`
                : `<div class="card-img-placeholder">Circuit</div>`;
                
            const roundLabel = m.is_testing ? 'Pre-Season Testing' : `Race ${m.race_week}`;
            
            let officialName = m.meeting_official_name || m.meeting_name;
            officialName = officialName.replace(/FORMULA 1/i, '').trim().replace(/\s*\d{4}$/, '').trim();

            const flagCode = Utils.getCountryCode(m.country_name);
            const flagHtml = m.country_name ? `<img src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${flagCode}.svg" style="width: 28px; height: auto; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); flex-shrink: 0; margin-top: 4px;">` : '';
            
            return `
                <div class="race-card ${cls}" ${onclick}>
                    ${isNext ? '<div class="next-badge">Next</div>' : ''}
                    <div class="card-accent-bar"></div>
                    <div class="card-img">${imgHtml}</div>
                    <div class="card-body" style="display: flex; gap: 0.75rem; align-items: flex-start;">
                        ${flagHtml}
                        <div style="display: flex; flex-direction: column;">
                            <div class="card-round">${roundLabel}</div>
                            <div class="card-name" style="font-size: 1rem; line-height: 1.15; margin-bottom: 4px;">${officialName}</div>
                            <div class="card-date">${Utils.fmtDate(m.date_start)}</div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    };

    document.getElementById('season-grid').innerHTML = generateCards(raceMeetings, nextRace);
    
    const testGrid = document.getElementById('season-grid-testing');
    if (testGrid) {
        const nextTest = testMeetings.filter(m => new Date(m.date_end) >= NOW)[0];
        testGrid.innerHTML = generateCards(testMeetings, nextTest);
    }

    const quickSelect = document.getElementById('quick-race-select');
    if (quickSelect) {
        let options = '';
        const nextOverall = allMeetings.filter(m => new Date(m.date_end) >= NOW)[0];
        
        allMeetings.forEach((m) => {
            const isPast = new Date(m.date_end) < NOW;
            const isNext = nextOverall && m.meeting_key === nextOverall.meeting_key;
            
            if (isPast || isNext) {
                const prefix = m.is_testing ? 'TEST' : `Race ${m.race_week}`;
                options += `<option value="${m.meeting_key}">${prefix} - ${m.meeting_name}</option>`;
            }
        });
        quickSelect.innerHTML = options;
    }
};

window.loadStandings = async function() {
    const pastMeetings = allMeetings.filter(m => new Date(m.date_end) < NOW);
    if (pastMeetings.length === 0) {
        document.getElementById('standings-drivers').innerHTML = `<div class="standings-header"><span class="standings-title">Drivers</span></div><div style="padding:1rem;font-size:0.8rem;color:var(--text-dim);text-align:center">Season not started</div>`;
        document.getElementById('standings-constructors').innerHTML = `<div class="standings-header"><span class="standings-title">Constructors</span></div><div style="padding:1rem;font-size:0.8rem;color:var(--text-dim);text-align:center">Season not started</div>`;
        document.getElementById('season-summary-leaders').innerHTML = `<div style="grid-column: 1/-1; padding: 2rem; color:var(--text-dim); text-align:center;">Season not started</div>`;
        return;
    }
    try {
        const lastMeeting = pastMeetings[pastMeetings.length - 1];
        const sessions = await API.fetchJSON(`${Constants.BASE}/sessions?meeting_key=${lastMeeting.meeting_key}`);
        const raceSessions = sessions.filter(s => {
            const n = (s.session_name || '').toLowerCase();
            return n === 'race' || n === 'sprint';
        }).sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

        if (raceSessions.length === 0) return;
        const raceKey = raceSessions[0].session_key;

        const driverStandings = await API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${raceKey}`);
        await delay(350);
        const teamStandings = await API.fetchJSON(`${Constants.BASE}/championship_teams?session_key=${raceKey}`);
        await delay(350);
        const allDrivers = await API.fetchJSON(`${Constants.BASE}/drivers?session_key=${raceKey}`);

        const driverInfoMap = {};
        for (const d of allDrivers) driverInfoMap[d.driver_number] = d;

        // --- THE FIX: Inject missing mid-season drivers! ---
        Object.keys(Constants.HISTORICAL_DRIVERS).forEach(num => {
            if (!driverInfoMap[num]) driverInfoMap[num] = Constants.HISTORICAL_DRIVERS[num];
        });
        // ---------------------------------------------------

        const sortedDrivers = [...driverStandings].sort((a, b) => a.position_current - b.position_current);
        const sortedTeams = [...teamStandings].sort((a, b) => a.position_current - b.position_current);

        sortedDrivers.forEach(d => {
            championshipRanks[d.driver_number] = d.position_current;
        });

        const dPanel = document.getElementById('standings-drivers');
        dPanel.innerHTML = `
            <div class="standings-header">
                <div>
                    <span class="standings-title">Drivers</span>
                    <span style="font-size:0.65rem;color:var(--text-dim);font-family:'Barlow Condensed',sans-serif;letter-spacing:0.06em;text-transform:uppercase; display:block;">After ${lastMeeting.is_testing ? 'Testing' : 'Race ' + lastMeeting.race_week}</span>
                </div>
                <button class="mobile-close-btn" onclick="toggleMobileStandings('standings-drivers')">✕</button>
            </div>
            ${sortedDrivers.map((d, i) => {
                const info = driverInfoMap[d.driver_number] || {};
                const posClass = i === 0 ? 'sp1' : i === 1 ? 'sp2' : i === 2 ? 'sp3' : '';
                const name = info.last_name || info.name_acronym || `#${d.driver_number}`;
                return `
                    <div class="standings-row" style="cursor: pointer;" onclick="openDriverProfile(${d.driver_number})">
                        <div class="s-pos ${posClass}">${d.position_current}</div>
                        <div class="s-name" style="display:flex; align-items:center; gap:8px;">
                            <div style="width: 24px; display: flex; justify-content: center;">${Utils.getTeamLogoHtml(info.team_name, '12px')}</div>
                            <span>${name}</span>
                        </div>
                        <div class="s-pts">${d.points_current}<span class="pts-label">pts</span></div>
                    </div>`;
            }).join('')}`;

        const tPanel = document.getElementById('standings-constructors');
        tPanel.innerHTML = `
            <div class="standings-header">
                <div>
                    <span class="standings-title">Constructors</span>
                    <span style="font-size:0.65rem;color:var(--text-dim);font-family:'Barlow Condensed',sans-serif;letter-spacing:0.06em;text-transform:uppercase; display:block;">After ${lastMeeting.is_testing ? 'Testing' : 'Race ' + lastMeeting.race_week}</span>
                </div>
                <button class="mobile-close-btn" onclick="toggleMobileStandings('standings-constructors')">✕</button>
            </div>
            ${sortedTeams.map((t, i) => {
                const posClass = i === 0 ? 'sp1' : i === 1 ? 'sp2' : i === 2 ? 'sp3' : '';
                const shortName = Utils.getShortTeamName(t.team_name);
                return `
                    <div class="standings-row" style="cursor: pointer;" onclick="openTeamProfile('${t.team_name}')">
                        <div class="s-pos ${posClass}">${t.position_current}</div>
                        <div class="s-name" style="display:flex; align-items:center; gap:8px;">
                            <div style="width: 24px; display: flex; justify-content: center;">${Utils.getTeamLogoHtml(t.team_name, '12px')}</div>
                            <span>${shortName}</span>
                        </div>
                        <div class="s-pts">${t.points_current}<span class="pts-label">pts</span></div>
                    </div>`;
            }).join('')}`;

        const driverLeader = sortedDrivers[0];
        const teamLeader = sortedTeams[0];
        const summaryContainer = document.getElementById('season-summary-leaders');

        if (summaryContainer && driverLeader && teamLeader) {
            const dInfo = driverInfoMap[driverLeader.driver_number] || {};
            const dTc = Utils.teamColor(dInfo.team_name);
            const acronym = dInfo.name_acronym || '';
            const countryCode = dInfo.country_code || Constants.DRIVER_COUNTRY_FALLBACK[acronym] || '';
            const iso2 = Constants.countryToIso2[countryCode] || '';
            const nationalityHtml = iso2 ? `<img src="https://flagcdn.com/w40/${iso2}.png" style="height:14px; width:22px; object-fit:cover; border-radius:1px; border:1px solid rgba(0,0,0,0.2);" alt="${countryCode}">` : '';

            const dTile = `
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:0.75rem 1.25rem; cursor:pointer; transition: transform 0.15s, border-color 0.15s;"
                     onmouseover="this.style.borderColor='var(--border-hover)'; this.style.transform='translateY(-2px)';"
                     onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)';"
                     onclick="openDriverProfile(${driverLeader.driver_number})">
                     <div style="font-size:0.95rem; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.75rem; font-family:'Barlow Condensed', sans-serif; text-align:center;">Championship Leader</div>
                     <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
                         <div class="driver-num-badge" style="background:${dTc.bg}; color:${dTc.text}; width:auto; min-width:65px; height:36px; padding:0 10px; display:flex; align-items:center; gap:8px; border-radius:3px; justify-content: center; flex-shrink:0;">
                             ${nationalityHtml}
                             <span style="font-size:1.2rem; line-height:1; font-weight:700;">${driverLeader.driver_number}</span>
                         </div>
                         <div style="display:flex; align-items:center; gap:1.25rem; text-align:right; justify-content:flex-end; min-width:0;">
                             <div style="font-family:'Barlow Condensed', sans-serif; font-size:1.4rem; font-weight:700; text-transform:uppercase; line-height:1.1; text-align:right;">${dInfo.full_name || dInfo.last_name}</div>
                             <div style="display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0;">
                                 <div style="font-family:'Barlow Condensed', sans-serif; font-size:2.2rem; font-weight:900; line-height:1;">${driverLeader.points_current}</div>
                                 <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; font-family:'Barlow Condensed', sans-serif; margin-top:2px;">PTS</div>
                             </div>
                         </div>
                     </div>
                </div>
            `;

            let tInfo = Constants.TEAM_INFO[teamLeader.team_name];
            if (!tInfo) {
                for (const [k, v] of Object.entries(Constants.TEAM_INFO)) {
                    if (teamLeader.team_name.includes(k) || k.includes(teamLeader.team_name)) { tInfo = v; break; }
                }
            }
            const teamFullName = tInfo ? tInfo.full : teamLeader.team_name;
            const tLogoHtml = Utils.getTeamLogoHtml(teamLeader.team_name, '32px');

            const tTile = `
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:0.75rem 1.25rem; cursor:pointer; transition: transform 0.15s, border-color 0.15s;"
                     onmouseover="this.style.borderColor='var(--border-hover)'; this.style.transform='translateY(-2px)';"
                     onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)';"
                     onclick="openTeamProfile('${teamLeader.team_name}')">
                     <div style="font-size:0.95rem; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.75rem; font-family:'Barlow Condensed', sans-serif; text-align:center;">Constructors Leader</div>
                     <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
                         <div style="display:flex; flex-direction:column; align-items:flex-start; flex-shrink:0;">
                             <div style="font-family:'Barlow Condensed', sans-serif; font-size:2.2rem; font-weight:900; line-height:1;">${teamLeader.points_current}</div>
                             <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; font-family:'Barlow Condensed', sans-serif; margin-top:2px;">PTS</div>
                         </div>
                         <div style="display:flex; align-items:center; gap:1.25rem; text-align:left; justify-content:flex-end; min-width:0;">
                             <div style="font-family:'Barlow Condensed', sans-serif; font-size:1.4rem; font-weight:700; text-transform:uppercase; line-height:1.1;">${teamFullName}</div>
                             <div style="width:48px; display:flex; justify-content:center; align-items:center; flex-shrink:0;">
                                 ${tLogoHtml || `<div style="font-size:1.5rem; color:var(--text-dim);">🏎️</div>`}
                             </div>
                         </div>
                     </div>
                </div>
            `;

            summaryContainer.innerHTML = dTile + tTile;
        }
        
        const allYearSessions = await API.fetchJSON(`${Constants.BASE}/sessions?year=${currentYear}`);
        window.renderChampionshipBattle(allYearSessions, sortedDrivers, sortedTeams, driverInfoMap);

    } catch (e) {
        console.error("Standings Error:", e);
        document.getElementById('standings-drivers').innerHTML = `<div class="standings-header"><span class="standings-title">Drivers</span></div><div style="padding:1rem;font-size:0.75rem;color:var(--text-dim);text-align:center">Unavailable</div>`;
        document.getElementById('standings-constructors').innerHTML = `<div class="standings-header"><span class="standings-title">Constructors</span></div><div style="padding:1rem;font-size:0.75rem;color:var(--text-dim);text-align:center">Unavailable</div>`;
    }
};


function getEngineForTeam(apiTeamName) {
    if (!apiTeamName) return null;
    
    // --- THE FIX: HISTORICAL ENGINE OVERRIDES (2025 & Earlier) ---
    if (currentYear <= 2025) {
        const name = apiTeamName.toLowerCase();
        if (name.includes('alpine') || name.includes('renault')) return 'Renault';
        if (name.includes('aston martin') || name.includes('racing point')) return 'Mercedes';
        if (name.includes('red bull') || name.includes('alphatauri') || name === 'rb' || name.includes('racing bulls')) return 'Honda RBPT';
        if (name.includes('alfa romeo') || name.includes('sauber')) return 'Ferrari';
    }

    // 2026+ Defaults
    if (Constants.TEAM_INFO[apiTeamName]) return Constants.TEAM_INFO[apiTeamName].engine;
    for (const [k, v] of Object.entries(Constants.TEAM_INFO)) {
        if (apiTeamName.includes(k) || k.includes(apiTeamName)) return v.engine;
    }
    return null;
}

window.renderEngineTiles = function(drilldownEngine) {
    const wrapper = document.getElementById('engine-tiles-wrapper');
    if (!wrapper || !window.cachedEngineStats) return;

    const engineStats = window.cachedEngineStats;
    const engines = Object.keys(engineStats).sort((a, b) => (engineStats[b].points || 0) - (engineStats[a].points || 0));

    // --- THE FIX: YEAR-AWARE LOGO MAPPING ---
    const ENGINE_LOGO_MAP = {
      'Mercedes':    { logo: './assets/logos/Mercedes.svg',           invert: false },
      'Ferrari':     { logo: './assets/logos/Ferrari-Scuderia-Logo.png', invert: false },
      'Honda':       { logo: currentYear <= 2025 ? './assets/logos/red-bull-racing.png' : './assets/logos/aston-martin.png', invert: currentYear > 2025 },
      'Honda RBPT':  { logo: './assets/logos/red-bull-racing.png',     invert: false },
      'RBPT / Ford': { logo: './assets/logos/red-bull-racing.png',     invert: false },
      'Audi':        { logo: './assets/logos/Audi.svg',                invert: true  },
      'Renault':     { logo: './assets/logos/apline.png',              invert: true  } // Use Alpine logo for Renault
    };

    // Inject dynamic colors for the historical engines without touching constants.js
    const getEngineColor = (eng) => {
        if (eng === 'Renault') return '#E5D54D'; // Renault Yellow
        if (eng === 'Honda RBPT') return '#3671C6'; // RB Blue
        return Utils.engineColor(eng);
    };

    let html = '';

    if (!drilldownEngine) {
        html += `<div style="display:grid; grid-template-columns: repeat(${engines.length}, 1fr); gap:1rem; margin-bottom:2.5rem;">`;
        engines.forEach(eng => {
            const s = engineStats[eng];
            const color = getEngineColor(eng); // Use the new dynamic color
            const logoInfo = ENGINE_LOGO_MAP[eng];

            const logoHtml = logoInfo
              ? `<img src="${logoInfo.logo}" class="${logoInfo.invert ? 'invert-dark' : ''}" style="height:28px; width:auto; max-width:48px; object-fit:contain; display:block; margin: 0 auto 0.6rem auto;">`
              : '';

            const teamList = Array.from(s.teams);
            const onClick = teamList.length === 1 
              ? `openTeamProfile('${teamList[0].replace(/'/g, "\\'")}')`
              : `renderEngineTiles('${eng}')`;
              
            const hoverHtml = `cursor:pointer; transition: transform 0.15s, border-color 0.15s;`;
            const hoverEvents = `onmouseover="this.style.borderColor='${color}88'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='${color}22'; this.style.transform='translateY(0)';"`;

            html += `
              <div style="background:var(--surface); border:2px solid ${color}22; border-top: 3px solid ${color}; border-radius:4px; padding:1.25rem 1rem; text-align:center; ${hoverHtml}" ${hoverEvents} onclick="${onClick}">
                ${logoHtml}
                <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.2rem; font-weight:900; text-transform:uppercase; color:var(--text); margin-bottom:0.75rem; letter-spacing:0.04em; line-height:1.1; white-space:nowrap;">${eng}</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem;">
                  <div>
                    <div style="font-size:0.6rem; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:2px;">Wins</div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; line-height:1;">${s.wins}</div>
                  </div>
                  <div>
                    <div style="font-size:0.6rem; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:2px;">Podiums</div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; line-height:1;">${s.podiums}</div>
                  </div>
                  <div>
                    <div style="font-size:0.6rem; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:2px;">Pts</div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; line-height:1;">${s.points || 0}</div>
                  </div>
                </div>
              </div>`;
        });
        html += `</div>`;
    } else {
        const s = engineStats[drilldownEngine];
        const teams = Array.from(s.teams).sort((a,b) => (s.teamStats[b].points || 0) - (s.teamStats[a].points || 0));

        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.6rem 1rem; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.02); margin-bottom: 1rem; border-radius: 4px;">
            <div style="font-family:'Barlow Condensed'; font-size:0.9rem; font-weight:700; color:var(--text); text-transform:uppercase;">${drilldownEngine} Powered Teams</div>
            <button class="theme-toggle" onclick="renderEngineTiles(null)" style="padding: 0.25rem 0.75rem; font-size:0.75rem; margin-bottom: 0;">← Back to All Engines</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(${teams.length}, 1fr); gap:1rem; margin-bottom:2.5rem;">`;

        teams.forEach(teamName => {
            const ts = s.teamStats[teamName];
            const tColor = Utils.teamColor(teamName);
            const safeName = teamName.replace(/'/g, "\\'");
            const logoHtml = `<div style="height:28px; margin: 0 auto 0.6rem auto; display:flex; align-items:center; justify-content:center;">${Utils.getTeamLogoHtml(teamName, '28px')}</div>`;
            const shortName = Utils.getShortTeamName(teamName);

            const hoverHtml = `cursor:pointer; transition: transform 0.15s, border-color 0.15s;`;
            const hoverEvents = `onmouseover="this.style.borderColor='${tColor.bg}88'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='${tColor.bg}22'; this.style.transform='translateY(0)';"`;

            html += `
              <div style="background:var(--surface); border:2px solid ${tColor.bg}22; border-top: 3px solid ${tColor.bg}; border-radius:4px; padding:1.25rem 1rem; text-align:center; ${hoverHtml}" ${hoverEvents} onclick="window.openTeamProfile('${safeName}')">
                ${logoHtml}
                <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.2rem; font-weight:900; text-transform:uppercase; color:var(--text); margin-bottom:0.75rem; letter-spacing:0.04em; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${teamName}">${shortName}</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem;">
                  <div>
                    <div style="font-size:0.6rem; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:2px;">Wins</div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; line-height:1;">${ts.wins}</div>
                  </div>
                  <div>
                    <div style="font-size:0.6rem; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:2px;">Podiums</div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; line-height:1;">${ts.podiums}</div>
                  </div>
                  <div>
                    <div style="font-size:0.6rem; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:2px;">Pts</div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; line-height:1;">${ts.points || 0}</div>
                  </div>
                </div>
              </div>`;
        });
        html += `</div>`;
    }

    wrapper.innerHTML = html;
};
window.renderEngineSuppliers = async function() {
    const container = document.getElementById('season-engines-area');
    if (!container) return;

    if (engineSuppliersLoaded) return;
    engineSuppliersLoaded = false;

    container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading engine data...</div>`;

    try {
        const allYearSessions = await API.fetchJSON(`${Constants.BASE}/sessions?year=${currentYear}`);
        
        const targetSessions = allYearSessions.filter(s => {
            const n = (s.session_name || '').toLowerCase();
            return (n === 'race' || n === 'sprint') && new Date(s.date_start) < NOW;
        }).sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

        if (targetSessions.length === 0) {
            container.innerHTML = `<div style="padding:2rem; color:var(--text-dim); text-align:center;">No completed races yet.</div>`;
            return;
        }

        const latestSession = targetSessions[targetSessions.length - 1];

        const [champData, teamChampData] = await Promise.all([
            API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${latestSession.session_key}`).catch(() => []),
            API.fetchJSON(`${Constants.BASE}/championship_teams?session_key=${latestSession.session_key}`).catch(() => [])
        ]);

        const engineStats = {};

        for (const s of targetSessions) {
            const [results, sessionDrivers] = await Promise.all([
                API.fetchJSON(`${Constants.BASE}/session_result?session_key=${s.session_key}`).catch(() => []),
                API.fetchJSON(`${Constants.BASE}/drivers?session_key=${s.session_key}`).catch(() => []),
            ]);
            const driverTeamMap = {};
            sessionDrivers.forEach(d => { driverTeamMap[d.driver_number] = d.team_name; });

            results.forEach(r => {
                const teamName = driverTeamMap[r.driver_number];
                const eng = getEngineForTeam(teamName);
                if (!eng) return;
                
                if (!engineStats[eng]) engineStats[eng] = { wins: 0, podiums: 0, points: 0, teams: new Set(), teamStats: {} };
                engineStats[eng].teams.add(teamName);
                if (!engineStats[eng].teamStats[teamName]) engineStats[eng].teamStats[teamName] = { wins: 0, podiums: 0, points: 0 };

                if (r.position === 1) {
                    engineStats[eng].wins++;
                    engineStats[eng].teamStats[teamName].wins++;
                }
                if (r.position && r.position <= 3) {
                    engineStats[eng].podiums++;
                    engineStats[eng].teamStats[teamName].podiums++;
                }
            });
        }

        teamChampData.forEach(t => {
            const eng = getEngineForTeam(t.team_name);
            if (!eng) return;
            
            if (!engineStats[eng]) engineStats[eng] = { wins: 0, podiums: 0, points: 0, teams: new Set(), teamStats: {} };
            engineStats[eng].teams.add(t.team_name);
            if (!engineStats[eng].teamStats[t.team_name]) engineStats[eng].teamStats[t.team_name] = { wins: 0, podiums: 0, points: 0 };

            engineStats[eng].teamStats[t.team_name].points = t.points_current || 0;
            engineStats[eng].points = (engineStats[eng].points || 0) + (t.points_current || 0);
        });

        window.cachedEngineStats = engineStats;

        let racesHtml = `<div class="standings-title" style="margin-bottom:1rem;">Session Performance</div>`;
        racesHtml += `<div style="display:flex; flex-direction:column; gap:0.5rem;" id="engine-races-list">`;

        targetSessions.forEach((s) => {
            const m = allMeetings.find(meet => meet.meeting_key === s.meeting_key);
            if (!m) return;

            const flagUrl = m.country_name
                ? `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${Utils.getCountryCode(m.country_name)}.svg`
                : '';
            const flagHtml = flagUrl
                ? `<img src="${flagUrl}" style="width:20px; height:auto; border-radius:2px; box-shadow:0 1px 3px rgba(0,0,0,0.2); margin-right:8px; vertical-align:middle; display:inline-block;">`
                : '';
                
            let cleanName = (m.meeting_official_name || m.meeting_name).replace(/FORMULA 1/i, '').trim().replace(/\s*\d{4}$/, '').trim();
            
            const isSprint = s.session_name.toLowerCase().includes('sprint');
            const badgeHtml = isSprint ? `<span style="background:#E87D2B; color:#fff; font-size:0.6rem; padding:2px 4px; border-radius:2px; margin-left:8px; vertical-align:middle; text-transform:uppercase;">SPRINT</span>` : '';

            racesHtml += `
                <div>
                    <div class="driver-row" style="grid-template-columns: 3rem 1fr; cursor:pointer; text-align:left;"
                         onclick="toggleEngineRaceViolins(${s.session_key}, this)">
                        <div style="font-family:'Barlow Condensed',sans-serif; color:var(--text-dim); font-weight:700; font-size:0.85rem;">Race ${m.race_week}</div>
                        <div style="display:flex; flex-direction:column; justify-content:center;">
                            <div style="font-weight:700; font-family:'Barlow Condensed',sans-serif; font-size:1.1rem; text-transform:uppercase; display:flex; align-items:center;">
                                ${flagHtml}${cleanName} ${badgeHtml}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                                ${Utils.fmtDate(s.date_start)}
                            </div>
                        </div>
                    </div>
                    <div id="engine-violin-${s.session_key}" style="display:none; margin-top:0.25rem; margin-bottom:0.5rem;"></div>
                </div>`;
        });

        racesHtml += `</div>`;

        container.style.textAlign = 'left';
        container.style.padding = '0';
        container.style.color = 'var(--text)';
        
        container.innerHTML = `<div id="engine-tiles-wrapper"></div>` + racesHtml;
        window.renderEngineTiles(null);
        
        engineSuppliersLoaded = true;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="error-msg">Could not load engine data: ${e.message}</div>`;
    }
};

window.toggleEngineRaceViolins = async function(sessionKey, rowEl) {
    const panel = document.getElementById(`engine-violin-${sessionKey}`);
    if (!panel) return;

    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
        const currentScroll = window.scrollY;
        panel.style.display = 'none';
        window.scrollTo(0, currentScroll);
        return;
    }

    panel.style.display = 'block';

    if (!window.sessionEngineDataCache[sessionKey]) {
        panel.innerHTML = `<div class="loading"><div class="spinner"></div>Loading lap data...</div>`;

        try {
            const [allLaps, sessionDrivers] = await Promise.all([
                API.fetchJSON(`${Constants.BASE}/laps?session_key=${sessionKey}`).catch(() => []),
                API.fetchJSON(`${Constants.BASE}/drivers?session_key=${sessionKey}`).catch(() => []),
            ]);

            const refDriver = sessionDrivers[0]?.driver_number;
            const leaderLaps = refDriver ? allLaps.filter(l => l.driver_number === refDriver) : [];
            const scPeriods = await API.getSafetyCarPeriods(sessionKey, leaderLaps).catch(()=>[]);

            window.sessionEngineDataCache[sessionKey] = { allLaps, sessionDrivers, scPeriods };
        } catch (e) {
            console.error(e);
            panel.innerHTML = `<div class="error-msg">Could not load data: ${e.message}</div>`;
            return;
        }
    }

    window.renderEngineRaceViolins(sessionKey, null);
};

window.renderEngineRaceViolins = function(sessionKey, drilldownEngine) {
    const panel = document.getElementById(`engine-violin-${sessionKey}`);
    if (!panel) return;
    
    const data = window.sessionEngineDataCache[sessionKey];
    if (!data) return;

    const { allLaps, sessionDrivers, scPeriods } = data;
    const isSCLap = (lapNum) => scPeriods.some(p => lapNum >= Math.floor(p.startLap) && lapNum <= Math.ceil(p.endLap));

    const driverEngineMap = {};
    const driverTeamMap = {};
    sessionDrivers.forEach(d => {
        driverTeamMap[d.driver_number] = d.team_name;
        driverEngineMap[d.driver_number] = getEngineForTeam(d.team_name);
    });

    const groupLaps = {};
    const engineTeamCounts = {};

    allLaps.forEach(l => {
        if (!l.lap_duration || l.lap_duration <= 0 || l.is_pit_out_lap || l.is_pit_in_lap || isSCLap(l.lap_number)) return;

        const team = driverTeamMap[l.driver_number];
        const eng = driverEngineMap[l.driver_number];
        if (!eng || !team) return;

        if (!engineTeamCounts[eng]) engineTeamCounts[eng] = new Set();
        engineTeamCounts[eng].add(team);

        let groupKey;
        if (drilldownEngine) {
            if (eng !== drilldownEngine) return;
            groupKey = team; 
        } else {
            groupKey = eng;  
        }

        if (!groupLaps[groupKey]) groupLaps[groupKey] = { times: [] };
        groupLaps[groupKey].times.push(l.lap_duration);
    });

    function cleanTimes(times) {
        const sorted = [...times].sort((a,b) => a-b);
        const median = sorted[Math.floor(sorted.length/2)];
        return sorted.filter(t => t <= median * 1.10 && t > 0);
    }

    const groups = Object.keys(groupLaps).filter(g => groupLaps[g].times.length > 2);
    if (groups.length === 0) {
        panel.innerHTML = `<div style="padding:1rem; color:var(--text-dim);">No clean lap data available.</div>`;
        return;
    }

    const stats = {};
    let globalMin = Infinity, globalMax = -Infinity;

    groups.forEach(g => {
        const clean = cleanTimes(groupLaps[g].times);
        if (clean.length === 0) return;
        const mean = clean.reduce((a,b) => a+b,0) / clean.length;
        const sorted = [...clean];
        stats[g] = {
            times: clean,
            mean,
            median: sorted[Math.floor(sorted.length/2)],
            q1: sorted[Math.floor(sorted.length*0.25)],
            q3: sorted[Math.floor(sorted.length*0.75)],
            min: sorted[0],
            max: sorted[sorted.length-1],
        };
        globalMin = Math.min(globalMin, sorted[0]);
        globalMax = Math.max(globalMax, sorted[sorted.length-1]);
    });

    const validGroups = groups.filter(g => stats[g]).sort((a,b) => stats[a].mean - stats[b].mean);
    const bestMean = stats[validGroups[0]]?.mean || 0;

    const isLight = document.body.dataset.theme === 'light';
    const surfaceColor = isLight ? '#f8f8f6' : '#1a1a1a';
    const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    const tickColor = isLight ? '#444' : '#888';
    const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';

    const yPad = (globalMax - globalMin) * 0.1 || 1;
    const yMin = globalMin - yPad;
    const yMax = globalMax + yPad;

    const svgViewW = 1000;
    const LEFT_PAD = 80;
    const RIGHT_PAD = 20;
    const TOP_PAD = 20;
    const BOTTOM_PAD = drilldownEngine ? 80 : 100; 
    const CHART_H = 320;
    const svgHeight = CHART_H + TOP_PAD + BOTTOM_PAD;

    const availW = svgViewW - LEFT_PAD - RIGHT_PAD;
    const step = availW / validGroups.length;
    const BOX_W = Math.min(step * 0.75, 140); 

    function yPx(val) {
        return TOP_PAD + (1 - (val - yMin) / (yMax - yMin)) * CHART_H;
    }

    let svgContent = '';

    const numTicks = 6;
    for (let i = 0; i <= numTicks; i++) {
        const val = yMin + (i / numTicks) * (yMax - yMin);
        const y = yPx(val);
        svgContent += `<line x1="${LEFT_PAD}" y1="${y}" x2="${svgViewW - RIGHT_PAD}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`;
        svgContent += `<text x="${LEFT_PAD - 6}" y="${y + 4}" text-anchor="end" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="11">${Utils.fmtLapTime(val)}</text>`;
    }

    validGroups.forEach((g, i) => {
        const s = stats[g];
        const color = drilldownEngine ? Utils.teamColor(g).bg : Utils.engineColor(g);
        
        const cx = LEFT_PAD + (i * step) + (step / 2);

        const hasCustomers = !drilldownEngine && engineTeamCounts[g] && engineTeamCounts[g].size > 1;
        
        const groupProps = hasCustomers ? `cursor="pointer" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'" style="transition: opacity 0.2s;" onclick="renderEngineRaceViolins(${sessionKey}, '${g}')"` : '';

        svgContent += `<g ${groupProps}>`;

        const bw = 0.4;
        const steps = 100;
        const stepSize = (yMax - yMin) / steps;
        const densities = [];
        let maxDensity = 0;
        for (let j = 0; j <= steps; j++) {
            const v = yMin + j * stepSize;
            const d = Utils.gaussianKDE(v, s.times, bw);
            densities.push({ v, d });
            if (d > maxDensity) maxDensity = d;
        }

        let pathD = '';
        for (let j = 0; j <= steps; j++) {
            const pt = densities[j];
            const px = cx + (pt.d / maxDensity) * (BOX_W / 2);
            const py = yPx(pt.v);
            pathD += j === 0 ? `M ${px} ${py} ` : `L ${px} ${py} `;
        }
        for (let j = steps; j >= 0; j--) {
            const pt = densities[j];
            const px = cx - (pt.d / maxDensity) * (BOX_W / 2);
            const py = yPx(pt.v);
            pathD += `L ${px} ${py} `;
        }
        pathD += 'Z';
        svgContent += `<path d="${pathD}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>`;

        s.times.forEach(t => {
            const py = yPx(t);
            const jitter = (Math.random() - 0.5) * (BOX_W * 0.35);
            svgContent += `<circle cx="${cx + jitter}" cy="${py}" r="2" fill="${color}" opacity="0.6"/>`;
        });

        const iqrW = 10;
        svgContent += `<rect x="${cx - iqrW/2}" y="${yPx(s.q3)}" width="${iqrW}" height="${Math.max(1, yPx(s.q1) - yPx(s.q3))}" fill="${color}" stroke="${color}" stroke-width="1"/>`;
        svgContent += `<circle cx="${cx}" cy="${yPx(s.median)}" r="4" fill="var(--bg)" stroke="${color}" stroke-width="2"/>`;

        let badgeText = drilldownEngine ? Utils.getShortTeamName(g) : g;
        if (badgeText.length > 12) badgeText = badgeText.substring(0, 10) + '..';

        const badgeY = svgHeight - BOTTOM_PAD + 12;
        const badgeW = BOX_W;
        const badgeH = 28; 
        svgContent += `<rect x="${cx - badgeW/2}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="3" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>`;
        svgContent += `<text x="${cx}" y="${badgeY + 18}" text-anchor="middle" fill="${color}" font-family="Barlow Condensed,sans-serif" font-size="14" font-weight="800">${badgeText}</text>`;

        svgContent += `<text x="${cx}" y="${badgeY + 44}" text-anchor="middle" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="13" font-weight="700">Avg: ${Utils.fmtLapTime(s.mean)}</text>`;

        const gap = s.mean - bestMean;
        const gapText = gap < 0.001 ? 'Fastest' : `+${gap.toFixed(3)}s`;
        const gapColor = gap < 0.001 ? '#c87eff' : tickColor;
        svgContent += `<text x="${cx}" y="${badgeY + 60}" text-anchor="middle" fill="${gapColor}" font-family="Barlow Condensed,sans-serif" font-size="12" font-weight="600">${gapText}</text>`;

        if (hasCustomers) {
            svgContent += `<text x="${cx}" y="${badgeY + 80}" text-anchor="middle" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="10" font-weight="800" opacity="0.7">VIEW TEAMS ›</text>`;
        }

        svgContent += `</g>`;
    });

    let headerHtml = '';
    if (drilldownEngine) {
        headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.6rem 1rem; border-bottom: 1px solid ${borderColor}; background: rgba(0,0,0,0.02);">
            <div style="font-family:'Barlow Condensed'; font-size:0.9rem; font-weight:700; color:var(--text); text-transform:uppercase;">${drilldownEngine} Powered Teams</div>
            <button class="theme-toggle" onclick="renderEngineRaceViolins(${sessionKey}, null)" style="padding: 0.25rem 0.75rem; font-size:0.75rem; margin-bottom: 0;">← Back to All Engines</button>
        </div>
        `;
    } else {
        headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.6rem 1rem; border-bottom: 1px solid ${borderColor}; background: rgba(0,0,0,0.02);">
            <div style="font-family:'Barlow Condensed'; font-size:0.9rem; font-weight:700; color:var(--text); text-transform:uppercase;">All Engine Suppliers</div>
        </div>
        `;
    }

    panel.innerHTML = `
        <div style="background:${surfaceColor}; border:1px solid ${borderColor}; border-radius:4px; overflow:hidden; margin-bottom:0.5rem;">
            ${headerHtml}
            <div style="overflow-x:auto; overflow-y:hidden;">
                <svg viewBox="0 0 ${svgViewW} ${svgHeight}" width="100%" height="auto" style="display:block; min-height:400px; max-height:550px;">
                    ${svgContent}
                </svg>
            </div>
        </div>`;
};

window.selectMeeting = async function(key) {
    const activeView = document.querySelector('.view.active');
    const originId = activeView ? activeView.id : 'view-season';

    const prevSessionName = currentSession ? currentSession.session_name : null;
    const activeSubTab = document.querySelector('#subtabs-container .subtab-btn.active');
    const prevSubTab = activeSubTab ? activeSubTab.id.replace('subtab-btn-', '') : null;

    currentMeeting = allMeetings.find(m => m.meeting_key === key);
    currentSession = null;
    window.updateBreadcrumb();
    window.showView('view-drivers');

    const backBtn = document.querySelector('#view-drivers .back-btn');
    if (backBtn) {
        if (originId === 'view-team-profile') {
            backBtn.textContent = '← Back to Team';
            backBtn.onclick = () => {
                currentMeeting = null; 
                currentSession = null; 
                window.updateBreadcrumb(); 
                window.showView('view-team-profile');
            };
        } else if (originId === 'view-driver-detail') {
            backBtn.textContent = '← Back to Driver';
            backBtn.onclick = () => {
                if (typeof currentDriverView !== 'undefined' && currentDriverView) {
                    window.viewDriverDetails(currentDriverView);
                } else {
                    window.showView('view-driver-detail');
                }
            };
        } else {
            backBtn.textContent = '← Back to Season';
            backBtn.onclick = window.goHome;
        }
    }

    const quickSelect = document.getElementById('quick-race-select');
    if (quickSelect) quickSelect.value = key;

    const hero = document.getElementById('session-hero');
    const flagHtml = currentMeeting.country_flag
        ? `<img src="${currentMeeting.country_flag}" alt="${currentMeeting.country_name}" style="height:40px; width:60px; object-fit:cover; border-radius:2px; border:1px solid var(--border); margin-right: 1.5rem;">`
        : '';

    let cleanMeetingName = currentMeeting.meeting_official_name || currentMeeting.meeting_name;
    cleanMeetingName = cleanMeetingName.replace(/FORMULA 1/i, '').trim().replace(/\s*\d{4}$/, '').trim();

    hero.innerHTML = `
        <div style="display:flex; align-items:center;">
            ${flagHtml}
            <div>
                <div class="session-hero-name">${cleanMeetingName}</div>
                <div class="session-hero-sub">${currentMeeting.location} · ${Utils.fmtDate(currentMeeting.date_start)} – ${Utils.fmtDate(currentMeeting.date_end)}</div>
            </div>
        </div>
    `;

    const tabsContainer = document.getElementById('session-tabs-container');
    tabsContainer.innerHTML = `<div class="loading" style="padding:0; flex-direction:row;"><div class="spinner" style="width:16px; height:16px;"></div> Loading Sessions...</div>`;
    
    document.getElementById('subtabs-container').style.display = 'none';
    document.getElementById('stats-bar').innerHTML = '';
    document.getElementById('drivers-list').innerHTML = '';

    try {
        const sessions = await API.fetchJSON(`${Constants.BASE}/sessions?meeting_key=${key}`);
        const sorted = sessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
        
        let targetSession = sorted[0]; 
        const pastSessions = sorted.filter(s => new Date(s.date_start) < NOW);
        
        let matchedSession = null;
        if (prevSessionName) {
            matchedSession = sorted.find(s => s.session_name === prevSessionName);
        }

        if (matchedSession && new Date(matchedSession.date_start) < NOW) {
            targetSession = matchedSession; 
        } else if (pastSessions.length > 0) {
            targetSession = pastSessions[pastSessions.length - 1]; 
        }

        tabsContainer.innerHTML = sorted.map(s => {
            const shortName = Utils.getShortSessionName(s.session_name);
            return `<button class="session-tab-btn" id="ses-tab-${s.session_key}" onclick="selectSession(${s.session_key})">${shortName}</button>`;
        }).join('');

        if (targetSession) {
            window.selectSession(targetSession.session_key, prevSubTab);
        }
    } catch (e) {
        tabsContainer.innerHTML = `<div class="error-msg" style="margin:0; width:100%">Could not load sessions. ${e.message}</div>`;
    }
};

window.selectSession = async function(key, intendedSubTab = null) {
    const sessionData = await API.fetchJSON(`${Constants.BASE}/sessions?session_key=${key}`);
    currentSession = sessionData[0];
    window.updateBreadcrumb();
    
    document.querySelectorAll('.session-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeTab = document.getElementById(`ses-tab-${key}`);
    if (activeTab) activeTab.classList.add('active');

    document.getElementById('stats-bar').innerHTML = '';
    const list = document.getElementById('drivers-list');
    list.innerHTML = `<div class="loading"><div class="spinner"></div>Fetching results</div>`;

    const sessionNameLower = (currentSession.session_name || '').toLowerCase();
    const isRace = (sessionNameLower.includes('race') || sessionNameLower.includes('sprint')) 
                   && !sessionNameLower.includes('qualifying') 
                   && !sessionNameLower.includes('shoot');
    
    const isQuali = sessionNameLower.includes('qualifying') || sessionNameLower.includes('shoot');
    const qPrefix = sessionNameLower.includes('sprint') ? 'SQ' : 'Q';

    const subtabsContainer = document.getElementById('subtabs-container');
    let tabsHtml = `<button class="subtab-btn active" id="subtab-btn-results" onclick="switchSubTab('results')">Results</button>`;
    
    if (isRace) {
        tabsHtml += `<button class="subtab-btn" id="subtab-btn-pit-stops" onclick="switchSubTab('pit-stops')">Pit Stops</button>`;
        tabsHtml += `<button class="subtab-btn" id="subtab-btn-lap-times" onclick="switchSubTab('lap-times')">Race Pace</button>`;
        tabsHtml += `<button class="subtab-btn" id="subtab-btn-lap-chart" onclick="switchSubTab('lap-chart')">Positions Gained/Lost</button>`;
        tabsHtml += `<button class="subtab-btn" id="subtab-btn-lap-comparisons" onclick="switchSubTab('lap-comparisons')">Lap Comparisons</button>`;
    } else if (isQuali) {
        tabsHtml += `<button class="subtab-btn" id="subtab-btn-track-dominance" onclick="switchSubTab('track-dominance')">Track Dominance</button>`;
    } else {
        tabsHtml += `<button class="subtab-btn" id="subtab-btn-lap-times" onclick="switchSubTab('lap-times')">Race Pace</button>`;
        tabsHtml += `<button class="subtab-btn" id="subtab-btn-run-plans" onclick="switchSubTab('run-plans')">Run Plans</button>`;
    }
    
    subtabsContainer.innerHTML = tabsHtml;
    subtabsContainer.style.display = 'flex';
    
    let tabToActivate = 'results';
    if (intendedSubTab && tabsHtml.includes(`'${intendedSubTab}'`)) {
        tabToActivate = intendedSubTab;
    }
    
    setTimeout(() => {
        window.switchSubTab(tabToActivate); 
    }, 10);

    try {
        const drivers = await API.fetchJSON(`${Constants.BASE}/drivers?session_key=${key}`);
        await delay(350);
        const positions = await API.fetchJSON(`${Constants.BASE}/position?session_key=${key}`).catch(() => []);
        await delay(350);
        const allLaps = await API.fetchJSON(`${Constants.BASE}/laps?session_key=${key}`).catch(() => []);
        await delay(350);
        const champData = await API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${key}`).catch(() => []);
        await delay(350);
        const sessionResults = await API.fetchJSON(`${Constants.BASE}/session_result?session_key=${key}`).catch(() => []);

        const ptsGained = {};
        for (const c of champData) {
            ptsGained[c.driver_number] = (c.points_current || 0) - (c.points_start || 0);
        }

        const fastestLap = {};
        for (const lap of allLaps) {
            const dn = lap.driver_number;
            if (lap.is_pit_out_lap) continue;
            if (!lap.lap_duration || lap.lap_duration <= 0) continue;
            if (!fastestLap[dn] || lap.lap_duration < fastestLap[dn].lap_duration) {
                fastestLap[dn] = lap;
            }
        }

        const bestS1 = Math.min(...Object.values(fastestLap).map(l => l.duration_sector_1).filter(Boolean));
        const bestS2 = Math.min(...Object.values(fastestLap).map(l => l.duration_sector_2).filter(Boolean));
        const bestS3 = Math.min(...Object.values(fastestLap).map(l => l.duration_sector_3).filter(Boolean));

        const personalBestS = {};
        for (const lap of allLaps) {
            const dn = lap.driver_number;
            if (lap.is_pit_out_lap) continue;
            if (!personalBestS[dn]) personalBestS[dn] = { s1: Infinity, s2: Infinity, s3: Infinity };
            if (lap.duration_sector_1 > 0) personalBestS[dn].s1 = Math.min(personalBestS[dn].s1, lap.duration_sector_1);
            if (lap.duration_sector_2 > 0) personalBestS[dn].s2 = Math.min(personalBestS[dn].s2, lap.duration_sector_2);
            if (lap.duration_sector_3 > 0) personalBestS[dn].s3 = Math.min(personalBestS[dn].s3, lap.duration_sector_3);
        }

        function sectorClass(val, sessionBest, personalBest) {
            if (!val || val <= 0) return 's-none';
            if (val === sessionBest) return 's-purple';
            if (val === personalBest) return 's-green';
            return 's-yellow';
        }

        const latestPos = {};
        for (const p of positions) {
            const dn = p.driver_number;
            if (!latestPos[dn] || new Date(p.date) > new Date(latestPos[dn].date)) {
                latestPos[dn] = p;
            }
        }

        const driverMap = {};
        for (const d of drivers) driverMap[d.driver_number] = d;

        let ordered;
        const hasPositions = Object.keys(latestPos).length > 0;

        if (hasPositions) {
            ordered = Object.values(latestPos)
                .sort((a, b) => a.position - b.position)
                .map(p => ({ ...driverMap[p.driver_number], position: p.position }));
            const missing = drivers.filter(d => !latestPos[d.driver_number]);
            ordered = [...ordered, ...missing.map(d => ({ ...d, position: null }))];
        } else {
            ordered = drivers.map(d => ({ ...d, position: null })).sort((a, b) => {
                const rankA = championshipRanks[a.driver_number] ?? 999;
                const rankB = championshipRanks[b.driver_number] ?? 999;
                if (rankA !== rankB) return rankA - rankB;
                return a.driver_number - b.driver_number;
            });
        }

        orderedDriversList = ordered;

        const leader = ordered.find(d => d.position === 1) || ordered[0];
        let leaderMaxLap = 0;
        
        if (leader && isRace) {
            const leaderLapsArr = allLaps.filter(l => l.driver_number === leader.driver_number);
            if (leaderLapsArr.length > 0) {
                let maxLap = Math.max(...leaderLapsArr.map(l => l.lap_number || 0));
                let validMaxLap = maxLap;
                for (let i = maxLap; i > 1; i--) {
                    const thisLap = leaderLapsArr.find(l => l.lap_number === i);
                    if (!thisLap || !thisLap.lap_duration || thisLap.is_pit_in_lap) {
                        validMaxLap = i - 1;
                        continue;
                    }
                    break; 
                }
                leaderMaxLap = validMaxLap;
            }
        }

        const driverRaceStats = {};
        for (const lap of allLaps) {
            const dn = lap.driver_number;
            if (!driverRaceStats[dn]) driverRaceStats[dn] = { laps: 0, totalTime: 0 };
            if (lap.lap_duration && lap.lap_duration > 0 && (!isRace || lap.lap_number <= leaderMaxLap)) {
                driverRaceStats[dn].laps++;
                driverRaceStats[dn].totalTime += lap.lap_duration;
            }
        }

        const leaderStats = leader ? driverRaceStats[leader.driver_number] : null;
        const leaderLaps = leaderStats ? leaderStats.laps : 0;
        const leaderTime = leaderStats ? leaderStats.totalTime : 0;

        let dnfCount = 0;
        let dnsCount = 0;

        if (isRace && leaderLaps > 0) {
            ordered.forEach(d => {
                const s = driverRaceStats[d.driver_number];
                if (!s || s.laps === 0) {
                    dnsCount++;
                } else if (s.laps < leaderLaps * 0.9 && d.position !== 1) {
                    dnfCount++;
                }
            });
        }

        const hasAnyLaps = Object.keys(fastestLap).length > 0;
        const sessionBestLap = hasAnyLaps ? Math.min(...Object.values(fastestLap).map(l => l.lap_duration)) : null;
        
        let fastestDriverNumber = null;
        if (sessionBestLap) {
            const bestLapObj = Object.values(fastestLap).find(l => l.lap_duration === sessionBestLap);
            if (bestLapObj) fastestDriverNumber = bestLapObj.driver_number;
        }
        
        const dnfStatHtml = isRace ? `<div class="stat"><div class="stat-label">DNF / DNS</div><div class="stat-value">${dnfCount} / ${dnsCount}</div></div>` : '';

        const fullCircuitName = Constants.CIRCUIT_FULL_NAMES[currentMeeting.circuit_short_name] || currentMeeting.circuit_short_name;

        let officialRaceLaps = leaderMaxLap;
        if (leader && isRace) {
             const leaderLapsArr = allLaps.filter(l => l.driver_number === leader.driver_number);
             if (leaderLapsArr.length > 0) {
                     officialRaceLaps = Math.max(...leaderLapsArr.map(l => l.lap_number || 0));
             }
        }

        const lapsStatHtml = (isRace && officialRaceLaps > 0) ? `<div class="stat"><div class="stat-label">Laps</div><div class="stat-value">${officialRaceLaps}</div></div>` : '';

        document.getElementById('stats-bar').innerHTML = `
            <div class="stat"><div class="stat-label">Drivers</div><div class="stat-value">${drivers.length}</div></div>
            <div class="stat"><div class="stat-label">Circuit</div><div class="stat-value">${fullCircuitName}</div></div>
            ${lapsStatHtml}
            ${hasAnyLaps ? `<div class="stat"><div class="stat-label">Fastest Lap</div><div class="stat-value">${Utils.fmtLapTime(sessionBestLap)}</div></div>` : ''}
            ${dnfStatHtml}
        `;

        const sessionYear = new Date(currentSession.date_start).getFullYear();
        const q3Cutoff = 10; 
        const q2Cutoff = sessionYear >= 2026 ? 16 : 15; 

        let htmlOutput = '';
        let phase3 = '', phase2 = '', phase1 = '';

        ordered.forEach((d, i) => {
            const pos = d.position || (i + 1);
            const posClass = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
            const tc = Utils.teamColor(d.team_name);
            const delayCSS = `animation-delay:${(i % 10) * 30}ms`; 
            const gained = ptsGained[d.driver_number];
            const isFL = (d.driver_number === fastestDriverNumber) && isRace;
            const flBadge = isFL ? `<div style="font-family:'Barlow Condensed',sans-serif; font-size:0.65rem; font-weight:800; color:#c87eff; background:rgba(150,0,230,0.15); padding:1px 5px; border-radius:2px; margin-top:4px; text-align:center; letter-spacing:0.05em;">FL</div>` : '';

            const gainedHtml = (gained !== undefined)
                ? `<div style="display:flex; flex-direction:column; align-items:flex-end;">
                     <div class="driver-pts-gained${gained === 0 ? ' zero' : ''}">${gained > 0 ? '+' : ''}${gained}<span style="font-size:0.6rem;font-weight:400;margin-left:1px">pts</span></div>
                     ${flBadge}
                   </div>`
                : `<div style="display:flex; flex-direction:column; align-items:flex-end;">${flBadge}</div>`;

            let timingHtml = '';

            if (isRace) {
                const s = driverRaceStats[d.driver_number];
                const offResult = sessionResults ? sessionResults.find(r => r.driver_number === d.driver_number) : null;
                const offStatus = offResult ? (offResult.status || '').toUpperCase() : '';

                if (!s || s.laps === 0) {
                    timingHtml = `<div class="lap-time no-time">DNS</div><div class="sectors"></div>`;
                } else if (leaderLaps > 0 && s.laps < (leaderLaps * 0.9) && d.position !== 1) {
                    timingHtml = `<div class="lap-time no-time" style="color:var(--accent2);font-weight:700">DNF</div><div class="sectors"></div>`;
                } else if (offStatus && offStatus !== 'FINISHED' && !offStatus.includes('LAP') && offStatus !== '') {
                    timingHtml = `<div class="lap-time no-time" style="color:var(--accent2);font-weight:700">DNF</div><div class="sectors"></div>`;
                } else if (d.position === 1 || i === 0) {
                    timingHtml = `<div class="lap-time">${Utils.fmtRaceTime(s.totalTime)}</div><div class="sectors"></div>`;
                } else {
                    let gapText = '';
                    if (offResult && offResult.gap_to_leader !== null && offResult.gap_to_leader !== undefined) {
                         gapText = typeof offResult.gap_to_leader === 'number' 
                                ? '+' + offResult.gap_to_leader.toFixed(3) 
                                : offResult.gap_to_leader; 
                    } else if (s.laps >= leaderLaps) { 
                         gapText = Utils.fmtGap(s.totalTime - leaderTime); 
                    } else {
                         const lapsDown = leaderLaps - s.laps;
                         gapText = `+${lapsDown} Lap${lapsDown > 1 ? 's' : ''}`;
                    }
                    timingHtml = `<div class="lap-time" style="font-size: 1.25rem;">${gapText}</div><div class="sectors"></div>`;
                }
            } else {
                const lap = fastestLap[d.driver_number];
                const pb = personalBestS[d.driver_number] || {};
                
                let gapHtml = '';
                if (lap && sessionBestLap && lap.lap_duration > sessionBestLap) {
                    gapHtml = `<div style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600; font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.05em; margin-top: -3px;">${Utils.fmtGap(lap.lap_duration - sessionBestLap)}</div>`;
                }
                
                const lapTimeStr = lap
                    ? `<div style="display: flex; flex-direction: column; align-items: flex-end;"><div class="lap-time">${Utils.fmtLapTime(lap.lap_duration)}</div>${gapHtml}</div>`
                    : `<div class="lap-time no-time">no time</div>`;

                const s1 = lap ? lap.duration_sector_1 : null;
                const s2 = lap ? lap.duration_sector_2 : null;
                const s3 = lap ? lap.duration_sector_3 : null;

                const sc1 = sectorClass(s1, bestS1, pb.s1);
                const sc2 = sectorClass(s2, bestS2, pb.s2);
                const sc3 = sectorClass(s3, bestS3, pb.s3);

                const sectorsHtml = lap ? `
                    <div class="sectors">
                        <div class="sector ${sc1}"><span class="sector-label">S1</span>${Utils.fmtSectorTime(s1) || '—'}</div>
                        <div class="sector ${sc2}"><span class="sector-label">S2</span>${Utils.fmtSectorTime(s2) || '—'}</div>
                        <div class="sector ${sc3}"><span class="sector-label">S3</span>${Utils.fmtSectorTime(s3) || '—'}</div>
                    </div>` : `<div class="sectors"></div>`;
                    
                timingHtml = `${lapTimeStr}${sectorsHtml}`;
            }

            const rowHtml = `
             <div class="driver-row" style="grid-template-columns: 2.5rem auto 1fr auto auto auto; ${delayCSS}" onclick="previousView='view-drivers'; viewDriverDetails(${d.driver_number})">
                    <div class="driver-pos ${posClass}">${pos}</div>
                    
                    <div class="driver-num-badge" style="background:${tc.bg}; color:${tc.text}; width:68px; flex-shrink:0; display:flex; align-items:center; justify-content:center; gap:6px;">
                        ${Utils.getTeamLogoHtml(d.team_name, '12px', tc.text)}
                        <span>${d.driver_number}</span>
                    </div>
                    
                    <div class="driver-info" style="display:flex; justify-content:flex-start; align-items:center; gap: 1.5rem;">
                        <div style="min-width:0;">
                            <div class="driver-name">${d.full_name || d.last_name || 'Unknown'}</div>
                            <div class="driver-team" style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${d.team_name || '—'}
                            </div>
                        </div>
                        ${(isRace && pos <= 3) ? `<div style="display:flex; align-items:center;">${Utils.getTrophyHtml(pos, '32px', false)}</div>` : ''}
                    </div>
                    <div class="driver-timing">
                        ${timingHtml}
                    </div>
                    ${gainedHtml}
                </div>`;

            if (isQuali) {
                if (pos <= q3Cutoff) phase3 += rowHtml;
                else if (pos <= q2Cutoff) phase2 += rowHtml;
                else phase1 += rowHtml;
            } else {
                htmlOutput += rowHtml;
            }
        });

        if (isQuali) {
            htmlOutput = `
                <div class="quali-tabs">
                    <button class="quali-tab-btn active" onclick="switchQualiTab(this, 'phase3')">${qPrefix}3</button>
                    <button class="quali-tab-btn" onclick="switchQualiTab(this, 'phase2')">${qPrefix}2</button>
                    <button class="quali-tab-btn" onclick="switchQualiTab(this, 'phase1')">${qPrefix}1</button>
                    <button class="quali-tab-btn" onclick="switchQualiTab(this, 'all')">Full Grid</button>
                </div>
                <div class="quali-group active" id="group-phase3">${phase3}</div>
                <div class="quali-group" id="group-phase2">${phase2}</div>
                <div class="quali-group" id="group-phase1">${phase1}</div>
                <div class="quali-group" id="group-all">${phase3}${phase2}${phase1}</div>
            `;
        }
        
        list.innerHTML = htmlOutput;

    } catch (e) {
        list.innerHTML = `<div class="error-msg">Could not load drivers. ${e.message}</div>`;
    }
};

window.renderSessionStints = async function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const [stints, laps] = await Promise.all([
            API.getStintData(currentSession.session_key),
            API.getLapAnalysisData(currentSession.session_key)
        ]);

        const maxLaps = laps.length > 0 ? Math.max(...laps.map(l => l.lap_number || 0)) : 1;
        const lapRange = Math.max(1, maxLaps - 1);
        
        const leaderLaps = laps.filter(l => l.driver_number === orderedDriversList[0].driver_number);
        const scPeriods = await API.getSafetyCarPeriods(currentSession.session_key, leaderLaps);
        
        const isLight = document.body.dataset.theme === 'light';
        const scOverlayColor = isLight ? 'rgba(255, 204, 0, 0.45)' : 'rgba(255, 204, 0, 0.2)';
        const vscOverlayColor = isLight ? 'rgba(255, 102, 0, 0.45)' : 'rgba(255, 102, 0, 0.2)';
        
        let globalScBarsHtml = '';
        if (scPeriods.length > 0) {
            scPeriods.forEach(p => {
                    const leftPct = ((p.startLap - 1) / lapRange) * 100;
                    const widthPct = ((p.endLap - p.startLap) / lapRange) * 100;
                    const isSC = p.type === 'SC';
                    const color = isSC ? scOverlayColor : vscOverlayColor;
                    const borderCol = isSC ? '#ffcc00' : '#ff6600';
                    
                    globalScBarsHtml += `<div style="position:absolute; top:-0.5rem; bottom:-0.5rem; left:${leftPct}%; width:${widthPct}%; background:${color}; border-left: 1px solid ${borderCol}; border-right: 1px solid ${borderCol}; pointer-events:none; z-index:5;"></div>`;
            });
        }

        const driverStints = {};
        stints.forEach(s => {
            if (!driverStints[s.driver_number]) driverStints[s.driver_number] = [];
            driverStints[s.driver_number].push(s);
        });

        let html = `<div style="padding: 1.5rem 0;">`;
        
        html += `
            <div style="display: grid; grid-template-columns: 5.5rem 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                <div></div>
                <div class="standings-title" style="display:flex; justify-content:space-between;">
                    <span>Race Strategy ${scPeriods.length > 0 ? `<span style="color:#ffcc00; margin-left:10px; font-weight:900;">█ SC</span> <span style="color:#ff6600; margin-left:5px; font-weight:900;">█ VSC</span>` : ''}</span>
                    <span>Total Laps: ${maxLaps}</span>
                </div>
            </div>
        `;

        html += `<div style="position:relative;">`;
        if (scPeriods.length > 0) {
                html += `<div style="position:absolute; top:0; bottom:0; left:6.5rem; right:0; pointer-events:none; z-index:5;">${globalScBarsHtml}</div>`;
        }

        orderedDriversList.forEach(driver => {
            const dn = driver.driver_number;
            const dStints = driverStints[dn] || [];
            const tc = Utils.teamColor(driver.team_name);
            const acronym = driver.name_acronym || (driver.last_name ? driver.last_name.substring(0, 3).toUpperCase() : 'UNK');
            
            let trackHtml = '';
            if (dStints.length === 0) {
                trackHtml = `<div style="font-size:0.75rem; color:var(--text-dim); padding-left:0.5rem; display:flex; align-items:center;">No tire data</div>`;
            } else {
                dStints.forEach((stint, idx) => {
                    let startPoint = stint.lap_start - 1;
                    let endPoint = stint.lap_end - 1;
                    if (idx < dStints.length - 1) {
                            const nextStint = dStints[idx + 1];
                            endPoint = (stint.lap_end - 1 + nextStint.lap_start - 1) / 2;
                    } else {
                            endPoint = maxLaps - 1;
                    }

                    const widthPct = ((endPoint - startPoint) / lapRange) * 100;
                    const rawCompound = stint.compound ? stint.compound.toUpperCase() : 'MEDIUM';
                    const compoundClass = `tire-${rawCompound}`;
                    const tireLabel = rawCompound[0]; 
                    
                    if (widthPct > 0) {
                        trackHtml += `<div class="tire-bar ${compoundClass}" style="width: ${widthPct}%" title="${stint.compound} (${stint.lap_end - stint.lap_start} Laps)">${tireLabel}</div>`;
                    }
                });
            }

            html += `
                <div class="stint-row" style="grid-template-columns: 5.5rem 1fr; cursor:pointer; position:relative; z-index:1; transition: opacity 0.15s;" 
                     onclick="previousView='view-drivers'; viewDriverDetails(${dn}); setTimeout(() => switchDriverSubTab('tire-strategy'), 50);"
                     onmouseover="this.style.opacity='0.75'" 
                     onmouseout="this.style.opacity='1'">
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.5rem;">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); font-family:'Barlow Condensed', sans-serif;">${driver.position || '-'}</span>
                        <div class="driver-num-badge" style="background:${tc.bg}; color:${tc.text}; width:68px; flex-shrink:0; height:26px; display:flex; align-items:center; justify-content:center; gap:6px;">
                            ${Utils.getTeamLogoHtml(driver.team_name, '10px', tc.text)}
                            <span style="font-size:0.85rem; letter-spacing:0.05em;">${acronym}</span>
                        </div>
                    </div>
                    <div class="stint-track" style="position:relative;">
                        ${trackHtml}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`; 
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = `<div class="error-msg">Could not load strategy data. ${e.message}</div>`;
    }
};

window.renderPaceAnalysisTab = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div id="gap-widget-${containerId}"></div>
        <div id="violin-widget-${containerId}" style="margin-top: 2.5rem;"></div>
    `;
    
    window.renderGapToLeader(`gap-widget-${containerId}`);
    window.renderBoxWhisker(`violin-widget-${containerId}`);
};

window.renderGapToLeader = async function(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !currentSession) return;
    
    container.innerHTML = `<div class="loading"><div class="spinner"></div>Calculating Gaps...</div>`;

    try {
        const [allLaps, scPeriodsData] = await Promise.all([
            API.getLapAnalysisData(currentSession.session_key),
            API.getSafetyCarPeriods(currentSession.session_key, await API.getLapAnalysisData(currentSession.session_key, orderedDriversList[0]?.driver_number))
        ]);

        if (allLaps.length === 0) {
            container.innerHTML = `<div class="error-msg">No lap data available for gap analysis.</div>`;
            return;
        }

        const scPeriods = scPeriodsData || [];
        
        const driverCumTimes = {}; 
        orderedDriversList.forEach(d => {
            const dLaps = allLaps.filter(l => l.driver_number === d.driver_number).sort((a,b) => a.lap_number - b.lap_number);
            let cum = 0;
            const cumArr = [];
            dLaps.forEach(l => {
                if (l.lap_duration) {
                     cum += l.lap_duration;
                     cumArr[l.lap_number] = cum;
                }
            });
            driverCumTimes[d.driver_number] = cumArr;
        });

        const activeDrivers = orderedDriversList.filter(d => {
            const times = driverCumTimes[d.driver_number];
            return times && times.some(t => t !== undefined);
        });

        const maxLap = Math.max(...allLaps.map(l => l.lap_number || 0));
        const leaderCumTimes = [];
        for (let i = 1; i <= maxLap; i++) {
            let minTime = Infinity;
            activeDrivers.forEach(d => {
                const t = driverCumTimes[d.driver_number]?.[i];
                if (t !== undefined && t < minTime) minTime = t;
            });
            leaderCumTimes[i] = minTime;
        }

        const driverGaps = {};
        activeDrivers.forEach(d => {
            driverGaps[d.driver_number] = [];
            for (let i = 1; i <= maxLap; i++) {
                const t = driverCumTimes[d.driver_number]?.[i];
                const lt = leaderCumTimes[i];
                if (t !== undefined && lt !== Infinity) {
                    driverGaps[d.driver_number].push(t - lt);
                } else {
                    driverGaps[d.driver_number].push(null);
                }
            }
        });

        const isLight = document.body.dataset.theme === 'light';
        const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
        const tickColor = isLight ? '#444' : '#aaa';
        const surfaceColor = isLight ? '#f8f8f6' : '#1a1a1a';
        const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

        const renderTeamCounts = {};
        const driverHierarchy = Utils.getDriverHierarchy(activeDrivers);
        
        const gapDatasets = activeDrivers.map((d, i) => {
            const tName = d.team_name || 'Unknown';
            const isSecondDriver = driverHierarchy[d.driver_number] > 0;
            const tc = Utils.teamColor(tName);
            const isLeader = i === 0;

            return {
                label: d.name_acronym || d.last_name || `#${d.driver_number}`,
                data: driverGaps[d.driver_number],
                borderColor: tc.bg,
                backgroundColor: tc.bg,
                borderWidth: isLeader ? 4 : 2,
                borderDash: isSecondDriver ? [5, 5] : [],
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                tension: 0.2,
                spanGaps: true,
                order: isLeader ? 0 : 1,
                _driverNum: d.driver_number,
                _origColor: tc.bg,
                _origWidth: isLeader ? 4 : 2,
                _origOrder: isLeader ? 0 : 1,
                _origDash: isSecondDriver ? [5, 5] : []
            };
        });

        let gapLegendHtml = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:0.75rem; margin-top:1.5rem; margin-bottom: 2rem;">`;
        
        activeDrivers.forEach(d => {
            const tName = d.team_name || 'Unknown';
            const isSecondDriver = driverHierarchy[d.driver_number] > 0;
            const tc = Utils.teamColor(tName);
            const acronym = d.name_acronym || d.last_name || `#${d.driver_number}`;
            
            const tileBg = isSecondDriver ? 'transparent' : tc.bg;
            const tileBorder = isSecondDriver ? `2px dashed ${tc.bg}` : `2px solid ${tc.bg}`;
            const tileText = isSecondDriver ? 'var(--text)' : tc.text;
            const logoColor = isSecondDriver ? null : tc.text; 

            gapLegendHtml += `
                <div class="driver-num-badge" 
                     onmouseenter="highlightGapLine(${d.driver_number}, '${containerId}')"
                     onmouseleave="resetGapLines('${containerId}')"
                     style="background:${tileBg}; border:${tileBorder}; color:${tileText}; width:68px; flex-shrink:0; height:26px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:default; box-sizing: border-box; transition: transform 0.15s;" 
                     onmouseover="this.style.transform='translateY(-2px)';" 
                     onmouseout="this.style.transform='translateY(0)';"
                     title="${d.full_name || acronym}">
                    ${Utils.getTeamLogoHtml(tName, '10px', logoColor)}
                    <span style="font-size:0.85rem; letter-spacing:0.05em; font-weight:700;">${acronym}</span>
                </div>
            `;
        });
        gapLegendHtml += `</div>`;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <div class="standings-title">Gap to Leader</div>
                <div style="display:flex; gap:12px; font-family:'Barlow Condensed'; font-size:0.75rem; font-weight:700;">
                    <span style="color:#ffcc00; background:rgba(0,0,0,0.08); padding:2px 8px; border-radius:2px;">█ SC</span>
                    <span style="color:#ff6600; background:rgba(0,0,0,0.08); padding:2px 8px; border-radius:2px;">█ VSC</span>
                </div>
            </div>
            <div style="position:relative; background:${surfaceColor}; border:1px solid ${borderColor}; border-radius:4px; padding:1.5rem 1rem 1rem; height: 500px; width: 100%;">
                <button id="gap-reset-${containerId}" class="theme-toggle" style="display:none; position:absolute; top: 10px; right: 10px; z-index: 10; padding: 0.4rem 1rem;">Reset Zoom</button>
                <div id="gap-chart-area-${containerId}" style="width: 100%; height: 100%; position: relative; cursor: crosshair;">
                    <div id="gap-brush-${containerId}" style="position: absolute; top: 0; bottom: 0; background: rgba(255,255,255,0.15); border: 1px dashed rgba(255,255,255,0.5); pointer-events: none; display: none; z-index: 50;"></div>
                    <canvas id="canvas-gap-${containerId}"></canvas>
                </div>
            </div>
            ${gapLegendHtml}
        `;

        const ctxGap = document.getElementById(`canvas-gap-${containerId}`).getContext('2d');
        const chartLabels = Array.from({length: maxLap}, (_, i) => i + 1);

        const scOverlayPlugin = {
            id: 'scOverlay',
            beforeDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                if (!chartArea || !scPeriods.length) return;
                scPeriods.forEach(p => {
                    const xStart = scales.x.getPixelForValue(Math.ceil(p.startLap) - 1); 
                    const xEnd = scales.x.getPixelForValue(Math.floor(p.endLap) - 1);
                    ctx.save();
                    ctx.fillStyle = p.type === 'VSC' ? (isLight ? 'rgba(255, 102, 0, 0.45)' : 'rgba(255, 102, 0, 0.2)') : (isLight ? 'rgba(255, 204, 0, 0.45)' : 'rgba(255, 204, 0, 0.2)');
                    const drawStartX = Math.max(chartArea.left, xStart);
                    const drawEndX = Math.min(chartArea.right, xEnd);
                    if (drawEndX > drawStartX) {
                        ctx.fillRect(drawStartX, chartArea.top, drawEndX - drawStartX, chartArea.height);
                    }
                    ctx.restore();
                });
            }
        };

        if (window[`gapChartInst_${containerId}`]) {
            window[`gapChartInst_${containerId}`].destroy();
        }

        window.highlightGapLine = (id, cid) => {
            const chart = window[`gapChartInst_${cid}`];
            if (!chart) return;
            chart.data.datasets.forEach(ds => {
                if (ds._driverNum === id) {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, 1.0);
                    ds.borderWidth = 5;
                    ds.order = 0;
                } else {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, isLight ? 0.1 : 0.05);
                    ds.borderWidth = 1.5;
                    ds.order = 1;
                }
            });
            chart.update('none');
        };

        window.resetGapLines = (cid) => {
            const chart = window[`gapChartInst_${cid}`];
            if (!chart) return;
            chart.data.datasets.forEach(ds => {
                ds.borderColor = ds._origColor;
                ds.borderWidth = ds._origWidth;
                ds.order = ds._origOrder;
                ds.borderDash = ds._origDash || [];
            });
            chart.update('none');
        };

        window[`gapChartInst_${containerId}`] = new Chart(ctxGap, {
            type: 'line',
            data: { labels: chartLabels, datasets: gapDatasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', axis: 'xy', intersect: false },
                plugins: {
                    legend: { display: false }, 
                    tooltip: { 
                        titleFont: { family: 'Barlow Condensed', size: 14 }, 
                        bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 },
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += '+' + context.parsed.y.toFixed(3) + 's';
                                }
                                return label;
                            },
                            title: function(context) {
                                return 'Lap ' + context[0].label;
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: tickColor, font: { family: 'Barlow Condensed', weight: 600 } }, grid: { color: gridColor }, title: { display: true, text: 'Lap', color: tickColor, font: { family: 'Barlow Condensed' } } },
                    y: { 
                        reverse: true, 
                        beginAtZero: true,
                        title: { display: true, text: 'Gap (s)', color: tickColor, font: { family: 'Barlow Condensed' } }, 
                        grid: { color: gridColor }, 
                        ticks: { color: tickColor, font: { family: 'Barlow Condensed' } } 
                    }
                }
            },
            plugins: [scOverlayPlugin]
        });

        Charts.enableChartZoom(
            `gap-chart-area-${containerId}`,
            `gap-brush-${containerId}`,
            `gap-reset-${containerId}`,
            window[`gapChartInst_${containerId}`],
            2
        );

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="error-msg">Could not load gap data. ${e.message}</div>`;
    }
};

window.renderBoxWhisker = async function(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !currentSession) return;
    
    container.innerHTML = `<div class="loading"><div class="spinner"></div>Analyzing Race Pace...</div>`;

    try {
        const [allLaps, scPeriodsData] = await Promise.all([
            API.getLapAnalysisData(currentSession.session_key),
            API.getSafetyCarPeriods(currentSession.session_key, await API.getLapAnalysisData(currentSession.session_key, orderedDriversList[0]?.driver_number))
        ]);

        const scPeriods = scPeriodsData || [];
        const isSCLap = (lapNum) => scPeriods.some(p => lapNum >= Math.floor(p.startLap) && lapNum <= Math.ceil(p.endLap));

        const driverData = {};
        allLaps.forEach(l => {
            if (!l.lap_duration || l.lap_duration <= 0 || l.is_pit_out_lap || l.is_pit_in_lap || isSCLap(l.lap_number)) return;
            if (!driverData[l.driver_number]) driverData[l.driver_number] = [];
            driverData[l.driver_number].push(l.lap_duration);
        });

        const validDrivers = [];
        orderedDriversList.forEach(d => {
            const times = driverData[d.driver_number] || [];
            if (times.length > 0) {
                const sorted = [...times].sort((a,b) => a-b);
                const median = sorted[Math.floor(sorted.length / 2)];
                const cleanTimes = sorted.filter(t => t <= median * 1.10); 

                if (cleanTimes.length > 0) {
                    const mean = cleanTimes.reduce((a,b) => a+b, 0) / cleanTimes.length;
                    validDrivers.push({
                        ...d,
                        times: cleanTimes,
                        mean: mean,
                        median: median,
                        q1: cleanTimes[Math.floor(cleanTimes.length * 0.25)],
                        q3: cleanTimes[Math.floor(cleanTimes.length * 0.75)]
                    });
                }
            }
        });

        if (validDrivers.length === 0) {
            container.innerHTML = `<div class="error-msg">No clean racing laps available for pace analysis.</div>`;
            return;
        }

        validDrivers.sort((a, b) => a.mean - b.mean);
        const bestMean = validDrivers[0].mean;

        let currentDrivers = [...validDrivers];
        let isDragging = false;
        let startX = 0;

        const isLight = document.body.dataset.theme === 'light';
        const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
        const tickColor = isLight ? '#444' : '#aaa';
        const surfaceColor = isLight ? '#f8f8f6' : '#1a1a1a';
        const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

        const drawChart = () => {
            if (currentDrivers.length === 0) return;

            let minT = Infinity, maxT = -Infinity;
            currentDrivers.forEach(d => {
                minT = Math.min(minT, ...d.times);
                maxT = Math.max(maxT, ...d.times);
            });

            const yPad = (maxT - minT) * 0.1 || 1;
            minT -= yPad;
            maxT += yPad;

            const svgViewW = 1000;
            const CHART_H = 400;
            const LEFT_PAD = 80;
            const RIGHT_PAD = 40;
            const TOP_PAD = 20;
            const BOTTOM_PAD = 100;

            const svgHeight = CHART_H + TOP_PAD + BOTTOM_PAD;
            
            const availableW = svgViewW - LEFT_PAD - RIGHT_PAD;
            const step = availableW / currentDrivers.length;
            const BOX_W = Math.min(step * 0.75, 140);

            const yPx = (val) => TOP_PAD + (1 - (val - minT) / (maxT - minT)) * CHART_H;

            let svgContent = '';

            const numTicks = 8;
            for(let i=0; i<=numTicks; i++) {
                const val = minT + (i/numTicks)*(maxT - minT);
                const y = yPx(val);
                svgContent += `<line x1="${LEFT_PAD}" y1="${y}" x2="${svgViewW - RIGHT_PAD}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`;
                svgContent += `<text x="${LEFT_PAD - 8}" y="${y + 4}" text-anchor="end" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="12">${Utils.fmtLapTime(val)}</text>`;
            }

            currentDrivers.forEach((d, ci) => {
                const tc = Utils.teamColor(d.team_name);
                const cx = LEFT_PAD + (ci * step) + (step / 2); 

                const bw = 0.3;
                const steps = 100;
                const stepSize = (maxT - minT) / steps;
                const densities = [];
                let maxDensity = 0;

                for(let i=0; i<=steps; i++) {
                    const v = minT + i * stepSize;
                    const den = Utils.gaussianKDE(v, d.times, bw);
                    densities.push({ v, d: den });
                    if (den > maxDensity) maxDensity = den;
                }

                let pathD = '';
                for(let i=0; i<=steps; i++) {
                    const pt = densities[i];
                    const pxX = cx + (pt.d / maxDensity) * (BOX_W / 2);
                    const pxY = yPx(pt.v);
                    pathD += i === 0 ? `M ${pxX} ${pxY} ` : `L ${pxX} ${pxY} `;
                }
                for(let i=steps; i>=0; i--) {
                    const pt = densities[i];
                    const pxX = cx - (pt.d / maxDensity) * (BOX_W / 2);
                    const pxY = yPx(pt.v);
                    pathD += `L ${pxX} ${pxY} `;
                }
                pathD += 'Z';
                svgContent += `<path d="${pathD}" fill="${tc.bg}" fill-opacity="0.15" stroke="${tc.bg}" stroke-width="1.5" />`;

                d.times.forEach(t => {
                    const py = yPx(t);
                    const jitter = (Math.random() - 0.5) * (BOX_W * 0.35);
                    svgContent += `<circle cx="${cx + jitter}" cy="${py}" r="2.5" fill="${tc.bg}" opacity="0.85"/>`;
                });

                const iqrW = 8;
                svgContent += `<rect x="${cx - iqrW/2}" y="${yPx(d.q3)}" width="${iqrW}" height="${yPx(d.q1) - yPx(d.q3)}" fill="${tc.bg}" stroke="${tc.bg}" stroke-width="1"/>`;
                svgContent += `<circle cx="${cx}" cy="${yPx(d.median)}" r="3.5" fill="var(--bg)" stroke="${tc.bg}" stroke-width="1.5"/>`;

                const acronym = d.name_acronym || d.last_name.substring(0,3).toUpperCase();
                const badgeY = svgHeight - BOTTOM_PAD + 20;
                const badgeW = 60, badgeH = 24;

                let tInfo = Constants.TEAM_INFO[d.team_name];
                if (!tInfo) {
                    for (const [k, v] of Object.entries(Constants.TEAM_INFO)) {
                        if (d.team_name && (d.team_name.includes(k) || k.includes(d.team_name))) { tInfo = v; break; }
                    }
                }
                let svgLogoHtml = '';
                if (tInfo && tInfo.logo) {
                    const keepOriginalColor = d.team_name === 'Ferrari' || d.team_name === 'Red Bull Racing';
                    let filterCss = '';
                    if (!keepOriginalColor) {
                        filterCss = tc.text === '#fff' ? 'filter: invert(1) brightness(2);' : 'filter: brightness(0);';
                    }
                    svgLogoHtml = `<image href="${tInfo.logo}" x="${cx - badgeW/2 + 4}" y="${badgeY + 6}" height="12" width="16" preserveAspectRatio="xMidYMid meet" style="${filterCss}" pointer-events="none" />`;
                }

                svgContent += `<rect x="${cx - badgeW/2}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="3" fill="${tc.bg}" />`;
                svgContent += svgLogoHtml;
                svgContent += `<text x="${cx + 8}" y="${badgeY + 16}" text-anchor="middle" fill="${tc.text}" font-family="Barlow Condensed,sans-serif" font-size="13" font-weight="700">${acronym}</text>`;

                svgContent += `<text x="${cx}" y="${badgeY + 42}" text-anchor="middle" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="13" font-weight="700">Avg: ${Utils.fmtLapTime(d.mean)}</text>`;

                const gap = d.mean - bestMean;
                const gapText = gap === 0 ? 'Fastest' : `+${gap.toFixed(3)}s`;
                const gapColor = gap === 0 ? '#c87eff' : tickColor;
                svgContent += `<text x="${cx}" y="${badgeY + 58}" text-anchor="middle" fill="${gapColor}" font-family="Barlow Condensed,sans-serif" font-size="12" font-weight="600">${gapText}</text>`;
            });

            svgContent += `<rect id="brush-${containerId}" y="${TOP_PAD}" height="${CHART_H}" fill="rgba(255,255,255,0.2)" stroke="#fff" stroke-dasharray="4" style="display:none;" pointer-events="none" />`;

            const resetBtnHtml = currentDrivers.length !== validDrivers.length 
                ? `<button id="btn-reset-${containerId}" class="theme-toggle" style="position:absolute; top: 10px; right: 10px; z-index: 10; padding: 0.4rem 1rem;">Reset Zoom</button>`
                : '';

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div class="standings-title">Clean Racing Pace</div>
                    <div style="font-size:0.75rem; color:var(--text-dim); font-family:'Barlow Condensed', sans-serif; text-transform:uppercase; letter-spacing:0.05em;">Drag across chart to zoom into specific drivers</div>
                </div>
                <div style="position:relative; background:${surfaceColor}; border:1px solid ${borderColor}; border-radius:4px; overflow:hidden;">
                    ${resetBtnHtml}
                    <div style="width:100%;">
                        <svg id="svg-${containerId}" viewBox="0 0 ${svgViewW} ${svgHeight}" width="100%" height="auto" style="display:block; cursor:crosshair; min-height:400px; max-height:600px;">
                            ${svgContent}
                        </svg>
                    </div>
                </div>
            `;

            const svgEl = document.getElementById(`svg-${containerId}`);
            const brushEl = document.getElementById(`brush-${containerId}`);
            const resetBtn = document.getElementById(`btn-reset-${containerId}`);

            if (resetBtn) {
                resetBtn.onclick = () => {
                    currentDrivers = [...validDrivers];
                    drawChart();
                };
            }

            if (svgEl) {
                const getSVGX = (e) => {
                    const pt = svgEl.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    return pt.matrixTransform(svgEl.getScreenCTM().inverse()).x;
                };

                svgEl.onmousedown = (e) => {
                    isDragging = true;
                    startX = getSVGX(e);
                    brushEl.setAttribute('x', startX);
                    brushEl.setAttribute('width', 0);
                    brushEl.style.display = 'block';
                };

                svgEl.onmousemove = (e) => {
                    if (!isDragging) return;
                    const currentX = getSVGX(e);
                    brushEl.setAttribute('x', Math.min(startX, currentX));
                    brushEl.setAttribute('width', Math.abs(currentX - startX));
                };

                const finishDrag = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    brushEl.style.display = 'none';
                    const endX = getSVGX(e);
                    const minX = Math.min(startX, endX);
                    const maxX = Math.max(startX, endX);

                    if (maxX - minX > 30) {
                        const selected = currentDrivers.filter((_, i) => {
                            const cx = LEFT_PAD + (i * step) + (step / 2);
                            return cx >= minX && cx <= maxX;
                        });
                        if (selected.length > 0 && selected.length < currentDrivers.length) {
                            currentDrivers = selected;
                            drawChart();
                        }
                    }
                };

                svgEl.onmouseup = finishDrag;
                svgEl.onmouseleave = finishDrag;
            }
        };

        drawChart();

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="error-msg">Could not load pace data. ${e.message}</div>`;
    }
};

window.renderLapComparisons = async function(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !currentSession) return;

    container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading Lap Data...</div>`;

    try {
        const allLaps = await API.fetchJSON(`${Constants.BASE}/laps?session_key=${currentSession.session_key}`).catch(()=>[]);

        const activeDrivers = orderedDriversList.filter(d => {
            return allLaps.some(l => l.driver_number === d.driver_number && l.lap_duration > 0);
        });

        if (activeDrivers.length === 0) {
            container.innerHTML = `<div class="error-msg">No valid lap data available for comparisons.</div>`;
            return;
        }

        const driverHierarchy = Utils.getDriverHierarchy(activeDrivers);
        
        activeDrivers.forEach(d => {
            const rank = driverHierarchy[d.driver_number] || 0;
            if (rank === 0) d.lineStyle = 'solid';
            else if (rank === 1) d.lineStyle = 'dashed';
            else d.lineStyle = 'dotted';
            
            d.lineDashArray = d.lineStyle === 'solid' ? [] : (d.lineStyle === 'dashed' ? [6, 4] : [2, 2]);
        });

        const maxLap = Math.max(...allLaps.map(l => l.lap_number || 0));
        let lapOptions = '';
        for (let i = 1; i <= maxLap; i++) {
            lapOptions += `<option value="${i}">Lap ${i}</option>`;
        }

        window.lapCompState = {
            selected: [],
            lap: 1,
            chartInstSpeed: null,
            chartInstDelta: null
        };

        let tilesHtml = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:0.75rem; margin-bottom: 2rem;">`;
        activeDrivers.forEach(d => {
            const tName = d.team_name || 'Unknown';
            const tc = Utils.teamColor(tName);
            const acronym = d.name_acronym || d.last_name || `#${d.driver_number}`;
            
            tilesHtml += `
                <div class="lap-comp-tile" id="lc-tile-${d.driver_number}"
                     onclick="toggleLapCompDriver(${d.driver_number})"
                     style="background:var(--surface); border:2px solid var(--border); color:var(--text-dim); width:72px; flex-shrink:0; height:32px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; box-sizing: border-box; transition: all 0.2s; opacity: 0.5; border-radius: 4px;"
                     title="${d.full_name || acronym}">
                    ${Utils.getTeamLogoHtml(tName, '12px', null)}
                    <span style="font-size:0.9rem; letter-spacing:0.05em; font-weight:700;">${acronym}</span>
                </div>
            `;
        });
        tilesHtml += `</div>`;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                <div class="standings-title">Select Drivers to Compare (Max 3)</div>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span style="font-family:'Barlow Condensed'; font-size:0.8rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em;">Select Lap:</span>
                    <select id="lap-comp-lap-select" class="theme-toggle" style="padding:0.4rem 0.75rem;" onchange="changeLapCompLap(this.value)">
                        ${lapOptions}
                    </select>
                </div>
            </div>
            ${tilesHtml}
            <div id="lap-comp-chart-area" style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem; min-height: 200px; transition: height 0.3s;">
                <div style="text-align:center; color:var(--text-dim); padding: 3rem;">Select at least one driver above to view telemetry.</div>
            </div>
        `;

        window.toggleLapCompDriver = (dNum) => {
            let sel = window.lapCompState.selected;
            if (sel.includes(dNum)) {
                sel = sel.filter(n => n !== dNum);
            } else {
                if (sel.length >= 3) {
                    const removedId = sel.shift(); 
                    const el = document.getElementById(`lc-tile-${removedId}`);
                    if (el) {
                        el.style.opacity = '0.5';
                        el.style.background = 'var(--surface)';
                        el.style.borderColor = 'var(--border)';
                        el.style.borderStyle = 'solid';
                        el.style.color = 'var(--text-dim)';
                    }
                }
                sel.push(dNum);
            }
            window.lapCompState.selected = sel;

            document.querySelectorAll('.lap-comp-tile').forEach(el => {
                const id = parseInt(el.id.replace('lc-tile-', ''));
                const d = activeDrivers.find(x => x.driver_number === id);
                if (!d) return;
                const tc = Utils.teamColor(d.team_name);
                
                if (sel.includes(id)) {
                    el.style.opacity = '1';
                    el.style.background = `${tc.bg}22`;
                    el.style.borderStyle = d.lineStyle; 
                    el.style.borderColor = tc.bg;
                    el.style.color = 'var(--text)';
                } else {
                    el.style.opacity = '0.5';
                    el.style.background = 'var(--surface)';
                    el.style.borderStyle = 'solid';
                    el.style.borderColor = 'var(--border)';
                    el.style.color = 'var(--text-dim)';
                }
            });

            window.drawLapCompCharts();
        };

        window.changeLapCompLap = (lapNum) => {
            window.lapCompState.lap = Number(lapNum);
            window.drawLapCompCharts();
        };

        window.drawLapCompCharts = async () => {
            const chartArea = document.getElementById('lap-comp-chart-area');
            const sel = window.lapCompState.selected;
            const lapNum = window.lapCompState.lap;

            if (sel.length === 0) {
                chartArea.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding: 3rem;">Select at least one driver above to view telemetry.</div>`;
                return;
            }

            chartArea.innerHTML = `<div class="loading" style="padding: 3rem;"><div class="spinner"></div>Fetching Telemetry for Lap ${lapNum}...</div>`;

            try {
                const roundNum = currentMeeting.race_week || 1;
                const chunkIdx = Math.floor((roundNum - 1) / 5);
                const startRound = chunkIdx * 5 + 1;
                const endRound = startRound + 4;
                const telemetryFilename = `f1_telemetry_${currentYear}_${startRound}_${endRound}.json`;

                let fastF1Data = null;
                try {
                    if (!window.fastF1Cache) window.fastF1Cache = {};
                    if (!window.fastF1Cache[telemetryFilename]) {
                        const res = await fetch(telemetryFilename);
                        if (res.ok) window.fastF1Cache[telemetryFilename] = await res.json();
                        else window.fastF1Cache[telemetryFilename] = {};
                    }
                    fastF1Data = window.fastF1Cache[telemetryFilename];
                } catch (e) {
                    fastF1Data = {};
                }

                const getTelemetry = async (dNum) => {
                    const lap = allLaps.find(l => l.driver_number === dNum && l.lap_number === lapNum);
                    if (!lap || !lap.lap_duration) return null;

                    const fastKey = `R-${roundNum}-${dNum}-L${lapNum}`;
                    
                    if (fastF1Data && fastF1Data[fastKey] && fastF1Data[fastKey].time.length > 10) {
                        const fd = fastF1Data[fastKey];
                        const trace = [];
                        
                        const startTime = fd.time[0];
                        const startDist = fd.distance[0];
                        const maxDist = (fd.distance[fd.distance.length - 1] - startDist) || 1;
                        
                        for (let i = 0; i < fd.time.length; i++) {
                            const relativeDist = fd.distance[i] - startDist;
                            trace.push({
                                time: fd.time[i] - startTime,
                                speed: fd.speed[i],
                                rawDist: relativeDist, 
                                x: fd.x[i],
                                y: fd.y[i]
                            });
                        }
                        return { lap, trace, dNum, rawTotalDist: maxDist, isFastF1: true };
                    }

                    const startStr = encodeURIComponent(new Date(lap.date_start).toISOString());
                    const endStr = encodeURIComponent(new Date(new Date(lap.date_start).getTime() + lap.lap_duration * 1000).toISOString());

                    const [car, loc] = await Promise.all([
                        API.fetchJSON(`${Constants.BASE}/car_data?session_key=${currentSession.session_key}&driver_number=${dNum}&date>=${startStr}&date<=${endStr}`).catch(()=>[]),
                        API.fetchJSON(`${Constants.BASE}/location?session_key=${currentSession.session_key}&driver_number=${dNum}&date>=${startStr}&date<=${endStr}`).catch(()=>[])
                    ]);
                    return { lap, car, loc, dNum, isFastF1: false };
                };

                const validData = [];
                for (const dNum of sel) {
                    const data = await getTelemetry(dNum);
                    if (data && ((data.car && data.car.length > 10) || (data.trace && data.trace.length > 10))) {
                        validData.push(data);
                    }
                }

                if (validData.length === 0) {
                    chartArea.innerHTML = `<div class="error-msg">Telemetry unavailable for selected drivers on Lap ${lapNum}.</div>`;
                    return;
                }

                const telemetryInput = validData.map(d => ({ 
                    lap: d.lap, car: d.car, loc: d.loc, dNum: d.dNum, 
                    trace: d.trace, rawTotalDist: d.rawTotalDist, isFastF1: d.isFastF1 
                }));
                
                telemetryInput.sort((a,b) => a.lap.lap_duration - b.lap.lap_duration);

                const { chartLabels, uniformData, corners } = Telemetry.processTelemetryMath(telemetryInput);
                const bestLapDuration = uniformData[0].lap.lap_duration;
                let lapTimesHtml = `<div style="display:flex; justify-content:center; gap: 2.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">`;
                
                uniformData.forEach((ud, idx) => {
                    const dInfo = activeDrivers.find(d => d.driver_number === ud.dNum);
                    const tc = Utils.teamColor(dInfo.team_name);
                    const lapTime = ud.lap.lap_duration;
                    const isBest = lapTime === bestLapDuration;
                    const gap = lapTime - bestLapDuration;

                    const timeStr = Utils.fmtLapTime(lapTime);
                    const gapStr = isBest ? '' : `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:600; margin-left:6px;">(+${gap.toFixed(3)})</span>`;
                    const fw = isBest ? '900' : '500';

                    lapTimesHtml += `
                        <div style="display:flex; align-items:center; gap:0.5rem; font-family:'Barlow Condensed'; font-size:1.35rem; color:var(--text);">
                            <div style="width:24px; height:0px; border-top: 4px ${dInfo.lineStyle} ${tc.bg}; display:inline-block; margin-bottom:4px;"></div>
                            <span style="font-weight:700;">${dInfo.name_acronym}</span>
                            <span style="font-weight:${fw}; margin-left: 0.25rem;">${timeStr}${gapStr}</span>
                        </div>
                    `;
                });
                lapTimesHtml += `</div>`;

                const speedDatasets = [];
                const deltaDatasets = [];

                uniformData.forEach((ud, idx) => {
                    const dInfo = activeDrivers.find(d => d.driver_number === ud.dNum);
                    const tc = Utils.teamColor(dInfo.team_name);

                    speedDatasets.push({
                        label: dInfo.name_acronym,
                        data: ud.speedData,
                        borderColor: tc.bg,
                        borderWidth: idx === 0 ? 3 : 2, 
                        borderDash: dInfo.lineDashArray, 
                        pointRadius: 0,
                        tension: 0.2
                    });

                    deltaDatasets.push({
                        label: idx === 0 ? `Baseline (${dInfo.name_acronym})` : `${dInfo.name_acronym} Delta`,
                        data: ud.deltaData,
                        borderColor: tc.bg,
                        borderWidth: idx === 0 ? 3 : 2,
                        borderDash: dInfo.lineDashArray,
                        pointRadius: 0,
                        tension: 0.2
                    });
                });

                chartArea.innerHTML = `
                    ${lapTimesHtml}
                    <div id="lap-comp-wrapper" style="position:relative; width: 100%; cursor: crosshair;">
                        <button id="lap-comp-reset" class="theme-toggle" style="display:none; position:absolute; top: -10px; right: 0px; z-index: 10; padding: 0.3rem 0.8rem; border-color: var(--accent); color: var(--accent);">Reset Zoom</button>
                        <div id="lap-comp-brush" style="position: absolute; top: 0; bottom: 0; background: rgba(255,255,255,0.15); border: 1px dashed rgba(255,255,255,0.5); pointer-events: none; display: none; z-index: 50;"></div>
                        
                        <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem; padding: 0 0.5rem;">
                           <span style="font-family:'Barlow Condensed'; font-weight:700; color:var(--text-muted); font-size: 0.85rem;">SPEED (km/h)</span>
                        </div>
                        <div style="height: 300px; width: 100%; position: relative;"><canvas id="lap-comp-speed-chart"></canvas></div>
                        
                        <div style="display:flex; justify-content:space-between; margin-top: 1.5rem; margin-bottom: 0.5rem; padding: 0 0.5rem;">
                           <span style="font-family:'Barlow Condensed'; font-weight:700; color:var(--text-muted); font-size: 0.85rem;">GAP TO BASELINE (s)</span>
                        </div>
                        <div style="height: 180px; width: 100%; position: relative;"><canvas id="lap-comp-delta-chart"></canvas></div>
                    </div>
                `;

                const isLight = document.body.dataset.theme === 'light';
                const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
                const tickColor = isLight ? '#666' : '#aaa';
                const markerLineColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';

                const tooltipConfig = { titleFont: { family: 'Barlow Condensed', size: 14 }, bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 } };

                const cornerMarkerPlugin = {
                    id: 'cornerMarker',
                    beforeDraw(chart) {
                        const { ctx, chartArea } = chart;
                        if (!chartArea || !corners.length) return;
                        
                        const meta = chart.getDatasetMeta(0);
                        if (!meta || !meta.data || meta.data.length === 0) return;

                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.font = 'bold 11px "Barlow Condensed"';
                        ctx.fillStyle = tickColor;
                        ctx.strokeStyle = markerLineColor;
                        ctx.lineWidth = 1;
                        ctx.setLineDash([3, 3]);

                        corners.forEach(c => {
                            const pt = meta.data[c.index];
                            if (pt) {
                                const xPos = pt.x;
                                if (xPos >= chartArea.left && xPos <= chartArea.right) {
                                    const isSpeedChart = chart.canvas.id === 'lap-comp-speed-chart';
                                    ctx.beginPath();
                                    ctx.moveTo(xPos, chartArea.top); 
                                    ctx.lineTo(xPos, chartArea.bottom);
                                    ctx.stroke();
                                    if (isSpeedChart) {
                                        ctx.fillText(c.text, xPos, chartArea.top - 4);
                                    }
                                }
                            }
                        });
                        ctx.restore();
                    }
                };

                const ctxSpeed = document.getElementById('lap-comp-speed-chart').getContext('2d');
                if (window.lapCompState.chartInstSpeed) window.lapCompState.chartInstSpeed.destroy();
                window.lapCompState.chartInstSpeed = new Chart(ctxSpeed, {
                    type: 'line',
                    data: { labels: chartLabels, datasets: speedDatasets },
                    plugins: [cornerMarkerPlugin],
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        layout: { padding: { top: 20 } },
                        plugins: { legend: { display: false }, tooltip: tooltipConfig },
                        scales: {
                            x: { display: false, grid: { color: gridColor } },
                            y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { family: 'Barlow Condensed' } } }
                        }
                    }
                });

                const ctxDelta = document.getElementById('lap-comp-delta-chart').getContext('2d');
                if (window.lapCompState.chartInstDelta) window.lapCompState.chartInstDelta.destroy();
                window.lapCompState.chartInstDelta = new Chart(ctxDelta, {
                    type: 'line',
                    data: { labels: chartLabels, datasets: deltaDatasets },
                    plugins: [cornerMarkerPlugin],
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: { legend: { display: false }, tooltip: tooltipConfig },
                        scales: {
                            x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 15, font: { family: 'Barlow Condensed' } } },
                            y: { reverse: true, grid: { color: gridColor }, ticks: { color: tickColor, font: { family: 'Barlow Condensed' } } }
                        }
                    }
                });

                Charts.enableChartZoom(
                    'lap-comp-wrapper',
                    'lap-comp-brush',
                    'lap-comp-reset',
                    [window.lapCompState.chartInstSpeed, window.lapCompState.chartInstDelta],
                    5
                );

            } catch(e) {
                chartArea.innerHTML = `<div class="error-msg">Failed to render charts: ${e.message}</div>`;
            }
        };

    } catch(e) {
        container.innerHTML = `<div class="error-msg">Could not load Lap Comparisons: ${e.message}</div>`;
    }
};

window.renderTrackDominance = async function(prefix = 'dom', fixedDriverA = null) {
    const container = document.getElementById(prefix === 'dom' ? 'subtab-content-track-dominance' : `driver-subtab-content-lap-comparisons`);
    if (!container || !container.classList.contains('active')) return;

    document.getElementById(`${prefix}-loading`).style.display = 'flex';
    document.getElementById(`${prefix}-results`).style.opacity = '0.4';
    document.getElementById(`${prefix}-results`).style.pointerEvents = 'none';

    try {
        const selectB = document.getElementById(`${prefix}-driver-b`);
        
        const allLaps = await API.fetchJSON(`${Constants.BASE}/laps?session_key=${currentSession.session_key}`);
        
        const driverBestLaps = {};
        allLaps.forEach(l => {
            if (l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap && !l.is_pit_in_lap) {
                if (!driverBestLaps[l.driver_number] || l.lap_duration < driverBestLaps[l.driver_number].lap_duration) {
                    driverBestLaps[l.driver_number] = l;
                }
            }
        });

        if (window[`lastDomSessionKey_${prefix}`] !== currentSession.session_key || window[`lastDomFixedDriver_${prefix}`] !== fixedDriverA) {
            window[`lastDomSessionKey_${prefix}`] = currentSession.session_key;
            window[`lastDomFixedDriver_${prefix}`] = fixedDriverA;
            
            const availableDrivers = orderedDriversList.filter(d => driverBestLaps[d.driver_number]);
            availableDrivers.sort((a, b) => driverBestLaps[a.driver_number].lap_duration - driverBestLaps[b.driver_number].lap_duration);
            
            if (fixedDriverA !== null) {
                const options = availableDrivers.filter(d => d.driver_number !== fixedDriverA).map(d => `<option value="${d.driver_number}">${d.name_acronym || d.last_name}</option>`).join('');
                selectB.innerHTML = options;
                if (selectB.options.length > 0) selectB.selectedIndex = 0;
            } else {
                const options = availableDrivers.map(d => `<option value="${d.driver_number}">${d.name_acronym || d.last_name}</option>`).join('');
                const selectA = document.getElementById(`${prefix}-driver-a`);
                selectA.innerHTML = options;
                selectB.innerHTML = options;
                if (availableDrivers.length > 1) selectB.selectedIndex = 1;
            }
        }

        const dNumA = fixedDriverA !== null ? fixedDriverA : Number(document.getElementById(`${prefix}-driver-a`).value);
        const dNumB = Number(selectB.value);

        if (!dNumB || dNumA === dNumB) {
            document.getElementById(`${prefix}-loading`).style.display = 'none';
            return;
        }

        const lapA = driverBestLaps[dNumA];
        const lapB = driverBestLaps[dNumB];

        if (!lapA || !lapB) throw new Error("Missing valid lap times for one or both drivers.");

        if (fixedDriverA !== null) {
            const driverInfoA = orderedDriversList.find(d => d.driver_number === dNumA) || { name_acronym: 'UNK' };
            const nameEl = document.getElementById(`${prefix}-name-a`);
            if (nameEl) nameEl.textContent = driverInfoA.name_acronym;
        }

        const timeAEl = document.getElementById(`${prefix}-time-a`);
        const timeBEl = document.getElementById(`${prefix}-time-b`);
        
        if (timeAEl && timeBEl) {
            const isAFaster = lapA.lap_duration <= lapB.lap_duration;
            const gap = Math.abs(lapA.lap_duration - lapB.lap_duration).toFixed(3);
            
            let textA = Utils.fmtLapTime(lapA.lap_duration);
            let textB = Utils.fmtLapTime(lapB.lap_duration);
            const gapHtml = `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:600; margin-left:6px;">(+${gap})</span>`;

            if (isAFaster) {
                timeAEl.innerHTML = textA;
                timeAEl.style.fontWeight = '900';
                timeBEl.innerHTML = textB + gapHtml;
                timeBEl.style.fontWeight = '500';
            } else {
                timeAEl.innerHTML = textA + gapHtml;
                timeAEl.style.fontWeight = '500';
                timeBEl.innerHTML = textB;
                timeBEl.style.fontWeight = '900';
            }
        }

        const getTelemetry = async (lap, dNum) => {
            const start = new Date(lap.date_start);
            const end = new Date(start.getTime() + (lap.lap_duration * 1000));
            
            const startStr = encodeURIComponent(start.toISOString());
            const endStr = encodeURIComponent(end.toISOString());

            const loc = await API.fetchJSON(`${Constants.BASE}/location?session_key=${currentSession.session_key}&driver_number=${dNum}&date>=${startStr}&date<=${endStr}`).catch(()=>[]);
            const car = await API.fetchJSON(`${Constants.BASE}/car_data?session_key=${currentSession.session_key}&driver_number=${dNum}&date>=${startStr}&date<=${endStr}`).catch(()=>[]);
            return { loc, car, lap };
        };

        const [dataA, dataB] = await Promise.all([getTelemetry(lapA, dNumA), getTelemetry(lapB, dNumB)]);
        
        if (dataA.loc.length < 20 || dataB.loc.length < 20) {
            throw new Error("Telemetry is incomplete or unavailable from OpenF1 for these specific laps.");
        }
        
        const NUM_SECTORS = 20;
        const refLoc = dataA.loc;
        const chunkSize = Math.floor(refLoc.length / NUM_SECTORS);
        
        const miniSectors = [];
        let aHighSpeedWins = 0, bHighSpeedWins = 0, aLowSpeedWins = 0, bLowSpeedWins = 0;

        for (let i = 0; i < NUM_SECTORS; i++) {
            const startIdx = i * chunkSize;
            const endIdx = i === NUM_SECTORS - 1 ? refLoc.length - 1 : (i + 1) * chunkSize;
            
            const segmentA = refLoc.slice(startIdx, endIdx);
            const timeA = (new Date(segmentA[segmentA.length-1].date) - new Date(segmentA[0].date)) / 1000;
            
            const startIdxB = Math.floor((startIdx / refLoc.length) * dataB.loc.length);
            const endIdxB = Math.floor((endIdx / refLoc.length) * dataB.loc.length);
            const segmentB = dataB.loc.slice(startIdxB, endIdxB);
            let timeB = timeA; 
            if (segmentB.length > 0) {
                timeB = (new Date(segmentB[segmentB.length-1].date) - new Date(segmentB[0].date)) / 1000;
            }

            const carA = dataA.car.slice(startIdx, endIdx);
            const avgSpeed = carA.length > 0 ? carA.reduce((sum, c) => sum + c.speed, 0) / carA.length : 150;
            const isHighSpeed = avgSpeed > 180;

            const winner = timeA <= timeB ? 'A' : 'B';
            
            if (winner === 'A') isHighSpeed ? aHighSpeedWins++ : aLowSpeedWins++;
            else isHighSpeed ? bHighSpeedWins++ : bLowSpeedWins++;

            miniSectors.push({ 
                id: i + 1, timeA, timeB, winner, coords: segmentA, isHighSpeed 
            });
        }

        const canvasId = prefix === 'dom' ? 'trackMapCanvas' : `${prefix}-trackMapCanvas`;
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        
        const xCoords = refLoc.map(p => p.x);
        const yCoords = refLoc.map(p => p.y);
        const minX = Math.min(...xCoords), maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords), maxY = Math.max(...yCoords);
        
        const padding = 40;
        const availW = canvas.width - padding * 2;
        const availH = canvas.height - padding * 2;
        const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
        
        const trackW = (maxX - minX) * scale;
        const trackH = (maxY - minY) * scale;
        const offsetX = padding + (availW - trackW) / 2;
        const offsetY = padding + (availH - trackH) / 2;
        
        const getCanvasPos = (x, y) => ({
            cx: offsetX + (x - minX) * scale,
            cy: canvas.height - offsetY - (y - minY) * scale
        });

        miniSectors.forEach(sec => {
            sec.canvasPoints = sec.coords.map(p => getCanvasPos(p.x, p.y));
        });

        const driverInfoA = orderedDriversList.find(d => d.driver_number === dNumA);
        const driverInfoB = orderedDriversList.find(d => d.driver_number === dNumB);
        const colorA = Utils.teamColor(driverInfoA.team_name).bg;
        const colorB = Utils.teamColor(driverInfoB.team_name).bg;
        const isSameTeam = colorA === colorB;

        let hoveredSectorId = null;

        const drawMap = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            miniSectors.forEach(sec => {
                if (sec.canvasPoints.length < 2) return;
                
                ctx.beginPath();
                ctx.moveTo(sec.canvasPoints[0].cx, sec.canvasPoints[0].cy);
                for (let i = 1; i < sec.canvasPoints.length; i++) {
                    ctx.lineTo(sec.canvasPoints[i].cx, sec.canvasPoints[i].cy);
                }

                const isHovered = hoveredSectorId === sec.id;
                const isFaded = hoveredSectorId !== null && !isHovered;
                
                ctx.lineWidth = isHovered ? 12 : 6;
                ctx.globalAlpha = isFaded ? 0.25 : 1.0;
                
                ctx.strokeStyle = sec.winner === 'A' ? colorA : colorB;
                ctx.setLineDash([]);
                ctx.stroke();

                if (isSameTeam && sec.winner === 'B') {
                    ctx.strokeStyle = '#ffffff';
                    ctx.setLineDash([8, 8]);
                    ctx.stroke();
                }
            });
            ctx.globalAlpha = 1.0;
        };

        window[`highlightDomSector_${prefix}`] = (sectorId) => {
            if (hoveredSectorId === sectorId) return;
            hoveredSectorId = sectorId;
            drawMap();
            
            miniSectors.forEach(sec => {
                const row = document.getElementById(`${prefix}-row-${sec.id}`);
                if (row) {
                    if (sectorId === sec.id) {
                        row.style.background = 'var(--surface2)';
                        row.style.transform = 'scale(1.02)';
                    } else {
                        row.style.background = 'transparent';
                        row.style.transform = 'scale(1)';
                    }
                }
            });
        };

        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;

            let closestDist = Infinity;
            let closestId = null;

            miniSectors.forEach(sec => {
                sec.canvasPoints.forEach(pt => {
                    const dist = Math.hypot(pt.cx - mouseX, pt.cy - mouseY);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestId = sec.id;
                    }
                });
            });

            if (closestDist < 25) { 
                canvas.style.cursor = 'pointer';
                window[`highlightDomSector_${prefix}`](closestId);
            } else {
                canvas.style.cursor = 'default';
                window[`highlightDomSector_${prefix}`](null);
            }
        };

        canvas.onmouseleave = () => window[`highlightDomSector_${prefix}`](null);

        drawMap();

        document.getElementById(`${prefix}-map-legend`).innerHTML = `
            <div style="display:flex; align-items:center; gap:6px;">
                <div style="width:12px; height:4px; background:${colorA}; border-radius:2px;"></div> 
                ${Utils.getTeamLogoHtml(driverInfoA.team_name, '12px')} ${driverInfoA.name_acronym}
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <div style="width:12px; height:4px; background:${colorB}; border-radius:2px; ${isSameTeam ? 'border:1px dashed #fff' : ''}"></div> 
                ${Utils.getTeamLogoHtml(driverInfoB.team_name, '12px')} ${driverInfoB.name_acronym}
            </div>
        `;

        document.getElementById(`${prefix}-analysis`).innerHTML = `
            <div class="stat"><div class="stat-label">High-Speed Corners/Straights Won</div>
                <div class="stat-value"><span style="color:${colorA}">${driverInfoA.name_acronym}: ${aHighSpeedWins}</span> vs <span style="color:${colorB}">${driverInfoB.name_acronym}: ${bHighSpeedWins}</span></div>
            </div>
            <div class="stat"><div class="stat-label">Low/Med-Speed Corners Won</div>
                <div class="stat-value"><span style="color:${colorA}">${driverInfoA.name_acronym}: ${aLowSpeedWins}</span> vs <span style="color:${colorB}">${driverInfoB.name_acronym}: ${bLowSpeedWins}</span></div>
            </div>
        `;

        let tableHtml = `
            <div style="display:grid; grid-template-columns: 3rem 1fr 1fr; border-bottom:1px solid var(--border); padding:0.25rem 0.5rem; background:var(--surface2); font-family:'Barlow Condensed'; font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; position: sticky; top: 0; z-index: 5;">
                <div>Sector</div>
                <div style="text-align:right;">${driverInfoA.name_acronym}</div>
                <div style="text-align:right;">${driverInfoB.name_acronym}</div>
            </div>
        `;
        
        tableHtml += miniSectors.map(sec => {
            const aWin = sec.winner === 'A';
            const bWin = sec.winner === 'B';
            const weightA = aWin ? '800' : '400';
            const colorTextA = aWin ? 'var(--text)' : 'var(--text-dim)';
            const weightB = bWin ? '800' : '400';
            const colorTextB = bWin ? 'var(--text)' : 'var(--text-dim)';
            
            return `
            <div id="${prefix}-row-${sec.id}" onmouseenter="window['highlightDomSector_${prefix}'](${sec.id})" onmouseleave="window['highlightDomSector_${prefix}'](null)" 
                 style="display:grid; grid-template-columns: 3rem 1fr 1fr; border-bottom:1px solid var(--border); padding:0.2rem 0.5rem; align-items:center; font-family:'Barlow Condensed'; font-size:0.9rem; transition: background 0.15s ease; cursor: default;">
                <div style="color:var(--text-dim); font-size:0.75rem; font-weight:700;">${sec.id}</div>
                <div style="text-align:right; font-weight:${weightA}; color:${colorTextA};">${sec.timeA.toFixed(3)}</div>
                <div style="text-align:right; font-weight:${weightB}; color:${colorTextB};">${sec.timeB.toFixed(3)}</div>
            </div>`;
        }).join('');
        
        document.getElementById(`${prefix}-mini-sectors`).innerHTML = tableHtml;

        const traceBody = document.getElementById(`${prefix}-trace-body`);
        
        if (dataA.car.length === 0 || dataB.car.length === 0) {
            traceBody.innerHTML = `<div style="padding:3rem 1rem; text-align:center; color:var(--text-dim);">Detailed speed telemetry is currently unavailable from the API for these laps.</div>`;
        } else {
            traceBody.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div style="display:flex; align-items:center; gap:1.5rem; font-family:'Barlow Condensed'; font-size:13px; font-weight:700; color:var(--text-muted); text-transform: uppercase;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div style="width:32px; height:12px; background:rgba(0,0,0,0.1); border: 2px solid ${colorA}; border-radius:2px;"></div> 
                            ${driverInfoA.name_acronym}
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div style="width:32px; height:12px; background:rgba(0,0,0,0.1); border: 2px ${isSameTeam ? 'dashed' : 'solid'} ${colorB}; border-radius:2px;"></div> 
                            ${driverInfoB.name_acronym}
                        </div>
                    </div>
                    <button id="${prefix}-reset-zoom" class="theme-toggle" style="display:none; padding: 0.3rem 1rem; border-color: var(--accent); color: var(--accent);">Reset Zoom</button>
                </div>
                
                <div id="${prefix}-chart-wrapper" style="position: relative; width: 100%; cursor: crosshair;">
                    <div id="${prefix}-brush" style="position: absolute; top: 0; bottom: 0; background: rgba(255,255,255,0.15); border: 1px dashed rgba(255,255,255,0.5); pointer-events: none; display: none; z-index: 50;"></div>
                    
                    <div style="height: 250px; width: 100%; position: relative;"><canvas id="${prefix}-speed-chart"></canvas></div>
                    <div style="height: 150px; width: 100%; position: relative; margin-top: 0.5rem;"><canvas id="${prefix}-delta-chart"></canvas></div>
                </div>
            `;
            
            const telemetryInput = [
                { lap: lapA, car: dataA.car, loc: dataA.loc, dNum: dNumA },
                { lap: lapB, car: dataB.car, loc: dataB.loc, dNum: dNumB }
            ];
            
            const fasterIsB = lapB.lap_duration < lapA.lap_duration;
            if (fasterIsB) telemetryInput.reverse();

            const { chartLabels, uniformData, corners } = Telemetry.processTelemetryMath(telemetryInput);

            const isLight = document.body.dataset.theme === 'light';
            const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
            const tickColor = isLight ? '#666' : '#aaa';
            const markerLineColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';

            const cornerMarkerPlugin = {
                id: 'cornerMarker',
                beforeDraw(chart) {
                    const { ctx, chartArea } = chart;
                    if (!chartArea || !corners.length) return;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta || !meta.data || meta.data.length === 0) return;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.font = 'bold 11px "Barlow Condensed"';
                    ctx.fillStyle = tickColor;
                    ctx.strokeStyle = markerLineColor;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);

                    corners.forEach(c => {
                        const pt = meta.data[c.index];
                        if (pt) {
                            const xPos = pt.x;
                            if (xPos >= chartArea.left && xPos <= chartArea.right) {
                                const isSpeedChart = chart.canvas.id === `${prefix}-speed-chart`;
                                ctx.beginPath();
                                ctx.moveTo(xPos, chartArea.top); 
                                ctx.lineTo(xPos, chartArea.bottom);
                                ctx.stroke();
                                if (isSpeedChart) ctx.fillText(c.text, xPos, chartArea.top - 4);
                            }
                        }
                    });
                    ctx.restore();
                }
            };

            const dsAIndex = fasterIsB ? 1 : 0;
            const dsBIndex = fasterIsB ? 0 : 1;

            const dsSpeedA = { label: driverInfoA.name_acronym, data: uniformData[dsAIndex].speedData, borderColor: colorA, borderWidth: 2, pointRadius: 0, tension: 0.2 };
            const dsSpeedB = { label: driverInfoB.name_acronym, data: uniformData[dsBIndex].speedData, borderColor: colorB, borderWidth: 2, pointRadius: 0, tension: 0.2 };
            
            const dsDeltaA = { label: driverInfoA.name_acronym, data: uniformData[dsAIndex].deltaData, borderColor: colorA, borderWidth: 2, pointRadius: 0, tension: 0.2 };
            const dsDeltaB = { label: driverInfoB.name_acronym, data: uniformData[dsBIndex].deltaData, borderColor: colorB, borderWidth: 2, pointRadius: 0, tension: 0.2 };

            if (isSameTeam) {
                dsSpeedB.borderDash = [5, 5];
                dsDeltaB.borderDash = [5, 5];
            }

            const ctxSpeed = document.getElementById(`${prefix}-speed-chart`).getContext('2d');
            if (window[`${prefix}SpeedChartInstance`]) window[`${prefix}SpeedChartInstance`].destroy();
            window[`${prefix}SpeedChartInstance`] = new Chart(ctxSpeed, {
                type: 'line',
                data: { labels: chartLabels, datasets: [dsSpeedA, dsSpeedB] },
                plugins: [cornerMarkerPlugin], 
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    layout: { padding: { top: 20 } }, 
                    plugins: { legend: { display: false }, tooltip: { titleFont: { family: 'Barlow Condensed', size: 14 }, bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 } } },
                    scales: {
                        x: { display: false, grid: { color: gridColor } },
                        y: { title: { display: true, text: 'Speed (km/h)', color: tickColor, font: { family: 'Barlow Condensed' } }, grid: { color: gridColor }, ticks: { color: tickColor } }
                    }
                }
            });

            const ctxDelta = document.getElementById(`${prefix}-delta-chart`).getContext('2d');
            if (window[`${prefix}DeltaChartInstance`]) window[`${prefix}DeltaChartInstance`].destroy();
            window[`${prefix}DeltaChartInstance`] = new Chart(ctxDelta, {
                type: 'line',
                data: { labels: chartLabels, datasets: [dsDeltaA, dsDeltaB] },
                plugins: [cornerMarkerPlugin], 
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { display: false }, tooltip: { titleFont: { family: 'Barlow Condensed', size: 14 }, bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 } } },
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 15, font: { family: 'Barlow Condensed' } } },
                        y: { reverse: true, title: { display: true, text: 'Gap (s)', color: tickColor, font: { family: 'Barlow Condensed' } }, grid: { color: gridColor }, ticks: { color: tickColor } }
                    }
                }
            });

            Charts.enableChartZoom(
                `${prefix}-chart-wrapper`,
                `${prefix}-brush`,
                `${prefix}-reset-zoom`,
                [window[`${prefix}SpeedChartInstance`], window[`${prefix}DeltaChartInstance`]],
                5
            );
        }

        document.getElementById(`${prefix}-loading`).style.display = 'none';
        document.getElementById(`${prefix}-results`).style.display = 'block';
        document.getElementById(`${prefix}-results`).style.opacity = '1';
        document.getElementById(`${prefix}-results`).style.pointerEvents = 'auto';

    } catch (e) {
        document.getElementById(`${prefix}-loading`).innerHTML = `<div class="error-msg">Telemetry analysis failed: ${e.message}</div>`;
    }
};

window.toggleMiniSectors = function(prefix = 'dom') {
    const wrapper = document.getElementById(`${prefix}-mini-sectors-wrapper`);
    const btn = document.getElementById(`${prefix}-toggle-times-btn`);
    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        btn.textContent = 'Hide Sector Times';
    } else {
        wrapper.style.display = 'none';
        btn.textContent = 'Show Sector Times';
    }
};

window.toggleLapTimeChart = () => {
    const wrapper = document.getElementById('lapTimeChartWrapper');
    const track = document.getElementById('detail-stint-track');
    const scMaster = document.getElementById('sc-master-overlay');
    
    if (!wrapper) return;

    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        if (driverChartInstance) driverChartInstance.update(); 
    } else {
        wrapper.style.display = 'none';
        if (track) {
            track.style.marginLeft = '0px';
            track.style.width = '100%';
        }
        if (scMaster) {
            scMaster.style.marginLeft = '0px';
            scMaster.style.width = '100%';
        }
    }
};

window.openDriverProfile = async function(driverNumber) {
    document.querySelectorAll('.standings-panel').forEach(p => p.classList.remove('mobile-modal-active'));
    document.body.style.overflow = '';

    const activeView = document.querySelector('.view.active');
    const originId = activeView ? activeView.id : 'view-season';

    window.showView('view-driver-profile');
    window.switchProfileSubTab('results');
    
    const statsBar = document.getElementById('profile-stats-bar');

    const backBtn = document.querySelector('#view-driver-profile .back-btn');
    if (backBtn && originId !== 'view-driver-profile') {
        if (originId === 'view-team-profile') {
            backBtn.textContent = '← Back to Team';
            backBtn.onclick = () => window.showView('view-team-profile');
        } else if (originId === 'view-drivers') {
            backBtn.textContent = '← Back to Results';
            backBtn.onclick = () => window.showView('view-drivers');
        } else {
            backBtn.textContent = '← Back to Season';
            backBtn.onclick = () => window.showView('view-season');
        }
    }
    
    const resultsWrapper = document.getElementById('profile-results-list');
    if (resultsWrapper) resultsWrapper.innerHTML = `<div class="loading"><div class="spinner"></div>Loading season profile...</div>`;
    statsBar.innerHTML = '';

    try {
        const pastMeetings = allMeetings.filter(m => new Date(m.date_end) < NOW);
        if(pastMeetings.length === 0) {
            if (resultsWrapper) resultsWrapper.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-dim);">No completed races yet.</div>`;
            return;
        }
        
        const latestMeeting = pastMeetings[pastMeetings.length - 1];
        const latestSessions = await API.fetchJSON(`${Constants.BASE}/sessions?meeting_key=${latestMeeting.meeting_key}`);
        const latestSessionKey = latestSessions[latestSessions.length-1].session_key;

        // --- THE FIX: Inject Historical Fallback for missing profile data ---
        const driverInfoArr = await API.fetchJSON(`${Constants.BASE}/drivers?session_key=${latestSessionKey}&driver_number=${driverNumber}`);
        let driverObj = driverInfoArr[0];
        if (!driverObj) {
            driverObj = Constants.HISTORICAL_DRIVERS[driverNumber] || { full_name: `Driver #${driverNumber}`, team_name: 'Unknown', country_code: '' };
        }

        const tc = Utils.teamColor(driverObj.team_name);
        
        window.updateDriverHeader('profile-driver-title', driverObj);
        
        const teamLogoHtml = Utils.getTeamLogoHtml(driverObj.team_name, '14px');
        document.getElementById('profile-driver-team').innerHTML = `<div style="display:flex; align-items:center; gap:6px;">${teamLogoHtml} ${driverObj.team_name}</div>`;

        let totalPoints = 0;
        const latestChamp = await API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${latestSessionKey}&driver_number=${driverNumber}`).catch(()=>[]);
        if(latestChamp.length > 0) totalPoints = latestChamp[0].points_current;

        const allYearSessions = await API.fetchJSON(`${Constants.BASE}/sessions?year=${currentYear}`);
        
        let q3Apps = 0, h2hWin = 0, h2hLoss = 0;
        const qualiSessions = allYearSessions.filter(s => s.session_name.toLowerCase().includes('qualifying') && new Date(s.date_start) < NOW);
        
        for (const q of qualiSessions) {
             const [qResult, qDrivers] = await Promise.all([
                 API.fetchJSON(`${Constants.BASE}/session_result?session_key=${q.session_key}`).catch(()=>[]),
                 API.fetchJSON(`${Constants.BASE}/drivers?session_key=${q.session_key}`).catch(()=>[])
             ]);
             const myPosObj = qResult.find(p => p.driver_number === driverNumber);
             if (!myPosObj) continue;
             
             if (myPosObj.position && myPosObj.position <= 10) q3Apps++;
             const me = qDrivers.find(d => d.driver_number === driverNumber);
             if (me) {
                 const teammate = qDrivers.find(d => d.team_name === me.team_name && d.driver_number !== driverNumber);
                 if (teammate) {
                     const tmPosObj = qResult.find(p => p.driver_number === teammate.driver_number);
                     if (tmPosObj) {
                            const myP = myPosObj.position || 999; 
                            const tmP = tmPosObj.position || 999;
                            if (myP < tmP) h2hWin++;
                            else if (myP > tmP) h2hLoss++;
                     }
                 }
             }
        }

        const allPastSessions = allYearSessions.filter(s => new Date(s.date_start) < NOW).sort((a,b) => new Date(a.date_start) - new Date(b.date_start)); 
        let raceWins = 0, podiums = 0, dnfs = 0, dnss = 0, dsqs = 0;
        
        const raceHtmls = [];
        const qualiHtmls = [];
        const pracHtmls = [];

        const getSectorClass = (val, sessionBest, personalBest) => {
            if (!val || val <= 0) return 's-none';
            if (val === sessionBest) return 's-purple';
            if (val === personalBest) return 's-green';
            return 's-yellow';
        };

        for (const s of allPastSessions) {
            const n = (s.session_name || '').toLowerCase();
            
            const isPrac = n.includes('practice');
            const isQuali = n.includes('qualifying') || n.includes('shootout');
            const isRace = (n.includes('race') || n.includes('sprint')) && !isQuali && !isPrac;

            if (!isRace && !isQuali && !isPrac) continue;

            const [resultData, allChampDrivers, allSessionLaps] = await Promise.all([
                API.fetchJSON(`${Constants.BASE}/session_result?session_key=${s.session_key}`).catch(() => []),
                isRace ? API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${s.session_key}`).catch(() => []) : Promise.resolve([]),
                API.fetchJSON(`${Constants.BASE}/laps?session_key=${s.session_key}`).catch(() => [])
            ]);
            
            const myRaceLaps = allSessionLaps.filter(l => l.driver_number === driverNumber);
            const dResult = resultData.find(r => r.driver_number === driverNumber);

            // --- THE FIX: Skip this session completely if the driver wasn't in the car! ---
            if (!dResult && myRaceLaps.length === 0) {
                continue; 
            }
            // ------------------------------------------------------------------------------

            const meeting = allMeetings.find(m => m.meeting_key === s.meeting_key);
            const roundText = meeting ? (meeting.is_testing ? 'TEST' : `Race ${meeting.race_week}`) : '';
            const dateString = meeting ? `${Utils.fmtDate(meeting.date_start)} - ${Utils.fmtDate(meeting.date_end)}` : '';
            
            let badgeHtml = ''; 
            if (n.includes('sprint')) {
                badgeHtml = `<span style="background:#E87D2B; color:#fff; font-size:0.6rem; padding:2px 4px; border-radius:2px; margin-left:8px; vertical-align:middle; text-transform:uppercase;">${s.session_name}</span>`;
            } else if (isPrac) {
                let pColor = 'var(--text-muted)'; 
                if (n.includes('1')) pColor = '#4A90E2'; 
                else if (n.includes('2')) pColor = '#9013FE'; 
                else if (n.includes('3')) pColor = '#00A86B'; 
                
                badgeHtml = `<span style="background:${pColor}; color:#fff; font-size:0.6rem; padding:2px 4px; border-radius:2px; margin-left:8px; vertical-align:middle; text-transform:uppercase;">${s.session_name}</span>`;
            }

            const flagUrl = meeting && meeting.country_name ? `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${Utils.getCountryCode(meeting.country_name)}.svg` : '';
            const flagHtml = flagUrl ? `<img src="${flagUrl}" style="width:20px; height:auto; border-radius:2px; box-shadow:0 1px 3px rgba(0,0,0,0.2); margin-right:8px; vertical-align:middle; display:inline-block;">` : '';

            let myPos = 'DNF';
            let ptsGained = 0;
            let timingHtml = '';

            if (isRace) {
                const validLaps = myRaceLaps.filter(l => l.lap_duration && l.lap_duration > 0);
                if (validLaps.length === 0) myPos = 'DNS';
                else {
                    if (dResult) {
                        const status = (dResult.status || '').toUpperCase();
                        if (status.includes('DSQ') || status.includes('DISQUALIFIED')) myPos = 'DSQ';
                        else if (dResult.position && (status === 'FINISHED' || status.includes('LAP') || status === '')) myPos = dResult.position;
                        else myPos = 'DNF';
                    }
                }
                
                if (myPos === 'DNS') dnss++;
                else if (myPos === 'DSQ') dsqs++;
                else if (myPos === 'DNF') dnfs++;
                else if (!n.includes('sprint') && typeof myPos === 'number') {
                    if (myPos === 1) raceWins++;
                    if (myPos <= 3) podiums++;
                }

                const myChamp = allChampDrivers.find(c => c.driver_number === driverNumber);
                if (myChamp) ptsGained = (myChamp.points_current || 0) - (myChamp.points_start || 0);
            } else {
                if (dResult && dResult.position) myPos = dResult.position;
                else myPos = '-';
                
                const myLapsQP = allSessionLaps.filter(l => l.driver_number === driverNumber && l.lap_duration && !l.is_pit_out_lap);
                const myFastest = myLapsQP.sort((a,b) => a.lap_duration - b.lap_duration)[0];
                
                if (myFastest) {
                        const validLaps = allSessionLaps.filter(l => l.lap_duration && !l.is_pit_out_lap);
                        const bestS1 = Math.min(...validLaps.map(l => l.duration_sector_1).filter(Boolean));
                        const bestS2 = Math.min(...validLaps.map(l => l.duration_sector_2).filter(Boolean));
                        const bestS3 = Math.min(...validLaps.map(l => l.duration_sector_3).filter(Boolean));
                        
                        const pbS1 = Math.min(...myLapsQP.map(l => l.duration_sector_1).filter(Boolean));
                        const pbS2 = Math.min(...myLapsQP.map(l => l.duration_sector_2).filter(Boolean));
                        const pbS3 = Math.min(...myLapsQP.map(l => l.duration_sector_3).filter(Boolean));

                        const sc1 = getSectorClass(myFastest.duration_sector_1, bestS1, pbS1);
                        const sc2 = getSectorClass(myFastest.duration_sector_2, bestS2, pbS2);
                        const sc3 = getSectorClass(myFastest.duration_sector_3, bestS3, pbS3);

                        timingHtml = `
                        <div style="display:flex; align-items:center; gap: 1rem; margin-right: 1.5rem; justify-content: flex-end;">
                            <div class="lap-time" style="font-size: 1.25rem;">${Utils.fmtLapTime(myFastest.lap_duration)}</div>
                            <div class="sectors">
                                <div class="sector ${sc1}"><span class="sector-label">S1</span>${Utils.fmtSectorTime(myFastest.duration_sector_1) || '—'}</div>
                                <div class="sector ${sc2}"><span class="sector-label">S2</span>${Utils.fmtSectorTime(myFastest.duration_sector_2) || '—'}</div>
                                <div class="sector ${sc3}"><span class="sector-label">S3</span>${Utils.fmtSectorTime(myFastest.duration_sector_3) || '—'}</div>
                            </div>
                        </div>`;
                } else {
                        timingHtml = `
                        <div style="display:flex; align-items:center; margin-right: 1.5rem; justify-content: flex-end;">
                                <div class="lap-time no-time">NO TIME</div>
                        </div>`;
                }
            }

            let formattedPos = myPos;
            if (typeof myPos === 'number') {
                const j = myPos % 10, k = myPos % 100;
                if (j == 1 && k != 11) formattedPos = myPos + "st";
                else if (j == 2 && k != 12) formattedPos = myPos + "nd";
                else if (j == 3 && k != 13) formattedPos = myPos + "rd";
                else formattedPos = myPos + "th";
            }

            let hasFL = false;
            if (isRace && allSessionLaps.length > 0) {
                    const validLaps = allSessionLaps.filter(l => l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap && !l.is_pit_in_lap);
                    if (validLaps.length > 0) {
                            const bestLap = Math.min(...validLaps.map(l => l.lap_duration));
                            const myValidLaps = myRaceLaps.filter(l => l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap && !l.is_pit_in_lap);
                            if (myValidLaps.length > 0) {
                                    const myBest = Math.min(...myValidLaps.map(l => l.lap_duration));
                                    if (myBest === bestLap && bestLap > 0 && myBest < Infinity) hasFL = true;
                            }
                    }
            }
            const flBadgeHtml = hasFL ? `<div style="font-family:'Barlow Condensed',sans-serif; font-size:0.75rem; font-weight:800; color:#c87eff; background:rgba(150,0,230,0.15); padding:1px 5px; border-radius:2px; line-height:1.2;">FL</div>` : '';

            const posClass = myPos === 1 ? 'p1' : myPos === 2 ? 'p2' : myPos === 3 ? 'p3' : '';
            const meetingKeyId = meeting ? meeting.meeting_key : null;

            const rowHtml = `
                <div class="driver-row" style="grid-template-columns: 2.5rem 1fr auto;" onclick="window.openProfileSessionDetail(${driverNumber}, ${meetingKeyId}, ${s.session_key})">
                    <div style="font-family:'Barlow Condensed', sans-serif; color:var(--text-dim); font-weight:700;">${roundText}</div>
                    
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div style="font-weight:700; font-family:'Barlow Condensed', sans-serif; font-size:1.1rem; text-transform:uppercase; display:flex; align-items:center;">
                            ${flagHtml}${meeting ? meeting.meeting_name : 'Unknown'} ${badgeHtml}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                            ${dateString}
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap: 2.5rem; text-align:right;">
                        
                        ${timingHtml}

                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <span style="font-size:0.55rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px; font-family:'Barlow Condensed', sans-serif;">Finish</span>
                            <div class="driver-pos ${posClass}" style="font-size: 1.25rem; line-height: 1; position: relative;">
                                <div style="position: absolute; right: 100%; top: 50%; transform: translateY(-50%); padding-right: 6px; display: flex; align-items: center;">
                                    ${isRace ? Utils.getTrophyHtml(myPos, '18px', false) : ''}
                                </div>
                                ${formattedPos}
                            </div>
                        </div>

                        ${isRace ? `
                        <div style="min-width: 4rem; display:flex; flex-direction:column; align-items:flex-end;">
                            <span style="font-size:0.55rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px; font-family:'Barlow Condensed', sans-serif;">Points Gained</span>
                            <div style="display:flex; align-items:center; gap:6px;">
                                ${flBadgeHtml}
                                <div class="driver-pts-gained${ptsGained === 0 ? ' zero' : ''}" style="display:inline-block; font-size:0.9rem; padding: 2px 6px;">
                                    ${ptsGained > 0 ? '+' : ''}${ptsGained}
                                </div>
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            `;

            if (isRace) raceHtmls.push(rowHtml);
            else if (isQuali) qualiHtmls.push(rowHtml);
            else if (isPrac) pracHtmls.push(rowHtml);
        }

        const resList = document.getElementById('profile-results-list');
        const qualList = document.getElementById('profile-quali-list');
        const pracList = document.getElementById('profile-practice-list');

        if (resList) resList.innerHTML = raceHtmls.length > 0 ? raceHtmls.join('') : '<div style="color:var(--text-dim); padding:1rem;">No race data</div>';
        if (qualList) qualList.innerHTML = qualiHtmls.length > 0 ? qualiHtmls.join('') : '<div style="color:var(--text-dim); padding:1rem;">No qualifying data</div>';
        if (pracList) pracList.innerHTML = pracHtmls.length > 0 ? pracHtmls.join('') : '<div style="color:var(--text-dim); padding:1rem;">No practice data</div>';
        
        statsBar.innerHTML = `
            <div class="stat"><div class="stat-label">Total Points</div><div class="stat-value">${totalPoints}</div></div>
            <div class="stat"><div class="stat-label">Wins</div><div class="stat-value">${raceWins}</div></div>
            <div class="stat"><div class="stat-label">Podiums</div><div class="stat-value">${podiums}</div></div>
            <div class="stat"><div class="stat-label">Q3 Apps</div><div class="stat-value">${q3Apps}</div></div>
            <div class="stat"><div class="stat-label">Quali vs Teammate</div><div class="stat-value">${h2hWin} - ${h2hLoss}</div></div>
            ${dnfs > 0 ? `<div class="stat"><div class="stat-label" style="color: var(--accent);">DNF</div><div class="stat-value">${dnfs}</div></div>` : ''}
            ${dnss > 0 ? `<div class="stat"><div class="stat-label" style="color: var(--text-muted);">DNS</div><div class="stat-value">${dnss}</div></div>` : ''}
            ${dsqs > 0 ? `<div class="stat"><div class="stat-label" style="color: var(--accent);">DSQ</div><div class="stat-value">${dsqs}</div></div>` : ''}
        `;
    // --- ADD THIS LINE ---
        window.renderProfileChampionship(driverNumber, 'driver');

    } catch (e) {
        if (resultsWrapper) resultsWrapper.innerHTML = `<div class="error-msg">Could not load profile. ${e.message}</div>`;
    }
};

window.renderChampionshipBattle = async function(allYearSessions, sortedDrivers, sortedTeams, driverInfoMap) {
    const champArea = document.getElementById('season-championship-battle-area');
    if (!champArea) return;

    // Include Sprint Races as independent plot points!
    const pointsSessions = allYearSessions.filter(s => {
        const n = (s.session_name || '').toLowerCase();
        return (n === 'race' || n === 'sprint') && !n.includes('qualifying') && !n.includes('shoot');
    });
    const pastRaces = pointsSessions.filter(s => new Date(s.date_start) < NOW).sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    if (pastRaces.length === 0) {
        champArea.innerHTML = `<div style="padding:2rem 1rem; text-align:center; color:var(--text-dim);">Not enough data for championship battle yet.</div>`;
        return;
    }

    champArea.innerHTML = `<div class="loading"><div class="spinner"></div>Analyzing Championship Battle...</div>`;

    try {
        const [dTimelines, tTimelines] = await Promise.all([
            Promise.all(pastRaces.map(r => API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${r.session_key}`).catch(()=>[]))),
            Promise.all(pastRaces.map(r => API.fetchJSON(`${Constants.BASE}/championship_teams?session_key=${r.session_key}`).catch(()=>[])))
        ]);

        const labels = pastRaces.map((r, i) => {
            const meeting = allMeetings.find(m => m.meeting_key === r.meeting_key);
            const isSprint = (r.session_name || '').toLowerCase().includes('sprint');
            const mName = meeting ? meeting.circuit_short_name : `R${i+1}`;
            return isSprint ? `${mName} (Sprint)` : mName;
        });

        // Initialize Data Arrays
        const driverPos = {};
        const driverAreaData = {};
        const driverRawPts = {};
        sortedDrivers.forEach(d => {
            driverPos[d.driver_number] = [];
            driverAreaData[d.driver_number] = Array(pastRaces.length).fill(null);
            driverRawPts[d.driver_number] = Array(pastRaces.length).fill(null);
        });

        const teamPos = {};
        const teamAreaData = {};
        const teamRawPts = {};
        sortedTeams.forEach(t => {
            teamPos[t.team_name] = [];
            teamAreaData[t.team_name] = Array(pastRaces.length).fill(null);
            teamRawPts[t.team_name] = Array(pastRaces.length).fill(null);
        });

        pastRaces.forEach((r, i) => {
            const dData = dTimelines[i] || [];
            
            // 1. Calculate Grid Total Points
            const totalDPts = sortedDrivers.reduce((sum, driver) => {
                const dObj = dData.find(x => String(x.driver_number) === String(driver.driver_number));
                return sum + (dObj ? (dObj.points_current || 0) : 0);
            }, 0) || 1;

            // 2. Map Driver Area Data (Raw Percentages)
            sortedDrivers.forEach(driver => {
                const dObj = dData.find(x => String(x.driver_number) === String(driver.driver_number));
                const pts = dObj ? (dObj.points_current || 0) : 0;
                
                driverPos[driver.driver_number].push(dObj ? dObj.position_current : null);
                driverRawPts[driver.driver_number][i] = { pts, total: totalDPts };
                driverAreaData[driver.driver_number][i] = (pts / totalDPts) * 100;
            });

            // 3. Mathematically Sum Team Points
            let weekTeamPts = {};
            let totalTPts = 0;

            sortedTeams.forEach(team => {
                let tPts = 0;
                const teamDrivers = sortedDrivers.filter(d => {
                    const info = driverInfoMap[d.driver_number] || {};
                    return String(info.team_name).toLowerCase() === String(team.team_name).toLowerCase();
                });

                teamDrivers.forEach(d => {
                    const dObj = dData.find(x => String(x.driver_number) === String(d.driver_number));
                    if (dObj) tPts += (dObj.points_current || 0);
                });

                weekTeamPts[team.team_name] = tPts;
                totalTPts += tPts;
            });

            totalTPts = totalTPts || 1;

            // 4. Map Team Area Data (Raw Percentages)
            const weekTeams = sortedTeams.map(team => ({
                team_name: team.team_name,
                pts: weekTeamPts[team.team_name] || 0
            })).sort((a, b) => b.pts - a.pts);

            weekTeams.forEach((t, idx) => t.rank = idx + 1);

            sortedTeams.forEach(team => {
                const pts = weekTeamPts[team.team_name] || 0;
                const rankObj = weekTeams.find(x => x.team_name === team.team_name);
                const rank = rankObj ? rankObj.rank : null;

                teamPos[team.team_name].push(rank);
                teamRawPts[team.team_name][i] = { pts, total: totalTPts };
                teamAreaData[team.team_name][i] = (pts / totalTPts) * 100;
            });
        });

        // Clinch Math
        const futureMeetings = allMeetings.filter(m => !m.is_testing && new Date(m.date_end) >= NOW);
        const getMeetingMax = (m) => {
            const hasSprint = allYearSessions.some(s => s.meeting_key === m.meeting_key && s.session_name.toLowerCase().includes('sprint') && !s.session_name.toLowerCase().includes('qualifying') && !s.session_name.toLowerCase().includes('shoot'));
            return { d: hasSprint ? 34 : 26, t: hasSprint ? 59 : 44 }; 
        };

        const driverLeader = sortedDrivers[0];
        const driver2nd = sortedDrivers.length > 1 ? sortedDrivers[1] : null;
        let dGap = driverLeader && driver2nd ? driverLeader.points_current - driver2nd.points_current : 0;
        let dClinchRound = "Not Possible Yet";

        if (driverLeader && driver2nd) {
            const dRemaining = futureMeetings.map(m => getMeetingMax(m).d);
            let currentSimGap = dGap;
            for (let i = 0; i < dRemaining.length; i++) {
                currentSimGap += dRemaining[i]; 
                const left = dRemaining.slice(i+1).reduce((a,b)=>a+b, 0); 
                if (currentSimGap > left) {
                    dClinchRound = `Race ${futureMeetings[i].race_week} (${allMeetings.find(m => m.meeting_key === futureMeetings[i].meeting_key)?.circuit_short_name})`;
                    break;
                }
            }
        }

        const teamLeader = sortedTeams[0];
        const team2nd = sortedTeams.length > 1 ? sortedTeams[1] : null;
        let tGap = teamLeader && team2nd ? teamLeader.points_current - team2nd.points_current : 0;
        let tClinchRound = "Not Possible Yet";

        if (teamLeader && team2nd) {
            const tRemaining = futureMeetings.map(m => getMeetingMax(m).t);
            let currentSimGap = tGap;
            for (let i = 0; i < tRemaining.length; i++) {
                currentSimGap += tRemaining[i];
                const left = tRemaining.slice(i+1).reduce((a,b)=>a+b, 0);
                if (currentSimGap > left) {
                    tClinchRound = `Race ${futureMeetings[i].race_week} (${allMeetings.find(m => m.meeting_key === futureMeetings[i].meeting_key)?.circuit_short_name})`;
                    break;
                }
            }
        }

        const isLight = document.body.dataset.theme === 'light';
        const gridColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
        const tickColor = isLight ? '#222' : '#aaa';
        const safeId = str => str.replace(/[^a-zA-Z0-9]/g, '_');

        const driverHierarchy = Utils.getDriverHierarchy(driverInfoMap);

        // Rank Chart Datasets (Spaghetti)
        const dDatasets = sortedDrivers.map((d) => {
            const info = driverInfoMap[d.driver_number] || {};
            const tc = Utils.teamColor(info.team_name);
            return {
                label: info.name_acronym || info.last_name || `#${d.driver_number}`,
                driverNumber: d.driver_number,
                data: driverPos[d.driver_number],
                borderColor: Utils.convertHexToRGBA(tc.bg, isLight ? 0.6 : 0.8),
                borderWidth: 2,
                pointRadius: 0,           
                pointHoverRadius: 6,
                fill: false,
                tension: 0.3,
                spanGaps: true,
                order: 1,
                _origColor: tc.bg,
                _origWidth: 2,
                _origOrder: 1
            };
        });

        const tDatasets = sortedTeams.map((t) => {
            const tc = Utils.teamColor(t.team_name);
            return {
                label: t.team_name,
                teamName: t.team_name,
                data: teamPos[t.team_name],
                borderColor: Utils.convertHexToRGBA(tc.bg, isLight ? 0.6 : 0.8),
                borderWidth: 2,
                pointRadius: 0,           
                pointHoverRadius: 6,
                fill: false,
                tension: 0.3,
                spanGaps: true,
                order: 1,
                _origColor: tc.bg,
                _origWidth: 2,
                _origOrder: 1
            };
        });

        // Stacked AREA Chart Datasets
        const dAreaDatasets = sortedDrivers.map((d) => {
            const info = driverInfoMap[d.driver_number] || {};
            const tc = Utils.teamColor(info.team_name);
            const isSecondary = driverHierarchy[d.driver_number] > 0;
            const bgColor = isSecondary ? Utils.getStripePattern(tc.bg, isLight) : Utils.convertHexToRGBA(tc.bg, 0.85);

            return {
                label: info.name_acronym || info.last_name || `#${d.driver_number}`,
                data: driverAreaData[d.driver_number],
                _rawPts: driverRawPts[d.driver_number],
                backgroundColor: bgColor,
                borderColor: isLight ? '#ffffff' : '#1a1a1a', 
                borderWidth: 1,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.3, // Slight curve for the area flow
                order: 1
            };
        });

        const tAreaDatasets = sortedTeams.map((t) => {
            const tc = Utils.teamColor(t.team_name);
            return {
                label: t.team_name,
                data: teamAreaData[t.team_name],
                _rawPts: teamRawPts[t.team_name],
                backgroundColor: Utils.convertHexToRGBA(tc.bg, 0.85),
                borderColor: isLight ? '#ffffff' : '#1a1a1a',
                borderWidth: 1,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.3,
                order: 1
            };
        });

        // Generate legends
        let dLegendHtml = sortedDrivers.map((d) => {
            const info = driverInfoMap[d.driver_number] || {};
            const tc = Utils.teamColor(info.team_name);
            const acronym = info.name_acronym || (info.last_name ? info.last_name.substring(0,3).toUpperCase() : '???');
            return `<div id="leg-champ-d-${d.driver_number}" 
                 onclick="window.openDriverProfile(${d.driver_number}); setTimeout(() => window.switchProfileSubTab('championship'), 50);"
                 onmouseenter="window.highlightChampLine('driver', ${d.driver_number})"
                 onmouseleave="window.resetChampLines('driver')"
                 style="position: absolute; left: 8px; display:flex; align-items:center; gap:6px; font-family:'Barlow Condensed'; font-weight:700; font-size:0.72rem; color:var(--text); cursor:pointer; transition: top 0.2s, opacity 0.2s; white-space:nowrap; transform: translateY(-50%);">
                <div style="width:4px; height:12px; background:${tc.bg}; border-radius:1px;"></div>
                <div style="width:16px; display:flex; justify-content:center;">${Utils.getTeamLogoHtml(info.team_name, '10px')}</div>
                <span>${acronym}</span>
            </div>`;
        }).join('');

        let tLegendHtml = sortedTeams.map((t) => {
            const tc = Utils.teamColor(t.team_name);
            const safeName = t.team_name.replace(/'/g, "\\'"); 
            return `<div id="leg-champ-t-${safeId(t.team_name)}" 
                 onclick="window.openTeamProfile('${safeName}'); setTimeout(() => window.switchTeamSubTab('championship'), 50);"
                 onmouseenter="window.highlightChampLine('team', '${safeName}')"
                 onmouseleave="window.resetChampLines('team')"
                 style="position: absolute; left: 8px; display:flex; align-items:center; gap:6px; font-family:'Barlow Condensed'; font-weight:700; font-size:0.72rem; color:var(--text); cursor:pointer; transition: top 0.2s, opacity 0.2s; white-space:nowrap; transform: translateY(-50%);">
                <div style="width:4px; height:12px; background:${tc.bg}; border-radius:1px;"></div>
                <div style="width:16px; display:flex; justify-content:center;">${Utils.getTeamLogoHtml(t.team_name, '10px')}</div>
                <span>${Utils.getShortTeamName(t.team_name)}</span>
            </div>`;
        }).join('');

        let dBarLegendHtml = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:0.75rem; margin-top:1.5rem;">`;
        sortedDrivers.forEach(d => {
            const info = driverInfoMap[d.driver_number] || {};
            const tc = Utils.teamColor(info.team_name);
            const acronym = info.name_acronym || info.last_name || `#${d.driver_number}`;
            const isSecondary = driverHierarchy[d.driver_number] > 0;
            
            dBarLegendHtml += `
                <div class="driver-num-badge" 
                     onclick="window.openDriverProfile(${d.driver_number}); setTimeout(() => window.switchProfileSubTab('championship'), 50);"
                     style="background:${isSecondary ? 'transparent' : tc.bg}; border:${isSecondary ? '2px dashed '+tc.bg : '2px solid '+tc.bg}; color:${isSecondary ? 'var(--text)' : tc.text}; width:68px; flex-shrink:0; height:26px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; box-sizing: border-box; transition: transform 0.15s;" 
                     onmouseover="this.style.transform='translateY(-2px)';" 
                     onmouseout="this.style.transform='translateY(0)';"
                     title="${info.full_name || acronym}">
                    ${Utils.getTeamLogoHtml(info.team_name, '10px', isSecondary ? null : tc.text)}
                    <span style="font-size:0.85rem; letter-spacing:0.05em; font-weight:700;">${acronym}</span>
                </div>
            `;
        });
        dBarLegendHtml += `</div>`;

        let tBarLegendHtml = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:0.75rem; margin-top:1.5rem;">`;
        sortedTeams.forEach(t => {
            const tc = Utils.teamColor(t.team_name);
            const safeName = t.team_name.replace(/'/g, "\\'"); 
            tBarLegendHtml += `
                <div class="driver-num-badge" 
                     onclick="window.openTeamProfile('${safeName}'); setTimeout(() => window.switchTeamSubTab('championship'), 50);"
                     style="background:${tc.bg}; border:2px solid ${tc.bg}; padding: 0 10px; min-width:48px; height:26px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; box-sizing: border-box; transition: transform 0.15s;" 
                     onmouseover="this.style.transform='translateY(-2px)';" 
                     onmouseout="this.style.transform='translateY(0)';"
                     title="${t.team_name}">
                    ${Utils.getTeamLogoHtml(t.team_name, '14px', tc.text)}
                    <span style="font-size:0.85rem; letter-spacing:0.05em; font-weight:700; color:${tc.text}">${Utils.getShortTeamName(t.team_name)}</span>
                </div>
            `;
        });
        tBarLegendHtml += `</div>`;

        champArea.style.padding = '0';
        champArea.style.textAlign = 'left';

        // --- THE FIX: Wrap the charts in a dedicated Sub-Tab Menu! ---
        champArea.innerHTML = `
            <div class="subtabs" id="season-champ-subtabs" style="margin-top: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); gap: 2rem;">
                <button class="subtab-btn active" id="season-champ-btn-driver" onclick="window.switchSeasonChampSubTab('driver')">Driver Standings</button>
                <button class="subtab-btn" id="season-champ-btn-team" onclick="window.switchSeasonChampSubTab('team')">Constructor Standings</button>
            </div>

            <div id="season-champ-content-driver" class="subtab-content active">
                <div class="standings-title" style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; padding: 0 0.5rem;">
                    <span>Driver Championship Rank</span>
                    <span style="color:var(--text-muted); text-transform:none;">Earliest Theoretical Clinch: <span style="color:var(--text); font-weight:900; text-transform:uppercase;">${dClinchRound}</span></span>
                </div>
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem 1rem; margin-bottom:2.5rem; width: 100%;">
                    <div style="display: flex; gap: 0.5rem; height: 500px; width: 100%; position: relative;">
                        <div style="flex: 1; position: relative;">
                            <canvas id="champ-driver-chart"></canvas>
                        </div>
                        <div id="chart-legend-champ-driver" style="width: 75px; position: relative; border-left: 1px solid var(--border);">
                            ${dLegendHtml}
                        </div>
                    </div>
                </div>

                <div class="standings-title" style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; padding: 0 0.5rem;">
                    <span>Driver Points Share (%)</span>
                </div>
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem 1rem; margin-bottom:2.5rem; width: 100%;">
                    <div style="height: 400px; width: 100%; position: relative;">
                        <canvas id="champ-driver-area-chart"></canvas>
                    </div>
                    ${dBarLegendHtml}
                </div>
            </div>

            <div id="season-champ-content-team" class="subtab-content">
                <div class="standings-title" style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; padding: 0 0.5rem;">
                    <span>Constructor Championship Rank</span>
                    <span style="color:var(--text-muted); text-transform:none;">Earliest Theoretical Clinch: <span style="color:var(--text); font-weight:900; text-transform:uppercase;">${tClinchRound}</span></span>
                </div>
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem 1rem; margin-bottom:2.5rem; width: 100%;">
                    <div style="display: flex; gap: 0.5rem; height: 500px; width: 100%; position: relative;">
                        <div style="flex: 1; position: relative;">
                            <canvas id="champ-team-chart"></canvas>
                        </div>
                        <div id="chart-legend-champ-team" style="width: 75px; position: relative; border-left: 1px solid var(--border);">
                            ${tLegendHtml}
                        </div>
                    </div>
                </div>

                <div class="standings-title" style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; padding: 0 0.5rem;">
                    <span>Constructor Points Share (%)</span>
                </div>
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem 1rem; margin-bottom:1rem; width: 100%;">
                    <div style="height: 400px; width: 100%; position: relative;">
                        <canvas id="champ-team-area-chart"></canvas>
                    </div>
                    ${tBarLegendHtml}
                </div>
            </div>
        `;

        window.highlightChampLine = (type, id) => {
            const chart = type === 'driver' ? window.champDriverChartInst : window.champTeamChartInst;
            if (!chart) return;
            
            chart.data.datasets.forEach(ds => {
                const isTarget = type === 'driver' ? ds.driverNumber === id : ds.teamName === id;
                if (isTarget) {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, 1.0);
                    ds.borderWidth = 5;
                    ds.order = 0; 
                } else {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, isLight ? 0.1 : 0.05);
                    ds.borderWidth = 1.5;
                    ds.order = 1;
                }
            });
            chart.update('none'); 

            chart.data.datasets.forEach(ds => {
                const itemId = type === 'driver' ? `leg-champ-d-${ds.driverNumber}` : `leg-champ-t-${safeId(ds.teamName)}`;
                const item = document.getElementById(itemId);
                if (item) {
                    const isTarget = type === 'driver' ? ds.driverNumber === id : ds.teamName === id;
                    item.style.opacity = isTarget ? '1' : '0.2';
                }
            });
        };

        window.resetChampLines = (type) => {
            const chart = type === 'driver' ? window.champDriverChartInst : window.champTeamChartInst;
            if (!chart) return;
            
            chart.data.datasets.forEach(ds => {
                ds.borderColor = Utils.convertHexToRGBA(ds._origColor, isLight ? 0.6 : 0.8);
                ds.borderWidth = ds._origWidth;
                ds.order = ds._origOrder;
            });
            chart.update('none');

            chart.data.datasets.forEach(ds => {
                const itemId = type === 'driver' ? `leg-champ-d-${ds.driverNumber}` : `leg-champ-t-${safeId(ds.teamName)}`;
                const item = document.getElementById(itemId);
                if (item) item.style.opacity = '1';
            });
        };

        const legendSyncPlugin = {
            id: 'legendSync',
            afterLayout(chart) {
                const yAxis = chart.scales.y;
                chart.data.datasets.forEach(ds => {
                    const isDriver = ds.driverNumber !== undefined;
                    const itemId = isDriver ? `leg-champ-d-${ds.driverNumber}` : `leg-champ-t-${safeId(ds.teamName)}`;
                    const item = document.getElementById(itemId);
                    
                    let lastVal = null;
                    for (let i = ds.data.length - 1; i >= 0; i--) {
                        if (ds.data[i] !== null) { lastVal = ds.data[i]; break; }
                    }
                    
                    if (item && lastVal !== null) {
                        const yPixel = yAxis.getPixelForValue(lastVal);
                        item.style.top = `${yPixel}px`;
                        item.style.display = 'flex';
                    } else if (item) {
                        item.style.display = 'none';
                    }
                });
            }
        };

        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', axis: 'xy', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { titleFont: { family: 'Barlow Condensed', size: 14 }, bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 } }
            }
        };

        const dOptions = {
            ...baseOptions,
            onHover: (e, elements, chart) => {
                if (elements && elements.length) {
                    window.highlightChampLine('driver', chart.data.datasets[elements[0].datasetIndex].driverNumber);
                }
            },
            scales: {
                x: { ticks: { color: tickColor, font: { family: 'Barlow Condensed', weight: 600 } }, grid: { color: gridColor } },
                y: { 
                    reverse: true, min: 1, max: sortedDrivers.length,
                    title: { display: true, text: 'Championship Rank', color: tickColor, font: { family: 'Barlow Condensed' } }, 
                    grid: { color: gridColor }, 
                    ticks: { stepSize: 1, color: tickColor, callback: v => 'P' + v, font: { family: 'Barlow Condensed', weight: 700 } } 
                }
            }
        };

        const tOptions = {
            ...baseOptions,
            onHover: (e, elements, chart) => {
                if (elements && elements.length) {
                    window.highlightChampLine('team', chart.data.datasets[elements[0].datasetIndex].teamName);
                }
            },
            scales: {
                x: { ticks: { color: tickColor, font: { family: 'Barlow Condensed', weight: 600 } }, grid: { color: gridColor } },
                y: { 
                    reverse: true, min: 1, max: sortedTeams.length,
                    title: { display: true, text: 'Championship Rank', color: tickColor, font: { family: 'Barlow Condensed' } }, 
                    grid: { color: gridColor }, 
                    ticks: { stepSize: 1, color: tickColor, callback: v => 'P' + v, font: { family: 'Barlow Condensed', weight: 700 } } 
                }
            }
        };

        if (window.champDriverChartInst) window.champDriverChartInst.destroy();
        window.champDriverChartInst = new Chart(document.getElementById('champ-driver-chart').getContext('2d'), {
            type: 'line', data: { labels, datasets: dDatasets }, options: dOptions, plugins: [legendSyncPlugin]
        });

        if (window.champTeamChartInst) window.champTeamChartInst.destroy();
        window.champTeamChartInst = new Chart(document.getElementById('champ-team-chart').getContext('2d'), {
            type: 'line', data: { labels, datasets: tDatasets }, options: tOptions, plugins: [legendSyncPlugin]
        });

        // THE FIX: Stacked Area Chart Options
        const areaOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', axis: 'xy', intersect: true }, 
            plugins: {
                legend: { display: false },
                tooltip: { 
                    enabled: true,
                    titleFont: { family: 'Barlow Condensed', size: 14 }, 
                    bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 },
                    callbacks: {
                        label: function(context) {
                            const ds = context.dataset;
                            const idx = context.dataIndex;
                            const raw = ds._rawPts[idx];
                            if (!raw || raw.pts === 0) return null; 
                            
                            // For standard stacked area, context.raw is the value we passed in (the pct).
                            const pct = Number(context.raw).toFixed(1) + '%';
                            return `${ds.label}: ${pct} (${raw.pts} / ${raw.total} pts)`;
                        }
                    }
                } 
            },
            scales: {
                x: { 
                    stacked: true, // Often needed for stacked lines to render x-axis bounds correctly
                    ticks: { color: tickColor, font: { family: 'Barlow Condensed', weight: 600 } }, 
                    grid: { display: false } 
                },
                y: { 
                    stacked: true, // Crucial for Stacked Area
                    min: 0, 
                    max: 100,
                    title: { display: true, text: '% of Cumulative Points', color: tickColor, font: { family: 'Barlow Condensed' } }, 
                    grid: { color: gridColor }, 
                    ticks: { color: tickColor, font: { family: 'Barlow Condensed' }, callback: v => v + '%' } 
                }
            }
        };

        // --- THE FIX: Defer chart initialization until the DOM is fully painted ---
        setTimeout(() => {
            if (window.champDriverChartInst) window.champDriverChartInst.destroy();
            window.champDriverChartInst = new Chart(document.getElementById('champ-driver-chart').getContext('2d'), {
                type: 'line', data: { labels, datasets: dDatasets }, options: dOptions, plugins: [legendSyncPlugin]
            });

            if (window.champTeamChartInst) window.champTeamChartInst.destroy();
            window.champTeamChartInst = new Chart(document.getElementById('champ-team-chart').getContext('2d'), {
                type: 'line', data: { labels, datasets: tDatasets }, options: tOptions, plugins: [legendSyncPlugin]
            });

            if (window.champDriverAreaChartInst) window.champDriverAreaChartInst.destroy();
            window.champDriverAreaChartInst = new Chart(document.getElementById('champ-driver-area-chart').getContext('2d'), {
                type: 'line', data: { labels, datasets: dAreaDatasets }, options: areaOptions
            });

            if (window.champTeamAreaChartInst) window.champTeamAreaChartInst.destroy();
            window.champTeamAreaChartInst = new Chart(document.getElementById('champ-team-area-chart').getContext('2d'), {
                type: 'line', data: { labels, datasets: tAreaDatasets }, options: areaOptions
            });

            // Explicitly trigger the tab switch to force the layout dimensions
            window.switchSeasonChampSubTab('driver');
        }, 50); 
        // --------------------------------------------------------------------------

    } catch (e) {
        console.error(e);
        champArea.innerHTML = `<div class="error-msg">Could not load championship timeline: ${e.message}</div>`;
    }
};

window.viewDriverDetails = async function(driverNumber) {
    currentDriverView = driverNumber; 

    const activeSessionTab = document.querySelector('#subtabs-container .subtab-btn.active');
    const sessionTabId = activeSessionTab ? activeSessionTab.id.replace('subtab-btn-', '') : 'results';
    
    window.showView('view-driver-detail');   
    
    const switcher = document.getElementById('detail-driver-switcher');
    if (switcher && orderedDriversList.length > 0) {
        switcher.innerHTML = orderedDriversList.map(d => 
            `<option value="${d.driver_number}" ${d.driver_number === driverNumber ? 'selected' : ''}>
                ${d.name_acronym || d.last_name} (#${d.driver_number})
            </option>`
        ).join('');
    }

    const meetingSwitcher = document.getElementById('detail-meeting-switcher');
    if (meetingSwitcher) {
        let options = '';
        const next = allMeetings.filter(m => new Date(m.date_end) >= NOW)[0];
        allMeetings.forEach((m) => {
            const isPast = new Date(m.date_end) < NOW;
            const isNext = next && m.meeting_key === next.meeting_key;
            if (isPast || isNext) {
                const prefix = m.is_testing ? 'TEST' : `Race ${m.race_week}`;
                options += `<option value="${m.meeting_key}" ${currentMeeting && m.meeting_key === currentMeeting.meeting_key ? 'selected' : ''}>${prefix} - ${m.meeting_name}</option>`;
            }
        });
        meetingSwitcher.innerHTML = options;
    }

    const sessionTabsContainer = document.getElementById('driver-detail-session-tabs');
    if (sessionTabsContainer && currentMeeting) {
        API.fetchJSON(`${Constants.BASE}/sessions?meeting_key=${currentMeeting.meeting_key}`).then(sessions => {
                const sorted = sessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
                sessionTabsContainer.innerHTML = sorted.map(s => {
                        const shortName = Utils.getShortSessionName(s.session_name);
                        const isActive = currentSession && s.session_key === currentSession.session_key ? 'active' : '';
                        return `<button class="session-tab-btn ${isActive}" onclick="openProfileSessionDetail(${driverNumber}, ${currentMeeting.meeting_key}, ${s.session_key})">${shortName}</button>`;
                }).join('');
        });
    }

    // --- THE FIX: Inject Historical Fallback for telemetry view ---
    let driverObj = orderedDriversList.find(d => d.driver_number === driverNumber);
    if (!driverObj) {
        const sessionDrivers = await API.fetchJSON(`${Constants.BASE}/drivers?session_key=${currentSession.session_key}`);
        orderedDriversList = sessionDrivers;
        driverObj = orderedDriversList.find(d => d.driver_number === driverNumber);
        
        if (!driverObj) {
            driverObj = Constants.HISTORICAL_DRIVERS[driverNumber] || { full_name: `Driver #${driverNumber}`, team_name: 'Unknown', country_code: '' };
        }
    }

    window.updateDriverHeader('detail-driver-title', driverObj);
    const subText = `${currentMeeting.location} &middot; ${Utils.getShortSessionName(currentSession.session_name)}`;
    document.getElementById('detail-driver-sub').innerHTML = `
        <span onclick="selectMeeting(${currentMeeting.meeting_key})" 
              style="cursor:pointer; border-bottom: 1px dotted var(--text-dim); transition: all 0.2s ease; padding-bottom: 1px;"
              onmouseover="this.style.color='var(--text)'; this.style.borderBottomColor='var(--text)';" 
              onmouseout="this.style.color='var(--text-dim)'; this.style.borderBottomColor='var(--text-dim)';">
            ${subText}
        </span>
    `;

    window.updateDriverSubTabsForSession();

    const activeSubTab = document.querySelector('#driver-subtabs-container .subtab-btn.active');
    const activeTabId = activeSubTab ? activeSubTab.id.replace('driver-subtab-btn-', '') : 'tire-strategy';
    window.switchDriverSubTab(activeTabId);

    const backBtn = document.getElementById('driver-detail-back-btn');
    if (backBtn) {
        if (previousView === 'view-driver-profile') {
            backBtn.textContent = '← Back to Profile';
            backBtn.onclick = () => window.showView('view-driver-profile');
        } else {
            backBtn.textContent = '← Back to Results';
            backBtn.onclick = () => {
                window.showView('view-drivers');
                window.switchSubTab(sessionTabId);
            };
        }
    }

    const stratContainer = document.getElementById('driver-subtab-content-tire-strategy');
    stratContainer.innerHTML = `
        <div id="detail-strategy-title" class="standings-title" style="margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
            <span>Pace Analysis <span id="sc-legend" style="display:none;"><span style="color:#ffcc00; margin-left:10px; font-weight:900;">█ SC</span> <span style="color:#ff6600; margin-left:5px; font-weight:900;">█ VSC</span></span></span>
            <span id="detail-total-laps">Total Laps: --</span>
        </div>

        <div id="pace-analysis-container" style="position: relative; width: 100%;">
            <div id="sc-master-overlay" style="position: absolute; top: 0; bottom: 0; left: 0; width: 100%; pointer-events: none; z-index: 15; transition: margin-left 0.3s, width 0.3s;"></div>

            <div style="width: 100%; position: relative; z-index: 10; cursor: pointer;" onclick="toggleLapTimeChart()" title="Click to toggle telemetry">
                <div class="stint-track" id="detail-stint-track" style="height: 28px; border-radius: 4px; overflow: hidden; position: relative; background: var(--surface2); transition: margin-left 0.3s, width 0.3s;">
                    <div class="spinner" style="margin:auto; width:16px; height:16px;"></div>
                </div>
            </div>

            <div id="lapTimeChartWrapper" style="display: none; position: relative; height: 350px; width: 100%; margin-top: 0.5rem; z-index: 10;">
                <canvas id="lapTimeChart"></canvas>
            </div>
        </div>

        <div class="standings-title" style="margin-top: 3.5rem; margin-bottom: 0.5rem;">Tire Performance</div>
        <div id="detail-tire-performance" style="width: 100%; position: relative;">
             <div class="spinner" style="margin:auto; width:16px; height:16px;"></div>
        </div>
    `;
    
    try {
        const [stints, laps] = await Promise.all([
            API.getStintData(currentSession.session_key, driverNumber),
            API.getLapAnalysisData(currentSession.session_key, driverNumber)
        ]);

        const totalLaps = laps.length > 0 ? laps[laps.length - 1].lap_number : 1;
        const lapRange = Math.max(1, totalLaps - 1); 
        const scPeriods = await API.getSafetyCarPeriods(currentSession.session_key, laps);
        
        document.getElementById('detail-total-laps').textContent = `Total Laps: ${totalLaps}`;
        if (scPeriods.length > 0) {
                document.getElementById('sc-legend').style.display = 'inline';
        }

        const isLight = document.body.dataset.theme === 'light';
        const scOverlayColor = isLight ? 'rgba(255, 204, 0, 0.45)' : 'rgba(255, 204, 0, 0.2)';
        const vscOverlayColor = isLight ? 'rgba(255, 102, 0, 0.45)' : 'rgba(255, 102, 0, 0.2)';
        
        let scBarsHtml = '';
        if (scPeriods.length > 0) {
            scPeriods.forEach(p => {
                    const leftPct = ((p.startLap - 1) / lapRange) * 100;
                    const widthPct = ((p.endLap - p.startLap) / lapRange) * 100;
                    const isSC = p.type === 'SC';
                    const color = isSC ? scOverlayColor : vscOverlayColor;
                    const borderCol = isSC ? '#ffcc00' : '#ff6600';
                    scBarsHtml += `<div style="position:absolute; left:${leftPct}%; width:${widthPct}%; height:100%; background:${color}; border-left: 1px solid ${borderCol}; border-right: 1px solid ${borderCol}; pointer-events:none;"></div>`;
            });
        }

        const scMaster = document.getElementById('sc-master-overlay');
        if (scMaster) scMaster.innerHTML = scBarsHtml;

        const stintTrack = document.getElementById('detail-stint-track');
        if (!stints || stints.length === 0) {
            stintTrack.innerHTML = `<div style="color:var(--text-dim); padding:0.5rem; text-align:center; font-size:0.8rem;">No tire data available</div>`;
        } else {
            let trackHtml = '';
            stints.forEach((stint, idx) => {
                let startPoint = stint.lap_start - 1;
                let endPoint = stint.lap_end - 1;
                if (idx < stints.length - 1) {
                     const nextStint = stints[idx + 1];
                     endPoint = (stint.lap_end - 1 + nextStint.lap_start - 1) / 2;
                } else {
                     endPoint = totalLaps - 1;
                }
                
                const widthPct = ((endPoint - startPoint) / lapRange) * 100;
                const rawCompound = stint.compound ? stint.compound.toUpperCase() : 'MEDIUM';
                const compoundClass = `tire-${rawCompound}`;
                const tireLabel = rawCompound[0];
                
                if (widthPct > 0) {
                    trackHtml += `<div class="tire-bar ${compoundClass}" style="width: ${widthPct}%" title="${stint.compound} (${stint.lap_end - stint.lap_start} Laps)">${tireLabel}</div>`;
                }
            });
            stintTrack.innerHTML = trackHtml; 
        }

        const validLaps = laps.filter(l => l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap && !l.is_pit_in_lap);
        if (validLaps.length === 0) {
            if (driverChartInstance) driverChartInstance.destroy();
            document.getElementById('detail-tire-performance').innerHTML = `<div class="error-msg">No valid lap times to display.</div>`;
            return; 
        }

        const sortedDurations = [...validLaps].map(l => l.lap_duration).sort((a, b) => a - b);
        const medianTime = sortedDurations[Math.floor(sortedDurations.length / 2)];
        const filteredLaps = validLaps.filter(l => l.lap_duration < medianTime * 1.35);

        const chartLabels = Array.from({length: totalLaps}, (_, i) => `Lap ${i + 1}`);
        const chartData = Array(totalLaps).fill(null);
        
        const hardColor = isLight ? '#aaaaaa' : '#ffffff'; 
        const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
        const tickColor = isLight ? '#666666' : '#888888';
        const lineColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';
        
        const pointColors = Array(totalLaps).fill(tickColor);

        filteredLaps.forEach(l => {
            const idx = l.lap_number - 1;
            if (idx < 0 || idx >= totalLaps) return;
            chartData[idx] = l.lap_duration;
            
            let currentStint = stints.find(s => l.lap_number >= s.lap_start && l.lap_number <= s.lap_end);
            const compound = currentStint ? (currentStint.compound || 'MEDIUM').toUpperCase() : 'MEDIUM';
            if (compound === 'SOFT') pointColors[idx] = '#ff3333';
            else if (compound === 'MEDIUM') pointColors[idx] = '#ffd12b';
            else if (compound === 'HARD') pointColors[idx] = hardColor;
            else if (compound === 'INTERMEDIATE') pointColors[idx] = '#33cc33';
            else if (compound === 'WET') pointColors[idx] = '#0066ff';
        });

        const syncBarPlugin = {
            id: 'syncBar',
            afterLayout: (chart) => {
                const track = document.getElementById('detail-stint-track');
                const scMaster = document.getElementById('sc-master-overlay');
                const wrapper = document.getElementById('lapTimeChartWrapper');
                
                if (chart.chartArea && wrapper && wrapper.style.display !== 'none') {
                    if (track) {
                        track.style.marginLeft = chart.chartArea.left + 'px';
                        track.style.width = (chart.chartArea.right - chart.chartArea.left) + 'px';
                    }
                    if (scMaster) {
                        scMaster.style.marginLeft = chart.chartArea.left + 'px';
                        scMaster.style.width = (chart.chartArea.right - chart.chartArea.left) + 'px';
                    }
                }
            }
        };

        const ctx = document.getElementById('lapTimeChart').getContext('2d');
        if (driverChartInstance) { driverChartInstance.destroy(); }

        driverChartInstance = new Chart(ctx, {
            type: 'line',
            plugins: [syncBarPlugin], 
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Lap Time (s)',
                    data: chartData,
                    borderColor: lineColor,
                    borderWidth: 1,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0.2,
                    spanGaps: true 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: tickColor,
                layout: { padding: { top: 10 } },
                scales: {
                    x: { ticks: { color: tickColor, maxTicksLimit: 20 }, grid: { color: gridColor } },
                    y: { ticks: { color: tickColor, callback: (v) => Utils.fmtLapTime(v) }, grid: { color: gridColor } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => Utils.fmtLapTime(ctx.raw) } }
                }
            }
        });

        const tpContainer = document.getElementById('detail-tire-performance');

        function boxStats(times) {
                if (times.length === 0) return null;
                const sorted = [...times].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];
                return {
                        min: sorted[0],
                        q1: sorted[Math.floor(sorted.length * 0.25)],
                        median: median,
                        q3: sorted[Math.floor(sorted.length * 0.75)],
                        max: sorted[sorted.length - 1],
                        mean: sorted.reduce((a, b) => a + b, 0) / sorted.length
                };
        }

        const isSCLap = (lapNum) => scPeriods.some(p => lapNum >= Math.floor(p.startLap) && lapNum <= Math.ceil(p.endLap));
        
        const rawViolinLaps = validLaps.filter(l => !isSCLap(l.lap_number));
        let violinCleanLaps = rawViolinLaps;
        
        if (rawViolinLaps.length > 0) {
                const sortedV = [...rawViolinLaps].map(l => l.lap_duration).sort((a,b) => a-b);
                const medV = sortedV[Math.floor(sortedV.length / 2)];
                violinCleanLaps = rawViolinLaps.filter(l => l.lap_duration <= medV * 1.10); 
        }

        const driverPerfData = {};
        violinCleanLaps.forEach(l => {
                let currentStint = stints.find(s => l.lap_number >= s.lap_start && l.lap_number <= s.lap_end);
                const compound = currentStint ? (currentStint.compound || 'MEDIUM').toUpperCase() : 'MEDIUM';
                if (!driverPerfData[compound]) driverPerfData[compound] = [];
                driverPerfData[compound].push(l.lap_duration);
        });

        const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];
        const COMPOUND_COLORS = { SOFT: '#ff3333', MEDIUM: '#ffd12b', HARD: hardColor, INTERMEDIATE: '#33cc33', WET: '#0066ff' };
        const usedCompounds = COMPOUNDS.filter(c => driverPerfData[c] && driverPerfData[c].length > 0);

        if (usedCompounds.length === 0) {
                tpContainer.innerHTML = `<div class="error-msg">No pure pace laps available (all laps were SC or outliers).</div>`;
                return;
        }

        let minT = Infinity, maxT = -Infinity;
        usedCompounds.forEach(c => {
                const times = driverPerfData[c];
                minT = Math.min(minT, ...times);
                maxT = Math.max(maxT, ...times);
        });

        const yPad = (maxT - minT) * 0.1 || 1;
        minT -= yPad;
        maxT += yPad;

        const CHART_H = 340;
        const BOX_W = 140;   
        const BOX_GAP = 60;  
        const LEFT_PAD = 80;
        const RIGHT_PAD = 80;
        const TOP_PAD = 20;
        const BOTTOM_PAD = 75; 

        const svgWidth = LEFT_PAD + (usedCompounds.length * BOX_W) + ((usedCompounds.length - 1) * BOX_GAP) + RIGHT_PAD;
        const svgHeight = CHART_H + TOP_PAD + BOTTOM_PAD;

        function yPx(val) { return TOP_PAD + (1 - (val - minT) / (maxT - minT)) * CHART_H; }

        let svgContent = '';
        
        const numTicks = 6;
        for(let i=0; i<=numTicks; i++) {
                const val = minT + (i/numTicks)*(maxT - minT);
                const y = yPx(val);
                svgContent += `<line x1="${LEFT_PAD}" y1="${y}" x2="${svgWidth - RIGHT_PAD}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`;
                svgContent += `<text x="${LEFT_PAD - 8}" y="${y + 4}" text-anchor="end" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="11">${Utils.fmtLapTime(val)}</text>`;
        }

        usedCompounds.forEach((compound, ci) => {
                const times = driverPerfData[compound];
                const color = COMPOUND_COLORS[compound];
                const cx = LEFT_PAD + (ci * (BOX_W + BOX_GAP)) + (BOX_W / 2);

                const bw = 0.4; 
                const steps = 100;
                const stepSize = (maxT - minT) / steps;
                const densities = [];
                let maxDensity = 0;

                for(let i=0; i<=steps; i++) {
                        const v = minT + i * stepSize;
                        const d = Utils.gaussianKDE(v, times, bw);
                        densities.push({ v, d });
                        if (d > maxDensity) maxDensity = d;
                }

                let pathD = '';
                for(let i=0; i<=steps; i++) {
                        const pt = densities[i];
                        const pxX = cx + (pt.d / maxDensity) * (BOX_W / 2);
                        const pxY = yPx(pt.v);
                        pathD += i === 0 ? `M ${pxX} ${pxY} ` : `L ${pxX} ${pxY} `;
                }
                for(let i=steps; i>=0; i--) {
                        const pt = densities[i];
                        const pxX = cx - (pt.d / maxDensity) * (BOX_W / 2);
                        const pxY = yPx(pt.v);
                        pathD += `L ${pxX} ${pxY} `;
                }
                pathD += 'Z';
                svgContent += `<path d="${pathD}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5" />`;

                times.forEach(t => {
                        const py = yPx(t);
                        const jitter = (Math.random() - 0.5) * (BOX_W * 0.35); 
                        svgContent += `<circle cx="${cx + jitter}" cy="${py}" r="2.5" fill="${color}" opacity="0.85"/>`;
                });

                const s = boxStats(times);
                if (s) {
                        const iqrW = 8;
                        svgContent += `<rect x="${cx - iqrW/2}" y="${yPx(s.q3)}" width="${iqrW}" height="${yPx(s.q1) - yPx(s.q3)}" fill="${color}" stroke="${color}" stroke-width="1"/>`;
                        svgContent += `<circle cx="${cx}" cy="${yPx(s.median)}" r="3.5" fill="var(--bg)" stroke="${color}" stroke-width="1.5"/>`;
                        
                        svgContent += `<text x="${cx}" y="${svgHeight - BOTTOM_PAD + 18}" text-anchor="middle" fill="${color}" font-family="Barlow Condensed,sans-serif" font-size="15" font-weight="700">${compound}</text>`;
                        svgContent += `<text x="${cx}" y="${svgHeight - BOTTOM_PAD + 34}" text-anchor="middle" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="12">${times.length} laps</text>`;
                        svgContent += `<text x="${cx}" y="${svgHeight - BOTTOM_PAD + 50}" text-anchor="middle" fill="${tickColor}" font-family="Barlow Condensed,sans-serif" font-size="13" font-weight="700">Avg: ${Utils.fmtLapTime(s.mean)}</text>`;
                }
        });

        tpContainer.innerHTML = `
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; overflow-x:auto; overflow-y:hidden; text-align: center;">
                        <svg width="${svgWidth}" height="${svgHeight}" style="display:inline-block; max-width: 100%;">
                                ${svgContent}
                        </svg>
                </div>
        `;

    } catch (e) {
        console.error("View Driver Details Error:", e);
        document.getElementById('detail-stint-track').innerHTML = `<div class="error-msg">Error loading data: ${e.message}</div>`;
    }
};

window.switchDriverMeeting = async function(meetingKey) {
    currentMeeting = allMeetings.find(m => m.meeting_key === meetingKey);
    try {
        const sessions = await API.fetchJSON(`${Constants.BASE}/sessions?meeting_key=${meetingKey}`);
        const sorted = sessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
        let targetSession = sorted[0]; 
        const pastSessions = sorted.filter(s => new Date(s.date_start) < NOW);
        if (pastSessions.length > 0) {
            targetSession = pastSessions[pastSessions.length - 1]; 
        }
        if (targetSession) {
            await window.openProfileSessionDetail(currentDriverView, meetingKey, targetSession.session_key);
        }
    } catch (e) {
        console.error("Error switching driver meeting:", e);
    }
};

window.openProfileSessionDetail = async function(driverNumber, meetingKey, sessionKey) {
    try {
        currentMeeting = allMeetings.find(m => m.meeting_key === meetingKey);
        const sessions = await API.fetchJSON(`${Constants.BASE}/sessions?session_key=${sessionKey}`);
        currentSession = sessions[0];
        
        const [fullDrivers, positions] = await Promise.all([
            API.fetchJSON(`${Constants.BASE}/drivers?session_key=${sessionKey}`),
            API.fetchJSON(`${Constants.BASE}/position?session_key=${sessionKey}`).catch(() => [])
        ]);

        const latestPos = {};
        positions.forEach(p => {
            if (!latestPos[p.driver_number] || new Date(p.date) > new Date(latestPos[p.driver_number].date)) {
                latestPos[p.driver_number] = p;
            }
        });

        orderedDriversList = fullDrivers.map(d => ({ 
            ...d, 
            position: latestPos[d.driver_number]?.position || null 
        })).sort((a, b) => {
            if (a.position && b.position) return a.position - b.position;
            if (a.position) return -1;
            if (b.position) return 1;
            return (championshipRanks[a.driver_number] || 99) - (championshipRanks[b.driver_number] || 99);
        });

        const activeView = document.querySelector('.view.active');
        if (activeView && activeView.id !== 'view-driver-detail') {
             previousView = 'view-driver-profile';
        }
        
        await window.viewDriverDetails(driverNumber);
        
    } catch (e) {
        console.error("Historical Session Error:", e);
    }
};

window.updateDriverHeader = function(elementId, driverObj) {
    const target = document.getElementById(elementId);
    if (!target || !driverObj) return;

    const tc = Utils.teamColor(driverObj.team_name);
    
    const acronym = driverObj.name_acronym || '';
    const countryCode = driverObj.country_code || Constants.DRIVER_COUNTRY_FALLBACK[acronym] || '';
    const iso2 = Constants.countryToIso2[countryCode] || '';
    
    let nationalityHtml = '';
    if (iso2) {
        nationalityHtml = `<img src="https://flagcdn.com/w40/${iso2}.png" style="height:14px; width:22px; object-fit:cover; border-radius:1px; border:1px solid rgba(0,0,0,0.2);" alt="${countryCode}">`;
    } else if (countryCode) {
        nationalityHtml = `<span style="font-size:0.7rem; font-weight:800; opacity:0.6; letter-spacing:0.05em;">${countryCode}</span>`;
    }

    target.innerHTML = `
        <div style="display:flex; align-items:center; gap:1rem;">
            <span>${driverObj.full_name || driverObj.last_name}</span>
            <div class="driver-num-badge" style="background:${tc.bg}; color:${tc.text}; width:auto; min-width:65px; height:32px; padding:0 10px; display:flex; align-items:center; gap:8px; border-radius:3px; justify-content: center;">
                ${nationalityHtml}
                <span style="font-size:1.1rem; line-height:1; font-weight:700;">${driverObj.driver_number}</span>
            </div>
        </div>
    `;
};

window.renderRacePositionChart = async function(containerId, driverNumber) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sessionNameLower = (currentSession?.session_name || '').toLowerCase();
    const isRace = (sessionNameLower.includes('race') || sessionNameLower.includes('sprint')) && !sessionNameLower.includes('qualifying');

    const targetEl = driverNumber !== null ? document.getElementById('driver-places-chart-area') : container;
    if (!isRace) {
        if (targetEl) targetEl.innerHTML = `<div class="error-msg">Position chart only available for Race sessions.</div>`;
        return;
    }

    targetEl.innerHTML = `<div class="loading"><div class="spinner"></div>Syncing Interactivity...</div>`;

    try {
        const [allPositions, allLapsRaw] = await Promise.all([
            API.fetchJSON(`${Constants.BASE}/position?session_key=${currentSession.session_key}`),
            API.fetchJSON(`${Constants.BASE}/laps?session_key=${currentSession.session_key}`)
        ]);

        const leaderDriver = orderedDriversList.find(d => d.position === 1) || orderedDriversList[0];
        const leaderLaps = allLapsRaw
            .filter(l => l.driver_number === leaderDriver?.driver_number && l.date_start)
            .sort((a, b) => a.lap_number - b.lap_number);

        const labels = leaderLaps.map(l => `${l.lap_number}`);
        const scPeriods = await API.getSafetyCarPeriods(currentSession.session_key, leaderLaps);

        const driverLapPositions = {};
        orderedDriversList.forEach(driver => {
            const dn = driver.driver_number;
            const updates = allPositions.filter(p => p.driver_number === dn).sort((a, b) => new Date(a.date) - new Date(b.date));
            const lapPath = [];
            leaderLaps.forEach(lap => {
                const lapStartTime = new Date(lap.date_start);
                const lastKnownPos = updates.filter(u => new Date(u.date) <= lapStartTime).pop();
                lapPath.push(lastKnownPos ? lastKnownPos.position : null);
            });
            driverLapPositions[dn] = lapPath;
        });

        const isLight = document.body.dataset.theme === 'light';
        const gridColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
        const tickColor = isLight ? '#222' : '#aaa';
        const scColor = isLight ? 'rgba(255, 204, 0, 0.45)' : 'rgba(255, 204, 0, 0.2)';
        const vscColor = isLight ? 'rgba(255, 102, 0, 0.45)' : 'rgba(255, 102, 0, 0.2)';
        
        const isProfileMode = driverNumber !== null;
        
        const datasets = orderedDriversList.map(driver => {
            const dn = driver.driver_number;
            const tc = Utils.teamColor(driver.team_name);
            const isFocused = (isProfileMode && dn === driverNumber);
            const color = tc.bg;
            const opacity = isFocused ? 1.0 : (isProfileMode ? (isLight ? 0.35 : 0.15) : 0.8);

            return {
                label: driver.name_acronym || driver.last_name || `#${dn}`,
                driverNumber: dn, 
                data: driverLapPositions[dn],
                borderColor: Utils.convertHexToRGBA(color, opacity),
                borderWidth: isFocused ? 4 : 2,
                pointRadius: 0,
                fill: false,
                tension: 0.3,
                spanGaps: true,
                order: isFocused ? 0 : 1
            };
        });

        targetEl.innerHTML = `
            <div style="display:flex; gap:12px; margin-bottom:12px; font-family:'Barlow Condensed'; font-size:0.75rem; font-weight:700;">
                    <span style="color:#ffcc00; background:rgba(0,0,0,0.08); padding:2px 8px; border-radius:2px;">█ SAFETY CAR</span>
                    <span style="color:#ff6600; background:rgba(0,0,0,0.08); padding:2px 8px; border-radius:2px;">█ VSC</span>
            </div>
            <div style="display: flex; gap: 0.5rem; height: 500px; width: 100%; position: relative;">
                <div style="flex: 1; position: relative;">
                    <canvas id="canvas_pos_${containerId}"></canvas>
                </div>
                <div id="chart-legend-${containerId}" style="width: 75px; position: relative; border-left: 1px solid var(--border);">
                    ${orderedDriversList.map((d, i) => {
                        const tc = Utils.teamColor(d.team_name);
                        const acronym = d.name_acronym || (d.last_name ? d.last_name.substring(0,3).toUpperCase() : '???');
                        const isDimmed = isProfileMode && d.driver_number !== driverNumber;
                     return `
                            <div id="leg-item-${containerId}-${i}" 
                                 onclick="previousView='view-drivers'; viewDriverDetails(${d.driver_number}); setTimeout(() => switchDriverSubTab('places'), 50);"
                                 onmouseenter="highlightLine(${d.driver_number})"
                                 onmouseleave="resetLines()"
                                 style="position: absolute; left: 8px; display:flex; align-items:center; gap:6px; font-family:'Barlow Condensed'; font-weight:700; font-size:0.72rem; color:var(--text); cursor:pointer; opacity:${isDimmed ? 0.3 : 1}; transition: top 0.2s, opacity 0.2s; white-space:nowrap; transform: translateY(-50%);">
                                <div style="width:4px; height:12px; background:${tc.bg}; border-radius:1px;"></div>
                                <div style="width:16px; display:flex; justify-content:center;">${Utils.getTeamLogoHtml(d.team_name, '10px')}</div>
                                <span>${acronym}</span>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;

        const ctx = document.getElementById(`canvas_pos_${containerId}`).getContext('2d');
        
        const legendSyncPlugin = {
            id: 'legendSync',
            afterLayout(chart) {
                const yAxis = chart.scales.y;
                orderedDriversList.forEach((_, i) => {
                    const item = document.getElementById(`leg-item-${containerId}-${i}`);
                    if (item) {
                        const yPixel = yAxis.getPixelForValue(i + 1);
                        item.style.top = `${yPixel}px`;
                    }
                });
            }
        };

        const scOverlayPlugin = {
            id: 'scOverlay',
            beforeDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                if (!chartArea || !scPeriods.length) return;
                scPeriods.forEach(p => {
                    const xStart = scales.x.getPixelForValue(String(Math.ceil(p.startLap)));
                    const xEnd = scales.x.getPixelForValue(String(Math.floor(p.endLap)));
                    ctx.save();
                    ctx.fillStyle = p.type === 'SC' ? scColor : vscColor;
                    ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.height);
                    ctx.restore();
                });
            }
        };

        if (racePositionChartInstance) racePositionChartInstance.destroy();
        racePositionChartInstance = new Chart(ctx, {
            type: 'line',
            plugins: [scOverlayPlugin, legendSyncPlugin],
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: tickColor, maxTicksLimit: 20 }, grid: { color: gridColor } },
                    y: { 
                        reverse: true, min: 1, max: orderedDriversList.length, 
                        ticks: { stepSize: 1, color: tickColor, callback: v => 'P' + v, font: { family: 'Barlow Condensed', weight: 700 } }, 
                        grid: { color: gridColor } 
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        window.highlightLine = (dn) => {
            if (!racePositionChartInstance) return;
            racePositionChartInstance.data.datasets.forEach(ds => {
                const tc = Utils.teamColor(orderedDriversList.find(d => d.driver_number === ds.driverNumber)?.team_name);
                if (ds.driverNumber === dn) {
                    ds.borderColor = Utils.convertHexToRGBA(tc.bg, 1.0);
                    ds.borderWidth = 5;
                    ds.order = 0; 
                } else {
                    ds.borderColor = Utils.convertHexToRGBA(tc.bg, isLight ? 0.1 : 0.05);
                    ds.borderWidth = 1.5;
                    ds.order = 1;
                }
            });
            racePositionChartInstance.update('none'); 
        };

        window.resetLines = () => {
            if (!racePositionChartInstance) return;
            racePositionChartInstance.data.datasets.forEach(ds => {
                const tc = Utils.teamColor(orderedDriversList.find(d => d.driver_number === ds.driverNumber)?.team_name);
                const isFocused = (isProfileMode && ds.driverNumber === driverNumber);
                const opacity = isFocused ? 1.0 : (isProfileMode ? (isLight ? 0.35 : 0.15) : 0.8);
                ds.borderColor = Utils.convertHexToRGBA(tc.bg, opacity);
                ds.borderWidth = isFocused ? 4 : 2;
                ds.order = isFocused ? 0 : 1;
            });
            racePositionChartInstance.update('none');
        };

    } catch (e) { console.error("Position Chart Error:", e); }
};

// --- MISSING TEAM PROFILE VIEW ---
window.openTeamProfile = async function(teamName) {
    // Close any open mobile standings modals automatically
    document.querySelectorAll('.standings-panel').forEach(p => p.classList.remove('mobile-modal-active'));
    document.body.style.overflow = '';
    
    window.showView('view-team-profile');
    window.switchTeamSubTab('results'); 
    
    const list = document.getElementById('profile-team-results-list');
    const statsBar = document.getElementById('profile-team-stats-bar');
    const driversContainer = document.getElementById('profile-team-drivers');
    
    list.innerHTML = `<div class="loading"><div class="spinner"></div>Loading team profile...</div>`;
    statsBar.innerHTML = ''; 
    driversContainer.innerHTML = '';

    let tInfo = Constants.TEAM_INFO[teamName];
    if (!tInfo) {
        for (const [k, v] of Object.entries(Constants.TEAM_INFO)) {
            if (teamName.includes(k) || k.includes(teamName)) { tInfo = v; break; }
        }
    }
    if (!tInfo) tInfo = { full: teamName, principal: 'N/A', base: 'N/A' };

    const teamHero = document.querySelector('#view-team-profile .session-hero');
    const logoClass = tInfo.invert ? 'invert-dark' : '';
    const logoHtml = tInfo.logo 
        ? `<img src="${tInfo.logo}" referrerpolicy="no-referrer" crossorigin="anonymous" class="${logoClass}" style="height:38px; width:auto; max-width: 60px; object-fit:contain; margin-right:1.25rem; display:block;">` 
        : '';

    teamHero.innerHTML = `
        <div style="display:flex; align-items:center;">
            ${logoHtml}
            <div>
                <div class="session-hero-name" id="profile-team-title">${tInfo.full}</div>
                <div class="session-hero-sub" id="profile-team-base">${tInfo.base}</div>
            </div>
        </div>
    `;

    try {
        const pastMeetings = allMeetings.filter(m => new Date(m.date_end) < NOW);
        if(pastMeetings.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-dim);">No completed races yet.</div>`;
            return;
        }

        const latestMeeting = pastMeetings[pastMeetings.length - 1];
        const latestSessions = await API.fetchJSON(`${Constants.BASE}/sessions?meeting_key=${latestMeeting.meeting_key}`);
        const latestSessionKey = latestSessions[latestSessions.length-1].session_key;

        const [allDriversLatest, champDrivers, champTeams] = await Promise.all([
            API.fetchJSON(`${Constants.BASE}/drivers?session_key=${latestSessionKey}`),
            API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${latestSessionKey}`).catch(()=>[]),
            API.fetchJSON(`${Constants.BASE}/championship_teams?session_key=${latestSessionKey}`).catch(()=>[])
        ]);

        let totalTeamPoints = 0;
        const myTeamChamp = champTeams.find(t => t.team_name === teamName);
        if (myTeamChamp) totalTeamPoints = myTeamChamp.points_current;

        const teamDrivers = allDriversLatest.filter(d => d.team_name === teamName).map(d => {
            const cd = champDrivers.find(c => c.driver_number === d.driver_number);
            return { ...d, points_current: cd ? cd.points_current : 0 };
        }).sort((a,b) => {
            const rankA = championshipRanks[a.driver_number] ?? 999;
            const rankB = championshipRanks[b.driver_number] ?? 999;
            if (rankA !== rankB) return rankA - rankB;
            return a.driver_number - b.driver_number;
        }).slice(0, 2);

        const tc = Utils.teamColor(teamName);
        driversContainer.innerHTML = teamDrivers.map(d => `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:1.25rem; display:flex; align-items:center; gap:1.25rem; cursor:pointer; transition: transform 0.15s, border-color 0.15s;" 
                 onmouseover="this.style.borderColor='var(--border-hover)'; this.style.transform='translateY(-2px)';" 
                 onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)';"
                 onclick="openDriverProfile(${d.driver_number})">
                <div class="driver-num-badge" style="background:${tc.bg}; color:${tc.text}; font-size:1.4rem; width:48px; height:48px; border-radius:4px;">${d.driver_number}</div>
                <div style="flex:1;">
                    <div style="font-family:'Barlow Condensed', sans-serif; font-size:1.4rem; font-weight:700; text-transform:uppercase;">${d.full_name || d.last_name}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">${d.points_current} pts</div>
                </div>
                <div style="color:var(--text-dim); font-size: 1.5rem;">›</div>
            </div>
        `).join('');

        const allYearSessions = await API.fetchJSON(`${Constants.BASE}/sessions?year=${currentYear}`);
        const targetSessions = allYearSessions.filter(s => {
            const n = (s.session_name || '').toLowerCase();
            return (n === 'race' || n === 'sprint') && new Date(s.date_start) < NOW;
        }).sort((a,b) => new Date(a.date_start) - new Date(b.date_start)); 

        let raceWins = 0, podiums = 0, dnfs = 0, dnss = 0, dsqs = 0;
        const rowHtmls = [];

        for (const s of targetSessions) {
            const [resultData, allChampDrivers, lapData1, lapData2] = await Promise.all([
                API.fetchJSON(`${Constants.BASE}/session_result?session_key=${s.session_key}`).catch(() => []),
                API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${s.session_key}`).catch(() => []),
                teamDrivers[0] ? API.fetchJSON(`${Constants.BASE}/laps?session_key=${s.session_key}&driver_number=${teamDrivers[0].driver_number}`).catch(() => []) : Promise.resolve([]),
                teamDrivers[1] ? API.fetchJSON(`${Constants.BASE}/laps?session_key=${s.session_key}&driver_number=${teamDrivers[1].driver_number}`).catch(() => []) : Promise.resolve([])
            ]);

            const getFinalPos = (dNum, lapData) => {
                const validLaps = lapData ? lapData.filter(l => l.lap_duration && l.lap_duration > 0) : [];
                let finalPos = 'DNF';
                if (validLaps.length === 0) {
                    finalPos = 'DNS';
                } else {
                    const dResult = resultData.find(r => r.driver_number === dNum);
                    if (dResult) {
                        const pos = dResult.position;
                        const status = (dResult.status || '').toUpperCase();
                        if (status.includes('DSQ') || status.includes('DISQUALIFIED')) {
                            finalPos = 'DSQ';
                        } else if (pos) {
                            if (status !== 'FINISHED' && !status.includes('LAP') && status !== '') {
                                finalPos = 'DNF';
                            } else {
                                finalPos = pos;
                            }
                        }
                    }
                }
                return finalPos;
            };

            const d1Pos = teamDrivers[0] ? getFinalPos(teamDrivers[0].driver_number, lapData1) : null;
            const d2Pos = teamDrivers[1] ? getFinalPos(teamDrivers[1].driver_number, lapData2) : null;
            const isSprint = s.session_name.toLowerCase().includes('sprint');

            [d1Pos, d2Pos].forEach(pos => {
                if (pos !== null) {
                    if (pos === 'DNF') dnfs++;
                    else if (pos === 'DNS') dnss++;
                    else if (pos === 'DSQ') dsqs++;
                    else if (!isSprint && typeof pos === 'number') {
                        if (pos === 1) raceWins++;
                        if (pos <= 3) podiums++;
                    }
                }
            });

            let ptsGained = 0;
            if (allChampDrivers && allChampDrivers.length > 0) {
                if (teamDrivers[0]) {
                     const c1 = allChampDrivers.find(c => c.driver_number === teamDrivers[0].driver_number);
                     if (c1) ptsGained += (c1.points_current || 0) - (c1.points_start || 0);
                }
                if (teamDrivers[1]) {
                     const c2 = allChampDrivers.find(c => c.driver_number === teamDrivers[1].driver_number);
                     if (c2) ptsGained += (c2.points_current || 0) - (c2.points_start || 0);
                }
            }

            const meeting = allMeetings.find(m => m.meeting_key === s.meeting_key);
            const roundText = meeting ? (meeting.is_testing ? 'TEST' : `Race ${meeting.race_week}`) : '';
            const dateString = meeting ? `${Utils.fmtDate(meeting.date_start)} - ${Utils.fmtDate(meeting.date_end)}` : '';
            const badgeHtml = isSprint ? `<span style="background:#E87D2B; color:#fff; font-size:0.6rem; padding:2px 4px; border-radius:2px; margin-left:8px; vertical-align:middle;">SPRINT</span>` : '';

            const flagUrl = meeting && meeting.country_name ? `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${Utils.getCountryCode(meeting.country_name)}.svg` : '';
            const flagHtml = flagUrl ? `<img src="${flagUrl}" style="width:20px; height:auto; border-radius:2px; box-shadow:0 1px 3px rgba(0,0,0,0.2); margin-right:8px; vertical-align:middle; display:inline-block;">` : '';

            rowHtmls.push(`
                <div class="driver-row" style="grid-template-columns: 2.5rem 1fr auto;" onclick="window.selectMeeting(${meeting.meeting_key})">
                    <div style="font-family:'Barlow Condensed', sans-serif; color:var(--text-dim); font-weight:700;">${roundText}</div>
                    
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div style="font-weight:700; font-family:'Barlow Condensed', sans-serif; font-size:1.1rem; text-transform:uppercase; display:flex; align-items:center;">
                            ${flagHtml}${meeting ? meeting.meeting_name : 'Unknown'} ${badgeHtml}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                            ${dateString}
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap: 2.5rem; text-align:right;">
                        <div style="min-width: 4rem; display:flex; flex-direction:column; align-items:flex-end;">
                            <span style="font-size:0.55rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px; font-family:'Barlow Condensed', sans-serif;">Points Gained</span>
                            <div class="driver-pts-gained${ptsGained === 0 ? ' zero' : ''}" style="display:inline-block; font-size:0.9rem; padding: 2px 6px;">
                                ${ptsGained > 0 ? '+' : ''}${ptsGained}
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        list.innerHTML = rowHtmls.join('');

        statsBar.innerHTML = `
            <div class="stat"><div class="stat-label">Team Principal</div><div class="stat-value" style="color:var(--text);">${tInfo.principal}</div></div>
            <div class="stat"><div class="stat-label">Power Unit</div><div class="stat-value" style="color:var(--text);">${tInfo.engine || 'Unknown'}</div></div>
            <div class="stat"><div class="stat-label">Total Points</div><div class="stat-value">${totalTeamPoints}</div></div>
            <div class="stat"><div class="stat-label">Wins</div><div class="stat-value">${raceWins}</div></div>
            <div class="stat"><div class="stat-label">Podiums</div><div class="stat-value">${podiums}</div></div>
            ${dnfs > 0 ? `<div class="stat"><div class="stat-label" style="color: var(--accent);">DNF</div><div class="stat-value">${dnfs}</div></div>` : ''}
            ${dnss > 0 ? `<div class="stat"><div class="stat-label" style="color: var(--text-muted);">DNS</div><div class="stat-value">${dnss}</div></div>` : ''}
            ${dsqs > 0 ? `<div class="stat"><div class="stat-label" style="color: var(--accent);">DSQ</div><div class="stat-value">${dsqs}</div></div>` : ''}
        `;

        window.renderProfileChampionship(teamName, 'team');

    } catch (e) {
        list.innerHTML = `<div class="error-msg">Could not load team profile. ${e.message}</div>`;
    }
};

window.renderProfileChampionship = async function(entityId, type) {
    const containerId = type === 'driver' ? 'profile-subtab-content-championship' : 'team-subtab-content-championship';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="loading"><div class="spinner"></div>Analyzing Championship Timeline...</div>`;

    try {
        const allYearSessions = await API.fetchJSON(`${Constants.BASE}/sessions?year=${currentYear}`);
        const raceSessions = allYearSessions.filter(s => s.session_name.toLowerCase() === 'race');
        const pastRaces = raceSessions.filter(s => new Date(s.date_start) < NOW).sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

        if (pastRaces.length === 0) {
            container.innerHTML = `<div style="padding:2rem 1rem; text-align:center; color:var(--text-dim);">Not enough data for championship battle yet.</div>`;
            return;
        }

        const latestRace = pastRaces[pastRaces.length - 1];
        const allDrivers = await API.fetchJSON(`${Constants.BASE}/drivers?session_key=${latestRace.session_key}`);
        const driverInfoMap = {};
        for (const d of allDrivers) driverInfoMap[d.driver_number] = d;
        Object.keys(Constants.HISTORICAL_DRIVERS).forEach(num => {
            if (!driverInfoMap[num]) driverInfoMap[num] = Constants.HISTORICAL_DRIVERS[num];
        });

        const timelines = await Promise.all(pastRaces.map(r => API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${r.session_key}`).catch(()=>[])));

        const labels = [];
        const posData = {};

        let entities = [];
        if (type === 'driver') {
            entities = Object.values(driverInfoMap);
        } else {
            const teamSet = new Set();
            Object.values(driverInfoMap).forEach(d => { if (d.team_name) teamSet.add(d.team_name); });
            entities = Array.from(teamSet).map(t => ({ team_name: t }));
        }

        const teamDriverMap = {};
        if (type === 'team') {
            entities.forEach(t => teamDriverMap[t.team_name] = []);
            Object.values(driverInfoMap).forEach(d => {
                const tName = d.team_name;
                if (tName) {
                    const matched = entities.find(st => st.team_name === tName || st.team_name.includes(tName) || tName.includes(st.team_name));
                    if (matched) teamDriverMap[matched.team_name].push(d.driver_number);
                }
            });
        }

        entities.forEach(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            posData[key] = [];
        });

        pastRaces.forEach((r, i) => {
            const meeting = allMeetings.find(m => m.meeting_key === r.meeting_key);
            labels.push(meeting ? meeting.circuit_short_name : `R${i+1}`);

            const data = timelines[i] || [];
            
            // Generate manual team rankings for this week just like the main view!
            let weekTeamPts = {};
            if (type === 'team') {
                entities.forEach(team => {
                    let tPts = 0;
                    const driversForTeam = teamDriverMap[team.team_name] || [];
                    driversForTeam.forEach(dn => {
                        const dObj = data.find(x => String(x.driver_number) === String(dn));
                        if (dObj) tPts += (dObj.points_current || 0);
                    });
                    weekTeamPts[team.team_name] = tPts;
                });
            }

            const teamStandingsThisWeek = type === 'team' ? entities.map(team => ({
                team_name: team.team_name,
                pts: weekTeamPts[team.team_name] || 0
            })).sort((a, b) => b.pts - a.pts) : [];

            teamStandingsThisWeek.forEach((t, idx) => t.rank = idx + 1);

            entities.forEach(e => {
                const key = type === 'driver' ? e.driver_number : e.team_name;
                
                if (type === 'driver') {
                    const obj = data.find(x => String(x.driver_number) === String(key));
                    posData[key].push(obj ? obj.position_current : null);
                } else {
                    const rankObj = teamStandingsThisWeek.find(x => String(x.team_name) === String(key));
                    posData[key].push(rankObj ? rankObj.rank : null);
                }
            });
        });

        const isLight = document.body.dataset.theme === 'light';
        const gridColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
        const tickColor = isLight ? '#222' : '#aaa';

        const datasets = [];
        const activeEntities = entities.filter(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            return posData[key].some(v => v !== null);
        });
        
        const safeId = str => str.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Grab the hierarchy globally
        const driverHierarchy = Utils.getDriverHierarchy(driverInfoMap);

        activeEntities.forEach(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            const isTarget = String(key) === String(entityId);
            const tName = type === 'driver' ? e.team_name : e.team_name;
            const tc = Utils.teamColor(tName);
            
            // Use the global hierarchy to consistently set dashes
            const isSecondary = type === 'driver' ? (driverHierarchy[e.driver_number] > 0) : false;
            const dashStyle = (isSecondary && !isTarget) ? [5, 5] : [];
            const opacity = isTarget ? 1.0 : (isLight ? 0.35 : 0.15);
            
            datasets.push({
                label: type === 'driver' ? (e.name_acronym || e.last_name || `#${key}`) : key,
                _entityKey: key,
                data: posData[key],
                borderColor: Utils.convertHexToRGBA(tc.bg, opacity),
                borderWidth: isTarget ? 5 : 2,
                borderDash: dashStyle,
                pointRadius: 0,                           
                pointHoverRadius: isTarget ? 6 : 4,
                fill: false,
                tension: 0.3,
                spanGaps: true,
                order: isTarget ? 0 : 1,
                _origColor: tc.bg,
                _origWidth: isTarget ? 5 : 2,
                _origOrder: isTarget ? 0 : 1,
                _origDash: dashStyle
            });
        });

        const chartCanvasId = `profile-champ-chart-${type}`;
        
        let legendItemsHtml = activeEntities.map(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            const isTarget = String(key) === String(entityId);
            const tName = type === 'driver' ? e.team_name : e.team_name;
            const tc = Utils.teamColor(tName);
            const acronym = type === 'driver' ? (e.name_acronym || (e.last_name ? e.last_name.substring(0,3).toUpperCase() : '???')) : Utils.getShortTeamName(key);
            const isDimmed = !isTarget;
            
            const onClick = type === 'driver' 
                ? `previousView='view-drivers'; window.openDriverProfile(${key}); setTimeout(() => window.switchProfileSubTab('championship'), 50);` 
                : `window.openTeamProfile('${String(key).replace(/'/g, "\\\\")}'); setTimeout(() => window.switchTeamSubTab('championship'), 50);`;

            return `<div id="leg-prof-champ-${safeId(String(key))}" 
                 onclick="${onClick}"
                 onmouseenter="window.highlightProfileChampLine('${type}', '${key}')"
                 onmouseleave="window.resetProfileChampLines('${type}')"
                 style="position: absolute; left: 8px; display:flex; align-items:center; gap:6px; font-family:'Barlow Condensed'; font-weight:700; font-size:0.72rem; color:var(--text); cursor:pointer; opacity:${isDimmed ? 0.3 : 1}; transition: top 0.2s, opacity 0.2s; white-space:nowrap; transform: translateY(-50%);">
                <div style="width:4px; height:12px; background:${tc.bg}; border-radius:1px;"></div>
                <div style="width:16px; display:flex; justify-content:center;">${Utils.getTeamLogoHtml(tName, '10px')}</div>
                <span>${acronym}</span>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto;">
                <div class="standings-title" style="margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
                    <span>Championship Rank Tracker</span>
                </div>
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem 1rem; margin-bottom:2.5rem; width: 100%;">
                    <div style="display: flex; gap: 0.5rem; height: 500px; width: 100%; position: relative;">
                        <div style="flex: 1; position: relative;">
                            <canvas id="${chartCanvasId}"></canvas>
                        </div>
                        <div style="width: 75px; position: relative; border-left: 1px solid var(--border);">
                            ${legendItemsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        window.highlightProfileChampLine = (pType, id) => {
            const chart = window[`profileChampChartInst_${pType}`];
            if (!chart) return;
            chart.data.datasets.forEach(ds => {
                const isTarget = String(ds._entityKey) === String(id);
                if (isTarget) {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, 1.0);
                    ds.borderWidth = 5;
                    ds.order = 0; 
                } else {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, isLight ? 0.1 : 0.05);
                    ds.borderWidth = 1.5;
                    ds.order = 1;
                }
            });
            chart.update('none'); 

            chart.data.datasets.forEach(ds => {
                const itemId = `leg-prof-champ-${safeId(String(ds._entityKey))}`;
                const item = document.getElementById(itemId);
                if (item) {
                    const isTarget = String(ds._entityKey) === String(id);
                    item.style.opacity = isTarget ? '1' : '0.2';
                }
            });
        };

        window.resetProfileChampLines = (pType) => {
            const chart = window[`profileChampChartInst_${pType}`];
            if (!chart) return;
            chart.data.datasets.forEach(ds => {
                ds.borderColor = ds._origColor;
                ds.borderWidth = ds._origWidth;
                ds.order = ds._origOrder;
            });
            chart.update('none');

            chart.data.datasets.forEach(ds => {
                const isTarget = String(ds._entityKey) === String(entityId);
                const itemId = `leg-prof-champ-${safeId(String(ds._entityKey))}`;
                const item = document.getElementById(itemId);
                if (item) item.style.opacity = isTarget ? '1' : '0.3';
            });
        };

        const legendSyncPlugin = {
            id: 'legendSync',
            afterLayout(chart) {
                const yAxis = chart.scales.y;
                chart.data.datasets.forEach(ds => {
                    const itemId = `leg-prof-champ-${safeId(String(ds._entityKey))}`;
                    const item = document.getElementById(itemId);
                    
                    let lastVal = null;
                    for (let i = ds.data.length - 1; i >= 0; i--) {
                        if (ds.data[i] !== null) { lastVal = ds.data[i]; break; }
                    }
                    
                    if (item && lastVal !== null) {
                        const yPixel = yAxis.getPixelForValue(lastVal);
                        item.style.top = `${yPixel}px`;
                        item.style.display = 'flex';
                    } else if (item) {
                        item.style.display = 'none';
                    }
                });
            }
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', axis: 'xy', intersect: false },
            onHover: (e, elements, chart) => {
                if (elements && elements.length) {
                    window.highlightProfileChampLine(type, chart.data.datasets[elements[0].datasetIndex]._entityKey);
                }
            },
            plugins: {
                legend: { display: false }, 
                tooltip: { 
                    titleFont: { family: 'Barlow Condensed', size: 14 }, 
                    bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += 'P' + context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: tickColor, font: { family: 'Barlow Condensed', weight: 600 } }, grid: { color: gridColor } },
                y: { 
                    reverse: true, min: 1, max: activeEntities.length,
                    title: { display: true, text: 'Championship Rank', color: tickColor, font: { family: 'Barlow Condensed' } }, 
                    grid: { color: gridColor }, 
                    ticks: { stepSize: 1, color: tickColor, callback: v => 'P' + v, font: { family: 'Barlow Condensed', weight: 700 } } 
                }
            }
        };

        if (window[`profileChampChartInst_${type}`]) window[`profileChampChartInst_${type}`].destroy();
        window[`profileChampChartInst_${type}`] = new Chart(document.getElementById(chartCanvasId).getContext('2d'), {
            type: 'line', data: { labels, datasets }, options: chartOptions, plugins: [legendSyncPlugin]
        });

        document.getElementById(chartCanvasId).onmouseleave = () => window.resetProfileChampLines(type);

    } catch(e) {
        console.error(e);
        container.innerHTML = `<div class="error-msg">Failed to load championship timeline: ${e.message}</div>`;
    }
};

window.renderProfileChampionship = async function(entityId, type) {
    const containerId = type === 'driver' ? 'profile-subtab-content-championship' : 'team-subtab-content-championship';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="loading"><div class="spinner"></div>Analyzing Championship Timeline...</div>`;

    try {
        const allYearSessions = await API.fetchJSON(`${Constants.BASE}/sessions?year=${currentYear}`);
        const raceSessions = allYearSessions.filter(s => s.session_name.toLowerCase() === 'race');
        const pastRaces = raceSessions.filter(s => new Date(s.date_start) < NOW).sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

        if (pastRaces.length === 0) {
            container.innerHTML = `<div style="padding:2rem 1rem; text-align:center; color:var(--text-dim);">Not enough data for championship battle yet.</div>`;
            return;
        }

        const latestRace = pastRaces[pastRaces.length - 1];
        const allDrivers = await API.fetchJSON(`${Constants.BASE}/drivers?session_key=${latestRace.session_key}`);
        const driverInfoMap = {};
        for (const d of allDrivers) driverInfoMap[d.driver_number] = d;
        Object.keys(Constants.HISTORICAL_DRIVERS).forEach(num => {
            if (!driverInfoMap[num]) driverInfoMap[num] = Constants.HISTORICAL_DRIVERS[num];
        });

        const timelines = await Promise.all(pastRaces.map(r => API.fetchJSON(`${Constants.BASE}/championship_drivers?session_key=${r.session_key}`).catch(()=>[])));

        const labels = [];
        const posData = {};

        let entities = [];
        if (type === 'driver') {
            entities = Object.values(driverInfoMap);
        } else {
            const teamSet = new Set();
            Object.values(driverInfoMap).forEach(d => { if (d.team_name) teamSet.add(d.team_name); });
            entities = Array.from(teamSet).map(t => ({ team_name: t }));
        }

        const teamDriverMap = {};
        if (type === 'team') {
            entities.forEach(t => teamDriverMap[t.team_name] = []);
            Object.values(driverInfoMap).forEach(d => {
                const tName = d.team_name;
                if (tName) {
                    const matched = entities.find(st => st.team_name === tName || st.team_name.includes(tName) || tName.includes(st.team_name));
                    if (matched) teamDriverMap[matched.team_name].push(d.driver_number);
                }
            });
        }

        entities.forEach(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            posData[key] = [];
        });

        pastRaces.forEach((r, i) => {
            const meeting = allMeetings.find(m => m.meeting_key === r.meeting_key);
            labels.push(meeting ? meeting.circuit_short_name : `R${i+1}`);

            const data = timelines[i] || [];
            
            // Generate manual team rankings for this week just like the main view!
            let weekTeamPts = {};
            if (type === 'team') {
                entities.forEach(team => {
                    let tPts = 0;
                    const driversForTeam = teamDriverMap[team.team_name] || [];
                    driversForTeam.forEach(dn => {
                        const dObj = data.find(x => String(x.driver_number) === String(dn));
                        if (dObj) tPts += (dObj.points_current || 0);
                    });
                    weekTeamPts[team.team_name] = tPts;
                });
            }

            const teamStandingsThisWeek = type === 'team' ? entities.map(team => ({
                team_name: team.team_name,
                pts: weekTeamPts[team.team_name] || 0
            })).sort((a, b) => b.pts - a.pts) : [];

            teamStandingsThisWeek.forEach((t, idx) => t.rank = idx + 1);

            entities.forEach(e => {
                const key = type === 'driver' ? e.driver_number : e.team_name;
                
                if (type === 'driver') {
                    const obj = data.find(x => String(x.driver_number) === String(key));
                    posData[key].push(obj ? obj.position_current : null);
                } else {
                    const rankObj = teamStandingsThisWeek.find(x => String(x.team_name) === String(key));
                    posData[key].push(rankObj ? rankObj.rank : null);
                }
            });
        });

        const isLight = document.body.dataset.theme === 'light';
        const gridColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
        const tickColor = isLight ? '#222' : '#aaa';

        const datasets = [];
        const activeEntities = entities.filter(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            return posData[key].some(v => v !== null);
        });
        
        const safeId = str => str.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Grab the hierarchy globally
        const driverHierarchy = Utils.getDriverHierarchy(driverInfoMap);

        activeEntities.forEach(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            const isTarget = String(key) === String(entityId);
            const tName = type === 'driver' ? e.team_name : e.team_name;
            const tc = Utils.teamColor(tName);
            
            // Use the global hierarchy to consistently set dashes
            const isSecondary = type === 'driver' ? (driverHierarchy[e.driver_number] > 0) : false;
            const dashStyle = (isSecondary && !isTarget) ? [5, 5] : [];
            const opacity = isTarget ? 1.0 : (isLight ? 0.35 : 0.15);
            
            datasets.push({
                label: type === 'driver' ? (e.name_acronym || e.last_name || `#${key}`) : key,
                _entityKey: key,
                data: posData[key],
                borderColor: Utils.convertHexToRGBA(tc.bg, opacity),
                borderWidth: isTarget ? 5 : 2,
                borderDash: dashStyle,
                pointRadius: 0,                           
                pointHoverRadius: isTarget ? 6 : 4,
                fill: false,
                tension: 0.3,
                spanGaps: true,
                order: isTarget ? 0 : 1,
                _origColor: tc.bg,
                _origWidth: isTarget ? 5 : 2,
                _origOrder: isTarget ? 0 : 1,
                _origDash: dashStyle
            });
        });

        const chartCanvasId = `profile-champ-chart-${type}`;
        
        let legendItemsHtml = activeEntities.map(e => {
            const key = type === 'driver' ? e.driver_number : e.team_name;
            const isTarget = String(key) === String(entityId);
            const tName = type === 'driver' ? e.team_name : e.team_name;
            const tc = Utils.teamColor(tName);
            const acronym = type === 'driver' ? (e.name_acronym || (e.last_name ? e.last_name.substring(0,3).toUpperCase() : '???')) : Utils.getShortTeamName(key);
            const isDimmed = !isTarget;
            
            const onClick = type === 'driver' 
                ? `previousView='view-drivers'; window.openDriverProfile(${key}); setTimeout(() => window.switchProfileSubTab('championship'), 50);` 
                : `window.openTeamProfile('${String(key).replace(/'/g, "\\\\")}'); setTimeout(() => window.switchTeamSubTab('championship'), 50);`;

            return `<div id="leg-prof-champ-${safeId(String(key))}" 
                 onclick="${onClick}"
                 onmouseenter="window.highlightProfileChampLine('${type}', '${key}')"
                 onmouseleave="window.resetProfileChampLines('${type}')"
                 style="position: absolute; left: 8px; display:flex; align-items:center; gap:6px; font-family:'Barlow Condensed'; font-weight:700; font-size:0.72rem; color:var(--text); cursor:pointer; opacity:${isDimmed ? 0.3 : 1}; transition: top 0.2s, opacity 0.2s; white-space:nowrap; transform: translateY(-50%);">
                <div style="width:4px; height:12px; background:${tc.bg}; border-radius:1px;"></div>
                <div style="width:16px; display:flex; justify-content:center;">${Utils.getTeamLogoHtml(tName, '10px')}</div>
                <span>${acronym}</span>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto;">
                <div class="standings-title" style="margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
                    <span>Championship Rank Tracker</span>
                </div>
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:1.5rem 1rem; margin-bottom:2.5rem; width: 100%;">
                    <div style="display: flex; gap: 0.5rem; height: 500px; width: 100%; position: relative;">
                        <div style="flex: 1; position: relative;">
                            <canvas id="${chartCanvasId}"></canvas>
                        </div>
                        <div style="width: 75px; position: relative; border-left: 1px solid var(--border);">
                            ${legendItemsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        window.highlightProfileChampLine = (pType, id) => {
            const chart = window[`profileChampChartInst_${pType}`];
            if (!chart) return;
            chart.data.datasets.forEach(ds => {
                const isTarget = String(ds._entityKey) === String(id);
                if (isTarget) {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, 1.0);
                    ds.borderWidth = 5;
                    ds.order = 0; 
                } else {
                    ds.borderColor = Utils.convertHexToRGBA(ds._origColor, isLight ? 0.1 : 0.05);
                    ds.borderWidth = 1.5;
                    ds.order = 1;
                }
            });
            chart.update('none'); 

            chart.data.datasets.forEach(ds => {
                const itemId = `leg-prof-champ-${safeId(String(ds._entityKey))}`;
                const item = document.getElementById(itemId);
                if (item) {
                    const isTarget = String(ds._entityKey) === String(id);
                    item.style.opacity = isTarget ? '1' : '0.2';
                }
            });
        };

        window.resetProfileChampLines = (pType) => {
            const chart = window[`profileChampChartInst_${pType}`];
            if (!chart) return;
            chart.data.datasets.forEach(ds => {
                ds.borderColor = ds._origColor;
                ds.borderWidth = ds._origWidth;
                ds.order = ds._origOrder;
            });
            chart.update('none');

            chart.data.datasets.forEach(ds => {
                const isTarget = String(ds._entityKey) === String(entityId);
                const itemId = `leg-prof-champ-${safeId(String(ds._entityKey))}`;
                const item = document.getElementById(itemId);
                if (item) item.style.opacity = isTarget ? '1' : '0.3';
            });
        };

        const legendSyncPlugin = {
            id: 'legendSync',
            afterLayout(chart) {
                const yAxis = chart.scales.y;
                chart.data.datasets.forEach(ds => {
                    const itemId = `leg-prof-champ-${safeId(String(ds._entityKey))}`;
                    const item = document.getElementById(itemId);
                    
                    let lastVal = null;
                    for (let i = ds.data.length - 1; i >= 0; i--) {
                        if (ds.data[i] !== null) { lastVal = ds.data[i]; break; }
                    }
                    
                    if (item && lastVal !== null) {
                        const yPixel = yAxis.getPixelForValue(lastVal);
                        item.style.top = `${yPixel}px`;
                        item.style.display = 'flex';
                    } else if (item) {
                        item.style.display = 'none';
                    }
                });
            }
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', axis: 'xy', intersect: false },
            onHover: (e, elements, chart) => {
                if (elements && elements.length) {
                    window.highlightProfileChampLine(type, chart.data.datasets[elements[0].datasetIndex]._entityKey);
                }
            },
            plugins: {
                legend: { display: false }, 
                tooltip: { 
                    titleFont: { family: 'Barlow Condensed', size: 14 }, 
                    bodyFont: { family: 'Barlow Condensed', size: 13, weight: 600 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += 'P' + context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: tickColor, font: { family: 'Barlow Condensed', weight: 600 } }, grid: { color: gridColor } },
                y: { 
                    reverse: true, min: 1, max: activeEntities.length,
                    title: { display: true, text: 'Championship Rank', color: tickColor, font: { family: 'Barlow Condensed' } }, 
                    grid: { color: gridColor }, 
                    ticks: { stepSize: 1, color: tickColor, callback: v => 'P' + v, font: { family: 'Barlow Condensed', weight: 700 } } 
                }
            }
        };

        if (window[`profileChampChartInst_${type}`]) window[`profileChampChartInst_${type}`].destroy();
        window[`profileChampChartInst_${type}`] = new Chart(document.getElementById(chartCanvasId).getContext('2d'), {
            type: 'line', data: { labels, datasets }, options: chartOptions, plugins: [legendSyncPlugin]
        });

        document.getElementById(chartCanvasId).onmouseleave = () => window.resetProfileChampLines(type);

    } catch(e) {
        console.error(e);
        container.innerHTML = `<div class="error-msg">Failed to load championship timeline: ${e.message}</div>`;
    }
};

startApp();