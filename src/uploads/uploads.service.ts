import { Injectable, BadRequestException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as sharp from 'sharp';

@Injectable()
export class UploadsService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );

  private readonly BUCKET = 'prints';
  private readonly MAX_BYTES = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  async uploadPrint(
    file: Express.Multer.File,
    userId: string,
    campaignId: string,
  ): Promise<{ url: string; filename: string; sizeBytes: number }> {
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use JPG, PNG ou WEBP');
    }

    if (file.size > this.MAX_BYTES) {
      throw new BadRequestException('Arquivo muito grande. Máximo 5MB');
    }

    // Comprime para max 1920px de largura mantendo proporção
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

    if (error) throw new BadRequestException('Erro ao fazer upload: ' + error.message);

    const { data } = this.supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(filename);

    return {
      url: data.publicUrl,
      filename,
      sizeBytes: compressed.length,
    };
  }

  async deletePrint(filename: string) {
    await this.supabase.storage.from(this.BUCKET).remove([filename]);
  }
}
