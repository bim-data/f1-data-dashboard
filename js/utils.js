// js/utils.js
import { 
    TEAM_COLORS, 
    TEAM_INFO, 
    countryToIso2, 
    DRIVER_COUNTRY_FALLBACK, 
    ENGINE_COLORS 
} from './constants.js';

// --- MATH & DATA HELPERS ---

export function convertHexToRGBA(hex, opacity) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Reusable Kernel Density Estimation for all your Violin Plots!
export function gaussianKDE(x, data, bw) {
    let sum = 0;
    for(let i = 0; i < data.length; i++){
        let v = (x - data[i]) / bw;
        sum += Math.exp(-0.5 * v * v);
    }
    return sum / (data.length * bw * Math.sqrt(2 * Math.PI));
}

// --- FORMATTERS ---

export function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtLapTime(secs) {
    if (!secs || secs <= 0) return null;
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toFixed(3).padStart(6, '0');
    return m > 0 ? `${m}:${s}` : `${s}`;
}

export function fmtSectorTime(secs) {
    if (!secs || secs <= 0) return null;
    return secs.toFixed(3);
}

export function fmtRaceTime(secs) {
    if (!secs || secs <= 0) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = (secs % 60).toFixed(3).padStart(6, '0');
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s}`;
    return `${m}:${s}`;
}

export function fmtGap(secs) {
    if (secs === null || secs === undefined) return '';
    if (secs < 0) return '+0.000'; 
    return `+${secs.toFixed(3)}`;
}

// --- UI & DOM HELPERS ---

export function getCountryCode(countryName) {
    if (!countryName) return 'un';
    const countryMap = {
      'Bahrain': 'bh', 'Saudi Arabia': 'sa', 'Australia': 'au', 'Japan': 'jp',
      'China': 'cn', 'USA': 'us', 'United States': 'us', 'Italy': 'it', 'Monaco': 'mc',
      'Canada': 'ca', 'Spain': 'es', 'Austria': 'at', 'Great Britain': 'gb', 'UK': 'gb',
      'Hungary': 'hu', 'Belgium': 'be', 'Netherlands': 'nl', 'Singapore': 'sg',
      'Azerbaijan': 'az', 'Mexico': 'mx', 'Brazil': 'br', 'Qatar': 'qa', 'UAE': 'ae', 'Abu Dhabi': 'ae'
    };
    return countryMap[countryName] || 'un';
}

export function teamColor(team) {
    for (const [k, v] of Object.entries(TEAM_COLORS)) {
      if (team && team.includes(k)) return v;
    }
    return { bg: '#444', text: '#fff' };
}

export function engineColor(eng) {
    return ENGINE_COLORS[eng] || '#888888';
}

export function getShortTeamName(teamName) {
    if (!teamName) return '';
    if (teamName.includes('Racing Bulls') || teamName === 'RB') return 'Racing Bulls';
    if (teamName.includes('Red Bull')) return 'Red Bull';
    return teamName.replace('Racing', '').replace('Team', '').trim();
}

export function getShortSessionName(name) {
    const n = (name || '').toLowerCase();
    if (n === 'practice 1') return 'FP1';
    if (n === 'practice 2') return 'FP2';
    if (n === 'practice 3') return 'FP3';
    if (n === 'qualifying') return 'Qualifying';
    if (n === 'sprint qualifying' || n === 'sprint shootout') return 'Sprint Qualifying';
    if (n === 'sprint') return 'Sprint';
    if (n === 'race') return 'Race';
    return name;
}

export function getTeamLogoHtml(teamName, height = '14px', badgeTextColor = null) {
    if (!teamName) return '';
    let tInfo = TEAM_INFO[teamName];
    if (!tInfo) {
      for (const [k, v] of Object.entries(TEAM_INFO)) {
        if (teamName.includes(k) || k.includes(teamName)) { tInfo = v; break; }
      }
    }
    if (!tInfo || !tInfo.logo) return '';
    
    let filterStyle = '';
    let logoClass = '';
    const keepOriginalColor = teamName === 'Ferrari' || teamName === 'Red Bull Racing';
    
    if (badgeTextColor && !keepOriginalColor) {
        if (badgeTextColor === '#fff') {
            filterStyle = 'filter: invert(1) brightness(2);';
        } else if (badgeTextColor === '#000') {
            filterStyle = 'filter: brightness(0);';
        }
    } else if (!badgeTextColor) {
        logoClass = tInfo.invert ? 'invert-dark' : '';
    }
    
    return `<img src="${tInfo.logo}" class="${logoClass}" style="height:${height}; width:auto; max-width:24px; object-fit:contain; vertical-align:middle; display:inline-block; ${filterStyle}">`;
}

export function getTrophyHtml(position, size = '14px', addMargin = true) {
    if (position !== 1 && position !== 2 && position !== 3) return '';
    const color = position === 1 ? 'var(--gold)' : position === 2 ? 'var(--silver)' : 'var(--bronze)';
    const margin = addMargin ? 'margin-right:6px;' : '';
    
    return `<svg style="width:${size}; height:${size}; vertical-align:text-bottom; fill:${color}; ${margin} display:inline-block;" viewBox="0 0 24 24">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
    </svg>`;
}

// --- DYNAMIC DRIVER STYLING HELPERS ---

export function getDriverHierarchy(driversArrayOrMap) {
    const teamDriverLists = {};
    const hierarchy = {};
    
    // Accept either an array of drivers or a mapped object
    const driverArray = Array.isArray(driversArrayOrMap) ? driversArrayOrMap : Object.values(driversArrayOrMap);
    
    driverArray.forEach(info => {
        if (!info || !info.driver_number) return;
        const tName = info.team_name || 'Unknown';
        if (!teamDriverLists[tName]) teamDriverLists[tName] = [];
        // Prevent duplicates
        if (!teamDriverLists[tName].includes(info.driver_number)) {
            teamDriverLists[tName].push(info.driver_number);
        }
    });

    Object.keys(teamDriverLists).forEach(tName => {
        // Sort by car number ascending so the assignment NEVER changes mid-season
        teamDriverLists[tName].sort((a, b) => a - b); 
        teamDriverLists[tName].forEach((dNum, idx) => {
            hierarchy[dNum] = idx; // 0 = Primary, 1 = Secondary, 2 = Tertiary
        });
    });
    return hierarchy;
}

export function getStripePattern(color, isLight) {
    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 12;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 12, 12);
    ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-4, 16);
    ctx.lineTo(16, -4);
    ctx.stroke();
    return ctx.createPattern(canvas, 'repeat');
}