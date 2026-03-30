"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  addedBy?: string;
  createdAt?: string;
  area?: string;
  rating?: number;
  description?: string;
  location: { coordinates: [number, number] };
  openTime?: string;
  closeTime?: string;
  tags?: string[];
  creatorReview?: { _id?: string; userId?: string; text: string; author?: string; rating: number; createdAt?: string } | null;
  reviews?: Array<{ _id?: string; userId?: string; text: string; author?: string; rating: number; createdAt?: string }>;
};

type TimeOption = "morning" | "noon" | "evening" | "night";
type ValidationField = "place" | "category" | "rating" | "review";
type CategoryMode = "preset" | "custom";

type CategoryOption = {
  value: string;
  label: string;
  aliases: string[];
};

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "cafe", label: "Cafe", aliases: ["coffee", "coffee shop", "espresso", "brew"] },
  { value: "restaurant", label: "Restaurant", aliases: ["food", "dining", "dinner", "meal", "street food", "fast food"] },
  { value: "bakery", label: "Bakery", aliases: ["bakes", "pastry", "cakes", "bread"] },
  { value: "park", label: "Park", aliases: ["garden", "green", "playground"] },
  { value: "mall", label: "Mall", aliases: ["shopping mall", "mall road", "malls"] },
  { value: "shopping", label: "Shopping", aliases: ["store", "retail", "shop", "market", "marketplace"] },
  { value: "coworking", label: "Coworking", aliases: ["workspace", "co-working", "office"] },
  { value: "library", label: "Library", aliases: ["books", "reading"] },
  { value: "metro", label: "Metro", aliases: ["station", "subway", "train"] },
  { value: "bmtc", label: "BMTC", aliases: ["bus stop", "bus station", "bus"] },
  { value: "hospital", label: "Hospital", aliases: ["clinic", "medical", "healthcare"] },
  { value: "nightlife", label: "Nightlife", aliases: ["club", "clubs", "pub", "bar", "lounge"] },
];

const TIME_OPTIONS: TimeOption[] = ["morning", "noon", "evening", "night"];

const TIME_TAGS: Record<TimeOption, string> = {
  morning: "breakfast",
  noon: "lunch",
  evening: "snacks",
  night: "late-night",
};

const DEFAULT_CATEGORY_TIMES: Partial<Record<string, TimeOption[]>> = {
  cafe: ["morning", "evening"],
  restaurant: ["noon", "night"],
  bakery: ["morning", "evening"],
  park: ["morning", "evening"],
  coworking: ["noon"],
  nightlife: ["night"],
};

const ROAD_LIKE_TERMS = ["road", "street", "main road", "cross", "layout", "stage", "phase"];

const normalizeCategory = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const formatCategoryLabel = (value: string) =>
  value
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const inferTagsFromCategory = (category: string) =>
  (DEFAULT_CATEGORY_TIMES[category] ?? []).map((time) => TIME_TAGS[time]);

const scoreCategoryMatch = (input: string, option: CategoryOption) => {
  const normalizedInput = normalizeCategory(input);

  if (!normalizedInput) {
    return 0;
  }

  const candidates = [option.value, option.label, ...option.aliases].map((value) => normalizeCategory(value));

  return candidates.reduce((bestScore, candidate) => {
    if (!candidate) {
      return bestScore;
    }

    if (candidate === normalizedInput) {
      return Math.max(bestScore, 100);
    }

    if (candidate.includes(normalizedInput) || normalizedInput.includes(candidate)) {
      return Math.max(bestScore, 80);
    }

    const inputTokens = normalizedInput.split("-").filter(Boolean);
    const candidateTokens = candidate.split("-").filter(Boolean);
    const overlap = inputTokens.filter((token) => candidateTokens.includes(token)).length;

    if (overlap > 0) {
      return Math.max(bestScore, overlap * 20);
    }

    return bestScore;
  }, 0);
};

