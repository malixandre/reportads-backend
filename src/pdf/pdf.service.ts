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

  private buildChartScript(metrics: CampaignData['metrics'], accentColor: string): string {
    const labels = metrics.map((m) => this.fmtDate(m.date));
    const views = metrics.map((m) => m.views || 0);
    const clicks = metrics.map((m) => m.clicks || 0);
    return `
      new Chart(document.getElementById('perf-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: ${JSON.stringify(labels)}, datasets: [
          { label: 'Visualizações', data: ${JSON.stringify(views)}, backgroundColor: '${accentColor}CC', borderRadius: 3, yAxisID: 'y' },
          { label: 'Cliques', data: ${JSON.stringify(clicks)}, backgroundColor: '${accentColor}66', borderRadius: 3, yAxisID: 'y1' }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 8 } } },
          scales: {
            y: { type: 'linear', position: 'left', ticks: { font: { size: 8 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
            y1: { type: 'linear', position: 'right', ticks: { font: { size: 8 } }, grid: { drawOnChartArea: false } },
            x: { ticks: { font: { size: 8 }, maxRotation: 45 }, grid: { display: false } }
          }
        }
      });`;
  }

  private buildCompanyHeader(campaign: CampaignData, accentColor: string): string {
    const companyLogo = campaign.companyLogoBase64
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:28px;max-width:90px;object-fit:contain;" />`
      : `<span style="font-size:10px;font-weight:700;color:${accentColor};">ReportAds</span>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 24px;border-bottom:2px solid ${accentColor};background:#fff;">
        <div>${companyLogo}</div>
        <div style="font-size:9px;font-weight:600;color:#555;">${campaign.name}</div>
        <div style="width:90px;"></div>
      </div>`;
  }

  private buildDayPages(metrics: CampaignData['metrics'], printsByDate: Record<string, { MOBILE: string[]; DESKTOP: string[] }>, campaign: CampaignData, accentColor: string): string {
    return metrics.map((m) => {
      const key = new Date(m.date).toISOString().split('T')[0];
      const prints = printsByDate[key] || { MOBILE: [], DESKTOP: [] };

      const mobileHtml = prints.MOBILE.length
        ? prints.MOBILE.map((url) => `<img src="${url}" style="width:100%;border-radius:4px;border:1px solid #e5e7eb;object-fit:contain;margin-bottom:6px;" />`).join('')
        : '<p style="font-size:10px;color:#ccc;font-style:italic;padding:12px;text-align:center;border:1px dashed #eee;border-radius:4px;">Nenhum print</p>';

      const desktopHtml = prints.DESKTOP.length
        ? prints.DESKTOP.map((url) => `<img src="${url}" style="width:100%;border-radius:4px;border:1px solid #e5e7eb;object-fit:contain;margin-bottom:6px;" />`).join('')
        : '<p style="font-size:10px;color:#ccc;font-style:italic;padding:12px;text-align:center;border:1px dashed #eee;border-radius:4px;">Nenhum print</p>';

      return `
        <div style="width:210mm;min-height:297mm;page-break-after:always;display:flex;flex-direction:column;background:#fff;">
          ${this.buildCompanyHeader(campaign, accentColor)}
          <div style="flex:1;display:grid;grid-template-columns:130px 1fr;">
            <div style="background:#F8F9FA;padding:16px 12px;display:flex;flex-direction:column;gap:14px;border-right:3px solid ${accentColor};">
              <div style="font-size:14px;font-weight:700;color:#111;padding-bottom:10px;border-bottom:1px solid #eee;">${this.fmtDate(m.date)}</div>
              <div>
                <div style="font-size:7px;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">Visualizações</div>
                <div style="font-size:16px;font-weight:700;color:${accentColor};">${this.fmtNum(m.views)}</div>
              </div>
              <div>
                <div style="font-size:7px;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">Cliques</div>
                <div style="font-size:16px;font-weight:700;color:${accentColor};">${this.fmtNum(m.clicks)}</div>
              </div>
              <div>
                <div style="font-size:7px;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">CTR</div>
                <div style="font-size:16px;font-weight:700;color:${accentColor};">${this.fmtCtr(m.views, m.clicks)}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;background:#fff;">
              <div style="padding:12px;border-right:1px solid #f0f0f0;">
                <div style="margin-bottom:8px;"><span style="font-size:8px;font-weight:700;padding:2px 8px;border-radius:20px;background:#E1F5EE;color:#0F6E56;">📱 Mobile</span></div>
                ${mobileHtml}
              </div>
              <div style="padding:12px;">
                <div style="margin-bottom:8px;"><span style="font-size:8px;font-weight:700;padding:2px 8px;border-radius:20px;background:#EBF3FB;color:${accentColor};">🖥️ Desktop</span></div>
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
    const chartScript = this.buildChartScript(campaign.metrics, accentColor);

    const companyLogoHtml = campaign.companyLogoBase64
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:40px;max-width:130px;object-fit:contain;" />`
      : `<div style="font-size:13px;font-weight:700;letter-spacing:0.06em;color:${accentColor};">ReportAds</div>`;

    const clientLogoHtml = campaign.clientLogoBase64
      ? `<img src="${campaign.clientLogoBase64}" style="max-height:70px;max-width:180px;object-fit:contain;" />`
      : '';

    const metricsTableRows = campaign.metrics.map((m, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#F8F9FA'};">
        <td style="padding:6px 10px;font-size:10px;color:#444;border-bottom:1px solid #F0F0F0;">${this.fmtDate(m.date)}</td>
        <td style="padding:6px 10px;font-size:10px;color:#444;border-bottom:1px solid #F0F0F0;">${this.fmtNum(m.views)}</td>
        <td style="padding:6px 10px;font-size:10px;color:#444;border-bottom:1px solid #F0F0F0;">${this.fmtNum(m.clicks)}</td>
        <td style="padding:6px 10px;font-size:10px;color:#444;border-bottom:1px solid #F0F0F0;">${this.fmtCtr(m.views, m.clicks)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Segoe UI',Arial,sans-serif; }</style>
</head>
<body>

<!-- CAPA: layout split - barra colorida à esquerda, conteúdo à direita -->
<div style="width:210mm;min-height:297mm;page-break-after:always;display:grid;grid-template-columns:72px 1fr;">

  <!-- Barra lateral colorida -->
  <div style="background:${accentColor};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:28px 0;">
    <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Relatório de Campanha</div>
    <div style="width:32px;height:3px;background:rgba(255,255,255,0.4);border-radius:2px;"></div>
    <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:8px;color:rgba(255,255,255,0.5);">${this.fmtDate(campaign.startDate)} — ${this.fmtDate(campaign.endDate)}</div>
  </div>

  <!-- Conteúdo principal -->
  <div style="background:#fff;display:flex;flex-direction:column;padding:0;">

    <!-- Header com logos -->
    <div style="padding:28px 28px 20px;border-bottom:1px solid #F0F0F0;display:flex;align-items:center;justify-content:space-between;">
      <div>${companyLogoHtml}</div>
      ${clientLogoHtml ? `<div>${clientLogoHtml}</div>` : ''}
    </div>

    <!-- Título campanha -->
    <div style="padding:28px 28px 20px;border-bottom:1px solid #F0F0F0;">
      <div style="font-size:22px;font-weight:700;color:#111;line-height:1.25;margin-bottom:8px;">${campaign.name}</div>
      <div style="font-size:11px;color:#888;">${this.fmtDate(campaign.startDate)} — ${this.fmtDate(campaign.endDate)}</div>
    </div>

    <!-- KPIs -->
    <div style="padding:20px 28px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;border-bottom:1px solid #F0F0F0;">
      <div style="padding:14px;border-radius:8px;border:2px solid ${accentColor};background:#fff;">
        <div style="font-size:8px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Total Views</div>
        <div style="font-size:22px;font-weight:700;color:${accentColor};">${this.fmtNum(campaign.totals.views)}</div>
      </div>
      <div style="padding:14px;border-radius:8px;border:1px solid #E8E8E8;background:#FAFAFA;">
        <div style="font-size:8px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Total Cliques</div>
        <div style="font-size:22px;font-weight:700;color:#333;">${this.fmtNum(campaign.totals.clicks)}</div>
      </div>
      <div style="padding:14px;border-radius:8px;border:1px solid #E8E8E8;background:#FAFAFA;">
        <div style="font-size:8px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">CTR Médio</div>
        <div style="font-size:22px;font-weight:700;color:#333;">${this.fmtCtr(campaign.totals.views, campaign.totals.clicks)}</div>
      </div>
    </div>

    <!-- Gráfico -->
    <div style="padding:20px 28px;border-bottom:1px solid #F0F0F0;">
      <div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Desempenho diário</div>
      <div style="height:140px;position:relative;"><canvas id="perf-chart"></canvas></div>
    </div>

    <!-- Tabela resumo -->
    <div style="padding:20px 28px;flex:1;">
      <div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Resumo por dia</div>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #F0F0F0;">
        <thead>
          <tr style="background:${accentColor};">
            <th style="padding:8px 10px;text-align:left;font-size:8px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Data</th>
            <th style="padding:8px 10px;text-align:left;font-size:8px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Views</th>
            <th style="padding:8px 10px;text-align:left;font-size:8px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Cliques</th>
            <th style="padding:8px 10px;text-align:left;font-size:8px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">CTR</th>
          </tr>
        </thead>
        <tbody>${metricsTableRows}</tbody>
      </table>
    </div>

    <!-- Rodapé com dados da campanha -->
    <div style="padding:16px 28px;background:#F8F9FA;border-top:3px solid ${accentColor};display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div style="font-size:10px;color:#555;"><strong style="color:#111;">Cliente:</strong> ${campaign.client}</div>
      ${campaign.agency ? `<div style="font-size:10px;color:#555;"><strong style="color:#111;">Agência:</strong> ${campaign.agency}</div>` : '<div></div>'}
      <div style="font-size:10px;color:#555;"><strong style="color:#111;">PI:</strong> ${campaign.pi || '—'}</div>
      <div style="font-size:10px;color:#555;"><strong style="color:#111;">Praça:</strong> ${campaign.city}</div>
    </div>
  </div>
</div>

<!-- PÁGINAS POR DIA -->
${dayPages}

<script>window.addEventListener('load', function() { ${chartScript} });</script>
</body>
</html>`;
  }
}
