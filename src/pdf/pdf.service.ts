import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

export interface CampaignData {
  id: string; name: string; pi: string; client: string; agency: string; city: string;
  startDate: Date; endDate: Date;
  totals: { views: number; clicks: number };
  ctr: string;
  metrics: Array<{ date: Date; views: number; clicks: number; ctr: number; viewsMobile: number; viewsDesktop: number; clicksMobile: number; clicksDesktop: number; }>;
  prints: Array<{ date: Date; format: string; url: string }>;
  clientLogoBase64?: string; companyLogoBase64?: string; coverColor?: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  async generate(campaign: CampaignData): Promise<string> {
    this.logger.log(`Gerando PDF: ${campaign.name}`);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    try {
      const page = await browser.newPage();
      await page.setContent(this.buildHtml(campaign), { waitUntil: 'networkidle0' });
      await page.evaluateHandle('document.fonts.ready');
      const pdfBuffer = await page.pdf({ format: 'A4', landscape: false, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
      const filename = `reports/${campaign.id}/${Date.now()}.pdf`;
      const { error } = await this.supabase.storage.from('reports').upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });
      if (error) throw new Error('Erro ao salvar PDF: ' + error.message);
      const { data } = this.supabase.storage.from('reports').getPublicUrl(filename);
      return data.publicUrl;
    } finally {
      await browser.close();
    }
  }

  private fmtDate(d: Date): string { return new Date(d).toLocaleDateString('pt-BR'); }

  private fmtNum(n: number | null | undefined): string {
    if (!n || n === 0) return '—';
    return n.toLocaleString('pt-BR');
  }

  private fmtCtr(views: number, clicks: number): string {
    if (!views || views === 0 || !clicks || clicks === 0) return '—';
    return ((clicks / views) * 100).toFixed(2) + '%';
  }

  private groupPrintsByDate(prints: CampaignData['prints']): Record<string, { MOBILE: string[]; DESKTOP: string[] }> {
    const grouped: Record<string, { MOBILE: string[]; DESKTOP: string[] }> = {};
    prints.forEach((p) => {
      const key = new Date(p.date).toISOString().split('T')[0];
      if (!grouped[key]) grouped[key] = { MOBILE: [], DESKTOP: [] };
      grouped[key][p.format as 'MOBILE' | 'DESKTOP'].push(p.url);
    });
    return grouped;
  }

  private buildChartScript(metrics: CampaignData['metrics']): string {
    const labels = metrics.map((m) => this.fmtDate(m.date));
    const views = metrics.map((m) => m.views || 0);
    const clicks = metrics.map((m) => m.clicks || 0);
    return `
      new Chart(document.getElementById('perf-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: ${JSON.stringify(labels)}, datasets: [
          { label: 'Visualizações', data: ${JSON.stringify(views)}, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 3, yAxisID: 'y' },
          { label: 'Cliques', data: ${JSON.stringify(clicks)}, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 3, yAxisID: 'y1' }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 8, color: 'rgba(255,255,255,0.8)' } } },
          scales: {
            y: { type: 'linear', position: 'left', ticks: { font: { size: 8 }, color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
            y1: { type: 'linear', position: 'right', ticks: { font: { size: 8 }, color: 'rgba(255,255,255,0.7)' }, grid: { drawOnChartArea: false } },
            x: { ticks: { font: { size: 8 }, maxRotation: 45, color: 'rgba(255,255,255,0.7)' }, grid: { display: false } }
          }
        }
      });`;
  }

  private buildCompanyHeader(campaign: CampaignData, accentColor: string): string {
    const companyLogo = campaign.companyLogoBase64
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:30px;max-width:100px;object-fit:contain;" />`
      : `<span style="font-size:11px;font-weight:700;color:${accentColor};">ReportAds</span>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 24px;border-bottom:2px solid ${accentColor};background:#fff;">
        <div>${companyLogo}</div>
        <div style="font-size:10px;font-weight:600;color:#444;">${campaign.name}</div>
        <div style="width:100px;"></div>
      </div>`;
  }

