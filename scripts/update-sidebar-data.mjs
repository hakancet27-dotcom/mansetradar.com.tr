import { mkdir, writeFile } from 'node:fs/promises';

const DATA_DIR = 'data';
const updatedAt = new Date().toISOString();

const signs = [
  ['aries', 'Koç', '♈'], ['taurus', 'Boğa', '♉'], ['gemini', 'İkizler', '♊'], ['cancer', 'Yengeç', '♋'],
  ['leo', 'Aslan', '♌'], ['virgo', 'Başak', '♍'], ['libra', 'Terazi', '♎'], ['scorpio', 'Akrep', '♏'],
  ['sagittarius', 'Yay', '♐'], ['capricorn', 'Oğlak', '♑'], ['aquarius', 'Kova', '♒'], ['pisces', 'Balık', '♓'],
];

const footballLeagues = [
  { id: 'super-lig', name: 'Süper Lig', footballDataCode: 'TR1', sportsDbId: '4339', seasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'premier-league', name: 'Premier League', footballDataCode: 'PL', sportsDbId: '4328', seasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'la-liga', name: 'La Liga', footballDataCode: 'PD', sportsDbId: '4335', seasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'bundesliga', name: 'Bundesliga', footballDataCode: 'BL1', sportsDbId: '4331', seasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'serie-a', name: 'Serie A', footballDataCode: 'SA', sportsDbId: '4332', seasons: ['2025-2026', '2025-26', '2026'] },
  { id: 'ligue-1', name: 'Ligue 1', footballDataCode: 'FL1', sportsDbId: '4334', seasons: ['2025-2026', '2025-26', '2026'] },
];

const fallbackComments = {
  aries: 'Bugün Koç burcu için hareketli, karar alma temposu yüksek bir gün olabilir. Önceliğini netleştirirsen enerjini dağınık işlere harcamadan daha etkili kullanabilirsin. Özellikle beklettiğin bir konuda ilk adımı atmak moralini yükseltebilir. İlişkilerde hızlı tepki vermek yerine birkaç saniye durup düşünmek, gereksiz gerilimleri azaltır. İş ve para tarafında ise küçük ama net bir plan yapmak günün sonunda daha somut sonuç almanı sağlar.',
  taurus: 'Bugün Boğa burcu için güven, konfor ve maddi denge ihtiyacı öne çıkıyor. Aceleyle karar vermek yerine elindeki seçenekleri sakin biçimde tartmak daha doğru olur. Aile, ev veya kişisel düzenle ilgili küçük bir toparlanma sana iyi gelebilir. İlişkilerde netlik arayışındasın; karşındaki kişiden beklentini yumuşak ama açık bir dille söylemen faydalı olur. Para konularında ise gereksiz harcamaları fark etmek günün kazancı olabilir.',
  gemini: 'Bugün İkizler burcu için iletişim trafiği artabilir. Telefonlar, mesajlar, kısa görüşmeler ve ani haberler gündemini belirleyebilir. Zihnin hızlı çalışıyor; bu da yeni fikir üretmek için avantaj sağlar. Ancak aynı anda çok fazla konuya bölünmek yorucu olabilir. İlişkilerde meraklı ve açık tavrın dikkat çekerken, iş tarafında kısa notlar almak ve yapılacakları sıraya koymak verimini artırır.',
  cancer: 'Bugün Yengeç burcu için duygusal güvenlik, ev ve aile temaları ön planda. İçinden gelenleri bastırmak yerine sakin bir şekilde ifade etmek rahatlama sağlayabilir. Geçmişten gelen bir konu tekrar aklına düşebilir; bunu büyütmeden değerlendirmek daha sağlıklı olur. İş ve para konularında riskten çok korumacı davranmak isteyebilirsin. Günün sonunda kendine ayıracağın sessiz bir zaman ruh halini dengeleyebilir.',
  leo: 'Bugün Aslan burcu için görünür olmak, kendini anlatmak ve dikkat çekmek kolaylaşabilir. Ancak güçlü duruşunu korurken karşı tarafı da dinlemek ilişkilerde daha iyi sonuç verir. Sosyal çevrende veya iş ortamında fikrini ortaya koyman gereken bir durum oluşabilir. Kendine güvenmen güzel ama detayları atlamamaya çalış. Günün enerjisi yaratıcı işler, sunumlar ve kişisel hedefler için destekleyici görünüyor.',
  virgo: 'Bugün Başak burcu için düzen, planlama ve detaylar önem kazanıyor. Dağınık kalan işleri toparlamak, eksik bir dosyayı tamamlamak veya günlük rutinini sadeleştirmek sana iyi gelir. Fazla mükemmeliyetçi davranırsan kendini gereksiz yere yorabilirsin. İlişkilerde eleştirel ton yerine yapıcı bir dil kullanmak daha faydalı olur. Para ve iş tarafında küçük hesaplar, uzun vadede rahatlatıcı bir fark yaratabilir.',
  libra: 'Bugün Terazi burcu için denge, ilişkiler ve ortak kararlar ön planda. Bir konuda orta yolu bulmak isteyebilirsin fakat kendi ihtiyacını tamamen geri plana atmamalısın. Sosyal temaslar artabilir; nazik ve uyumlu tavrın kapı açar. İş tarafında ekip çalışması veya fikir alışverişi verimli olabilir. Duygusal konularda ise net olmayan beklentileri konuşmak, gereksiz kırgınlıkların önüne geçer.',
  scorpio: 'Bugün Akrep burcu için sezgiler güçlü çalışıyor. İnsanların söylediklerinden çok söylemediklerini fark edebilirsin. Bu durum sana avantaj sağlasa da şüpheyi fazla büyütmemek önemli. Derinleşmek istediğin bir konuya odaklanmak için uygun bir gün. İş ve para tarafında gizli kalan bir detay ortaya çıkabilir. İlişkilerde ise kontrol etmeye çalışmak yerine güven alanını güçlendirmek daha iyi sonuç verir.',
  sagittarius: 'Bugün Yay burcu için özgürlük, öğrenme ve yeni planlar öne çıkıyor. Rutin seni sıkabilir; farklı bir konuya yönelmek zihnini açar. Yolculuk, eğitim, yayıncılık veya uzak bağlantılar gündeme gelebilir. Acele vaatlere kapılmadan gerçekçi bir plan yapmak önemli. İlişkilerde açık sözlülüğün güçlü ama tonu iyi ayarlamak gerekiyor. Gün, hedeflerini genişletmek için ilham verici olabilir.',
  capricorn: 'Bugün Oğlak burcu için sorumluluklar, hedefler ve somut sonuç alma isteği ön planda. Yapılması gerekenleri ertelemeden sıraya koyarsan gün verimli geçebilir. İş tarafında disiplinli duruşun dikkat çeker. Ancak her şeyi tek başına üstlenmek seni yorabilir; destek istemek zayıflık değil. Para konularında planlı davranmak, ilerleyen günler için güven hissini artırır. Duygusal tarafta ise biraz yumuşamak ilişkileri rahatlatır.',
  aquarius: 'Bugün Kova burcu için farklı fikirler, sosyal bağlantılar ve yenilik arayışı öne çıkıyor. Alışılmışın dışına çıkmak isteyebilirsin. Teknoloji, topluluklar veya arkadaş çevresi üzerinden yeni bir gündem doğabilir. Ancak fazla mesafeli görünmemeye dikkat et. İlişkilerde samimi bir açıklama, yanlış anlaşılmayı önleyebilir. İş tarafında yaratıcı bir çözüm bulma ihtimalin yüksek.',
  pisces: 'Bugün Balık burcu için sezgi, duygu ve içsel farkındalık güçlü olabilir. Yoğun ortamlardan uzaklaşıp biraz sakinlik arayabilirsin. Sanatsal işler, yazmak, müzik veya ruhunu besleyen konular iyi gelir. İlişkilerde fazla fedakârlık yapmadan sınırlarını koruman önemli. İş ve para tarafında net olmayan şeyleri yazılı hale getirmek seni korur. Günün sonunda iç sesini dinlemek doğru yönü gösterebilir.',
};

