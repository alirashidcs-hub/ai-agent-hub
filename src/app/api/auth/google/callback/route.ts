import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";

function fail(req: NextRequest, reason: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete("oas_oauth_state");
  return res;
}

// Step 2: validate CSRF state, exchange the authorization code for tokens,
// fetch the user's verified profile, and create/find the local User record.
export async function GET(req: NextRequest) {
  // Google redirects here with `?error=access_denied` (etc.) if the user
  // cancels consent, or on other provider-side failures — surface these
  // as a generic login error rather than proceeding.
  const providerError = req.nextUrl.searchParams.get("error");
  if (providerError) return fail(req, "oauth_denied");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("oas_oauth_state")?.value;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!code || !clientId || !clientSecret || !redirectUri) return fail(req, "oauth_config");
  if (!state || !expectedState || state !== expectedState) return fail(req, "oauth_state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail(req, "oauth_token_exchange");
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return fail(req, "oauth_token_exchange");

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return fail(req, "oauth_profile");
  const profile = await profileRes.json();

  if (!profile.email) return fail(req, "oauth_profile");
  // Reject unverified emails — otherwise anyone who controls an unverified
  // address at a third-party provider could sign in as that email here.
  if (profile.email_verified !== true) return fail(req, "oauth_email_unverified");

  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: { googleId: profile.sub, image: profile.picture, name: profile.name },
    create: { email: profile.email, googleId: profile.sub, image: profile.picture, name: profile.name },
  });

  await createSession({ userId: user.id, email: user.email, name: user.name });
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.delete("oas_oauth_state");
  return res;
}
