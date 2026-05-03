export declare class UploadsService {
    private supabase;
    private readonly BUCKET;
    private readonly MAX_BYTES;
    private readonly ALLOWED_TYPES;
    uploadPrint(file: Express.Multer.File, userId: string, campaignId: string): Promise<{
        url: string;
        filename: string;
        sizeBytes: number;
    }>;
    deletePrint(filename: string): Promise<void>;
}
