"use client";

import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

type FiltersState = {
  areas: string[];
  openNow: boolean;
  tag: string;
  rating: string;
};

type AreaSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
  addresstype?: string;
  type?: string;
  class?: string;
  name?: string;
};

type SelectedArea = {
  label: string;
  normalizedArea: string;
  center: [number, number];
  bounds?: [[number, number], [number, number]];
  source: "search" | "suggested";
};

type AreaFeedback = {
  kind: "exact" | "nearby" | "empty";
  label: string;
  message: string;
  resultCount: number;
};

type Props = {
  filters: FiltersState;
  setFilters: (filters: FiltersState) => void;
  onAreaFocus: (area: SelectedArea | null) => void;
  areaFeedback: AreaFeedback | null;
  onOpenAddPlace: () => void;
  onOpenDiscover: () => void;
};

type SectionId = "location";

const filterSections: {
  id: SectionId;
  label: string;
  helper: string;
}[] = [
  { id: "location", label: "Location", helper: "Area" },
];

const locationOptions = [
  "Indiranagar",
  "Koramangala",
  "Jayanagar",
  "Whitefield",
  "HSR Layout",
  "MG Road",
  "Church Street",
  "Electronic City",
];

const AREA_LIKE_ADDRESSTYPES = new Set([
  "suburb",
  "neighbourhood",
  "quarter",
  "city_district",
  "residential",
  "locality",
  "town",
  "village",
]);

const suggestedTags = [
  "breakfast",
  "coffee",
  "dessert",
  "dinner",
  "park",
  "late-night",
];

const ratingMin = 0;
const ratingMax = 5;
const ratingStep = 1;

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatAreaLabel = (result: AreaSuggestion) => {
  const primary = result.name?.trim() || result.display_name.split(",")[0]?.trim() || "Area";
  const secondary = result.display_name
    .split(",")
    .slice(1, 3)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  return secondary ? `${primary} · ${secondary}` : primary;
};

const mapSuggestionToSelectedArea = (
  label: string,
  normalizedArea: string,
  lat: number,
  lon: number,
  boundingbox?: [string, string, string, string],
  source: "search" | "suggested" = "search"
): SelectedArea => {
  const bounds =
    boundingbox && boundingbox.length === 4
      ? ([
          [Number(boundingbox[2]), Number(boundingbox[0])],
          [Number(boundingbox[3]), Number(boundingbox[1])],
        ] as [[number, number], [number, number]])
      : undefined;

  return {
    label,
    normalizedArea,
    center: [lon, lat],
    bounds,
    source,
  };
};

