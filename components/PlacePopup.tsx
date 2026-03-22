"use client";

type PlaceMedia =
  | string
  | {
      url?: string;
      src?: string;
      alt?: string;
      label?: string;
      title?: string;
    };

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
    overview?: string;
    images?: PlaceMedia[];
    photos?: PlaceMedia[];
    menu?: PlaceMedia[];
    menuImages?: PlaceMedia[];
    reviewCount?: number;
  };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose?: () => void;
  variant?: "card" | "sidebar";
};

const normalizeMedia = (items?: PlaceMedia[]) =>
  (items ?? [])
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `${item}-${index}`,
          src: item,
          alt: "",
          label: "",
        };
      }

      const src = item.url ?? item.src ?? "";

      if (!src) {
        return null;
      }

      return {
        id: `${src}-${index}`,
        src,
        alt: item.alt ?? item.title ?? "",
        label: item.label ?? item.title ?? "",
      };
    })
    .filter((item): item is { id: string; src: string; alt: string; label: string } => Boolean(item));

export default function PlacePopup({
  place,
  onMouseEnter,
  onMouseLeave,
  onClose,
  variant = "card",
}: PlacePopupProps) {
  if (variant === "card") {
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

  const photoItems = normalizeMedia(place.photos?.length ? place.photos : place.images);
  const menuItems = normalizeMedia(place.menu?.length ? place.menu : place.menuImages);
  const overview = place.overview ?? place.description;

  return (
    <div
      className="flex h-full flex-col bg-[#f6f1e8] text-[#1b140e]"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="border-b border-[#d5c7b6] bg-[linear-gradient(180deg,#ead7bc_0%,#f6f1e8_100%)] px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">
              {place.category}
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight">{place.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#5c4631]">
              {place.area ? <span>{place.area}</span> : null}
              {typeof place.rating === "number" && place.rating > 0 ? (
                <span>{place.rating.toFixed(1)} rating</span>
              ) : null}
              {place.openTime && place.closeTime ? (
                <span>
                  {place.openTime} - {place.closeTime}
                </span>
              ) : null}
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#cdb79f] bg-white/70 px-3 py-1 text-sm font-medium text-[#4f3a28] transition hover:bg-white"
              aria-label="Close place details sidebar"
            >
              Close
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[#1b140e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#35281d]"
        >
          Reviews{typeof place.reviewCount === "number" ? ` (${place.reviewCount})` : ""}
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {overview ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">Overview</h3>
            <p className="text-sm leading-6 text-[#3f2f22]">{overview}</p>
          </section>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">Menu</h3>
          {menuItems.length ? (
            <div className="grid grid-cols-2 gap-3">
              {menuItems.map((item) => (
                <figure key={item.id} className="overflow-hidden rounded-2xl bg-[#ead7bc]">
                  <img src={item.src} alt={item.alt || `${place.name} menu`} className="h-32 w-full object-cover" />
                  {item.label ? <figcaption className="px-3 py-2 text-xs font-medium text-[#5c4631]">{item.label}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d5c7b6] px-4 py-5 text-sm text-[#7a654f]">
              No menu has been added for this place yet.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">Photos</h3>
          {photoItems.length ? (
            <div className="grid grid-cols-2 gap-3">
              {photoItems.map((item) => (
                <figure key={item.id} className="overflow-hidden rounded-2xl bg-[#ead7bc]">
                  <img src={item.src} alt={item.alt || `${place.name} photo`} className="h-36 w-full object-cover" />
                  {item.label ? <figcaption className="px-3 py-2 text-xs font-medium text-[#5c4631]">{item.label}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d5c7b6] px-4 py-5 text-sm text-[#7a654f]">
              No photos have been added for this place yet.
            </div>
          )}
        </section>

        {place.tags?.length ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#d5c7b6] bg-white/70 px-3 py-1 text-xs font-medium text-[#5c4631]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
