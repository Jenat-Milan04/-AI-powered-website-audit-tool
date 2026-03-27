import { useState, useEffect } from 'react'
import { fetchHTML, extractMetrics } from './scraper'
import { runAIAnalysis } from './aiAnalysis'
import styles from './App.module.css'
import Splash from './splash'

const STEPS = ['idle', 'fetching', 'extracting', 'analyzing', 'done', 'error']

function StatusBadge({ status }) {
  const map = {
    good: { label: 'Good', cls: styles.tagGood },
    warning: { label: 'Warning', cls: styles.tagWarn },
    critical: { label: 'Critical', cls: styles.tagCrit },
  }
  const s = map[status] || map.warning
  return <span className={`${styles.tag} ${s.cls}`}>{s.label}</span>
}

function ImpactBadge({ impact }) {
  const map = {
    high: styles.impHigh,
    medium: styles.impMed,
    low: styles.impLow,
  }
  return <span className={`${styles.impact} ${map[impact] || ''}`}>{impact} impact</span>
}

function MetricCard({ value, label, highlight }) {
  return (
    <div className={`${styles.metricCard} ${highlight ? styles.metricHighlight : ''}`}>
      <div className={styles.metricVal}>{value ?? '—'}</div>
      <div className={styles.metricLbl}>{label}</div>
    </div>
  )
}

