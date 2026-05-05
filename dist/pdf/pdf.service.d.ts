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
        viewsMobile: number;
        viewsDesktop: number;
        clicksMobile: number;
        clicksDesktop: number;
    }>;
    prints: Array<{
        date: Date;
        format: string;
        url: string;
    }>;
    clientLogoBase64?: string;
    companyLogoBase64?: string;
    coverColor?: string;
}
export declare class PdfService {
    private readonly logger;
    private supabase;
    generate(campaign: CampaignData): Promise<string>;
    private fmtDate;
    private fmtNum;
    private fmtCtr;
    private groupPrintsByDate;
    private buildChartScript;
    private buildHeader;
    private buildDayPages;
    private buildHtml;
}
