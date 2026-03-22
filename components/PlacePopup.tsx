"use client";

import { useEffect, useState } from "react";

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
    _id?: string;
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
    creatorReview?: {
      text: string;
      rating: number;
      createdAt?: string;
    } | null;
    reviews?: Array<{
      text: string;
      rating: number;
      createdAt?: string;
    }>;
    reviewCount?: number;
  };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose?: () => void;
  variant?: "card" | "sidebar";
  onPlaceUpdated?: (place: {
    _id?: string;
    rating?: number;
    creatorReview?: { text: string; rating: number; createdAt?: string } | null;
    reviews?: Array<{ text: string; rating: number; createdAt?: string }>;
  }) => void;
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

const averageRatingFromReviews = (
  reviews: Array<{ text: string; rating: number; createdAt?: string }>
) => {
  if (!reviews.length) {
    return null;
  }

  const ratings = reviews
    .map((review) => review.rating)
    .filter((rating) => typeof rating === "number" && !Number.isNaN(rating));

  if (!ratings.length) {
    return null;
  }

  return Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1));
};

const buildVisibleReviews = ({
  creatorReview,
  reviews,
}: {
  creatorReview?: { text: string; rating: number; createdAt?: string } | null;
  reviews?: Array<{ text: string; rating: number; createdAt?: string }>;
}) => {
  const normalizedReviews = Array.isArray(reviews) ? reviews : [];

  if (
    creatorReview &&
    !normalizedReviews.some(
      (review) => review.text === creatorReview.text && review.rating === creatorReview.rating
    )
  ) {
    return [creatorReview, ...normalizedReviews];
  }

  return normalizedReviews;
};

