"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { publicApiUrl } from "../lib/api";

type Snap = {
  enabled: boolean;
  rate: number;
  simulatedNowIso: string;
  caption: string;
};

export default function DemoTimelineBar() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [hidden, setHidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function formatSimTime(iso: string): string {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  }

  async function reload() {
    try {
      const res = await fetch(`${publicApiUrl()}/dev/sim-time`, { cache: "no-store" });
      if (res.status === 404) {
        setHidden(true);
        return;
      }
      if (!res.ok) {
        setErr("We couldn't load timeline status.");
        return;
      }
      setSnap((await res.json()) as Snap);
      setHidden(false);
      setErr(null);
    } catch {
      setErr("Timeline controls are temporarily unavailable.");
    }
  }

  async function applyPreset(preset: "pause" | "realtime" | "x2" | "x5" | "x10") {
    setErr(null);
    start(async () => {
      try {
        const res = await fetch(`${publicApiUrl()}/dev/sim-time`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preset }),
          cache: "no-store",
        });
        if (res.status === 404) {
          setHidden(true);
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
        setErr(typeof body?.error === "string" ? body.error : "We couldn't update the timeline speed.");
          return;
        }
        setSnap(body as Snap);
      } catch {
        setErr("We couldn't reach the server to update timeline speed.");
      }
    });
  }

  useEffect(() => {
    void reload();
    const tick = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(tick);
  }, []);

  if (hidden || !snap?.enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-sm text-stone-800 shadow-xl shadow-amber-200/60 backdrop-blur dark:border-amber-500/35 dark:bg-stone-900/90 dark:text-amber-50 dark:shadow-black/60">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Timeline controls
            </p>
            <p className="mt-1 text-[13px] text-stone-700 dark:text-stone-300">{snap.caption}</p>
            <p className="mt-1 font-mono text-xs text-stone-600 dark:text-stone-400">
              Simulated clock:{" "}
              <span data-testid="sim-time-iso">{formatSimTime(snap.simulatedNowIso)}</span>
            </p>
            {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pt-2 sm:pt-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
              Simulation speed:
            </span>
            {[
              { preset: "pause", label: "Pause", activeRate: 0 },
              { preset: "realtime", label: "1×", activeRate: 1 },
              { preset: "x2", label: "2×", activeRate: 2 },
              { preset: "x5", label: "5×", activeRate: 5 },
              { preset: "x10", label: "10×", activeRate: 10 },
            ].map((item) => (
              <button
                key={item.preset}
                type="button"
                disabled={pending}
                onClick={() =>
                  void applyPreset(item.preset as "pause" | "realtime" | "x2" | "x5" | "x10")
                }
                className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  snap.rate === item.activeRate
                    ? "border-amber-700 bg-amber-600 text-white dark:border-amber-400 dark:bg-amber-500/70"
                    : "border-stone-300 bg-white hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:hover:bg-stone-700"
                }`}
              >
                {item.label}
              </button>
            ))}
            <Link
              href="/admin"
              className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1 text-[12px] font-semibold text-amber-900 hover:bg-amber-200 dark:border-amber-600/70 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/30"
            >
              Open full time controls
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
