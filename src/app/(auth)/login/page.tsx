"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Google sign-in was cancelled.",
  oauth_state: "Your sign-in session expired. Please try again.",
  oauth_config: "Google sign-in isn't configured on this server.",
  oauth_token_exchange: "Couldn't complete Google sign-in. Please try again.",
  oauth_profile: "Couldn't read your Google profile. Please try again.",
  oauth_email_unverified: "Your Google email isn't verified, so we can't sign you in with it.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthErrorCode = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(oauthErrorCode ? OAUTH_ERROR_MESSAGES[oauthErrorCode] ?? "Sign-in failed." : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="glass rounded-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
          <Sparkles size={14} color="white" />
        </div>
        <span className="font-semibold">Open Agent Studio</span>
      </div>
      <h1 className="text-lg font-medium mb-1">Welcome back</h1>
      <p className="text-sm text-ink-mid mb-6">Sign in to continue building.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-xs text-brand-red">{error}</p>}
        <Button type="submit" variant="primary" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>

      <a href="/api/auth/google" className="mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-ink-mid hover:text-ink">
        Continue with Google
      </a>

      <p className="text-xs text-ink-faint mt-6 text-center">
        No account? <Link href="/register" className="text-indigo">Create one</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
