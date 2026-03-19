"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";

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

const defaultPosition: [number, number] = [12.9716, 77.5946]; // Bengaluru

const markerIcon = L.divIcon({
  className: "emoji-marker",
  html: '<div style="font-size: 28px; line-height: 1;">📍</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

export default function Map({ places }: { places: Place[] }) {
  return (
    <MapContainer
      center={defaultPosition}
      className="map-container"
      scrollWheelZoom
      style={{ height: "100vh", width: "100%" }}
      zoom={13}
      zoomControl={false}
    >
      <ZoomControl position="topright" />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {places.map((place, index) => (
        <Marker
          key={place._id ?? `${place.name}-${index}`}
          icon={markerIcon}
          position={[
            place.location.coordinates[1],
            place.location.coordinates[0],
          ]}
        >
          <Popup>
            <div className="space-y-1">
              <h3 className="font-bold text-lg">{place.name}</h3>

              <p className="text-sm text-gray-600">
                {place.category} • {place.area}
              </p>

              {place.openTime && place.closeTime && (
                <p className="text-sm">
                  {place.openTime} - {place.closeTime}
                </p>
              )}

              {place.description && (
                <p className="text-sm">{place.description}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
