"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
});



export default function Home() {
  const [places, setPlaces] = useState([]);
  const [mapType, setMapType] = useState("normal");

  useEffect(() => {
     let url = "/api/places";

    if (mapType !== "normal") {
      url += `?category=${mapType}`;
    }
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched places:", data); // debug
        setPlaces(data);
      });
  }, [mapType]);

  return (
    <div className="h-screen w-full">
      <Navbar mapType={mapType} setMapType={setMapType} />
      <Map places={places} />
    </div>
  );
}
