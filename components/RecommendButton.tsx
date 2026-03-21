"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Place = {
  _id: string;
  name: string;
  category: string;
  area: string;
  rating?: number;
  description?: string;
  distance?: number | null; // metres, from $geoNear
  location: { coordinates: [number, number] };
};

type Filters = {
  radiusKm: number;
  mood: string;
  mode: string;
  category: string;
};

type Props = {
  onPlaceSelect: (place: Place) => void;
  mapRef: React.MutableRefObject<any>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BUBBLE_MESSAGES = [
  "where to next? ✦",
  "feeling lucky?",
  "need a vibe?",
  "what's the move?",
  "surprise me ✦",
  "find me something good",
];

const MOODS = [
  { id: "just-vibing",  label: "Just vibing",    icon: "✌️" },
  { id: "need-coffee",  label: "Need coffee",     icon: "☕" },
  { id: "touch-grass",  label: "Touch grass",     icon: "🌿" },
  { id: "quick-bite",   label: "Quick bite",      icon: "🍱" },
  { id: "late-night",   label: "Late night",      icon: "🌙" },
  { id: "hidden-gem",   label: "Hidden gem",      icon: "💎" },
];

const TIMES = [
  { id: "",        label: "Any time" },
  { id: "morning", label: "Morning" },
  { id: "noon",    label: "Noon"    },
  { id: "evening", label: "Evening" },
  { id: "night",   label: "Night"   },
];

const CATEGORIES = [
  { id: "any",   label: "Anything" },
  { id: "cafe",  label: "Cafe"     },
  { id: "park",  label: "Park"     },
  { id: "metro", label: "Metro"    },
  { id: "bmtc",  label: "BMTC"     },
];

const RADIUS_OPTIONS = [
  { km: 1,  label: "1 km"   },
  { km: 2,  label: "2 km"   },
  { km: 5,  label: "5 km"   },
  { km: 10, label: "10 km"  },
  { km: 50, label: "Anywhere" },
];

const CATEGORY_ICONS: Record<string, string> = {
  cafe:  "☕",
  park:  "🌳",
  metro: "🚇",
  bmtc:  "🚌",
  place: "📍",
};

const DEFAULT_FILTERS: Filters = {
  radiusKm: 50,
  mood: "",
  mode: "",
  category: "any",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDistance(metres: number | null | undefined): string {
  if (metres == null) return "";
  if (metres < 1000) return `${Math.round(metres)} m away`;
  return `${(metres / 1000).toFixed(1)} km away`;
}

function starRow(rating: number | undefined) {
  const r = Math.round(rating || 0);
  return "★".repeat(r) + "☆".repeat(5 - r);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecommendButton({ onPlaceSelect, mapRef }: Props) {
  // ── Speech bubble ──────────────────────────────────────────────────────────
  const [bubbleIdx, setBubbleIdx]       = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setBubbleVisible(false);
      setTimeout(() => {
        setBubbleIdx((i) => (i + 1) % BUBBLE_MESSAGES.length);
        setBubbleVisible(true);
      }, 400);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [open, setOpen]             = useState(false);
  const [filters, setFilters]       = useState<Filters>(DEFAULT_FILTERS);
  const [userLat, setUserLat]       = useState<number | null>(null);
  const [userLng, setUserLng]       = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("detecting…");

  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState<Place[]>([]);
  const [searched, setSearched]     = useState(false);
  const [error, setError]           = useState("");

  // ── Get user location when modal opens ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (!navigator.geolocation) {
      setLocationLabel("location unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocationLabel("using your location");
      },
      () => {
        setUserLat(null);
        setUserLng(null);
        setLocationLabel("using Bengaluru centre");
      },
      { timeout: 5000 }
    );
  }, [open]);

  // ── Fetch recommendations ──────────────────────────────────────────────────
  const fetchRecs = useCallback(async (f: Filters) => {
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const body: any = {
        radiusKm: f.radiusKm,
        category: f.category,
        mood: f.mood || undefined,
        mode: f.mode || undefined,
        count: 3,
      };

      // Pass actual coords if we have them, else Bengaluru centre
      body.lat = userLat ?? 12.9716;
      body.lng = userLng ?? 77.5946;

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No places matched. Try different filters.");
      }

      const data: Place[] = await res.json();
      setResults(data);
      setSearched(true);
    } catch (e: any) {
      setError(e.message);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [userLat, userLng]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDiscover = () => fetchRecs(filters);

  const handleRegenerate = () => fetchRecs(filters);

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setSearched(false);
    setError("");
  };

  const handlePickPlace = (place: Place) => {
    const [lng, lat] = place.location.coordinates;
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 17, { duration: 1.6 });
    }
    onPlaceSelect(place);
    setOpen(false);
  };

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating button + bubble ─────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end gap-2">

        {/* Speech bubble */}
        <div
          style={{
            opacity: bubbleVisible ? 1 : 0,
            transform: bubbleVisible ? "translateY(0) scale(1)" : "translateY(4px) scale(0.97)",
            transition: "opacity 350ms ease, transform 350ms ease",
          }}
          className="
            relative bg-white text-[#111] text-xs font-medium
            px-3.5 py-2 rounded-2xl rounded-br-sm shadow-lg
            whitespace-nowrap select-none pointer-events-none
          "
        >
          {BUBBLE_MESSAGES[bubbleIdx]}
          {/* Bubble tail */}
          <span
            className="absolute -bottom-1.5 right-4 w-3 h-3 bg-white"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
          />
        </div>

        {/* The button */}
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #ef4444 50%, #ec4899 100%)",
            boxShadow: "0 0 24px rgba(249,115,22,0.45), 0 4px 16px rgba(0,0,0,0.4)",
          }}
          className="
            w-14 h-14 rounded-full
            flex items-center justify-center
            text-white text-2xl
            hover:scale-110 active:scale-95
            transition-transform duration-150
            animate-pulse-slow
          "
        >
          ✦
        </button>
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        >
          {/* Click outside to close */}
          <div className="absolute inset-0" onClick={() => setOpen(false)} />

          <div
            className="
              relative z-10
              w-full sm:w-[480px]
              max-h-[90vh] overflow-y-auto
              bg-[#0f0f0f] border border-white/10
              rounded-t-3xl sm:rounded-3xl
              shadow-2xl
            "
          >
            {/* Warm glow top */}
            <div
              className="absolute top-0 left-0 right-0 h-32 rounded-t-3xl pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.12) 0%, transparent 70%)",
              }}
            />

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="px-6 pt-6 pb-5 border-b border-white/5 relative">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-5 right-5 text-white/25 hover:text-white transition text-lg"
              >
                ✕
              </button>
              <h2
                className="text-2xl font-bold text-white mb-0.5"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Find me a place.
              </h2>
              <p className="text-white/35 text-xs flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background:
                      locationLabel === "using your location"
                        ? "#4ade80"
                        : "#f97316",
                  }}
                />
                {locationLabel}
              </p>
            </div>

            {/* ── Filters ─────────────────────────────────────────────── */}
            <div className="px-6 py-5 space-y-6 border-b border-white/5">

              {/* Mood */}
              <div>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
                  What's the mood?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        setFilter("mood", filters.mood === m.id ? "" : m.id)
                      }
                      className={`
                        flex flex-col items-center gap-1.5 py-3 px-2
                        rounded-xl border text-xs font-medium transition
                        ${
                          filters.mood === m.id
                            ? "border-orange-400/60 bg-orange-400/10 text-white"
                            : "border-white/8 text-white/45 hover:border-white/20 hover:text-white/70"
                        }
                      `}
                    >
                      <span className="text-xl">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius */}
              <div>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
                  How far are you willing to go?
                </p>
                <div className="flex gap-2 flex-wrap">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r.km}
                      onClick={() => setFilter("radiusKm", r.km)}
                      className={`
                        px-3.5 py-1.5 rounded-full border text-xs transition
                        ${
                          filters.radiusKm === r.km
                            ? "bg-white text-black border-white"
                            : "border-white/10 text-white/45 hover:border-white/30 hover:text-white/70"
                        }
                      `}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time of day */}
              <div>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
                  Time of day
                </p>
                <div className="flex gap-2 flex-wrap">
                  {TIMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFilter("mode", t.id)}
                      className={`
                        px-3.5 py-1.5 rounded-full border text-xs transition
                        ${
                          filters.mode === t.id
                            ? "bg-white text-black border-white"
                            : "border-white/10 text-white/45 hover:border-white/30 hover:text-white/70"
                        }
                      `}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
                  Type of place
                </p>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setFilter("category", c.id)}
                      className={`
                        px-3.5 py-1.5 rounded-full border text-xs transition
                        ${
                          filters.category === c.id
                            ? "bg-white text-black border-white"
                            : "border-white/10 text-white/45 hover:border-white/30 hover:text-white/70"
                        }
                      `}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Discover button ──────────────────────────────────────── */}
            {!searched && (
              <div className="px-6 py-5">
                <button
                  onClick={handleDiscover}
                  disabled={loading}
                  style={{
                    background: loading
                      ? "rgba(255,255,255,0.08)"
                      : "linear-gradient(135deg, #f97316, #ef4444)",
                  }}
                  className="
                    w-full py-3.5 rounded-xl text-sm font-semibold text-white
                    transition-opacity disabled:opacity-60
                    flex items-center justify-center gap-2
                  "
                >
                  {loading ? (
                    <>
                      <span
                        className="inline-block animate-spin text-base"
                        style={{ animationDuration: "0.8s" }}
                      >
                        ✦
                      </span>
                      Finding places…
                    </>
                  ) : (
                    <>✦ Discover</>
                  )}
                </button>
              </div>
            )}

            {/* ── Results ──────────────────────────────────────────────── */}
            {searched && (
              <div className="px-6 py-5">
                {error && (
                  <div className="bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3 mb-4">
                    <p className="text-red-400 text-sm">{error}</p>
                    <p className="text-white/30 text-xs mt-1">
                      Try loosening your filters or increasing the radius.
                    </p>
                  </div>
                )}

                {results.length > 0 && (
                  <>
                    <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
                      {results.length} place{results.length !== 1 ? "s" : ""} for you
                    </p>

                    <div className="space-y-3 mb-5">
                      {results.map((place, i) => (
                        <button
                          key={place._id}
                          onClick={() => handlePickPlace(place)}
                          className="
                            w-full text-left
                            bg-white/4 hover:bg-white/8
                            border border-white/8 hover:border-white/15
                            rounded-2xl p-4 transition group
                          "
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Number + name */}
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-white/20 text-xs font-mono shrink-0">
                                  0{i + 1}
                                </span>
                                <h3
                                  className="text-white font-semibold text-base leading-tight truncate"
                                  style={{
                                    fontFamily:
                                      "Georgia, 'Times New Roman', serif",
                                  }}
                                >
                                  {place.name}
                                </h3>
                              </div>

                              {/* Category + area */}
                              <p className="text-white/40 text-xs mb-2 capitalize">
                                {CATEGORY_ICONS[place.category] || "📍"}{" "}
                                {place.category}
                                {place.area ? ` · ${place.area}` : ""}
                              </p>

                              {/* Description */}
                              {place.description && (
                                <p className="text-white/35 text-xs leading-relaxed line-clamp-2 mb-2">
                                  {place.description}
                                </p>
                              )}

                              <div className="flex items-center gap-3">
                                {/* Rating */}
                                {place.rating ? (
                                  <span className="text-amber-400 text-xs">
                                    {"★".repeat(Math.round(place.rating))}
                                    <span className="text-white/25 ml-1">
                                      {place.rating.toFixed(1)}
                                    </span>
                                  </span>
                                ) : null}

                                {/* Distance */}
                                {place.distance != null && (
                                  <span className="text-white/25 text-xs">
                                    {formatDistance(place.distance)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Arrow */}
                            <span className="text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all text-lg shrink-0 mt-1">
                              →
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Regenerate + Reset */}
                <div className="flex gap-2">
                  <button
                    onClick={handleRegenerate}
                    disabled={loading}
                    className="
                      flex-1 py-2.5 rounded-xl border border-white/15
                      text-white/60 text-xs font-medium
                      hover:bg-white/5 hover:text-white
                      transition disabled:opacity-40
                      flex items-center justify-center gap-1.5
                    "
                  >
                    {loading ? (
                      <span className="animate-spin inline-block">⟳</span>
                    ) : (
                      <>⟳ Regenerate</>
                    )}
                  </button>
                  <button
                    onClick={handleReset}
                    className="
                      flex-1 py-2.5 rounded-xl border border-white/8
                      text-white/35 text-xs font-medium
                      hover:bg-white/5 hover:text-white/60
                      transition
                    "
                  >
                    ↺ Reset filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pulse animation style ─────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { box-shadow: 0 0 24px rgba(249,115,22,0.45), 0 4px 16px rgba(0,0,0,0.4); }
          50%       { box-shadow: 0 0 36px rgba(249,115,22,0.65), 0 4px 20px rgba(0,0,0,0.5); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}