import type { MenuItem } from "@restroflow/contracts";
import { Leaf } from "lucide-react";

import { AvailabilityBadge } from "./availability-badge";
import { MenuItemImage } from "./menu-item-image";
import { PriceDisplay } from "./price-display";
import { cn } from "@/lib/utils";

export function MenuItemCard({
  item,
  currency = "INR",
  actions,
}: {
  item: MenuItem;
  currency?: string;
  actions?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "bg-card overflow-hidden rounded-2xl border shadow-sm",
        !item.isActive && "opacity-70",
      )}
    >
      <MenuItemImage
        imageUrl={item.imageUrl}
        alt={item.name}
        className="aspect-[16/10] w-full"
      />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              {item.category.name}
            </p>
            <h2 className="mt-1 truncate font-bold">{item.name}</h2>
          </div>
          {item.isVegetarian && (
            <Leaf
              className="size-5 shrink-0 text-emerald-600"
              aria-label="Vegetarian"
            />
          )}
        </div>
        <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm leading-5">
          {item.description || "No description provided."}
        </p>
        <div className="flex items-center justify-between gap-3">
          <PriceDisplay
            amountMinor={item.priceMinor}
            currency={currency}
            className="font-bold"
          />
          <AvailabilityBadge available={item.isEffectivelyAvailable} />
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 border-t pt-3">{actions}</div>
        )}
      </div>
    </article>
  );
}
