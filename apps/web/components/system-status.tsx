"use client";

import { healthResponseSchema } from "@restroflow/contracts";
import { useQuery } from "@tanstack/react-query";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getHealth() {
  const response = await fetch(`${apiUrl}/api/v1/health`);
  const body: unknown = await response.json();
  return healthResponseSchema.parse(body);
}

export function SystemStatus() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
  });
  const online = query.data?.status === "ok";

  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium">
      <span
        className={
          online
            ? "size-2 rounded-full bg-emerald-500"
            : "size-2 rounded-full bg-amber-500"
        }
      />
      {online
        ? "API and database online"
        : query.isPending
          ? "Checking system status"
          : "Local API unavailable"}
    </span>
  );
}
