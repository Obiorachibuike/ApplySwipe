import React from "react";
import clsx from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "apply"
    | "pass"
    | "outline"
    | "ghost"
    | "danger"
    | "accent"
    | "icon";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // Easing: cubic-bezier(0.22, 1, 0.36, 1) with 180ms timing
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium rounded-xl select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-180 ease-applyswipe active:scale-[0.97]";

    const variants = {
      primary:
        "bg-[#6366F1] text-white hover:bg-[#5558E6] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(99,102,241,0.25)] focus-visible:ring-[#6366F1] active:translate-y-0",
      apply:
        "btn-sweep-container bg-[#22C55E] text-white hover:bg-[#1eb354] hover:-translate-y-[2px] hover:shadow-[0_8px_28px_rgba(34,197,94,0.28)] focus-visible:ring-[#22C55E] active:translate-y-0 font-semibold",
      pass:
        "bg-[#FB7185]/15 border border-[#FB7185]/30 text-[#FB7185] hover:bg-[#FB7185]/25 hover:border-[#FB7185]/60 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(251,113,133,0.25)] focus-visible:ring-[#FB7185] active:translate-y-0 font-semibold",
      secondary:
        "bg-surface-elevated text-foreground hover:bg-[#1E293B] hover:text-white border border-border hover:border-white/20 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] focus-visible:ring-secondary active:translate-y-0",
      outline:
        "border border-border text-foreground hover:bg-white/5 hover:border-white/20 hover:-translate-y-[1px] focus-visible:ring-primary active:translate-y-0",
      ghost:
        "text-muted hover:text-foreground hover:bg-white/5 hover:scale-[1.02] active:scale-[0.97] focus-visible:ring-white/10",
      danger:
        "bg-danger text-white hover:bg-danger-hover hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(239,68,68,0.3)] focus-visible:ring-danger active:translate-y-0",
      accent:
        "bg-accent text-white hover:bg-accent-hover hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(34,197,94,0.25)] focus-visible:ring-accent active:translate-y-0",
      icon:
        "p-2 text-muted hover:text-foreground hover:bg-white/10 hover:scale-[1.05] active:scale-[0.95] rounded-lg transition-transform",
    };

    const sizes = {
      sm: "text-xs px-3 py-1.5 h-8 gap-1.5",
      md: "text-sm px-4 py-2 h-10 gap-2",
      lg: "text-base px-6 py-2.5 h-12 gap-2.5 font-semibold",
      icon: "h-9 w-9 p-0 flex items-center justify-center hover:scale-[1.05] active:scale-[0.95]",
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin -ml-0.5 h-4 w-4 text-current shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="truncate">Loading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
