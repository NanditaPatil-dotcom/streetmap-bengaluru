"use client";

type Props = {
  mapType: string;
  setMapType: (type: string) => void;
};

export default function Navbar({ mapType, setMapType }: Props) {
  const types = ["normal", "cafe", "metro", "park", "bmtc"];

  return (
    <div className="absolute top-0 left-0 w-full z-[1000] flex gap-3 p-4 bg-white shadow-md">
      {types.map((type) => (
        <button
          key={type}
          onClick={() => setMapType(type)}
          className={`px-4 py-1 rounded-md text-sm font-medium transition ${
            mapType === type
              ? "bg-black text-white"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          {type.toUpperCase()}
        </button>
      ))}
    </div>
  );
}