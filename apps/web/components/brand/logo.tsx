import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-bold tracking-tight",
        className,
      )}
    >
      <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl shadow-sm">
        <svg
          viewBox="0 0 36 36"
          className="size-6"
          aria-hidden="true"
          fill="none"
        >
          <circle cx="18" cy="18" r="8" fill="currentColor" />
          <circle cx="18" cy="18" r="4.75" className="fill-primary" />
          <path
            d="M7.5 15.25A11.1 11.1 0 0 1 23.8 7.9"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="m23.1 5.75 3.25 3.7-4.8.65Z" fill="currentColor" />
          <path
            d="M28.5 20.75A11.1 11.1 0 0 1 12.2 28.1"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="m12.9 30.25-3.25-3.7 4.8-.65Z" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span className="text-lg">RestroFlow</span>}
    </span>
  );
}
