function repairJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    let cleaned = jsonString.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
    cleaned = cleaned.replace(/(\w+):/g, '"$1":').replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      const lastValidPos = cleaned.lastIndexOf('}');
      if (lastValidPos > 0) {
        try { return JSON.parse(cleaned.substring(0, lastValidPos + 1)); } catch (_) {}
      }
      throw new Error('Unable to repair JSON');
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { systemPrompt, userPrompt } = req.body;
  if (!systemPrompt || !userPrompt) return res.status(400).json({ error: 'Missing required fields' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192, topP: 0.95 }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ error: 'Gemini API request failed', details: errorData });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) return res.status(500).json({ error: 'No response text from AI' });

    try {
      let parsed = repairJSON(rawText);
      parsed = {
        summary: parsed.summary || 'Analysis completed',
        score: typeof parsed.score === 'number' ? parsed.score : 50,
        insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : []
      };
      return res.json({ success: true, raw: rawText, parsed });
    } catch (parseError) {
      return res.status(500).json({
        error: 'Failed to parse AI response',
        details: parseError.message,
        rawText: rawText.substring(0, 500),
        fallback: {
          summary: 'Partial analysis available',
          score: 50,
          insights: [{ category: 'Info', status: 'warning', headline: 'Partial Results', text: 'AI response was truncated' }],
          recommendations: [{ priority: 1, impact: 'medium', title: 'Try Again', text: 'Please run the audit again' }]
        }
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
