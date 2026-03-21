"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Filters from "@/components/Filters";
import FooterModes from "@/components/FooterModes";
import AuthModal from "@/components/AuthModal";
import { useRouter } from "next/navigation";
import RecommendButton from "@/components/RecommendButton";

// DO NOT call hooks outside component body.

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

const handleFlyTo = (lat: number, lng: number) => {
  // In this setup, we don't have a mapRef exposed from Map component yet.
  // Just log and continue; map move will still be handled by Map component itself in future.
  console.debug("flyTo requested", { lat, lng });
};

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
  area?: string;
  location: {
    coordinates: [number, number];
  };
  openTime?: string;
  closeTime?: string;
  description?: string;
  tags?: string[];
};

export default function Home() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mapType, setMapType] = useState("normal");
  const [modeEnabled, setModeEnabled] = useState(true);
  const [mode, setMode] = useState(getCurrentMode());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
        setPlaces(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to fetch places", err);
        setPlaces([]);
      });
  }, [mapType, modeEnabled, mode, filters]);

  return (
    <div className="h-screen w-full">
      <Navbar
        mapType={mapType}
        setMapType={setMapType}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />
      <Filters filters={filters} setFilters={setFilters} />
      <FooterModes
        modeEnabled={modeEnabled}
        setModeEnabled={setModeEnabled}
        mode={mode}
        setMode={setMode}
      />
      <Map places={places} mapRef={mapRef} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <button
        onClick={() => router.push("/add")}
        className="
        fixed bottom-6 left-6 z-[1000]
        w-12 h-12 rounded-full
        bg-[#111]/95 backdrop-blur-md border border-white/15
        text-white text-2xl font-light
        flex items-center justify-center
        hover:bg-white hover:text-black
        transition-all duration-200 shadow-xl select-none
        "
        >
        +
      </button>

       {/* ✦ Recommend button — bottom right, self-contained */}
      <RecommendButton
        onPlaceSelect={setSelectedPlace}
        mapRef={mapRef}
      />
    
    </div>
  );
}
