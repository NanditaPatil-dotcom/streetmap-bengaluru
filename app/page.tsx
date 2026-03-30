"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import AddPlaceForm, { type AddedPlace } from "@/components/AddPlaceForm";
import Navbar from "@/components/Navbar";
import Filters from "@/components/Filters";
import FooterModes from "@/components/FooterModes";
import AuthModal from "@/components/AuthModal";
import RecommendButton from "@/components/RecommendButton";
import PlacePopup from "@/components/PlacePopup";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

function getCurrentMode() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "noon";
  if (hour >= 16 && hour < 20) return "evening";
  return "night";
}


type Place = {
  _id?: string;
  name: string;
  category: string;
  addedBy?: string;
  createdAt?: string;
  area?: string;
  location: {
    coordinates: [number, number];
  };
  rating?: number;
  openTime?: string;
  closeTime?: string;
  description?: string;
  overview?: string;
  tags?: string[];
  images?: Array<string | { url?: string; src?: string; alt?: string; label?: string; title?: string }>;
  photos?: Array<string | { url?: string; src?: string; alt?: string; label?: string; title?: string }>;
  menu?: Array<string | { url?: string; src?: string; alt?: string; label?: string; title?: string }>;
  menuImages?: Array<string | { url?: string; src?: string; alt?: string; label?: string; title?: string }>;
  creatorReview?: { text: string; author?: string; rating: number; createdAt?: string } | null;
  reviews?: Array<{ text: string; author?: string; rating: number; createdAt?: string }>;
  reviewCount?: number;
};

type ViewportFocusRequest = {
  ids: string[];
  reason: "filters";
  requestKey: number;
};

type RegionFocusRequest = {
  label?: string;
  normalizedArea?: string;
  center: [number, number];
  bounds?: [[number, number], [number, number]];
  requestKey: number;
};

type AreaFeedback = {
  kind: "exact" | "nearby" | "empty";
  label: string;
  message: string;
  resultCount: number;
} | null;

