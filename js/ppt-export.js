/**
 * ppt-export.js — Generates visually engaging PPT reports natively in the browser
 */

window.PPT_EXPORT = (() => {

    function getElText(id, selector) {
        const el = document.getElementById(id);
        if (!el) return '';
        const child = selector ? el.querySelector(selector) : el;
        return child ? child.innerText.trim() : '';
    }

    // Helper to parse trend indicators like "↑ 15%"
    function parseTrend(text) {
        if (!text || text === '—') return { isUp: false, isDown: false, text: '' };
        const isUp = text.includes('↑');
        const isDown = text.includes('↓');
        return { isUp, isDown, text };
    }

    async function generateReport(state) {
        if (typeof pptxgen === 'undefined') {
            DASHBOARD.toast('Error: PptxGenJS library is missing.', 'error');
            return;
        }

        DASHBOARD.toast('Generating PowerPoint format...', 'info', 3000);
        let pptx = new pptxgen();
        pptx.layout = 'LAYOUT_16x9';
        pptx.author = 'LLM Traffic Dashboard';
        pptx.title = 'Traffic & Performance Report';

        const theme = {
            bg: "121212",
            panelBg: "1E1E1E",
            textMain: "FFFFFF",
            textMuted: "A0A0A0",
            accent: "7C3AED", // Purple
            green: "10B981",
            red: "EF4444",
            blue: "3B82F6"
        };
        
        const propName = document.getElementById('prop-name')?.innerText || 'Unknown Property';
        let dateRangeText = document.querySelector('.custom-date-input')?.value;
        if (!dateRangeText) dateRangeText = document.querySelector('.preset-btn.active')?.innerText || 'Custom Range';
        
        // Exract KPIs from DOM
        const sessionsText = getElText('kpi-llm-sessions', '.kpi-card__value');
        const sessionsTrend = parseTrend(getElText('kpi-llm-sessions', '.kpi-card__trend'));
        
        const pctText = getElText('kpi-pct-traffic', '.kpi-card__value');
        const pctTrend = parseTrend(getElText('kpi-pct-traffic', '.kpi-card__trend'));

        const usersText = getElText('kpi-llm-users', '.kpi-card__value');
        const usersTrend = parseTrend(getElText('kpi-llm-users', '.kpi-card__trend'));

        // ==========================================
        // Slide 1: Title Slide
        // ==========================================
        let s1 = pptx.addSlide();
        s1.background = { color: theme.bg };
        s1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.15, fill: { color: theme.accent } });
        
        s1.addText("Traffic & Performance Report", {
            x: 1, y: 2, w: 8, h: 1.2,
            fontSize: 48, color: theme.textMain, bold: true,
            fontFace: "Arial"
        });
        s1.addText(`Property: ${propName}`, {
            x: 1, y: 3.2, w: 8, h: 0.5,
            fontSize: 24, color: theme.blue, bold: true,
            fontFace: "Arial"
        });
        s1.addText(`Date Range: ${dateRangeText}`, {
            x: 1, y: 3.8, w: 8, h: 0.5,
            fontSize: 18, color: theme.textMuted,
            fontFace: "Arial"
        });

        // ==========================================
        // Slide 2: Executive Summary
        // ==========================================
        let s2 = pptx.addSlide();
        s2.background = { color: theme.bg };
        s2.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: theme.panelBg } });
        s2.addText("Executive Summary: Improvements", { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 24, color: theme.textMain, bold: true });
        
        s2.addText(`During ${dateRangeText}, the site demonstrated significant changes in AI-driven traffic. Below are the key performance metrics showcasing growth and opportunities.`, {
            x: 0.5, y: 1.2, w: 9, h: 0.5, fontSize: 16, color: theme.textMuted
        });

        function renderKpi(slideObj, x, y, title, value, trendObj) {
            slideObj.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
                x, y, w: 2.8, h: 1.5, fill: { color: theme.panelBg }, rectRadius: 0.1
            });
            slideObj.addText(title, { x: x+0.2, y: y+0.2, w: 2.4, h: 0.3, fontSize: 14, color: theme.textMuted });
            slideObj.addText(value, { x: x+0.2, y: y+0.5, w: 2.4, h: 0.5, fontSize: 36, color: theme.textMain, bold: true });
            
            if (trendObj.text) {
                const trColor = trendObj.isUp ? theme.green : (trendObj.isDown ? theme.red : theme.textMuted);
                slideObj.addText(trendObj.text, { x: x+0.2, y: y+1.1, w: 2.4, h: 0.3, fontSize: 12, color: trColor, bold: true });
            }
        }

        renderKpi(s2, 0.5, 2.0, "Total LLM Sessions", sessionsText, sessionsTrend);
        renderKpi(s2, 3.6, 2.0, "Share of Traffic", pctText, pctTrend);
        renderKpi(s2, 6.7, 2.0, "Unique LLM Users", usersText, usersTrend);

        // Storytelling Insights
        const isGrowing = (sessionsTrend.isUp || pctTrend.isUp);
        const storyText = isGrowing 
            ? "Excellent performance! We are seeing an upward trend in AI search visibility. The growth in LLM sessions indicates that generative AI platforms (like ChatGPT and Claude) are increasingly referring users directly to our content."
            : "Traffic patterns have shifted in this period. We recommend reviewing content optimization strategies to ensure brand visibility across emerging LLM platforms.";
            
        s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: 0.5, y: 4.0, w: 9, h: 1.2, fill: { color: "27272A" }, rectRadius: 0.1
        });
        s2.addText("💡 What this means for you:", { x: 0.7, y: 4.2, w: 8.6, h: 0.3, fontSize: 14, color: theme.accent, bold: true });
        s2.addText(storyText, { x: 0.7, y: 4.6, w: 8.6, h: 0.5, fontSize: 14, color: theme.textMain });

        // ==========================================
        // Slide 3: Channel Breakdown Table
        // ==========================================
        let s3 = pptx.addSlide();
        s3.background = { color: theme.bg };
        s3.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: theme.panelBg } });
        s3.addText("Traffic Source Breakdown", { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 24, color: theme.textMain, bold: true });

        const rows = document.querySelectorAll('#source-table-body tr');
        let tableData = [
            [
                { text: "Channel", options: { bold: true, color: theme.textMain, fill: { color: theme.accent } } },
                { text: "Sessions", options: { bold: true, color: theme.textMain, fill: { color: theme.accent } } },
                { text: "Engagement", options: { bold: true, color: theme.textMain, fill: { color: theme.accent } } },
                { text: "Bounce", options: { bold: true, color: theme.textMain, fill: { color: theme.accent } } }
            ]
        ];

        let rowCount = 0;
        rows.forEach(tr => {
            if (rowCount >= 8) return;
            const cells = tr.querySelectorAll('td');
            if (cells.length >= 4) {
                const clone = cells[0].cloneNode(true);
                const badge = clone.querySelector('.source-badge');
                if (badge) badge.remove();
                
                tableData.push([
                    { text: clone.innerText.trim(), options: { color: theme.textMain, fill: { color: theme.panelBg } } },
                    { text: cells[1].innerText.trim(), options: { color: theme.textMain, fill: { color: theme.panelBg } } },
                    { text: cells[2].innerText.trim(), options: { color: theme.textMain, fill: { color: theme.panelBg } } },
                    { text: cells[3].innerText.trim(), options: { color: theme.textMain, fill: { color: theme.panelBg } } }
                ]);
                rowCount++;
            }
        });

        if (tableData.length > 1) {
            s3.addTable(tableData, {
                x: 0.5, y: 1.2, w: 9, 
                colW: [3.5, 1.8, 1.8, 1.9],
                border: { pt: 1, color: "333333" },
                fontSize: 12, align: "left", valign: "middle"
            });
        } else {
            s3.addText("No channel data available for the selected period.", { x: 0.5, y: 2, w: 8, h: 0.5, fontSize: 16, color: theme.textMuted });
        }
        
        // ==========================================
        // Slide 4: GA4 Top Landing Pages
        // ==========================================
        let s4 = pptx.addSlide();
        s4.background = { color: theme.bg };
        s4.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: theme.panelBg } });
        s4.addText("Top LLM Landing Pages", { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 24, color: theme.textMain, bold: true });
        
        s4.addText("These are the key landing pages receiving the most direct referrals from AI tools.", {
            x: 0.5, y: 1.0, w: 9, h: 0.3, fontSize: 14, color: theme.textMuted
        });

        const lpRows = document.querySelectorAll('#landing-pages-body tr');
        let lpData = [
            [
                { text: "Page Path", options: { bold: true, color: "121212", fill: { color: theme.green } } },
                { text: "Sessions", options: { bold: true, color: "121212", fill: { color: theme.green } } },
                { text: "Eng. Rate", options: { bold: true, color: "121212", fill: { color: theme.green } } }
            ]
        ];

        rowCount = 0;
        lpRows.forEach(tr => {
            if (rowCount >= 8) return;
            const cells = tr.querySelectorAll('td');
            if (cells.length >= 4) {
                lpData.push([
                    { text: cells[0].innerText.trim(), options: { color: theme.textMain, fill: { color: theme.panelBg } } },
                    { text: cells[1].innerText.trim(), options: { color: theme.textMain, fill: { color: theme.panelBg } } },
                    { text: cells[3].innerText.trim(), options: { color: theme.textMain, fill: { color: theme.panelBg } } }
                ]);
                rowCount++;
            }
        });

        if (lpData.length > 1) {
            s4.addTable(lpData, {
                x: 0.5, y: 1.5, w: 9, 
                colW: [5.5, 1.7, 1.8],
                border: { pt: 1, color: "333333" },
                fontSize: 12, align: "left", valign: "middle"
            });
        } else {
            s4.addText("No landing page data available.", { x: 0.5, y: 2, w: 8, h: 0.5, fontSize: 16, color: theme.textMuted });
        }

        // Save file
        const safePropName = propName.replace(/[^a-z0-9]/gi, '_');
        const filename = `Analytics_Report_${safePropName}_${state.preset}.pptx`;
        
        pptx.writeFile({ fileName: filename })
            .then(() => DASHBOARD.toast('PPT Report downloaded successfully!', 'success'))
            .catch(err => {
                console.error(err);
                DASHBOARD.toast('Failed to generate PPT.', 'error');
            });
    }

    return { generateReport };
})();
