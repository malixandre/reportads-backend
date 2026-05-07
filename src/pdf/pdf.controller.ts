import { Controller, Post, Param, UseGuards, Request, NotFoundException, Body } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsOptional, IsString } from 'class-validator';

class GeneratePdfDto {
  @IsOptional() @IsString() clientLogoBase64?: string;
  @IsOptional() @IsString() companyLogoBase64?: string;
  @IsOptional() @IsString() coverColor?: string;
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private pdf: PdfService, private prisma: PrismaService) {}

  @Post(':id/generate-pdf')
  async generate(@Request() req, @Param('id') id: string, @Body() dto: GeneratePdfDto) {
    // 1. Busca todos os dados ANTES de gerar o PDF
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { metrics: { orderBy: { date: 'asc' } }, prints: { orderBy: { date: 'asc' } } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada');
    if (campaign.userId !== req.user.sub) throw new NotFoundException();

    const totals = campaign.metrics.reduce(
      (acc, m) => { acc.views += m.views; acc.clicks += m.clicks; return acc; },
      { views: 0, clicks: 0 },
    );

    const report = await this.prisma.report.create({ data: { campaignId: id, status: 'GENERATING' } });
    const reportId = report.id;

    const metricsNormalized = campaign.metrics.map((m: any) => ({
      date: m.date, views: m.views, clicks: m.clicks, ctr: m.ctr,
      viewsMobile: m.viewsMobile ?? 0, viewsDesktop: m.viewsDesktop ?? 0,
      clicksMobile: m.clicksMobile ?? 0, clicksDesktop: m.clicksDesktop ?? 0,
    }));

    const campaignData = {
      ...campaign,
      metrics: metricsNormalized,
      totals,
      ctr: totals.views > 0 ? ((totals.clicks / totals.views) * 100).toFixed(2) : '0.00',
      clientLogoBase64: dto.clientLogoBase64,
      companyLogoBase64: dto.companyLogoBase64,
      coverColor: dto.coverColor,
    };

    // 2. Desconecta Prisma antes do Puppeteer para liberar conexões
    await this.prisma.$disconnect();

    let pdfUrl: string;
    try {
      // 3. Gera PDF (operação longa)
      pdfUrl = await this.pdf.generate(campaignData);
    } catch (err) {
      // 4. Reconecta e atualiza status
      await this.prisma.$connect();
      await this.prisma.report.update({ where: { id: reportId }, data: { status: 'FAILED' } });
      throw err;
    }

    // 5. Reconecta e salva URL
    await this.prisma.$connect();
    await this.prisma.report.update({ where: { id: reportId }, data: { status: 'DONE', pdfUrl } });
    return { ok: true, pdfUrl, reportId };
  }
}
