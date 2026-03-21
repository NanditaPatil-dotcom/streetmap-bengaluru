"use client";

type PlacePopupProps = {
  place: {
    name: string;
    category: string;
    area?: string;
    rating?: number;
    description?: string;
    openTime?: string;
    closeTime?: string;
    tags?: string[];
  };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export default function PlacePopup({
  place,
  onMouseEnter,
  onMouseLeave,
}: PlacePopupProps) {
  return (
    <div className="min-w-[220px] space-y-2 text-black" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div>
        <h3 className="text-lg font-bold">{place.name}</h3>
        <p className="text-sm text-gray-600">
          {place.category}
          {place.area ? ` • ${place.area}` : ""}
        </p>
      </div>

      {typeof place.rating === "number" && place.rating > 0 && (
        <p className="text-sm font-medium text-amber-600">{place.rating}/5 rating</p>
      )}

      {place.openTime && place.closeTime && (
        <p className="text-sm">
          {place.openTime} - {place.closeTime}
        </p>
      )}

      {place.description && <p className="text-sm">{place.description}</p>}

      {place.tags?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {place.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
