"use client";

import PlacePopup from "@/components/PlacePopup";
import { useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const categoryColors = {
  cafe: "#92400e",
  food: "#7f1d1d",
  park: "#166534",
  metro: "#1e3a5f",
  bmtc: "#3b1f6e",
  "street-vendor": "#3f3f46",
  default: "#374151",
};

const tagEmojis = {
  cozy: "🕯",
  lively: "🔥",
  quiet: "🤫",
  "good-wifi": "📶",
  "hidden-gem": "💎",
  scenic: "🌄",
  "quick-bite": "⚡",
  coffee: "☕",
  breakfast: "🌅",
  food: "🍽",
};

const categoryEmojis = {
  cafe: "☕",
  food: "🍽",
  park: "🌳",
  metro: "🚇",
  bmtc: "🚌",
  restaurant: "🍽",
  mall: "🛍",
  malls: "🛍",
  nightlife: "🎵",
  "street-vendor": "⚡",
  default: "•",
};

function getCategoryColor(category: string): string {
  const normalizedCategory = category?.toLowerCase().trim();
  return categoryColors[normalizedCategory as keyof typeof categoryColors] || categoryColors.default;
}

function getMarkerEmoji(place: Place): string {
  const normalizedCategory = place.category?.toLowerCase().trim();
  const normalizedTag = place.dominantTag?.toLowerCase().trim();

  if (normalizedTag && tagEmojis[normalizedTag as keyof typeof tagEmojis]) {
    return tagEmojis[normalizedTag as keyof typeof tagEmojis];
  }

  const matchingTag = place.tags
    ?.map((tag) => tag.toLowerCase().trim())
    .find((tag) => tagEmojis[tag as keyof typeof tagEmojis]);

  if (matchingTag) {
    return tagEmojis[matchingTag as keyof typeof tagEmojis];
  }

  return categoryEmojis[normalizedCategory as keyof typeof categoryEmojis] || categoryEmojis.default;
}

type Place = {
  _id?: string;
  name: string;
  category: string;
  addedBy?: string;
  createdAt?: string;
  area?: string;
  location: {
    coordinates: [number, number]; // [lng, lat]
  };
  rating?: number;
  openTime?: string;
  closeTime?: string;
  description?: string;
  tags?: string[];
  dominantTag?: string;
  creatorReview?: { text: string; author?: string; rating: number; createdAt?: string } | null;
  reviews?: Array<{ text: string; author?: string; rating: number; createdAt?: string }>;
};

const defaultPosition = { lat: 12.9716, lng: 77.5946 }; // Bengaluru
const lightMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
    },
  ],
};

export default function Map({
  places,
  mapRef,
  activePlaceId,
  regionFocusRequest,
  onPlaceSelect,
}: {
  places?: Place[];
  mapRef?: React.MutableRefObject<MapRef | null>;
  activePlaceId?: string | null;
  regionFocusRequest?: {
    center: [number, number];
    bounds?: [[number, number], [number, number]];
    requestKey: number;
  } | null;
  onPlaceSelect?: (place: Place | null) => void;
}) {
  const safePlaces = useMemo(() => (Array.isArray(places) ? places : []), [places]);
  const internalMapRef = useRef<MapRef | null>(null);
  const closePopupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (mapRef && internalMapRef.current) {
      mapRef.current = internalMapRef.current;
    }
  }, [mapRef]);

  function clearClosePopupTimeout() {
    if (closePopupTimeoutRef.current) {
      clearTimeout(closePopupTimeoutRef.current);
      closePopupTimeoutRef.current = null;
    }
  }

  const hoveredPlace = useMemo(() => {
    if (!hoveredPlaceId) {
      return null;
    }

    return (
      safePlaces.find((place, index) => (place._id ?? `${place.name}-${index}`) === hoveredPlaceId) ?? null
    );
  }, [hoveredPlaceId, safePlaces]);

  useEffect(() => {
    if (!internalMapRef.current) {
      return;
    }

    if (!activePlaceId) {
      return;
    }

    const activePlace =
      safePlaces.find((place, index) => (place._id ?? `${place.name}-${index}`) === activePlaceId) ??
      null;

    if (!activePlace) {
      return;
    }

    internalMapRef.current.flyTo({
      center: activePlace.location.coordinates,
      zoom: 17,
      duration: 2200,
      offset: [-180, 40],
      essential: true,
    });
  }, [activePlaceId, safePlaces]);

  useEffect(() => {
    if (!internalMapRef.current || !regionFocusRequest || activePlaceId) {
      return;
    }

    if (regionFocusRequest.bounds) {
      internalMapRef.current.fitBounds(regionFocusRequest.bounds, {
        padding: { top: 80, bottom: 80, left: 420, right: 80 },
        duration: 1600,
        essential: true,
        maxZoom: 14.8,
      });
      return;
    }

    internalMapRef.current.flyTo({
      center: regionFocusRequest.center,
      zoom: 13.8,
      duration: 1600,
      essential: true,
    });
  }, [activePlaceId, regionFocusRequest]);

  return (
    <div className="map-container relative" style={{ height: "100vh", width: "100%" }}>
      <MapView
        ref={internalMapRef}
        initialViewState={{
          longitude: defaultPosition.lng,
          latitude: defaultPosition.lat,
          zoom: 13,
        }}
        dragRotate={false}
        mapStyle={lightMapStyle}
        reuseMaps
        style={{ height: "100%", width: "100%" }}
        touchZoomRotate={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {safePlaces.map((place, index) => (
          <Marker
            key={place._id ?? `${place.name}-${index}`}
            anchor="bottom"
            latitude={place.location.coordinates[1]}
            longitude={place.location.coordinates[0]}
          >
            <button
              aria-label={`Preview details for ${place.name}`}
              className="relative group cursor-pointer transition-transform hover:scale-110"
              onClick={() => onPlaceSelect?.(place)}
              onMouseEnter={() => {
                clearClosePopupTimeout();
                setHoveredPlaceId(place._id ?? `${place.name}-${index}`);
              }}
              onMouseLeave={() => {
                clearClosePopupTimeout();
                closePopupTimeoutRef.current = setTimeout(() => {
                  setHoveredPlaceId(null);
                  closePopupTimeoutRef.current = null;
                }, 120);
              }}
              onFocus={() => {
                clearClosePopupTimeout();
                setHoveredPlaceId(place._id ?? `${place.name}-${index}`);
              }}
              type="button"
            >
              <span
                aria-hidden="true"
                style={{
                  width: "28px",
                  height: "28px",
                  backgroundColor: getCategoryColor(place.category),
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                {getMarkerEmoji(place)}
              </span>
            </button>
          </Marker>
        ))}

        {hoveredPlace ? (
          <Popup
            anchor="top"
            closeButton
            closeOnClick={false}
            latitude={hoveredPlace.location.coordinates[1]}
            longitude={hoveredPlace.location.coordinates[0]}
            offset={20}
            onClose={() => setHoveredPlaceId(null)}
          >
            <PlacePopup
              place={hoveredPlace}
              onOpenDetails={() => onPlaceSelect?.(hoveredPlace)}
              onMouseEnter={clearClosePopupTimeout}
              onMouseLeave={() => {
                clearClosePopupTimeout();
                closePopupTimeoutRef.current = setTimeout(() => {
                  setHoveredPlaceId(null);
                  closePopupTimeoutRef.current = null;
                }, 120);
              }}
            />
          </Popup>
        ) : null}
      </MapView>
    </div>
  );
}
