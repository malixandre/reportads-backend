import { UploadsService } from './uploads.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { PrintFormat } from '@prisma/client';
export declare class UploadsController {
    private uploads;
    private campaigns;
    constructor(uploads: UploadsService, campaigns: CampaignsService);
    uploadPrint(req: any, campaignId: string, file: Express.Multer.File, date: string, format: PrintFormat): Promise<{
        id: string;
        createdAt: Date;
        campaignId: string;
        date: Date;
        format: import(".prisma/client").$Enums.PrintFormat;
        url: string;
        filename: string;
        sizeBytes: number;
    }>;
}
