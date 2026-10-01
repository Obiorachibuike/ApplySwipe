import React from "react";
import clsx from "clsx";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary" | "accent" | "danger" | "warning" | "outline" | "muted";
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
    accent: "bg-accent/15 text-accent border border-accent/30",
    danger: "bg-danger/15 text-danger border border-danger/30",
    warning: "bg-warning/15 text-amber-400 border border-amber-400/30",
    outline: "border border-border text-foreground bg-white/5",
    muted: "bg-white/5 text-muted border border-white/10",
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
