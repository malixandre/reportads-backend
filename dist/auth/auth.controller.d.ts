import { AuthService } from './auth.service';
declare class RegisterDto {
    email: string;
    name: string;
    password: string;
}
declare class LoginDto {
    email: string;
    password: string;
}
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            plan: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            plan: string;
        };
    }>;
    me(req: any): Promise<{
        id: string;
        email: string;
        name: string;
        plan: import(".prisma/client").$Enums.Plan;
        createdAt: Date;
    }>;
}
export {};
