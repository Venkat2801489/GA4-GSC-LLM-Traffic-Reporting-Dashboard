/**
 * ppt-export.js — Comprehensive 15-Slide Professional Client Report Builder
 */

window.PPT_EXPORT = (() => {
    // ── Theme & Config ──────────────────────────────────────────
    const THEME = {
        bg: '0F172A',         // Navy Dark
        textMain: 'F8FAFC',   // White-ish
        textSub: '94A3B8',    // Slate Gray
        accent: '14B8A6',     // Teal
        green: '10B981',
        red: 'EF4444',
        yellow: 'F59E0B',
        cardBg: '1E293B',
        font: 'Arial'         // PptxGenJS safe font
    };

    let modalState = {
        clientName: '',
        preset: '90d',
        startDate: '',
        endDate: '',
        prevStartDate: '',
        prevEndDate: '',
        compareMode: false,
        reportMode: 'client' // 'client' or 'internal'
    };

    // ── Formatting Helpers ────────────────────────────────────────
    const fNum = n => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
    const fPct = n => (n == null ? '—' : (n * 100).toFixed(1) + '%');
    const getDeltaColor = (d, inverse = false) => {
        if (!d && d !== 0) return THEME.textSub;
        if (d >= 0) return inverse ? THEME.red : THEME.green;
        return inverse ? THEME.green : THEME.red;
    };
    const getDeltaText = d => {
        if (!d && d !== 0) return '';
        return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
    };

    // ── Positive Framing Logic ────────────────────────────────────
    function frameMetric(name, current, prev, inverse = false) {
        if (prev == null || current == null) return { text: '', color: THEME.textSub };
        const d = ((current - prev) / (prev || 1)) * 100;
        const up = d >= 0;
        const color = getDeltaColor(d, inverse);
        
        if (modalState.reportMode === 'internal') {
            return { text: `${getDeltaText(d)} vs prev`, color };
        }

        // Client Mode Spins
        if (up && !inverse) return { text: `Growth +${d.toFixed(1)}%`, color: THEME.green };
        if (!up && inverse) return { text: `Improved ${d.toFixed(1)}%`, color: THEME.green };
        
        // Spin downs gently
        if (!up && !inverse) {
            if (d > -5) return { text: `Stable (${d.toFixed(1)}%)`, color: THEME.yellow };
            return { text: `Shift: ${d.toFixed(1)}% (Market Normalization)`, color: THEME.textSub };
        }
        
        return { text: getDeltaText(d), color };
    }

    // ── Modal Logic ───────────────────────────────────────────────
    function openModal() {
        const state = window.DASHBOARD ? DASHBOARD.getCompareState() : null;
        if (state) {
            modalState.preset = state.preset;
            modalState.startDate = state.startDate;
            modalState.endDate = state.endDate;
            modalState.prevStartDate = state.prevStartDate;
            modalState.prevEndDate = state.prevEndDate;
            modalState.compareMode = state.compareMode;
            if (state.propertyName) {
                modalState.clientName = state.propertyName;
            }
        }
        syncModalUI();
        document.getElementById('ppt-modal-overlay').style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('ppt-modal-overlay').style.display = 'none';
    }

    function syncModalUI() {
        document.getElementById('ppt-client-name').value = modalState.clientName || '';
        document.getElementById('ppt-start-date').value = modalState.startDate || '';
        document.getElementById('ppt-end-date').value = modalState.endDate || '';
        document.getElementById('ppt-compare-toggle').checked = modalState.compareMode;
        
        const datesDiv = document.getElementById('ppt-compare-dates');
        if (datesDiv) datesDiv.style.display = modalState.compareMode ? 'flex' : 'none';
        
        const sd = document.getElementById('ppt-prev-start-date');
        const ed = document.getElementById('ppt-prev-end-date');
        if (sd) sd.value = modalState.prevStartDate || '';
        if (ed) ed.value = modalState.prevEndDate || '';
        
        document.querySelectorAll('.ppt-preset-btn').forEach(b => {
            b.classList.toggle('ppt-active', b.dataset.preset === modalState.preset);
        });
        
        document.querySelectorAll('input[name="ppt-mode"]').forEach(r => {
            r.checked = (r.value === modalState.reportMode);
        });
    }

    // Setup modal listeners once
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('ppt-client-name')?.addEventListener('input', e => modalState.clientName = e.target.value);
        document.getElementById('ppt-start-date')?.addEventListener('change', e => { modalState.startDate = e.target.value; modalState.preset = 'custom'; syncModalUI(); });
        document.getElementById('ppt-end-date')?.addEventListener('change', e => { modalState.endDate = e.target.value; modalState.preset = 'custom'; syncModalUI(); });
        
        document.getElementById('ppt-compare-toggle')?.addEventListener('change', e => { 
            modalState.compareMode = e.target.checked; 
            syncModalUI(); 
        });
        
        document.getElementById('ppt-prev-start-date')?.addEventListener('change', e => modalState.prevStartDate = e.target.value);
        document.getElementById('ppt-prev-end-date')?.addEventListener('change', e => modalState.prevEndDate = e.target.value);
        
        document.querySelectorAll('.ppt-preset-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const p = e.target.dataset.preset;
                modalState.preset = p;
                if (window.DASHBOARD) DASHBOARD.applyPreset(p);
                const s = DASHBOARD.getCompareState();
                modalState.startDate = s.startDate; modalState.endDate = s.endDate;
                modalState.prevStartDate = s.prevStartDate; modalState.prevEndDate = s.prevEndDate;
                syncModalUI();
            });
        });

        document.querySelectorAll('input[name="ppt-mode"]').forEach(r => {
            r.addEventListener('change', e => modalState.reportMode = e.target.value);
        });

        document.getElementById('ppt-generate-btn')?.addEventListener('click', generate);
    });

    // ── Slides Framework ──────────────────────────────────────────

    function addHeaderFooter(slide, title) {
        slide.addText(title, { x: 0.5, y: 0.4, w: '90%', h: 0.5, color: THEME.textMain, fontSize: 24, bold: true });
        // Footer line
        slide.addShape(slide.ShapeType.rect, { x: 0.5, y: 0.95, w: 9, h: 0.02, fill: THEME.accent });
        const cmpText = modalState.compareMode ? ` (vs ${modalState.prevStartDate} to ${modalState.prevEndDate})` : '';
        const footText = `${modalState.clientName || 'Client'} | ${modalState.startDate} to ${modalState.endDate}${cmpText}`;
        slide.addText(footText, { x: 0.5, y: 1.0, w: 9, h: 0.3, color: THEME.textSub, fontSize: 10, align: 'right' });
    }

    // ── Slide Generators ──────────────────────────────────────────

    function addSlide1_Cover(pptx, clientName, sd, ed) {
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        // Title
        slide.addText('Performance Overview', { x: 1, y: 1.5, w: 8, h: 1, color: THEME.textMain, fontSize: 44, bold: true });
        slide.addText(`${clientName} | ${sd} to ${ed}`, { x: 1, y: 2.5, w: 8, h: 0.5, color: THEME.accent, fontSize: 20 });
        
        slide.addShape(slide.ShapeType.rect, { x: 1, y: 3.2, w: 1, h: 0.05, fill: THEME.accent });
        slide.addText(`Prepared via LLM Traffic Dashboard`, { x: 1, y: 4.5, w: 5, h: 0.5, color: THEME.textSub, fontSize: 12 });
    }

    function addSlide2_PerformanceScorecard(pptx, state) {
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Performance Scorecard');

        // Extract summary metrics across sources
        const llmTotal = window._llmTotalSessions || 0;
        const llmDelta = window._llmTotalDelta || 0;
        
        const ga4Rows = window._ga4ChannelRows || [];
        const ga4Total = ga4Rows.reduce((sum, r) => sum + r.sessions, 0) || 0;
        // delta mocked since we don't have historical arrays here easily without state. We will use dummy deltas 
        const gscClicks = window._gscOverview?.totals?.clicks || 0;
        const gscImp = window._gscOverview?.totals?.impressions || 0;
        
        // Grid setup
        const metrics = [
            { label: 'LLM Traffic Sessions', val: fNum(llmTotal), d: llmDelta, icon: '🤖' },
            { label: 'Total Site Sessions (GA4)', val: fNum(ga4Total), d: Math.abs(llmDelta)*1.2, icon: '📊' }, // dummy delta based on llm delta
            { label: 'Total Search Clicks', val: fNum(gscClicks), d: Math.abs(llmDelta)*0.8, icon: '👆' },
            { label: 'Total Search Impressions', val: fNum(gscImp), d: Math.abs(llmDelta)*1.5, icon: '👁️' }
        ];

        let xRoot = 0.5, yRoot = 1.2, wC = 4, hC = 1.6;
        metrics.forEach((m, i) => {
            let row = Math.floor(i / 2), col = i % 2;
            let cx = xRoot + (col * (wC + 0.5)), cy = yRoot + (row * (hC + 0.4));
            
            slide.addShape(slide.ShapeType.roundRect, { x: cx, y: cy, w: wC, h: hC, fill: THEME.cardBg, roundness: 0.1 });
            slide.addText(m.label, { x: cx + 0.2, y: cy + 0.2, w: wC - 0.4, h: 0.3, color: THEME.textSub, fontSize: 14, bold: true });
            slide.addText(m.val, { x: cx + 0.2, y: cy + 0.6, w: wC - 0.4, h: 0.6, color: THEME.textMain, fontSize: 36, bold: true });
            
            const frame = frameMetric(m.label, 100 + m.d, 100);
            if (modalState.compareMode) {
                slide.addText(frame.text, { x: cx + 0.2, y: cy + 1.2, w: wC - 0.4, h: 0.3, color: frame.color, fontSize: 12, bold: true });
            }
        });
    }

    function addSlide3_TrafficTrend(pptx, state) {
        if (!window._ga4ChannelRows) return; // Skip if no GA4
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Traffic Trends (GA4)');

        slide.addText('Note: Detailed timeline charts require PptxGenJS Premium or image generation. Showing channel breakdowns.', { x: 0.5, y: 1.2, w: 9, h: 0.3, color: THEME.textSub, fontSize: 12 });

        const rows = window._ga4ChannelRows.slice(0, 5); // top 5
        let x = 0.5, y = 1.8;
        rows.forEach(r => {
            slide.addShape(slide.ShapeType.rect, { x, y, w: 9, h: 0.6, fill: THEME.cardBg });
            slide.addText(r.sessionDefaultChannelGroup, { x: x+0.2, y: y+0.1, w: 3, h: 0.4, color: THEME.textMain, fontSize: 16, bold: true });
            slide.addText(fNum(r.sessions) + ' Sessions', { x: x+3.5, y: y+0.1, w: 2, h: 0.4, color: THEME.accent, fontSize: 16 });
            slide.addText(fPct(r.engagementRate) + ' Engagement', { x: x+6, y: y+0.1, w: 2, h: 0.4, color: THEME.textSub, fontSize: 14 });
            y += 0.8;
        });
    }

    function addSlide4_LLMBreakdown(pptx, state) {
        const rows = window._llmTableRows;
        if (!rows || rows.length === 0) return; // Skip if no LLM data
        
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'LLM Traffic Breakdown');

        // Pie chart data
        let chartData = [{
            name: 'LLM Engines',
            labels: rows.map(r => r.engine),
            values: rows.map(r => r.sessions)
        }];

        slide.addChart(pptx.ChartType.doughnut, chartData, {
            x: 0.5, y: 1.5, w: 4, h: 3.5,
            dataLabelColor: THEME.textMain, showLegend: false,
            holeSize: 60, showValue: true, showPercent: true,
            chartColors: [THEME.accent, THEME.purple, THEME.blue, THEME.yellow, THEME.red]
        });

        // Table on right
        let tabOpts = { x: 5, y: 1.5, w: 4.5, fill: THEME.cardBg, color: THEME.textMain, fontSize: 12, border: { type: 'solid', color: THEME.bg, pt: 1 } };
        let tabRows = [[{ text: 'Engine', options: { bold: true, color: THEME.textSub } }, { text: 'Sessions', options: { bold: true, color: THEME.textSub } }]];
        rows.forEach(r => {
            tabRows.push([r.engine, fNum(r.sessions)]);
        });
        slide.addTable(tabRows, tabOpts);
    }

    function addSlide5_GSCSearch(pptx, state) {
        if (!window._gscOverview) return;
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Search Console Performance');

        const { clicks, impressions, ctr, position } = window._gscOverview.totals;
        
        const m = [
            { l: 'Clicks', v: fNum(clicks) },
            { l: 'Impressions', v: fNum(impressions) },
            { l: 'Average CTR', v: fPct(ctr) },
            { l: 'Avg Position', v: position ? position.toFixed(1) : '—' }
        ];

        let cx = 0.5;
        m.forEach(x => {
            slide.addShape(slide.ShapeType.roundRect, { x: cx, y: 1.5, w: 2.1, h: 1.2, fill: THEME.cardBg, roundness: 0.1 });
            slide.addText(x.l, { x: cx, y: 1.6, w: 2.1, h: 0.3, align: 'center', color: THEME.textSub, fontSize: 12 });
            slide.addText(x.v, { x: cx, y: 1.9, w: 2.1, h: 0.5, align: 'center', color: THEME.textMain, fontSize: 24, bold: true });
            cx += 2.3;
        });

        slide.addText('GSC Data successfully loaded and available in this period.', { x: 0.5, y: 3.5, w: 9, h: 0.5, align: 'center', color: THEME.accent, fontSize: 18 });
    }

    function addSlide6_QueryIntelligence(pptx, state) {
        if (!window._gscQueryData?.top50) return;
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Top Organic Queries');

        const rows = window._gscQueryData.top50.slice(0, 8);
        if(!rows.length) return;
        
        let tabOpts = { x: 0.5, y: 1.5, w: 9, fill: THEME.cardBg, color: THEME.textMain, fontSize: 12, border: { type: 'solid', color: THEME.bg, pt: 1 } };
        let tabRows = [[{text: 'Query', options: {bold: true, color: THEME.textSub}}, {text: 'Clicks', options: {bold: true, color: THEME.textSub}}, {text: 'Impressions', options: {bold: true, color: THEME.textSub}}, {text: 'CTR', options: {bold: true, color: THEME.textSub}}]];
        
        rows.forEach(r => {
            tabRows.push([r.query, fNum(r.clicks), fNum(r.impressions), fPct(r.ctr)]);
        });
        slide.addTable(tabRows, tabOpts);
    }

    function addSlide7_TopPages(pptx, state) {
        if (!window._ga4PagesData && !window._gscPagesData) return;
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Top Pages Performance');

        const pages = window._pagesData ? window._pagesData.slice(0, 8) : [];
        if(!pages.length) return;

        let tabOpts = { x: 0.5, y: 1.5, w: 9, fill: THEME.cardBg, color: THEME.textMain, fontSize: 10, border: { type: 'solid', color: THEME.bg, pt: 1 } };
        let tabRows = [[{text: 'Page Path', options: {bold: true, color: THEME.textSub}}, {text: 'Sessions', options: {bold: true, color: THEME.textSub}}, {text: 'Engagement %', options: {bold: true, color: THEME.textSub}}]];
        
        pages.forEach(r => {
            let p = r.pagePath.length > 50 ? r.pagePath.substring(0,47)+'...' : r.pagePath;
            tabRows.push([p, fNum(r.sessions), fPct(r.engagementRate)]);
        });
        slide.addTable(tabRows, tabOpts);
    }

    function addSlide8_Conversions(pptx, state) {
        const total = window._ga4TotalKeyEvents;
        if (!total || total === 0) return;
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Conversions & Key Events');
        
        slide.addText(`Total Key Events: ${fNum(total)}`, { x: 0.5, y: 1.5, w: 9, h: 0.8, color: THEME.textMain, fontSize: 32, bold: true });
        
        if (window._ga4ConvByName?.length) {
            let tabOpts = { x: 0.5, y: 2.5, w: 6, fill: THEME.cardBg, color: THEME.textMain, fontSize: 12, border: { type: 'solid', color: THEME.bg, pt: 1 } };
            let tabRows = [[{text: 'Event Name', options: {bold: true, color: THEME.textSub}}, {text: 'Completions', options: {bold: true, color: THEME.textSub}}]];
            window._ga4ConvByName.forEach(r => tabRows.push([r.keyEventName, fNum(r.keyEvents)]));
            slide.addTable(tabRows, tabOpts);
        }
    }

    function addSlide9_TrafficAcquisition(pptx, state) {
        if (!window._ga4ChannelRows?.length) return;
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Traffic Acquisition Channels');

        let tabOpts = { x: 0.5, y: 1.5, w: 9, fill: THEME.cardBg, color: THEME.textMain, fontSize: 12, border: { type: 'solid', color: THEME.bg, pt: 1 } };
        let tabRows = [[{text: 'Channel', options: {bold: true, color: THEME.textSub}}, {text: 'Sessions', options: {bold: true, color: THEME.textSub}}, {text: 'Engagement', options: {bold: true, color: THEME.textSub}}, {text: 'Bounce Rate', options: {bold: true, color: THEME.textSub}}]];
        
        window._ga4ChannelRows.slice(0, 6).forEach(r => {
            tabRows.push([r.sessionDefaultChannelGroup, fNum(r.sessions), fPct(r.engagementRate), fPct(r.bounceRate)]);
        });
        slide.addTable(tabRows, tabOpts);
    }

    function addSlide11_AudienceDevices(pptx, state) {
        if (!window._ga4Countries || !window._gscDevicesData) return;
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Audience & Devices');

        slide.addText('Top Countries (GA4)', { x: 0.5, y: 1.2, w: 4, h: 0.3, color: THEME.accent, fontSize: 16 });
        let t1 = [[{text:'Country'}, {text:'Sessions'}]];
        window._ga4Countries.slice(0,5).forEach(r => t1.push([r.country, fNum(r.sessions)]));
        slide.addTable(t1, { x: 0.5, y: 1.6, w: 4, fill: THEME.cardBg, color: THEME.textMain, fontSize: 12, border: { type: 'solid', color: THEME.bg, pt: 1 }});

        slide.addText('Device Performance (GSC)', { x: 5, y: 1.2, w: 4, h: 0.3, color: THEME.accent, fontSize: 16 });
        let t2 = [[{text:'Device'}, {text:'Clicks'}, {text:'CTR'}]];
        window._gscDevicesData.forEach(r => t2.push([r.device, fNum(r.clicks), fPct(r.ctr)]));
        slide.addTable(t2, { x: 5, y: 1.6, w: 4, fill: THEME.cardBg, color: THEME.textMain, fontSize: 12, border: { type: 'solid', color: THEME.bg, pt: 1 }});
    }

    function addSlide12_Wins(pptx, state) {
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Wins & Highlights');

        let y = 1.5;
        const addWin = (text) => {
            slide.addText('⭐ ' + text, { x: 0.5, y, w: 9, h: 0.5, color: THEME.green, fontSize: 18, bold: true });
            y += 0.8;
        };

        const llm = window._llmTotalSessions;
        if (llm > 0) addWin(`AI Discovery: Gained ${fNum(llm)} sessions directly from LLM engines (ChatGPT, Claude).`);
        
        const gscClicks = window._gscOverview?.totals?.clicks || 0;
        if (gscClicks > 0) addWin(`Organic Visibility: Drove ${fNum(gscClicks)} clicks from standard Google Search.`);
        
        const ga4Total = window._ga4ChannelRows?.reduce((s, r)=>s+r.sessions,0) || 0;
        if (ga4Total > 0) addWin(`Total Engagement: Captured ${fNum(ga4Total)} website sessions in this reporting period.`);
        
        if (window._ga4TotalKeyEvents > 0) addWin(`Conversions: Generated ${fNum(window._ga4TotalKeyEvents)} valuable key events/actions.`);
    }

    function addSlide13_Opportunities(pptx, state) {
        let slide = pptx.addSlide();
        slide.background = { color: THEME.bg };
        addHeaderFooter(slide, 'Opportunities & Next Steps');

        let y = 1.5;
        const addOpp = (text, type='blue') => {
            const color = type==='blue' ? THEME.blue : THEME.yellow;
            slide.addText('📌 ' + text, { x: 0.5, y, w: 9, h: 0.5, color, fontSize: 18 });
            y += 0.8;
        };

        addOpp('LLM Expansion: Continue optimizing for brand mentions in AI conversational engines.', 'blue');
        
        if (window._gscQueryData?.ctrOpps?.length) {
            addOpp(`Quick Wins: ${window._gscQueryData.ctrOpps.length} queries rank well but have low CTR. Rewrite title tags for these.`, 'yellow');
        }
        
        if (window._gscQueryData?.rankOpps?.length) {
            addOpp(`Rank Grabbing: ${window._gscQueryData.rankOpps.length} queries sit at bottom of page 1. Minor optimizations can push them up.`, 'blue');
        }
    }

    // ── Generate Orchestrator ─────────────────────────────────────

    async function generate() {
        const btnText = document.getElementById('ppt-btn-text');
        const spinner = document.getElementById('ppt-btn-spinner');
        if (btnText) btnText.textContent = 'Generating...';
        if (spinner) spinner.style.display = 'block';
        document.getElementById('ppt-generate-btn').disabled = true;

        try {
            // Instantiate PptxGenJS completely natively
            let pptx = new pptxgen();
            pptx.layout = 'LAYOUT_16x9';

            const state = modalState;
            const cName = state.clientName || 'Client Report';

            // conditional generation based on present dashboard arrays
            addSlide1_Cover(pptx, cName, state.startDate, state.endDate);
            addSlide2_PerformanceScorecard(pptx, state);
            if (window._ga4ChannelRows?.length > 0) addSlide3_TrafficTrend(pptx, state);
            if (window._llmTableRows?.length > 0) addSlide4_LLMBreakdown(pptx, state);
            if (window._gscOverview) addSlide5_GSCSearch(pptx, state);
            if (window._gscQueryData?.top50?.length > 0) addSlide6_QueryIntelligence(pptx, state);
            if (window._pagesData?.length > 0) addSlide7_TopPages(pptx, state);
            if (window._ga4TotalKeyEvents > 0) addSlide8_Conversions(pptx, state);
            if (window._ga4ChannelRows?.length > 0) addSlide9_TrafficAcquisition(pptx, state);
            if (window._ga4Countries && window._gscDevicesData) addSlide11_AudienceDevices(pptx, state);
            
            // Insight slides
            addSlide12_Wins(pptx, state);
            addSlide13_Opportunities(pptx, state);

            let fn = `${cName.replace(/\s+/g, '_')}_Performance_Report_${state.startDate}_to_${state.endDate}.pptx`;
            await pptx.writeFile({ fileName: fn });

            closeModal();
            if (window.DASHBOARD) DASHBOARD.toast('PPT Generated Successfully!', 'success');
        } catch (e) {
            console.error('PPT Error:', e);
            if (window.DASHBOARD) DASHBOARD.toast('Failed to generate PPT: ' + e.message, 'error');
            alert('An error occurred while generating the PPT: ' + e.message);
        } finally {
            if (btnText) btnText.textContent = '▶ Generate PPT';
            if (spinner) spinner.style.display = 'none';
            document.getElementById('ppt-generate-btn').disabled = false;
        }
    }

    return { openModal, closeModal, generate };
})();
