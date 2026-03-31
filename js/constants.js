// js/constants.js

export const BASE = 'https://api.openf1.org/v1';

export const countryToIso2 = {
  'GBR': 'gb', 'NED': 'nl', 'MEX': 'mx', 'ESP': 'es', 'MON': 'mc',
  'FRA': 'fr', 'AUS': 'au', 'CAN': 'ca', 'JPN': 'jp', 'CHN': 'cn',
  'USA': 'us', 'FIN': 'fi', 'DEN': 'dk', 'GER': 'de', 'THA': 'th',
  'NZL': 'nz', 'ARG': 'ar', 'BRA': 'br', 'ITA': 'it', 'CHE': 'ch',
  'BEL': 'be', 'AUT': 'at'
};

export const DRIVER_COUNTRY_FALLBACK = {
  'VER': 'NED', 'PER': 'MEX', 'HAM': 'GBR', 'RUS': 'GBR',
  'LEC': 'MON', 'SAI': 'ESP', 'NOR': 'GBR', 'PIA': 'AUS',
  'ALO': 'ESP', 'STR': 'CAN', 'GAS': 'FRA', 'OCO': 'FRA',
  'ALB': 'THA', 'COL': 'ARG', 'TSU': 'JPN', 'LAW': 'NZL',
  'HUL': 'GER', 'MAG': 'DEN', 'BOT': 'FIN', 'ZHO': 'CHN',
  'BEA': 'GBR', 'ANT': 'ITA', 'DOO': 'AUS', 'BOR': 'BRA',
  'RIC': 'AUS', 'SAR': 'USA', 'HAD': 'FRA'
};

export const TEAM_COLORS = {
  'Red Bull Racing': { bg: '#3671C6', text: '#fff' },
  'Ferrari': { bg: '#E8002D', text: '#fff' },
  'Mercedes': { bg: '#27F4D2', text: '#000' },
  'McLaren': { bg: '#FF8000', text: '#000' },
  'Aston Martin': { bg: '#229971', text: '#fff' },
  'Alpine': { bg: '#0093CC', text: '#fff' },
  'Williams': { bg: '#64C4FF', text: '#000' },
  'RB': { bg: '#6692FF', text: '#fff' },
  'Racing Bulls': { bg: '#6692FF', text: '#fff' }, 
  'Kick Sauber': { bg: '#52E252', text: '#000' },
  'Haas': { bg: '#B6BABD', text: '#000' },
};

export const TEAM_INFO = {
  'Red Bull Racing': { full: 'Oracle Red Bull Racing', principal: 'Laurent Mekies', base: 'Milton Keynes, United Kingdom', engine: 'RBPT / Ford', logo: './assets/logos/red-bull-racing.png' },
  'Ferrari': { full: 'Scuderia Ferrari', principal: 'Frédéric Vasseur', base: 'Maranello, Italy', engine: 'Ferrari', logo: './assets/logos/Ferrari-Scuderia-Logo.png' },
  'Mercedes': { full: 'Mercedes-AMG PETRONAS F1 Team', principal: 'Toto Wolff', base: 'Brackley, United Kingdom', engine: 'Mercedes', logo: './assets/logos/Mercedes.svg' },
  'McLaren': { full: 'McLaren Formula 1 Team', principal: 'Andrea Stella', base: 'Woking, United Kingdom', engine: 'Mercedes', logo: './assets/logos/mclaren.png', invert: true },
  'Aston Martin': { full: 'Aston Martin Aramco F1 Team', principal: 'Adrian Newey', base: 'Silverstone, United Kingdom', engine: 'Honda', logo: './assets/logos/aston-martin.png', invert: true },
  'Alpine': { full: 'BWT Alpine F1 Team', principal: 'Oliver Oakes', base: 'Enstone, United Kingdom', engine: 'Mercedes', logo: './assets/logos/apline.png', invert: true },
  'Williams': { full: 'Williams Racing', principal: 'James Vowles', base: 'Grove, United Kingdom', engine: 'Mercedes', logo: './assets/logos/williams.png' },
  'RB': { full: 'Visa Cash App RB F1 Team', principal: 'Alan Permane', base: 'Faenza, Italy', engine: 'RBPT / Ford', logo: './assets/logos/Visa-Cash-App-RB-logo.png', invert: true },
  'Racing Bulls': { full: 'Visa Cash App RB F1 Team', principal: 'Alan Permane', base: 'Faenza, Italy', engine: 'RBPT / Ford', logo: './assets/logos/Visa-Cash-App-RB-logo.png', invert: true },
  'Kick Sauber': { full: 'Stake F1 Team Kick Sauber', principal: 'Mattia Binotto', base: 'Hinwil, Switzerland', engine: 'Ferrari', logo: './assets/logos/kick.png' },
  'Haas': { full: 'MoneyGram Haas F1 Team', principal: 'Ayao Komatsu', base: 'Kannapolis, United States', engine: 'Ferrari', logo: './assets/logos/haas-f1-team.svg' },
  'Audi': { full: 'Audi F1 Team', principal: 'Mattia Binotto', base: 'Neuburg, Germany', engine: 'Audi', logo: './assets/logos/Audi.svg', invert: true },
  'Cadillac': { full: 'Cadillac F1 Team', principal: 'Graeme Lowdon', base: 'Fishers, United States', engine: 'Ferrari', logo: './assets/logos/Cadillac-Logo.png', invert: true }
};

export const CIRCUIT_FULL_NAMES = {
  'Sakhir': 'Bahrain International Circuit',
  'Jeddah': 'Jeddah Corniche Circuit',
  'Melbourne': 'Albert Park Circuit',
  'Suzuka': 'Suzuka International Racing Course',
  'Shanghai': 'Shanghai International Circuit',
  'Miami': 'Miami International Autodrome',
  'Imola': 'Autodromo Enzo e Dino Ferrari',
  'Monaco': 'Circuit de Monaco',
  'Montréal': 'Circuit Gilles-Villeneuve',
  'Barcelona': 'Circuit de Barcelona-Catalunya',
  'Spielberg': 'Red Bull Ring',
  'Silverstone': 'Silverstone Circuit',
  'Budapest': 'Hungaroring',
  'Spa-Francorchamps': 'Circuit de Spa-Francorchamps',
  'Zandvoort': 'Circuit Zandvoort',
  'Monza': 'Autodromo Nazionale Monza',
  'Baku': 'Baku City Circuit',
  'Singapore': 'Marina Bay Street Circuit',
  'Austin': 'Circuit of The Americas',
  'Mexico City': 'Autódromo Hermanos Rodríguez',
  'São Paulo': 'Autódromo José Carlos Pace (Interlagos)',
  'Las Vegas': 'Las Vegas Strip Circuit',
  'Lusail': 'Lusail International Circuit',
  'Yas Island': 'Yas Marina Circuit',
  'Madrid': 'Circuito de Madrid'
};

export const ENGINE_COLORS = {
  'Mercedes': '#27F4D2',
  'Ferrari':  '#E8002D',
  'Honda':    '#E5C600',
  'RBPT / Ford': '#3671C6',
  'Audi':     '#555555',
};