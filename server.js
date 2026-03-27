const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Proxy endpoint to fetch websites (bypasses CORS)
app.post("/fetch-page", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    console.log(`🌐 Attempting to fetch: ${url}`);
    
    // Try direct fetch first
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        console.log(`✅ Direct fetch successful: ${html.length} bytes`);
        return res.json({ success: true, html: html, url: url });
      }
    } catch (directError) {
      console.log('Direct fetch failed, trying proxy...');
    }
    
    // Fallback to public CORS proxy
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const proxyResponse = await fetch(proxyUrl);
    
    if (!proxyResponse.ok) {
      throw new Error(`Proxy returned ${proxyResponse.status}`);
    }
    
    const proxyData = await proxyResponse.json();
    
    if (!proxyData.contents) {
      throw new Error('No content from proxy');
    }
    
    console.log(`✅ Proxy fetch successful: ${proxyData.contents.length} bytes`);
    
    res.json({
      success: true,
      html: proxyData.contents,
      url: url,
      viaProxy: true
    });
    
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error.message);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch webpage", 
      details: error.message,
      suggestion: "The website might be blocking requests. Try a different URL."
    });
  }
});

// JSON repair function
function repairJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    let cleaned = jsonString.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
    
    cleaned = cleaned.replace(/(\w+):/g, '"$1":');
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      let lastValidPos = cleaned.lastIndexOf('}');
      if (lastValidPos > 0) {
        const truncated = cleaned.substring(0, lastValidPos + 1);
        try {
          return JSON.parse(truncated);
        } catch (e3) {}
      }
      throw new Error("Unable to repair JSON");
    }
  }
}

app.post("/analyze", async (req, res) => {
  const { systemPrompt, userPrompt } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ 
      error: "Missing required fields" 
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: "API key not configured" 
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            topP: 0.95
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ 
        error: "Gemini API request failed", 
        details: errorData 
      });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) {
      return res.status(500).json({ 
        error: "No response text from AI" 
      });
    }

    let parsed;
    try {
      parsed = repairJSON(rawText);
      
      // Ensure required fields exist
      parsed = {
        summary: parsed.summary || "Analysis completed",
        score: typeof parsed.score === 'number' ? parsed.score : 50,
        insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : []
      };
      
    } catch (parseError) {
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        details: parseError.message,
        rawText: rawText.substring(0, 500),
        fallback: {
          summary: "Partial analysis available",
          score: 50,
          insights: [{ category: "Info", status: "warning", headline: "Partial Results", text: "AI response was truncated" }],
          recommendations: [{ priority: 1, impact: "medium", title: "Try Again", text: "Please run the audit again" }]
        }
      });
    }

    res.json({
      success: true,
      raw: rawText,
      parsed: parsed
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      details: err.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Proxy endpoint: POST http://localhost:${PORT}/fetch-page`);
  console.log(`🔍 Analyze endpoint: POST http://localhost:${PORT}/analyze`);
});