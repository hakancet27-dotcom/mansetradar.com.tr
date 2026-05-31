import { mkdir, writeFile } from 'node:fs/promises';

const DATA_DIR = 'data';
const updatedAt = new Date().toISOString();
const API_KEY = process.env.APIFOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || '';
const requestedSeason = process.env.FOOTBALL_SEASON || '';
const seasons = requestedSeason ? [requestedSeason] : ['2026', '2025', '2024', '2023'];

const leagues = [
  { id: 'super-lig', name: 'Süper Lig', apiFootballId: 203, sportsDbId: '4339', sportsDbSeasons: ['2025-2026', '2025-26', '2026', '2024-2025'] },
  { id: 'premier-league', name: 'Premier League', apiFootballId: 39, sportsDbId: '4328', sportsDbSeasons: ['2025-2026', '2025-26', '2026', '2024-2025'] },
  { id: 'la-liga', name: 'La Liga', apiFootballId: 140, sportsDbId: '4335', sportsDbSeasons: ['2025-2026', '2025-26', '2026', '2024-2025'] },
  { id: 'bundesliga', name: 'Bundesliga', apiFootballId: 78, sportsDbId: '4331', sportsDbSeasons: ['2025-2026', '2025-26', '2026', '2024-2025'] },
  { id: 'serie-a', name: 'Serie A', apiFootballId: 135, sportsDbId: '4332', sportsDbSeasons: ['2025-2026', '2025-26', '2026', '2024-2025'] },
  { id: 'ligue-1', name: 'Ligue 1', apiFootballId: 61, sportsDbId: '4334', sportsDbSeasons: ['2025-2026', '2025-26', '2026', '2024-2025'] },
];

function normalizeApiFootballRow(row) {
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

function normalizeSportsDbRow(row, index) {
  return {
    position: Number(row.intRank || row.rank || index + 1),
    team: String(row.strTeam || row.team || 'Takım'),
    played: Number(row.intPlayed || row.played || 0),
    won: Number(row.intWin || row.won || 0),
    draw: Number(row.intDraw || row.draw || 0),
    lost: Number(row.intLoss || row.loss || 0),
    points: Number(row.intPoints || row.points || 0),
    goalDifference: Number(row.intGoalDifference || row.goalDifference || 0),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchApiFootballStandings(league) {
  if (!API_KEY) throw new Error('APIFOOTBALL_API_KEY missing');
  const errors = [];

  for (const season of seasons) {
    try {
      const payload = await fetchJson(`https://v3.football.api-sports.io/standings?league=${league.apiFootballId}&season=${season}`, {
        headers: { 'x-apisports-key': API_KEY },
      });
      const apiErrors = payload?.errors && Object.keys(payload.errors).length ? JSON.stringify(payload.errors) : '';
      const rows = payload?.response?.[0]?.league?.standings?.[0] || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error(apiErrors || `empty table season ${season}`);
      return { source: `API-FOOTBALL ${season}`, table: rows.map(normalizeApiFootballRow) };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'unknown error');
    }
  }

  throw new Error(errors.join(' | '));
}

async function fetchSportsDbStandings(league) {
  const errors = [];
  for (const season of league.sportsDbSeasons) {
    try {
      const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${league.sportsDbId}&s=${encodeURIComponent(season)}`);
      const rows = payload?.table || payload?.standings || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error(`empty table ${season}`);
      return { source: `TheSportsDB ${season}`, table: rows.map(normalizeSportsDbRow) };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'unknown error');
    }
  }
  throw new Error(errors.join(' | '));
}

async function fetchStandings(league) {
  const errors = [];
  try {
    const result = await fetchApiFootballStandings(league);
    return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: '' };
  } catch (error) {
    errors.push(`API-FOOTBALL: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  try {
    const result = await fetchSportsDbStandings(league);
    return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') };
  } catch (error) {
    errors.push(`TheSportsDB: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  return { id: league.id, name: league.name, updatedAt, source: 'none', table: [], fixtures: [], results: [], status: errors.join(' | ') };
}

await mkdir(DATA_DIR, { recursive: true });
const leaguePayloads = await Promise.all(leagues.map(fetchStandings));
const defaultLeague = leaguePayloads[0];

await writeFile(
  `${DATA_DIR}/standings.json`,
  JSON.stringify({
    updatedAt,
    source: 'API-FOOTBALL/TheSportsDB',
    defaultLeagueId: 'super-lig',
    leagues: leaguePayloads,
    competition: defaultLeague?.name || 'Süper Lig',
    table: defaultLeague?.table || [],
    fixtures: defaultLeague?.fixtures || [],
    results: defaultLeague?.results || [],
  }, null, 2) + '\n',
  'utf8',
);