export default function Filters({
  filters,
  setFilters,
  onAreaFocus,
  areaFeedback,
  onOpenAddPlace,
  onOpenDiscover,
}: Props) {
  const [openSection, setOpenSection] = useState<SectionId | null>("location");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaResults, setAreaResults] = useState<AreaSuggestion[]>([]);
  const [selectedAreaLabel, setSelectedAreaLabel] = useState("");
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const [isAreaSearching, setIsAreaSearching] = useState(false);
  const areaSearchRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratingValue = filters.rating ? Number(filters.rating) : ratingMin;
  const ratingProgress =
    ((ratingValue - ratingMin) / (ratingMax - ratingMin)) * 100;

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!areaSearchRef.current?.contains(event.target as Node)) {
        setIsAreaDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const searchAreas = async (query: string) => {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = response.ok ? ((await response.json()) as AreaSuggestion[]) : [];

    return Array.isArray(data)
      ? data.filter(
          (result) =>
            AREA_LIKE_ADDRESSTYPES.has(result.addresstype || "") ||
            ["place", "boundary", "landuse"].includes(result.class || "")
        )
      : [];
  };

  useEffect(() => {
    const trimmedQuery = areaQuery.trim();

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (trimmedQuery.length < 2) {
      setAreaResults([]);
      setIsAreaSearching(false);
      return;
    }

    setIsAreaSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const nextResults = await searchAreas(trimmedQuery);
        setAreaResults(nextResults);
        setIsAreaDropdownOpen(true);
      } catch {
        setAreaResults([]);
      } finally {
        setIsAreaSearching(false);
      }
    }, 250);
  }, [areaQuery]);

  const applyAreaSelection = (area: SelectedArea) => {
    setFilters({
      ...filters,
      areas: [area.normalizedArea],
    });
    setSelectedAreaLabel(area.label);
    setAreaQuery(area.label);
    setAreaResults([]);
    setIsAreaDropdownOpen(false);
    onAreaFocus(area);
  };

  const handleAreaResultSelect = (result: AreaSuggestion) => {
    const label = formatAreaLabel(result);
    applyAreaSelection(
      mapSuggestionToSelectedArea(
        label,
        (result.name?.trim() || result.display_name.split(",")[0] || "").toLowerCase(),
        Number(result.lat),
        Number(result.lon),
        result.boundingbox,
        "search"
      )
    );
  };

  const handleSuggestedAreaSelect = (area: string) => {
    setAreaQuery(area);
    setIsAreaSearching(true);
    void searchAreas(area)
      .then((results) => {
        const match =
          results.find(
            (result) =>
              (result.name?.trim() || result.display_name.split(",")[0] || "").toLowerCase() ===
              area.toLowerCase()
          ) || results[0];

        if (match) {
          handleAreaResultSelect(match);
          return;
        }

        applyAreaSelection(
          mapSuggestionToSelectedArea(area, area.toLowerCase(), 12.9716, 77.5946, undefined, "suggested")
        );
      })
      .catch(() => {
        applyAreaSelection(
          mapSuggestionToSelectedArea(area, area.toLowerCase(), 12.9716, 77.5946, undefined, "suggested")
        );
      })
      .finally(() => setIsAreaSearching(false));
  };

  const handleAreaEnter = () => {
    if (areaResults.length > 0) {
      handleAreaResultSelect(areaResults[0]);
    }
  };

  const shouldShowAreaHelper =
    areaQuery.trim().length > 0 &&
    filters.areas.length === 0 &&
    !isAreaSearching;

  const clearAreaSelection = () => {
    setFilters({
      ...filters,
      areas: [],
    });
    setSelectedAreaLabel("");
    setAreaQuery("");
    setAreaResults([]);
    setIsAreaDropdownOpen(false);
    onAreaFocus(null);
  };

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 top-0 z-[1000] w-full p-0 md:w-[28%] md:min-w-[380px] md:max-w-[620px]">
      <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-none bg-[#222222] p-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] ring-1 ring-black/10 backdrop-blur md:border-r md:border-white/10">
        <div className="mb-4 border-b border-white/8 pb-4">
          <div className="text-center">
            <p className="text-sm font-semibold tracking-tight">Refine Results</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Use these once you already know roughly what you want. If you want help choosing,
              use the Discover button.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rounded-[1.5rem]">
          <div className="px-4 py-3">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <p className="text-sm font-semibold text-white/92">Open Now</p>
              <input
                type="checkbox"
                checked={filters.openNow || false}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    openNow: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded bg-transparent accent-white"
              />
            </label>
          </div>

          {filterSections.map((section) => {
            const isOpen = openSection === section.id;

            return (
              <div
                key={section.id}
                className="last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => setOpenSection(isOpen ? null : section.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/6"
                >
                  <div>
                    <p className="text-sm font-semibold text-white/92">
                      {section.label}
                    </p>
                    <p className="text-xs text-white/45">{section.helper}</p>
                  </div>

                  {isOpen ? (
                    <FiChevronDown className="h-4 w-4 text-white/70" />
                  ) : (
                    <FiChevronRight className="h-4 w-4 text-white/70" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 py-4">
                    {section.id === "location" && (
                      <div>
                        <div ref={areaSearchRef} className="relative">
                          <input
                            type="text"
                            value={areaQuery}
                            onChange={(event) => {
                              setAreaQuery(event.target.value);
                              if (!isAreaDropdownOpen) {
                                setIsAreaDropdownOpen(true);
                              }
                            }}
                            onFocus={() => {
                              if (areaResults.length > 0) {
                                setIsAreaDropdownOpen(true);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleAreaEnter();
                              }
                            }}
                            placeholder="Search a locality or region..."
                            className="w-full rounded-2xl bg-white/4 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:bg-white/8"
                          />

                          {isAreaSearching ? (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/35">
                              ...
                            </span>
                          ) : null}

                          {isAreaDropdownOpen && areaResults.length > 0 ? (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-2xl">
                              {areaResults.map((result) => (
                                <button
                                  key={result.place_id}
                                  type="button"
                                  onClick={() => handleAreaResultSelect(result)}
                                  className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 last:border-b-0"
                                >
                                  <span className="mt-0.5 text-sm text-white/55">⌖</span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-white">
                                      {result.name?.trim() || result.display_name.split(",")[0]}
                                    </p>
                                    <p className="truncate text-xs text-white/40">
                                      {result.display_name}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {shouldShowAreaHelper ? (
                          <p className="mt-2 text-xs text-white/45">
                            Pick an area from the suggestions to apply it. Press Enter to use the
                            top match.
                          </p>
                        ) : null}

                        {selectedAreaLabel ? (
                          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/8 px-3 py-2.5">
                            <span className="text-xs text-white/45">Area</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                              {selectedAreaLabel}
                            </span>
                            <button
                              type="button"
                              onClick={clearAreaSelection}
                              className="text-xs text-white/45 transition hover:text-white"
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}

                        {areaFeedback ? (
                          <div
                            className={`mt-3 rounded-2xl border px-4 py-3 ${
                              areaFeedback.kind === "exact"
                                ? "border-white/10 bg-white/6"
                                : areaFeedback.kind === "nearby"
                                  ? "border-amber-300/20 bg-amber-300/10"
                                  : "border-white/10 bg-white/6"
                            }`}
                          >
                            <p className="text-sm font-medium text-white">
                              {areaFeedback.kind === "exact"
                                ? `${areaFeedback.resultCount} place${areaFeedback.resultCount !== 1 ? "s" : ""} in ${areaFeedback.label}`
                                : areaFeedback.kind === "nearby"
                                  ? `Limited coverage in ${areaFeedback.label}`
                                  : `No saved places in ${areaFeedback.label} yet`}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-white/55">
                              {areaFeedback.message}
                            </p>
                            {(areaFeedback.kind === "nearby" || areaFeedback.kind === "empty") && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={onOpenAddPlace}
                                  className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#111111] transition hover:bg-white/90"
                                >
                                  Add the first place here
                                </button>
                                <button
                                  type="button"
                                  onClick={onOpenDiscover}
                                  className="rounded-full bg-white/6 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/12 hover:text-white"
                                >
                                  Switch to Discover
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}

                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                            Popular areas
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {locationOptions.map((area) => {
                              const isActive = filters.areas.includes(area.toLowerCase());

                              return (
                                <button
                                  key={area}
                                  type="button"
                                  onClick={() => handleSuggestedAreaSelect(area)}
                                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                    isActive
                                      ? "bg-white text-[#111111]"
                                      : "bg-white/4 text-white/75 hover:bg-white/12 hover:text-white"
                                  }`}
                                >
                                  {titleCase(area)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}

          <div className="px-4 py-4">
            <p className="mb-2 text-sm font-semibold text-white/90">
              Min Rating
            </p>
            <div className="p-4">
              <div className="relative pt-10">
                {ratingValue > ratingMin && (
                  <div
                    className="absolute top-0 -translate-x-1/2 rounded-xl px-2.5 py-1 text-xs font-medium text-white"
                    style={{
                      left: `calc(${ratingProgress}% + ${8 - ratingProgress * 0.16}px)`,
                    }}
                  >
                    {ratingValue}
                  </div>
                )}

                <input
                  type="range"
                  min={ratingMin}
                  max={ratingMax}
                  step={ratingStep}
                  value={ratingValue}
                  onChange={(e) => {
                    const nextValue = Number(e.target.value);

                    setFilters({
                      ...filters,
                      rating: nextValue <= ratingMin ? "" : String(nextValue),
                    });
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#d9d6ff] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(217,214,255,0.16)] [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#d9d6ff] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(217,214,255,0.16)]"
                  style={{
                    background: `linear-gradient(to right, #d9d6ff 0%, #d9d6ff ${ratingProgress}%, rgba(255,255,255,0.2) ${ratingProgress}%, rgba(255,255,255,0.2) 100%)`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="px-4 py-4">
            <p className="mb-2 text-sm font-semibold text-white/90">Tags</p>
            <input
              type="text"
              placeholder="e.g. breakfast"
              value={filters.tag || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  tag: e.target.value.toLowerCase(),
                })
              }
              className="w-full rounded-2xl bg-white/4 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:bg-white/4"
            />
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                Suggested
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedTags.map((tag) => {
                  const isActive = filters.tag === tag;

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setFilters({
                          ...filters,
                          tag: isActive ? "" : tag,
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? "bg-white text-[#111111]"
                          : "bg-white/4 text-white/75 hover:bg-white/12 hover:text-white"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
