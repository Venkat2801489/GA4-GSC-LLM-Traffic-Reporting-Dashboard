function exportAllDashboardData() {
  let csv = "data:text/csv;charset=utf-8,";
  
  // Tab mapping
  const sections = [
    { id: '1', name: 'LLM Traffic' },
    { id: '2', name: 'LLM Source Breakdown' },
    { id: '3', name: 'LLM Conversions & Quality' },
    { id: 'gsc-s6-body', name: 'Google Search Console - Queries' },
    { id: 'gsc-s7-body', name: 'Google Search Console - Pages' },
    { id: 'gsc-s8-body', name: 'Google Search Console - Devices & Countries' },
    { id: 'ga4-s9-body', name: 'GA4 Traffic Acquisition' },
    { id: 'ga4-s10-body', name: 'GA4 Top Pages' },
    { id: 'ga4-s11-body', name: 'GA4 Conversions' },
    { id: 'ga4-s12-body', name: 'GA4 Audience' },
    { id: 'blended-s13-body', name: 'Blended Insights' }
  ];

  document.querySelectorAll('.tab-pane').forEach(tab => {
    const tabTitle = tab.querySelector('.main-tab-nav button.active')?.innerText || tab.id;
    csv += `\n"=== ${tabTitle.toUpperCase()} ==="\n\n`;

    tab.querySelectorAll('.data-table').forEach(table => {
       // Exclude specific tables requested by user
       const skipIds = ['ga4-country-table', 'ga4-browser-table', 'gsc-device-table', 'gsc-country-table'];
       if (skipIds.includes(table.id)) return;

       // try to find title
       let title = 'Table Data';
       let p = table.previousElementSibling;
       while (p && !p.classList.contains('panel__title') && !p.innerText.includes('Export')) {
           p = p.previousElementSibling;
       }
       if (!p) p = table.parentElement.previousElementSibling;
       if (p) {
           const tElem = p.querySelector('.panel__title') || p;
           title = tElem.innerText.replace(/⬇ CSV/g, '').trim();
       }
       csv += `"${title}"\n`;

       // Headers
       const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
       csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + "\n";

       // Rows
       table.querySelectorAll('tbody tr').forEach(row => {
           // Skip hidden rows
           if (row.style.display === 'none') return;
           const cols = Array.from(row.querySelectorAll('td')).map(td => {
               // Get inner text, remove the tooltip/titles if any, just raw text.
               let txt = td.innerText.trim();
               // special case: if it has a trend arrow, maybe include it. 
               return `"${txt.replace(/"/g, '""')}"`;
           });
           csv += cols.join(',') + "\n";
       });
       csv += "\n";
    });
  });

  // Remove the initial data URI prefix first if it's there
  const csvContent = csv.startsWith("data:text/csv;charset=utf-8,") ? csv.slice(28) : csv;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `dashboard-full-export-${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