export default function App() {
  const [url, setUrl] = useState('')
  const [step, setStep] = useState('idle')
  const [metrics, setMetrics] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [promptLog, setPromptLog] = useState(null)
  const [error, setError] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [backendStatus, setBackendStatus] = useState(null)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  // Check backend connection on load
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:3000/health')
        if (response.ok) {
          setBackendStatus('connected')
          console.log('✅ Backend connected')
        } else {
          setBackendStatus('error')
          console.error('❌ Backend returned error')
        }
      } catch (error) {
        setBackendStatus('disconnected')
        console.error('❌ Backend not reachable:', error.message)
      }
    }
    checkBackend()
  }, [])

  async function handleAudit() {
    if (!url.trim() || !url.startsWith('http')) {
      setError('Please enter a valid URL starting with http:// or https://')
      return
    }
    
    setError('')
    setStep('fetching')
    setMetrics(null)
    setAiResult(null)
    setPromptLog(null)
    setShowLog(false)

    console.log('🔍 Starting audit for:', url)

    let html
    try {
      console.log('Step 1: Fetching HTML...')
      html = await fetchHTML(url.trim())
      console.log('✅ HTML fetched, length:', html.length)
    } catch (e) {
      console.error('❌ Fetch error:', e)
      setError(`Could not fetch the page: ${e.message}. The site may block cross-origin requests.`)
      setStep('error')
      return
    }

    setStep('extracting')
    console.log('Step 2: Extracting metrics...')
    const m = extractMetrics(html, url.trim())
    setMetrics(m)
    console.log('✅ Metrics extracted:', {
      words: m.words,
      h1: m.h1,
      h2: m.h2,
      h3: m.h3,
      ctaCount: m.ctaCount,
      internal: m.internal,
      external: m.external,
      imgCount: m.imgCount,
      missingAltPct: m.missingAltPct
    })

    setStep('analyzing')
    console.log('Step 3: Starting AI analysis...')
    try {
      const { result, promptLog: log } = await runAIAnalysis(m);
      console.log('✅ AI analysis successful:', result)
      
      if (result && result.summary && result.score !== undefined) {
        setAiResult(result);
        setStep('done');
        console.log('🎉 Audit completed successfully!')
      } else {
        console.warn('⚠️ AI result missing required fields, using fallback')
        setAiResult({
          summary: "Analysis completed with limited data",
          score: 50,
          insights: [{ 
            category: "Info", 
            status: "warning", 
            headline: "Partial Analysis", 
            text: "The AI response was incomplete. Please try again." 
          }],
          recommendations: [{ 
            priority: 1, 
            impact: "medium", 
            title: "Try Again", 
            text: "Please run the audit again for complete results." 
          }]
        });
        setStep('done');
      }
      
      setPromptLog(log);
    } catch (e) {
      console.error('❌ AI analysis error:', e);
      console.error('Error details:', e.message);
      if (e.promptLog) {
        console.log('Prompt log available:', e.promptLog);
      }
      
      if (e.fallback) {
        console.log('Using fallback result from error')
        setAiResult(e.fallback);
        setStep('done');
      } else {
        setError(`AI analysis failed: ${e.message}`);
        setStep('error');
      }
      
      if (e.promptLog) setPromptLog(e.promptLog);
    }
  }

  const stepLabel = {
    fetching: 'Fetching page via proxy...',
    extracting: 'Extracting metrics from HTML...',
    analyzing: 'Running AI analysis...',
  }[step] || ''

  if (showSplash) {
    return <Splash onFinish={() => setShowSplash(false)} />
  }

 return (
  <div className={styles.app}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.logoContainer}>
          <div className={styles.logo}>
            <span className={styles.logoDot}></span>
            <span className={styles.logoText}>Auditly</span>
          </div>
          <p className={styles.headerSub}>AI-powered website audit — by JENAT MILAN</p>
        </div>
      </div>
    </header>

    <main className={styles.main}>
      {/* Input */}
      <div className={styles.inputSection}>
        <div className={styles.urlRow}>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAudit()}
            placeholder="https://yourwebsite.com"
            className={styles.urlInput}
            disabled={['fetching','extracting','analyzing'].includes(step)}
          />
          <button
            className={styles.auditBtn}
            onClick={handleAudit}
            disabled={['fetching','extracting','analyzing'].includes(step) || backendStatus === 'disconnected'}
          >
            {['fetching','extracting','analyzing'].includes(step) ? 'Auditing...' : 'Run audit →'}
          </button>
        </div>
        {backendStatus === 'disconnected' && (
          <div className={styles.warningBox}>
            ⚠️ Backend server not running. Please run <code>node server.js</code> in another terminal.
          </div>
        )}
      </div>

      {/* Status */}
      {stepLabel && (
        <div className={styles.statusBar}>
          <span className={styles.spinner} />
          {stepLabel}
        </div>
      )}

      {error && <div className={styles.errorBar}>{error}</div>}

      {/* Results */}
      {metrics && (
        <div className={styles.results}>
          {/* Score */}
          {aiResult && (
            <div className={styles.scoreRow}>
              <div className={styles.scoreCircle}>
                <svg viewBox="0 0 80 80" className={styles.scoreRing}>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={aiResult.score >= 70 ? '#4ade80' : aiResult.score >= 40 ? '#fb923c' : '#f87171'}
                    strokeWidth="6"
                    strokeDasharray={`${(aiResult.score / 100) * 213.6} 213.6`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className={styles.scoreNum}>{aiResult.score}%</div>
              </div>
              <div className={styles.scoreMeta}>
                <div className={styles.scoreLabel}>Page health score</div>
                <div className={styles.scoreSummary}>{aiResult.summary}</div>
                <div className={styles.scoreUrl}>{metrics.pageUrl}</div>
              </div>
            </div>
          )}

          <div className={styles.divider} />

          {/* Factual Metrics */}
          <div className={styles.sectionLabel}>
            <span className={styles.sectionDot} />
            Factual metrics
            <span className={styles.sectionNote}>extracted from HTML — no AI</span>
          </div>

          <div className={styles.metricsGrid}>
            <MetricCard value={metrics.words.toLocaleString()} label="Word count" />
            <MetricCard value={metrics.h1} label="H1 headings" highlight={metrics.h1 !== 1} />
            <MetricCard value={metrics.h2} label="H2 headings" />
            <MetricCard value={metrics.h3} label="H3 headings" />
            <MetricCard value={metrics.ctaCount} label="CTAs" highlight={metrics.ctaCount === 0} />
            <MetricCard value={metrics.internal} label="Internal links" />
            <MetricCard value={metrics.external} label="External links" />
            <MetricCard value={metrics.imgCount} label="Images" />
            <MetricCard value={`${metrics.missingAltPct}%`} label="Missing alt text" highlight={metrics.missingAltPct > 20} />
          </div>

          <div className={styles.metaBox}>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Meta title</span>
              <span className={styles.metaVal}>{metrics.metaTitle || <em>not found</em>}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Meta description</span>
              <span className={styles.metaVal}>{metrics.metaDesc || <em>not found</em>}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Canonical</span>
              <span className={styles.metaVal}>{metrics.canonical || <em>not found</em>}</span>
            </div>
            {metrics.ogTitle && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>OG title</span>
                <span className={styles.metaVal}>{metrics.ogTitle}</span>
              </div>
            )}
          </div>

          {/* AI Insights */}
          {aiResult && aiResult.insights && (
            <>
              <div className={styles.divider} />
              <div className={styles.sectionLabel}>
                <span className={styles.sectionDot} style={{ background: 'var(--accent)' }} />
                AI insights
                <span className={styles.sectionNote}>generated by AI, grounded in metrics above</span>
              </div>

              <div className={styles.insightsList}>
                {aiResult.insights.map((ins, i) => (
                  <div key={i} className={styles.insightCard}>
                    <div className={styles.insightHeader}>
                      <StatusBadge status={ins.status} />
                      <span className={styles.insightCat}>{ins.category}</span>
                      <span className={styles.insightHeadline}>{ins.headline}</span>
                    </div>
                    <p className={styles.insightText}>{ins.text}</p>
                  </div>
                ))}
              </div>

              <div className={styles.divider} />
              <div className={styles.sectionLabel}>
                <span className={styles.sectionDot} style={{ background: '#60a5fa' }} />
                Prioritised recommendations
              </div>

              <div className={styles.recList}>
                {aiResult.recommendations.map((rec, i) => (
                  <div key={i} className={styles.recItem}>
                    <div className={styles.recNum}>{rec.priority}</div>
                    <div className={styles.recBody}>
                      <div className={styles.recTop}>
                        <span className={styles.recTitle}>{rec.title}</span>
                        <ImpactBadge impact={rec.impact} />
                      </div>
                      <p className={styles.recText}>{rec.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  </div>
)
}