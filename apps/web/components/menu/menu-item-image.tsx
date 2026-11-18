"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { resolveMenuImageUrl } from "@/lib/menu-api";

export function MenuItemImage({
  imageUrl,
  alt,
  className,
}: {
  imageUrl: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMenuImageUrl(imageUrl);
  return (
    <div
      className={cn(
        "bg-secondary relative grid place-items-center overflow-hidden",
        className,
      )}
    >
      {resolved && !failed ? (
        <Image
          src={resolved}
          alt={alt}
          fill
          unoptimized
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <ImageIcon className="size-7" />
          <span className="text-[11px] font-medium">No image</span>
        </div>
      )}
    </div>
  );
}
