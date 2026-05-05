import { PrismaService } from '../prisma/prisma.service';
import { PrintFormat } from '@prisma/client';
interface CreateCampaignDto {
    name: string;
    pi: string;
    client: string;
    agency: string;
    city: string;
    startDate: string;
    endDate: string;
}
interface MetricItemDto {
    date: string;
    views: number;
    clicks: number;
    viewsMobile?: number;
    viewsDesktop?: number;
    clicksMobile?: number;
    clicksDesktop?: number;
}
interface UpsertMetricsDto {
    metrics: MetricItemDto[];
}
export declare class CampaignsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateCampaignDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        updatedAt: Date;
        userId: string;
    }>;
    findAll(userId: string): Promise<({
        _count: {
            metrics: number;
            prints: number;
        };
        metrics: {
            views: number;
            clicks: number;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        updatedAt: Date;
        userId: string;
    })[]>;
    findOne(userId: string, id: string): Promise<{
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
            createdAt: Date;
            status: import(".prisma/client").$Enums.ReportStatus;
            campaignId: string;
            pdfUrl: string | null;
        }[];
        id: string;
        name: string;
        createdAt: Date;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        updatedAt: Date;
        userId: string;
    }>;
    update(userId: string, id: string, dto: Partial<CreateCampaignDto>): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        pi: string;
        client: string;
        agency: string;
        city: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
        updatedAt: Date;
        userId: string;
    }>;
    remove(userId: string, id: string): Promise<{
        ok: boolean;
    }>;
    upsertMetrics(userId: string, campaignId: string, dto: UpsertMetricsDto): Promise<{
        ok: boolean;
        count: number;
    }>;
    addPrint(userId: string, campaignId: string, date: string, format: PrintFormat, url: string, filename: string, sizeBytes: number): Promise<{
        id: string;
        createdAt: Date;
        campaignId: string;
        date: Date;
        format: import(".prisma/client").$Enums.PrintFormat;
        url: string;
        filename: string;
        sizeBytes: number;
    }>;
    removePrint(userId: string, printId: string): Promise<{
        ok: boolean;
    }>;
    private assertOwner;
}
export {};
