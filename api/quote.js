// Vercel Serverless Function — fetches stock prices server-side
// No CORS issues — works from laptop, iPhone, anywhere
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 60);
  const results = {};

  await Promise.all(symList.map(async (sym) => {
    const yahooTicker = sym.includes('.') ? sym : sym + '.NS';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com/'
    };

    for (const base of ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']) {
      try {
        const r = await fetch(
          `${base}/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        if (!r.ok) continue;
        const j = await r.json();
        const m = j?.chart?.result?.[0]?.meta;
        if (m?.regularMarketPrice > 0) {
          const p = m.regularMarketPrice;
          const pv = m.previousClose || m.chartPreviousClose || p;
          results[sym] = { p, pv, c: +(p - pv).toFixed(2), cp: +((pv > 0 ? (p - pv) / pv * 100 : 0)).toFixed(2) };
          return;
        }
      } catch(e) { continue; }
    }
    results[sym] = null;
  }));

  res.json(results);
}
