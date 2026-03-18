/**
 * ga4-tab.js — GA4 Tab: Traffic Acquisition, Top Pages, Conversions, Audience
 */

const GA4_TAB = (() => {

    // ── Formatters ──────────────────────────────────────────────
    const fNum = n => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
    const fPct = n => (n == null ? '—' : (n * 100).toFixed(1) + '%');
    const fPctDir = n => (n == null ? '—' : n.toFixed(1) + '%');
    const fDur = s => { if (!s) return '0:00'; const m = Math.floor(s / 60); const sec = Math.round(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };
    const fDelta = d => { if (!d && d !== 0) return ''; const sign = d >= 0 ? '+' : ''; const cls = d >= 0 ? 'trend-up' : 'trend-dn'; return `<span class="delta ${cls}">${sign}${d.toFixed(1)}%</span>`; };

    function engagementColor(rate) {
        const pct = rate * 100;
        if (pct >= 70) return 'eng-green';
        if (pct >= 40) return 'eng-yellow';
        return 'eng-red';
    }

    // ── Skeleton ────────────────────────────────────────────────
    function showSkeleton(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `<div class="skeleton-wrap">
      <div class="skeleton-row"><div class="skeleton sk-h2"></div><div class="skeleton sk-h2"></div><div class="skeleton sk-h2"></div><div class="skeleton sk-h2"></div></div>
      <div class="skeleton sk-table"></div>
    </div>`;
    }

    function showError(id, msg, retryFn) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `<div class="section-error">
      <div class="section-error__icon">⚠️</div>
      <div class="section-error__msg">${msg}</div>
      <button class="btn btn-ghost btn-sm" onclick="(${retryFn.toString()})()">↻ Retry</button>
    </div>`;
    }

    // ── CSV Export ───────────────────────────────────────────────
    function exportCSV(rows, headers, filename) {
        const lines = [headers.join(',')];
        rows.forEach(r => lines.push(r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    }

    // ════════════════════════════════════════════════════════════
    //  SECTION 1 — Traffic Acquisition
    // ════════════════════════════════════════════════════════════

    async function loadTrafficAcquisition(propId, sd, ed) {
        showSkeleton('ga4-s1-body');
        try {
            const data = await GA4_API.fetchTrafficAcquisition(propId, sd, ed);
            renderTrafficAcquisition(data);
        } catch (e) {
            showError('ga4-s1-body', e.message || 'Failed to load Traffic Acquisition', () => loadTrafficAcquisition(propId, sd, ed));
        }
    }

    function renderTrafficAcquisition({ totals, rows }) {
        const el = document.getElementById('ga4-s1-body');
        if (!el) return;

        // Stat row
        const stats = `
      <div class="stat-grid-4">
        <div class="stat-card">
          <div class="stat-card__icon" style="background:rgba(99,102,241,0.12)">📊</div>
          <div class="stat-card__label">Sessions</div>
          <div class="stat-card__value">${fNum(totals.sessions)}</div>
          ${fDelta(totals.sessionsDelta)}
        </div>
        <div class="stat-card">
          <div class="stat-card__icon" style="background:rgba(16,185,129,0.12)">👤</div>
          <div class="stat-card__label">New Users</div>
          <div class="stat-card__value">${fNum(totals.newUsers)}</div>
          ${fDelta(totals.newUsersDelta)}
        </div>
        <div class="stat-card">
          <div class="stat-card__icon" style="background:rgba(245,158,11,0.12)">⚡</div>
          <div class="stat-card__label">Engagement Rate</div>
          <div class="stat-card__value">${fPctDir(totals.engagementRate * 100)}<span style="font-size:16px;font-weight:400">%</span></div>
          ${fDelta(totals.engagementDelta)}
        </div>
        <div class="stat-card">
          <div class="stat-card__icon" style="background:rgba(239,68,68,0.1)">⏱️</div>
          <div class="stat-card__label">Avg Session Duration</div>
          <div class="stat-card__value">${fDur(totals.averageSessionDuration)}</div>
          ${fDelta(totals.durationDelta)}
        </div>
      </div>`;

        // Channel table
        const totalSess = totals.sessions || 1;
        const tbody = rows.map((r, i) => `
      <tr>
        <td><span class="channel-badge ch-${(r.sessionDefaultChannelGroup || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')}">${r.sessionDefaultChannelGroup || '(Other)'}</span></td>
        <td class="num">${fNum(r.sessions)}</td>
        <td class="num">${fNum(r.engagedSessions)}</td>
        <td class="num"><span class="eng-badge ${engagementColor(r.engagementRate)}">${fPct(r.engagementRate)}</span></td>
        <td class="num">${fPct(r.bounceRate)}</td>
      </tr>`).join('');

        const tableHtml = `
      <div class="data-table-wrap" style="margin-top:20px">
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <button class="btn btn-ghost btn-sm" onclick="GA4_TAB._exportChannelTable()">⬇ Export CSV</button>
        </div>
        <table class="data-table" id="ga4-channel-table">
          <thead><tr>
            <th>Channel</th><th class="num">Sessions</th><th class="num">Engaged Sessions</th>
            <th class="num">Engagement Rate</th><th class="num">Bounce Rate</th>
          </tr></thead>
          <tbody id="ga4-channel-tbody">${tbody}</tbody>
        </table>
      </div>`;

        el.innerHTML = stats + tableHtml;
        window._ga4ChannelRows = rows;
    }

    function _exportChannelTable() {
        const rows = window._ga4ChannelRows || [];
        exportCSV(
            rows.map(r => [r.sessionDefaultChannelGroup, r.sessions, r.engagedSessions, (r.engagementRate * 100).toFixed(1) + '%', (r.bounceRate * 100).toFixed(1) + '%']),
            ['Channel', 'Sessions', 'Engaged Sessions', 'Engagement Rate', 'Bounce Rate'],
            'traffic-acquisition.csv'
        );
    }

    // ════════════════════════════════════════════════════════════
    //  SECTION 2 — Top Pages & Engagement
    // ════════════════════════════════════════════════════════════

    let _pagesData = [];
    let _pagesSortKey = 'sessions';
    let _pagesSortDir = -1;

    async function loadTopPages(propId, sd, ed) {
        showSkeleton('ga4-s2-body');
        try {
            const data = await GA4_API.fetchTopPages(propId, sd, ed);
            _pagesData = data;
            renderTopPages();
        } catch (e) {
            showError('ga4-s2-body', e.message || 'Failed to load Top Pages', () => loadTopPages(propId, sd, ed));
        }
    }

    function renderTopPages() {
        const el = document.getElementById('ga4-s2-body');
        if (!el) return;

        const sorted = [..._pagesData].sort((a, b) => (a[_pagesSortKey] - b[_pagesSortKey]) * _pagesSortDir);

        function th(label, key) {
            const active = _pagesSortKey === key;
            const arrow = active ? (_pagesSortDir === -1 ? ' ↓' : ' ↑') : '';
            return `<th class="sortable-th ${active ? 'sort-active' : ''}" onclick="GA4_TAB._sortPages('${key}')">${label}${arrow}</th>`;
        }

        const tbody = sorted.map((r, i) => {
            const shortUrl = r.pagePath.length > 50 ? r.pagePath.slice(0, 47) + '…' : r.pagePath;
            return `<tr>
        <td><span class="page-title-cell" title="${r.pageTitle || ''}">${r.pageTitle || r.pagePath}</span></td>
        <td><span class="url-cell" title="${r.pagePath}">${shortUrl}</span></td>
        <td class="num">${fNum(r.screenPageViews)}</td>
        <td class="num">${fNum(r.sessions)}</td>
        <td class="num"><span class="eng-badge ${engagementColor(r.engagementRate)}">${fPct(r.engagementRate)}</span></td>
        <td class="num">${fDur(r.averageSessionDuration)}</td>
        <td class="num">${fPct(r.bounceRate)}</td>
      </tr>`;
        }).join('');

        el.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <input id="page-filter-input" class="input-field" style="max-width:280px;padding:6px 12px;font-size:13px" placeholder="Filter by URL or title…" oninput="GA4_TAB._filterPages()" />
        <button class="btn btn-ghost btn-sm" onclick="GA4_TAB._exportPagesTable()">⬇ Export CSV</button>
      </div>
      <div class="data-table-wrap">
        <table class="data-table" id="ga4-pages-table">
          <thead><tr>
            ${th('Page Title', 'pageTitle')}${th('URL', 'pagePath')}${th('Page Views', 'screenPageViews')}
            ${th('Sessions', 'sessions')}${th('Engagement Rate', 'engagementRate')}${th('Avg Time', 'averageSessionDuration')}${th('Bounce Rate', 'bounceRate')}
          </tr></thead>
          <tbody id="ga4-pages-tbody">${tbody}</tbody>
        </table>
      </div>`;
    }

    function _sortPages(key) {
        if (_pagesSortKey === key) _pagesSortDir *= -1;
        else { _pagesSortKey = key; _pagesSortDir = -1; }
        renderTopPages();
    }

    function _filterPages() {
        const q = (document.getElementById('page-filter-input')?.value || '').toLowerCase();
        const rows = document.querySelectorAll('#ga4-pages-tbody tr');
        rows.forEach(tr => { tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none'; });
    }

    function _exportPagesTable() {
        exportCSV(
            _pagesData.map(r => [r.pageTitle, r.pagePath, r.screenPageViews, r.sessions, (r.engagementRate * 100).toFixed(1) + '%', fDur(r.averageSessionDuration), (r.bounceRate * 100).toFixed(1) + '%']),
            ['Page Title', 'URL', 'Page Views', 'Sessions', 'Engagement Rate', 'Avg Time', 'Bounce Rate'],
            'top-pages.csv'
        );
    }

    // ════════════════════════════════════════════════════════════
    //  SECTION 3 — Conversions & Key Events
    // ════════════════════════════════════════════════════════════

    async function loadConversions(propId, sd, ed) {
        showSkeleton('ga4-s3-body');
        try {
            const data = await GA4_API.fetchConversions(propId, sd, ed);
            renderConversions(data);
        } catch (e) {
            showError('ga4-s3-body', e.message || 'Failed to load Conversions', () => loadConversions(propId, sd, ed));
        }
    }

    function renderConversions({ totalKeyEvents, avgSessionKER, avgUserKER, byName, byChannel }) {
        const el = document.getElementById('ga4-s3-body');
        if (!el) return;

        if (!totalKeyEvents || totalKeyEvents === 0) {
            el.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">🎯</div>
        <div class="empty-state__title">No key events found</div>
        <div class="empty-state__msg">Set up key events in GA4 Admin → Events → Mark as key event.</div>
      </div>`;
            return;
        }

        const stats = `<div class="stat-grid-3">
      <div class="stat-card"><div class="stat-card__icon" style="background:rgba(124,58,237,0.12)">🎯</div><div class="stat-card__label">Total Key Events</div><div class="stat-card__value">${fNum(totalKeyEvents)}</div></div>
      <div class="stat-card"><div class="stat-card__icon" style="background:rgba(16,185,129,0.12)">📈</div><div class="stat-card__label">Session Key Event Rate</div><div class="stat-card__value">${fPct(avgSessionKER)}</div></div>
      <div class="stat-card"><div class="stat-card__icon" style="background:rgba(245,158,11,0.12)">👥</div><div class="stat-card__label">User Key Event Rate</div><div class="stat-card__value">${fPct(avgUserKER)}</div></div>
    </div>`;

        const totalEvts = totalKeyEvents || 1;
        const nameRows = byName.map(r => `<tr>
      <td>${r.keyEventName}</td>
      <td class="num">${fNum(r.keyEvents)}</td>
      <td class="num">${((r.keyEvents / totalEvts) * 100).toFixed(1)}%</td>
    </tr>`).join('');

        const chanRows = byChannel.map(r => `<tr>
      <td><span class="channel-badge ch-${(r.sessionDefaultChannelGroup || '').toLowerCase().replace(/\s+/g, '‑')}">${r.sessionDefaultChannelGroup}</span></td>
      <td class="num">${fNum(r.keyEvents)}</td>
      <td class="num">${fPct(r.sessionKeyEventRate)}</td>
    </tr>`).join('');

        el.innerHTML = stats + `
      <div class="grid-2" style="margin-top:20px">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="panel__title" style="font-size:13px">Key Events by Name</div>
            <button class="btn btn-ghost btn-sm" onclick="GA4_TAB._exportConvByName()">⬇ CSV</button>
          </div>
          <div class="data-table-wrap">
            <table class="data-table" id="ga4-conv-name-table">
              <thead><tr><th>Event Name</th><th class="num">Completions</th><th class="num">% of Total</th></tr></thead>
              <tbody>${nameRows}</tbody>
            </table>
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="panel__title" style="font-size:13px">Key Events by Channel</div>
            <button class="btn btn-ghost btn-sm" onclick="GA4_TAB._exportConvByChannel()">⬇ CSV</button>
          </div>
          <div class="data-table-wrap">
            <table class="data-table" id="ga4-conv-channel-table">
              <thead><tr><th>Channel</th><th class="num">Key Events</th><th class="num">Session Rate</th></tr></thead>
              <tbody>${chanRows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
        window._ga4ConvByName = byName;
        window._ga4ConvByChannel = byChannel;
        window._ga4TotalKeyEvents = totalKeyEvents;
    }

    function _exportConvByName() {
        const rows = window._ga4ConvByName || [], total = window._ga4TotalKeyEvents || 1;
        exportCSV(rows.map(r => [r.keyEventName, r.keyEvents, ((r.keyEvents / total) * 100).toFixed(1) + '%']), ['Event Name', 'Completions', '% of Total'], 'key-events-by-name.csv');
    }
    function _exportConvByChannel() {
        const rows = window._ga4ConvByChannel || [];
        exportCSV(rows.map(r => [r.sessionDefaultChannelGroup, r.keyEvents, (r.sessionKeyEventRate * 100).toFixed(1) + '%']), ['Channel', 'Key Events', 'Session Key Event Rate'], 'key-events-by-channel.csv');
    }

    // ════════════════════════════════════════════════════════════
    //  SECTION 4 — Audience & Devices
    // ════════════════════════════════════════════════════════════

    const DEVICE_ICONS = { desktop: '🖥️', mobile: '📱', tablet: '📟' };
    const COUNTRY_FLAGS = { 'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'India': '🇮🇳', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Germany': '🇩🇪', 'France': '🇫🇷', 'Netherlands': '🇳🇱', 'Singapore': '🇸🇬', 'Brazil': '🇧🇷', 'Japan': '🇯🇵', 'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Mexico': '🇲🇽', 'Ireland': '🇮🇪' };

    async function loadAudience(propId, sd, ed) {
        showSkeleton('ga4-s4-body');
        try {
            const data = await GA4_API.fetchAudience(propId, sd, ed);
            renderAudience(data);
        } catch (e) {
            showError('ga4-s4-body', e.message || 'Failed to load Audience', () => loadAudience(propId, sd, ed));
        }
    }

    function renderAudience({ devices, countries, browsers, total }) {
        const el = document.getElementById('ga4-s4-body');
        if (!el) return;
        const totalSess = total || 1;

        const deviceCards = devices.map(r => {
            const cat = (r.deviceCategory || '').toLowerCase();
            const icon = DEVICE_ICONS[cat] || '💻';
            return `<div class="stat-card device-card">
        <div class="device-card__icon">${icon}</div>
        <div class="stat-card__label" style="text-transform:capitalize">${cat}</div>
        <div class="stat-card__value">${fNum(r.sessions)}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:4px">Engagement: <strong>${fPct(r.engagementRate)}</strong></div>
      </div>`;
        }).join('');

        const ctryTotal = countries.reduce((s, r) => s + (r.sessions || 0), 0) || 1;
        const ctryRows = countries.map(r => {
            const flag = COUNTRY_FLAGS[r.country] || '🌐';
            return `<tr>
        <td>${flag} ${r.country}</td>
        <td class="num">${fNum(r.sessions)}</td>
        <td class="num">${fNum(r.newUsers)}</td>
        <td class="num">${((r.sessions / totalSess) * 100).toFixed(1)}%</td>
      </tr>`;
        }).join('');

        const browserTotal = browsers.reduce((s, r) => s + (r.sessions || 0), 0) || 1;
        const browserRows = browsers.map(r => `<tr>
      <td>${r.browser}</td>
      <td class="num">${fNum(r.sessions)}</td>
      <td class="num">${((r.sessions / browserTotal) * 100).toFixed(1)}%</td>
    </tr>`).join('');

        el.innerHTML = `
      <div class="device-cards-row">${deviceCards}</div>
      <div class="grid-2" style="margin-top:20px">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="panel__title" style="font-size:13px">Top Countries</div>
            <button class="btn btn-ghost btn-sm" onclick="GA4_TAB._exportCountries()">⬇ CSV</button>
          </div>
          <div class="data-table-wrap">
            <table class="data-table" id="ga4-country-table">
              <thead><tr><th>Country</th><th class="num">Sessions</th><th class="num">New Users</th><th class="num">% of Total</th></tr></thead>
              <tbody>${ctryRows}</tbody>
            </table>
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="panel__title" style="font-size:13px">Top Browsers</div>
            <button class="btn btn-ghost btn-sm" onclick="GA4_TAB._exportBrowsers()">⬇ CSV</button>
          </div>
          <div class="data-table-wrap">
            <table class="data-table" id="ga4-browser-table">
              <thead><tr><th>Browser</th><th class="num">Sessions</th><th class="num">% of Total</th></tr></thead>
              <tbody>${browserRows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
        window._ga4Countries = countries; window._ga4Browsers = browsers; window._ga4TotalSess = totalSess;
    }

    function _exportCountries() {
        const rows = window._ga4Countries || [], t = window._ga4TotalSess || 1;
        exportCSV(rows.map(r => [r.country, r.sessions, r.newUsers, ((r.sessions / t) * 100).toFixed(1) + '%']), ['Country', 'Sessions', 'New Users', '% of Total'], 'audience-countries.csv');
    }
    function _exportBrowsers() {
        const rows = window._ga4Browsers || [];
        const t = rows.reduce((s, r) => s + r.sessions, 0) || 1;
        exportCSV(rows.map(r => [r.browser, r.sessions, ((r.sessions / t) * 100).toFixed(1) + '%']), ['Browser', 'Sessions', '% of Total'], 'audience-browsers.csv');
    }

    // ── Load All ─────────────────────────────────────────────────

    function loadAll(propId, sd, ed) {
        loadTrafficAcquisition(propId, sd, ed);
        loadTopPages(propId, sd, ed);
        loadConversions(propId, sd, ed);
        loadAudience(propId, sd, ed);
    }

    return {
        loadAll, loadTrafficAcquisition, loadTopPages, loadConversions, loadAudience,
        _sortPages, _filterPages, _exportChannelTable, _exportPagesTable,
        _exportConvByName, _exportConvByChannel, _exportCountries, _exportBrowsers
    };
})();
