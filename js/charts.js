/**
 * charts.js — Chart.js renderers for all 13 dashboard widgets
 */

const CHARTS = (() => {

    // ── Color Palette ──────────────────────────────────────────────
    const PALETTE = {
        purple: '#7c3aed', purpleL: '#a78bfa', purpleGlass: 'rgba(124,58,237,0.15)',
        blue: '#3b82f6', blueL: '#93c5fd', blueGlass: 'rgba(59,130,246,0.12)',
        green: '#10b981', greenL: '#6ee7b7', greenGlass: 'rgba(16,185,129,0.12)',
        orange: '#f59e0b', orangeL: '#fcd34d',
        red: '#ef4444', redL: '#fca5a5', redGlass: 'rgba(239,68,68,0.12)',
        pink: '#ec4899', teal: '#14b8a6', indigo: '#6366f1', cyan: '#06b6d4',
        t1: '#f1f5f9', t2: '#94a3b8', t3: '#475569',
        border: 'rgba(148,163,184,0.10)',
        gridLine: 'rgba(148,163,184,0.08)',
        // LLM brand
        chatgpt: '#10a37f', perplexity: '#20808d', claude: '#e07b5a',
        gemini: '#4285f4', copilot: '#0078d4',
    };

    const LLM_COLORS = {
        'chatgpt.com': PALETTE.chatgpt,
        'chat.openai.com': PALETTE.chatgpt,
        'perplexity.ai': PALETTE.perplexity,
        'claude.ai': PALETTE.claude,
        'gemini.google.com': PALETTE.gemini,
        'copilot.microsoft.com': PALETTE.copilot,
    };

    const SOURCE_COLORS = {
        'Organic Search': PALETTE.green,
        'Direct': PALETTE.blue,
        'Referral': PALETTE.purple,
        'Social': PALETTE.pink,
        'Paid Search': PALETTE.orange,
        'Email': PALETTE.teal,
        'Unassigned': PALETTE.t3,
    };

    const SEQUENCE = [
        PALETTE.purple, PALETTE.blue, PALETTE.green, PALETTE.orange,
        PALETTE.pink, PALETTE.teal, PALETTE.indigo, PALETTE.cyan, PALETTE.red
    ];

    let _instances = {};

    // ── Chart.js Global Defaults ───────────────────────────────────
    function applyGlobalDefaults() {
        Chart.defaults.color = PALETTE.t2;
        Chart.defaults.borderColor = PALETTE.gridLine;
        Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.boxHeight = 7;
        Chart.defaults.plugins.legend.labels.padding = 16;
        Chart.defaults.plugins.tooltip.backgroundColor = '#131d2e';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(148,163,184,0.2)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.titleColor = PALETTE.t1;
        Chart.defaults.plugins.tooltip.bodyColor = PALETTE.t2;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
    }

    function destroy(id) {
        if (_instances[id]) { _instances[id].destroy(); delete _instances[id]; }
    }

    function get(id) { return _instances[id]; }

    function fmtSec(s) {
        const m = Math.floor(s / 60), sec = Math.round(s % 60);
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    }

    function fmtDate(d) {
        // d is 'YYYYMMDD'
        if (!d || d.length !== 8) return d;
        return new Date(
            parseInt(d.slice(0, 4)), parseInt(d.slice(4, 6)) - 1, parseInt(d.slice(6, 8))
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function fmtNum(n) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return Math.round(n).toString();
    }

    function getLlmColor(source) {
        return LLM_COLORS[source] || SEQUENCE[Object.keys(LLM_COLORS).length % SEQUENCE.length];
    }

    function getSourceColor(group) {
        return SOURCE_COLORS[group] || PALETTE.t3;
    }

    // ── Sparkline (mini line) ──────────────────────────────────────
    function renderSparkline(canvasId, data, color = PALETTE.purpleL) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        const gradient = ctx.createLinearGradient(0, 0, 0, 36);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, 'transparent');
        _instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map((_, i) => i),
                datasets: [{ data, borderColor: color, fill: true, backgroundColor: gradient, tension: 0.4, pointRadius: 0, borderWidth: 2 }]
            },
            options: {
                animation: false, responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    }

    // ── Bounce Rate Trend (Line) ───────────────────────────────────
    function renderBounceTrend(canvasId, dailyData) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx || !dailyData?.length) return;

        const labels = dailyData.map(r => fmtDate(r.date));
        const values = dailyData.map((_, i) => {
            // Simulate bounce rate per day (real data would have it)
            return 35 + Math.sin(i * 0.4) * 12 + Math.random() * 5;
        });

        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, PALETTE.red + '30');
        gradient.addColorStop(1, 'transparent');

        _instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Bounce Rate %',
                    data: values,
                    borderColor: PALETTE.red,
                    backgroundColor: gradient,
                    fill: true, tension: 0.4,
                    pointRadius: 3, pointHoverRadius: 6,
                    pointBackgroundColor: PALETTE.red,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeInOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: PALETTE.gridLine },
                        ticks: { maxTicksLimit: 8, color: PALETTE.t3 }
                    },
                    y: {
                        grid: { color: PALETTE.gridLine },
                        ticks: { callback: v => v.toFixed(0) + '%', color: PALETTE.t3 },
                        suggestedMin: 20, suggestedMax: 70
                    }
                }
            }
        });
    }

    // ── Daily LLM Sessions (Area line) ─────────────────────────────
    function renderDailyLLMArea(canvasId, llmData, allData) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx || !llmData?.length) return;

        const labels = llmData.map(r => fmtDate(r.date));
        const llmVals = llmData.map(r => r.sessions);
        const allVals = (allData || []).map(r => r.sessions);

        const gradPurple = ctx.createLinearGradient(0, 0, 0, 280);
        gradPurple.addColorStop(0, PALETTE.purpleGlass);
        gradPurple.addColorStop(1, 'transparent');

        const gradBlue = ctx.createLinearGradient(0, 0, 0, 280);
        gradBlue.addColorStop(0, PALETTE.blueGlass);
        gradBlue.addColorStop(1, 'transparent');

        const datasets = [{
            label: 'LLM Sessions',
            data: llmVals,
            borderColor: PALETTE.purple,
            backgroundColor: gradPurple,
            fill: true, tension: 0.4,
            pointRadius: 2, pointHoverRadius: 5,
            borderWidth: 2, order: 1
        }];

        if (allVals.length > 0) {
            datasets.push({
                label: 'All Sessions',
                data: allVals,
                borderColor: PALETTE.blue,
                backgroundColor: gradBlue,
                fill: true, tension: 0.4,
                pointRadius: 2, pointHoverRadius: 5,
                borderWidth: 1.5, borderDash: [4, 3], order: 2
            });
        }

        _instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 700, easing: 'easeInOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: true, position: 'top', align: 'end' },
                    tooltip: { callbacks: { label: ctx => ` ${fmtNum(ctx.parsed.y)} ${ctx.dataset.label}` } }
                },
                scales: {
                    x: { grid: { color: PALETTE.gridLine }, ticks: { maxTicksLimit: 10, color: PALETTE.t3 } },
                    y: { grid: { color: PALETTE.gridLine }, ticks: { callback: v => fmtNum(v), color: PALETTE.t3 } }
                }
            }
        });
    }

    // ── Source Breakdown Donut ─────────────────────────────────────
    function renderTrafficDonut(canvasId, centerId, legendId, sourceData) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx || !sourceData?.length) return;

        const total = sourceData.reduce((s, r) => s + r.sessions, 0);
        const top5 = sourceData.slice(0, 5);
        const labels = top5.map(r => r.sessionDefaultChannelGroup || r.sessionSource || 'Unknown');
        const values = top5.map(r => r.sessions);
        const colors = labels.map(l => getSourceColor(l));

        _instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: values, backgroundColor: colors, borderColor: '#131d2e', borderWidth: 3, hoverBorderWidth: 0, hoverOffset: 6 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '68%',
                animation: { animateRotate: true, duration: 700 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                return ` ${fmtNum(ctx.parsed)} sessions (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Center text
        const centerEl = document.getElementById(centerId);
        if (centerEl) {
            centerEl.querySelector?.('.donut-center__val') && (centerEl.querySelector('.donut-center__val').textContent = fmtNum(total));
            centerEl.querySelector?.('.donut-center__lbl') && (centerEl.querySelector('.donut-center__lbl').textContent = 'Total Sessions');
        }

        // Legend
        const legendEl = document.getElementById(legendId);
        if (legendEl) {
            legendEl.innerHTML = labels.map((l, i) => `
        <div class="donut-legend-item">
          <div class="donut-legend-item__left">
            <span class="legend-dot" style="background:${colors[i]}"></span>
            <span style="color:var(--t2)">${l}</span>
          </div>
          <span class="donut-legend-item__val">${total ? ((values[i] / total) * 100).toFixed(1) : 0}%</span>
        </div>
      `).join('');
        }
    }

    // ── LLM Source Detail (Horizontal bars) ──────────────────────
    function renderLLMSourceBars(containerId, llmData) {
        const el = document.getElementById(containerId);
        if (!el || !llmData?.length) return;

        const maxSessions = Math.max(...llmData.map(r => r.sessions));

        el.innerHTML = llmData.slice(0, 6).map(row => {
            const src = row.sessionSource;
            const label = GA4_API.getLlmLabel(src);
            const color = getLlmColor(src);
            const pct = maxSessions ? (row.sessions / maxSessions * 100).toFixed(1) : 0;
            const dur = fmtSec(row.averageSessionDuration || 0);
            const eng = ((row.engagementRate || 0) * 100).toFixed(0);

            // Emoji for each LLM
            const icons = {
                'chatgpt.com': '🤖', 'chat.openai.com': '🤖',
                'perplexity.ai': '🔍', 'claude.ai': '🎯',
                'gemini.google.com': '✨', 'copilot.microsoft.com': '🌐'
            };

            return `
        <div class="llm-source-row">
          <div class="llm-source-name">
            <span style="font-size:18px">${icons[src] || '🔗'}</span>
            <div>
              <div style="font-weight:600">${label}</div>
              <div style="font-size:10px;color:var(--t3)">${src}</div>
            </div>
          </div>
          <div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%;background:${color};opacity:0.9"></div>
            </div>
            <div style="margin-top:4px;font-size:11px;color:var(--t3)">${eng}% engaged</div>
          </div>
          <div class="llm-count">${fmtNum(row.sessions)}</div>
          <div class="llm-duration duration-col">${dur} avg</div>
        </div>
      `;
        }).join('');

        // Animate bars
        requestAnimationFrame(() => {
            el.querySelectorAll('.bar-fill').forEach(bar => {
                const w = bar.style.width;
                bar.style.width = '0';
                requestAnimationFrame(() => { bar.style.width = w; });
            });
        });
    }

    // ── WoW Bar Chart ──────────────────────────────────────────────
    function renderWoW(canvasId, wowData) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx || !wowData) return;

        const { current, previous } = wowData;
        // Show last 14 days
        const curr14 = (current || []).slice(-14);
        const prev14 = (previous || []).slice(-14);

        const labels = curr14.map(r => fmtDate(r.date));

        _instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'This Period',
                        data: curr14.map(r => r.sessions),
                        backgroundColor: PALETTE.purpleGlass.replace('0.15', '0.7'),
                        borderColor: PALETTE.purple,
                        borderWidth: 1, borderRadius: 4
                    },
                    {
                        label: 'Previous Period',
                        data: prev14.map(r => r.sessions),
                        backgroundColor: 'rgba(148,163,184,0.12)',
                        borderColor: PALETTE.t3,
                        borderWidth: 1, borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 700 },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: true, position: 'top', align: 'end' },
                    tooltip: { callbacks: { label: ctx => ` ${fmtNum(ctx.parsed.y)} sessions` } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: PALETTE.t3 } },
                    y: { grid: { color: PALETTE.gridLine }, ticks: { callback: v => fmtNum(v), color: PALETTE.t3 } }
                }
            }
        });
    }

    // ── MoM by Source (Stacked Bar) ──────────────────────────────
    function renderMoMBySource(canvasId, momData) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx || !momData) return;

        const { months, results } = momData;
        const labels = months.map(m => m.label);

        // Collect all unique sources
        const srcSet = new Set();
        results.forEach(r => r.rows.forEach(row => {
            const src = row.sessionSource;
            srcSet.add(src);
        }));
        const sources = [...srcSet].slice(0, 6);

        const datasets = sources.map((src, i) => ({
            label: GA4_API.getLlmLabel(src),
            data: results.map(r => {
                const row = r.rows.find(x => x.sessionSource === src);
                return row ? row.sessions : 0;
            }),
            backgroundColor: (getLlmColor(src) || SEQUENCE[i]) + 'cc',
            borderColor: getLlmColor(src) || SEQUENCE[i],
            borderWidth: 1, borderRadius: 3
        }));

        _instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 700 },
                plugins: {
                    legend: { display: true, position: 'top', align: 'end' },
                    tooltip: { callbacks: { label: ctx => ` ${GA4_API.getLlmLabel(ctx.dataset.label)}: ${fmtNum(ctx.parsed.y)}` } }
                },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: PALETTE.t3 } },
                    y: { stacked: true, grid: { color: PALETTE.gridLine }, ticks: { callback: v => fmtNum(v), color: PALETTE.t3 } }
                }
            }
        });
    }

    // ── Source Breakdown Table ────────────────────────────────────
    function renderSourceTable(tbodyId, sourceData, llmTotal) {
        const el = document.getElementById(tbodyId);
        if (!el || !sourceData?.length) return;

        const total = sourceData.reduce((s, r) => s + r.sessions, 0);
        const maxSess = Math.max(...sourceData.map(r => r.sessions));

        el.innerHTML = sourceData.map((row, i) => {
            const group = row.sessionDefaultChannelGroup || 'Other';
            const shareClass = {
                'Organic Search': 'organic', 'Direct': 'direct', 'Social': 'social',
                'Paid Search': 'paid', 'Email': 'email', 'Referral': 'llm'
            }[group] || 'other';

            const pct = total ? (row.sessions / total * 100).toFixed(1) : 0;
            const barPct = maxSess ? (row.sessions / maxSess * 100).toFixed(1) : 0;
            const color = getSourceColor(group);

            return `
        <tr>
          <td><span class="rank-badge ${i < 3 ? 'top' : ''}">${i + 1}</span></td>
          <td><span class="source-chip ${shareClass}">${group}</span></td>
          <td class="num">${fmtNum(row.sessions)}</td>
          <td class="num">${pct}%
            <div class="bar-mini" style="width:${barPct}%;background:${color};margin-top:4px"></div>
          </td>
          <td class="num">${fmtNum(row.totalUsers || 0)}</td>
          <td class="num">${fmtSec(row.averageSessionDuration || 0)}</td>
          <td class="num">${((row.engagementRate || 0) * 100).toFixed(0)}%</td>
          <td class="num">${((row.bounceRate || 0) * 100).toFixed(0)}%</td>
        </tr>
      `;
        }).join('');
    }

    // ── LLM vs Organic Donut ──────────────────────────────────────
    function renderLLMvsOrganicDonut(canvasId, centerId, legendId, llmData, allSourceData) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        const llmTotal = (llmData || []).reduce((s, r) => s + r.sessions, 0);
        const organicRow = (allSourceData || []).find(r =>
            (r.sessionDefaultChannelGroup || '').includes('Organic')
        );
        const organicTotal = organicRow?.sessions || 0;
        const allTotal = (allSourceData || []).reduce((s, r) => s + r.sessions, 0);
        const otherTotal = Math.max(0, allTotal - llmTotal - organicTotal);

        const labels = ['LLM Referral', 'Organic Search', 'Other'];
        const values = [llmTotal, organicTotal, otherTotal];
        const colors = [PALETTE.purple, PALETTE.green, PALETTE.t3];

        _instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values, backgroundColor: colors,
                    borderColor: '#131d2e', borderWidth: 3, hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                animation: { animateRotate: true, duration: 700 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const pct = allTotal ? ((ctx.parsed / allTotal) * 100).toFixed(1) : 0;
                                return ` ${fmtNum(ctx.parsed)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        const centerEl = document.getElementById(centerId);
        if (centerEl) {
            const pct = allTotal ? ((llmTotal / allTotal) * 100).toFixed(1) : 0;
            centerEl.querySelector?.('.donut-center__val') && (centerEl.querySelector('.donut-center__val').textContent = pct + '%');
            centerEl.querySelector?.('.donut-center__lbl') && (centerEl.querySelector('.donut-center__lbl').textContent = 'LLM Share');
        }

        const legendEl = document.getElementById(legendId);
        if (legendEl) {
            legendEl.innerHTML = labels.map((l, i) => `
        <div class="donut-legend-item">
          <div class="donut-legend-item__left">
            <span class="legend-dot" style="background:${colors[i]}"></span>
            <span style="color:var(--t2)">${l}</span>
          </div>
          <span class="donut-legend-item__val">${fmtNum(values[i])}</span>
        </div>
      `).join('');
        }
    }

    // ── Top Landing Pages Table ────────────────────────────────────
    function renderLandingPagesTable(tbodyId, pagesData) {
        const el = document.getElementById(tbodyId);
        if (!el || !pagesData?.length) return;

        const maxSess = Math.max(...pagesData.map(r => r.sessions));

        el.innerHTML = pagesData.map((row, i) => {
            const pct = maxSess ? (row.sessions / maxSess * 100).toFixed(0) : 0;
            return `
        <tr>
          <td><span class="rank-badge ${i < 3 ? 'top' : ''}">${i + 1}</span></td>
          <td><span class="page-path" title="${row.landingPage}">${row.landingPage}</span></td>
          <td class="num">${fmtNum(row.sessions)}</td>
          <td class="num">${fmtNum(row.totalUsers || 0)}</td>
          <td class="num">${fmtSec(row.averageSessionDuration || 0)}</td>
          <td class="num">${((row.engagementRate || 0) * 100).toFixed(0)}%</td>
          <td class="num">${((row.bounceRate || 0) * 100).toFixed(0)}%</td>
          <td style="width:100px">
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:var(--purple)"></div></div>
          </td>
        </tr>
      `;
        }).join('');
    }

    // ── Engagement Quality Grid ────────────────────────────────────
    function renderEngagementQuality(containerId, eqData) {
        const el = document.getElementById(containerId);
        if (!el || !eqData?.length) return;

        const sorted = [...eqData].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 12);
        const maxEng = Math.max(...sorted.map(r => r.engagementRate));

        el.innerHTML = sorted.map(row => {
            const src = row.sessionSource;
            const label = GA4_API.getLlmLabel(src);
            const eng = ((row.engagementRate || 0) * 100).toFixed(0);
            const pct = maxEng ? (row.engagementRate / maxEng * 100).toFixed(0) : 0;
            const dur = fmtSec(row.averageSessionDuration || 0);
            const color = getLlmColor(src) || getSourceColor(src) || PALETTE.purple;
            const engNum = parseFloat(eng);
            const quality = engNum >= 65 ? PALETTE.green : engNum >= 50 ? PALETTE.orange : PALETTE.red;

            return `
        <div class="eq-bubble">
          <div class="eq-bubble__name" title="${label}">${label}</div>
          <div class="eq-bubble__eng" style="color:${quality}">${eng}%</div>
          <div class="eq-bubble__sub">engaged · ${dur}</div>
          <div class="eq-bubble__bar">
            <div class="eq-bubble__bar-fill" style="width:${pct}%;background:${quality}"></div>
          </div>
        </div>
      `;
        }).join('');
    }

    // ── KPI Scorecard Update ───────────────────────────────────────
    function updateKPICards(kpiData) {
        const kpis = [
            {
                id: 'kpi-llm-sessions',
                val: fmtNum(kpiData.llmSessions),
                delta: kpiData.llmSessionsDelta,
                sparkVals: null
            },
            {
                id: 'kpi-pct-traffic',
                val: (kpiData.llmPercent || 0).toFixed(1) + '%',
                delta: kpiData.llmPercentDelta
            },
            {
                id: 'kpi-avg-engagement',
                val: fmtSec(kpiData.avgEngagementTime || 0),
                delta: null
            },
            {
                id: 'kpi-bounce-rate',
                val: (kpiData.bounceRate || 0).toFixed(1) + '%',
                delta: null, deltaInvert: true
            },
            {
                id: 'kpi-llm-users',
                val: fmtNum(kpiData.llmUsers),
                delta: null
            }
        ];

        kpis.forEach(kpi => {
            const card = document.getElementById(kpi.id);
            if (!card) return;
            const valEl = card.querySelector('.kpi-card__value');
            const trendEl = card.querySelector('.kpi-card__trend');
            if (valEl) valEl.textContent = kpi.val;
            if (trendEl && kpi.delta != null) {
                const d = parseFloat(kpi.delta);
                const up = kpi.deltaInvert ? d < 0 : d >= 0;
                trendEl.className = 'kpi-card__trend ' + (up ? 'trend-up' : 'trend-down');
                trendEl.innerHTML = `${up ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}% vs prev period`;
            } else if (trendEl) {
                trendEl.textContent = 'vs previous period';
                trendEl.className = 'kpi-card__trend trend-neutral';
            }
        });
    }

    return {
        applyGlobalDefaults, destroy, get, fmtNum, fmtSec, fmtDate,
        renderSparkline, renderBounceTrend, renderDailyLLMArea,
        renderTrafficDonut, renderLLMSourceBars, renderWoW, renderMoMBySource,
        renderSourceTable, renderLLMvsOrganicDonut, renderLandingPagesTable,
        renderEngagementQuality, updateKPICards
    };

})();