const categoryFromOSMType = (type: string) => {
  if (["cafe"].includes(type)) return "cafe";
  if (["restaurant", "fast_food"].includes(type)) return "restaurant";
  if (["bakery"].includes(type)) return "bakery";
  if (["bar", "pub", "nightclub"].includes(type)) return "nightlife";

  if (["park", "garden"].includes(type)) return "park";

  if (["station", "subway_entrance"].includes(type)) return "metro";
  if (["bus_stop", "bus_station"].includes(type)) return "bmtc";

  if (["library"].includes(type)) return "library";
  if (["college", "university", "office"].includes(type)) return "coworking";
  if (["hospital", "clinic"].includes(type)) return "hospital";

  if (["mall"].includes(type)) return "mall";
  if (["shop"].includes(type)) return "shopping";

  return "restaurant";
};

const requiredLabel = (label: string) => (
  <>
    {label} <span className="text-red-400">*</span>
  </>
);

const isRoadLike = (value?: string) => {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return ROAD_LIKE_TERMS.some((term) => normalizedValue.includes(term));
};

const shortName = (result: OSMResult, fallbackQuery?: string) => {
  const strongCandidate =
    result.name ||
    result.namedetails?.name ||
    result.namedetails?.["name:en"] ||
    result.namedetails?.brand ||
    result.extratags?.brand ||
    result.extratags?.name ||
    result.address?.amenity ||
    result.address?.shop ||
    result.address?.tourism;

  if (strongCandidate && !isRoadLike(strongCandidate)) {
    return strongCandidate;
  }

  const fallbackCandidate = result.address?.building || result.address?.neighbourhood || result.display_name.split(",")[0];

  if (fallbackCandidate && !isRoadLike(fallbackCandidate)) {
    return fallbackCandidate;
  }

  const cleanedQuery = fallbackQuery?.trim();

  if (cleanedQuery) {
    return cleanedQuery;
  }

  return strongCandidate || fallbackCandidate || result.address?.road || result.display_name.split(",")[0];
};

const shortArea = (result: OSMResult) =>
  [result.address?.neighbourhood, result.address?.suburb]
    .filter(Boolean)
    .slice(0, 1)
    .join("") || "";

