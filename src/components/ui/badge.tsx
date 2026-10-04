import React from "react";
import clsx from "clsx";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "like"
    | "pass"
    | "danger"
    | "warning"
    | "outline"
    | "muted";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    primary: "bg-primary/15 text-primary border border-primary/30",
    secondary: "bg-secondary/15 text-secondary border border-secondary/30",
    accent: "bg-like/15 text-like border border-like/30",
    like: "bg-like/15 text-like border border-like/30",
    pass: "bg-pass-bg text-pass border border-pass/30",
    danger: "bg-danger/15 text-danger border border-danger/30",
    warning: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
    outline: "border border-border text-foreground bg-surface-elevated",
    muted: "bg-surface-elevated text-muted border border-border",
  };

  const sizes = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <div
      className={clsx(
        "inline-flex items-center font-medium rounded-full tracking-wide transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
