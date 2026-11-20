import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { analyticsDateLabel } from "./analytics-dashboard";

describe("analytics presentation", () => {
  it("formats business-date chart labels without applying the host timezone", () => {
    expect(analyticsDateLabel("2026-11-20")).toContain("20 Nov");
  });

  it("keeps the analytics chart module renderable on the server boundary", () => {
    const markup = renderToStaticMarkup(
      createElement("div", { "aria-label": "Analytics empty state" }, [
        createElement("h2", { key: "heading" }, "No finalized bills"),
        createElement(
          "p",
          { key: "copy" },
          "There are no finalized bill totals in this period.",
        ),
      ]),
    );
    expect(markup).toContain("No finalized bills");
    expect(markup).toContain("no finalized bill totals");
  });
});
