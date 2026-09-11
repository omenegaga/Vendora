import { cn } from "@/lib/utils";

/** The Vendora bag-and-V mark. Use this instead of one-off product icons for brand surfaces. */
export function VendoraMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M10 13.5h12l-.8 10H10.8l-.8-10Z" fill="white" fillOpacity=".98" />
      <path d="M12.5 13.5v-1.25a3.5 3.5 0 0 1 7 0v1.25" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m13.35 16.4 2.65 4.35 2.65-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VendoraLogo({ className, showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <VendoraMark className="shrink-0 text-primary" />
      <span className="font-display text-base font-semibold tracking-tight">Vendora</span>
      {showTagline ? <span className="text-xs text-muted-foreground">Commerce</span> : null}
    </div>
  );
}
