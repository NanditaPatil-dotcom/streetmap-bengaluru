"use client";
import { useState, useRef, useEffect, useCallback } from "react";

type DBPlace = {
  _id: string;
  name: string;
  category: string;
  area: string;
  rating?: number;
  location: { coordinates: [number, number] };
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
  };
};

type SearchResult =
  | { source: "db"; place: DBPlace }
  | { source: "osm"; result: NominatimResult };

type Props = {
  onFlyTo: (lat: number, lng: number) => void;
  onPlaceSelect: (place: DBPlace) => void;
};

export default function SearchSidebar({ onFlyTo, onPlaceSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 280);
    } else {
      setQuery("");
      setResults([]);
      setEmpty(false);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setEmpty(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setEmpty(false);

    try {
      // 1. Your own MongoDB — no CORS issue, same origin
      const dbRes = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      const dbPlaces: DBPlace[] = dbRes.ok ? await dbRes.json() : [];

      // 2. Nominatim via YOUR proxy route — no CORS issue
      const osmRes = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const osmData: NominatimResult[] = osmRes.ok ? await osmRes.json() : [];

      const combined: SearchResult[] = [
        ...dbPlaces.map((p) => ({ source: "db" as const, place: p })),
        ...osmData.map((r) => ({ source: "osm" as const, result: r })),
      ];

      setResults(combined);
      setEmpty(combined.length === 0);
    } catch (err) {
      console.error("Search error:", err);
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 420);
  };

  const handleSelect = (item: SearchResult) => {
    if (item.source === "db") {
      const [lng, lat] = item.place.location.coordinates;
      onFlyTo(lat, lng);
      onPlaceSelect(item.place);
    } else {
      onFlyTo(parseFloat(item.result.lat), parseFloat(item.result.lon));
    }
    setOpen(false);
  };

  const getIcon = (item: SearchResult) => {
    if (item.source === "db") {
      const cat = item.place.category;
      if (cat === "cafe") return "☕";
      if (cat === "park") return "🌳";
      if (cat === "metro") return "🚇";
      if (cat === "bmtc") return "🚌";
      return "📍";
    }
    const t = item.result.type;
    if (t === "park" || t === "garden") return "🌳";
    if (t === "cafe" || t === "restaurant" || t === "fast_food") return "☕";
    if (t === "bus_stop") return "🚌";
    if (t === "station" || t === "subway_entrance") return "🚇";
    return "📍";
  };

  const getTitle = (item: SearchResult) =>
    item.source === "db"
      ? item.place.name
      : item.result.display_name.split(",")[0];

  const getSubtitle = (item: SearchResult) => {
    if (item.source === "db") {
      const parts = [item.place.area, item.place.category].filter(Boolean);
      const rating = item.place.rating ? `★ ${item.place.rating}` : "";
      return [parts.join(" · "), rating].filter(Boolean).join("  ");
    }
    const addr = item.result.address;
    return [addr?.neighbourhood, addr?.suburb]
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") || "Bengaluru";
  };

  const dbResults = results.filter((r) => r.source === "db");
  const osmResults = results.filter((r) => r.source === "osm");

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[990]"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed bottom-6 left-6 z-[1000] flex items-end">
        {/* Collapsible sidebar */}
        <div
          style={{
            transition:
              "width 300ms cubic-bezier(0.4,0,0.2,1), opacity 250ms ease, margin 300ms ease",
          }}
          className={`
            bg-[#111]/95 backdrop-blur-md border border-white/10
            rounded-2xl shadow-2xl flex flex-col overflow-hidden
            ${open
              ? "w-72 opacity-100 mr-3 max-h-[460px]"
              : "w-0 opacity-0 mr-0 max-h-0 border-0 pointer-events-none"
            }
          `}
        >
          {/* Input */}
          <div className="px-4 pt-4 pb-3 border-b border-white/5 shrink-0">
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2.5">
              Find a place
            </p>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                placeholder="Cubbon Park, CTR, Koramangala…"
                className="
                  w-full bg-white/5 border border-white/10 rounded-xl
                  px-3 py-2.5 pr-8 text-sm text-white placeholder-white/20
                  outline-none focus:border-white/25 transition
                "
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-[10px] animate-pulse">
                  ···
                </span>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1 py-1">
            {!loading && query.length < 2 && (
              <p className="text-white/20 text-xs text-center py-8 px-4 leading-relaxed">
                Search any street, landmark,<br />or place in Bengaluru.
              </p>
            )}

            {!loading && empty && (
              <p className="text-white/30 text-sm text-center py-8 px-4">
                No results found.
              </p>
            )}

            {dbResults.length > 0 && (
              <p className="text-white/20 text-[10px] uppercase tracking-widest px-4 pt-3 pb-1">
                In our catalogue
              </p>
            )}
            {dbResults.map((item, i) => (
              <button
                key={`db-${i}`}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3"
              >
                <span className="text-sm shrink-0">{getIcon(item)}</span>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium leading-tight truncate">
                    {getTitle(item)}
                  </p>
                  <p className="text-white/35 text-xs mt-0.5 truncate">
                    {getSubtitle(item)}
                  </p>
                </div>
                <span className="shrink-0 text-[9px] text-white/25 border border-white/10 rounded-full px-1.5 py-0.5 ml-auto">
                  local
                </span>
              </button>
            ))}

            {osmResults.length > 0 && (
              <p className="text-white/20 text-[10px] uppercase tracking-widest px-4 pt-3 pb-1 border-t border-white/5 mt-1">
                OpenStreetMap
              </p>
            )}
            {osmResults.map((item, i) => (
              <button
                key={`osm-${i}`}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3"
              >
                <span className="text-sm shrink-0">{getIcon(item)}</span>
                <div className="min-w-0">
                  <p className="text-white/80 text-sm leading-tight truncate">
                    {getTitle(item)}
                  </p>
                  <p className="text-white/30 text-xs mt-0.5 truncate">
                    {getSubtitle(item)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* + / × button */}
        <button
          onClick={() => setOpen((p) => !p)}
          style={{
            transition:
              "transform 300ms cubic-bezier(0.4,0,0.2,1), background 200ms ease",
          }}
          className={`
            w-12 h-12 rounded-full shadow-xl border border-white/15
            flex items-center justify-center shrink-0 select-none
            ${open
              ? "bg-white text-black rotate-45"
              : "bg-[#111]/95 backdrop-blur-md text-white hover:bg-white/10"
            }
          `}
        >
          <span className="text-2xl font-light leading-none">+</span>
        </button>
      </div>
    </>
  );
}