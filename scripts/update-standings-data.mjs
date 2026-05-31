import { mkdir, writeFile } from 'node:fs/promises';

const DATA_DIR = 'data';
const updatedAt = new Date().toISOString();
const API_KEY = process.env.APIFOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || '';
const FOOTBALLDATA_KEY = process.env.FOOTBALLDATA_KEY || process.env.FOOTBALL_DATA_KEY || '';
const requestedSeason = process.env.FOOTBALL_SEASON || '2025';
const seasons = [requestedSeason];

const leagues = [
  { id: 'super-lig', name: 'Süper Lig', apiFootballId: 203, sportsDbId: '4339', footballDataCodes: ['TSL', 'TUR'], wikipediaTitle: '2025–26 Süper Lig', sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'premier-league', name: 'Premier League', apiFootballId: 39, sportsDbId: '4328', footballDataCodes: ['PL'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'la-liga', name: 'La Liga', apiFootballId: 140, sportsDbId: '4335', footballDataCodes: ['PD'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'bundesliga', name: 'Bundesliga', apiFootballId: 78, sportsDbId: '4331', footballDataCodes: ['BL1'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'serie-a', name: 'Serie A', apiFootballId: 135, sportsDbId: '4332', footballDataCodes: ['SA'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'ligue-1', name: 'Ligue 1', apiFootballId: 61, sportsDbId: '4334', footballDataCodes: ['FL1'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
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

function normalizeFootballDataRow(row) {
  return {
    position: Number(row?.position || 0),
    team: String(row?.team?.shortName || row?.team?.name || 'Takım'),
    played: Number(row?.playedGames || 0),
    won: Number(row?.won || 0),
    draw: Number(row?.draw || 0),
    lost: Number(row?.lost || 0),
    points: Number(row?.points || 0),
    goalDifference: Number(row?.goalDifference || 0),
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

function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#160;/g, ' ')
    .replace(/&#8722;/g, '-')
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value) {
  const match = String(value || '').replace(/−/g, '-').match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function cleanTeam(value) {
  return stripHtml(value)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchFootballDataStandings(league) {
  if (!FOOTBALLDATA_KEY) throw new Error('FOOTBALLDATA_KEY missing');
  const errors = [];

  for (const code of league.footballDataCodes || []) {
    try {
      const payload = await fetchJson(`https://api.football-data.org/v4/competitions/${encodeURIComponent(code)}/standings`, {
        headers: { 'X-Auth-Token': FOOTBALLDATA_KEY },
      });
      const total = payload?.standings?.find((standing) => standing.type === 'TOTAL') || payload?.standings?.[0];
      const rows = total?.table || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error(`empty table code ${code}`);
      return { source: `football-data.org ${code}`, table: rows.map(normalizeFootballDataRow) };
    } catch (error) {
      errors.push(`${code}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  throw new Error(errors.join(' | '));
}

async function fetchWikipediaStandings(league) {
  if (!league.wikipediaTitle) throw new Error('no wikipedia source');
  const html = await fetchText(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(league.wikipediaTitle)}`);
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const table = tables.find((item) => item.includes('Galatasaray') && item.includes('Fener') && /Pts|points/i.test(item));
  if (!table) throw new Error('wikipedia standings table not found');

  const rows = [];
  const rowMatches = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rowMatches) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 10) continue;
    const position = parseNumber(cells[0]);
    const played = parseNumber(cells[2]);
    const points = parseNumber(cells[9]);
    if (!position || !played || !points) continue;
    rows.push({
      position,
      team: cleanTeam(cells[1]),
      played,
      won: parseNumber(cells[3]),
      draw: parseNumber(cells[4]),
      lost: parseNumber(cells[5]),
      points,
      goalDifference: parseNumber(cells[8]),
    });
  }

  if (rows.length < 10) throw new Error(`wikipedia parsed only ${rows.length} rows`);
  return { source: `Wikipedia ${league.wikipediaTitle}`, table: rows };
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
      const table = rows.map(normalizeSportsDbRow);
      if (table.length < 10) throw new Error(`incomplete table ${season}: ${table.length} rows`);
      return { source: `TheSportsDB ${season}`, table };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'unknown error');
    }
  }
  throw new Error(errors.join(' | '));
}

async function fetchStandings(league) {
  const errors = [];
  try {
    const result = await fetchFootballDataStandings(league);
    return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: '' };
  } catch (error) {
    errors.push(`football-data.org: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  try {
    const result = await fetchWikipediaStandings(league);
    return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') };
  } catch (error) {
    errors.push(`Wikipedia: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  try {
    const result = await fetchApiFootballStandings(league);
    return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') };
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
    source: 'football-data.org/Wikipedia/API-FOOTBALL/TheSportsDB',
    defaultLeagueId: 'super-lig',
    leagues: leaguePayloads,
    competition: defaultLeague?.name || 'Süper Lig',
    table: defaultLeague?.table || [],
    fixtures: defaultLeague?.fixtures || [],
    results: defaultLeague?.results || [],
  }, null, 2) + '\n',
  'utf8',
);