export default function PlacePopup({
  place,
  onMouseEnter,
  onMouseLeave,
  onClose,
  variant = "card",
  onPlaceUpdated,
}: PlacePopupProps) {
  const [reviews, setReviews] = useState(buildVisibleReviews(place));
  const [tipDraft, setTipDraft] = useState("");
  const [tipRating, setTipRating] = useState(0);
  const [isTipFormOpen, setIsTipFormOpen] = useState(false);
  const [isSubmittingTip, setIsSubmittingTip] = useState(false);
  const [tipError, setTipError] = useState("");

  useEffect(() => {
    setReviews(buildVisibleReviews(place));
  }, [place]);

  const displayedRating = averageRatingFromReviews(reviews) ?? place.rating ?? null;

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

        {typeof displayedRating === "number" && displayedRating > 0 && (
          <p className="text-sm font-medium text-amber-600">{displayedRating}/5 rating</p>
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
  const reviewCount = reviews.length;

  const handleAddTip = async () => {
    if (!place._id) {
      setTipError("This place cannot accept tips yet.");
      return;
    }

    const nextTip = tipDraft.trim();
    if (!nextTip) {
      setTipError("Write a short tip first.");
      return;
    }

    if (!tipRating) {
      setTipError("Add a rating first.");
      return;
    }

    setIsSubmittingTip(true);
    setTipError("");

    try {
      const response = await fetch("/api/addTip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place._id,
          tip: nextTip,
          rating: tipRating,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to add tip.");
      }

      const savedPlace = data.place && typeof data.place === "object" ? data.place : null;

      const nextReviews = Array.isArray(savedPlace?.reviews)
        ? savedPlace.reviews.filter(
            (
              review: unknown
            ): review is { text: string; rating: number; createdAt?: string } =>
              Boolean(review) &&
              typeof review === "object" &&
              typeof (review as { text?: unknown }).text === "string" &&
              typeof (review as { rating?: unknown }).rating === "number"
          )
        : [];
      const creatorReview =
        savedPlace?.creatorReview &&
        typeof savedPlace.creatorReview.text === "string" &&
        typeof savedPlace.creatorReview.rating === "number"
          ? savedPlace.creatorReview
          : place.creatorReview ?? null;
      const visibleReviews = buildVisibleReviews({
        creatorReview,
        reviews: nextReviews,
      });
      setReviews(visibleReviews);
      setTipDraft("");
      setTipRating(0);
      setIsTipFormOpen(false);
      onPlaceUpdated?.({
        _id: typeof savedPlace?._id === "string" ? savedPlace._id : place._id,
        rating: typeof savedPlace?.rating === "number" ? savedPlace.rating : place.rating,
        creatorReview,
        reviews: nextReviews,
      });
    } catch (error) {
      setTipError(error instanceof Error ? error.message : "Failed to add tip.");
    } finally {
      setIsSubmittingTip(false);
    }
  };

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
              {typeof displayedRating === "number" && displayedRating > 0 ? (
                <span>{displayedRating.toFixed(1)} rating</span>
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

      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {overview ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">Overview</h3>
            <p className="text-sm leading-6 text-[#3f2f22]">{overview}</p>
            <p className="pt-1 text-sm font-medium text-[#6b5239]">Community insights</p>
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
              <p>No menu yet</p>
              <p className="mt-1 text-[#93795d]">Be the first to add</p>
              <button
                type="button"
                className="mt-4 rounded-full border border-[#cdb79f] bg-white/70 px-4 py-2 text-sm font-medium text-[#4f3a28] transition hover:bg-white"
              >
                + Add Menu
              </button>
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
              <p>No photos yet</p>
              <p className="mt-1 text-[#93795d]">Be the first to add</p>
              <button
                type="button"
                className="mt-4 rounded-full border border-[#cdb79f] bg-white/70 px-4 py-2 text-sm font-medium text-[#4f3a28] transition hover:bg-white"
              >
                + Add Photo
              </button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">
            {`Reviews (${reviewCount})`}
          </h3>
          {reviews.length ? (
            <div className="rounded-2xl border border-[#d5c7b6] bg-white/55 px-4 py-4">
              <ul className="space-y-2 text-sm leading-6 text-[#3f2f22]">
                {reviews.map((review, index) => (
                  <li key={`${review.text}-${index}`} className="rounded-xl border border-[#e4d7c8] bg-[#fffaf2] px-3 py-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="font-medium text-[#3f2f22]">{`Review ${index + 1}`}</span>
                      <span className="text-sm font-semibold text-[#8b6f4e]">{`${review.rating.toFixed(1)} / 5`}</span>
                    </div>
                    <p>{review.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d5c7b6] px-4 py-5 text-sm text-[#7a654f]">
              <p>No reviews yet</p>
              <p className="mt-1 text-[#93795d]">Be the first to share your experience</p>
            </div>
          )}

          {isTipFormOpen ? (
            <div className="rounded-2xl border border-[#d5c7b6] bg-white/55 p-4">
              <div className="mb-3">
                <p className="mb-2 text-sm font-medium text-[#3f2f22]">Your rating</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setTipRating(star)}
                      className={`text-2xl transition ${star <= tipRating ? "text-amber-500" : "text-[#d5c7b6]"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={tipDraft}
                onChange={(event) => setTipDraft(event.target.value)}
                placeholder="Best dosa before 8 AM."
                rows={3}
                className="w-full rounded-xl border border-[#d5c7b6] bg-[#fdf9f2] px-3 py-3 text-sm text-[#1b140e] outline-none transition placeholder:text-[#9c8263] focus:border-[#b79975]"
              />
              {tipError ? <p className="mt-2 text-sm text-[#b53f2d]">{tipError}</p> : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleAddTip}
                  disabled={isSubmittingTip}
                  className="rounded-full bg-[#1b140e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#35281d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingTip ? "Submitting..." : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTipFormOpen(false);
                    setTipDraft("");
                    setTipRating(0);
                    setTipError("");
                  }}
                  className="rounded-full border border-[#cdb79f] bg-white/70 px-4 py-2 text-sm font-medium text-[#4f3a28] transition hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsTipFormOpen(true);
                setTipError("");
              }}
              className="rounded-full border border-[#cdb79f] bg-white/70 px-4 py-2 text-sm font-medium text-[#4f3a28] transition hover:bg-white"
            >
              + Add Review
            </button>
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
