import { mkdir, readFile, writeFile } from 'node:fs/promises';

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
    mackolikArchiveId: 1,
    footballDataCodes: ['TSL', 'TUR'],
    wikipediaTitle: '2025–26 Süper Lig',
    sportsDbSeasons: ['2025-2026', '2025-26', '2026'],
    validationTeams: ['Galatasaray', 'Fenerbahçe', 'Fenerbahce', 'Beşiktaş', 'Besiktas', 'Trabzonspor'],
    htmlSources: [
      'https://www.mackolik.com/puan-durumu/t%C3%BCrkiye-s%C3%BCper-lig/482ofyysbdbeoxauk19yg7tdt',
      'https://www.skorlar.com/futbol/turkiye/super-lig/puan-durumu',
      'https://www.skorlar.com/futbol/turkiye/super-lig',
      'https://www.skorlar.com',
      'https://skorlar.com',
    ],
  },
  {
    id: 'premier-league',
    name: 'Premier League',
    apiFootballId: 39,
    sportsDbId: '4328',
    mackolikArchiveId: 24,
    footballDataCodes: ['PL'],
    wikipediaTitle: '2025–26 Premier League',
    sportsDbSeasons: ['2025-2026', '2025-26', '2026'],
    validationTeams: ['Liverpool', 'Arsenal', 'Manchester City', 'Chelsea', 'Tottenham'],
    htmlSources: [
      'https://www.mackolik.com/puan-durumu/ingiltere-premier-lig/2kwbbcootiqqgmrzs6o5inle5',
      'https://www.mackolik.com/puan-durumu/ingiltere-premier-league/2kwbbcootiqqgmrzs6o5inle5',
    ],
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    apiFootballId: 140,
    sportsDbId: '4335',
    mackolikArchiveId: 20,
    footballDataCodes: ['PD'],
    wikipediaTitle: '2025–26 La Liga',
    sportsDbSeasons: ['2025-2026', '2025-26', '2026'],
    validationTeams: ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Atlético Madrid', 'Villarreal'],
    htmlSources: ['https://www.mackolik.com/puan-durumu/ispanya-la-liga/34pl8szyvrbwcmfkuocjm3r6t'],
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    apiFootballId: 78,
    sportsDbId: '4331',
    mackolikArchiveId: 3,
    footballDataCodes: ['BL1'],
    wikipediaTitle: '2025–26 Bundesliga',
    sportsDbSeasons: ['2025-2026', '2025-26', '2026'],
    validationTeams: ['Bayern Munich', 'Bayern Münih', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 'Eintracht Frankfurt'],
    htmlSources: ['https://www.mackolik.com/puan-durumu/almanya-bundesliga/6by3h89i2eykc341oz7lv1ddd'],
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    apiFootballId: 135,
    sportsDbId: '4332',
    mackolikArchiveId: 15,
    footballDataCodes: ['SA'],
    wikipediaTitle: '2025–26 Serie A',
    sportsDbSeasons: ['2025-2026', '2025-26', '2026'],
    validationTeams: ['Inter Milan', 'Inter', 'Juventus', 'Milan', 'Napoli', 'Roma'],
    htmlSources: ['https://www.mackolik.com/puan-durumu/italya-serie-a/1r097lpxe0xn03ihb7wi98kao'],
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    apiFootballId: 61,
    sportsDbId: '4334',
    mackolikArchiveId: 5,
    footballDataCodes: ['FL1'],
    wikipediaTitle: '2025–26 Ligue 1',
    sportsDbSeasons: ['2025-2026', '2025-26', '2026'],
    validationTeams: ['Paris Saint-Germain', 'PSG', 'Marseille', 'Monaco', 'Lyon'],
    htmlSources: ['https://www.mackolik.com/puan-durumu/fransa-ligue-1/dm5ka0os1e3dxcp3vh05kmp33'],
  },
];

const fallbackValidationTeams = leagues.flatMap((league) => league.validationTeams || []);

