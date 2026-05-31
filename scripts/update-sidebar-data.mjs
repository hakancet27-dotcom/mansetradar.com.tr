import { mkdir, writeFile } from 'node:fs/promises';

const DATA_DIR = 'data';
const updatedAt = new Date().toISOString();

const signs = [
  ['aries', 'Koç'],
  ['taurus', 'Boğa'],
  ['gemini', 'İkizler'],
  ['cancer', 'Yengeç'],
  ['leo', 'Aslan'],
  ['virgo', 'Başak'],
  ['libra', 'Terazi'],
  ['scorpio', 'Akrep'],
  ['sagittarius', 'Yay'],
  ['capricorn', 'Oğlak'],
  ['aquarius', 'Kova'],
  ['pisces', 'Balık'],
];

const horoscopeOrigin = ['https://aztro', 'sameerkumar', 'website'].join('.');

async function fetchHoroscope(sign, title) {
  try {
    const response = await fetch(`${horoscopeOrigin}/?sign=${encodeURIComponent(sign)}&day=today`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return {
      sign,
      title,
      description: String(data.description || 'Günlük yorum hazırlanıyor.'),
      mood: String(data.mood || '--'),
      color: String(data.color || '--'),
      luckyNumber: String(data.lucky_number || '--'),
      currentDate: String(data.current_date || ''),
    };
  } catch (error) {
    return {
      sign,
      title,
      description: 'Günlük yorum şu an alınamadı. Kısa süre sonra tekrar güncellenecek.',
      mood: '--',
      color: '--',
      luckyNumber: '--',
      currentDate: '',
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

async function updateHoroscope() {
  const items = await Promise.all(signs.map(([sign, title]) => fetchHoroscope(sign, title)));
  await writeFile(`${DATA_DIR}/horoscope.json`, JSON.stringify({ updatedAt, source: 'Aztro', items }, null, 2) + '\n', 'utf8');
}

function normalizeStandingRow(row) {
  return {
    position: Number(row.position || 0),
    team: String(row.team?.shortName || row.team?.name || 'Takım'),
    played: Number(row.playedGames || 0),
    won: Number(row.won || 0),
    draw: Number(row.draw || 0),
    lost: Number(row.lost || 0),
    points: Number(row.points || 0),
    goalDifference: Number(row.goalDifference || 0),
  };
}

async function updateStandings() {
  const token = process.env.SPORTS_API_KEY || '';
  if (!token) {
    await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({
      updatedAt,
      source: 'football-data.org',
      competition: 'Süper Lig',
      table: [],
      status: 'missing SPORTS_API_KEY',
    }, null, 2) + '\n', 'utf8');
    return;
  }

  try {
    const response = await fetch('https://api.football-data.org/v4/competitions/TR1/standings', {
      headers: { 'X-Auth-Token': token },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const table = (payload.standings?.[0]?.table || []).map(normalizeStandingRow);
    await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({
      updatedAt,
      source: 'football-data.org',
      competition: payload.competition?.name || 'Süper Lig',
      table,
    }, null, 2) + '\n', 'utf8');
  } catch (error) {
    await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({
      updatedAt,
      source: 'football-data.org',
      competition: 'Süper Lig',
      table: [],
      status: error instanceof Error ? error.message : 'unknown error',
    }, null, 2) + '\n', 'utf8');
  }
}

await mkdir(DATA_DIR, { recursive: true });
await updateHoroscope();
await updateStandings();
