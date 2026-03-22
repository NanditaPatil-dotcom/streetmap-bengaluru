"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

type DBPlace = {
  _id: string;
  name: string;
  category: string;
  area: string;
  rating?: number;
  location: { coordinates: [number, number] };
};

type OSMResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class?: string;
  addresstype?: string;
  name?: string;
  namedetails?: Record<string, string>;
  extratags?: Record<string, string>;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    amenity?: string;
    shop?: string;
    tourism?: string;
    building?: string;
  };
};

type SearchResult =
  | { source: "db"; item: DBPlace }
  | { source: "osm"; item: OSMResult };

type SelectedPlace =
  | { source: "db"; data: DBPlace }
  | { source: "osm"; data: OSMResult };

type AddPlaceFormProps = {
  onClose?: () => void;
  onOpenAuth?: () => void;
  onSubmitted?: (place: AddedPlace) => void;
  standalone?: boolean;
};

export type AddedPlace = {
  _id: string;
  name: string;
  category: string;
  area?: string;
  rating?: number;
  description?: string;
  location: { coordinates: [number, number] };
  openTime?: string;
  closeTime?: string;
  tags?: string[];
};

const PLACE_CATEGORIES = ["cafe", "food", "malls", "metro", "bmtc", "park"] as const;
type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

const categoryFromOSMType = (type: string): string => {
  if (["cafe"].includes(type)) return "cafe";
  if (["restaurant", "fast_food", "bar", "pub"].includes(type)) return "food";
  if (["park", "garden", "nature_reserve"].includes(type)) return "park";
  if (["station", "subway_entrance", "halt"].includes(type)) return "metro";
  if (["bus_stop", "bus_station"].includes(type)) return "bmtc";
  if (["mall"].includes(type)) return "malls";
  return "food";
};

const shortName = (result: OSMResult) =>
  result.name ||
  result.namedetails?.name ||
  result.namedetails?.["name:en"] ||
  result.namedetails?.brand ||
  result.extratags?.brand ||
  result.extratags?.name ||
  result.address?.amenity ||
  result.address?.shop ||
  result.address?.tourism ||
  result.address?.building ||
  result.address?.road ||
  result.address?.neighbourhood ||
  result.display_name.split(",")[0];

const shortArea = (result: OSMResult) =>
  [result.address?.neighbourhood, result.address?.suburb]
    .filter(Boolean)
    .slice(0, 1)
    .join("") || "";

