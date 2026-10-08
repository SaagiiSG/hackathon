import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MOCK_DATA } from "@/lib/mode";

// Routes that require a signed-in user. Everything else is public.
const PROTECTED = ["/town"];

export async function updateSession(request: NextRequest) {
  // Mock mode has no Supabase: skip auth and send sign-in straight to the demo town.
  if (MOCK_DATA) {
    if (request.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/town", request.url));
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not put code between createServerClient and getClaims(): it refreshes
  // the session, and skipping it logs users out at random.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/town";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
