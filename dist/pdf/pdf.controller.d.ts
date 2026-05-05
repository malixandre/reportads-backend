import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
declare class GeneratePdfDto {
    clientLogoBase64?: string;
    companyLogoBase64?: string;
}
export declare class PdfController {
    private pdf;
    private prisma;
    constructor(pdf: PdfService, prisma: PrismaService);
    generate(req: any, id: string, dto: GeneratePdfDto): Promise<{
        ok: boolean;
        pdfUrl: string;
        reportId: string;
    }>;
}
export {};