const TEAM_LOGOS = {
  Galatasaray: 'https://upload.wikimedia.org/wikipedia/en/2/20/Galatasaray_Sports_Club_Logo.png',
  'Fenerbahçe': 'https://upload.wikimedia.org/wikipedia/en/8/8a/Fenerbahce_SK_logo.svg',
  Fenerbahce: 'https://upload.wikimedia.org/wikipedia/en/8/8a/Fenerbahce_SK_logo.svg',
  'Beşiktaş': 'https://upload.wikimedia.org/wikipedia/en/5/5c/Besiktas_JK_logo.svg',
  Besiktas: 'https://upload.wikimedia.org/wikipedia/en/5/5c/Besiktas_JK_logo.svg',
  Trabzonspor: 'https://upload.wikimedia.org/wikipedia/en/4/4e/Trabzonspor_Logo.png',
  'Başakşehir': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Istanbul_Basaksehir_FK_logo.svg',
  Liverpool: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
  Arsenal: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
  Chelsea: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
  'Manchester City': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
  Tottenham: 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
  'Real Madrid': 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
  Barcelona: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
  'Atlético Madrid': 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
  'Atletico Madrid': 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
  'Bayern Munich': 'https://upload.wikimedia.org/wikipedia/en/1/1f/FC_Bayern_München_logo_%282017%29.svg',
  'Bayern Münih': 'https://upload.wikimedia.org/wikipedia/en/1/1f/FC_Bayern_München_logo_%282017%29.svg',
  'Borussia Dortmund': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
  Juventus: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg',
  Inter: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
  'Inter Milan': 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
  Milan: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
  Napoli: 'https://upload.wikimedia.org/wikipedia/commons/2/28/S.S.C._Napoli_logo.svg',
  Roma: 'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg',
  'Paris Saint-Germain': 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  PSG: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  Marseille: 'https://upload.wikimedia.org/wikipedia/en/7/7c/Olympique_de_Marseille_logo.svg',
  Monaco: 'https://upload.wikimedia.org/wikipedia/en/b/ba/AS_Monaco_FC.svg',
  Lyon: 'https://upload.wikimedia.org/wikipedia/en/c/c6/Olympique_Lyonnais.svg',
};

function normalizeApiFootballRow(row) {
  const all = row?.all || {};
  const goalsFor = Number(all.goals?.for || 0);
  const goalsAgainst = Number(all.goals?.against || 0);
  return enrichRow({
    position: Number(row?.rank || 0),
    team: String(row?.team?.name || 'Takım'),
    played: Number(all.played || 0),
    won: Number(all.win || 0),
    draw: Number(all.draw || 0),
    lost: Number(all.lose || 0),
    goalsFor,
    goalsAgainst,
    points: Number(row?.points || 0),
    goalDifference: Number(row?.goalsDiff || goalsFor - goalsAgainst || 0),
    logo: row?.team?.logo || null,
    form: parseApiForm(row?.form),
  });
}

function normalizeFootballDataRow(row) {
  const goalsFor = Number(row?.goalsFor || 0);
  const goalsAgainst = Number(row?.goalsAgainst || 0);
  return enrichRow({
    position: Number(row?.position || 0),
    team: String(row?.team?.shortName || row?.team?.name || 'Takım'),
    played: Number(row?.playedGames || 0),
    won: Number(row?.won || 0),
    draw: Number(row?.draw || 0),
    lost: Number(row?.lost || 0),
    goalsFor,
    goalsAgainst,
    points: Number(row?.points || 0),
    goalDifference: Number(row?.goalDifference || goalsFor - goalsAgainst || 0),
    logo: row?.team?.crest || null,
    form: [],
  });
}

function normalizeSportsDbRow(row, index) {
  const goalsFor = Number(row.intGoalsFor || row.goalsFor || 0);
  const goalsAgainst = Number(row.intGoalsAgainst || row.goalsAgainst || 0);
  return enrichRow({
    position: Number(row.intRank || row.rank || index + 1),
    team: String(row.strTeam || row.team || 'Takım'),
    played: Number(row.intPlayed || row.played || 0),
    won: Number(row.intWin || row.won || 0),
    draw: Number(row.intDraw || row.draw || 0),
    lost: Number(row.intLoss || row.loss || 0),
    goalsFor,
    goalsAgainst,
    points: Number(row.intPoints || row.points || 0),
    goalDifference: Number(row.intGoalDifference || row.goalDifference || goalsFor - goalsAgainst || 0),
    logo: row.strTeamBadge || row.strBadge || null,
    form: [],
  });
}

