import type { MenuItem } from "@restroflow/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AvailabilityBadge } from "./availability-badge";
import { MenuItemCard } from "./menu-item-card";
import { menuItemFormSchema } from "./menu-item-form";
import { PriceDisplay } from "./price-display";

const item: MenuItem = {
  id: "10000000-0000-4000-8000-000000000001",
  categoryId: "10000000-0000-4000-8000-000000000002",
  name: "Paneer Bowl",
  description: "Charred paneer and rice",
  priceMinor: 12900,
  imageUrl: null,
  isAvailable: true,
  isEffectivelyAvailable: true,
  isVegetarian: true,
  isActive: true,
  sortOrder: 0,
  category: {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Mains",
    description: null,
    sortOrder: 0,
    isActive: true,
    createdAt: "2026-11-18T10:00:00.000Z",
    updatedAt: "2026-11-18T10:00:00.000Z",
  },
  modifierGroups: [],
  createdAt: "2026-11-18T10:00:00.000Z",
  updatedAt: "2026-11-18T10:00:00.000Z",
};

describe("menu presentation", () => {
  it("formats integer minor units as currency", () => {
    expect(
      renderToStaticMarkup(
        createElement(PriceDisplay, { amountMinor: 12900, currency: "INR" }),
      ),
    ).toContain("129.00");
  });

  it("renders availability indicators", () => {
    expect(
      renderToStaticMarkup(
        createElement(AvailabilityBadge, { available: false }),
      ),
    ).toContain("Unavailable");
  });

  it("presents item details and vegetarian status", () => {
    const markup = renderToStaticMarkup(createElement(MenuItemCard, { item }));
    expect(markup).toContain("Paneer Bowl");
    expect(markup).toContain("Vegetarian");
  });

  it("validates form price precision and required category", () => {
    expect(
      menuItemFormSchema.safeParse({
        categoryId: "",
        name: "Soup",
        description: "",
        price: "12.999",
        imageUrl: "",
        sortOrder: 0,
        isAvailable: true,
        isVegetarian: true,
        isActive: true,
      }).success,
    ).toBe(false);
  });
});
