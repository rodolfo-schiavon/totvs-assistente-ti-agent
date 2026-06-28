import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const apiUrl = process.env.API_URL?.replace(/\/$/, "");
    if (apiUrl) {
      try {
        const backendRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (backendRes.ok) {
          const data = (await backendRes.json()) as {
            token: string;
            user: { id: string; username: string; role: string };
            mustChangePassword?: boolean;
            passwordExpired?: boolean;
            aiNoticeDismissed?: boolean;
          };
          const res = NextResponse.json({
            success: true,
            user: data.user,
            mustChangePassword: data.mustChangePassword,
            passwordExpired: data.passwordExpired,
            aiNoticeDismissed: data.aiNoticeDismissed,
          });
          res.cookies.set(SESSION_COOKIE, data.token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60,
          });
          return res;
        }
        if (isProduction) {
          return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
        }
      } catch {
        if (isProduction) {
          return NextResponse.json({ error: "Serviço de autenticação indisponível." }, { status: 503 });
        }
      }
    }

    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Configuração de autenticação inválida." }, { status: 500 });
  }
}
