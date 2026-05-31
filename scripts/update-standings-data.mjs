import { mkdir, writeFile } from 'node:fs/promises';

const DATA_DIR = 'data';
const updatedAt = new Date().toISOString();
const API_KEY = process.env.APIFOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || '';
const SEASON = process.env.FOOTBALL_SEASON || '2025';

const leagues = [
  { id: 'super-lig', name: 'Süper Lig', apiFootballId: 203 },
  { id: 'premier-league', name: 'Premier League', apiFootballId: 39 },
  { id: 'la-liga', name: 'La Liga', apiFootballId: 140 },
  { id: 'bundesliga', name: 'Bundesliga', apiFootballId: 78 },
  { id: 'serie-a', name: 'Serie A', apiFootballId: 135 },
  { id: 'ligue-1', name: 'Ligue 1', apiFootballId: 61 },
];

function normalizeStanding(row) {
  const all = row?.all || {};
  return {
    position: Number(row?.rank || 0),
    team: String(row?.team?.name || 'Takım'),
    played: Number(all.played || 0),
    won: Number(all.win || 0),
    draw: Number(all.draw || 0),
    lost: Number(all.lose || 0),
    points: Number(row?.points || 0),
    goalDifference: Number(row?.goalsDiff || 0),
  };
}

async function fetchJson(path) {
  if (!API_KEY) throw new Error('APIFOOTBALL_API_KEY missing');
  const response = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!response.ok) throw new Error(`API-FOOTBALL HTTP ${response.status}`);
  return response.json();
}

async function fetchStandings(league) {
  try {
    const payload = await fetchJson(`/standings?league=${league.apiFootballId}&season=${SEASON}`);
    const rows = payload?.response?.[0]?.league?.standings?.[0] || [];
    if (!Array.isArray(rows) || !rows.length) throw new Error('empty table');
    return {
      id: league.id,
      name: league.name,
      updatedAt,
      source: 'API-FOOTBALL',
      table: rows.map(normalizeStanding).filter((row) => row.team && row.played > 0),
      fixtures: [],
      results: [],
      status: '',
    };
  } catch (error) {
    return {
      id: league.id,
      name: league.name,
      updatedAt,
      source: 'API-FOOTBALL',
      table: [],
      fixtures: [],
      results: [],
      status: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

await mkdir(DATA_DIR, { recursive: true });
const leaguePayloads = await Promise.all(leagues.map(fetchStandings));
const defaultLeague = leaguePayloads[0];

await writeFile(
  `${DATA_DIR}/standings.json`,
  JSON.stringify({
    updatedAt,
    source: 'API-FOOTBALL',
    defaultLeagueId: 'super-lig',
    leagues: leaguePayloads,
    competition: defaultLeague?.name || 'Süper Lig',
    table: defaultLeague?.table || [],
    fixtures: defaultLeague?.fixtures || [],
    results: defaultLeague?.results || [],
  }, null, 2) + '\n',
  'utf8',
);
