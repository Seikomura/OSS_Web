import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PortalError } from "./validation.js";
export function configuration() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY } =
    process.env;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SECRET_KEY)
    throw new PortalError(
      "ระบบยังตั้งค่าการเชื่อมต่อไม่ครบ กรุณาติดต่อผู้ดูแล",
      503,
    );
  return {
    url: SUPABASE_URL,
    key: SUPABASE_PUBLISHABLE_KEY,
    secret: SUPABASE_SECRET_KEY,
  };
}
export function userClient(req, res) {
  const config = configuration();
  const secure =
    process.env.VERCEL === "1" || req.headers["x-forwarded-proto"] === "https";
  return createServerClient(config.url, config.key, {
    cookieOptions: { path: "/", httpOnly: true, sameSite: "lax", secure },
    cookies: {
      getAll() {
        return (req.headers.cookie || "")
          .split(";")
          .map((item) => {
            const index = item.indexOf("=");
            return index < 0
              ? null
              : {
                  name: item.slice(0, index).trim(),
                  value: decodeURIComponent(item.slice(index + 1)),
                };
          })
          .filter(Boolean);
      },
      setAll(cookies) {
        const previous = res.getHeader("Set-Cookie") || [];
        res.setHeader("Set-Cookie", [
          ...(Array.isArray(previous) ? previous : [previous]),
          ...cookies.map(
            ({ name, value, options }) =>
              `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}${options.maxAge != null ? `; Max-Age=${options.maxAge}` : ""}`,
          ),
        ]);
      },
    },
  });
}
export function serviceClient() {
  const config = configuration();
  return createClient(config.url, config.secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
