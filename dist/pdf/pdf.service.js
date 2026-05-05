"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfService = void 0;
const common_1 = require("@nestjs/common");
const puppeteer = require("puppeteer");
const supabase_js_1 = require("@supabase/supabase-js");
let PdfService = PdfService_1 = class PdfService {
    constructor() {
        this.logger = new common_1.Logger(PdfService_1.name);
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    }
    async generate(campaign) {
        this.logger.log(`Gerando PDF para campanha: ${campaign.name}`);
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        try {
            const page = await browser.newPage();
            const html = this.buildHtml(campaign);
            await page.setContent(html, { waitUntil: 'networkidle0' });
            await page.evaluateHandle('document.fonts.ready');
            const pdfBuffer = await page.pdf({
                format: 'A4',
                landscape: true,
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
            });
            const filename = `reports/${campaign.id}/${Date.now()}.pdf`;
            const { error } = await this.supabase.storage
                .from('reports')
                .upload(filename, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
            });
            if (error)
                throw new Error('Erro ao salvar PDF: ' + error.message);
            const { data } = this.supabase.storage
                .from('reports')
                .getPublicUrl(filename);
            this.logger.log(`PDF gerado: ${data.publicUrl}`);
            return data.publicUrl;
        }
        finally {
            await browser.close();
        }
    }
    formatDate(d) {
        return new Date(d).toLocaleDateString('pt-BR');
    }
    formatNum(n) {
        if (!n || n === 0)
            return '—';
        return n.toLocaleString('pt-BR');
    }
    formatCtr(views, clicks) {
        if (!views || views === 0)
            return '—';
        return ((clicks / views) * 100).toFixed(2) + '%';
    }
    groupPrintsByDate(prints) {
        const grouped = {};
        prints.forEach((p) => {
            const key = new Date(p.date).toISOString().split('T')[0];
            if (!grouped[key])
                grouped[key] = { MOBILE: [], DESKTOP: [] };
            grouped[key][p.format].push(p.url);
        });
        return grouped;
    }
    buildChartDataScript(metrics) {
        const labels = metrics.map((m) => this.formatDate(m.date));
        const views = metrics.map((m) => m.views || 0);
        const clicks = metrics.map((m) => m.clicks || 0);
        return `
      const ctx = document.getElementById('perf-chart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [
            {
              label: 'Visualizações',
              data: ${JSON.stringify(views)},
              backgroundColor: 'rgba(55, 138, 221, 0.85)',
              borderRadius: 4,
              yAxisID: 'y'
            },
            {
              label: 'Cliques',
              data: ${JSON.stringify(clicks)},
              backgroundColor: 'rgba(29, 158, 117, 0.85)',
              borderRadius: 4,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 12 } }
          },
          scales: {
            y: { type: 'linear', position: 'left', ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
            y1: { type: 'linear', position: 'right', ticks: { font: { size: 9 } }, grid: { drawOnChartArea: false } },
            x: { ticks: { font: { size: 9 }, maxRotation: 45 }, grid: { display: false } }
          }
        }
      });
    `;
    }
    buildHeader(campaign) {
        const companyLogo = campaign.companyLogoBase64
            ? `<img src="${campaign.companyLogoBase64}" class="header-logo company-logo" alt="Logo empresa" />`
            : `<span class="header-brand-text">ReportAds</span>`;
        const clientLogo = campaign.clientLogoBase64
            ? `<img src="${campaign.clientLogoBase64}" class="header-logo client-logo" alt="Logo cliente" />`
            : `<span class="header-client-name">${campaign.client}</span>`;
        return `
      <div class="page-header">
        <div class="header-left">${companyLogo}</div>
        <div class="header-center">
          <span class="header-campaign">${campaign.name}</span>
        </div>
        <div class="header-right">${clientLogo}</div>
      </div>
    `;
    }
    buildDayPages(metrics, printsByDate, campaign) {
        return metrics.map((m) => {
            const key = new Date(m.date).toISOString().split('T')[0];
            const prints = printsByDate[key] || { MOBILE: [], DESKTOP: [] };
            const mobileHtml = prints.MOBILE.length
                ? prints.MOBILE.map((url) => `<img src="${url}" class="print-img" alt="Print mobile" />`).join('')
                : '<p class="no-prints">Nenhum print mobile</p>';
            const desktopHtml = prints.DESKTOP.length
                ? prints.DESKTOP.map((url) => `<img src="${url}" class="print-img" alt="Print desktop" />`).join('')
                : '<p class="no-prints">Nenhum print desktop</p>';
            return `
        <div class="day-page">
          ${this.buildHeader(campaign)}

          <div class="day-body">
            <div class="day-info">
              <div class="day-date">${this.formatDate(m.date)}</div>
              <div class="day-metrics-row">
                <div class="day-metric">
                  <span class="day-metric-label">Visualizações</span>
                  <span class="day-metric-value">${this.formatNum(m.views)}</span>
                </div>
                <div class="day-metric">
                  <span class="day-metric-label">Cliques</span>
                  <span class="day-metric-value">${this.formatNum(m.clicks)}</span>
                </div>
                <div class="day-metric">
                  <span class="day-metric-label">CTR</span>
                  <span class="day-metric-value">${this.formatCtr(m.views, m.clicks)}</span>
                </div>
              </div>
            </div>

            <div class="prints-section">
              <div class="prints-col">
                <div class="prints-col-label">
                  <span class="format-badge mobile">📱 Mobile</span>
                </div>
                <div class="prints-grid">${mobileHtml}</div>
              </div>
              <div class="prints-col">
                <div class="prints-col-label">
                  <span class="format-badge desktop">🖥️ Desktop</span>
                </div>
                <div class="prints-grid">${desktopHtml}</div>
              </div>
            </div>
          </div>
        </div>
      `;
        }).join('');
    }
    buildHtml(campaign) {
        const printsByDate = this.groupPrintsByDate(campaign.prints);
        const dayPages = this.buildDayPages(campaign.metrics, printsByDate, campaign);
        const chartScript = this.buildChartDataScript(campaign.metrics);
        const companyLogoHtml = campaign.companyLogoBase64
            ? `<img src="${campaign.companyLogoBase64}" class="cover-logo company" alt="Logo empresa" />`
            : `<div class="cover-brand-text">ReportAds</div>`;
        const clientLogoHtml = campaign.clientLogoBase64
            ? `<img src="${campaign.clientLogoBase64}" class="cover-logo client" alt="Logo cliente" />`
            : '';
        const metricsTableRows = campaign.metrics.map((m) => `
      <tr>
        <td>${this.formatDate(m.date)}</td>
        <td>${this.formatNum(m.views)}</td>
        <td>${this.formatNum(m.clicks)}</td>
        <td>${this.formatCtr(m.views, m.clicks)}</td>
      </tr>
    `).join('');
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; }

  /* A4 landscape = 297mm x 210mm */
  .cover, .day-page {
    width: 297mm;
    min-height: 210mm;
    page-break-after: always;
    overflow: hidden;
  }

  /* ---- HEADER (todas as páginas exceto capa) ---- */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 32px;
    border-bottom: 2px solid #185FA5;
    background: #fff;
  }
  .header-left, .header-right {
    width: 120px;
    display: flex;
    align-items: center;
  }
  .header-right { justify-content: flex-end; }
  .header-logo { max-height: 36px; max-width: 110px; object-fit: contain; }
  .header-brand-text { font-size: 13px; font-weight: 700; color: #185FA5; letter-spacing: 0.05em; }
  .header-client-name { font-size: 12px; font-weight: 600; color: #444; }
  .header-center { flex: 1; text-align: center; }
  .header-campaign { font-size: 12px; font-weight: 600; color: #333; }

  /* ---- CAPA ---- */
  .cover {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 210mm;
  }
  .cover-left {
    background: #185FA5;
    color: #fff;
    padding: 40px 40px 32px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .cover-logos {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
  }
  .cover-logo { max-height: 48px; max-width: 130px; object-fit: contain; }
  .cover-logo.company { filter: brightness(0) invert(1); }
  .cover-brand-text { font-size: 18px; font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.9); }
  .cover-logo-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.3); }
  .cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.65);
    margin-bottom: 8px;
  }
  .cover-title { font-size: 26px; font-weight: 700; line-height: 1.25; margin-bottom: 16px; }
  .cover-dates { font-size: 13px; color: rgba(255,255,255,0.75); }
  .cover-footer-meta { display: flex; flex-direction: column; gap: 4px; }
  .cover-meta-row { font-size: 11px; color: rgba(255,255,255,0.7); }
  .cover-meta-row strong { color: #fff; }

  .cover-right {
    padding: 32px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .kpi-card {
    background: #F4F8FE;
    border-radius: 8px;
    padding: 16px;
    border-left: 3px solid #185FA5;
  }
  .kpi-label { font-size: 9px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .kpi-value { font-size: 22px; font-weight: 700; color: #185FA5; }

  .chart-box { flex: 1; min-height: 0; }
  .chart-title { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }

  .metrics-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .metrics-table th {
    background: #F4F8FE;
    padding: 6px 10px;
    text-align: left;
    font-size: 9px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e5e7eb;
  }
  .metrics-table td {
    padding: 6px 10px;
    border-bottom: 1px solid #f3f4f6;
    color: #333;
  }
  .metrics-table tr:last-child td { border-bottom: none; }

  /* ---- PÁGINA DE DIA ---- */
  .day-body {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 0;
    height: calc(210mm - 58px);
  }
  .day-info {
    background: #F4F8FE;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-right: 1px solid #e5e7eb;
  }
  .day-date { font-size: 20px; font-weight: 700; color: #0a0a0a; }
  .day-metrics-row { display: flex; flex-direction: column; gap: 12px; }
  .day-metric {}
  .day-metric-label { display: block; font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
  .day-metric-value { font-size: 18px; font-weight: 700; color: #185FA5; }

  .prints-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    overflow: hidden;
  }
  .prints-col {
    padding: 16px 20px;
    overflow-y: auto;
    border-right: 1px solid #f3f4f6;
  }
  .prints-col:last-child { border-right: none; }
  .prints-col-label { margin-bottom: 10px; }
  .format-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .format-badge.mobile { background: #E1F5EE; color: #0F6E56; }
  .format-badge.desktop { background: #E6F1FB; color: #185FA5; }
  .prints-grid { display: flex; flex-direction: column; gap: 10px; }
  .print-img { width: 100%; border-radius: 6px; border: 1px solid #e5e7eb; object-fit: contain; max-height: 280px; }
  .no-prints { font-size: 11px; color: #bbb; font-style: italic; padding: 20px 0; text-align: center; border: 1px dashed #e5e7eb; border-radius: 6px; }

  @media print {
    .cover, .day-page { page-break-after: always; }
  }
</style>
</head>
<body>

<!-- CAPA -->
<div class="cover">
  <div class="cover-left">
    <div class="cover-logos">
      ${companyLogoHtml}
      ${clientLogoHtml ? `<div class="cover-logo-divider"></div>${clientLogoHtml}` : ''}
    </div>
    <div class="cover-main">
      <div class="cover-label">Relatório de Campanha</div>
      <div class="cover-title">${campaign.name}</div>
      <div class="cover-dates">${this.formatDate(campaign.startDate)} — ${this.formatDate(campaign.endDate)}</div>
    </div>
    <div class="cover-footer-meta">
      <div class="cover-meta-row"><strong>Cliente:</strong> ${campaign.client}</div>
      ${campaign.agency ? `<div class="cover-meta-row"><strong>Agência:</strong> ${campaign.agency}</div>` : ''}
      <div class="cover-meta-row"><strong>PI:</strong> ${campaign.pi || '—'}</div>
      <div class="cover-meta-row"><strong>Praça:</strong> ${campaign.city}</div>
    </div>
  </div>

  <div class="cover-right">
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Total de Visualizações</div>
        <div class="kpi-value">${this.formatNum(campaign.totals.views)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total de Cliques</div>
        <div class="kpi-value">${this.formatNum(campaign.totals.clicks)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">CTR Médio</div>
        <div class="kpi-value">${this.formatCtr(campaign.totals.views, campaign.totals.clicks)}</div>
      </div>
    </div>

    <div>
      <div class="chart-title">Desempenho diário</div>
      <div style="height: 140px; position: relative;">
        <canvas id="perf-chart"></canvas>
      </div>
    </div>

    <div>
      <div class="chart-title">Resumo por dia</div>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Visualizações</th>
            <th>Cliques</th>
            <th>CTR</th>
          </tr>
        </thead>
        <tbody>
          ${metricsTableRows}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- PÁGINAS POR DIA -->
${dayPages}

<script>
  window.addEventListener('load', function() {
    ${chartScript}
  });
</script>
</body>
</html>`;
    }
};
exports.PdfService = PdfService;
exports.PdfService = PdfService = PdfService_1 = __decorate([
    (0, common_1.Injectable)()
], PdfService);
//# sourceMappingURL=pdf.service.js.map