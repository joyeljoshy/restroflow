import type { MenuCategory } from "@restroflow/contracts";

import { cn } from "@/lib/utils";

export function MenuCategoryList({
  categories,
  selectedId,
  onSelect,
}: {
  categories: MenuCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="tablist"
      aria-label="Menu categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedId === null}
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
          selectedId === null
            ? "bg-primary text-primary-foreground"
            : "bg-card hover:bg-muted",
        )}
      >
        All items
      </button>
      {categories
        .filter((category) => category.isActive)
        .map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={selectedId === category.id}
            onClick={() => onSelect(category.id)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
              selectedId === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {category.name}
          </button>
        ))}
    </div>
  );
}
