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
        return n.toLocaleString('pt-BR');
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
        const views = metrics.map((m) => m.views);
        const clicks = metrics.map((m) => m.clicks);
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
              backgroundColor: 'rgba(55, 138, 221, 0.8)',
              borderRadius: 4,
              yAxisID: 'y'
            },
            {
              label: 'Cliques',
              data: ${JSON.stringify(clicks)},
              backgroundColor: 'rgba(29, 158, 117, 0.8)',
              borderRadius: 4,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 16 } }
          },
          scales: {
            y: {
              type: 'linear',
              position: 'left',
              ticks: { font: { size: 10 } },
              grid: { color: 'rgba(0,0,0,0.06)' }
            },
            y1: {
              type: 'linear',
              position: 'right',
              ticks: { font: { size: 10 } },
              grid: { drawOnChartArea: false }
            },
            x: {
              ticks: { font: { size: 10 }, maxRotation: 45 },
              grid: { display: false }
            }
          }
        }
      });
    `;
    }
    buildDayPages(metrics, printsByDate) {
        return metrics
            .map((m) => {
            const key = new Date(m.date).toISOString().split('T')[0];
            const prints = printsByDate[key] || { MOBILE: [], DESKTOP: [] };
            const mobileHtml = prints.MOBILE.length
                ? prints.MOBILE.map((url) => `<img src="${url}" class="print-img" alt="Print mobile" />`).join('')
                : '<p class="no-prints">Nenhum print mobile</p>';
            const desktopHtml = prints.DESKTOP.length
                ? prints.DESKTOP.map((url) => `<img src="${url}" class="print-img" alt="Print desktop" />`).join('')
                : '<p class="no-prints">Nenhum print desktop</p>';
            const ctr = m.views > 0 ? ((m.clicks / m.views) * 100).toFixed(2) : '0,00';
            return `
          <div class="day-page">
            <div class="day-header">
              <div class="day-date">${this.formatDate(m.date)}</div>
              <div class="day-metrics">
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
                  <span class="day-metric-value">${ctr}%</span>
                </div>
              </div>
            </div>

            <div class="prints-section">
              <div class="prints-col">
                <div class="prints-col-label">
                  <span class="format-badge mobile">Mobile</span>
                </div>
                <div class="prints-grid">${mobileHtml}</div>
              </div>
              <div class="prints-col">
                <div class="prints-col-label">
                  <span class="format-badge desktop">Desktop</span>
                </div>
                <div class="prints-grid">${desktopHtml}</div>
              </div>
            </div>
          </div>
        `;
        })
            .join('');
    }
    buildHtml(campaign) {
        const printsByDate = this.groupPrintsByDate(campaign.prints);
        const dayPages = this.buildDayPages(campaign.metrics, printsByDate);
        const chartScript = this.buildChartDataScript(campaign.metrics);
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; }

  /* ---- CAPA ---- */
  .cover {
    width: 210mm;
    min-height: 297mm;
    padding: 48px;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }
  .cover-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 2px solid #185FA5;
  }
  .cover-brand {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #185FA5;
    text-transform: uppercase;
  }
  .cover-date-range {
    font-size: 11px;
    color: #888;
  }
  .cover-title {
    font-size: 28px;
    font-weight: 700;
    color: #0a0a0a;
    line-height: 1.3;
    margin-bottom: 8px;
  }
  .cover-subtitle {
    font-size: 14px;
    color: #555;
    margin-bottom: 32px;
  }
  .cover-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
    margin-bottom: 40px;
  }
  .cover-meta-item label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 2px;
  }
  .cover-meta-item span {
    font-size: 13px;
    color: #1a1a1a;
    font-weight: 500;
  }
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 40px;
  }
  .kpi-card {
    background: #F4F8FE;
    border-radius: 10px;
    padding: 20px;
    border-left: 4px solid #185FA5;
  }
  .kpi-label {
    font-size: 10px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .kpi-value {
    font-size: 26px;
    font-weight: 700;
    color: #185FA5;
  }
  .chart-container {
    background: #fafafa;
    border-radius: 10px;
    padding: 20px;
    border: 1px solid #eee;
    flex: 1;
    min-height: 200px;
  }
  .chart-title {
    font-size: 11px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
  }

  /* ---- PÁGINAS DE DIA ---- */
  .day-page {
    width: 210mm;
    min-height: 297mm;
    padding: 40px 48px;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .day-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5e7eb;
  }
  .day-date {
    font-size: 22px;
    font-weight: 700;
    color: #0a0a0a;
  }
  .day-metrics {
    display: flex;
    gap: 32px;
  }
  .day-metric {
    text-align: right;
  }
  .day-metric-label {
    display: block;
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .day-metric-value {
    font-size: 18px;
    font-weight: 700;
    color: #185FA5;
  }
  .prints-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    flex: 1;
  }
  .prints-col-label {
    margin-bottom: 12px;
  }
  .format-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .format-badge.mobile {
    background: #E1F5EE;
    color: #0F6E56;
  }
  .format-badge.desktop {
    background: #E6F1FB;
    color: #185FA5;
  }
  .prints-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .print-img {
    width: 100%;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    object-fit: contain;
  }
  .no-prints {
    font-size: 12px;
    color: #bbb;
    font-style: italic;
    padding: 24px 0;
    text-align: center;
    border: 1px dashed #e5e7eb;
    border-radius: 8px;
  }

  @media print {
    .cover, .day-page { page-break-after: always; }
  }
</style>
</head>
<body>

<!-- CAPA -->
<div class="cover">
  <div class="cover-header">
    <div class="cover-brand">Relatório de Campanha</div>
    <div class="cover-date-range">${this.formatDate(campaign.startDate)} — ${this.formatDate(campaign.endDate)}</div>
  </div>

  <h1 class="cover-title">${campaign.name}</h1>
  <p class="cover-subtitle">${campaign.city}</p>

  <div class="cover-meta-grid">
    <div class="cover-meta-item"><label>Cliente</label><span>${campaign.client}</span></div>
    <div class="cover-meta-item"><label>Agência</label><span>${campaign.agency}</span></div>
    <div class="cover-meta-item"><label>PI</label><span>${campaign.pi}</span></div>
    <div class="cover-meta-item"><label>Praça</label><span>${campaign.city}</span></div>
    <div class="cover-meta-item"><label>Início</label><span>${this.formatDate(campaign.startDate)}</span></div>
    <div class="cover-meta-item"><label>Término</label><span>${this.formatDate(campaign.endDate)}</span></div>
  </div>

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
      <div class="kpi-value">${campaign.ctr}%</div>
    </div>
  </div>

  <div class="chart-container">
    <div class="chart-title">Desempenho diário — Visualizações e Cliques</div>
    <div style="height: 200px; position: relative;">
      <canvas id="perf-chart"></canvas>
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