  private buildDayPages(metrics: CampaignData['metrics'], printsByDate: Record<string, { MOBILE: string[]; DESKTOP: string[] }>, campaign: CampaignData, accentColor: string): string {
    return metrics.map((m) => {
      const key = new Date(m.date).toISOString().split('T')[0];
      const prints = printsByDate[key] || { MOBILE: [], DESKTOP: [] };

      const mobileHtml = prints.MOBILE.length
        ? prints.MOBILE.map((url) => `<img src="${url}" style="width:100%;border-radius:4px;border:1px solid #e5e7eb;object-fit:contain;margin-bottom:6px;" />`).join('')
        : '<p style="font-size:10px;color:#bbb;font-style:italic;padding:12px;text-align:center;border:1px dashed #e5e7eb;border-radius:4px;">Nenhum print</p>';

      const desktopHtml = prints.DESKTOP.length
        ? prints.DESKTOP.map((url) => `<img src="${url}" style="width:100%;border-radius:4px;border:1px solid #e5e7eb;object-fit:contain;margin-bottom:6px;" />`).join('')
        : '<p style="font-size:10px;color:#bbb;font-style:italic;padding:12px;text-align:center;border:1px dashed #e5e7eb;border-radius:4px;">Nenhum print</p>';

      return `
        <div style="width:210mm;min-height:297mm;page-break-after:always;display:flex;flex-direction:column;">
          ${this.buildCompanyHeader(campaign, accentColor)}
          <div style="flex:1;display:grid;grid-template-columns:140px 1fr;overflow:hidden;">
            <div style="background:#F8F9FA;padding:18px 14px;display:flex;flex-direction:column;gap:12px;border-right:1px solid #e5e7eb;">
              <div style="font-size:16px;font-weight:700;color:#0a0a0a;">${this.fmtDate(m.date)}</div>
              <div>
                <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Visualizações</div>
                <div style="font-size:18px;font-weight:700;color:${accentColor};">${this.fmtNum(m.views)}</div>
              </div>
              <div>
                <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Cliques</div>
                <div style="font-size:18px;font-weight:700;color:${accentColor};">${this.fmtNum(m.clicks)}</div>
              </div>
              <div>
                <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">CTR</div>
                <div style="font-size:18px;font-weight:700;color:${accentColor};">${this.fmtCtr(m.views, m.clicks)}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;overflow:hidden;">
              <div style="padding:12px;border-right:1px solid #f3f4f6;overflow-y:auto;">
                <div style="margin-bottom:8px;"><span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:20px;background:#E1F5EE;color:#0F6E56;">📱 Mobile</span></div>
                ${mobileHtml}
              </div>
              <div style="padding:12px;overflow-y:auto;">
                <div style="margin-bottom:8px;"><span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:20px;background:#E6F1FB;color:${accentColor};">🖥️ Desktop</span></div>
                ${desktopHtml}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  private buildHtml(campaign: CampaignData): string {
    const accentColor = campaign.coverColor || '#185FA5';
    const printsByDate = this.groupPrintsByDate(campaign.prints);
    const dayPages = this.buildDayPages(campaign.metrics, printsByDate, campaign, accentColor);
    const chartScript = this.buildChartScript(campaign.metrics);

    const companyLogoHtml = campaign.companyLogoBase64
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:44px;max-width:140px;object-fit:contain;filter:brightness(0) invert(1);" />`
      : `<div style="font-size:16px;font-weight:700;letter-spacing:0.08em;color:rgba(255,255,255,0.95);">ReportAds</div>`;

    const clientLogoHtml = campaign.clientLogoBase64
      ? `<img src="${campaign.clientLogoBase64}" style="max-height:60px;max-width:160px;object-fit:contain;" />`
      : `<div style="font-size:20px;font-weight:700;color:#fff;">${campaign.client}</div>`;

    const metricsTableRows = campaign.metrics.map((m) => `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:10px;">${this.fmtDate(m.date)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:10px;">${this.fmtNum(m.views)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:10px;">${this.fmtNum(m.clicks)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:10px;">${this.fmtCtr(m.views, m.clicks)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; }
</style>
</head>
<body>

<!-- CAPA A4 retrato = 210mm x 297mm -->
<div style="width:210mm;min-height:297mm;background:${accentColor};display:flex;flex-direction:column;page-break-after:always;">
  <!-- Topo: logos -->
  <div style="padding:32px 32px 0;display:flex;align-items:center;justify-content:space-between;">
    <div>${companyLogoHtml}</div>
    <div style="text-align:right;">${clientLogoHtml}</div>
  </div>

  <!-- Centro: título -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:32px;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:10px;">Relatório de Campanha</div>
    <div style="font-size:28px;font-weight:700;line-height:1.2;color:#fff;margin-bottom:16px;">${campaign.name}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-bottom:32px;">${this.fmtDate(campaign.startDate)} — ${this.fmtDate(campaign.endDate)}</div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
      <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:14px;">
        <div style="font-size:8px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Total Views</div>
        <div style="font-size:22px;font-weight:700;color:#fff;">${this.fmtNum(campaign.totals.views)}</div>
      </div>
      <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:14px;">
        <div style="font-size:8px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Total Cliques</div>
        <div style="font-size:22px;font-weight:700;color:#fff;">${this.fmtNum(campaign.totals.clicks)}</div>
      </div>
      <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:14px;">
        <div style="font-size:8px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">CTR Médio</div>
        <div style="font-size:22px;font-weight:700;color:#fff;">${this.fmtCtr(campaign.totals.views, campaign.totals.clicks)}</div>
      </div>
    </div>

    <!-- Gráfico -->
    <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Desempenho diário</div>
      <div style="height:130px;position:relative;"><canvas id="perf-chart"></canvas></div>
    </div>

    <!-- Tabela resumo -->
    <div style="background:rgba(255,255,255,0.1);border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px;text-align:left;font-size:8px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(255,255,255,0.15);">Data</th>
            <th style="padding:8px;text-align:left;font-size:8px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(255,255,255,0.15);">Views</th>
            <th style="padding:8px;text-align:left;font-size:8px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(255,255,255,0.15);">Cliques</th>
            <th style="padding:8px;text-align:left;font-size:8px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(255,255,255,0.15);">CTR</th>
          </tr>
        </thead>
        <tbody>${metricsTableRows}</tbody>
      </table>
    </div>
  </div>

  <!-- Rodapé capa -->
  <div style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.2);display:grid;grid-template-columns:repeat(2,1fr);gap:4px;">
    <div style="font-size:10px;color:rgba(255,255,255,0.95);"><strong style="color:#fff;">Cliente:</strong> ${campaign.client}</div>
    ${campaign.agency ? `<div style="font-size:10px;color:rgba(255,255,255,0.95);"><strong style="color:#fff;">Agência:</strong> ${campaign.agency}</div>` : '<div></div>'}
    <div style="font-size:10px;color:rgba(255,255,255,0.95);"><strong style="color:#fff;">PI:</strong> ${campaign.pi || '—'}</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.95);"><strong style="color:#fff;">Praça:</strong> ${campaign.city}</div>
  </div>
</div>

<!-- PÁGINAS POR DIA -->
${dayPages}

<script>window.addEventListener('load', function() { ${chartScript} });</script>
</body>
</html>`;
  }
}
