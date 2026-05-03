"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_js_1 = require("@supabase/supabase-js");
const sharp = require("sharp");
let UploadsService = class UploadsService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        this.BUCKET = 'prints';
        this.MAX_BYTES = 5 * 1024 * 1024;
        this.ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    }
    async uploadPrint(file, userId, campaignId) {
        if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Formato inválido. Use JPG, PNG ou WEBP');
        }
        if (file.size > this.MAX_BYTES) {
            throw new common_1.BadRequestException('Arquivo muito grande. Máximo 5MB');
        }
        const compressed = await sharp(file.buffer)
            .resize({ width: 1920, withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        const filename = `${userId}/${campaignId}/${Date.now()}.jpg`;
        const { error } = await this.supabase.storage
            .from(this.BUCKET)
            .upload(filename, compressed, {
            contentType: 'image/jpeg',
            upsert: false,
        });
        if (error)
            throw new common_1.BadRequestException('Erro ao fazer upload: ' + error.message);
        const { data } = this.supabase.storage
            .from(this.BUCKET)
            .getPublicUrl(filename);
        return {
            url: data.publicUrl,
            filename,
            sizeBytes: compressed.length,
        };
    }
    async deletePrint(filename) {
        await this.supabase.storage.from(this.BUCKET).remove([filename]);
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)()
], UploadsService);
//# sourceMappingURL=uploads.service.js.map