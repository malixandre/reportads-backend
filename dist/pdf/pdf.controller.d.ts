import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class PdfController {
    private pdf;
    private prisma;
    constructor(pdf: PdfService, prisma: PrismaService);
    generate(req: any, id: string): Promise<{
        ok: boolean;
        pdfUrl: string;
        reportId: string;
    }>;
}
