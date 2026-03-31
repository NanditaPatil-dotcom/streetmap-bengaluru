"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { FiSearch, FiX } from "react-icons/fi";

type PlaceSearchResult = {
  _id?: string;
  name: string;
  category: string;
  area?: string;
  location: {
    coordinates: [number, number];
  };
  rating?: number;
  description?: string;
  openTime?: string;
  closeTime?: string;
  tags?: string[];
  addedBy?: string;
  createdAt?: string;
  reviews?: Array<{ _id?: string; userId?: string; text: string; author?: string; rating: number; createdAt?: string }>;
  creatorReview?: { _id?: string; userId?: string; text: string; author?: string; rating: number; createdAt?: string } | null;
  photos?: Array<string | { _id?: string; url?: string; src?: string; author?: string; userId?: string; createdAt?: string }>;
  menuImages?: Array<string | { _id?: string; url?: string; src?: string; author?: string; userId?: string; createdAt?: string }>;
};

type Props = {
  mapType: string;
  setMapType: (type: string) => void;
  onOpenAuth: () => void;
  onPlaceSelect: (place: PlaceSearchResult) => void;
};

export default function Navbar({ mapType, setMapType, onOpenAuth, onPlaceSelect }: Props) {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const types = [
    { value: "normal", label: "All Places" },
    { value: "cafe", label: "Cafe" },
    { value: "restaurant", label: "Restaurant" },
    { value: "park", label: "Park" },
    { value: "metro", label: "Metro" },
    { value: "bmtc", label: "BMTC" },
    { value: "mall", label: "Mall" },
    { value: "nightlife", label: "Nightlife" },
  ];

  useEffect(() => {
    if (!isSearchVisible) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsSearchVisible(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isSearchVisible]);

  useEffect(() => {
    if (!isSearchVisible) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isSearchVisible]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(trimmedQuery)}`);
        const data = response.ok ? await response.json() : [];
        setResults(Array.isArray(data) ? data : []);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  }, [query]);

  const formatCategory = (value: string) =>
    value
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const handleSelectResult = (place: PlaceSearchResult) => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setIsSearchVisible(false);
    onPlaceSelect(place);
  };

  const handleToggleSearch = () => {
    setIsSearchVisible((current) => {
      const nextValue = !current;

      if (!nextValue) {
        setIsOpen(false);
      }

      return nextValue;
    });
  };

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] -translate-x-1/2 px-1 md:left-[62.5%] md:w-[calc(78%-1.5rem)] md:max-w-[52rem]">
      <div ref={searchRef} className="pointer-events-auto flex flex-col gap-2">
        <div className="flex flex-col gap-2 rounded-[2rem] bg-[#222222]/95 px-3 py-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] ring-1 ring-black/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:flex-1">
            <div className="flex flex-wrap items-center justify-start gap-1.5">
              {types.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setMapType(type.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium tracking-tight transition ${
                    mapType === type.value
                      ? "bg-white text-[#111111]"
                      : "text-white/78 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={handleToggleSearch}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10"
              aria-label={isSearchVisible ? "Close place search" : "Open place search"}
              aria-expanded={isSearchVisible}
              aria-controls="navbar-place-search"
            >
              {isSearchVisible ? <FiX className="h-4 w-4" /> : <FiSearch className="h-4 w-4" />}
            </button>

            {status === "authenticated" && session.user ? (
              <>
                <span className="hidden text-sm text-white/72 md:inline">
                  Hi, {session.user.name?.split(" ")[0] || "Explorer"}
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="rounded-full bg-[#f4f0e8] px-4 py-1.5 text-sm font-medium text-[#111111] transition hover:scale-[1.02]"
              >
                {status === "loading" ? "Loading..." : "Sign in"}
              </button>
            )}
          </div>
        </div>

        {isSearchVisible ? (
          <div
            id="navbar-place-search"
            className="relative rounded-[1.75rem] bg-[#222222]/95 px-3 py-3 text-white shadow-[0_18px_40px_rgba(0,0,0,0.24)] ring-1 ring-black/10 backdrop-blur"
          >
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (!isOpen) {
                    setIsOpen(true);
                  }
                }}
                onFocus={() => {
                  if (results.length > 0 || query.trim().length >= 2) {
                    setIsOpen(true);
                  }
                }}
                placeholder="Search a specific place..."
                className="w-full rounded-full border border-white/10 bg-white/5 px-11 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/25"
              />

              {isSearching ? (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/35">
                  ...
                </span>
              ) : null}
            </div>

            {isOpen && (results.length > 0 || query.trim().length >= 2) ? (
              <div className="absolute left-3 right-3 top-[calc(100%+0.5rem)] z-[1010] overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-2xl">
                {results.length > 0 ? (
                  results.map((place) => (
                    <button
                      key={place._id ?? `${place.name}-${place.area ?? ""}`}
                      type="button"
                      onClick={() => handleSelectResult(place)}
                      className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 last:border-b-0"
                    >
                      <span className="mt-0.5 text-sm text-white/60">📍</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{place.name}</p>
                        <p className="truncate text-xs text-white/40">
                          {formatCategory(place.category)}
                          {place.area ? ` · ${place.area}` : ""}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-white/45">
                    No places found. Try another name or area.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
