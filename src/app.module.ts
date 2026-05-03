import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { UploadsModule } from './uploads/uploads.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CampaignsModule,
    UploadsModule,
    PdfModule,
  ],
})
export class AppModule {}
