"use client";

import { useMemo, useRef, useState } from "react";
import MapView, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Place = {
  _id?: string;
  name: string;
  category: string;
  area?: string;
  location: {
    coordinates: [number, number]; // [lng, lat]
  };
  openTime?: string;
  closeTime?: string;
  description?: string;
  tags?: string[];
};

const defaultPosition = { lat: 12.9716, lng: 77.5946 }; // Bengaluru
const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const darkMapStyle = maptilerKey
  ? `https://api.maptiler.com/maps/openstreetmap-dark/style.json?key=${maptilerKey}`
  : null;
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

const TOGGLE_HEIGHT = 120;
const KNOB_SIZE = 48;
const KNOB_MARGIN = 5;

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <circle cx="24" cy="24" r="9" />
      <line x1="24" y1="4" x2="24" y2="10" />
      <line x1="24" y1="38" x2="24" y2="44" />
      <line x1="4" y1="24" x2="10" y2="24" />
      <line x1="38" y1="24" x2="44" y2="24" />
      <line x1="9.5" y1="9.5" x2="13.7" y2="13.7" />
      <line x1="34.3" y1="34.3" x2="38.5" y2="38.5" />
      <line x1="38.5" y1="9.5" x2="34.3" y2="13.7" />
      <line x1="13.7" y1="34.3" x2="9.5" y2="38.5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M36 26A15 15 0 1 1 22 12a11 11 0 0 0 14 14z" />
      <line x1="32" y1="8" x2="32" y2="13" />
      <line x1="29.5" y1="10.5" x2="34.5" y2="10.5" />
      <circle cx="38" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Map({ places }: { places: Place[] }) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(darkMapStyle ? "dark" : "light");
  const closePopupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNight = theme === "dark";

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) {
      return null;
    }

    return (
      places.find((place, index) => (place._id ?? `${place.name}-${index}`) === selectedPlaceId) ??
      null
    );
  }, [places, selectedPlaceId]);
  const currentMapStyle = theme === "dark" && darkMapStyle ? darkMapStyle : lightMapStyle;

  const clearClosePopupTimeout = () => {
    if (closePopupTimeoutRef.current) {
      clearTimeout(closePopupTimeoutRef.current);
      closePopupTimeoutRef.current = null;
    }
  };

  const openPopup = (placeId: string) => {
    clearClosePopupTimeout();
    setSelectedPlaceId(placeId);
  };

  const closePopupWithDelay = () => {
    clearClosePopupTimeout();
    closePopupTimeoutRef.current = setTimeout(() => {
      setSelectedPlaceId(null);
      closePopupTimeoutRef.current = null;
    }, 120);
  };

  return (
    <div className="map-container relative" style={{ height: "100vh", width: "100%" }}>
      <div className="absolute right-4 top-[152px] z-20">
        <div
          aria-label={isNight ? "Switch to light map theme" : "Switch to dark map theme"}
          aria-checked={isNight}
          className={`relative h-[100px] w-[52px] select-none ${
            darkMapStyle ? "" : "opacity-50"
          }`}
          role="switch"
          tabIndex={darkMapStyle ? 0 : -1}
          onKeyDown={(event) => {
            if (!darkMapStyle) {
              return;
            }

            if (
              event.key === "Enter" ||
              event.key === " " ||
              event.key === "ArrowUp" ||
              event.key === "ArrowDown"
            ) {
              event.preventDefault();
              setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
            }
          }}
        >
          <div
            className={`absolute inset-0 rounded-[30px] border-2 shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition-[background-color,border-color] duration-500 ${
              isNight
                ? "border-[#111111] bg-[#111111]"
                : "border-[#dddddd] bg-[#f0f0f0]"
            }`}
          />

          <div
            className={`absolute left-1/2 z-[2] flex h-[48px] w-[48px] -translate-x-1/2 items-center justify-center rounded-full border-2 transition-[top,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] ${
              isNight
                ? "border-[#333333] bg-[#111111] text-white shadow-[0_2px_10px_rgba(0,0,0,0.38)]"
                : "border-[#dddddd] bg-white text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
            }`}
            style={{
              top: isNight ? TOGGLE_HEIGHT - KNOB_SIZE - KNOB_MARGIN : KNOB_MARGIN,
            }}
          >
            <span
              className={`absolute transition-opacity duration-300 ${
                isNight ? "opacity-0" : "opacity-100"
              }`}
            >
              <SunIcon />
            </span>
            <span
              className={`absolute transition-opacity duration-300 ${
                isNight ? "opacity-100" : "opacity-0"
              }`}
            >
              <MoonIcon />
            </span>
          </div>

          <button
            aria-label="Switch to light map theme"
            className={`absolute inset-x-0 top-0 z-[3] h-1/2 appearance-none border-0 bg-transparent p-0 ${
              darkMapStyle && isNight ? "cursor-pointer" : "cursor-default"
            }`}
            disabled={!darkMapStyle || !isNight}
            onClick={() => setTheme("light")}
            type="button"
          />
          <button
            aria-label="Switch to dark map theme"
            className={`absolute inset-x-0 bottom-0 z-[3] h-1/2 appearance-none border-0 bg-transparent p-0 ${
              darkMapStyle && !isNight ? "cursor-pointer" : "cursor-default"
            }`}
            disabled={!darkMapStyle || isNight}
            onClick={() => setTheme("dark")}
            type="button"
          />
        </div>
      </div>

      {!darkMapStyle && (
        <div className="pointer-events-none absolute right-[74px] top-[184px] z-20 max-w-xs rounded-2xl bg-black/75 px-3 py-2 text-xs text-white">
          Add <code>NEXT_PUBLIC_MAPTILER_KEY</code> to <code>.env.local</code> to enable dark mode.
        </div>
      )}

      <MapView
        initialViewState={{
          longitude: defaultPosition.lng,
          latitude: defaultPosition.lat,
          zoom: 13,
        }}
        dragRotate={false}
        mapStyle={currentMapStyle}
        reuseMaps
        style={{ height: "100%", width: "100%" }}
        touchZoomRotate={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {places.map((place, index) => (
          <Marker
            key={place._id ?? `${place.name}-${index}`}
            anchor="bottom"
            latitude={place.location.coordinates[1]}
            longitude={place.location.coordinates[0]}
          >
            <button
              aria-label={`Preview details for ${place.name}`}
              className="text-[28px] leading-none"
              onMouseEnter={() => openPopup(place._id ?? `${place.name}-${index}`)}
              onMouseLeave={closePopupWithDelay}
              onFocus={() => openPopup(place._id ?? `${place.name}-${index}`)}
              onBlur={closePopupWithDelay}
              type="button"
            >
              📍
            </button>
          </Marker>
        ))}

        {selectedPlace && (
          <Popup
            anchor="top"
            closeButton
            closeOnClick={false}
            latitude={selectedPlace.location.coordinates[1]}
            longitude={selectedPlace.location.coordinates[0]}
            offset={20}
            onClose={() => setSelectedPlaceId(null)}
          >
            <div
              className="space-y-1 text-black"
              onMouseEnter={clearClosePopupTimeout}
              onMouseLeave={closePopupWithDelay}
            >
              <h3 className="text-lg font-bold">{selectedPlace.name}</h3>

              <p className="text-sm text-gray-600">
                {selectedPlace.category}
                {selectedPlace.area ? ` • ${selectedPlace.area}` : ""}
              </p>

              {selectedPlace.openTime && selectedPlace.closeTime && (
                <p className="text-sm">
                  {selectedPlace.openTime} - {selectedPlace.closeTime}
                </p>
              )}

              {selectedPlace.description && (
                <p className="text-sm">{selectedPlace.description}</p>
              )}
            </div>
          </Popup>
        )}
      </MapView>
    </div>
  );
}
