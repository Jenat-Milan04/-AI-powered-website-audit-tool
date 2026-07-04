export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (response.ok) {
        const html = await response.text();
        return res.json({ success: true, html, url });
      }
    } catch (_) {}

    const proxyResponse = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    if (!proxyResponse.ok) throw new Error(`Proxy returned ${proxyResponse.status}`);

    const proxyData = await proxyResponse.json();
    if (!proxyData.contents) throw new Error('No content from proxy');

    return res.json({ success: true, html: proxyData.contents, url, viaProxy: true });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch webpage',
      details: error.message,
      suggestion: 'The website might be blocking requests. Try a different URL.'
    });
  }
}