function normalizeMackolikArchiveRow(row, index) {
  const homePlayed = Number(row?.[2] || 0);
  const awayPlayed = Number(row?.[3] || 0);
  const homeWon = Number(row?.[4] || 0);
  const awayWon = Number(row?.[5] || 0);
  const homeDraw = Number(row?.[6] || 0);
  const awayDraw = Number(row?.[7] || 0);
  const homeLost = Number(row?.[8] || 0);
  const awayLost = Number(row?.[9] || 0);
  const homeGoalsFor = Number(row?.[10] || 0);
  const awayGoalsFor = Number(row?.[11] || 0);
  const homeGoalsAgainst = Number(row?.[12] || 0);
  const awayGoalsAgainst = Number(row?.[13] || 0);
  const homePoints = Number(row?.[14] || 0);
  const awayPoints = Number(row?.[15] || 0);
  const extraPoints = Number(row?.[17] || 0);
  const goalsFor = homeGoalsFor + awayGoalsFor;
  const goalsAgainst = homeGoalsAgainst + awayGoalsAgainst;

  return enrichRow({
    position: index + 1,
    team: String(row?.[1] || 'Takım'),
    played: homePlayed + awayPlayed,
    won: homeWon + awayWon,
    draw: homeDraw + awayDraw,
    lost: homeLost + awayLost,
    goalsFor,
    goalsAgainst,
    points: homePoints + awayPoints + extraPoints,
    goalDifference: goalsFor - goalsAgainst,
    logo: row?.[0] ? `https://im.mackolik.com/img/logo/kucuk/${row[0]}.gif` : null,
    form: [],
  });
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

function getLogoForTeam(team, scrapedLogo = null) {
  return scrapedLogo || TEAM_LOGOS[team] || TEAM_LOGOS[team?.replace('İstanbul ', '')] || null;
}

function parseApiForm(value) {
  return String(value || '').split('').map((item) => item === 'W' ? 'W' : item === 'L' ? 'L' : item === 'D' ? 'D' : '').filter(Boolean).slice(-5);
}

function enrichRow(row) {
  const goalsFor = Number(row.goalsFor || 0);
  const goalsAgainst = Number(row.goalsAgainst || 0);
  const goalDifference = Number.isFinite(row.goalDifference) && row.goalDifference !== 0 ? Number(row.goalDifference) : goalsFor - goalsAgainst;
  return { ...row, goalsFor, goalsAgainst, goalDifference, logo: getLogoForTeam(row.team, row.logo), form: Array.isArray(row.form) ? row.form.slice(-5) : [] };
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

function parseHtmlTable(tableHtml) {
  return (tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || []).map((rowHtml) => {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => ({ html: match[1], text: stripHtml(match[1]) })).filter((cell) => cell.text || cell.html);
    return { html: rowHtml, cells };
  }).filter((row) => row.cells.length >= 4);
}

function cellText(cells, index) {
  return cells[index]?.text || '';
}

function cellHtml(cells, index) {
  return cells[index]?.html || '';
}

function extractLogoFromHtml(html) {
  const srcMatch = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!srcMatch) return null;
  const src = decodeEntities(srcMatch[1]);
  if (!src || src.startsWith('data:')) return null;
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `https://www.mackolik.com${src}`;
  return src;
}

function extractFormFromHtml(html) {
  const lower = String(html || '').toLowerCase();
  const form = [];
  const tokenMatches = [...lower.matchAll(/\b(win|won|galibiyet|draw|beraberlik|loss|lost|mağlubiyet|maglubiyet)\b/g)];
  for (const match of tokenMatches) {
    if (['win', 'won', 'galibiyet'].includes(match[1])) form.push('W');
    if (['draw', 'beraberlik'].includes(match[1])) form.push('D');
    if (['loss', 'lost', 'mağlubiyet', 'maglubiyet'].includes(match[1])) form.push('L');
  }
  return form.slice(-5);
}

function plausiblePoints(won, draw, points) {
  const expected = won * 3 + draw;
  return points > 0 && points <= expected && points >= Math.max(1, expected - 12);
}

