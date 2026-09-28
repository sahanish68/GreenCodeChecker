import { Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30 transition-colors group-hover:bg-primary/25">
        <Leaf className="size-4" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">GreenCode</span>
    </Link>
  );
}

export function EstimateBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-warning">
      Estimated impact
    </span>
  );
}
