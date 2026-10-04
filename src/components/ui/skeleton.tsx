import React from "react";
import clsx from "clsx";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "rounded-xl skeleton-shimmer border border-white/5",
        className
      )}
      {...props}
    />
  );
}
