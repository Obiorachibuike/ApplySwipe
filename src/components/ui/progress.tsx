import React from "react";
import clsx from "clsx";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  indicatorColor?: string;
}

export function Progress({
  value,
  indicatorColor = "bg-primary",
  className,
  ...props
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div
      className={clsx(
        "relative h-2 w-full overflow-hidden rounded-full bg-surface-elevated border border-border/40",
        className
      )}
      {...props}
    >
      <div
        className={clsx("h-full transition-all duration-500 ease-out", indicatorColor)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
