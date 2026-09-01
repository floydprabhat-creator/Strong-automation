import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover border border-transparent shadow-card",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost:
    "bg-transparent text-ink-muted border border-transparent hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-transparent text-danger border border-danger/40 hover:bg-danger-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export const buttonStyles = ({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) =>
  cn(
    "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap",
    "transition-colors disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonStyles({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}
