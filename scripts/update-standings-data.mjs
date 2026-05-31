import { mkdir, writeFile } from 'node:fs/promises';

const DATA_DIR = 'data';
const updatedAt = new Date().toISOString();
const API_KEY = process.env.APIFOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || '';
const FOOTBALLDATA_KEY = process.env.FOOTBALLDATA_KEY || process.env.FOOTBALL_DATA_KEY || '';
const requestedSeason = process.env.FOOTBALL_SEASON || '2025';
const seasons = [requestedSeason];

const leagues = [
  {
    id: 'super-lig',
    name: 'Süper Lig',
    apiFootballId: 203,
    sportsDbId: '4339',
    footballDataCodes: ['TSL', 'TUR'],
    wikipediaTitle: '2025–26 Süper Lig',
    sportsDbSeasons: ['2025-2026', '2025-26', '2026'],
    htmlSources: [
      'https://skorlar.com',
      'https://www.skorlar.com',
      'https://www.skorlar.com/futbol/turkiye/super-lig/puan-durumu',
      'https://www.skorlar.com/futbol/turkiye/super-lig',
      'https://www.mackolik.com/puan-durumu/t%C3%BCrkiye-s%C3%BCper-lig/482ofyysbdbeoxauk19yg7tdt',
    ],
  },
  { id: 'premier-league', name: 'Premier League', apiFootballId: 39, sportsDbId: '4328', footballDataCodes: ['PL'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'la-liga', name: 'La Liga', apiFootballId: 140, sportsDbId: '4335', footballDataCodes: ['PD'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'bundesliga', name: 'Bundesliga', apiFootballId: 78, sportsDbId: '4331', footballDataCodes: ['BL1'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'serie-a', name: 'Serie A', apiFootballId: 135, sportsDbId: '4332', footballDataCodes: ['SA'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'ligue-1', name: 'Ligue 1', apiFootballId: 61, sportsDbId: '4334', footballDataCodes: ['FL1'], sportsDbSeasons: ['2025-2026', '2025-26', '2026'] },
];

const validationTeams = ['Galatasaray', 'Fenerbahçe', 'Fenerbahce', 'Beşiktaş', 'Besiktas', 'Trabzonspor'];

function normalizeApiFootballRow(row) {
  const all = row?.all || {};
  return { position: Number(row?.rank || 0), team: String(row?.team?.name || 'Takım'), played: Number(all.played || 0), won: Number(all.win || 0), draw: Number(all.draw || 0), lost: Number(all.lose || 0), points: Number(row?.points || 0), goalDifference: Number(row?.goalsDiff || 0) };
}

function normalizeFootballDataRow(row) {
  return { position: Number(row?.position || 0), team: String(row?.team?.shortName || row?.team?.name || 'Takım'), played: Number(row?.playedGames || 0), won: Number(row?.won || 0), draw: Number(row?.draw || 0), lost: Number(row?.lost || 0), points: Number(row?.points || 0), goalDifference: Number(row?.goalDifference || 0) };
}

function normalizeSportsDbRow(row, index) {
  return { position: Number(row.intRank || row.rank || index + 1), team: String(row.strTeam || row.team || 'Takım'), played: Number(row.intPlayed || row.played || 0), won: Number(row.intWin || row.won || 0), draw: Number(row.intDraw || row.draw || 0), lost: Number(row.intLoss || row.loss || 0), points: Number(row.intPoints || row.points || 0), goalDifference: Number(row.intGoalDifference || row.goalDifference || 0) };
}

function decodeEntities(value) {
  return String(value || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#160;/g, ' ').replace(/&#8722;/g, '-').replace(/&#x2212;/g, '-').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value) {
  return decodeEntities(String(value || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/<[^>]+>/g, ' ').replace(/−/g, '-').replace(/\s+/g, ' ').trim());
}

function parseNumber(value) {
  const match = String(value || '').replace(/−/g, '-').match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function cleanTeam(value) {
  const cleaned = stripHtml(value).replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ');
  const half = words.length / 2;
  if (words.length % 2 === 0 && words.slice(0, half).join(' ') === words.slice(half).join(' ')) return words.slice(0, half).join(' ');
  return cleaned;
}

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractHtmlTables(html) { return html.match(/<table[\s\S]*?<\/table>/gi) || []; }
function parseHtmlTable(tableHtml) { return (tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || []).map((row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripHtml(match[1])).filter(Boolean)).filter((row) => row.length >= 4); }

function buildRowFromNumbers(position, team, numbers) {
  const played = numbers[0] || 0;
  const points = numbers[numbers.length - 1] || 0;
  let bestTriplet = null;

  for (let i = 1; i <= numbers.length - 4; i += 1) {
    const won = numbers[i];
    const draw = numbers[i + 1];
    const lost = numbers[i + 2];
    if (won >= 0 && draw >= 0 && lost >= 0 && won + draw + lost === played) {
      bestTriplet = { index: i, won, draw, lost };
      break;
    }
  }

  if (bestTriplet) {
    const beforeTriplet = numbers.slice(1, bestTriplet.index);
    const afterTriplet = numbers.slice(bestTriplet.index + 3, -1);
    const goalDifference = beforeTriplet.length ? beforeTriplet[beforeTriplet.length - 1] : afterTriplet.length ? afterTriplet[0] : 0;
    return { position, team, played, won: bestTriplet.won, draw: bestTriplet.draw, lost: bestTriplet.lost, points, goalDifference };
  }

  return { position, team, played, won: numbers[1] || 0, draw: numbers[2] || 0, lost: numbers[3] || 0, points, goalDifference: numbers[numbers.length - 2] || 0 };
}

function tableToStandingsRows(rawRows) {
  const headerIndex = rawRows.findIndex((row) => { const joined = normalizeText(row.join(' ')); return (joined.includes('takim') || joined.includes('team')) && (joined.includes('puan') || joined.includes('pts') || joined.includes(' p ')); });
  const header = headerIndex >= 0 ? rawRows[headerIndex].map(normalizeText) : [];
  const body = headerIndex >= 0 ? rawRows.slice(headerIndex + 1) : rawRows;

  function findIndex(candidates, fallback) { const index = header.findIndex((item) => candidates.some((candidate) => item === candidate || item.includes(candidate))); return index >= 0 ? index : fallback; }

  const teamIndex = findIndex(['takim', 'team', 'kulup', 'club'], 1);
  const playedIndex = findIndex(['o', 'played', 'mac'], 2);
  const wonIndex = findIndex(['g', 'won', 'galibiyet'], 3);
  const drawIndex = findIndex(['b', 'draw', 'beraberlik'], 4);
  const lostIndex = findIndex(['m', 'lost', 'maglubiyet'], 5);
  const gdIndex = findIndex(['av', 'gd', 'goal difference'], Math.max(body[0]?.length - 2 || 6, 6));
  const pointsIndex = findIndex(['p', 'pts', 'puan', 'points'], Math.max(body[0]?.length - 1 || 7, 7));

  return body.map((cells, index) => {
    const position = parseNumber(cells[0]) || index + 1;
    const team = cleanTeam(cells[teamIndex] || '');
    const played = parseNumber(cells[playedIndex]);
    const won = parseNumber(cells[wonIndex]);
    const draw = parseNumber(cells[drawIndex]);
    const lost = parseNumber(cells[lostIndex]);
    const points = parseNumber(cells[pointsIndex]);
    const goalDifference = parseNumber(cells[gdIndex]);
    const headerMapped = { position, team, played, won, draw, lost, points, goalDifference };
    if (played > 0 && won >= 0 && draw >= 0 && lost >= 0 && won + draw + lost === played) return headerMapped;
    const numbers = cells.slice(teamIndex + 1).map(parseNumber).filter((value) => Number.isFinite(value));
    return buildRowFromNumbers(position, team, numbers);
  }).filter((row) => row.team && row.played > 0 && row.points >= 0 && row.won >= 0 && row.draw >= 0 && row.lost >= 0 && row.won + row.draw + row.lost === row.played);
}

function validateCurrentStandings(table) {
  if (!Array.isArray(table) || table.length < 10) return false;
  const teams = table.map((row) => normalizeText(row.team)).join(' ');
  const hasKnownTeam = validationTeams.some((team) => teams.includes(normalizeText(team)));
  const hasRealMatches = table.some((row) => row.played > 0 && row.points > 0 && row.won + row.draw + row.lost === row.played);
  return hasKnownTeam && hasRealMatches;
}

async function fetchHtmlScrapeStandings(league) {
  const sources = league.htmlSources || [];
  if (!sources.length) throw new Error('no html scraping source');
  const errors = [];
  for (const url of sources) {
    try {
      const html = await fetchText(url);
      const tables = extractHtmlTables(html);
      for (const tableHtml of tables) {
        const rawRows = parseHtmlTable(tableHtml);
        const table = tableToStandingsRows(rawRows);
        if (validateCurrentStandings(table)) return { source: `HTML scrape ${url}`, table };
      }
      errors.push(`${url}: no valid standings table`);
    } catch (error) { errors.push(`${url}: ${error instanceof Error ? error.message : 'unknown error'}`); }
  }
  throw new Error(errors.join(' | '));
}

async function fetchFootballDataStandings(league) {
  if (!FOOTBALLDATA_KEY) throw new Error('FOOTBALLDATA_KEY missing');
  const errors = [];
  for (const code of league.footballDataCodes || []) {
    try {
      const payload = await fetchJson(`https://api.football-data.org/v4/competitions/${encodeURIComponent(code)}/standings`, { headers: { 'X-Auth-Token': FOOTBALLDATA_KEY } });
      const total = payload?.standings?.find((standing) => standing.type === 'TOTAL') || payload?.standings?.[0];
      const rows = total?.table || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error(`empty table code ${code}`);
      return { source: `football-data.org ${code}`, table: rows.map(normalizeFootballDataRow) };
    } catch (error) { errors.push(`${code}: ${error instanceof Error ? error.message : 'unknown error'}`); }
  }
  throw new Error(errors.join(' | '));
}

async function fetchWikipediaStandings(league) {
  if (!league.wikipediaTitle) throw new Error('no wikipedia source');
  const html = await fetchText(`https://en.wikipedia.org/wiki/${encodeURIComponent(league.wikipediaTitle).replace(/%20/g, '_')}`);
  const tables = extractHtmlTables(html);
  const table = tables.find((item) => item.includes('Galatasaray') && item.includes('Fener') && /Pts|points|Puan/i.test(item));
  if (!table) throw new Error('wikipedia standings table not found');
  const rawRows = parseHtmlTable(table);
  const rows = tableToStandingsRows(rawRows);
  if (!validateCurrentStandings(rows)) throw new Error(`wikipedia parsed invalid rows: ${rows.length}`);
  return { source: `Wikipedia ${league.wikipediaTitle}`, table: rows };
}

async function fetchApiFootballStandings(league) {
  if (!API_KEY) throw new Error('APIFOOTBALL_API_KEY missing');
  const errors = [];
  for (const season of seasons) {
    try {
      const payload = await fetchJson(`https://v3.football.api-sports.io/standings?league=${league.apiFootballId}&season=${season}`, { headers: { 'x-apisports-key': API_KEY } });
      const apiErrors = payload?.errors && Object.keys(payload.errors).length ? JSON.stringify(payload.errors) : '';
      const rows = payload?.response?.[0]?.league?.standings?.[0] || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error(apiErrors || `empty table season ${season}`);
      return { source: `API-FOOTBALL ${season}`, table: rows.map(normalizeApiFootballRow) };
    } catch (error) { errors.push(error instanceof Error ? error.message : 'unknown error'); }
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
      if (!validateCurrentStandings(table)) throw new Error(`incomplete table ${season}: ${table.length} rows`);
      return { source: `TheSportsDB ${season}`, table };
    } catch (error) { errors.push(error instanceof Error ? error.message : 'unknown error'); }
  }
  throw new Error(errors.join(' | '));
}

async function fetchStandings(league) {
  const errors = [];
  try { const result = await fetchHtmlScrapeStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: '' }; } catch (error) { errors.push(`HTML scrape: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchFootballDataStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`football-data.org: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchWikipediaStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`Wikipedia: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchApiFootballStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`API-FOOTBALL: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchSportsDbStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`TheSportsDB: ${error instanceof Error ? error.message : 'unknown error'}`); }
  return { id: league.id, name: league.name, updatedAt, source: 'none', table: [], fixtures: [], results: [], status: errors.join(' | ') };
}

await mkdir(DATA_DIR, { recursive: true });
const leaguePayloads = await Promise.all(leagues.map(fetchStandings));
const defaultLeague = leaguePayloads[0];
await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({ updatedAt, source: 'HTML scrape/football-data.org/Wikipedia/API-FOOTBALL/TheSportsDB', defaultLeagueId: 'super-lig', leagues: leaguePayloads, competition: defaultLeague?.name || 'Süper Lig', table: defaultLeague?.table || [], fixtures: defaultLeague?.fixtures || [], results: defaultLeague?.results || [] }, null, 2) + '\n', 'utf8');
