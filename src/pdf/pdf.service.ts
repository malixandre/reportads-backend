import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

export interface CampaignData {
  id: string;
  name: string;
  pi: string;
  client: string;
  agency: string;
  city: string;
  startDate: Date;
  endDate: Date;
  totals: { views: number; clicks: number };
  ctr: string;
  metrics: Array<{
    date: Date; views: number; clicks: number; ctr: number;
    viewsMobile: number; viewsDesktop: number;
    clicksMobile: number; clicksDesktop: number;
  }>;
  prints: Array<{ date: Date; format: string; url: string }>;
  clientLogoBase64?: string;
  companyLogoBase64?: string;
  coverColor?: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  async generate(campaign: CampaignData): Promise<string> {
    this.logger.log(`Gerando PDF: ${campaign.name}`);
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(this.buildHtml(campaign), { waitUntil: 'networkidle0' });
      await page.evaluateHandle('document.fonts.ready');
      const pdfBuffer = await page.pdf({ format: 'A4', landscape: true, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
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
    if (n === null || n === undefined || n === 0) return '—';
    return n.toLocaleString('pt-BR');
  }

  private fmtCtr(views: number, clicks: number): string {
    if (!views || views === 0) return '—';
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
    const viewsMobile = metrics.map((m) => m.viewsMobile || 0);
    const viewsDesktop = metrics.map((m) => m.viewsDesktop || 0);
    const clicksMobile = metrics.map((m) => m.clicksMobile || 0);
    const clicksDesktop = metrics.map((m) => m.clicksDesktop || 0);

    const hasMobile = viewsMobile.some((v) => v > 0) || clicksMobile.some((v) => v > 0);
    const hasDesktop = viewsDesktop.some((v) => v > 0) || clicksDesktop.some((v) => v > 0);

    // Se não tem separação, usa totais
    const useSeparate = hasMobile || hasDesktop;

    if (useSeparate) {
      const datasets: any[] = [];
      if (hasMobile) {
        datasets.push({ label: 'Views Mobile', data: viewsMobile, backgroundColor: 'rgba(29,158,117,0.8)', borderRadius: 3, yAxisID: 'y' });
        datasets.push({ label: 'Cliques Mobile', data: clicksMobile, backgroundColor: 'rgba(29,158,117,0.4)', borderRadius: 3, yAxisID: 'y1' });
      }
      if (hasDesktop) {
        datasets.push({ label: 'Views Desktop', data: viewsDesktop, backgroundColor: 'rgba(55,138,221,0.8)', borderRadius: 3, yAxisID: 'y' });
        datasets.push({ label: 'Cliques Desktop', data: clicksDesktop, backgroundColor: 'rgba(55,138,221,0.4)', borderRadius: 3, yAxisID: 'y1' });
      }
      return `
        new Chart(document.getElementById('perf-chart').getContext('2d'), {
          type: 'bar',
          data: { labels: ${JSON.stringify(labels)}, datasets: ${JSON.stringify(datasets)} },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 10 } } },
            scales: {
              y: { type: 'linear', position: 'left', ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
              y1: { type: 'linear', position: 'right', ticks: { font: { size: 9 } }, grid: { drawOnChartArea: false } },
              x: { ticks: { font: { size: 9 }, maxRotation: 45 }, grid: { display: false } }
            }
          }
        });`;
    } else {
      const views = metrics.map((m) => m.views || 0);
      const clicks = metrics.map((m) => m.clicks || 0);
      return `
        new Chart(document.getElementById('perf-chart').getContext('2d'), {
          type: 'bar',
          data: { labels: ${JSON.stringify(labels)}, datasets: [
            { label: 'Visualizações', data: ${JSON.stringify(views)}, backgroundColor: 'rgba(55,138,221,0.85)', borderRadius: 3, yAxisID: 'y' },
            { label: 'Cliques', data: ${JSON.stringify(clicks)}, backgroundColor: 'rgba(29,158,117,0.85)', borderRadius: 3, yAxisID: 'y1' }
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 10 } } },
            scales: {
              y: { type: 'linear', position: 'left', ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
              y1: { type: 'linear', position: 'right', ticks: { font: { size: 9 } }, grid: { drawOnChartArea: false } },
              x: { ticks: { font: { size: 9 }, maxRotation: 45 }, grid: { display: false } }
            }
          }
        });`;
    }
  }

  private buildHeader(campaign: CampaignData, accentColor: string): string {
    const companyLogo = campaign.companyLogoBase64
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:32px;max-width:100px;object-fit:contain;" />`
      : `<span style="font-size:12px;font-weight:700;color:${accentColor};">ReportAds</span>`;
    const clientLogo = campaign.clientLogoBase64
      ? `<img src="${campaign.clientLogoBase64}" style="max-height:32px;max-width:100px;object-fit:contain;" />`
      : `<span style="font-size:11px;font-weight:600;color:#444;">${campaign.client}</span>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 28px;border-bottom:2px solid ${accentColor};background:#fff;">
        <div style="width:110px;">${companyLogo}</div>
        <div style="flex:1;text-align:center;font-size:11px;font-weight:600;color:#333;">${campaign.name}</div>
        <div style="width:110px;display:flex;justify-content:flex-end;">${clientLogo}</div>
      </div>`;
  }

  private buildDayPages(metrics: CampaignData['metrics'], printsByDate: Record<string, { MOBILE: string[]; DESKTOP: string[] }>, campaign: CampaignData, accentColor: string): string {
    return metrics.map((m) => {
      const key = new Date(m.date).toISOString().split('T')[0];
      const prints = printsByDate[key] || { MOBILE: [], DESKTOP: [] };

      const mobileHtml = prints.MOBILE.length
        ? prints.MOBILE.map((url) => `<img src="${url}" style="width:100%;border-radius:6px;border:1px solid #e5e7eb;object-fit:contain;max-height:260px;margin-bottom:8px;" />`).join('')
        : '<p style="font-size:11px;color:#bbb;font-style:italic;padding:16px;text-align:center;border:1px dashed #e5e7eb;border-radius:6px;">Nenhum print</p>';

      const desktopHtml = prints.DESKTOP.length
        ? prints.DESKTOP.map((url) => `<img src="${url}" style="width:100%;border-radius:6px;border:1px solid #e5e7eb;object-fit:contain;max-height:260px;margin-bottom:8px;" />`).join('')
        : '<p style="font-size:11px;color:#bbb;font-style:italic;padding:16px;text-align:center;border:1px dashed #e5e7eb;border-radius:6px;">Nenhum print</p>';

      const hasMobile = (m.viewsMobile > 0) || (m.clicksMobile > 0);
      const hasDesktop = (m.viewsDesktop > 0) || (m.clicksDesktop > 0);

      let metricsHtml = '';
      if (hasMobile || hasDesktop) {
        metricsHtml = `
          <div style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Métricas do dia</div>
          ${hasMobile ? `
          <div style="margin-bottom:8px;padding:8px;background:#E1F5EE;border-radius:6px;">
            <div style="font-size:9px;font-weight:600;color:#0F6E56;margin-bottom:4px;">📱 Mobile</div>
            <div style="display:flex;gap:12px;">
              <div><div style="font-size:8px;color:#555;">Views</div><div style="font-size:15px;font-weight:700;color:#0F6E56;">${this.fmtNum(m.viewsMobile)}</div></div>
              <div><div style="font-size:8px;color:#555;">Cliques</div><div style="font-size:15px;font-weight:700;color:#0F6E56;">${this.fmtNum(m.clicksMobile)}</div></div>
              <div><div style="font-size:8px;color:#555;">CTR</div><div style="font-size:15px;font-weight:700;color:#0F6E56;">${this.fmtCtr(m.viewsMobile, m.clicksMobile)}</div></div>
            </div>
          </div>` : ''}
          ${hasDesktop ? `
          <div style="padding:8px;background:#E6F1FB;border-radius:6px;">
            <div style="font-size:9px;font-weight:600;color:${accentColor};margin-bottom:4px;">🖥️ Desktop</div>
            <div style="display:flex;gap:12px;">
              <div><div style="font-size:8px;color:#555;">Views</div><div style="font-size:15px;font-weight:700;color:${accentColor};">${this.fmtNum(m.viewsDesktop)}</div></div>
              <div><div style="font-size:8px;color:#555;">Cliques</div><div style="font-size:15px;font-weight:700;color:${accentColor};">${this.fmtNum(m.clicksDesktop)}</div></div>
              <div><div style="font-size:8px;color:#555;">CTR</div><div style="font-size:15px;font-weight:700;color:${accentColor};">${this.fmtCtr(m.viewsDesktop, m.clicksDesktop)}</div></div>
            </div>
          </div>` : ''}`;
      } else {
        metricsHtml = `
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div><div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Visualizações</div><div style="font-size:20px;font-weight:700;color:${accentColor};">${this.fmtNum(m.views)}</div></div>
            <div><div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Cliques</div><div style="font-size:20px;font-weight:700;color:${accentColor};">${this.fmtNum(m.clicks)}</div></div>
            <div><div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">CTR</div><div style="font-size:20px;font-weight:700;color:${accentColor};">${this.fmtCtr(m.views, m.clicks)}</div></div>
          </div>`;
      }

      return `
        <div style="width:297mm;min-height:210mm;page-break-after:always;">
          ${this.buildHeader(campaign, accentColor)}
          <div style="display:grid;grid-template-columns:180px 1fr;height:calc(210mm - 50px);">
            <div style="background:#F8F9FA;padding:20px 16px;display:flex;flex-direction:column;gap:16px;border-right:1px solid #e5e7eb;">
              <div style="font-size:18px;font-weight:700;color:#0a0a0a;">${this.fmtDate(m.date)}</div>
              ${metricsHtml}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;overflow:hidden;">
              <div style="padding:14px 16px;border-right:1px solid #f3f4f6;overflow-y:auto;">
                <div style="margin-bottom:8px;"><span style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#E1F5EE;color:#0F6E56;">📱 Mobile</span></div>
                ${mobileHtml}
              </div>
              <div style="padding:14px 16px;overflow-y:auto;">
                <div style="margin-bottom:8px;"><span style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#E6F1FB;color:${accentColor};">🖥️ Desktop</span></div>
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
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:44px;max-width:130px;object-fit:contain;filter:brightness(0) invert(1);" />`
      : `<div style="font-size:16px;font-weight:700;letter-spacing:0.08em;color:rgba(255,255,255,0.9);">ReportAds</div>`;
    const clientLogoHtml = campaign.clientLogoBase64
      ? `<img src="${campaign.clientLogoBase64}" style="max-height:44px;max-width:130px;object-fit:contain;" />`
      : '';

    const metricsTableRows = campaign.metrics.map((m) => {
      const hasMobile = (m.viewsMobile > 0) || (m.clicksMobile > 0);
      const hasDesktop = (m.viewsDesktop > 0) || (m.clicksDesktop > 0);
      if (hasMobile || hasDesktop) {
        return `
          ${hasMobile ? `<tr style="background:#f0fdf4;">
            <td>${this.fmtDate(m.date)}</td>
            <td><span style="font-size:10px;color:#0F6E56;">📱 Mobile</span></td>
            <td>${this.fmtNum(m.viewsMobile)}</td>
            <td>${this.fmtNum(m.clicksMobile)}</td>
            <td>${this.fmtCtr(m.viewsMobile, m.clicksMobile)}</td>
          </tr>` : ''}
          ${hasDesktop ? `<tr style="background:#eff6ff;">
            <td>${hasMobile ? '' : this.fmtDate(m.date)}</td>
            <td><span style="font-size:10px;color:${accentColor};">🖥️ Desktop</span></td>
            <td>${this.fmtNum(m.viewsDesktop)}</td>
            <td>${this.fmtNum(m.clicksDesktop)}</td>
            <td>${this.fmtCtr(m.viewsDesktop, m.clicksDesktop)}</td>
          </tr>` : ''}`;
      }
      return `<tr>
        <td>${this.fmtDate(m.date)}</td>
        <td><span style="font-size:10px;color:#888;">—</span></td>
        <td>${this.fmtNum(m.views)}</td>
        <td>${this.fmtNum(m.clicks)}</td>
        <td>${this.fmtCtr(m.views, m.clicks)}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; }
  .cover { width: 297mm; min-height: 210mm; display: grid; grid-template-columns: 1fr 1fr; page-break-after: always; }
  .metrics-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .metrics-table th { background: #F4F8FE; padding: 5px 8px; text-align: left; font-size: 9px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
  .metrics-table td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; color: #333; }
</style>
</head>
<body>

<div class="cover">
  <div style="background:${accentColor};color:#fff;padding:36px 36px 28px;display:flex;flex-direction:column;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;">
      ${companyLogoHtml}
      ${clientLogoHtml ? `<div style="width:1px;height:32px;background:rgba(255,255,255,0.3);"></div>${clientLogoHtml}` : ''}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-bottom:8px;">Relatório de Campanha</div>
      <div style="font-size:24px;font-weight:700;line-height:1.25;margin-bottom:14px;">${campaign.name}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.75);">${this.fmtDate(campaign.startDate)} — ${this.fmtDate(campaign.endDate)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <div style="font-size:10px;color:rgba(255,255,255,0.7);"><strong style="color:#fff;">Cliente:</strong> ${campaign.client}</div>
      ${campaign.agency ? `<div style="font-size:10px;color:rgba(255,255,255,0.7);"><strong style="color:#fff;">Agência:</strong> ${campaign.agency}</div>` : ''}
      <div style="font-size:10px;color:rgba(255,255,255,0.7);"><strong style="color:#fff;">PI:</strong> ${campaign.pi || '—'}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.7);"><strong style="color:#fff;">Praça:</strong> ${campaign.city}</div>
    </div>
  </div>

  <div style="padding:28px 28px;display:flex;flex-direction:column;gap:20px;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      <div style="background:#F4F8FE;border-radius:8px;padding:14px;border-left:3px solid ${accentColor};">
        <div style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Total Views</div>
        <div style="font-size:20px;font-weight:700;color:${accentColor};">${this.fmtNum(campaign.totals.views)}</div>
      </div>
      <div style="background:#F4F8FE;border-radius:8px;padding:14px;border-left:3px solid ${accentColor};">
        <div style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Total Cliques</div>
        <div style="font-size:20px;font-weight:700;color:${accentColor};">${this.fmtNum(campaign.totals.clicks)}</div>
      </div>
      <div style="background:#F4F8FE;border-radius:8px;padding:14px;border-left:3px solid ${accentColor};">
        <div style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">CTR Médio</div>
        <div style="font-size:20px;font-weight:700;color:${accentColor};">${this.fmtCtr(campaign.totals.views, campaign.totals.clicks)}</div>
      </div>
    </div>

    <div>
      <div style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Desempenho diário</div>
      <div style="height:120px;position:relative;"><canvas id="perf-chart"></canvas></div>
    </div>

    <div style="flex:1;overflow:hidden;">
      <div style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Resumo por dia</div>
      <table class="metrics-table">
        <thead><tr><th>Data</th><th>Formato</th><th>Views</th><th>Cliques</th><th>CTR</th></tr></thead>
        <tbody>${metricsTableRows}</tbody>
      </table>
    </div>
  </div>
</div>

${dayPages}

<script>window.addEventListener('load', function() { ${chartScript} });</script>
</body>
</html>`;
  }
}
