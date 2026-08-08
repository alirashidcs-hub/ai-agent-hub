import { clsx } from "clsx";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink placeholder:text-ink-faint outline-none focus:border-indigo",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        "w-full px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink placeholder:text-ink-faint outline-none focus:border-indigo resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
