import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    private jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    register(email: string, name: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            plan: string;
        };
    }>;
    login(email: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            plan: string;
        };
    }>;
    me(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        plan: import(".prisma/client").$Enums.Plan;
        createdAt: Date;
    }>;
    private signToken;
}
