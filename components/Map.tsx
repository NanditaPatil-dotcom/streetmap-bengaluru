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
const KNOB_SIZE = 40;
const KNOB_MARGIN = 6;

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[26px] w-[26px]"
      viewBox="0 0 28 28"
      fill="none"
      stroke="#111"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="14" cy="14" r="5.5" />
      <line x1="14" y1="2" x2="14" y2="5.5" />
      <line x1="14" y1="22.5" x2="14" y2="26" />
      <line x1="2" y1="14" x2="5.5" y2="14" />
      <line x1="22.5" y1="14" x2="26" y2="14" />
      <line x1="5.5" y1="5.5" x2="8" y2="8" />
      <line x1="20" y1="20" x2="22.5" y2="22.5" />
      <line x1="22.5" y1="5.5" x2="20" y2="8" />
      <line x1="8" y1="20" x2="5.5" y2="22.5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[26px] w-[26px]"
      viewBox="0 0 28 28"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 17A9 9 0 1 1 11 7a7 7 0 0 0 10 10z" />
      <line x1="19" y1="5" x2="19" y2="8" />
      <line x1="17.5" y1="6.5" x2="20.5" y2="6.5" />
      <circle cx="23" cy="10" r="1" fill="#fff" stroke="none" />
    </svg>
  );
}

export default function Map({ places }: { places?: Place[] }) {
  const safePlaces = Array.isArray(places) ? places : [];
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(darkMapStyle ? "dark" : "light");
  const closePopupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNight = theme === "dark";

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) {
      return null;
    }

    return (
      safePlaces.find((place, index) => (place._id ?? `${place.name}-${index}`) === selectedPlaceId) ??
      null
    );
  }, [safePlaces, selectedPlaceId]);
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
          className={`relative h-[130px] w-[50px] select-none ${
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

              if (event.key === "ArrowUp") {
                setTheme("light");
                return;
              }

              if (event.key === "ArrowDown") {
                setTheme("dark");
                return;
              }

              setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
            }
          }}
        >
          <div
            className={`absolute inset-0 rounded-[30px] border-[1.5px] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-[background-color,border-color] duration-500 ${
              isNight
                ? "border-grey bg-[#111111]"
                : "border-grey bg-[#f0f0f0]"
            }`}
          />

          <div
            className={`absolute left-1/2 z-[2] flex h-[46px] w-[46px] -translate-x-1/2 items-center justify-center rounded-full border-[1.5px] transition-[top,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] ${
              isNight
                ? "border-[#333333] bg-[#111111] text-white shadow-[0_1px_6px_rgba(0,0,0,0.4)]"
                : "border-[#dddddd] bg-white text-[#111111] shadow-[0_1px_6px_rgba(0,0,0,0.12)]"
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

        {safePlaces.map((place, index) => (
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
