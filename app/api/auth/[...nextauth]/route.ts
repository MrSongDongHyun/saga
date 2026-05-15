// NextAuth v5 Route Handler
// handlers 객체에서 GET, POST를 구조분해하여 export
import { handlers } from "@/lib/auth";

export const GET = handlers.GET;
export const POST = handlers.POST;