function buildRowFromNumbers(position, team, numbers, logo, form) {
  const played = numbers[0] || 0;
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
    const expectedPoints = bestTriplet.won * 3 + bestTriplet.draw;
    const pointCandidates = numbers.filter((value) => plausiblePoints(bestTriplet.won, bestTriplet.draw, value));
    const points = pointCandidates.length ? pointCandidates[pointCandidates.length - 1] : expectedPoints;
    const pointIndex = numbers.lastIndexOf(points);
    const afterTriplet = numbers.slice(bestTriplet.index + 3, pointIndex >= 0 ? pointIndex : undefined);
    let goalsFor = 0;
    let goalsAgainst = 0;
    let goalDifference = 0;
    if (afterTriplet.length >= 3) {
      goalsFor = afterTriplet[0];
      goalsAgainst = afterTriplet[1];
      goalDifference = afterTriplet[2];
    } else {
      goalDifference = numbers[numbers.length - 2] || 0;
    }
    return enrichRow({ position, team, played, won: bestTriplet.won, draw: bestTriplet.draw, lost: bestTriplet.lost, goalsFor, goalsAgainst, points, goalDifference, logo, form });
  }

  const won = numbers[1] || 0;
  const draw = numbers[2] || 0;
  const lost = numbers[3] || 0;
  const goalsFor = numbers[4] || 0;
  const goalsAgainst = numbers[5] || 0;
  return enrichRow({ position, team, played, won, draw, lost, goalsFor, goalsAgainst, points: won * 3 + draw, goalDifference: goalsFor - goalsAgainst, logo, form });
}

function findHeaderIndex(header, exactCandidates, containsCandidates = []) {
  let index = header.findIndex((item) => exactCandidates.includes(item));
  if (index >= 0) return index;
  index = header.findIndex((item) => containsCandidates.some((candidate) => item.includes(candidate)));
  return index;
}

function tableToStandingsRows(rawRows) {
  const headerIndex = rawRows.findIndex((row) => { const joined = normalizeText(row.cells.map((cell) => cell.text).join(' ')); return (joined.includes('takim') || joined.includes('team')) && (joined.includes('puan') || joined.includes('pts') || joined.includes(' p ')); });
  const header = headerIndex >= 0 ? rawRows[headerIndex].cells.map((cell) => normalizeText(cell.text)) : [];
  const body = headerIndex >= 0 ? rawRows.slice(headerIndex + 1) : rawRows;

  const teamIndex = findHeaderIndex(header, ['takim', 'team', 'kulup', 'club'], ['takim', 'team', 'kulup', 'club']);
  const playedIndex = findHeaderIndex(header, ['o', 'om', 'pld', 'played', 'mac'], ['played', 'mac']);
  const wonIndex = findHeaderIndex(header, ['g', 'w', 'won'], ['won', 'galibiyet']);
  const drawIndex = findHeaderIndex(header, ['b', 'd', 'draw'], ['draw', 'beraberlik']);
  const lostIndex = findHeaderIndex(header, ['m', 'l', 'lost'], ['lost', 'maglubiyet']);
  const goalsForIndex = findHeaderIndex(header, ['ag', 'gf', 'a', 'goals for'], ['goals for', 'attigi']);
  const goalsAgainstIndex = findHeaderIndex(header, ['yg', 'ga', 'goals against'], ['goals against', 'yedigi']);
  const gdIndex = findHeaderIndex(header, ['av', 'gd', 'goal difference'], ['goal difference']);
  const pointsIndex = findHeaderIndex(header, ['p', 'pts', 'puan', 'points'], ['puan', 'points']);

  return body.map((row, index) => {
    const cells = row.cells;
    const safeTeamIndex = teamIndex >= 0 ? teamIndex : 1;
    const position = parseNumber(cellText(cells, 0)) || index + 1;
    const team = cleanTeam(cellText(cells, safeTeamIndex) || '');
    const rowHtml = row.html || cells.map((cell) => cell.html).join(' ');
    const logo = extractLogoFromHtml(rowHtml);
    const form = extractFormFromHtml(rowHtml);
    const played = parseNumber(cellText(cells, playedIndex >= 0 ? playedIndex : 2));
    const won = parseNumber(cellText(cells, wonIndex >= 0 ? wonIndex : 3));
    const draw = parseNumber(cellText(cells, drawIndex >= 0 ? drawIndex : 4));
    const lost = parseNumber(cellText(cells, lostIndex >= 0 ? lostIndex : 5));
    const goalsFor = parseNumber(cellText(cells, goalsForIndex >= 0 ? goalsForIndex : 6));
    const goalsAgainst = parseNumber(cellText(cells, goalsAgainstIndex >= 0 ? goalsAgainstIndex : 7));
    const points = parseNumber(cellText(cells, pointsIndex >= 0 ? pointsIndex : cells.length - 1));
    const goalDifference = parseNumber(cellText(cells, gdIndex >= 0 ? gdIndex : Math.max(cells.length - 2, 6))) || goalsFor - goalsAgainst;
    const headerMapped = enrichRow({ position, team, played, won, draw, lost, goalsFor, goalsAgainst, points, goalDifference, logo, form });
    if (played > 0 && won >= 0 && draw >= 0 && lost >= 0 && won + draw + lost === played && plausiblePoints(won, draw, points)) return headerMapped;
    const numbers = cells.slice(safeTeamIndex + 1).map((cell) => parseNumber(cell.text)).filter((value) => Number.isFinite(value));
    return buildRowFromNumbers(position, team, numbers, logo, form);
  }).filter((row) => row.team && row.played > 0 && row.points > 0 && row.won >= 0 && row.draw >= 0 && row.lost >= 0 && row.won + row.draw + row.lost === row.played && plausiblePoints(row.won, row.draw, row.points));
}

