import { CampaignsService } from './campaigns.service';
import { PrintFormat } from '@prisma/client';
declare class CreateCampaignDto {
    name: string;
    pi: string;
    client: string;
    agency: string;
    city: string;
    startDate: string;
    endDate: string;
}
declare class MetricItemDto {
    date: string;
    views: number;
    clicks: number;
}
declare class UpsertMetricsDto {
    metrics: MetricItemDto[];
}
declare class AddPrintDto {
    date: string;
    format: PrintFormat;
    url: string;
    filename: string;
    sizeBytes: number;
}
export declare class CampaignsController {
    private svc;
    constructor(svc: CampaignsService);
    create(req: any, dto: CreateCampaignDto): Promise<{
        id: string;
        name: string;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    }>;
    findAll(req: any): Promise<({
        metrics: {
            views: number;
            clicks: number;
        }[];
        _count: {
            metrics: number;
            prints: number;
        };
    } & {
        id: string;
        name: string;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    })[]>;
    findOne(req: any, id: string): Promise<{
        totals: {
            views: number;
            clicks: number;
        };
        ctr: string;
        metrics: {
            id: string;
            createdAt: Date;
            campaignId: string;
            date: Date;
            views: number;
            clicks: number;
            ctr: number;
        }[];
        prints: {
            id: string;
            createdAt: Date;
            campaignId: string;
            date: Date;
            format: import(".prisma/client").$Enums.PrintFormat;
            url: string;
            filename: string;
            sizeBytes: number;
        }[];
        reports: {
            id: string;
            status: import(".prisma/client").$Enums.ReportStatus;
            createdAt: Date;
            campaignId: string;
            pdfUrl: string | null;
        }[];
        id: string;
        name: string;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    }>;
    update(req: any, id: string, dto: Partial<CreateCampaignDto>): Promise<{
        id: string;
        name: string;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    }>;
    remove(req: any, id: string): Promise<{
        ok: boolean;
    }>;
    upsertMetrics(req: any, id: string, dto: UpsertMetricsDto): Promise<{
        ok: boolean;
        count: number;
    }>;
    addPrint(req: any, id: string, dto: AddPrintDto): Promise<{
        id: string;
        createdAt: Date;
        campaignId: string;
        date: Date;
        format: import(".prisma/client").$Enums.PrintFormat;
        url: string;
        filename: string;
        sizeBytes: number;
    }>;
    removePrint(req: any, printId: string): Promise<{
        ok: boolean;
    }>;
}
export {};
