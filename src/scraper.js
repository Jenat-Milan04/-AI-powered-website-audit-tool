// scraper.js - Updated to use backend proxy

// src/scraper.js
export async function fetchHTML(url) {
  try {
    // Use your backend proxy
    const response = await fetch('http://localhost:3000/fetch-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.html) {
      throw new Error('No HTML content received');
    }

    return data.html;

  } catch (error) {
    console.error('Fetch error:', error);
    throw new Error(`Could not fetch the page: ${error.message}`);
  }
}

export function extractMetrics(html, pageUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // --- Word count ---
  const bodyText = (doc.body?.innerText || doc.body?.textContent || '').trim();
  const words = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // --- Headings ---
  const h1 = doc.querySelectorAll('h1').length;
  const h2 = doc.querySelectorAll('h2').length;
  const h3 = doc.querySelectorAll('h3').length;

  // --- CTAs (buttons + action links) ---
  const CTA_REGEX = /\b(get started|sign up|buy now|subscribe|download|contact us|request|demo|free trial|try|start|join|learn more|shop now|order|book|schedule|register|get a quote|apply now|get in touch)\b/i;
  const ctaElements = Array.from(doc.querySelectorAll('a, button'));
  const ctaCount = ctaElements.filter(el => CTA_REGEX.test(el.textContent.trim())).length;

  // --- Internal vs external links ---
  let origin = '';
  try { origin = new URL(pageUrl).origin; } catch (_) {}
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  let internal = 0, external = 0;
  anchors.forEach(a => {
    const href = (a.getAttribute('href') || '').trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (href.startsWith('/') || href.startsWith('./') || (origin && href.startsWith(origin))) {
      internal++;
    } else if (href.startsWith('http')) {
      external++;
    } else {
      internal++;
    }
  });

  // --- Images & alt text ---
  const imgs = Array.from(doc.querySelectorAll('img'));
  const imgCount = imgs.length;
  const missingAlt = imgs.filter(img => {
    const alt = img.getAttribute('alt');
    return alt === null || alt.trim() === '';
  }).length;
  const missingAltPct = imgCount > 0 ? Math.round((missingAlt / imgCount) * 100) : 0;

  // --- Meta tags ---
  const metaTitle = doc.querySelector('title')?.textContent?.trim() || null;
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || null;
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || null;
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || null;

  // --- Content snippet for AI ---
  const contentSnippet = bodyText.replace(/\s+/g, ' ').slice(0, 3000);

  return {
    words,
    h1, h2, h3,
    ctaCount,
    internal, external,
    imgCount, missingAlt, missingAltPct,
    metaTitle, metaDesc, canonical,
    ogTitle, ogDesc,
    contentSnippet,
    pageUrl,
    scrapedAt: new Date().toISOString(),
  };
}