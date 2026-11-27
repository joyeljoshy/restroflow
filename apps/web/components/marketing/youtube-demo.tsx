"use client";

import { ExternalLink, Play, Share2, Video } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const VIDEO_ID = "uYCQo1ge99o";
export const VIDEO_URL = `https://youtu.be/${VIDEO_ID}`;
const VIDEO_TITLE = "RestroFlow restaurant management product demonstration";
const THUMBNAIL_URL = "/restroflow-demo-thumbnail.jpg";
const EMBED_URL = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`;

export interface ShareCapabilities {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

export type ShareResult = "shared" | "copied" | "cancelled" | "unavailable";

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function shareVideo(
  capabilities: ShareCapabilities,
): Promise<ShareResult> {
  if (capabilities.share) {
    try {
      await capabilities.share({
        title: "RestroFlow product demonstration",
        text: "See RestroFlow in action.",
        url: VIDEO_URL,
      });
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "cancelled";
    }
  }

  if (capabilities.clipboard) {
    try {
      await capabilities.clipboard.writeText(VIDEO_URL);
      return "copied";
    } catch {
      // The visible YouTube link remains available as the final fallback.
    }
  }

  return "unavailable";
}

const shareFeedback: Record<ShareResult, string> = {
  shared: "Video shared.",
  copied: "Video link copied to your clipboard.",
  cancelled: "Sharing cancelled.",
  unavailable: "Sharing is unavailable here. Use Watch on YouTube instead.",
};

export function YouTubeDemo() {
  const [playerRequested, setPlayerRequested] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerFailed, setPlayerFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [feedback, setFeedback] = useState("");

  function loadPlayer() {
    setPlayerLoading(true);
    setPlayerRequested(true);
  }

  async function handleShare() {
    setFeedback("");
    const result = await shareVideo({
      share: navigator.share?.bind(navigator),
      clipboard: navigator.clipboard,
    });
    setFeedback(shareFeedback[result]);
  }

  return (
    <section aria-labelledby="demo-heading" className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-emerald-100/35" />
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-primary text-sm font-bold tracking-[0.16em] uppercase">
            Product demonstration
          </p>
          <h2
            id="demo-heading"
            className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            See RestroFlow in Action
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-7 sm:text-lg sm:leading-8">
            Follow a complete service flow across restaurant management, waiter
            POS, kitchen operations, customer QR ordering, and billing.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-2xl border bg-stone-950 shadow-[0_25px_80px_-32px_rgba(20,55,40,.45)] sm:mt-12">
          <div className="relative aspect-video bg-stone-950">
            {playerRequested && !playerFailed ? (
              <>
                {playerLoading ? (
                  <div
                    className="absolute inset-0 grid place-items-center text-sm font-semibold text-stone-300"
                    role="status"
                  >
                    Loading video player…
                  </div>
                ) : null}
                <iframe
                  className="absolute inset-0 size-full"
                  src={EMBED_URL}
                  title={VIDEO_TITLE}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onLoad={() => setPlayerLoading(false)}
                  onError={() => {
                    setPlayerLoading(false);
                    setPlayerFailed(true);
                  }}
                />
              </>
            ) : (
              <div className="absolute inset-0 grid place-items-center overflow-hidden">
                {!thumbnailFailed ? (
                  <img
                    src={THUMBNAIL_URL}
                    alt="RestroFlow dashboard shown in the product demonstration"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover"
                    onError={() => setThumbnailFailed(true)}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-emerald-950 via-stone-950 to-stone-900 text-center text-stone-100">
                    <div>
                      <Video
                        className="mx-auto size-10 text-emerald-400"
                        aria-hidden="true"
                      />
                      <p className="mt-3 font-semibold">
                        RestroFlow product demonstration
                      </p>
                    </div>
                  </div>
                )}
                <div
                  className="absolute inset-0 bg-black/30"
                  aria-hidden="true"
                />
                {playerFailed ? (
                  <div className="relative z-10 rounded-xl bg-stone-950/90 px-5 py-4 text-center text-stone-50 shadow-lg">
                    <p className="font-semibold">
                      The video player could not load.
                    </p>
                    <a
                      href={VIDEO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex rounded-md text-sm font-semibold text-emerald-300 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:outline-none"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={loadPlayer}
                    aria-label="Play RestroFlow product demonstration"
                    className="group relative z-10 grid size-16 place-items-center rounded-full bg-emerald-600 text-white shadow-xl transition-transform hover:scale-105 hover:bg-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:scale-100 sm:size-20"
                  >
                    <Play
                      className="ml-1 size-7 fill-current sm:size-9"
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer">
              Watch on YouTube <ExternalLink aria-hidden="true" />
            </a>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleShare()}
          >
            <Share2 aria-hidden="true" /> Share Video
          </Button>
        </div>
        <p
          className="text-muted-foreground mt-3 min-h-5 text-center text-sm"
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      </div>
    </section>
  );
}