const displayUserName = (value?: string | null) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "Explorer";
  }

  return trimmedValue.split(" ")[0] || "Explorer";
};

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
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("preset");
  const [category, setCategory] = useState("restaurant");
  const [customCategory, setCustomCategory] = useState("");
  const [bestTimes, setBestTimes] = useState<TimeOption[]>([]);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ValidationField, string>>>({});

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const customCategoryInputRef = useRef<HTMLInputElement>(null);
  const reviewInputRef = useRef<HTMLInputElement>(null);

  const effectiveCategory = useMemo(() => {
    if (categoryMode === "custom") {
      return normalizeCategory(customCategory);
    }

    return category;
  }, [category, categoryMode, customCategory]);

  const suggestedCategories = useMemo(() => {
    if (categoryMode !== "custom") {
      return [];
    }

    const normalizedCustomCategory = normalizeCategory(customCategory);

    if (!normalizedCustomCategory) {
      return [];
    }

    return CATEGORY_OPTIONS
      .map((option) => ({
        option,
        score: scoreCategoryMatch(customCategory, option),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ option }) => option);
  }, [categoryMode, customCategory]);

  const resetForm = () => {
    setQuery("");
    setSearchResults([]);
    setSearching(false);
    setSelected(null);
    setCategoryMode("preset");
    setCategory("restaurant");
    setCustomCategory("");
    setBestTimes([]);
    setRating(0);
    setHoverRating(0);
    setReview("");
    setSubmitting(false);
    setError("");
    setFieldErrors({});
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
    setFieldErrors((current) => ({ ...current, place: undefined }));

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
      const inferredCategory = categoryFromOSMType(item.item.type);
      setSelected({ source: "osm", data: item.item });
      setQuery(shortName(item.item, query));
      setCategoryMode("preset");
      setCategory(inferredCategory);
      setCustomCategory("");
      setBestTimes([]);
    }

    setSearchResults([]);
    setError("");
    setFieldErrors((current) => ({ ...current, place: undefined }));
  };

  const handlePresetCategorySelect = (nextCategory: string) => {
    setCategoryMode("preset");
    setCategory(nextCategory);
    setCustomCategory("");
    setError("");
    setFieldErrors((current) => ({ ...current, category: undefined }));
  };

  const handleCustomCategoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCategoryMode("custom");
    setCustomCategory(event.target.value);
    setError("");
    setFieldErrors((current) => ({ ...current, category: undefined }));
  };

  const focusFirstInvalidField = (errors: Partial<Record<ValidationField, string>>) => {
    if (errors.place) {
      inputRef.current?.focus();
      return;
    }

    if (errors.category) {
      if (categoryMode === "custom") {
        customCategoryInputRef.current?.focus();
      }
      return;
    }

    if (errors.review) {
      reviewInputRef.current?.focus();
    }
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<ValidationField, string>> = {};

    if (!selected) {
      nextErrors.place = "Please search and select a place from the list.";
    } else if (selected.source === "db") {
      nextErrors.place = "This place is already on the map. Please pick a new place.";
    }

    if (categoryMode === "custom") {
      if (!customCategory.trim()) {
        nextErrors.category = "Enter a category name or choose one of the suggested categories.";
      } else if (!effectiveCategory) {
        nextErrors.category = "Please use a category name with letters or numbers.";
      }
    } else if (!category) {
      nextErrors.category = "Please choose a category.";
    }

    if (!rating) {
      nextErrors.rating = "Please add a rating.";
    }

    if (!review.trim()) {
      nextErrors.review = "Please write a short review.";
    }

    return nextErrors;
  };

  const handleSubmit = async () => {
    const nextFieldErrors = validateForm();

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Please fill in the required fields before submitting.");
      focusFirstInvalidField(nextFieldErrors);
      return;
    }

    if (!session) {
      setError("You need to be signed in.");
      return;
    }

    if (!selected || selected.source !== "osm") {
      setError("Please select a valid place first.");
      return;
    }

    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      const osmPlace = selected.data;
      const tags = bestTimes.length
        ? bestTimes.map((time) => TIME_TAGS[time])
        : inferTagsFromCategory(effectiveCategory);
      const createRes = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: shortName(osmPlace, query),
          lat: parseFloat(osmPlace.lat),
          lng: parseFloat(osmPlace.lon),
          category: effectiveCategory,
          addedBy: displayUserName(session.user?.name),
          area: shortArea(osmPlace),
          rating,
          description: review.trim(),
          tags,
          osmId: String(osmPlace.place_id),
        }),
      });

      const responseData = await createRes.json().catch(() => null);

      if (!createRes.ok) {
        const responseError =
          responseData && typeof responseData.error === "string"
            ? responseData.error
            : "Failed to save place.";
        throw new Error(responseError);
      }

      const created = responseData as AddedPlace;

      resetForm();
      onSubmitted?.({
        ...created,
        category: effectiveCategory,
        addedBy: displayUserName(session.user?.name) || created.addedBy,
        rating,
        description: review.trim(),
        tags,
        creatorReview:
          created.creatorReview ?? {
            text: review.trim(),
            author: displayUserName(session.user?.name),
            rating,
          },
        reviews:
          created.reviews && created.reviews.length > 0
            ? created.reviews
            : [{ text: review.trim(), author: displayUserName(session.user?.name), rating }],
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

  const toggleBestTime = (time: TimeOption) => {
    setBestTimes((current) =>
      current.includes(time) ? current.filter((item) => item !== time) : [...current, time]
    );
  };

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

            <label className="mb-2.5 mt-8 block text-[10px] uppercase tracking-widest text-white">
              {requiredLabel("01 -- Find the place")}
            </label>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search by name, street, area..."
                className={`w-full rounded-xl border bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 ${
                  fieldErrors.place ? "border-red-400/60" : "border-white/10"
                }`}
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
                              {result.item.area} · {formatCategoryLabel(result.item.category)}
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

            {fieldErrors.place ? (
              <p className="mt-2 text-sm text-red-400">{fieldErrors.place}</p>
            ) : null}

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
            <label className="mb-3 block text-[10px] uppercase tracking-widest text-white">
              {requiredLabel("02 -- Place category")}
            </label>
            <div className="mb-3 flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePresetCategorySelect(option.value)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    categoryMode === "preset" && category === option.value
                      ? "border-white bg-white text-[#111]"
                      : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Can&apos;t find the right category?</p>
                  <p className="text-xs text-white/40">
                    Type your own and we&apos;ll suggest the closest existing categories first.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryMode("custom");
                    setTimeout(() => customCategoryInputRef.current?.focus(), 0);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    categoryMode === "custom"
                      ? "border-white bg-white text-[#111]"
                      : "border-white/10 text-white/70 hover:border-white/25 hover:text-white"
                  }`}
                >
                  Custom category
                </button>
              </div>

              <input
                ref={customCategoryInputRef}
                type="text"
                value={customCategory}
                onChange={handleCustomCategoryChange}
                placeholder="Example: bookstore, temple, gym, salon"
                className={`w-full rounded-xl border bg-[#0f0f0f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 ${
                  fieldErrors.category && categoryMode === "custom" ? "border-red-400/60" : "border-white/10"
                }`}
              />

              {suggestedCategories.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">
                    Closest existing categories
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCategories.map((option) => (
                      <button
                        key={`suggested-${option.value}`}
                        type="button"
                        onClick={() => handlePresetCategorySelect(option.value)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                      >
                        Use {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-white/35">
                    If these don&apos;t fit, we&apos;ll save your custom category as{" "}
                    <span className="text-white/70">
                      {effectiveCategory ? formatCategoryLabel(effectiveCategory) : "your own category"}
                    </span>.
                  </p>
                </div>
              ) : categoryMode === "custom" && customCategory.trim() ? (
                <p className="mt-3 text-xs text-white/35">
                  No close preset found. We&apos;ll save this as{" "}
                  <span className="text-white/70">
                    {effectiveCategory ? formatCategoryLabel(effectiveCategory) : customCategory.trim()}
                  </span>.
                </p>
              ) : null}
            </div>

            {fieldErrors.category ? (
              <p className="mt-2 text-sm text-red-400">{fieldErrors.category}</p>
            ) : null}
          </div>

          <div
            className={`mb-8 w-full transition-opacity duration-300 ${
              selected ? "opacity-100" : "pointer-events-none opacity-30"
            }`}
          >
            <label className="mb-3 block text-[10px] uppercase tracking-widest text-white">
              {requiredLabel("03 -- Your rating")}
            </label>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => {
                    setRating(star);
                    setFieldErrors((current) => ({ ...current, rating: undefined }));
                  }}
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
            {fieldErrors.rating ? (
              <p className="mt-2 text-sm text-red-400">{fieldErrors.rating}</p>
            ) : null}
          </div>

          <div
            className={`mb-10 w-full transition-opacity duration-300 ${
              selected ? "opacity-100" : "pointer-events-none opacity-30"
            }`}
          >
            <label className="mb-2.5 block text-[10px] uppercase tracking-widest text-white">
              {requiredLabel("04 -- One line about it")}
            </label>
            <input
              ref={reviewInputRef}
              type="text"
              value={review}
              onChange={(event) => {
                setReview(event.target.value);
                setFieldErrors((current) => ({ ...current, review: undefined }));
              }}
              placeholder="Best masala dosa in the city, no contest."
              maxLength={120}
              className={`w-full rounded-xl border bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 ${
                fieldErrors.review ? "border-red-400/60" : "border-white/10"
              }`}
            />
            <p className="mt-1.5 text-right text-xs text-white/20">{review.length}/120</p>
            {fieldErrors.review ? (
              <p className="mt-2 text-sm text-red-400">{fieldErrors.review}</p>
            ) : null}
          </div>

          <div
            className={`mb-10 w-full transition-opacity duration-300 ${
              selected ? "opacity-100" : "pointer-events-none opacity-30"
            }`}
          >
            <label className="mb-2.5 block text-[10px] uppercase tracking-widest text-white">
              05 -- Best time to visit (optional)
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIME_OPTIONS.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => toggleBestTime(time)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium capitalize transition ${
                    bestTimes.includes(time)
                      ? "border-white bg-white text-[#111]"
                      : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
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
            disabled={submitting || status === "unauthenticated"}
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
            Fields marked with * are required. Your contribution goes live immediately and is visible to everyone on the map.
          </p>
        </div>
      </div>
    </div>
  );
}
