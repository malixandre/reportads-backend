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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfController = void 0;
const common_1 = require("@nestjs/common");
const pdf_service_1 = require("./pdf.service");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let PdfController = class PdfController {
    constructor(pdf, prisma) {
        this.pdf = pdf;
        this.prisma = prisma;
    }
    async generate(req, id) {
        const campaign = await this.prisma.campaign.findUnique({
            where: { id },
            include: {
                metrics: { orderBy: { date: 'asc' } },
                prints: { orderBy: { date: 'asc' } },
            },
        });
        if (!campaign)
            throw new common_1.NotFoundException('Campanha não encontrada');
        if (campaign.userId !== req.user.sub)
            throw new common_1.NotFoundException();
        const totals = campaign.metrics.reduce((acc, m) => { acc.views += m.views; acc.clicks += m.clicks; return acc; }, { views: 0, clicks: 0 });
        const report = await this.prisma.report.create({
            data: { campaignId: id, status: 'GENERATING' },
        });
        try {
            const pdfUrl = await this.pdf.generate({
                ...campaign,
                totals,
                ctr: totals.views > 0 ? ((totals.clicks / totals.views) * 100).toFixed(2) : '0.00',
            });
            await this.prisma.report.update({
                where: { id: report.id },
                data: { status: 'DONE', pdfUrl },
            });
            return { ok: true, pdfUrl, reportId: report.id };
        }
        catch (err) {
            await this.prisma.report.update({
                where: { id: report.id },
                data: { status: 'FAILED' },
            });
            throw err;
        }
    }
};
exports.PdfController = PdfController;
__decorate([
    (0, common_1.Post)(':id/generate-pdf'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PdfController.prototype, "generate", null);
exports.PdfController = PdfController = __decorate([
    (0, common_1.Controller)('campaigns'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [pdf_service_1.PdfService,
        prisma_service_1.PrismaService])
], PdfController);
//# sourceMappingURL=pdf.controller.js.map