"use client";

import { FiCompass, FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

type Place = {
  _id: string;
  name: string;
  category: string;
  area: string;
  rating?: number;
  description?: string;
  distance?: number | null;
  location: { coordinates: [number, number] };
};

type Filters = {
  radiusKm: number;
  mood: string;
  mode: string;
  category: string;
};

type RecommendRequestBody = {
  radiusKm: number;
  category: string;
  mood?: string;
  mode?: string;
  count: number;
  lat: number;
  lng: number;
};

type Props = {
  onPlaceSelect: (place: Place) => void;
  mapRef: React.MutableRefObject<MapRef | null>;
};

const BUBBLE_MESSAGES = [
  "want help choosing?",
  "pick a place for me",
  "not sure where to go?",
  "need a quick shortlist?",
  "show me nearby options",
  "help me decide",
];

const MOODS = [
  { id: "just-vibing", label: "Just vibing", icon: "✌️" },
  { id: "need-coffee", label: "Need coffee", icon: "☕" },
  { id: "touch-grass", label: "Touch grass", icon: "🌿" },
  { id: "quick-bite", label: "Quick bite", icon: "🍱" },
  { id: "late-night", label: "Late night", icon: "🌙" },
  { id: "hidden-gem", label: "Hidden gem", icon: "📍" },
];

const TIMES = [
  { id: "", label: "Any time" },
  { id: "morning", label: "Morning" },
  { id: "noon", label: "Noon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];

const RADIUS_OPTIONS = [
  { km: 1, label: "1 km" },
  { km: 2, label: "2 km" },
  { km: 5, label: "5 km" },
  { km: 10, label: "10 km" },
  { km: 50, label: "Anywhere" },
];

const CATEGORY_ICONS: Record<string, string> = {
  cafe: "☕",
  restaurant: "🍽️",
  "street-food": "🥙",
  bakery: "🥐",
  dessert: "🍨",
  park: "🌳",
  lake: "🌊",
  metro: "🚇",
  bmtc: "🚌",
  mall: "🛍️",
  shopping: "🛒",
  market: "🏬",
  library: "📚",
  "study-cafe": "🪑",
  default: "📍",
};

const DEFAULT_FILTERS: Filters = {
  radiusKm: 50,
  mood: "",
  mode: "",
  category: "any",
};

function formatDistance(metres: number | null | undefined): string {
  if (metres == null) return "";
  if (metres < 1000) return `${Math.round(metres)} m away`;
  return `${(metres / 1000).toFixed(1)} km away`;
}

function starRow(rating: number | undefined) {
  const roundedRating = Math.round(rating || 0);
  return "★".repeat(roundedRating) + "☆".repeat(5 - roundedRating);
}

function formatCategory(category: string) {
  return category
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RecommendButton({ onPlaceSelect, mapRef }: Props) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setBubbleVisible(false);
      setTimeout(() => {
        setBubbleIdx((index) => (index + 1) % BUBBLE_MESSAGES.length);
        setBubbleVisible(true);
      }, 400);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
      },
      () => {
        setUserLat(null);
        setUserLng(null);
      },
      { timeout: 5000 }
    );
  }, [open]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);

    window.addEventListener("streetmap:open-discover", handleOpen);
    return () => window.removeEventListener("streetmap:open-discover", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const fetchRecommendations = useCallback(
    async (nextFilters: Filters) => {
      setLoading(true);
      setError("");
      setResults([]);

      try {
        const body: RecommendRequestBody = {
          radiusKm: nextFilters.radiusKm,
          category: nextFilters.category,
          mood: nextFilters.mood || undefined,
          mode: nextFilters.mode || undefined,
          count: 3,
          lat: userLat ?? 12.9716,
          lng: userLng ?? 77.5946,
        };

        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No places matched. Try different filters.");
        }

        const data: Place[] = await response.json();
        setResults(data);
        setSearched(true);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [userLat, userLng]
  );

  const handleDiscover = () => fetchRecommendations(filters);
  const handleRegenerate = () => fetchRecommendations(filters);

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setSearched(false);
    setError("");
  };

  const handlePickPlace = (place: Place) => {
    const [lng, lat] = place.location.coordinates;

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 17, duration: 1600 });
    }

    onPlaceSelect(place);
    setOpen(false);
  };

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div
        ref={popupRef}
        className="fixed bottom-12 right-6 z-[1000] flex flex-col items-end gap-2"
      >
        {!open && (
          <div
            style={{
              opacity: bubbleVisible ? 1 : 0,
              transform: bubbleVisible ? "translateY(0) scale(1)" : "translateY(4px) scale(0.97)",
              transition: "opacity 350ms ease, transform 350ms ease",
            }}
            className="pointer-events-none relative whitespace-nowrap rounded-2xl rounded-br-sm bg-white px-3.5 py-2 text-xs font-medium text-[#111] shadow-lg select-none"
          >
            {BUBBLE_MESSAGES[bubbleIdx]}
            <span
              className="absolute -bottom-1.5 right-4 h-3 w-3 bg-white"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
            />
          </div>
        )}

        {open && (
          <div
            className="mb-2 w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-white/10 p-4 text-white shadow-[0_24px_80px_rgba(15,23,42,0.42)]"
            style={{ backgroundColor: "#222222" }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Help me choose</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Start here when you are undecided. The filters around the map are for narrowing
                  down results once you already know the kind of place you want.
                </p>
              </div>
              <button
                aria-label="Close recommendations"
                className="rounded-full p-1 text-sm text-white/45 transition hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
                type="button"
              >
                <FiX />
              </button>
            </div>

            {!searched && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    What&apos;s the mood?
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {MOODS.map((mood) => (
                      <button
                        key={mood.id}
                        onClick={() => setFilter("mood", filters.mood === mood.id ? "" : mood.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition ${
                          filters.mood === mood.id
                            ? "border-orange-300 bg-orange-400/15 text-white"
                            : "border-white/10 text-white/65 hover:border-white/25 hover:text-white"
                        }`}
                        type="button"
                      >
                        <span className="text-xl">{mood.icon}</span>
                        {mood.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    How far are you willing to go?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RADIUS_OPTIONS.map((radius) => (
                      <button
                        key={radius.km}
                        onClick={() => setFilter("radiusKm", radius.km)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          filters.radiusKm === radius.km
                            ? "border-white bg-white text-black"
                            : "border-white/10 text-white/65 hover:border-white/25 hover:text-white"
                        }`}
                        type="button"
                      >
                        {radius.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Time of day
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((time) => (
                      <button
                        key={time.id}
                        onClick={() => setFilter("mode", time.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          filters.mode === time.id
                            ? "border-white bg-white text-black"
                            : "border-white/10 text-white/65 hover:border-white/25 hover:text-white"
                        }`}
                        type="button"
                      >
                        {time.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleDiscover}
                  disabled={loading}
                  style={{
                    background: loading
                      ? "rgba(255,255,255,0.12)"
                      : "linear-gradient(135deg, #f97316, #ef4444)",
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  type="button"
                >
                  {loading ? (
                    <>
                      <FiSearch
                        className="inline-block animate-spin text-base"
                        style={{ animationDuration: "0.8s" }}
                      />
                      Finding places...
                    </>
                  ) : (
                    <>
                      <FiCompass className="text-base" />
                      Discover places
                    </>
                  )}
                </button>
              </div>
            )}

            {searched && (
              <div>
                {error && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-600">{error}</p>
                    <p className="mt-1 text-xs text-red-400">
                      Try loosening your filters or increasing the radius.
                    </p>
                  </div>
                )}

                {results.length > 0 && (
                  <>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      {results.length} place{results.length !== 1 ? "s" : ""} for you
                    </p>

                    <div className="mb-4 space-y-3">
                      {results.map((place, index) => (
                        <button
                          key={place._id}
                          onClick={() => handlePickPlace(place)}
                          className="group w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/10"
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-baseline gap-2">
                                <span className="shrink-0 text-xs font-mono text-white/30">
                                  0{index + 1}
                                </span>
                                <h3 className="truncate text-base font-semibold leading-tight text-white">
                                  {place.name}
                                </h3>
                              </div>

                              <p className="mb-2 text-xs text-white/50">
                                {CATEGORY_ICONS[place.category] || CATEGORY_ICONS.default}{" "}
                                {formatCategory(place.category)}
                                {place.area ? ` · ${place.area}` : ""}
                              </p>

                              {place.description && (
                                <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-white/45">
                                  {place.description}
                                </p>
                              )}

                              <div className="flex items-center gap-3">
                                {place.rating ? (
                                  <span className="text-xs text-amber-500">
                                    {starRow(place.rating)}
                                    <span className="ml-1 text-white/35">
                                      {place.rating.toFixed(1)}
                                    </span>
                                  </span>
                                ) : null}

                                {place.distance != null && (
                                  <span className="text-xs text-white/35">
                                    {formatDistance(place.distance)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="mt-1 shrink-0 text-lg text-white/20 transition-all group-hover:translate-x-0.5 group-hover:text-white/55">
                              →
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleRegenerate}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/10 py-2.5 text-xs font-medium text-white/65 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                    type="button"
                  >
                    {loading ? (
                      <FiRefreshCw className="inline-block animate-spin" />
                    ) : (
                      <>
                        <FiRefreshCw />
                        Regenerate
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 rounded-2xl border border-white/10 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/5 hover:text-white"
                    type="button"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          aria-expanded={open}
          aria-label="Open recommendations"
          onClick={() => setOpen((current) => !current)}
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #ef4444 50%, #ec4899 100%)",
            boxShadow: "0 0 24px rgba(249,115,22,0.45), 0 4px 16px rgba(0,0,0,0.4)",
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white transition-transform duration-150 hover:scale-110 active:scale-95 animate-pulse-slow"
          type="button"
        >
          <FiCompass />
        </button>
      </div>

      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { box-shadow: 0 0 24px rgba(249,115,22,0.45), 0 4px 16px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 0 36px rgba(249,115,22,0.65), 0 4px 20px rgba(0,0,0,0.5); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
