import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CustomerOrderProgress } from "./customer-order-progress";

describe("customer order tracking", () => {
  it("renders preparation progress accessibly", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomerOrderProgress, { status: "PREPARING" }),
    );
    expect(markup).toContain("Your food is being prepared");
    expect(markup).toContain('aria-valuenow="60"');
  });

  it("announces ready-for-serving state", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomerOrderProgress, { status: "READY" }),
    );
    expect(markup).toContain("Your order is ready for serving.");
  });
});
