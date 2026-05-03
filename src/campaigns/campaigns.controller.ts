import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, UseGuards, Request, HttpCode,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString, IsDateString, IsArray, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { PrintFormat } from '@prisma/client';

class CreateCampaignDto {
  @IsString() name: string;
  @IsString() pi: string;
  @IsString() client: string;
  @IsString() agency: string;
  @IsString() city: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

class MetricItemDto {
  @IsDateString() date: string;
  @IsNumber() views: number;
  @IsNumber() clicks: number;
}

class UpsertMetricsDto {
  @IsArray() metrics: MetricItemDto[];
}

class AddPrintDto {
  @IsDateString() date: string;
  @IsEnum(PrintFormat) format: PrintFormat;
  @IsString() url: string;
  @IsString() filename: string;
  @IsNumber() sizeBytes: number;
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private svc: CampaignsService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateCampaignDto) {
    return this.svc.create(req.user.sub, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.svc.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.svc.findOne(req.user.sub, id);
  }

  @Put(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    return this.svc.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Request() req, @Param('id') id: string) {
    return this.svc.remove(req.user.sub, id);
  }

  @Post(':id/metrics')
  upsertMetrics(@Request() req, @Param('id') id: string, @Body() dto: UpsertMetricsDto) {
    return this.svc.upsertMetrics(req.user.sub, id, dto);
  }

  @Post(':id/prints')
  addPrint(@Request() req, @Param('id') id: string, @Body() dto: AddPrintDto) {
    return this.svc.addPrint(
      req.user.sub, id, dto.date, dto.format, dto.url, dto.filename, dto.sizeBytes,
    );
  }

  @Delete(':id/prints/:printId')
  @HttpCode(204)
  removePrint(@Request() req, @Param('printId') printId: string) {
    return this.svc.removePrint(req.user.sub, printId);
  }
}
