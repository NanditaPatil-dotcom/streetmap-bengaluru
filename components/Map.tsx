"use client";

import PlacePopup from "@/components/PlacePopup";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Custom icons mapping for different place categories
const icons = {
  cafe: "/icons/cafe.png",
  park: "/icons/park.png",
  metro: "/icons/metro.png",
  bmtc: "/icons/bus.png",
  food: "/icons/food.png",
  mall: "/icons/malls.png",
  malls: "/icons/malls.png",
  default: "/icons/default.png",
};

// Function to get the icon for a place category
function getIcon(category: string): string {
  const normalizedCategory = category?.toLowerCase().trim();
  return icons[normalizedCategory as keyof typeof icons] || icons.default;
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
              <Image
                src={getIcon(place.category)}
                alt={place.category}
                width={30}
                height={30}
                className="drop-shadow-lg"
              />
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
