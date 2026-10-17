// src/config/teams.ts
// The 30 NBA teams: location, name and colors, for the in-house cards.
// Color source: teamcolorcodes.com (page last updated in 2022).
// Utah: 2025-26 palette (Mountain Purple / Sky Blue), unofficial hex values.
// San Antonio: black background and silver stripe, for white text contrast.

export type Team = {
  location: string; // city or state shown small ("Golden State", "Utah"…)
  name: string;     // name shown very large
  primary: string;
  secondary: string;
};

export const TEAMS: Record<string, Team> = {
  ATL: { location: 'Atlanta',       name: 'Hawks',         primary: '#E03A3E', secondary: '#C1D32F' },
  BOS: { location: 'Boston',        name: 'Celtics',       primary: '#007A33', secondary: '#BA9653' },
  BKN: { location: 'Brooklyn',      name: 'Nets',          primary: '#000000', secondary: '#FFFFFF' },
  CHA: { location: 'Charlotte',     name: 'Hornets',       primary: '#1D1160', secondary: '#00788C' },
  CHI: { location: 'Chicago',       name: 'Bulls',         primary: '#CE1141', secondary: '#000000' },
  CLE: { location: 'Cleveland',     name: 'Cavaliers',     primary: '#860038', secondary: '#FDBB30' },
  DAL: { location: 'Dallas',        name: 'Mavericks',     primary: '#00538C', secondary: '#B8C4CA' },
  DEN: { location: 'Denver',        name: 'Nuggets',       primary: '#0E2240', secondary: '#FEC524' },
  DET: { location: 'Detroit',       name: 'Pistons',       primary: '#C8102E', secondary: '#1D428A' },
  GSW: { location: 'Golden State',  name: 'Warriors',      primary: '#1D428A', secondary: '#FFC72C' },
  HOU: { location: 'Houston',       name: 'Rockets',       primary: '#CE1141', secondary: '#000000' },
  IND: { location: 'Indiana',       name: 'Pacers',        primary: '#002D62', secondary: '#FDBB30' },
  LAC: { location: 'Los Angeles',   name: 'Clippers',      primary: '#C8102E', secondary: '#1D428A' },
  LAL: { location: 'Los Angeles',   name: 'Lakers',        primary: '#552583', secondary: '#FDB927' },
  MEM: { location: 'Memphis',       name: 'Grizzlies',     primary: '#5D76A9', secondary: '#12173F' },
  MIA: { location: 'Miami',         name: 'Heat',          primary: '#98002E', secondary: '#F9A01B' },
  MIL: { location: 'Milwaukee',     name: 'Bucks',         primary: '#00471B', secondary: '#EEE1C6' },
  MIN: { location: 'Minnesota',     name: 'Timberwolves',  primary: '#0C2340', secondary: '#78BE20' },
  NOP: { location: 'New Orleans',   name: 'Pelicans',      primary: '#0C2340', secondary: '#C8102E' },
  NYK: { location: 'New York',      name: 'Knicks',        primary: '#006BB6', secondary: '#F58426' },
  OKC: { location: 'Oklahoma City', name: 'Thunder',       primary: '#007AC1', secondary: '#EF3B24' },
  ORL: { location: 'Orlando',       name: 'Magic',         primary: '#0077C0', secondary: '#C4CED4' },
  PHI: { location: 'Philadelphia',  name: '76ers',         primary: '#006BB6', secondary: '#ED174C' },
  PHX: { location: 'Phoenix',       name: 'Suns',          primary: '#1D1160', secondary: '#E56020' },
  POR: { location: 'Portland',      name: 'Trail Blazers', primary: '#E03A3E', secondary: '#000000' },
  SAC: { location: 'Sacramento',    name: 'Kings',         primary: '#5A2D81', secondary: '#63727A' },
  SAS: { location: 'San Antonio',   name: 'Spurs',         primary: '#000000', secondary: '#C4CED4' },
  TOR: { location: 'Toronto',       name: 'Raptors',       primary: '#CE1141', secondary: '#000000' },
  UTA: { location: 'Utah',          name: 'Jazz',          primary: '#5B2B82', secondary: '#6CAEDF' },
  WAS: { location: 'Washington',    name: 'Wizards',       primary: '#002B5C', secondary: '#E31837' },
};

// Readable text color (black or white) on a given background,
// based on WCAG relative luminance. Not used by the cards (white everywhere),
// kept for any future element drawn on a team color.
export function readableTextOn(hex: string): '#000000' | '#FFFFFF' {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [channel(1), channel(3), channel(5)];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}
