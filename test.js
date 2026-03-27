// test.js - Updated to match your backend's expected response structure

async function testBackend() {
  console.log('🧪 Testing Backend Connection...\n');

  // Test 1: Health Check
  try {
    console.log('📡 Testing health endpoint...');
    const healthRes = await fetch('http://localhost:3000/health');
    const healthData = await healthRes.json();
    console.log('✅ Health check passed:', healthData);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('💡 Make sure backend is running: node server.js');
    return;
  }

  console.log('\n');

  // Test 2: Analyze Endpoint with correct structure
  try {
    console.log('🤖 Testing analyze endpoint...');
    
    // This matches the structure your backend expects
    const testData = {
      systemPrompt: `You are a senior SEO expert. Analyze the website metrics and return a structured audit.

IMPORTANT: Return ONLY valid JSON with this exact structure:
{
  "summary": "One sentence overall assessment",
  "score": 75,
  "insights": [
    {
      "category": "SEO structure",
      "status": "good",
      "headline": "Good heading structure",
      "text": "The page has proper H1 and H2 structure with X headings total"
    },
    {
      "category": "Messaging clarity",
      "status": "warning",
      "headline": "Message could be clearer",
      "text": "The main value proposition is not immediately clear"
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "impact": "high",
      "title": "Add meta description",
      "text": "Add a compelling meta description to improve CTR from search results"
    }
  ]
}`,
      userPrompt: `Analyze this website:
URL: https://example.com
Word count: 500
H1: 1, H2: 3, H3: 5
CTAs: 2
Images: 10 with 3 missing alt text (30%)
Meta title: "Example Domain"
Meta description: null

Provide a structured audit based on these metrics.`
    };

    console.log('Sending test request...');
    const response = await fetch('http://localhost:3000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Analyze test passed!');
      console.log('\n📊 Parsed Response:');
      console.log('Summary:', data.parsed.summary);
      console.log('Score:', data.parsed.score);
      console.log('\nInsights:');
      data.parsed.insights.forEach((insight, i) => {
        console.log(`  ${i + 1}. [${insight.status}] ${insight.headline}`);
      });
      console.log('\nRecommendations:');
      data.parsed.recommendations.forEach((rec, i) => {
        console.log(`  ${rec.priority}. [${rec.impact}] ${rec.title}`);
      });
    } else {
      console.log('⚠️  Analyze test returned:', data);
      if (data.fallback) {
        console.log('\n📝 Using fallback response (AI parsing failed)');
      }
    }
    
  } catch (error) {
    console.error('❌ Analyze test failed:', error.message);
  }
}

// Run the test
testBackend();