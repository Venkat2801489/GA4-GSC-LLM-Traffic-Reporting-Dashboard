/**
 * blended-tab.js — Blended GA4 + GSC Cross-Platform Insights
 */

const BLENDED_TAB = (() => {

    const fNum = n => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
    const fPct = n => (n == null ? '—' : n.toFixed(1) + '%');

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

    function exportCSV(rows, headers, filename) {
        const lines = [headers.join(',')];
        rows.forEach(r => lines.push(r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    }

    async function loadAll(propId, siteUrl, sd, ed, psd = null, ped = null) {
        showSkeleton('blended-body');
        try {
            const [acqData, gscPagesData, gscOvData, ga4LandingData] = await Promise.all([
                GA4_API.fetchTrafficAcquisition(propId, sd, ed, psd, ped),
                GA4_API.fetchGSCPages(siteUrl, sd, ed),
                GA4_API.fetchGSCOverview(siteUrl, sd, ed),
                GA4_API.fetchTopLandingPages(propId, sd, ed)
            ]);

            const computed = GA4_API.computeBlended({
                gscTotals: gscOvData.totals,
                ga4Rows: acqData.rows,
                gscPages: gscPagesData,
                ga4Landing: ga4LandingData
            });

            window._blendedMatchTable = computed.matchTable;
            render(computed, acqData, gscOvData.totals);
        } catch (e) {
            showError('blended-body', e.message || 'Failed to load Blended data', () => loadAll(propId, siteUrl, sd, ed));
        }
    }

    function render({ trackingGap, contentEfficiency, gscClicks, ga4OrganicSessions, matchTable }, acqData, gscTotals) {
        const el = document.getElementById('blended-body');
        if (!el) return;

        // Organic CR from acqData
        const organicRow = (acqData?.rows || []).find(r => (r.sessionDefaultChannelGroup || '').toLowerCase().includes('organic'));
        const organicSess = organicRow?.sessions || 0;
        const totalKeyEvents = window._ga4TotalKeyEvents || 0;
        const organicCR = organicSess > 0 && totalKeyEvents > 0 ? (totalKeyEvents / organicSess * 100) : null;

        function metricCard(icon, label, value, note, good) {
            const cls = good === true ? 'blended-card--good' : good === false ? 'blended-card--bad' : '';
            return `<div class="blended-card ${cls}">
        <div class="blended-card__icon">${icon}</div>
        <div class="blended-card__label">${label}</div>
        <div class="blended-card__value">${value}</div>
        ${note ? `<div class="blended-card__note">${note}</div>` : ''}
      </div>`;
        }

        const gapGood = trackingGap !== null ? trackingGap < 20 : null;
        const gapVal = trackingGap !== null ? fPct(trackingGap) : 'N/A';
        const gapNote = trackingGap !== null
            ? (trackingGap > 30 ? '⚠️ Over 30% of search clicks are untracked in GA4' : trackingGap > 15 ? 'Moderate tracking gap — check GA4 tag setup' : '✅ Tracking gap is healthy')
            : 'Requires both GA4 and GSC data';

        const ceVal = contentEfficiency !== null ? fPct(contentEfficiency) : 'N/A';
        const ceNote = contentEfficiency !== null ? `${fPct(contentEfficiency)} of GSC clicks resulted in an engaged session` : 'Requires GA4 + GSC data';

        const crVal = organicCR !== null ? fPct(organicCR) : 'N/A';
        const crNote = organicCR !== null ? 'Key events / organic sessions from GA4' : 'Requires GA4 key events to be configured';

        const cards = `<div class="blended-cards-row">
      ${metricCard('🔍', 'Tracking Gap', gapVal, gapNote, gapGood)}
      ${metricCard('⚡', 'Content Efficiency Score', ceVal, ceNote, contentEfficiency !== null ? contentEfficiency > 50 : null)}
      ${metricCard('🎯', 'Organic Conversion Rate', crVal, crNote, organicCR !== null ? organicCR > 2 : null)}
      ${metricCard('📈', 'GSC Clicks → GA4 Organic', `${fNum(ga4OrganicSessions)} / ${fNum(gscClicks)}`, 'GA4 organic sessions vs GSC total clicks', null)}
    </div>`;

        // Match table
        const tableRows = (matchTable || []).filter(r => r.gscClicks > 0 || r.ga4Sessions > 0).map(r => {
            const gap = r.trackingGap !== null ? fPct(r.trackingGap) : '—';
            const gapCls = r.trackingGap === null ? '' : r.trackingGap > 30 ? 'eng-red' : r.trackingGap > 15 ? 'eng-yellow' : 'eng-green';
            return `<tr>
        <td><span class="url-cell" title="${r.path}">${r.path.length > 50 ? r.path.slice(0, 47) + '…' : r.path}</span></td>
        <td class="num">${fNum(r.ga4Sessions)}</td>
        <td class="num">${fNum(r.gscClicks)}</td>
        <td class="num"><span class="eng-badge ${gapCls}">${gap}</span></td>
      </tr>`;
        }).join('');

        const emptyTable = !tableRows ? `<div class="empty-state"><div class="empty-state__icon">🔗</div><div class="empty-state__title">No page matches found</div><div class="empty-state__msg">Both GSC and GA4 data are required to build the page match table.</div></div>` : '';

        el.innerHTML = `
      <div class="insight-banner insight-blue" style="margin-bottom:20px">
        🔗 <strong>Blended Insights</strong> combines GA4 and GSC data to surface gaps and opportunities not visible in either tool alone.
      </div>
      ${cards}
      ${tableRows ? `
        <div style="display:flex;align-items:center;justify-content:space-between;margin:24px 0 12px">
          <div class="panel__title">Page-Level Match Table: GA4 vs GSC</div>
          <button class="btn btn-ghost btn-sm" onclick="BLENDED_TAB._exportMatchTable()">⬇ Export CSV</button>
        </div>
        <div class="data-table-wrap"><table class="data-table">
          <thead><tr><th>URL Path</th><th class="num">GA4 Sessions</th><th class="num">GSC Clicks</th><th class="num">Tracking Gap</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>` : emptyTable}`;
    }

    function _exportMatchTable() {
        const rows = window._blendedMatchTable || [];
        exportCSV(
            rows.map(r => [r.path, r.ga4Sessions, r.gscClicks, r.trackingGap !== null ? r.trackingGap.toFixed(1) + '%' : '—']),
            ['URL Path', 'GA4 Sessions', 'GSC Clicks', 'Tracking Gap'],
            'blended-page-match.csv'
        );
    }

    return { loadAll, _exportMatchTable };
})();
