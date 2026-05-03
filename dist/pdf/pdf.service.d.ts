export interface CampaignData {
    id: string;
    name: string;
    pi: string;
    client: string;
    agency: string;
    city: string;
    startDate: Date;
    endDate: Date;
    totals: {
        views: number;
        clicks: number;
    };
    ctr: string;
    metrics: Array<{
        date: Date;
        views: number;
        clicks: number;
        ctr: number;
    }>;
    prints: Array<{
        date: Date;
        format: string;
        url: string;
    }>;
}
export declare class PdfService {
    private readonly logger;
    private supabase;
    generate(campaign: CampaignData): Promise<string>;
    private formatDate;
    private formatNum;
    private groupPrintsByDate;
    private buildChartDataScript;
    private buildDayPages;
    private buildHtml;
}
