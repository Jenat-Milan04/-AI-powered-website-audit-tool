// src/aiAnalysis.js

const SYSTEM_PROMPT = `You are a senior SEO and conversion rate optimization expert evaluating websites for a web marketing agency.

Your task: Analyze the provided website metrics and content to deliver actionable insights.

CRITICAL RULES:
1. EVERY insight MUST reference specific numbers from the metrics provided
2. NEVER make generic statements like "good content" without citing word count
3. Focus ONLY on: SEO structure, messaging clarity, CTA usage, content depth, and UX concerns
4. Provide 3-5 prioritized, actionable recommendations
5. Return ONLY valid JSON - no markdown, no explanations outside JSON

Required JSON Structure:
{
  "summary": "One sentence overall assessment (max 20 words) that references key metrics",
  "score": <integer 0-100 based on overall quality>,
  "insights": [
    {
      "category": "SEO structure",
      "status": "good|warning|critical",
      "headline": "Short headline (max 8 words)",
      "text": "Detailed insight that MUST include specific numbers"
    },
    {
      "category": "Messaging clarity",
      "status": "good|warning|critical",
      "headline": "Short headline",
      "text": "Must reference word count, heading structure, or content clarity metrics"
    },
    {
      "category": "CTA usage",
      "status": "good|warning|critical",
      "headline": "Short headline",
      "text": "Must reference CTA count and placement"
    },
    {
      "category": "Content depth",
      "status": "good|warning|critical",
      "headline": "Short headline",
      "text": "Must reference word count, paragraph count, or heading structure"
    },
    {
      "category": "UX concerns",
      "status": "good|warning|critical",
      "headline": "Short headline",
      "text": "Must reference image alt text %, link structure, or technical issues"
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "impact": "high|medium|low",
      "title": "Short actionable title (max 8 words)",
      "text": "Specific recommendation with clear reasoning tied to metrics"
    }
  ]
}

The recommendations array must contain 3-5 items. Ensure all insights and recommendations are specific, actionable, and directly reference the factual metrics provided.`;

function buildUserPrompt(metrics) {
  const {
    pageUrl, words, h1, h2, h3, ctaCount,
    internal, external, imgCount, missingAlt, missingAltPct,
    metaTitle, metaDesc, canonical, ogTitle, ogDesc,
    contentSnippet, scrapedAt
  } = metrics

  return `Audit this web page: ${pageUrl}
Scraped at: ${scrapedAt}

=== FACTUAL METRICS ===
Word count: ${words}
Headings — H1: ${h1}, H2: ${h2}, H3: ${h3}
CTAs detected: ${ctaCount}
Links — Internal: ${internal}, External: ${external}
Images: ${imgCount} total, ${missingAlt} missing alt text (${missingAltPct}%)
Meta title: ${metaTitle ? `"${metaTitle}"` : '(not found)'}
Meta description: ${metaDesc ? `"${metaDesc}"` : '(not found)'}
Canonical URL: ${canonical || '(not found)'}
OG title: ${ogTitle || '(not found)'}
OG description: ${ogDesc || '(not found)'}

=== PAGE CONTENT SAMPLE ===
${contentSnippet}

Produce your structured JSON audit now.`
}

export async function runAIAnalysis(metrics) {
  const userPrompt = buildUserPrompt(metrics)

  const promptLog = {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    rawResponse: null,
    parsedOutput: null,
    error: null,
    timestamp: new Date().toISOString(),
  }

  try {
    const BACKEND_URL = 'http://localhost:3000';
    
    console.log('Sending request to backend:', `${BACKEND_URL}/analyze`);
    
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt
      })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.details || data.error || `HTTP ${res.status}`);
    }

    promptLog.rawResponse = data.raw
    
    // Handle the response
    let result;
    
    if (data.parsed && data.parsed.summary && data.parsed.insights && data.parsed.recommendations) {
      // Valid parsed response
      result = data.parsed;
    } else if (data.fallback) {
      // Fallback response from backend
      console.warn('Using fallback response from backend');
      result = data.fallback;
    } else if (data.parsed) {
      // Partial response - create default structure
      console.warn('Partial response received, creating defaults');
      result = {
        summary: data.parsed.summary || "Analysis completed",
        score: data.parsed.score || 50,
        insights: data.parsed.insights || [
          { category: "SEO structure", status: "warning", headline: "Analysis Complete", text: "See recommendations for details" }
        ],
        recommendations: data.parsed.recommendations || [
          { priority: 1, impact: "high", title: "Review Results", text: "The AI analysis completed but with limited data." }
        ]
      };
    } else {
      throw new Error('No valid data in response');
    }
    
    // Ensure insights array has at least 3 items
    if (result.insights.length < 3) {
      result.insights.push(
        { category: "General", status: "warning", headline: "Additional Review Needed", text: "Please run audit again for complete analysis" }
      );
    }
    
    // Ensure recommendations array has at least 3 items
    if (result.recommendations.length < 3) {
      result.recommendations.push(
        { priority: result.recommendations.length + 1, impact: "medium", title: "Run Audit Again", text: "For complete results, please run the audit again." }
      );
    }
    
    promptLog.parsedOutput = result

    return {
      result: result,
      promptLog
    }

  } catch (err) {
    console.error('AI Analysis Error:', err);
    promptLog.error = err.message
    
    // Create a meaningful fallback result
    const fallbackResult = {
      summary: "Analysis completed with available data",
      score: 50,
      insights: [
        { category: "SEO structure", status: "warning", headline: "Analysis Available", text: "Basic analysis completed. Review metrics for details." },
        { category: "Content", status: "info", headline: "Review Metrics", text: `${metrics.words} words and ${metrics.h1} H1 tags found.` },
        { category: "Recommendations", status: "info", headline: "See Below", text: "Check recommendations for improvements." }
      ],
      recommendations: [
        { priority: 1, impact: "high", title: "Review SEO Metrics", text: `Page has ${metrics.h1} H1 tags and ${metrics.missingAltPct}% images missing alt text.` },
        { priority: 2, impact: "medium", title: "Improve CTAs", text: `Only ${metrics.ctaCount} CTAs detected. Consider adding more.` },
        { priority: 3, impact: "medium", title: "Content Depth", text: `${metrics.words} words provides moderate content depth. Consider expanding key sections.` }
      ]
    };
    
    throw { 
      message: err.message, 
      promptLog,
      fallback: fallbackResult
    };
  }
}


// Add this at the very end of aiAnalysis.js

// Export for UI to display prompt structure
export function getPromptTemplates() {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPromptExample: buildUserPrompt({
      pageUrl: "https://example.com",
      words: 500,
      h1: 1,
      h2: 3,
      h3: 5,
      ctaCount: 2,
      internal: 15,
      external: 8,
      imgCount: 10,
      missingAlt: 3,
      missingAltPct: 30,
      metaTitle: "Example Domain",
      metaDesc: null,
      canonical: null,
      ogTitle: null,
      ogDesc: null,
      contentSnippet: "This is an example content snippet for demonstration purposes...",
      scrapedAt: new Date().toISOString()
    }),
    buildUserPrompt: buildUserPrompt
  };
}