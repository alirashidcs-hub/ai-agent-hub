import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
        variant === "primary" && "bg-brand-gradient text-white hover:opacity-90",
        variant === "secondary" && "bg-panel-solid border border-border text-ink hover:border-border-hover",
        variant === "ghost" && "text-ink-mid hover:text-ink hover:bg-white/5",
        variant === "danger" && "bg-brand-red/10 text-brand-red hover:bg-brand-red/20",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
