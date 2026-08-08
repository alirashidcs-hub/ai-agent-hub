"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
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
      <h1 className="text-lg font-medium mb-1">Create your account</h1>
      <p className="text-sm text-ink-mid mb-6">Free, open-source, self-hosted.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        {error && <p className="text-xs text-brand-red">{error}</p>}
        <Button type="submit" variant="primary" disabled={loading}>{loading ? "Creating account…" : "Create account"}</Button>
      </form>

      <p className="text-xs text-ink-faint mt-6 text-center">
        Already have an account? <Link href="/login" className="text-indigo">Sign in</Link>
      </p>
    </div>
  );
}