function validateCurrentStandings(table, league) {
  if (!Array.isArray(table) || table.length < 10) return false;
  const teams = table.map((row) => normalizeText(row.team)).join(' ');
  const knownTeams = league?.validationTeams?.length ? league.validationTeams : fallbackValidationTeams;
  const hasKnownTeam = knownTeams.some((team) => teams.includes(normalizeText(team)));
  const rowsArePlausible = table.every((row) => {
    const resultTotal = row.won + row.draw + row.lost;
    return row.played > 0 && row.points > 0 && Math.abs(resultTotal - row.played) <= 1 && plausiblePoints(row.won, row.draw, row.points);
  });
  return hasKnownTeam && rowsArePlausible;
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
        if (validateCurrentStandings(table, league)) return { source: `HTML scrape ${url}`, table };
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
      const table = rows.map(normalizeFootballDataRow);
      if (!validateCurrentStandings(table, league)) throw new Error(`invalid football-data table ${code}: ${table.length}`);
      return { source: `football-data.org ${code}`, table };
    } catch (error) { errors.push(`${code}: ${error instanceof Error ? error.message : 'unknown error'}`); }
  }
  throw new Error(errors.join(' | '));
}

async function fetchWikipediaStandings(league) {
  if (!league.wikipediaTitle) throw new Error('no wikipedia source');
  const html = await fetchText(`https://en.wikipedia.org/wiki/${encodeURIComponent(league.wikipediaTitle).replace(/%20/g, '_')}`);
  const tables = extractHtmlTables(html);
  const knownTeams = league.validationTeams || [];
  const table = tables.find((item) => knownTeams.some((team) => normalizeText(stripHtml(item)).includes(normalizeText(team))) && /Pts|points|Puan|GD|Av/i.test(item));
  if (!table) throw new Error('wikipedia standings table not found');
  const rawRows = parseHtmlTable(table);
  const rows = tableToStandingsRows(rawRows);
  if (!validateCurrentStandings(rows, league)) throw new Error(`wikipedia parsed invalid rows: ${rows.length}`);
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
      const table = rows.map(normalizeApiFootballRow);
      if (!validateCurrentStandings(table, league)) throw new Error(`invalid api-football table ${season}: ${table.length}`);
      return { source: `API-FOOTBALL ${season}`, table };
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
      if (!validateCurrentStandings(table, league)) throw new Error(`incomplete table ${season}: ${table.length} rows`);
      return { source: `TheSportsDB ${season}`, table };
    } catch (error) { errors.push(error instanceof Error ? error.message : 'unknown error'); }
  }
  throw new Error(errors.join(' | '));
}

