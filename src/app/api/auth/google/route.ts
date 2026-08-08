import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// Step 1 of the Google OAuth "authorization code" flow: redirect the
// browser to Google's consent screen. Requires GOOGLE_CLIENT_ID and
// GOOGLE_REDIRECT_URI (e.g. https://yourapp.com/api/auth/google/callback,
// registered exactly in the Google Cloud Console) to be set in .env.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth is not configured on this server." }, { status: 500 });
  }

  // CSRF protection: a random state value is stored in a short-lived,
  // httpOnly cookie and must match the `state` query param Google sends
  // back to the callback route.
  const state = crypto.randomBytes(24).toString("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("oas_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
