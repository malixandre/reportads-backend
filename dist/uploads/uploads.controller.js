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
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const uploads_service_1 = require("./uploads.service");
const campaigns_service_1 = require("../campaigns/campaigns.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const client_1 = require("@prisma/client");
let UploadsController = class UploadsController {
    constructor(uploads, campaigns) {
        this.uploads = uploads;
        this.campaigns = campaigns;
    }
    async uploadPrint(req, campaignId, file, date, format) {
        const result = await this.uploads.uploadPrint(file, req.user.sub, campaignId);
        const print = await this.campaigns.addPrint(req.user.sub, campaignId, date, format, result.url, result.filename, result.sizeBytes);
        return print;
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('campaigns/:campaignId/prints'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: (0, multer_1.memoryStorage)() })),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('campaignId')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)('date')),
    __param(4, (0, common_1.Body)('format')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "uploadPrint", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.Controller)('uploads'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService,
        campaigns_service_1.CampaignsService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map