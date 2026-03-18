/**
 * dashboard.js — App Orchestration: state, date ranges, 4-tab routing, refresh, PDF export
 */

const DASHBOARD = (() => {

    // ── State ─────────────────────────────────────────────────────────
    const state = {
        property: null,       // { id, displayName, account }
        gscSiteUrl: null,     // string e.g. "https://example.com/"
        activeTab: 'llm',
        preset: '90d',
        startDate: null,
        endDate: null,
        datePickerInstance: null,
        loading: false,
        ga4Loaded: false,
        gscLoaded: false,
        blendedLoaded: false,
        llmLoaded: false
    };

    // ── Date Helpers ──────────────────────────────────────────────────
    function today() { return new Date().toISOString().slice(0, 10); }
    function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

    function presetToRange(preset) {
        const t = today();
        switch (preset) {
            case '7d': return { sd: daysAgo(7), ed: t };
            case '30d': return { sd: daysAgo(30), ed: t };
            case '90d': return { sd: daysAgo(90), ed: t };
            case '6m': return { sd: daysAgo(180), ed: t };
            case '12m': return { sd: daysAgo(365), ed: t };
            default: return { sd: daysAgo(90), ed: t };
        }
    }

    function applyPreset(preset) {
        state.preset = preset;
        const { sd, ed } = presetToRange(preset);
        state.startDate = sd; state.endDate = ed;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
        if (state.datePickerInstance && preset !== 'custom') state.datePickerInstance.clear();
    }

    // ── Toast ─────────────────────────────────────────────────────────
    function toast(msg, type = 'info', ms = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, ms);
    }

    // ── Loading State ─────────────────────────────────────────────────
    function setLoading(on, label = '') {
        state.loading = on;
        const spinner = document.getElementById('refresh-spinner');
        const timeEl = document.getElementById('refresh-time');
        if (spinner) spinner.style.display = on ? 'block' : 'none';
        if (timeEl) timeEl.textContent = on ? (label || 'Fetching…') : `Updated ${new Date().toLocaleTimeString()}`;
    }

    // ── Screens ───────────────────────────────────────────────────────
    function showPicker() {
        document.getElementById('screen-picker').classList.remove('screen--hidden');
        const dash = document.getElementById('screen-dashboard');
        dash.classList.remove('active'); dash.style.display = 'none';
        updatePickerState('connect');
    }

    function showDashboard() {
        document.getElementById('screen-picker').classList.add('screen--hidden');
        const dash = document.getElementById('screen-dashboard');
        dash.style.display = 'flex';
        setTimeout(() => dash.classList.add('active'), 10);

        if (GA4_API.isMockMode()) document.getElementById('demo-banner').style.display = 'flex';
        if (state.property) document.getElementById('prop-name').textContent = state.property.displayName;
        if (state.gscSiteUrl) {
            const badge = document.getElementById('gsc-badge');
            if (badge) badge.style.display = 'inline-flex';
        }
    }

    function updatePickerState(step) {
        ['connect-step', 'loading-step', 'properties-step'].forEach(id => {
            const el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        const active = document.getElementById(step === 'connect' ? 'connect-step' : step === 'loading' ? 'loading-step' : 'properties-step');
        if (active) active.style.display = 'block';
    }

    // ── Tab Switching ─────────────────────────────────────────────────
    function switchTab(tabId) {
        state.activeTab = tabId;
        window.scrollTo({ top: 0, behavior: 'instant' });

        // Update nav
        document.querySelectorAll('.main-tab-btn').forEach(b => {
            const active = b.dataset.tab === tabId;
            b.classList.toggle('active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        // Show pane
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));

        // Lazy-load tab data on first visit
        const { property, gscSiteUrl, startDate: sd, endDate: ed } = state;
        if (!property) return;

        if (tabId === 'llm' && !state.llmLoaded) { refreshLLMTab(); }
        if (tabId === 'ga4' && !state.ga4Loaded) { refreshGA4Tab(); }
        if (tabId === 'gsc') { refreshGSCTab(true); }
        if (tabId === 'blended' && !state.blendedLoaded) { refreshBlendedTab(); }
    }

    // ── Scroll Spy for Section Nav ────────────────────────────────────
    function initScrollSpy(navId, sectionsId) {
        const nav = document.getElementById(navId);
        if (!nav) return;
        const links = nav.querySelectorAll('.section-nav__item');
        const body = document.getElementById(sectionsId);
        if (!body) return;

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
                }
            });
        }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

        body.querySelectorAll('.section-panel').forEach(el => obs.observe(el));
    }

    // ── LLM Tab ───────────────────────────────────────────────────────
    async function refreshLLMTab() {
        const { property, startDate: sd, endDate: ed } = state;
        if (!property) return;
        setLoading(true, 'Loading LLM data…');
        try {
            const [kpiData, dailyLLM, dailyAll, sourceData, llmDetail, wowData, momData, landingPages, engQuality] =
                await Promise.all([
                    GA4_API.fetchKPIs(property.id, sd, ed),
                    GA4_API.fetchDailyLLMSessions(property.id, sd, ed),
                    GA4_API.fetchDailyAllSessions(property.id, sd, ed),
                    GA4_API.fetchSourceBreakdown(property.id, sd, ed),
                    GA4_API.fetchLLMSourceDetail(property.id, sd, ed),
                    GA4_API.fetchWoW(property.id, sd, ed),
                    GA4_API.fetchMoMBySource(property.id),
                    GA4_API.fetchTopLandingPages(property.id, sd, ed),
                    GA4_API.fetchEngagementQuality(property.id, sd, ed)
                ]);

            CHARTS.updateKPICards(kpiData);
            const sparkData = dailyLLM.map(r => r.sessions);
            if (sparkData.length) {
                CHARTS.renderSparkline('sparkline-sessions', sparkData, '#a78bfa');
                CHARTS.renderSparkline('sparkline-pct', sparkData.map((v, i) => { const a = dailyAll[i]?.sessions || 1; return (v / a) * 100; }), '#6ee7b7');
                CHARTS.renderSparkline('sparkline-bounce', sparkData.map(() => 35 + Math.random() * 15), '#fca5a5');
                CHARTS.renderSparkline('sparkline-users', dailyLLM.map(r => r.totalUsers || 0), '#93c5fd');
                CHARTS.renderSparkline('sparkline-eng', sparkData.map(() => 55 + Math.random() * 20), '#fcd34d');
            }
            CHARTS.renderBounceTrend('chart-bounce-trend', dailyLLM);
            CHARTS.renderDailyLLMArea('chart-daily-llm', dailyLLM, dailyAll);
            CHARTS.renderTrafficDonut('chart-traffic-donut', 'donut-center-traffic', 'donut-legend-traffic', sourceData);
            CHARTS.renderLLMSourceBars('llm-source-bars', llmDetail);
            CHARTS.renderWoW('chart-wow', wowData);
            CHARTS.renderMoMBySource('chart-mom', momData);
            CHARTS.renderSourceTable('source-table-body', sourceData, kpiData.llmSessions);
            CHARTS.renderLLMvsOrganicDonut('chart-llm-vs-organic', 'donut-center-llm', 'donut-legend-llm', llmDetail, sourceData);
            CHARTS.renderLandingPagesTable('landing-pages-body', landingPages);
            CHARTS.renderEngagementQuality('eq-grid-container', engQuality);
            state.llmLoaded = true;
        } catch (err) {
            console.error('[DASHBOARD] LLM tab error:', err);
            if (err.message === 'TOKEN_EXPIRED') { toast('Session expired. Please reconnect.', 'error'); setTimeout(showPicker, 1500); }
            else toast('Error loading LLM data: ' + err.message, 'error');
        } finally { setLoading(false); }
    }

    // ── GA4 Tab ───────────────────────────────────────────────────────
    function refreshGA4Tab() {
        const { property, startDate: sd, endDate: ed } = state;
        if (!property) return;
        state.ga4Loaded = true;
        GA4_TAB.loadAll(property.id, sd, ed);
        // Init scroll spy after a moment
        setTimeout(() => initScrollSpy('ga4-section-nav', 'ga4-sections'), 200);
    }

    // ── GSC Tab ───────────────────────────────────────────────────────
    function refreshGSCTab(firstLoad = false) {
        const { gscSiteUrl, startDate: sd, endDate: ed } = state;

        // Show/hide no-URL banner
        const banner = document.getElementById('gsc-no-url-banner');
        const sections = ['gsc-s5', 'gsc-s6', 'gsc-s7', 'gsc-s8'];

        if (!gscSiteUrl) {
            if (banner) banner.style.display = 'block';
            sections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            return;
        }

        if (banner) banner.style.display = 'none';
        sections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });

        if (!state.gscLoaded || !firstLoad) {
            state.gscLoaded = true;
            GSC_TAB.loadAll(gscSiteUrl, sd, ed);
            setTimeout(() => initScrollSpy('gsc-section-nav', 'gsc-sections'), 200);
        }
    }

    // ── Blended Tab ───────────────────────────────────────────────────
    function refreshBlendedTab() {
        const { property, gscSiteUrl, startDate: sd, endDate: ed } = state;
        if (!property) return;
        state.blendedLoaded = true;
        if (!gscSiteUrl) {
            const el = document.getElementById('blended-body');
            if (el) el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔗</div><div class="empty-state__title">GSC not connected</div><div class="empty-state__msg">Add your GSC site URL in the property picker to enable blended insights.</div></div>`;
            return;
        }
        // Store ga4TotalKeyEvents for blended CR calculation
        BLENDED_TAB.loadAll(property.id, gscSiteUrl, sd, ed);
    }

    // ── Global Refresh ────────────────────────────────────────────────
    function refreshActive() {
        state.llmLoaded = false; state.ga4Loaded = false; state.gscLoaded = false; state.blendedLoaded = false;
        const tab = state.activeTab;
        if (tab === 'llm') refreshLLMTab();
        else if (tab === 'ga4') refreshGA4Tab();
        else if (tab === 'gsc') refreshGSCTab(false);
        else if (tab === 'blended') refreshBlendedTab();
    }

    // ── Property Selection ────────────────────────────────────────────
    function selectProperty(prop) {
        state.property = prop;
        sessionStorage.setItem('llm_dash_property', JSON.stringify(prop));
        showDashboard();
        applyPreset(state.preset);
        // Load active tab
        state.activeTab = 'llm'; // always start at LLM
        switchTab('llm');
    }

    // ── PDF/PPT Export ────────────────────────────────────────────────
    function exportPDF() {
        if (window.PPT_EXPORT) {
            PPT_EXPORT.generateReport(state);
        } else {
            toast('Preparing PDF…', 'info', 2000);
            setTimeout(() => window.print(), 300);
        }
    }

    // ── Date Picker ───────────────────────────────────────────────────
    function initDatePicker() {
        const input = document.getElementById('custom-date-input');
        if (!input || !window.flatpickr) return;
        state.datePickerInstance = flatpickr(input, {
            mode: 'range', dateFormat: 'Y-m-d',
            altInput: true, altFormat: 'M j, Y',
            maxDate: 'today', disableMobile: false,
            placeholder: 'Custom range…',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                    state.preset = 'custom';
                    state.startDate = selectedDates[0].toISOString().slice(0, 10);
                    state.endDate = selectedDates[1].toISOString().slice(0, 10);
                    state.llmLoaded = false; state.ga4Loaded = false; state.gscLoaded = false; state.blendedLoaded = false;
                    refreshActive();
                }
            }
        });
    }

    // ── Event Wiring ──────────────────────────────────────────────────
    function wireEvents() {
        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                applyPreset(btn.dataset.preset);
                state.llmLoaded = false; state.ga4Loaded = false; state.gscLoaded = false; state.blendedLoaded = false;
                refreshActive();
            });
        });

        // Tab nav
        document.querySelectorAll('.main-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => { refreshActive(); });

        // PDF button
        document.getElementById('pdf-btn')?.addEventListener('click', exportPDF);

        // Switch Property
        document.getElementById('switch-property-btn')?.addEventListener('click', showPicker);

        // Picker connect
        document.getElementById('picker-connect-btn')?.addEventListener('click', () => {
            const clientId = document.getElementById('client-id-input')?.value?.trim();
            const gscUrl = document.getElementById('gsc-url-input')?.value?.trim();
            if (gscUrl) { state.gscSiteUrl = gscUrl; sessionStorage.setItem('llm_dash_gsc_url', gscUrl); }
            if (clientId && !clientId.includes('YOUR_CLIENT_ID')) {
                GA4_API.init(clientId); sessionStorage.setItem('llm_dash_client_id', clientId);
            }
            updatePickerState('loading');
            GA4_API.initTokenClient((token, err) => {
                if (err === 'mock' || (!err && GA4_API.isMockMode())) { handleTokenSuccess(); return; }
                if (err === 'need-sign-in' || !token) {
                    GA4_API.signIn((token2, err2) => {
                        if (err2) { updatePickerState('connect'); toast('Sign-in failed: ' + err2, 'error'); return; }
                        handleTokenSuccess();
                    });
                } else { handleTokenSuccess(); }
            });
        });

        // Demo button
        document.getElementById('demo-btn')?.addEventListener('click', () => {
            const gscUrl = document.getElementById('gsc-url-input')?.value?.trim();
            if (gscUrl) { state.gscSiteUrl = gscUrl; sessionStorage.setItem('llm_dash_gsc_url', gscUrl); }
            else { state.gscSiteUrl = 'https://example.com/'; } // Use a sensible demo default
            GA4_API.init('');
            handleTokenSuccess();
        });

        // Section nav links (smooth scroll + spy)
        document.querySelectorAll('.section-nav__item').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(a.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        // Picker back
        document.getElementById('picker-back-btn')?.addEventListener('click', () => updatePickerState('connect'));
    }

    function handleTokenSuccess() {
        GA4_API.listProperties()
            .then(props => {
                if (!props.length) { toast('No GA4 properties found for this account.', 'error'); updatePickerState('connect'); return; }
                if (props.length === 1) { selectProperty(props[0]); return; }
                updatePickerState('properties');
                const listEl = document.getElementById('property-list-items');
                if (listEl) {
                    listEl.innerHTML = props.map(p => `
            <div class="property-item" data-id="${p.id}" data-name="${p.displayName}" data-acc="${p.account}">
              <div>
                <div class="property-item__name">${p.displayName}</div>
                <div class="property-item__acc">${p.account}</div>
              </div>
              <div class="property-item__id">ID: ${p.id}</div>
            </div>`).join('');
                    listEl.querySelectorAll('.property-item').forEach(item => {
                        item.addEventListener('click', () => {
                            selectProperty({ id: item.dataset.id, displayName: item.dataset.name, account: item.dataset.acc });
                        });
                    });
                }
            })
            .catch(err => { toast('Failed to list properties: ' + err.message, 'error'); updatePickerState('connect'); });
    }

    // ── Boot ──────────────────────────────────────────────────────────
    function boot() {
        CHARTS.applyGlobalDefaults();
        wireEvents();
        initDatePicker();

        // Restore saved client ID + GSC URL
        const savedId = sessionStorage.getItem('llm_dash_client_id');
        const savedGSC = sessionStorage.getItem('llm_dash_gsc_url');
        const savedProp = sessionStorage.getItem('llm_dash_property');
        const savedToken = sessionStorage.getItem('llm_dash_token');

        const inputEl = document.getElementById('client-id-input');
        if (savedId && inputEl) inputEl.value = savedId;

        const gscInput = document.getElementById('gsc-url-input');
        if (savedGSC && gscInput) { gscInput.value = savedGSC; state.gscSiteUrl = savedGSC; }

        if (savedId) GA4_API.init(savedId);
        else if (window.LLM_DASH_CONFIG?.clientId) GA4_API.init(window.LLM_DASH_CONFIG.clientId);

        if (savedProp && (savedToken || GA4_API.isMockMode())) {
            selectProperty(JSON.parse(savedProp));
        } else {
            showPicker();
        }
    }

    function getState() { return state; }

    return { boot, refreshActive, applyPreset, toast, showPicker, switchTab, getState };

})();

// ── Boot on load ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => DASHBOARD.boot());