const fallbackTables = {
  'super-lig': ['Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor', 'Başakşehir', 'Samsunspor', 'Göztepe', 'Konyaspor', 'Kasımpaşa', 'Antalyaspor'],
  'premier-league': ['Liverpool', 'Arsenal', 'Manchester City', 'Chelsea', 'Manchester United', 'Tottenham', 'Newcastle', 'Aston Villa'],
  'la-liga': ['Real Madrid', 'Barcelona', 'Atlético Madrid', 'Athletic Club', 'Villarreal', 'Real Sociedad'],
  'bundesliga': ['Bayern Münih', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig', 'Stuttgart', 'Frankfurt'],
  'serie-a': ['Inter', 'Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio'],
  'ligue-1': ['PSG', 'Marseille', 'Monaco', 'Lille', 'Lyon', 'Nice'],
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function getSymbol(sign) { return signs.find(([key]) => key === sign)?.[2] || '✦'; }

function enrichReading(base) {
  const description = String(base.description || fallbackComments[base.sign] || 'Günlük yorum hazırlanıyor.');
  return {
    ...base,
    symbol: getSymbol(base.sign),
    description,
    love: base.love || 'Duygusal konularda acele etmeden, karşındaki kişinin sözleri kadar tavrını da gözlemlemek iyi olur.',
    career: base.career || 'İş ve para tarafında küçük detayları toparlamak, günün sonunda daha güvenli bir zemin oluşturur.',
    advice: base.advice || 'Bugünün ana tavsiyesi: enerjini tek bir önceliğe odakla ve gereksiz tartışmalardan uzak dur.',
  };
}

async function fetchHoroscope(sign, title, symbol) {
  const errors = [];
  try {
    const payload = await fetchJson(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${encodeURIComponent(sign)}&day=TODAY`);
    const data = payload?.data || payload;
    return enrichReading({ sign, title, symbol, description: String(data?.horoscope_data || data?.description || fallbackComments[sign]), mood: String(data?.mood || '--'), color: String(data?.color || '--'), luckyNumber: String(data?.lucky_number || '--'), currentDate: String(data?.date || data?.current_date || new Date().toLocaleDateString('tr-TR')) });
  } catch (error) { errors.push(`horoscope-app-api: ${error instanceof Error ? error.message : 'unknown'}`); }
  try {
    const data = await fetchJson(`https://aztro.sameerkumar.website/?sign=${encodeURIComponent(sign)}&day=today`, { method: 'POST' });
    return enrichReading({ sign, title, symbol, description: String(data?.description || fallbackComments[sign]), mood: String(data?.mood || '--'), color: String(data?.color || '--'), luckyNumber: String(data?.lucky_number || '--'), currentDate: String(data?.current_date || new Date().toLocaleDateString('tr-TR')) });
  } catch (error) { errors.push(`aztro: ${error instanceof Error ? error.message : 'unknown'}`); }
  return enrichReading({ sign, title, symbol, description: fallbackComments[sign], mood: '--', color: '--', luckyNumber: '--', currentDate: new Date().toLocaleDateString('tr-TR'), fallback: true, status: errors.join(' | ') });
}

async function updateHoroscope() {
  const items = await Promise.all(signs.map(([sign, title, symbol]) => fetchHoroscope(sign, title, symbol)));
  await writeFile(`${DATA_DIR}/horoscope.json`, JSON.stringify({ updatedAt, source: 'horoscope-app-api/Aztro/fallback', items }, null, 2) + '\n', 'utf8');
}

function normalizeFootballDataRow(row) {
  return { position: Number(row.position || 0), team: String(row.team?.shortName || row.team?.name || 'Takım'), played: Number(row.playedGames || 0), won: Number(row.won || 0), draw: Number(row.draw || 0), lost: Number(row.lost || 0), points: Number(row.points || 0), goalDifference: Number(row.goalDifference || 0) };
}

function normalizeSportsDbRow(row, index) {
  return { position: Number(row.intRank || row.rank || index + 1), team: String(row.strTeam || row.team || 'Takım'), played: Number(row.intPlayed || row.played || 0), won: Number(row.intWin || row.won || 0), draw: Number(row.intDraw || row.draw || 0), lost: Number(row.intLoss || row.loss || 0), points: Number(row.intPoints || row.points || 0), goalDifference: Number(row.intGoalDifference || row.goalDifference || 0) };
}

function fallbackTableFor(league) {
  return (fallbackTables[league.id] || []).map((team, index) => ({ position: index + 1, team, played: 0, won: 0, draw: 0, lost: 0, points: 0, goalDifference: 0, fallback: true }));
}

async function fetchLeagueFromFootballData(league, token) {
  if (!token || !league.footballDataCode) throw new Error('missing football-data source');
  const response = await fetch(`https://api.football-data.org/v4/competitions/${league.footballDataCode}/standings`, { headers: { 'X-Auth-Token': token } });
  if (!response.ok) throw new Error(`football-data HTTP ${response.status}`);
  const payload = await response.json();
  const table = (payload?.standings?.[0]?.table || []).map(normalizeFootballDataRow);
  if (!table.length) throw new Error('football-data empty table');
  return { source: 'football-data.org', table };
}

async function fetchLeagueFromSportsDb(league) {
  const errors = [];
  for (const season of league.seasons) {
    try {
      const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${league.sportsDbId}&s=${encodeURIComponent(season)}`);
      const rows = payload?.table || payload?.standings || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error('empty table');
      return { source: 'TheSportsDB', table: rows.map(normalizeSportsDbRow) };
    } catch (error) { errors.push(`${season}: ${error instanceof Error ? error.message : 'unknown'}`); }
  }
  throw new Error(errors.join(' | '));
}

async function fetchLeagueStandings(league, token) {
  const errors = [];
  try { return await fetchLeagueFromFootballData(league, token); } catch (error) { errors.push(error instanceof Error ? error.message : 'unknown'); }
  try { return await fetchLeagueFromSportsDb(league); } catch (error) { errors.push(error instanceof Error ? error.message : 'unknown'); }
  return { source: 'fallback', table: fallbackTableFor(league), fallback: true, status: errors.join(' | ') };
}

async function updateStandings() {
  const token = process.env.SPORTS_API_KEY || '';
  const leagues = [];
  for (const league of footballLeagues) {
    const result = await fetchLeagueStandings(league, token);
    leagues.push({ id: league.id, name: league.name, updatedAt, ...result });
  }
  const defaultLeague = leagues[0];
  await writeFile(`${DATA_DIR}/standings.json`, JSON.stringify({ updatedAt, source: 'multi-league', defaultLeagueId: 'super-lig', leagues, competition: defaultLeague?.name || 'Süper Lig', table: defaultLeague?.table || [] }, null, 2) + '\n', 'utf8');
}

await mkdir(DATA_DIR, { recursive: true });
await updateHoroscope();
await updateStandings();
