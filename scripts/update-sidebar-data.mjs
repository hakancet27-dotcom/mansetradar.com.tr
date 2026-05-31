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

const fallbackComments = {
  aries: 'Bugün hızlı kararlar almak isteyebilirsin. Acele etmeden ilerlemek ve önceliğini netleştirmek sana avantaj sağlar.',
  taurus: 'Maddi konular ve güven ihtiyacı öne çıkabilir. Sağlam adımlar atmak, günün dengesini korumana yardım eder.',
  gemini: 'İletişim trafiğin artabilir. Kısa görüşmeler, haberler ve yeni fikirler günün ritmini belirleyebilir.',
  cancer: 'Ev, aile ve iç huzur ihtiyacı bugün daha belirgin olabilir. Kendine alan açmak iyi gelir.',
  leo: 'Dikkat çektiğin bir gün olabilir. Kendini ifade ederken net ama ölçülü kalmak faydalı olur.',
  virgo: 'Düzen, plan ve detaylar ön planda. Küçük işleri toparlamak büyük rahatlama sağlayabilir.',
  libra: 'İlişkilerde denge arayışı öne çıkabilir. Karşındakini dinlemek kadar kendi ihtiyacını da söylemen önemli.',
  scorpio: 'Sezgilerin güçlü çalışabilir. Derin düşündüğün konularda acele karar vermeden gözlem yapmak iyi olur.',
  sagittarius: 'Yeni bir plan, yolculuk fikri veya öğrenme isteği gündeme gelebilir. Ufuk açan konulara yönel.',
  capricorn: 'Sorumluluklar ve hedefler ön planda. Planlı ilerlersen günün sonunda somut sonuç alabilirsin.',
  aquarius: 'Farklı düşünceler ve sosyal bağlantılar gününü hareketlendirebilir. Yeni fikirlere açık kal.',
  pisces: 'Duygusal hassasiyet artabilir. Sezgini dinle ama net olmayan konularda zaman tanı.',
};

const fallbackStandings = [
  ['Galatasaray', 0],
  ['Fenerbahçe', 0],
  ['Beşiktaş', 0],
  ['Trabzonspor', 0],
  ['Başakşehir', 0],
  ['Samsunspor', 0],
  ['Göztepe', 0],
  ['Konyaspor', 0],
  ['Kasımpaşa', 0],
  ['Antalyaspor', 0],
].map(([team, points], index) => ({
  position: index + 1,
  team,
  played: 0,
  won: 0,
  draw: 0,
  lost: 0,
  points,
  goalDifference: 0,
  fallback: true,
}));

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchHoroscope(sign, title) {
  const errors = [];

  try {
    const payload = await fetchJson(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${encodeURIComponent(sign)}&day=TODAY`);
    const data = payload?.data || payload;
    return {
      sign,
      title,
      description: String(data?.horoscope_data || data?.description || fallbackComments[sign]),
      mood: String(data?.mood || '--'),
      color: String(data?.color || '--'),
      luckyNumber: String(data?.lucky_number || '--'),
      currentDate: String(data?.date || data?.current_date || new Date().toLocaleDateString('tr-TR')),
    };
  } catch (error) {
    errors.push(`horoscope-app-api: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  try {
    const data = await fetchJson(`https://aztro.sameerkumar.website/?sign=${encodeURIComponent(sign)}&day=today`, { method: 'POST' });
    return {
      sign,
      title,
      description: String(data?.description || fallbackComments[sign]),
      mood: String(data?.mood || '--'),
      color: String(data?.color || '--'),
      luckyNumber: String(data?.lucky_number || '--'),
      currentDate: String(data?.current_date || new Date().toLocaleDateString('tr-TR')),
    };
  } catch (error) {
    errors.push(`aztro: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  return {
    sign,
    title,
    description: fallbackComments[sign],
    mood: '--',
    color: '--',
    luckyNumber: '--',
    currentDate: new Date().toLocaleDateString('tr-TR'),
    fallback: true,
    status: errors.join(' | '),
  };
}

async function updateHoroscope() {
  const items = await Promise.all(signs.map(([sign, title]) => fetchHoroscope(sign, title)));
  await writeFile(`${DATA_DIR}/horoscope.json`, JSON.stringify({ updatedAt, source: 'horoscope-app-api/Aztro/fallback', items }, null, 2) + '\n', 'utf8');
}

function normalizeFootballDataRow(row) {
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

function normalizeSportsDbRow(row, index) {
  return {
    position: Number(row.intRank || row.rank || index + 1),
    team: String(row.strTeam || row.team || 'Takım'),
    played: Number(row.intPlayed || row.played || 0),
    won: Number(row.intWin || row.won || 0),
    draw: Number(row.intDraw || row.draw || 0),
    lost: Number(row.intLoss || row.lost || 0),
    points: Number(row.intPoints || row.points || 0),
    goalDifference: Number(row.intGoalDifference || row.goalDifference || 0),
  };
}

async function fetchStandingsFromFootballData(token) {
  if (!token) throw new Error('missing SPORTS_API_KEY');
  const response = await fetch('https://api.football-data.org/v4/competitions/TR1/standings', {
    headers: { 'X-Auth-Token': token },
  });
  if (!response.ok) throw new Error(`football-data HTTP ${response.status}`);
  const payload = await response.json();
  const table = (payload?.standings?.[0]?.table || []).map(normalizeFootballDataRow);
  if (!table.length) throw new Error('football-data empty table');
  return { source: 'football-data.org', competition: payload?.competition?.name || 'Süper Lig', table };
}

async function fetchStandingsFromSportsDb() {
  const seasons = ['2025-2026', '2025-26', '2026'];
  const leagueIds = ['4339', '4494'];
  const errors = [];

  for (const leagueId of leagueIds) {
    for (const season of seasons) {
      try {
        const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${leagueId}&s=${encodeURIComponent(season)}`);
        const rows = payload?.table || payload?.standings || [];
        if (!Array.isArray(rows) || !rows.length) throw new Error('empty table');
        return { source: 'TheSportsDB', competition: 'Süper Lig', table: rows.map(normalizeSportsDbRow) };
      } catch (error) {
        errors.push(`${leagueId}/${season}: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
  }

  throw new Error(errors.join(' | '));
}

async function updateStandings() {
  const token = process.env.SPORTS_API_KEY || '';
  const errors = [];

  try {
    const data = await fetchStandingsFromFootballData(token);
    await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({ updatedAt, ...data }, null, 2) + '\n', 'utf8');
    return;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'unknown');
  }

  try {
    const data = await fetchStandingsFromSportsDb();
    await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({ updatedAt, ...data }, null, 2) + '\n', 'utf8');
    return;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'unknown');
  }

  await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({
    updatedAt,
    source: 'football-data.org/TheSportsDB/fallback',
    competition: 'Süper Lig',
    table: fallbackStandings,
    fallback: true,
    status: errors.join(' | '),
  }, null, 2) + '\n', 'utf8');
}

await mkdir(DATA_DIR, { recursive: true });
await updateHoroscope();
await updateStandings();