export default function AddPlaceForm({
  onClose,
  onOpenAuth,
  onSubmitted,
  standalone = false,
}: AddPlaceFormProps) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [category, setCategory] = useState<PlaceCategory>("food");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setQuery("");
    setSearchResults([]);
    setSearching(false);
    setSelected(null);
    setCategory("food");
    setRating(0);
    setHoverRating(0);
    setReview("");
    setSubmitting(false);
    setError("");
  };

  useEffect(() => {
    if (!standalone) {
      return;
    }

    inputRef.current?.focus();
  }, [standalone]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    try {
      const [dbRes, osmRes] = await Promise.all([
        fetch(`/api/places/search?q=${encodeURIComponent(q)}`),
        fetch(`/api/geocode?q=${encodeURIComponent(q)}`),
      ]);

      const dbPlaces: DBPlace[] = dbRes.ok ? await dbRes.json() : [];
      const osmData: OSMResult[] = osmRes.ok ? await osmRes.json() : [];

      setSearchResults([
        ...dbPlaces.map((place) => ({ source: "db" as const, item: place })),
        ...osmData.map((result) => ({ source: "osm" as const, item: result })),
      ]);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setQuery(value);
    setSelected(null);
    setError("");

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void doSearch(value);
    }, 400);
  };

  const handleSelectResult = (item: SearchResult) => {
    if (item.source === "db") {
      setSelected({ source: "db", data: item.item });
      setQuery(item.item.name);
    } else {
      setSelected({ source: "osm", data: item.item });
      setQuery(shortName(item.item));
      setCategory(categoryFromOSMType(item.item.type) as PlaceCategory);
    }

    setSearchResults([]);
    setError("");
  };

  const handleSubmit = async () => {
    if (!selected) {
      setError("Please select a place first.");
      return;
    }

    if (selected.source === "db") {
      setError("place is already added");
      return;
    }

    if (!rating) {
      setError("Please add a rating.");
      return;
    }

    if (!category) {
      setError("Please choose a category.");
      return;
    }

    if (!review.trim()) {
      setError("Please write a short review.");
      return;
    }

    if (!session) {
      setError("You need to be signed in.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const osmPlace = selected.data;
      const createRes = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: shortName(osmPlace),
          lat: parseFloat(osmPlace.lat),
          lng: parseFloat(osmPlace.lon),
          category,
          area: shortArea(osmPlace),
          rating,
          description: review.trim(),
          osmId: String(osmPlace.place_id),
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to save place.");
      }

      const created = (await createRes.json()) as AddedPlace;

      resetForm();
      onSubmitted?.({
        ...created,
        rating,
        description: review.trim(),
      });

      if (standalone) {
        router.push("/");
      } else {
        onClose?.();
      }
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Something went wrong.";
      setError(message);
      setSubmitting(false);
    }
  };

  const dbResults = searchResults.filter((result) => result.source === "db");
  const osmResults = searchResults.filter((result) => result.source === "osm");
  const showDropdown = searchResults.length > 0 && !selected;
  const canSubmit = !!selected && !!category && rating > 0 && review.trim().length > 0;

  return (
    <div
      className={standalone ? "min-h-screen bg-[#0c0c0c] text-white flex flex-col" : "h-full text-white"}
    >
      {standalone && (
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
          >
            <span className="text-lg leading-none">←</span>
            <span>Back to map</span>
          </Link>
          <p className="text-xs uppercase tracking-widest text-white/20">StreetMap Bengaluru</p>
          {session ? (
            <p className="text-sm text-white/40">{session.user?.name?.split(" ")[0]}</p>
          ) : (
            <Link href="/" className="text-sm text-white/40 transition hover:text-white">
              Sign in
            </Link>
          )}
        </div>
      )}

      <div className={standalone ? "mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-12" : "flex h-full flex-col"}>
        {!standalone && (
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Add a place.</h2>
              <p className="mt-1 text-sm text-white/40">
                Found somewhere worth knowing about? Put it on the map.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Collapse add place sidebar"
            >
              Close
            </button>
          </div>
        )}

        <div className={standalone ? "w-full" : "flex-1 overflow-y-auto px-5 py-5"}>
          <div className={standalone ? "mb-10 w-full" : "mb-8 w-full"}>
            {standalone && (
              <>
                <h1
                  className="mb-2 text-4xl font-bold tracking-tight"
                >
                  Add a place.
                </h1>
                <p className="text-sm text-white/35">
                  Found somewhere worth knowing about? Put it on the map.
                </p>
              </>
            )}

            <label className="mb-2.5 mt-8 block text-[10px] uppercase tracking-widest text-white/30">
              01 -- Find the place
            </label>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search by name, street, area..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25"
              />

              {searching && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 animate-pulse text-xs text-white/25">
                  ...
                </span>
              )}

              {selected && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-green-400">
                  ✓
                </span>
              )}

              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-[#151515] shadow-2xl">
                  {dbResults.length > 0 && (
                    <>
                      <p className="px-4 pb-1.5 pt-3 text-[9px] uppercase tracking-widest text-white/20">
                        Already in catalogue
                      </p>
                      {dbResults.map((result, index) => (
                        <button
                          key={`db-${index}`}
                          onClick={() => handleSelectResult(result)}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 last:border-0"
                          type="button"
                        >
                          <span className="text-sm">📍</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {result.item.name}
                            </p>
                            <p className="truncate text-xs text-white/35">
                              {result.item.area} · {result.item.category}
                            </p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {osmResults.length > 0 && (
                    <>
                      <p className="border-t border-white/5 px-4 pb-1.5 pt-3 text-[9px] uppercase tracking-widest text-white/20">
                        From OpenStreetMap
                      </p>
                      {osmResults.map((result, index) => (
                        <button
                          key={`osm-${index}`}
                          onClick={() => handleSelectResult(result)}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 last:border-0"
                          type="button"
                        >
                          <span className="text-sm">🗺</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white/80">
                              {shortName(result.item)}
                            </p>
                            <p className="truncate text-xs text-white/30">
                              {[result.item.address?.neighbourhood, result.item.address?.suburb]
                                .filter(Boolean)
                                .join(", ") || "Bengaluru"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-xs text-green-400">✓</span>
                <p className="flex-1 truncate text-sm text-white/70">
                  {selected.source === "db" ? selected.data.name : shortName(selected.data)}
                </p>
                <button
                  onClick={() => {
                    setSelected(null);
                    setQuery("");
                  }}
                  className="text-xs text-white/25 transition hover:text-white/60"
                  type="button"
                >
                  change
                </button>
              </div>
            )}
          </div>

          <div
            className={`mb-8 w-full transition-opacity duration-300 ${
              selected ? "opacity-100" : "pointer-events-none opacity-30"
            }`}
          >
            <label className="mb-3 block text-[10px] uppercase tracking-widest text-white/30">
              02 -- Place category
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PLACE_CATEGORIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium capitalize transition ${
                    category === option
                      ? "border-white bg-white text-[#111]"
                      : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`mb-8 w-full transition-opacity duration-300 ${
              selected ? "opacity-100" : "pointer-events-none opacity-30"
            }`}
          >
            <label className="mb-3 block text-[10px] uppercase tracking-widest text-white/30">
              03 -- Your rating
            </label>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="text-3xl transition-transform hover:scale-110 active:scale-95"
                  style={{
                    color:
                      star <= (hoverRating || rating) ? "#FBBF24" : "rgba(255,255,255,0.12)",
                    transition: "color 150ms ease, transform 100ms ease",
                  }}
                  type="button"
                >
                  ★
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-1 self-center text-sm text-white/30">
                  {["", "Poor", "Okay", "Good", "Great", "Must visit"][rating]}
                </span>
              )}
            </div>
          </div>

          <div
            className={`mb-10 w-full transition-opacity duration-300 ${
              selected ? "opacity-100" : "pointer-events-none opacity-30"
            }`}
          >
            <label className="mb-2.5 block text-[10px] uppercase tracking-widest text-white/30">
              04 -- One line about it
            </label>
            <input
              type="text"
              value={review}
              onChange={(event) => setReview(event.target.value)}
              placeholder="Best masala dosa in the city, no contest."
              maxLength={120}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25"
            />
            <p className="mt-1.5 text-right text-xs text-white/20">{review.length}/120</p>
          </div>

          {error && (
            <p className="mb-4 w-full rounded-lg border border-red-400/15 bg-red-400/5 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}

          {status === "unauthenticated" && (
            <div className="mb-6 w-full rounded-xl border border-white/10 bg-white/3 px-5 py-4 text-center">
              <p className="mb-3 text-sm text-white/40">You need to be signed in to submit.</p>
              {standalone ? (
                <Link
                  href="/"
                  className="text-sm text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
                >
                  Go back and sign in →
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="text-sm text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
                >
                  Open sign-in →
                </button>
              )}
            </div>
          )}
        </div>

        <div className={standalone ? "mt-auto" : "border-t border-white/10 px-5 py-5"}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || status === "unauthenticated"}
            className="relative w-full overflow-hidden rounded-xl bg-white py-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-25"
            type="button"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin">⟳</span>
                Saving...
              </span>
            ) : (
              "Add to the map →"
            )}
          </button>

          <p className="mt-5 text-center text-xs leading-relaxed text-white/15">
            Your contribution goes live immediately and is visible to everyone on the map.
          </p>
        </div>
      </div>
    </div>
  );
}
