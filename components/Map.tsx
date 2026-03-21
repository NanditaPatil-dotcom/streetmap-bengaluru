"use client";

import PlacePopup from "@/components/PlacePopup";
import { useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
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
  rating?: number;
  openTime?: string;
  closeTime?: string;
  description?: string;
  tags?: string[];
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
  onActivePlaceClose,
}: {
  places?: Place[];
  mapRef?: React.MutableRefObject<MapRef | null>;
  activePlaceId?: string | null;
  onActivePlaceClose?: () => void;
}) {
  const safePlaces = useMemo(() => (Array.isArray(places) ? places : []), [places]);
  const internalMapRef = useRef<MapRef | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const closePopupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const visiblePlaceId = activePlaceId ?? selectedPlaceId;

  const selectedPlace = useMemo(() => {
    if (!visiblePlaceId) {
      return null;
    }

    return (
      safePlaces.find((place, index) => (place._id ?? `${place.name}-${index}`) === visiblePlaceId) ??
      null
    );
  }, [safePlaces, visiblePlaceId]);

  useEffect(() => {
    if (!activePlaceId || !internalMapRef.current) {
      return;
    }

    const activePlace = safePlaces.find(
      (place, index) => (place._id ?? `${place.name}-${index}`) === activePlaceId
    );

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
              className="text-[28px] leading-none"
              onClick={() => openPopup(place._id ?? `${place.name}-${index}`)}
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
            onClose={() => {
              setSelectedPlaceId(null);
              onActivePlaceClose?.();
            }}
          >
            <PlacePopup
              place={selectedPlace}
              onMouseEnter={clearClosePopupTimeout}
              onMouseLeave={closePopupWithDelay}
            />
          </Popup>
        )}
      </MapView>
    </div>
  );
}
