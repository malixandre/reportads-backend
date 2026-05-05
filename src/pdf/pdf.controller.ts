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

    try {
      const pdfUrl = await this.pdf.generate({
        ...campaign,
        totals,
        ctr: totals.views > 0 ? ((totals.clicks / totals.views) * 100).toFixed(2) : '0.00',
        clientLogoBase64: dto.clientLogoBase64,
        companyLogoBase64: dto.companyLogoBase64,
        coverColor: dto.coverColor,
      });
      await this.prisma.report.update({ where: { id: report.id }, data: { status: 'DONE', pdfUrl } });
      return { ok: true, pdfUrl, reportId: report.id };
    } catch (err) {
      await this.prisma.report.update({ where: { id: report.id }, data: { status: 'FAILED' } });
      throw err;
    }
  }
}
