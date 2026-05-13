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
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    try {
      const page = await browser.newPage();
      await page.setContent(this.buildHtml(campaign), { waitUntil: 'networkidle0' });
      await page.evaluateHandle('document.fonts.ready');
      // Reduz escala para diminuir tamanho do PDF
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      const pdfBuffer = await page.pdf({ format: 'A4', landscape: false, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, scale: 0.85 });
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
          { label: 'Visualizações', data: ${JSON.stringify(views)}, backgroundColor: '${accentColor}', borderRadius: 4, yAxisID: 'y', barPercentage: 0.6 },
          { label: 'Cliques', data: ${JSON.stringify(clicks)}, backgroundColor: '${accentColor}55', borderRadius: 4, yAxisID: 'y1', barPercentage: 0.6 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10, family: 'Segoe UI' }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } } },
          scales: {
            y: { type: 'linear', position: 'left', ticks: { font: { size: 9 }, color: '#aaa' }, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false } },
            y1: { type: 'linear', position: 'right', ticks: { font: { size: 9 }, color: '#aaa' }, grid: { drawOnChartArea: false }, border: { display: false } },
            x: { ticks: { font: { size: 9 }, maxRotation: 0, color: '#aaa' }, grid: { display: false }, border: { display: false } }
          }
        }
      });`;
  }

  private pageHeader(campaign: CampaignData, accentColor: string, pageDate?: string): string {
    const companyLogo = campaign.companyLogoBase64
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:32px;max-width:110px;object-fit:contain;" />`
      : `<span style="font-size:12px;font-weight:800;color:${accentColor};letter-spacing:-0.02em;">ReportAds</span>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 28px;background:#fff;border-bottom:3px solid ${accentColor};">
        ${companyLogo}
        <div style="font-size:9px;font-weight:600;color:#999;letter-spacing:0.06em;text-transform:uppercase;">${campaign.name}${pageDate ? ` &nbsp;·&nbsp; ${pageDate}` : ''}</div>
        <div style="width:110px;"></div>
      </div>`;
  }

  private buildDayPages(metrics: CampaignData['metrics'], printsByDate: Record<string, { MOBILE: string[]; DESKTOP: string[] }>, campaign: CampaignData, accentColor: string): string {
    return metrics.map((m) => {
      const key = new Date(m.date).toISOString().split('T')[0];
      const prints = printsByDate[key] || { MOBILE: [], DESKTOP: [] };
      const noImg = `<div style="display:flex;align-items:center;justify-content:center;height:80px;border:1.5px dashed #E0E0E0;border-radius:6px;"><span style="font-size:10px;color:#CCC;">Sem print</span></div>`;

      const mobileHtml = prints.MOBILE.length
        ? prints.MOBILE.map((url) => `<img src="${url}" style="width:100%;max-height:320px;border-radius:6px;border:1px solid #EBEBEB;object-fit:contain;margin-bottom:8px;display:block;" />`).join('')
        : noImg;
      const desktopHtml = prints.DESKTOP.length
        ? prints.DESKTOP.map((url) => `<img src="${url}" style="width:100%;max-height:320px;border-radius:6px;border:1px solid #EBEBEB;object-fit:contain;margin-bottom:8px;display:block;" />`).join('')
        : noImg;

      return `
        <div style="width:210mm;min-height:297mm;page-break-after:always;display:flex;flex-direction:column;background:#FAFAFA;">
          ${this.pageHeader(campaign, accentColor, this.fmtDate(m.date))}

          <!-- Métricas do dia -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;background:#fff;border-bottom:1px solid #F0F0F0;">
            <div style="padding:16px 20px;border-right:1px solid #F0F0F0;">
              <div style="font-size:8px;font-weight:700;color:#BBB;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Visualizações</div>
              <div style="font-size:22px;font-weight:800;color:${accentColor};letter-spacing:-0.02em;">${this.fmtNum(m.views)}</div>
            </div>
            <div style="padding:16px 20px;border-right:1px solid #F0F0F0;">
              <div style="font-size:8px;font-weight:700;color:#BBB;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Cliques</div>
              <div style="font-size:22px;font-weight:800;color:#222;letter-spacing:-0.02em;">${this.fmtNum(m.clicks)}</div>
            </div>
            <div style="padding:16px 20px;">
              <div style="font-size:8px;font-weight:700;color:#BBB;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">CTR</div>
              <div style="font-size:22px;font-weight:800;color:#222;letter-spacing:-0.02em;">${this.fmtCtr(m.views, m.clicks)}</div>
            </div>
          </div>

          <!-- Prints -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;flex:1;padding:16px 20px;gap:16px;">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
                <div style="width:3px;height:14px;background:#22C55E;border-radius:2px;"></div>
                <span style="font-size:9px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.08em;">Mobile</span>
              </div>
              ${mobileHtml}
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
                <div style="width:3px;height:14px;background:${accentColor};border-radius:2px;"></div>
                <span style="font-size:9px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.08em;">Desktop</span>
              </div>
              ${desktopHtml}
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

    const companyLogoBlock = campaign.companyLogoBase64
      ? `<img src="${campaign.companyLogoBase64}" style="max-height:56px;max-width:200px;object-fit:contain;" />`
      : `<span style="font-size:14px;font-weight:800;color:${accentColor};letter-spacing:-0.02em;">ReportAds</span>`;


    const metricsRows = campaign.metrics.map((m, i) => `
      <tr>
        <td style="padding:7px 12px;font-size:10px;color:#444;border-bottom:1px solid ${i % 2 === 0 ? '#F5F5F5' : '#EBEBEB'};background:${i % 2 === 0 ? '#fff' : '#FAFAFA'};">${this.fmtDate(m.date)}</td>
        <td style="padding:7px 12px;font-size:10px;font-weight:600;color:#222;border-bottom:1px solid ${i % 2 === 0 ? '#F5F5F5' : '#EBEBEB'};background:${i % 2 === 0 ? '#fff' : '#FAFAFA'};">${this.fmtNum(m.views)}</td>
        <td style="padding:7px 12px;font-size:10px;color:#444;border-bottom:1px solid ${i % 2 === 0 ? '#F5F5F5' : '#EBEBEB'};background:${i % 2 === 0 ? '#fff' : '#FAFAFA'};">${this.fmtNum(m.clicks)}</td>
        <td style="padding:7px 12px;font-size:10px;color:#444;border-bottom:1px solid ${i % 2 === 0 ? '#F5F5F5' : '#EBEBEB'};background:${i % 2 === 0 ? '#fff' : '#FAFAFA'};">${this.fmtCtr(m.views, m.clicks)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<!-- sem fontes externas -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; -webkit-print-color-adjust:exact; }
  img { image-rendering: -webkit-optimize-contrast; }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════
     CAPA
═══════════════════════════════════════════════ -->
<div style="width:210mm;min-height:297mm;page-break-after:always;display:flex;flex-direction:column;background:#fff;">

  <!-- TOP BAR: logo empresa centralizada -->
  <div style="display:flex;align-items:center;justify-content:center;padding:28px 32px 24px;border-bottom:2px solid ${accentColor};">
    <div>${companyLogoBlock}</div>
  </div>

  <!-- HERO: título + período com linha de cor -->
  <div style="padding:32px 32px 0;position:relative;">
    <div style="width:48px;height:4px;background:${accentColor};border-radius:2px;margin-bottom:16px;"></div>
    <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#999;margin-bottom:8px;">Relatório de Campanha</div>
    <div style="font-size:28px;font-weight:900;color:#111;line-height:1.15;letter-spacing:-0.02em;margin-bottom:10px;">${campaign.name}</div>
    <div style="font-size:12px;color:#888;font-weight:500;">${this.fmtDate(campaign.startDate)} &nbsp;→&nbsp; ${this.fmtDate(campaign.endDate)}</div>
  </div>

  <!-- DADOS DA CAMPANHA: cards em grid -->
  <div style="margin:24px 32px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    <div style="padding:14px 16px;background:#F7F8FA;border-radius:8px;border-left:3px solid ${accentColor};">
      <div style="font-size:7px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Cliente</div>
      <div style="font-size:13px;font-weight:700;color:#111;">${campaign.client}</div>
    </div>
    ${campaign.agency ? `
    <div style="padding:14px 16px;background:#F7F8FA;border-radius:8px;border-left:3px solid #DDD;">
      <div style="font-size:7px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Agência</div>
      <div style="font-size:13px;font-weight:700;color:#111;">${campaign.agency}</div>
    </div>` : '<div></div>'}
    <div style="padding:14px 16px;background:#F7F8FA;border-radius:8px;border-left:3px solid #DDD;">
      <div style="font-size:7px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">PI</div>
      <div style="font-size:13px;font-weight:700;color:#111;">${campaign.pi || '—'}</div>
    </div>
    <div style="padding:14px 16px;background:#F7F8FA;border-radius:8px;border-left:3px solid #DDD;">
      <div style="font-size:7px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Praça</div>
      <div style="font-size:13px;font-weight:700;color:#111;">${campaign.city}</div>
    </div>
  </div>

  <!-- DIVIDER com rótulo -->
  <div style="margin:0 32px 20px;display:flex;align-items:center;gap:12px;">
    <div style="font-size:8px;font-weight:700;color:#CCC;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;">Resumo da campanha</div>
    <div style="flex:1;height:1px;background:#EBEBEB;"></div>
  </div>

  <!-- KPIs em destaque -->
  <div style="margin:0 32px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
    <div style="padding:18px;background:${accentColor};border-radius:10px;box-shadow:0 4px 16px ${accentColor}44;">
      <div style="font-size:7px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Total Views</div>
      <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.02em;">${this.fmtNum(campaign.totals.views)}</div>
    </div>
    <div style="padding:18px;background:#F7F8FA;border-radius:10px;border:1px solid #EBEBEB;">
      <div style="font-size:7px;font-weight:700;color:#BBB;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Total Cliques</div>
      <div style="font-size:26px;font-weight:900;color:#111;letter-spacing:-0.02em;">${this.fmtNum(campaign.totals.clicks)}</div>
    </div>
    <div style="padding:18px;background:#F7F8FA;border-radius:10px;border:1px solid #EBEBEB;">
      <div style="font-size:7px;font-weight:700;color:#BBB;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">CTR Médio</div>
      <div style="font-size:26px;font-weight:900;color:#111;letter-spacing:-0.02em;">${this.fmtCtr(campaign.totals.views, campaign.totals.clicks)}</div>
    </div>
  </div>

  <!-- GRÁFICO -->
  <div style="margin:0 32px 20px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div style="font-size:8px;font-weight:700;color:#CCC;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;">Desempenho diário</div>
      <div style="flex:1;height:1px;background:#EBEBEB;"></div>
    </div>
    <div style="height:140px;position:relative;"><canvas id="perf-chart"></canvas></div>
  </div>

  <!-- TABELA RESUMO -->
  <div style="margin:0 32px;flex:1;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div style="font-size:8px;font-weight:700;color:#CCC;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;">Resumo por dia</div>
      <div style="flex:1;height:1px;background:#EBEBEB;"></div>
    </div>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:${accentColor};">
          <th style="padding:9px 12px;text-align:left;font-size:8px;font-weight:700;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.08em;">Data</th>
          <th style="padding:9px 12px;text-align:left;font-size:8px;font-weight:700;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.08em;">Views</th>
          <th style="padding:9px 12px;text-align:left;font-size:8px;font-weight:700;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.08em;">Cliques</th>
          <th style="padding:9px 12px;text-align:left;font-size:8px;font-weight:700;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.08em;">CTR</th>
        </tr>
      </thead>
      <tbody>${metricsRows}</tbody>
    </table>
  </div>

  <!-- RODAPÉ -->
  <div style="margin:20px 32px 24px;padding-top:16px;border-top:1px solid #F0F0F0;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:9px;color:#BBB;">${this.fmtDate(campaign.startDate)} — ${this.fmtDate(campaign.endDate)}</div>
    <div style="font-size:9px;color:#BBB;">Gerado pelo ReportAds</div>
  </div>

</div>

<!-- PÁGINAS POR DIA -->
${dayPages}

<script>window.addEventListener('load', function() { ${chartScript} });</script>
</body>
</html>`;
  }
}
