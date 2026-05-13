"use client";

import { useCallback, useEffect, useState } from "react";
import { publicApiUrl } from "../lib/api";

type Detail = {
  event: {
    currentPrice: { cents: number; formatted: string };
    remaining: number;
    breakdown?: {
      adjustments: Record<string, number>;
      weightedSum?: number;
    };
  };
};

export default function EventPriceTicker({ eventId }: { eventId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${publicApiUrl()}/events/${eventId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Detail;
      setData(body);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [eventId]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(() => void poll(), 30_000);
    return () => window.clearInterval(id);
  }, [poll]);

  if (status === "loading" && !data) return <p className="text-sm text-stone-600">Updating latest price...</p>;
  if (status === "error" || !data) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm dark:border-stone-700 dark:bg-stone-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
        Live price (updates every 30 seconds)
      </p>
      <p className="mt-2 text-2xl font-semibold">{data.event.currentPrice.formatted}</p>
      <p className="mt-2 text-[13px] text-stone-700 dark:text-stone-300">
        {data.event.remaining} tickets left.
      </p>
    </div>
  );
}
