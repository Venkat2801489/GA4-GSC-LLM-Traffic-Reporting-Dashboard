/**
 * ga4-api.js — Google Analytics 4 + Google Search Console API Integration
 * Uses Google Identity Services (GIS) OAuth2 implicit token flow.
 * No server required. Users sign in with their own Google account.
 */

const GA4_API = (() => {

  // ── LLM Sources (regex filter) ────────────────────────────────
  const LLM_SOURCES = [
    'chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'claude.ai',
    'gemini.google.com', 'copilot.microsoft.com', 'bard.google.com',
    'you.com', 'phind.com', 'poe.com', 'character.ai', 'bing.com',
    'meta.ai', 'grok.x.ai', 'mistral.ai', 'groq.com', 'openrouter.ai'
  ];

  const LLM_LABEL_MAP = {
    'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT',
    'perplexity.ai': 'Perplexity', 'claude.ai': 'Claude',
    'gemini.google.com': 'Gemini', 'copilot.microsoft.com': 'Copilot',
    'bard.google.com': 'Bard (Legacy)', 'you.com': 'You.com',
    'phind.com': 'Phind', 'poe.com': 'Poe',
    'character.ai': 'Character.AI', 'bing.com': 'Bing AI',
    'meta.ai': 'Meta AI', 'grok.x.ai': 'Grok',
    'mistral.ai': 'Mistral', 'groq.com': 'Groq',
    'openrouter.ai': 'OpenRouter'
  };

  let _tokenClient = null;
  let _accessToken = null;
  let _clientId = '';
  let _isMock = false;

  // ── Init ──────────────────────────────────────────────────────

  function init(clientId) {
    _clientId = clientId;
    if (!clientId || clientId.includes('YOUR_CLIENT_ID')) {
      _isMock = true;
      console.info('[GA4_API] No Client ID — running in demo/mock mode');
      return;
    }
    const saved = sessionStorage.getItem('llm_dash_token');
    if (saved) _accessToken = saved;
  }

  function initTokenClient(callback) {
    if (_isMock) { callback(null, 'mock'); return; }
    if (!window.google) { callback(null, 'gis-not-loaded'); return; }

    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/analytics',
        'https://www.googleapis.com/auth/webmasters.readonly'
      ].join(' '),
      callback: (resp) => {
        if (resp.error) { callback(null, resp.error); return; }
        _accessToken = resp.access_token;
        sessionStorage.setItem('llm_dash_token', _accessToken);
        callback(_accessToken, null);
      }
    });

    callback(_accessToken, _accessToken ? null : 'need-sign-in');
  }

  function signIn(callback) {
    if (_isMock) { callback('mock', null); return; }
    if (!_tokenClient) { initTokenClient(callback); return; }
    _tokenClient.requestAccessToken({ prompt: '' });
  }

  function signOut() {
    if (_accessToken && !_isMock) {
      try { google.accounts.oauth2.revoke(_accessToken, () => { }); } catch (e) { }
    }
    _accessToken = null; _isMock = false;
    sessionStorage.removeItem('llm_dash_token');
    sessionStorage.removeItem('llm_dash_property');
    sessionStorage.removeItem('llm_dash_gsc_url');
  }

  function isAuthenticated() { return _isMock || !!_accessToken; }
  function isMockMode() { return _isMock; }
  function getLlmSources() { return LLM_SOURCES; }
  function getLlmLabel(source) { return LLM_LABEL_MAP[source] || source; }

  // ── HTTP ───────────────────────────────────────────────────────

  async function _get(url) {
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${_accessToken}` } });
    if (!r.ok) {
      if (r.status === 401) { _accessToken = null; sessionStorage.removeItem('llm_dash_token'); throw new Error('TOKEN_EXPIRED'); }
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error?.message || `HTTP ${r.status}`);
    }
    return r.json();
  }

  async function _post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${_accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      if (r.status === 401) { _accessToken = null; sessionStorage.removeItem('llm_dash_token'); throw new Error('TOKEN_EXPIRED'); }
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error?.message || `HTTP ${r.status}`);
    }
    return r.json();
  }

  // ── Parse GA4 response ────────────────────────────────────────

  function parse(resp) {
    if (!resp || !resp.rows) return [];
    const dims = (resp.dimensionHeaders || []).map(h => h.name);
    const mets = (resp.metricHeaders || []).map(h => h.name);
    return resp.rows.map(row => {
      const obj = {};
      dims.forEach((d, i) => { obj[d] = row.dimensionValues[i]?.value || ''; });
      mets.forEach((m, i) => { obj[m] = parseFloat(row.metricValues[i]?.value) || 0; });
      return obj;
    });
  }

  // ── Report runner ────────────────────────────────────────────

  async function runReport(propertyId, body) {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    return parse(await _post(url, body));
  }

  // ── Filters ──────────────────────────────────────────────────

  function llmFilter() {
    return {
      filter: {
        fieldName: 'sessionSource',
        inListFilter: { values: LLM_SOURCES, caseSensitive: false }
      }
    };
  }

  function notLlmFilter() {
    return {
      notExpression: {
        filter: {
          fieldName: 'sessionSource',
          inListFilter: { values: LLM_SOURCES, caseSensitive: false }
        }
      }
    };
  }

  function dr(startDate, endDate) { return { startDate, endDate }; }

  // ── Properties ───────────────────────────────────────────────

  async function listProperties() {
    if (_isMock) return _mockProperties();
    const data = await _get('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200');
    const list = [];
    (data.accountSummaries || []).forEach(acc => {
      (acc.propertySummaries || []).forEach(p => {
        list.push({
          id: p.property.replace('properties/', ''),
          displayName: p.displayName || 'Unnamed Property',
          account: acc.displayName || 'Unnamed Account'
        });
      });
    });
    return list;
  }

  // ════════════════════════════════════════════════════════════
  //  LLM TAB — Methods
  // ════════════════════════════════════════════════════════════

  async function fetchKPIs(propId, sd, ed) {
    if (_isMock) return _mockKPIs();
    const prev = _prevPeriod(sd, ed);
    const [llm, all, prevLlm, prevAll] = await Promise.all([
      runReport(propId, { dateRanges: [dr(sd, ed)], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }, { name: 'engagementRate' }], dimensionFilter: llmFilter() }),
      runReport(propId, { dateRanges: [dr(sd, ed)], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }] }),
      runReport(propId, { dateRanges: [dr(prev.sd, prev.ed)], metrics: [{ name: 'sessions' }], dimensionFilter: llmFilter() }),
      runReport(propId, { dateRanges: [dr(prev.sd, prev.ed)], metrics: [{ name: 'sessions' }] })
    ]);
    const l = llm[0] || {}, a = all[0] || {}, pl = prevLlm[0] || {}, pa = prevAll[0] || {};
    const llmSess = l.sessions || 0, allSess = a.sessions || 0;
    const prevLlmSess = pl.sessions || 0, prevAllSess = pa.sessions || 0;
    return {
      llmSessions: llmSess, llmSessionsDelta: _pct(llmSess, prevLlmSess),
      llmPercent: allSess ? (llmSess / allSess * 100) : 0,
      llmPercentDelta: _pct(allSess ? llmSess / allSess : 0, prevAllSess ? prevLlmSess / prevAllSess : 0),
      avgEngagementTime: l.averageSessionDuration || 0,
      bounceRate: (l.bounceRate || 0) * 100,
      llmUsers: l.totalUsers || 0, totalSessions: allSess, totalUsers: a.totalUsers || 0
    };
  }

  async function fetchDailyLLMSessions(propId, sd, ed) {
    if (_isMock) return _mockDaily(sd, ed);
    return runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], dimensionFilter: llmFilter(), orderBys: [{ dimension: { dimensionName: 'date' } }] });
  }

  async function fetchDailyAllSessions(propId, sd, ed) {
    if (_isMock) return _mockDailyAll(sd, ed);
    return runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }] });
  }

  async function fetchSourceBreakdown(propId, sd, ed) {
    if (_isMock) return _mockSourceBreakdown();
    return runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }, { name: 'engagementRate' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 });
  }

  async function fetchLLMSourceDetail(propId, sd, ed) {
    if (_isMock) return _mockLLMDetail();
    return runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }, { name: 'engagementRate' }], dimensionFilter: llmFilter(), orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 15 });
  }

  async function fetchWoW(propId, sd, ed) {
    if (_isMock) return _mockWoW(sd, ed);
    const prev = _prevPeriod(sd, ed);
    const [curr, prev_] = await Promise.all([fetchDailyLLMSessions(propId, sd, ed), fetchDailyLLMSessions(propId, prev.sd, prev.ed)]);
    return { current: curr, previous: prev_ };
  }

  async function fetchMoMBySource(propId) {
    if (_isMock) return _mockMoM();
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = _fmt(d), lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const end = _fmt(lastDay > now ? now : lastDay);
      months.push({ start, end, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
    }
    const results = await Promise.all(months.map(m =>
      runReport(propId, { dateRanges: [dr(m.start, m.end)], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], dimensionFilter: llmFilter(), limit: 10 })
        .then(rows => ({ ...m, rows })).catch(() => ({ ...m, rows: [] }))
    ));
    return { months, results };
  }

  async function fetchTopLandingPages(propId, sd, ed) {
    if (_isMock) return _mockLandingPages();
    return runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }, { name: 'engagementRate' }, { name: 'bounceRate' }], dimensionFilter: llmFilter(), orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 });
  }

  async function fetchEngagementQuality(propId, sd, ed) {
    if (_isMock) return _mockEngQuality();
    return runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }, { name: 'engagementRate' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 20 });
  }

  // ════════════════════════════════════════════════════════════
  //  GA4 TAB — Methods (non-LLM traffic)
  // ════════════════════════════════════════════════════════════

  async function fetchTrafficAcquisition(propId, sd, ed) {
    if (_isMock) return _mockTrafficAcquisition();
    const prev = _prevPeriod(sd, ed);
    const [curr, prevData] = await Promise.all([
      runReport(propId, {
        dateRanges: [dr(sd, ed)],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' }, { name: 'newUsers' }, { name: 'totalUsers' },
          { name: 'engagedSessions' }, { name: 'engagementRate' },
          { name: 'bounceRate' }, { name: 'averageSessionDuration' }, { name: 'sessionsPerUser' }
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20
      }),
      runReport(propId, {
        dateRanges: [dr(prev.sd, prev.ed)],
        metrics: [{ name: 'sessions' }, { name: 'newUsers' }, { name: 'engagementRate' }, { name: 'averageSessionDuration' }]
      })
    ]);
    const totals = curr.reduce((acc, r) => {
      acc.sessions += r.sessions || 0; acc.newUsers += r.newUsers || 0;
      acc.totalUsers += r.totalUsers || 0; acc.engagedSessions += r.engagedSessions || 0;
      return acc;
    }, { sessions: 0, newUsers: 0, totalUsers: 0, engagedSessions: 0 });
    if (totals.sessions > 0) {
      totals.engagementRate = totals.engagedSessions / totals.sessions;
      totals.bounceRate = 1 - totals.engagementRate;
    } else { totals.engagementRate = 0; totals.bounceRate = 0; }
    const avgDur = curr.length ? curr.reduce((s, r) => s + (r.averageSessionDuration || 0), 0) / curr.length : 0;
    totals.averageSessionDuration = avgDur;
    const prevRow = prevData[0] || {};
    totals.sessionsDelta = _pct(totals.sessions, prevRow.sessions || 0);
    totals.newUsersDelta = _pct(totals.newUsers, prevRow.newUsers || 0);
    totals.engagementDelta = _pct(totals.engagementRate, prevRow.engagementRate || 0);
    totals.durationDelta = _pct(totals.averageSessionDuration, prevRow.averageSessionDuration || 0);
    return { totals, rows: curr };
  }

  async function fetchTopPages(propId, sd, ed) {
    if (_isMock) return _mockTopPages();
    return runReport(propId, {
      dateRanges: [dr(sd, ed)],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }, { name: 'engagedSessions' }, { name: 'engagementRate' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 25
    });
  }

  async function fetchConversions(propId, sd, ed) {
    if (_isMock) return _mockConversions();
    const [byName, byChannel] = await Promise.all([
      runReport(propId, {
        dateRanges: [dr(sd, ed)],
        dimensions: [{ name: 'keyEventName' }],
        metrics: [{ name: 'keyEvents' }, { name: 'sessionKeyEventRate' }, { name: 'userKeyEventRate' }],
        orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }],
        limit: 20
      }),
      runReport(propId, {
        dateRanges: [dr(sd, ed)],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'keyEvents' }, { name: 'sessionKeyEventRate' }],
        orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }],
        limit: 10
      })
    ]);
    const totalKeyEvents = byName.reduce((s, r) => s + (r.keyEvents || 0), 0);
    const avgSessionKER = byName.length ? byName.reduce((s, r) => s + (r.sessionKeyEventRate || 0), 0) / byName.length : 0;
    const avgUserKER = byName.length ? byName.reduce((s, r) => s + (r.userKeyEventRate || 0), 0) / byName.length : 0;
    return { totalKeyEvents, avgSessionKER, avgUserKER, byName, byChannel };
  }

  async function fetchAudience(propId, sd, ed) {
    if (_isMock) return _mockAudience();
    const [devices, countries, browsers] = await Promise.all([
      runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'engagementRate' }] }),
      runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'country' }], metrics: [{ name: 'sessions' }, { name: 'newUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 15 }),
      runReport(propId, { dateRanges: [dr(sd, ed)], dimensions: [{ name: 'browser' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 })
    ]);
    const totalSess = devices.reduce((s, r) => s + (r.sessions || 0), 0);
    return { devices, countries, browsers, total: totalSess };
  }

  // ════════════════════════════════════════════════════════════
  //  GSC TAB — Methods
  // ════════════════════════════════════════════════════════════

  async function _gscPost(siteUrl, body) {
    const encoded = encodeURIComponent(siteUrl);
    const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
    return _post(url, body);
  }

  function _parseGSC(data) {
    return (data.rows || []).map(r => {
      const obj = { clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position || 0 };
      (r.keys || []).forEach((k, i) => { obj[`key${i}`] = k; });
      return obj;
    });
  }

  async function fetchGSCOverview(siteUrl, sd, ed) {
    if (_isMock) return _mockGSCOverview(sd, ed);
    const [daily, totals] = await Promise.all([
      _gscPost(siteUrl, { startDate: sd, endDate: ed, dimensions: ['date'], searchType: 'web', rowLimit: 90 }).then(_parseGSC),
      _gscPost(siteUrl, { startDate: sd, endDate: ed, searchType: 'web' }).then(d => ({
        clicks: (d.rows || []).reduce((s, r) => s + r.clicks, 0) || d.totals?.clicks || 0,
        impressions: (d.rows || []).reduce((s, r) => s + r.impressions, 0) || d.totals?.impressions || 0,
        ctr: d.totals?.ctr || 0,
        position: d.totals?.position || 0
      }))
    ]);
    // Compute totals from daily if needed
    if (!totals.clicks) {
      totals.clicks = daily.reduce((s, r) => s + r.clicks, 0);
      totals.impressions = daily.reduce((s, r) => s + r.impressions, 0);
      const w = daily.filter(r => r.impressions > 0);
      totals.ctr = w.length ? w.reduce((s, r) => s + r.ctr, 0) / w.length : 0;
      totals.position = w.length ? w.reduce((s, r) => s + r.position, 0) / w.length : 0;
    }
    return { daily, totals };
  }

  async function fetchGSCQueries(siteUrl, sd, ed) {
    if (_isMock) return _mockGSCQueries();
    const raw = await _gscPost(siteUrl, { startDate: sd, endDate: ed, dimensions: ['query'], searchType: 'web', rowLimit: 500 });
    const rows = _parseGSC(raw).map(r => ({ query: r.key0, ...r }));
    rows.sort((a, b) => b.clicks - a.clicks);
    const top50 = rows.slice(0, 50);
    const ctrOpps = rows.filter(r => r.impressions > 500 && r.ctr < 0.02);
    const rankOpps = rows.filter(r => r.position > 3 && r.position <= 10);
    return { top50, ctrOpps, rankOpps };
  }

  async function fetchGSCPages(siteUrl, sd, ed) {
    if (_isMock) return _mockGSCPages();
    const raw = await _gscPost(siteUrl, { startDate: sd, endDate: ed, dimensions: ['page'], searchType: 'web', rowLimit: 50 });
    return _parseGSC(raw).map(r => ({ page: r.key0, ...r })).sort((a, b) => b.clicks - a.clicks);
  }

  async function fetchGSCDevicesCountries(siteUrl, sd, ed) {
    if (_isMock) return _mockGSCDevicesCountries();
    const [devRaw, ctryRaw] = await Promise.all([
      _gscPost(siteUrl, { startDate: sd, endDate: ed, dimensions: ['device'], searchType: 'web', rowLimit: 10 }),
      _gscPost(siteUrl, { startDate: sd, endDate: ed, dimensions: ['country'], searchType: 'web', rowLimit: 20 })
    ]);
    return {
      devices: _parseGSC(devRaw).map(r => ({ device: r.key0, ...r })),
      countries: _parseGSC(ctryRaw).map(r => ({ country: r.key0, ...r }))
    };
  }

  // ════════════════════════════════════════════════════════════
  //  BLENDED — Methods
  // ════════════════════════════════════════════════════════════

  function computeBlended({ gscTotals, ga4Rows, gscPages, ga4Landing }) {
    // Tracking gap: (GSC Clicks - GA4 Organic Sessions) / GSC Clicks
    const organicRow = (ga4Rows || []).find(r => (r.sessionDefaultChannelGroup || '').toLowerCase().includes('organic'));
    const ga4OrganicSessions = organicRow ? (organicRow.sessions || 0) : 0;
    const gscClicks = (gscTotals || {}).clicks || 0;
    const trackingGap = gscClicks > 0 ? ((gscClicks - ga4OrganicSessions) / gscClicks * 100) : null;

    // Organic CR: GA4 Key Events from Organic / GSC Clicks
    // (stored on blended state)
    const contentEfficiency = gscClicks > 0 && organicRow
      ? ((organicRow.engagedSessions || 0) / gscClicks * 100) : null;

    // Page match table
    const pageMap = {};
    (gscPages || []).forEach(p => {
      try {
        const path = new URL(p.page).pathname;
        pageMap[path] = { ...p, path };
      } catch { pageMap[p.page] = { ...p, path: p.page }; }
    });
    const matchTable = [];
    (ga4Landing || []).slice(0, 20).forEach(lp => {
      const path = lp.landingPage || '';
      const gsc = pageMap[path] || {};
      const gap = gsc.clicks > 0 ? ((gsc.clicks - lp.sessions) / gsc.clicks * 100) : null;
      matchTable.push({ path, ga4Sessions: lp.sessions || 0, gscClicks: gsc.clicks || 0, trackingGap: gap, engagementRate: lp.engagementRate || 0 });
    });

    return { trackingGap, contentEfficiency, gscClicks, ga4OrganicSessions, matchTable };
  }

  // ════════════════════════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════════════════════════

  function _fmt(d) { return d.toISOString().slice(0, 10); }

  function _prevPeriod(sd, ed) {
    const s = new Date(sd), e = new Date(ed);
    const days = Math.round((e - s) / 86400000) + 1;
    const ps = new Date(s); ps.setDate(ps.getDate() - days);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    return { sd: _fmt(ps), ed: _fmt(pe) };
  }

  function _pct(curr, prev) { if (!prev) return 0; return ((curr - prev) / prev) * 100; }

  // ════════════════════════════════════════════════════════════
  //  MOCK DATA
  // ════════════════════════════════════════════════════════════

  function _mockProperties() {
    return [
      { id: '123456789', displayName: 'My Website — GA4', account: 'My Company' },
      { id: '987654321', displayName: 'Blog Property', account: 'My Company' },
      { id: '111222333', displayName: 'E-commerce Store', account: 'Store Account' }
    ];
  }

  function _mockKPIs() {
    return { llmSessions: 8420, llmSessionsDelta: 24.5, llmPercent: 16.1, llmPercentDelta: 3.2, avgEngagementTime: 185, bounceRate: 42.3, llmUsers: 6840, totalSessions: 52150, totalUsers: 41800 };
  }

  function _mockDaily(sd, ed) {
    const rows = []; let d = new Date(sd); const end = new Date(ed);
    while (d <= end) {
      const base = 240 + Math.sin(d.getDay()) * 60;
      rows.push({ date: _fmt(d).replace(/-/g, ''), sessions: Math.round(base + Math.random() * 180), totalUsers: Math.round(base * 0.82 + Math.random() * 140) });
      d.setDate(d.getDate() + 1);
    }
    return rows;
  }

  function _mockDailyAll(sd, ed) {
    const rows = []; let d = new Date(sd); const end = new Date(ed);
    while (d <= end) {
      rows.push({ date: _fmt(d).replace(/-/g, ''), sessions: Math.round(1400 + Math.random() * 600) });
      d.setDate(d.getDate() + 1);
    }
    return rows;
  }

  function _mockSourceBreakdown() {
    return [
      { sessionDefaultChannelGroup: 'Organic Search', sessions: 21500, totalUsers: 18200, averageSessionDuration: 210, bounceRate: 0.38, engagementRate: 0.62 },
      { sessionDefaultChannelGroup: 'Direct', sessions: 12100, totalUsers: 10500, averageSessionDuration: 145, bounceRate: 0.55, engagementRate: 0.45 },
      { sessionDefaultChannelGroup: 'Referral', sessions: 8420, totalUsers: 6840, averageSessionDuration: 185, bounceRate: 0.42, engagementRate: 0.58 },
      { sessionDefaultChannelGroup: 'Social', sessions: 5800, totalUsers: 4900, averageSessionDuration: 95, bounceRate: 0.68, engagementRate: 0.32 },
      { sessionDefaultChannelGroup: 'Paid Search', sessions: 3200, totalUsers: 2800, averageSessionDuration: 175, bounceRate: 0.48, engagementRate: 0.52 },
      { sessionDefaultChannelGroup: 'Email', sessions: 1130, totalUsers: 980, averageSessionDuration: 165, bounceRate: 0.35, engagementRate: 0.65 }
    ];
  }

  function _mockLLMDetail() {
    return [
      { sessionSource: 'chatgpt.com', sessions: 3850, totalUsers: 3120, averageSessionDuration: 210, engagementRate: 0.67, bounceRate: 0.33 },
      { sessionSource: 'perplexity.ai', sessions: 2100, totalUsers: 1740, averageSessionDuration: 195, engagementRate: 0.62, bounceRate: 0.38 },
      { sessionSource: 'gemini.google.com', sessions: 980, totalUsers: 810, averageSessionDuration: 175, engagementRate: 0.58, bounceRate: 0.42 },
      { sessionSource: 'claude.ai', sessions: 840, totalUsers: 700, averageSessionDuration: 220, engagementRate: 0.71, bounceRate: 0.29 },
      { sessionSource: 'copilot.microsoft.com', sessions: 650, totalUsers: 540, averageSessionDuration: 155, engagementRate: 0.54, bounceRate: 0.46 }
    ];
  }

  function _mockWoW(sd, ed) {
    return { current: _mockDaily(sd, ed), previous: _mockDaily(_fmt(new Date(new Date(sd) - 7 * 86400000)), _fmt(new Date(new Date(ed) - 7 * 86400000))) };
  }

  function _mockMoM() {
    const now = new Date(); const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), start: _fmt(d), end: _fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0)) });
    }
    const sources = ['chatgpt.com', 'perplexity.ai', 'gemini.google.com', 'claude.ai', 'copilot.microsoft.com'];
    const results = months.map((m, idx) => ({ ...m, rows: sources.map(s => ({ sessionSource: s, sessions: Math.round(300 + idx * 120 + Math.random() * 250) })) }));
    return { months, results };
  }

  function _mockLandingPages() {
    return [
      { landingPage: '/blog/ai-prompting-guide', sessions: 1820, totalUsers: 1540, averageSessionDuration: 245, engagementRate: 0.72, bounceRate: 0.28 },
      { landingPage: '/tools/ai-calculator', sessions: 1350, totalUsers: 1120, averageSessionDuration: 310, engagementRate: 0.78, bounceRate: 0.22 },
      { landingPage: '/blog/chatgpt-vs-claude', sessions: 980, totalUsers: 840, averageSessionDuration: 195, engagementRate: 0.65, bounceRate: 0.35 },
      { landingPage: '/', sessions: 850, totalUsers: 720, averageSessionDuration: 145, engagementRate: 0.58, bounceRate: 0.42 },
      { landingPage: '/blog/llm-seo-strategy', sessions: 720, totalUsers: 610, averageSessionDuration: 225, engagementRate: 0.68, bounceRate: 0.32 },
      { landingPage: '/resources/prompt-library', sessions: 580, totalUsers: 495, averageSessionDuration: 275, engagementRate: 0.74, bounceRate: 0.26 },
      { landingPage: '/blog/ai-tools-comparison', sessions: 330, totalUsers: 280, averageSessionDuration: 185, engagementRate: 0.62, bounceRate: 0.38 },
      { landingPage: '/pricing', sessions: 220, totalUsers: 190, averageSessionDuration: 125, engagementRate: 0.55, bounceRate: 0.45 }
    ];
  }

  function _mockEngQuality() {
    return [
      { sessionSource: 'claude.ai', sessions: 840, engagementRate: 0.71, averageSessionDuration: 220, bounceRate: 0.29 },
      { sessionSource: 'chatgpt.com', sessions: 3850, engagementRate: 0.67, averageSessionDuration: 210, bounceRate: 0.33 },
      { sessionSource: 'Organic Search', sessions: 21500, engagementRate: 0.62, averageSessionDuration: 210, bounceRate: 0.38 },
      { sessionSource: 'perplexity.ai', sessions: 2100, engagementRate: 0.62, averageSessionDuration: 195, bounceRate: 0.38 },
      { sessionSource: 'Email', sessions: 1130, engagementRate: 0.65, averageSessionDuration: 165, bounceRate: 0.35 },
      { sessionSource: 'gemini.google.com', sessions: 980, engagementRate: 0.58, averageSessionDuration: 175, bounceRate: 0.42 },
      { sessionSource: 'Direct', sessions: 12100, engagementRate: 0.45, averageSessionDuration: 145, bounceRate: 0.55 },
      { sessionSource: 'copilot.microsoft.com', sessions: 650, engagementRate: 0.54, averageSessionDuration: 155, bounceRate: 0.46 },
      { sessionSource: 'Social', sessions: 5800, engagementRate: 0.32, averageSessionDuration: 95, bounceRate: 0.68 }
    ];
  }

  // GA4 Tab mocks
  function _mockTrafficAcquisition() {
    const rows = [
      { sessionDefaultChannelGroup: 'Organic Search', sessions: 21500, newUsers: 14200, totalUsers: 18200, engagedSessions: 13330, engagementRate: 0.62, bounceRate: 0.38, averageSessionDuration: 210, sessionsPerUser: 1.18 },
      { sessionDefaultChannelGroup: 'Direct', sessions: 12100, newUsers: 7800, totalUsers: 10500, engagedSessions: 5445, engagementRate: 0.45, bounceRate: 0.55, averageSessionDuration: 145, sessionsPerUser: 1.15 },
      { sessionDefaultChannelGroup: 'Referral', sessions: 8420, newUsers: 5200, totalUsers: 6840, engagedSessions: 4884, engagementRate: 0.58, bounceRate: 0.42, averageSessionDuration: 185, sessionsPerUser: 1.23 },
      { sessionDefaultChannelGroup: 'Social', sessions: 5800, newUsers: 4100, totalUsers: 4900, engagedSessions: 1856, engagementRate: 0.32, bounceRate: 0.68, averageSessionDuration: 95, sessionsPerUser: 1.18 },
      { sessionDefaultChannelGroup: 'Paid Search', sessions: 3200, newUsers: 2400, totalUsers: 2800, engagedSessions: 1664, engagementRate: 0.52, bounceRate: 0.48, averageSessionDuration: 175, sessionsPerUser: 1.14 },
      { sessionDefaultChannelGroup: 'Email', sessions: 1130, newUsers: 620, totalUsers: 980, engagedSessions: 735, engagementRate: 0.65, bounceRate: 0.35, averageSessionDuration: 165, sessionsPerUser: 1.15 }
    ];
    const totals = { sessions: 52150, newUsers: 34320, totalUsers: 44220, engagedSessions: 27914, engagementRate: 0.535, bounceRate: 0.465, averageSessionDuration: 162, sessionsPerUser: 1.18, sessionsDelta: 12.4, newUsersDelta: 8.7, engagementDelta: 2.1, durationDelta: 5.3 };
    return { totals, rows };
  }

  function _mockTopPages() {
    const pages = [
      ['/blog/ai-prompting-guide', 'How to Write Better AI Prompts — Complete Guide', 4820, 3910, 2946, 0.75, 248, 0.25],
      ['/tools/ai-calculator', 'Free AI ROI Calculator', 3640, 2980, 2384, 0.80, 318, 0.20],
      ['/blog/chatgpt-vs-claude', 'ChatGPT vs Claude: Which AI is Better?', 2750, 2240, 1456, 0.65, 192, 0.35],
      ['/', 'Home', 2340, 1920, 998, 0.52, 148, 0.48],
      ['/blog/llm-seo-strategy', 'How to Build an LLM SEO Strategy in 2025', 1980, 1620, 1134, 0.70, 225, 0.30],
      ['/resources/prompt-library', 'Prompt Library — 500+ Prompts', 1760, 1440, 1123, 0.78, 284, 0.22],
      ['/blog/ai-tools-comparison', 'Best AI Writing Tools Compared', 1240, 1020, 643, 0.63, 195, 0.37],
      ['/pricing', 'Pricing Plans', 980, 820, 442, 0.54, 128, 0.46],
      ['/about', 'About Us', 720, 590, 337, 0.57, 108, 0.43],
      ['/blog/perplexity-review', 'Perplexity AI Review 2025', 680, 560, 392, 0.70, 212, 0.30],
      ['/contact', 'Contact', 540, 440, 232, 0.53, 95, 0.47],
      ['/blog/gemini-vs-chatgpt', 'Gemini vs ChatGPT: Head to Head', 490, 410, 287, 0.70, 188, 0.30]
    ];
    return pages.map(([pagePath, pageTitle, screenPageViews, sessions, engagedSessions, engagementRate, averageSessionDuration, bounceRate]) =>
      ({ pagePath, pageTitle, screenPageViews, sessions, engagedSessions, engagementRate, averageSessionDuration, bounceRate }));
  }

  function _mockConversions() {
    const byName = [
      { keyEventName: 'sign_up', keyEvents: 842, sessionKeyEventRate: 0.016, userKeyEventRate: 0.022 },
      { keyEventName: 'purchase', keyEvents: 314, sessionKeyEventRate: 0.006, userKeyEventRate: 0.008 },
      { keyEventName: 'contact_form_submit', keyEvents: 276, sessionKeyEventRate: 0.005, userKeyEventRate: 0.007 },
      { keyEventName: 'free_trial_start', keyEvents: 198, sessionKeyEventRate: 0.004, userKeyEventRate: 0.005 },
      { keyEventName: 'newsletter_subscribe', keyEvents: 156, sessionKeyEventRate: 0.003, userKeyEventRate: 0.004 }
    ];
    const byChannel = [
      { sessionDefaultChannelGroup: 'Organic Search', keyEvents: 612, sessionKeyEventRate: 0.028 },
      { sessionDefaultChannelGroup: 'Direct', keyEvents: 384, sessionKeyEventRate: 0.032 },
      { sessionDefaultChannelGroup: 'Paid Search', keyEvents: 312, sessionKeyEventRate: 0.098 },
      { sessionDefaultChannelGroup: 'Email', keyEvents: 196, sessionKeyEventRate: 0.173 },
      { sessionDefaultChannelGroup: 'Referral', keyEvents: 148, sessionKeyEventRate: 0.018 },
      { sessionDefaultChannelGroup: 'Social', keyEvents: 86, sessionKeyEventRate: 0.015 }
    ];
    return { totalKeyEvents: 1786, avgSessionKER: 0.007, avgUserKER: 0.009, byName, byChannel };
  }

  function _mockAudience() {
    return {
      devices: [
        { deviceCategory: 'desktop', sessions: 28480, engagedSessions: 16558, engagementRate: 0.582 },
        { deviceCategory: 'mobile', sessions: 21340, engagedSessions: 9389, engagementRate: 0.440 },
        { deviceCategory: 'tablet', sessions: 2330, engagedSessions: 1165, engagementRate: 0.500 }
      ],
      countries: [
        { country: 'United States', sessions: 18420, newUsers: 12840 },
        { country: 'United Kingdom', sessions: 6240, newUsers: 4180 },
        { country: 'India', sessions: 5810, newUsers: 4120 },
        { country: 'Canada', sessions: 3940, newUsers: 2650 },
        { country: 'Australia', sessions: 2880, newUsers: 1920 },
        { country: 'Germany', sessions: 2140, newUsers: 1430 },
        { country: 'France', sessions: 1620, newUsers: 1080 },
        { country: 'Netherlands', sessions: 1240, newUsers: 820 },
        { country: 'Singapore', sessions: 1080, newUsers: 720 },
        { country: 'Brazil', sessions: 980, newUsers: 680 }
      ],
      browsers: [
        { browser: 'Chrome', sessions: 31290 },
        { browser: 'Safari', sessions: 12640 },
        { browser: 'Firefox', sessions: 4180 },
        { browser: 'Edge', sessions: 2840 },
        { browser: 'Samsung Internet', sessions: 1200 }
      ],
      total: 52150
    };
  }

  // GSC Mock Data
  function _mockGSCOverview(sd, ed) {
    const daily = []; let d = new Date(sd); const end = new Date(ed);
    while (d <= end) {
      const base = 180 + Math.sin(d.getDay() * 0.8) * 40;
      daily.push({ key0: _fmt(d), clicks: Math.round(base + Math.random() * 120), impressions: Math.round(base * 18 + Math.random() * 2000), ctr: 0.038 + Math.random() * 0.02, position: 12 + Math.random() * 8 });
      d.setDate(d.getDate() + 1);
    }
    const totals = { clicks: daily.reduce((s, r) => s + r.clicks, 0), impressions: daily.reduce((s, r) => s + r.impressions, 0), ctr: 0.041, position: 14.2 };
    return { daily, totals };
  }

  function _mockGSCQueries() {
    const allQueries = [
      { query: 'chatgpt vs claude', clicks: 842, impressions: 12400, ctr: 0.068, position: 2.1 },
      { query: 'best ai tools 2025', clicks: 724, impressions: 18600, ctr: 0.039, position: 4.2 },
      { query: 'perplexity ai review', clicks: 618, impressions: 8900, ctr: 0.069, position: 1.8 },
      { query: 'llm seo strategy', clicks: 542, impressions: 7200, ctr: 0.075, position: 2.4 },
      { query: 'ai writing tools', clicks: 498, impressions: 22000, ctr: 0.023, position: 6.8 },
      { query: 'chatgpt prompts for seo', clicks: 412, impressions: 9800, ctr: 0.042, position: 3.6 },
      { query: 'google gemini vs chatgpt', clicks: 388, impressions: 14200, ctr: 0.027, position: 5.1 },
      { query: 'how to use claude ai', clicks: 356, impressions: 6400, ctr: 0.056, position: 3.2 },
      { query: 'ai seo tools free', clicks: 312, impressions: 16800, ctr: 0.019, position: 7.4 },
      { query: 'perplexity vs chatgpt', clicks: 298, impressions: 5600, ctr: 0.053, position: 2.9 },
      { query: 'ai content strategy', clicks: 276, impressions: 9200, ctr: 0.030, position: 8.1 },
      { query: 'best llm models 2025', clicks: 254, impressions: 7800, ctr: 0.033, position: 4.7 },
      { query: 'copilot microsoft review', clicks: 232, impressions: 4200, ctr: 0.055, position: 3.4 },
      { query: 'ai traffic analytics', clicks: 218, impressions: 3800, ctr: 0.057, position: 2.6 },
      { query: 'google analytics 4 guide', clicks: 196, impressions: 11400, ctr: 0.017, position: 9.2 },
      { query: 'free ai prompt templates', clicks: 184, impressions: 8600, ctr: 0.021, position: 8.8 },
      { query: 'seo with ai tools', clicks: 172, impressions: 12600, ctr: 0.014, position: 11.3 },
      { query: 'organic traffic growth tips', clicks: 156, impressions: 9100, ctr: 0.017, position: 10.4 },
      { query: 'improve website ctr', clicks: 144, impressions: 7400, ctr: 0.019, position: 9.7 },
      { query: 'chatgpt website traffic', clicks: 138, impressions: 5200, ctr: 0.027, position: 6.3 }
    ];
    return {
      top50: allQueries.slice(0, 20),
      ctrOpps: allQueries.filter(r => r.impressions > 500 && r.ctr < 0.02),
      rankOpps: allQueries.filter(r => r.position > 3 && r.position <= 10)
    };
  }

  function _mockGSCPages() {
    return [
      { page: 'https://example.com/blog/chatgpt-vs-claude', clicks: 842, impressions: 12400, ctr: 0.068, position: 2.1 },
      { page: 'https://example.com/tools/ai-calculator', clicks: 724, impressions: 9800, ctr: 0.074, position: 1.9 },
      { page: 'https://example.com/blog/ai-prompting-guide', clicks: 618, impressions: 8200, ctr: 0.075, position: 2.4 },
      { page: 'https://example.com/', clicks: 498, impressions: 31000, ctr: 0.016, position: 12.4 },
      { page: 'https://example.com/blog/llm-seo-strategy', clicks: 412, impressions: 7600, ctr: 0.054, position: 3.8 },
      { page: 'https://example.com/resources/prompt-library', clicks: 356, impressions: 5900, ctr: 0.060, position: 3.2 },
      { page: 'https://example.com/blog/ai-tools-comparison', clicks: 298, impressions: 8400, ctr: 0.035, position: 6.1 },
      { page: 'https://example.com/pricing', clicks: 186, impressions: 24000, ctr: 0.008, position: 18.6 },
      { page: 'https://example.com/blog/perplexity-review', clicks: 164, impressions: 4200, ctr: 0.039, position: 5.4 },
      { page: 'https://example.com/blog/gemini-vs-chatgpt', clicks: 142, impressions: 5600, ctr: 0.025, position: 7.8 }
    ];
  }

  function _mockGSCDevicesCountries() {
    return {
      devices: [
        { device: 'DESKTOP', clicks: 2840, impressions: 48200, ctr: 0.059, position: 11.2 },
        { device: 'MOBILE', clicks: 1620, impressions: 38400, ctr: 0.042, position: 15.8 },
        { device: 'TABLET', clicks: 380, impressions: 8600, ctr: 0.044, position: 13.4 }
      ],
      countries: [
        { country: 'usa', clicks: 1980, impressions: 28400, ctr: 0.070, position: 9.8 },
        { country: 'gbr', clicks: 640, impressions: 12400, ctr: 0.052, position: 11.2 },
        { country: 'ind', clicks: 480, impressions: 14800, ctr: 0.032, position: 14.6 },
        { country: 'can', clicks: 380, impressions: 8200, ctr: 0.046, position: 12.1 },
        { country: 'aus', clicks: 320, impressions: 6800, ctr: 0.047, position: 11.8 },
        { country: 'deu', clicks: 210, impressions: 5400, ctr: 0.039, position: 13.4 },
        { country: 'fra', clicks: 180, impressions: 4600, ctr: 0.039, position: 14.2 },
        { country: 'nld', clicks: 140, impressions: 3200, ctr: 0.044, position: 12.8 }
      ]
    };
  }

  // ── Public API ─────────────────────────────────────────────────

  return {
    init, initTokenClient, signIn, signOut,
    isAuthenticated, isMockMode,
    getLlmSources, getLlmLabel,
    listProperties,
    // LLM Tab
    fetchKPIs, fetchDailyLLMSessions, fetchDailyAllSessions,
    fetchSourceBreakdown, fetchLLMSourceDetail,
    fetchWoW, fetchMoMBySource,
    fetchTopLandingPages, fetchEngagementQuality,
    // GA4 Tab
    fetchTrafficAcquisition, fetchTopPages, fetchConversions, fetchAudience,
    // GSC Tab
    fetchGSCOverview, fetchGSCQueries, fetchGSCPages, fetchGSCDevicesCountries,
    // Blended
    computeBlended
  };

})();
