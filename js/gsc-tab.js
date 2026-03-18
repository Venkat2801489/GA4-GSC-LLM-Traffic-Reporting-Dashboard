/**
 * gsc-tab.js — Google Search Console Tab
 * Sections: Search Overview, Query Intelligence, Page Performance, Device & Country
 */

const GSC_TAB = (() => {

    const fNum = n => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
    const fPct = n => (n == null ? '—' : (n * 100).toFixed(2) + '%');
    const fPos = n => (n == null ? '—' : Number(n).toFixed(1));

    function ctrColor(ctr) {
        if (ctr >= 0.05) return 'eng-green';
        if (ctr >= 0.02) return 'eng-yellow';
        return 'eng-red';
    }
    function posColor(pos) {
        if (pos <= 3) return 'eng-green';
        if (pos <= 10) return 'eng-yellow';
        return 'eng-red';
    }

    function exportCSV(rows, headers, filename) {
        const lines = [headers.join(',')];
        rows.forEach(r => lines.push(r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    }

    function showSkeleton(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `<div class="skeleton-wrap">
      <div class="skeleton-row"><div class="skeleton sk-h2"></div><div class="skeleton sk-h2"></div><div class="skeleton sk-h2"></div><div class="skeleton sk-h2"></div></div>
      <div class="skeleton sk-chart"></div>
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

    // ════════════════════════════════════════════════════════════
    //  SECTION 5 — GSC Overview + SVG Line Chart
    // ════════════════════════════════════════════════════════════

    async function loadOverview(siteUrl, sd, ed) {
        showSkeleton('gsc-s5-body');
        try {
            const data = await GA4_API.fetchGSCOverview(siteUrl, sd, ed);
            renderOverview(data);
        } catch (e) {
            showError('gsc-s5-body', e.message || 'Failed to load GSC Overview', () => loadOverview(siteUrl, sd, ed));
        }
    }

    function renderOverview({ daily, totals }) {
        const el = document.getElementById('gsc-s5-body');
        if (!el) return;

        const stats = `<div class="stat-grid-4">
      <div class="stat-card">
        <div class="stat-card__icon" style="background:rgba(59,130,246,0.12)">👆</div>
        <div class="stat-card__label">Total Clicks</div>
        <div class="stat-card__value">${fNum(totals.clicks)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon" style="background:rgba(16,185,129,0.12)">👁️</div>
        <div class="stat-card__label">Total Impressions</div>
        <div class="stat-card__value">${fNum(totals.impressions)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon" style="background:rgba(245,158,11,0.12)">📊</div>
        <div class="stat-card__label">Avg CTR</div>
        <div class="stat-card__value">${fPct(totals.ctr)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon" style="background:rgba(124,58,237,0.12)">📍</div>
        <div class="stat-card__label">Avg Position</div>
        <div class="stat-card__value">${fPos(totals.position)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:4px">Lower = better</div>
      </div>
    </div>`;

        el.innerHTML = stats + `<div id="gsc-svg-chart" class="gsc-chart-wrap" style="margin-top:24px;position:relative"></div>`;
        renderSVGChart('gsc-svg-chart', daily);
    }

    function renderSVGChart(containerId, daily) {
        const container = document.getElementById(containerId);
        if (!container || !daily.length) return;

        const W = container.clientWidth || 700, H = 220;
        const PAD = { top: 20, right: 20, bottom: 36, left: 56 };
        const chartW = W - PAD.left - PAD.right, chartH = H - PAD.top - PAD.bottom;

        const clicks = daily.map(r => r.clicks || 0);
        const impressions = daily.map(r => r.impressions || 0);
        const maxClicks = Math.max(...clicks, 1), maxImp = Math.max(...impressions, 1);

        const xScale = i => PAD.left + (i / (daily.length - 1)) * chartW;
        const yClicks = v => PAD.top + chartH - (v / maxClicks) * chartH;
        const yImp = v => PAD.top + chartH - (v / maxImp) * chartH;

        const clicksPath = clicks.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yClicks(v).toFixed(1)}`).join(' ');
        const impPath = impressions.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yImp(v).toFixed(1)}`).join(' ');

        // X-axis labels — show ~6 evenly spaced dates
        const step = Math.max(1, Math.floor(daily.length / 6));
        const xLabels = daily.filter((_, i) => i % step === 0 || i === daily.length - 1).map((r, _, arr) => {
            const label = String(r.key0 || '').replace(/(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) =>
                new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            const idx = daily.indexOf(r);
            return `<text x="${xScale(idx).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="var(--t3)" font-size="10">${label}</text>`;
        });

        // Y-axis labels
        const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => {
            const y = (PAD.top + chartH - pct * chartH).toFixed(1);
            return `<text x="${PAD.left - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--t3)" font-size="10">${fNum(maxClicks * pct)}</text>
              <line x1="${PAD.left}" y1="${y}" x2="${PAD.left + chartW}" y2="${y}" stroke="var(--border-s)" stroke-width="1" stroke-dasharray="4,4"/>`;
        });

        // Tooltip circles
        const circles = daily.map((r, i) => `
      <circle class="gsc-dot" cx="${xScale(i).toFixed(1)}" cy="${yClicks(clicks[i]).toFixed(1)}" r="4" fill="#3b82f6" opacity="0"
        data-clicks="${r.clicks || 0}" data-impressions="${r.impressions || 0}" data-ctr="${fPct(r.ctr)}" data-date="${r.key0 || ''}"
        onmouseover="GSC_TAB._dotOver(this,${xScale(i).toFixed(1)},${yClicks(clicks[i]).toFixed(1)})"
        onmouseout="GSC_TAB._dotOut()"/>
    `).join('');

        container.innerHTML = `
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
        ${yLabels.join('')}
        <path d="${impPath}" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6"/>
        <path d="${clicksPath}" fill="none" stroke="#3b82f6" stroke-width="2"/>
        ${circles}
        ${xLabels.join('')}
        <circle cx="${PAD.left + 30}" cy="${PAD.top - 4}" r="5" fill="#3b82f6"/>
        <text x="${PAD.left + 40}" y="${PAD.top - 1}" font-size="11" fill="var(--t2)">Clicks</text>
        <circle cx="${PAD.left + 100}" cy="${PAD.top - 4}" r="5" fill="#10b981"/>
        <text x="${PAD.left + 110}" y="${PAD.top - 1}" font-size="11" fill="var(--t2)">Impressions (scaled)</text>
      </svg>
      <div id="gsc-tooltip" class="gsc-tooltip" style="display:none;position:absolute;pointer-events:none"></div>`;
    }

    function _dotOver(el, x, y) {
        const tip = document.getElementById('gsc-tooltip');
        if (!tip) return;
        const date = el.dataset.date ? new Date(el.dataset.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        tip.innerHTML = `<strong>${date}</strong><br>Clicks: <b>${fNum(el.dataset.clicks)}</b><br>Impressions: <b>${fNum(el.dataset.impressions)}</b><br>CTR: <b>${el.dataset.ctr}</b>`;
        tip.style.display = 'block';
        tip.style.left = (x + 12) + 'px'; tip.style.top = (y - 20) + 'px';
        el.setAttribute('opacity', '1');
    }
    function _dotOut() {
        const tip = document.getElementById('gsc-tooltip');
        if (tip) tip.style.display = 'none';
        document.querySelectorAll('.gsc-dot').forEach(d => d.setAttribute('opacity', '0'));
    }

    // ════════════════════════════════════════════════════════════
    //  SECTION 6 — Query Intelligence (3 sub-tabs)
    // ════════════════════════════════════════════════════════════

    let _gscQueryData = null;
    let _activeQueryTab = 'top50';

    async function loadQueryIntelligence(siteUrl, sd, ed) {
        showSkeleton('gsc-s6-body');
        try {
            _gscQueryData = await GA4_API.fetchGSCQueries(siteUrl, sd, ed);
            renderQueryIntelligence();
        } catch (e) {
            showError('gsc-s6-body', e.message || 'Failed to load Queries', () => loadQueryIntelligence(siteUrl, sd, ed));
        }
    }

    function renderQueryIntelligence() {
        const el = document.getElementById('gsc-s6-body');
        if (!el || !_gscQueryData) return;

        const tabs = [
            { key: 'top50', label: 'Top 50 Queries' },
            { key: 'ctrOpps', label: 'CTR Opportunities' },
            { key: 'rankOpps', label: 'Ranking Opportunities' }
        ];

        const tabNav = `<div class="sub-tab-nav">${tabs.map(t =>
            `<button class="sub-tab-btn ${_activeQueryTab === t.key ? 'active' : ''}" onclick="GSC_TAB._switchQueryTab('${t.key}')">${t.label}</button>`
        ).join('')}</div>`;

        let content = '';
        if (_activeQueryTab === 'top50') {
            const rows = (_gscQueryData.top50 || []).map(r => `<tr>
        <td>${r.query}</td>
        <td class="num">${fNum(r.clicks)}</td>
        <td class="num">${fNum(r.impressions)}</td>
        <td class="num"><span class="eng-badge ${ctrColor(r.ctr)}">${fPct(r.ctr)}</span></td>
        <td class="num"><span class="eng-badge ${posColor(r.position)}">${fPos(r.position)}</span></td>
      </tr>`).join('');
            content = `<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="GSC_TAB._exportTop50()">⬇ CSV</button></div>
        <div class="data-table-wrap"><table class="data-table">
          <thead><tr><th>Query</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">CTR</th><th class="num">Avg Position</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
        } else if (_activeQueryTab === 'ctrOpps') {
            const data = _gscQueryData.ctrOpps || [];
            const hint = `<div class="insight-banner insight-yellow">💡 These pages rank well but aren't getting clicks — consider rewriting title tags and meta descriptions.</div>`;
            if (!data.length) {
                content = hint + `<div class="empty-state"><div class="empty-state__icon">✅</div><div class="empty-state__title">No CTR opportunities found</div><div class="empty-state__msg">All high-impression queries have a CTR above 2%.</div></div>`;
            } else {
                const rows = data.map(r => `<tr>
          <td>${r.query}</td>
          <td class="num">${fNum(r.impressions)}</td>
          <td class="num"><span class="eng-badge ${ctrColor(r.ctr)}">${fPct(r.ctr)}</span></td>
          <td class="num"><span class="eng-badge ${posColor(r.position)}">${fPos(r.position)}</span></td>
        </tr>`).join('');
                content = hint + `<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="GSC_TAB._exportCtrOpps()">⬇ CSV</button></div>
          <div class="data-table-wrap"><table class="data-table">
            <thead><tr><th>Query</th><th class="num">Impressions</th><th class="num">CTR</th><th class="num">Position</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`;
            }
        } else {
            const data = _gscQueryData.rankOpps || [];
            const hint = `<div class="insight-banner insight-blue">🎯 These keywords are almost on page 1 — optimize these pages first for quick wins.</div>`;
            if (!data.length) {
                content = hint + `<div class="empty-state"><div class="empty-state__icon">✅</div><div class="empty-state__title">No ranking opportunities found</div><div class="empty-state__msg">No queries currently ranking in positions 4–10.</div></div>`;
            } else {
                const rows = data.sort((a, b) => a.position - b.position).map(r => `<tr>
          <td>${r.query}</td>
          <td class="num">${fNum(r.clicks)}</td>
          <td class="num">${fNum(r.impressions)}</td>
          <td class="num"><span class="eng-badge ${posColor(r.position)}">${fPos(r.position)}</span></td>
        </tr>`).join('');
                content = hint + `<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="GSC_TAB._exportRankOpps()">⬇ CSV</button></div>
          <div class="data-table-wrap"><table class="data-table">
            <thead><tr><th>Query</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">Position</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`;
            }
        }

        el.innerHTML = tabNav + `<div class="sub-tab-content">${content}</div>`;
    }

    function _switchQueryTab(key) { _activeQueryTab = key; renderQueryIntelligence(); }
    function _exportTop50() {
        const rows = (_gscQueryData?.top50 || []);
        exportCSV(rows.map(r => [r.query, r.clicks, r.impressions, fPct(r.ctr), fPos(r.position)]), ['Query', 'Clicks', 'Impressions', 'CTR', 'Avg Position'], 'top-queries.csv');
    }
    function _exportCtrOpps() {
        exportCSV((_gscQueryData?.ctrOpps || []).map(r => [r.query, r.impressions, fPct(r.ctr), fPos(r.position)]), ['Query', 'Impressions', 'CTR', 'Position'], 'ctr-opportunities.csv');
    }
    function _exportRankOpps() {
        exportCSV((_gscQueryData?.rankOpps || []).map(r => [r.query, r.clicks, r.impressions, fPos(r.position)]), ['Query', 'Clicks', 'Impressions', 'Position'], 'ranking-opportunities.csv');
    }

    // ════════════════════════════════════════════════════════════
    //  SECTION 7 — Page Performance
    // ════════════════════════════════════════════════════════════

    let _gscPagesData = [];

    async function loadPagePerformance(siteUrl, sd, ed) {
        showSkeleton('gsc-s7-body');
        try {
            _gscPagesData = await GA4_API.fetchGSCPages(siteUrl, sd, ed);
            renderPagePerformance();
        } catch (e) {
            showError('gsc-s7-body', e.message || 'Failed to load Page Performance', () => loadPagePerformance(siteUrl, sd, ed));
        }
    }

    function renderPagePerformance() {
        const el = document.getElementById('gsc-s7-body');
        if (!el) return;

        const rows = _gscPagesData.map(r => {
            let path = r.page;
            try { path = new URL(r.page).pathname; } catch { }
            const leak = r.impressions > 200 && r.ctr < 0.01;
            return `<tr class="${leak ? 'row-leak' : ''}" title="${leak ? '⚠️ High impressions, very low CTR — consider rewriting the title tag' : ''}">
        <td><span class="url-cell" title="${r.page}">${path.length > 50 ? path.slice(0, 47) + '…' : path}</span></td>
        <td class="num">${fNum(r.clicks)}</td>
        <td class="num">${fNum(r.impressions)}</td>
        <td class="num"><span class="eng-badge ${ctrColor(r.ctr)}">${fPct(r.ctr)}</span></td>
        <td class="num"><span class="eng-badge ${posColor(r.position)}">${fPos(r.position)}</span></td>
      </tr>`;
        }).join('');

        el.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <input id="gsc-page-filter" class="input-field" style="max-width:280px;padding:6px 12px;font-size:13px" placeholder="Filter by URL…" oninput="GSC_TAB._filterPages()" />
        <button class="btn btn-ghost btn-sm" onclick="GSC_TAB._exportPages()">⬇ Export CSV</button>
      </div>
      <div class="insight-banner insight-red" style="margin-bottom:12px">🔴 Rows highlighted in red = high impressions + CTR below 1%. These pages are leaking visibility — prioritize title/meta rewrites.</div>
      <div class="data-table-wrap">
        <table class="data-table" id="gsc-pages-table">
          <thead><tr><th>URL</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">CTR</th><th class="num">Avg Position</th></tr></thead>
          <tbody id="gsc-pages-tbody">${rows}</tbody>
        </table>
      </div>`;
    }

    function _filterPages() {
        const q = (document.getElementById('gsc-page-filter')?.value || '').toLowerCase();
        document.querySelectorAll('#gsc-pages-tbody tr').forEach(tr => { tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none'; });
    }

    function _exportPages() {
        exportCSV(_gscPagesData.map(r => {
            let path = r.page; try { path = new URL(r.page).pathname; } catch { }
            return [path, r.clicks, r.impressions, fPct(r.ctr), fPos(r.position)];
        }), ['URL', 'Clicks', 'Impressions', 'CTR', 'Avg Position'], 'gsc-pages.csv');
    }

    // ════════════════════════════════════════════════════════════
    //  SECTION 8 — Device & Country
    // ════════════════════════════════════════════════════════════

    const COUNTRY_NAMES = { usa: 'United States', gbr: 'United Kingdom', ind: 'India', can: 'Canada', aus: 'Australia', deu: 'Germany', fra: 'France', nld: 'Netherlands', sgp: 'Singapore', bra: 'Brazil', jpn: 'Japan', esp: 'Spain', ita: 'Italy', mex: 'Mexico', irl: 'Ireland' };
    const COUNTRY_FLAGS = { usa: '🇺🇸', gbr: '🇬🇧', ind: '🇮🇳', can: '🇨🇦', aus: '🇦🇺', deu: '🇩🇪', fra: '🇫🇷', nld: '🇳🇱', sgp: '🇸🇬', bra: '🇧🇷', jpn: '🇯🇵', esp: '🇪🇸', ita: '🇮🇹', mex: '🇲🇽', irl: '🇮🇪' };

    async function loadDevicesCountries(siteUrl, sd, ed) {
        showSkeleton('gsc-s8-body');
        try {
            const data = await GA4_API.fetchGSCDevicesCountries(siteUrl, sd, ed);
            renderDevicesCountries(data);
        } catch (e) {
            showError('gsc-s8-body', e.message || 'Failed to load Devices & Countries', () => loadDevicesCountries(siteUrl, sd, ed));
        }
    }

    function renderDevicesCountries({ devices, countries }) {
        const el = document.getElementById('gsc-s8-body');
        if (!el) return;

        const minCtrDevice = devices.reduce((min, r) => r.ctr < min.ctr ? r : min, devices[0] || { ctr: 1 });
        const deviceRows = devices.map(r => `<tr class="${r.device === minCtrDevice?.device ? 'row-warn' : ''}">
      <td style="text-transform:capitalize">${r.device?.toLowerCase()}</td>
      <td class="num">${fNum(r.clicks)}</td>
      <td class="num">${fNum(r.impressions)}</td>
      <td class="num"><span class="eng-badge ${ctrColor(r.ctr)}">${fPct(r.ctr)}</span></td>
      <td class="num"><span class="eng-badge ${posColor(r.position)}">${fPos(r.position)}</span></td>
    </tr>`).join('');

        const ctryRows = countries.map(r => {
            const code = (r.country || '').toLowerCase();
            const flag = COUNTRY_FLAGS[code] || '🌐';
            const name = COUNTRY_NAMES[code] || r.country;
            return `<tr>
        <td>${flag} ${name}</td>
        <td class="num">${fNum(r.clicks)}</td>
        <td class="num">${fNum(r.impressions)}</td>
        <td class="num"><span class="eng-badge ${ctrColor(r.ctr)}">${fPct(r.ctr)}</span></td>
        <td class="num"><span class="eng-badge ${posColor(r.position)}">${fPos(r.position)}</span></td>
      </tr>`;
        }).join('');

        el.innerHTML = `
      <div class="grid-2">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="panel__title" style="font-size:13px">By Device</div>
            <button class="btn btn-ghost btn-sm" onclick="GSC_TAB._exportDevices()">⬇ CSV</button>
          </div>
          <div class="insight-banner insight-yellow" style="margin-bottom:8px">📱 If mobile CTR is significantly lower than desktop, your mobile titles/descriptions need optimization.</div>
          <div class="data-table-wrap"><table class="data-table" id="gsc-device-table">
            <thead><tr><th>Device</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">CTR</th><th class="num">Position</th></tr></thead>
            <tbody>${deviceRows}</tbody>
          </table></div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="panel__title" style="font-size:13px">Top Countries</div>
            <button class="btn btn-ghost btn-sm" onclick="GSC_TAB._exportCountries()">⬇ CSV</button>
          </div>
          <div class="data-table-wrap"><table class="data-table" id="gsc-country-table">
            <thead><tr><th>Country</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">CTR</th><th class="num">Position</th></tr></thead>
            <tbody>${ctryRows}</tbody>
          </table></div>
        </div>
      </div>`;
        window._gscDevicesData = devices; window._gscCountriesData = countries;
    }

    function _exportDevices() {
        exportCSV((window._gscDevicesData || []).map(r => [r.device, r.clicks, r.impressions, fPct(r.ctr), fPos(r.position)]), ['Device', 'Clicks', 'Impressions', 'CTR', 'Position'], 'gsc-devices.csv');
    }
    function _exportCountries() {
        exportCSV((window._gscCountriesData || []).map(r => [r.country, r.clicks, r.impressions, fPct(r.ctr), fPos(r.position)]), ['Country', 'Clicks', 'Impressions', 'CTR', 'Position'], 'gsc-countries.csv');
    }

    // ── Load All ─────────────────────────────────────────────────
    function loadAll(siteUrl, sd, ed) {
        loadOverview(siteUrl, sd, ed);
        loadQueryIntelligence(siteUrl, sd, ed);
        loadPagePerformance(siteUrl, sd, ed);
        loadDevicesCountries(siteUrl, sd, ed);
    }

    return {
        loadAll, loadOverview, loadQueryIntelligence, loadPagePerformance, loadDevicesCountries,
        _dotOver, _dotOut, _switchQueryTab, _filterPages, _exportPages,
        _exportTop50, _exportCtrOpps, _exportRankOpps,
        _exportDevices, _exportCountries, renderSVGChart
    };
})();
