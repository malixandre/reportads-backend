"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CampaignsService = class CampaignsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        return this.prisma.campaign.create({
            data: {
                userId,
                name: dto.name,
                pi: dto.pi,
                client: dto.client,
                agency: dto.agency,
                city: dto.city,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
            },
        });
    }
    async findAll(userId) {
        return this.prisma.campaign.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { metrics: true, prints: true } },
                metrics: {
                    select: { views: true, clicks: true },
                },
            },
        });
    }
    async findOne(userId, id) {
        const campaign = await this.prisma.campaign.findUnique({
            where: { id },
            include: {
                metrics: { orderBy: { date: 'asc' } },
                prints: { orderBy: { date: 'asc' } },
                reports: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
        });
        if (!campaign)
            throw new common_1.NotFoundException('Campanha não encontrada');
        if (campaign.userId !== userId)
            throw new common_1.ForbiddenException();
        const totals = campaign.metrics.reduce((acc, m) => {
            acc.views += m.views;
            acc.clicks += m.clicks;
            return acc;
        }, { views: 0, clicks: 0 });
        return {
            ...campaign,
            totals,
            ctr: totals.views > 0 ? ((totals.clicks / totals.views) * 100).toFixed(2) : '0.00',
        };
    }
    async update(userId, id, dto) {
        await this.assertOwner(userId, id);
        return this.prisma.campaign.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.pi && { pi: dto.pi }),
                ...(dto.client && { client: dto.client }),
                ...(dto.agency && { agency: dto.agency }),
                ...(dto.city && { city: dto.city }),
                ...(dto.startDate && { startDate: new Date(dto.startDate) }),
                ...(dto.endDate && { endDate: new Date(dto.endDate) }),
            },
        });
    }
    async remove(userId, id) {
        await this.assertOwner(userId, id);
        await this.prisma.campaign.delete({ where: { id } });
        return { ok: true };
    }
    async upsertMetrics(userId, campaignId, dto) {
        await this.assertOwner(userId, campaignId);
        const ops = dto.metrics.map((m) => {
            const date = new Date(m.date);
            const ctr = m.views > 0 ? (m.clicks / m.views) * 100 : 0;
            return this.prisma.dayMetric.upsert({
                where: { campaignId_date: { campaignId, date } },
                create: { campaignId, date, views: m.views, clicks: m.clicks, ctr },
                update: { views: m.views, clicks: m.clicks, ctr },
            });
        });
        await this.prisma.$transaction(ops);
        return { ok: true, count: ops.length };
    }
    async addPrint(userId, campaignId, date, format, url, filename, sizeBytes) {
        await this.assertOwner(userId, campaignId);
        return this.prisma.print.create({
            data: {
                campaignId,
                date: new Date(date),
                format,
                url,
                filename,
                sizeBytes,
            },
        });
    }
    async removePrint(userId, printId) {
        const print = await this.prisma.print.findUnique({
            where: { id: printId },
            include: { campaign: true },
        });
        if (!print)
            throw new common_1.NotFoundException('Print não encontrado');
        if (print.campaign.userId !== userId)
            throw new common_1.ForbiddenException();
        await this.prisma.print.delete({ where: { id: printId } });
        return { ok: true };
    }
    async assertOwner(userId, campaignId) {
        const c = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!c)
            throw new common_1.NotFoundException('Campanha não encontrada');
        if (c.userId !== userId)
            throw new common_1.ForbiddenException();
        return c;
    }
};
exports.CampaignsService = CampaignsService;
exports.CampaignsService = CampaignsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CampaignsService);
//# sourceMappingURL=campaigns.service.js.map