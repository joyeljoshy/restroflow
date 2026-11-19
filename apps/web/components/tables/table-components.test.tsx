import type { RestaurantTable } from "@restroflow/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TableCard } from "./table-card";
import { TableStatusBadge } from "./table-status-badge";

const table: RestaurantTable = {
  id: "10000000-0000-4000-8000-000000000001",
  tableNumber: "T1",
  displayName: "Window table",
  capacity: 4,
  isActive: true,
  occupancy: "AVAILABLE",
  activeSession: null,
  createdAt: "2026-11-19T09:00:00.000Z",
  updatedAt: "2026-11-19T09:00:00.000Z",
};

describe("table presentation", () => {
  it("renders table identity, capacity, and availability", () => {
    const markup = renderToStaticMarkup(createElement(TableCard, { table }));
    expect(markup).toContain("Window table");
    expect(markup).toContain("Seats 4");
    expect(markup).toContain("Available");
  });

  it("renders all occupancy labels", () => {
    expect(
      renderToStaticMarkup(
        createElement(TableStatusBadge, { occupancy: "OCCUPIED" }),
      ),
    ).toContain("Occupied");
    expect(
      renderToStaticMarkup(
        createElement(TableStatusBadge, { occupancy: "OUT_OF_SERVICE" }),
      ),
    ).toContain("Out of service");
  });
});
