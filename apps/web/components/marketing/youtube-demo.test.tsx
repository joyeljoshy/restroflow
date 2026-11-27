import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { shareVideo, VIDEO_URL, YouTubeDemo } from "./youtube-demo";

describe("YouTubeDemo", () => {
  it("renders an accessible click-to-load preview without the iframe", () => {
    const markup = renderToStaticMarkup(createElement(YouTubeDemo));

    expect(markup).toContain("See RestroFlow in Action");
    expect(markup).toContain(
      'aria-label="Play RestroFlow product demonstration"',
    );
    expect(markup).toContain('type="button"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain("/restroflow-demo-thumbnail.jpg");
    expect(markup).not.toContain("youtube-nocookie.com/embed");
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it("copies the video link when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(shareVideo({ clipboard: { writeText } })).resolves.toBe(
      "copied",
    );
    expect(writeText).toHaveBeenCalledWith(VIDEO_URL);
  });

  it("falls back to the clipboard when native sharing fails", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Not supported"));
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(shareVideo({ share, clipboard: { writeText } })).resolves.toBe(
      "copied",
    );
    expect(writeText).toHaveBeenCalledWith(VIDEO_URL);
  });
});
