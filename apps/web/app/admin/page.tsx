"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { publicApiUrl } from "../../lib/api";

type SimSnap = {
  enabled: boolean;
  rate: number;
  simulatedNowMs?: number;
  simulatedNowIso: string;
  caption: string;
  alignedTo?: {
    eventId: string;
    eventName: string;
    window?: "base" | "week" | "tomorrow" | "start";
    daysUntilEvent?: number;
  };
  expectedRuleState?: {
    timeAdjustment: number;
    weightedTimeAdjustment: number;
  };
};

type EventItem = {
  id: string;
  name: string;
  date: string;
  venue: string;
};

export default function AdminPage() {
  const [snap, setSnap] = useState<SimSnap | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [currentTimeAdj, setCurrentTimeAdj] = useState<number | null>(null);

  function formatSimTime(iso: string | undefined): string {
    if (!iso) return "-";
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const [simRes, eventsRes] = await Promise.all([
        fetch(`${publicApiUrl()}/dev/sim-time`, { cache: "no-store" }),
        fetch(`${publicApiUrl()}/events`, { cache: "no-store" }),
      ]);

      if (simRes.ok) {
        setSnap((await simRes.json()) as SimSnap);
      } else if (simRes.status === 404) {
        setError("Time simulation is disabled. Set ENABLE_TIME_SIMULATION=true in API env.");
      } else {
        setError("Could not read simulation state.");
      }

      if (eventsRes.ok) {
        const body = (await eventsRes.json()) as { events: EventItem[] };
        setEvents(body.events);
        if (!eventId && body.events[0]?.id) setEventId(body.events[0].id);
      }
    } catch {
      setError("Admin controls are temporarily unavailable.");
    }
  }, [eventId]);

  function friendlyError(raw: unknown): string {
    const message = raw instanceof Error ? raw.message : String(raw ?? "");
    if (message === "Not found") {
      return "API route not found. Restart the API so the latest admin timeline endpoints are loaded.";
    }
    return message || "Request failed";
  }

  async function refreshEventDetailPricing(targetEventId: string) {
    try {
      const res = await fetch(`${publicApiUrl()}/events/${targetEventId}`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { event?: { breakdown?: { adjustments?: { time?: number } } } };
      const adj = body.event?.breakdown?.adjustments?.time;
      setCurrentTimeAdj(typeof adj === "number" ? adj : null);
    } catch {
      setCurrentTimeAdj(null);
    }
  }

  async function setPreset(preset: "pause" | "realtime" | "x2" | "x5" | "x10") {
    startTransition(async () => {
      try {
        const res = await fetch(`${publicApiUrl()}/dev/sim-time`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ preset }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Preset failed");
        setSnap(json as SimSnap);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed applying preset");
      }
    });
  }

  async function alignToWindow(window: "base" | "week" | "tomorrow" | "start") {
    if (!eventId) return;
    startTransition(async () => {
      try {
        const res = await fetch(`${publicApiUrl()}/dev/sim-time/align-window`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ eventId, window }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Align failed");
        setSnap(json as SimSnap);
        await refreshEventDetailPricing(eventId);
        setError(null);
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  const selected = useMemo(() => events.find((evt) => evt.id === eventId), [events, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!eventId) return;
    void refreshEventDetailPricing(eventId);
  }, [eventId]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Time controls</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Jump to meaningful moments in time and see how prices respond.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
        <h2 className="text-sm font-semibold">Current timeline status</h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{snap?.caption ?? "Loading..."}</p>
        <p className="mt-1 font-mono text-xs text-stone-600 dark:text-stone-400">
          Simulated now: {formatSimTime(snap?.simulatedNowIso)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "realtime", label: "Realtime (1×)" },
            { id: "pause", label: "Pause" },
            { id: "x2", label: "2×" },
            { id: "x5", label: "5×" },
            { id: "x10", label: "10×" },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={pending}
              onClick={() => void setPreset(preset.id as "pause" | "realtime" | "x2" | "x5" | "x10")}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold hover:bg-stone-100 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
        <h2 className="text-sm font-semibold">Jump to key pricing moments</h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Pick an event and jump to checkpoints like 1 week before or event start.
        </p>
        <label className="mt-4 block text-sm font-medium">
          Event
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name} ({new Date(evt.date).toLocaleString()})
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            Selected: {selected.name} at {selected.venue}
          </p>
        ) : null}
        {snap?.alignedTo ? (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            Time set for: {snap.alignedTo.eventName} · {snap.alignedTo.window ?? "custom"} checkpoint
          </p>
        ) : null}
        {typeof currentTimeAdj === "number" ? (
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
            Current time-based adjustment: {(currentTimeAdj * 100).toFixed(2)}%
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !eventId}
            onClick={() => void alignToWindow("base")}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:bg-stone-50 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Base checkpoint (30 days)
          </button>
          <button
            type="button"
            disabled={pending || !eventId}
            onClick={() => void alignToWindow("week")}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:bg-stone-50 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Week checkpoint (7 days)
          </button>
          <button
            type="button"
            disabled={pending || !eventId}
            onClick={() => void alignToWindow("tomorrow")}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:bg-stone-50 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Tomorrow checkpoint (1 day)
          </button>
          <button
            type="button"
            disabled={pending || !eventId}
            onClick={() => void alignToWindow("start")}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:bg-stone-50 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Event start (0 days)
          </button>
        </div>
      </div>
    </section>
  );
}
