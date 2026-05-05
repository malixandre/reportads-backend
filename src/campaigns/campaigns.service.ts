import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrintFormat } from '@prisma/client';

interface CreateCampaignDto {
  name: string; pi: string; client: string; agency: string; city: string;
  startDate: string; endDate: string;
}

interface MetricItemDto {
  date: string; views: number; clicks: number;
  viewsMobile?: number; viewsDesktop?: number;
  clicksMobile?: number; clicksDesktop?: number;
}

interface UpsertMetricsDto { metrics: MetricItemDto[]; }

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({ data: { userId, ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) } });
  }

  async findAll(userId: string) {
    return this.prisma.campaign.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' },
      include: { _count: { select: { metrics: true, prints: true } }, metrics: { select: { views: true, clicks: true } } },
    });
  }

  async findOne(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { metrics: { orderBy: { date: 'asc' } }, prints: { orderBy: { date: 'asc' } }, reports: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada');
    if (campaign.userId !== userId) throw new ForbiddenException();
    const totals = campaign.metrics.reduce((acc, m) => { acc.views += m.views; acc.clicks += m.clicks; return acc; }, { views: 0, clicks: 0 });
    return { ...campaign, totals, ctr: totals.views > 0 ? ((totals.clicks / totals.views) * 100).toFixed(2) : '0.00' };
  }

  async update(userId: string, id: string, dto: Partial<CreateCampaignDto>) {
    await this.assertOwner(userId, id);
    return this.prisma.campaign.update({ where: { id }, data: {
      ...(dto.name && { name: dto.name }), ...(dto.pi && { pi: dto.pi }),
      ...(dto.client && { client: dto.client }), ...(dto.agency && { agency: dto.agency }),
      ...(dto.city && { city: dto.city }),
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
    }});
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  async upsertMetrics(userId: string, campaignId: string, dto: UpsertMetricsDto) {
    await this.assertOwner(userId, campaignId);
    const ops = dto.metrics.map((m) => {
      const date = new Date(m.date);
      const ctr = m.views > 0 ? (m.clicks / m.views) * 100 : 0;
      const viewsMobile = m.viewsMobile ?? 0;
      const viewsDesktop = m.viewsDesktop ?? 0;
      const clicksMobile = m.clicksMobile ?? 0;
      const clicksDesktop = m.clicksDesktop ?? 0;
      return (this.prisma.dayMetric as any).upsert({
        where: { campaignId_date: { campaignId, date } },
        create: { campaignId, date, views: m.views, clicks: m.clicks, ctr, viewsMobile, viewsDesktop, clicksMobile, clicksDesktop },
        update: { views: m.views, clicks: m.clicks, ctr, viewsMobile, viewsDesktop, clicksMobile, clicksDesktop },
      });
    });
    await this.prisma.$transaction(ops);
    return { ok: true, count: ops.length };
  }

  async addPrint(userId: string, campaignId: string, date: string, format: PrintFormat, url: string, filename: string, sizeBytes: number) {
    await this.assertOwner(userId, campaignId);
    return this.prisma.print.create({ data: { campaignId, date: new Date(date), format, url, filename, sizeBytes } });
  }

  async removePrint(userId: string, printId: string) {
    const print = await this.prisma.print.findUnique({ where: { id: printId }, include: { campaign: true } });
    if (!print) throw new NotFoundException('Print não encontrado');
    if (print.campaign.userId !== userId) throw new ForbiddenException();
    await this.prisma.print.delete({ where: { id: printId } });
    return { ok: true };
  }

  private async assertOwner(userId: string, campaignId: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!c) throw new NotFoundException('Campanha não encontrada');
    if (c.userId !== userId) throw new ForbiddenException();
    return c;
  }
}