async function fetchMackolikArchiveStandings(league) {
  if (!league.mackolikArchiveId) throw new Error('no Maçkolik archive source');

  // Maçkolik arşiv sayfası HTML tabloyu doğrudan basmıyor; sayfadaki sezon kimliğini
  // okuyup kendi JSON endpoint'inden gerçek puan durumu dizisini çekiyoruz.
  const standingPageUrl = `https://arsiv.mackolik.com/Standings/Default.aspx?id=${league.mackolikArchiveId}`;
  const html = await fetchText(standingPageUrl, { headers: { Referer: 'https://arsiv.mackolik.com/' } });
  const seasonId = html.match(/seasonId=(\d+)/)?.[1] || html.match(/seasonId:\s*(\d+)/)?.[1];
  if (!seasonId) throw new Error(`Maçkolik seasonId not found for ${league.name}`);

  const payload = await fetchJson(`https://arsiv.mackolik.com/AjaxHandlers/StandingHandler.ashx?op=standing&id=${seasonId}`, {
    headers: {
      Referer: standingPageUrl,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  });
  const rows = Array.isArray(payload?.s) ? payload.s : [];
  const table = rows.map(normalizeMackolikArchiveRow);
  if (!validateCurrentStandings(table, league)) throw new Error(`invalid Maçkolik archive table ${seasonId}: ${table.length}`);
  return { source: `Maçkolik arşiv ${league.mackolikArchiveId}/${seasonId}`, table };
}

async function fetchStandings(league) {
  const errors = [];
  try { const result = await fetchMackolikArchiveStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: '' }; } catch (error) { errors.push(`Maçkolik arşiv: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchHtmlScrapeStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: '' }; } catch (error) { errors.push(`HTML scrape: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchFootballDataStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`football-data.org: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchWikipediaStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`Wikipedia: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchApiFootballStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`API-FOOTBALL: ${error instanceof Error ? error.message : 'unknown error'}`); }
  try { const result = await fetchSportsDbStandings(league); return { id: league.id, name: league.name, updatedAt, ...result, fixtures: [], results: [], status: errors.join(' | ') }; } catch (error) { errors.push(`TheSportsDB: ${error instanceof Error ? error.message : 'unknown error'}`); }
  return { id: league.id, name: league.name, updatedAt, source: 'none', table: [], fixtures: [], results: [], status: errors.join(' | ') };
}

// Kaynaklar geçici olarak 502/boş dönerse canlı sitede lig tablosunu sıfırlamamak için
// mevcut data/standings.json dosyasındaki son sağlam tabloyu korur. Bu emniyet özellikle
// Maçkolik arşiv endpoint'i anlık hata verdiğinde Bundesliga/Serie A gibi liglerin boş
// yayınlanmasını engeller; kaynak tekrar düzelince yeni tablo normal şekilde bunun üstüne yazılır.
async function loadPreviousStandings() {
  try {
    const payload = JSON.parse(await readFile(`${DATA_DIR}/standings.json`, 'utf8'));
    return Array.isArray(payload?.leagues) ? payload.leagues : [];
  } catch {
    return [];
  }
}

function keepPreviousIfCurrentEmpty(current, previousLeagues) {
  if (Array.isArray(current?.table) && current.table.length) return current;
  const previous = previousLeagues.find((league) => league.id === current.id);
  if (!previous || !Array.isArray(previous.table) || !previous.table.length) return current;
  return {
    ...previous,
    updatedAt: previous.updatedAt || updatedAt,
    source: previous.source || 'previous valid table',
    preservedPreviousTable: true,
    status: current.status ? `Current refresh failed, previous table preserved. ${current.status}` : 'Current refresh failed, previous table preserved.',
  };
}

await mkdir(DATA_DIR, { recursive: true });
const previousLeagues = await loadPreviousStandings();
const leaguePayloads = (await Promise.all(leagues.map(fetchStandings))).map((league) => keepPreviousIfCurrentEmpty(league, previousLeagues));
const defaultLeague = leaguePayloads[0];
await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({ updatedAt, source: 'Maçkolik arşiv/HTML scrape/football-data.org/Wikipedia/API-FOOTBALL/TheSportsDB', defaultLeagueId: 'super-lig', leagues: leaguePayloads, competition: defaultLeague?.name || 'Süper Lig', table: defaultLeague?.table || [], fixtures: defaultLeague?.fixtures || [], results: defaultLeague?.results || [] }, null, 2) + '\n', 'utf8');
