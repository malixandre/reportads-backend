import {
  Controller, Post, UseGuards, UseInterceptors,
  UploadedFile, Body, Request, Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrintFormat } from '@prisma/client';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    private uploads: UploadsService,
    private campaigns: CampaignsService,
  ) {}

  @Post('campaigns/:campaignId/prints')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadPrint(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('date') date: string,
    @Body('format') format: PrintFormat,
  ) {
    const result = await this.uploads.uploadPrint(file, req.user.sub, campaignId);

    const print = await this.campaigns.addPrint(
      req.user.sub,
      campaignId,
      date,
      format,
      result.url,
      result.filename,
      result.sizeBytes,
    );

    return print;
  }
}