export default function Home() {
  const mapRef = useRef<MapRef | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [mapType, setMapType] = useState("normal");
  const [modeEnabled, setModeEnabled] = useState(true);
  const [mode, setMode] = useState(getCurrentMode());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAddSidebarOpen, setIsAddSidebarOpen] = useState(false);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [viewportFocusRequest, setViewportFocusRequest] = useState<ViewportFocusRequest | null>(null);
  const [regionFocusRequest, setRegionFocusRequest] = useState<RegionFocusRequest | null>(null);
  const [areaFeedback, setAreaFeedback] = useState<AreaFeedback>(null);

  const [filters, setFilters] = useState({
    areas: [] as string[],
    openNow: false,
    tag: "",
    rating: "",
  });


  useEffect(() => {
    const params = new URLSearchParams();

    if (mapType !== "normal") {
      params.set("category", mapType);
    }

    // mode (footer)
    if (modeEnabled && mode) {
      params.set("mode", mode);
    }

    if (filters.areas.length) {
      params.set("area", filters.areas.join(","));
    }

    if (regionFocusRequest) {
      params.set("areaLabel", regionFocusRequest.label || filters.areas[0] || "");
      params.set("areaLat", String(regionFocusRequest.center[1]));
      params.set("areaLng", String(regionFocusRequest.center[0]));

      if (regionFocusRequest.bounds) {
        params.set("minLng", String(regionFocusRequest.bounds[0][0]));
        params.set("minLat", String(regionFocusRequest.bounds[0][1]));
        params.set("maxLng", String(regionFocusRequest.bounds[1][0]));
        params.set("maxLat", String(regionFocusRequest.bounds[1][1]));
      }
    }

    if (filters.openNow) {
      params.set("openNow", "true");
    }

    if (filters.tag) {
      params.set("tag", filters.tag);
    }

    if (filters.rating) {
      params.set("rating", filters.rating);
    }

    const queryString = params.toString();
    const url = queryString ? `/api/places?${queryString}` : "/api/places";

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        console.log("Final Query:", url, data);
        const nextPlaces = Array.isArray(data) ? data : Array.isArray(data?.places) ? data.places : [];
        setPlaces(nextPlaces);
        setAreaFeedback(data?.meta?.area ?? null);
        setViewportFocusRequest({
          ids: nextPlaces
            .map((place: Place, index: number) => place._id ?? `${place.name}-${index}`)
            .filter((value: string) => Boolean(value)),
          reason: "filters",
          requestKey: Date.now(),
        });
      })
      .catch((err) => {
        console.error("Failed to fetch places", err);
        setPlaces([]);
        setAreaFeedback(null);
        setViewportFocusRequest(null);
      });
  }, [mapType, modeEnabled, mode, filters, regionFocusRequest]);

  const visibleSelectedPlace = useMemo(() => {
    if (!selectedPlace?._id) {
      return selectedPlace;
    }

    return places.find((place) => place._id === selectedPlace._id) ?? selectedPlace;
  }, [places, selectedPlace]);

  const handlePlaceAdded = (place: AddedPlace) => {
    setPlaces((currentPlaces) => {
      const nextPlaces = currentPlaces.filter((currentPlace) => currentPlace._id !== place._id);
      return [place, ...nextPlaces];
    });
    setActivePlaceId(place._id);
    setSelectedPlace(place);
    setIsAddSidebarOpen(false);
  };

  const handlePlaceSelect = (place: Place | null) => {
    setSelectedPlace(place);
    setActivePlaceId(place?._id ?? null);
    if (place) {
      setIsAddSidebarOpen(false);
    }
  };

  const handleGlobalPlaceSelect = (place: Place) => {
    if (place._id) {
      setPlaces((currentPlaces) => {
        const existingPlace = currentPlaces.find((currentPlace) => currentPlace._id === place._id);

        if (existingPlace) {
          return currentPlaces.map((currentPlace) =>
            currentPlace._id === place._id ? { ...currentPlace, ...place } : currentPlace
          );
        }

        return [place, ...currentPlaces];
      });
    }

    setSelectedPlace(place);
    setActivePlaceId(place._id ?? null);
    setIsAddSidebarOpen(false);
  };

  const handlePlaceUpdated = (updatedPlace: Partial<Place> & { _id?: string }) => {
    if (!updatedPlace._id) {
      return;
    }

    setPlaces((currentPlaces) =>
      currentPlaces.map((place) =>
        place._id === updatedPlace._id ? { ...place, ...updatedPlace } : place
      )
    );

    setSelectedPlace((currentPlace) =>
      currentPlace?._id === updatedPlace._id
        ? ({ ...currentPlace, ...updatedPlace } as Place)
        : currentPlace
    );
  };

  const handleAreaFocus = (area: {
    label?: string;
    normalizedArea?: string;
    center: [number, number];
    bounds?: [[number, number], [number, number]];
  } | null) => {
    setRegionFocusRequest(
      area
        ? {
            label: area.label,
            normalizedArea: area.normalizedArea,
            center: area.center,
            bounds: area.bounds,
            requestKey: Date.now(),
          }
        : null
    );
    if (!area) {
      setAreaFeedback(null);
    }
  };

  const handleOpenDiscover = () => {
    window.dispatchEvent(new CustomEvent("streetmap:open-discover"));
  };

  return (
    <div className="h-screen w-full">
      <div className="pointer-events-none absolute left-1/2 top-4 z-[1010] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] -translate-x-1/2 px-1 md:left-[62.5%] md:w-[calc(78%-1.5rem)] md:max-w-[52rem]">
        <div className="relative h-0">
          <button
            onClick={() => {
              setSelectedPlace(null);
              setActivePlaceId(null);
              setIsAddSidebarOpen(true);
            }}
            className="pointer-events-auto absolute right-0 top-[5.2rem] flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#111]/95 text-2xl font-light text-white shadow-xl backdrop-blur-md transition-all duration-200 hover:bg-white hover:text-black sm:top-1 sm:translate-x-[calc(100%+0.5rem)]"
            aria-label="Open add place sidebar"
            aria-controls="add-place-sidebar"
          >
            +
          </button>
        </div>
      </div>
      <Navbar
        mapType={mapType}
        setMapType={setMapType}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onPlaceSelect={handleGlobalPlaceSelect}
      />
      <Filters
        filters={filters}
        setFilters={setFilters}
        onAreaFocus={handleAreaFocus}
        areaFeedback={areaFeedback}
        onOpenAddPlace={() => {
          setSelectedPlace(null);
          setActivePlaceId(null);
          setIsAddSidebarOpen(true);
        }}
        onOpenDiscover={handleOpenDiscover}
      />
      <FooterModes
        modeEnabled={modeEnabled}
        setModeEnabled={setModeEnabled}
        mode={mode}
        setMode={setMode}
      />
      <Map
        places={places}
        mapRef={mapRef}
        activePlaceId={activePlaceId}
        regionFocusRequest={regionFocusRequest}
        viewportFocusRequest={viewportFocusRequest}
        onPlaceSelect={handlePlaceSelect}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <div
        className={`fixed inset-0 z-[1090] bg-black/30 transition-opacity duration-300 ${
          isAddSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsAddSidebarOpen(false)}
        aria-hidden={!isAddSidebarOpen}
      />
      <aside
        id="add-place-sidebar"
        className={`fixed right-0 top-0 z-[1100] h-screen w-full max-w-md border-l border-white/10 bg-[#0c0c0c]/98 shadow-[-24px_0_60px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-transform duration-300 ease-out ${
          isAddSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isAddSidebarOpen}
      >
        <AddPlaceForm
          onClose={() => setIsAddSidebarOpen(false)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSubmitted={handlePlaceAdded}
        />
      </aside>

      <div
        className={`fixed inset-0 z-[1110] bg-black/20 transition-opacity duration-300 ${
          visibleSelectedPlace ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => handlePlaceSelect(null)}
        aria-hidden={!visibleSelectedPlace}
      />
      <aside
        id="place-details-sidebar"
        className={`fixed right-0 top-0 z-[1120] h-screen w-full max-w-md border-l border-[#d5c7b6] shadow-[-24px_0_60px_rgba(27,20,14,0.2)] transition-transform duration-300 ease-out ${
          visibleSelectedPlace ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!visibleSelectedPlace}
      >
        {visibleSelectedPlace ? (
          <PlacePopup
            place={visibleSelectedPlace}
            variant="sidebar"
            onClose={() => handlePlaceSelect(null)}
            onPlaceUpdated={(updatedFields) =>
              handlePlaceUpdated({ _id: visibleSelectedPlace._id, ...updatedFields })
            }
          />
        ) : null}
      </aside>

       {/* ✦ Recommend button — bottom right, self-contained */}
      <RecommendButton
        onPlaceSelect={handlePlaceSelect}
        mapRef={mapRef}
      />
    
    </div>
  );
}
