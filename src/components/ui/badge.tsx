import { clsx } from "clsx";

const colors: Record<string, string> = {
  success: "text-brand-green bg-brand-green/10",
  error: "text-brand-red bg-brand-red/10",
  warning: "text-brand-amber bg-brand-amber/10",
  neutral: "text-ink-mid bg-white/5",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof colors; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium", colors[tone])}>{children}</span>;
}
