"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

type PlaceMedia =
  | string
  | {
      _id?: string;
      url?: string;
      src?: string;
      alt?: string;
      label?: string;
      title?: string;
      author?: string;
      userId?: string;
      createdAt?: string;
    };

type Review = {
  _id?: string;
  userId?: string;
  text: string;
  author?: string;
  rating: number;
  upvotes?: number;
  downvotes?: number;
  myVote?: "up" | "down" | null;
  createdAt?: string;
};

type PlacePopupProps = {
  place: {
    _id?: string;
    name: string;
    category: string;
    addedBy?: string;
    createdAt?: string;
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
    creatorReview?: Review | null;
    reviews?: Review[];
    reviewCount?: number;
  };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose?: () => void;
  onOpenDetails?: () => void;
  variant?: "card" | "sidebar";
  onPlaceUpdated?: (place: {
    _id?: string;
    rating?: number;
    photos?: PlaceMedia[];
    menuImages?: PlaceMedia[];
    creatorReview?: Review | null;
    reviews?: Review[];
  }) => void;
};

const normalizeMedia = (items?: PlaceMedia[]) =>
  (items ?? [])
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `${item}-${index}`,
          mediaId: "",
          src: item,
          alt: "",
          label: "",
          author: "",
          userId: "",
          createdAt: "",
        };
      }

      const src = item.url ?? item.src ?? "";

      if (!src) {
        return null;
      }

      return {
        id: item._id ?? `${src}-${index}`,
        mediaId: item._id ?? "",
        src,
        alt: item.alt ?? item.title ?? "",
        label: item.label ?? item.title ?? "",
        author: item.author ?? "",
        userId: item.userId ?? "",
        createdAt: item.createdAt ?? "",
      };
    })
    .filter((item): item is { id: string; mediaId: string; src: string; alt: string; label: string; author: string; userId: string; createdAt: string } => Boolean(item));

const averageRatingFromReviews = (reviews: Review[]) => {
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
  creatorReview?: Review | null;
  reviews?: Review[];
}) => {
  const normalizedReviews = Array.isArray(reviews) ? reviews : [];
  const creatorReviewKey = creatorReview
    ? `${creatorReview._id ?? ""}:${creatorReview.userId ?? ""}:${creatorReview.author ?? ""}:${creatorReview.text}:${creatorReview.rating}:${creatorReview.createdAt ?? ""}`
    : "";

  if (
    creatorReview &&
    !normalizedReviews.some(
      (review) =>
        `${review._id ?? ""}:${review.userId ?? ""}:${review.author ?? ""}:${review.text}:${review.rating}:${review.createdAt ?? ""}` ===
        creatorReviewKey
    )
  ) {
    return [creatorReview, ...normalizedReviews];
  }

  return normalizedReviews;
};

const displayUserName = (value?: string | null) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "";
  }

  return trimmedValue.split(" ")[0] || "";
};

const formatAddedAt = (value?: string) => {
  if (!value) {
    return "";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedValue);
};

const voteRowKey = (review: Review, index: number) => {
  const id = review._id;
  if (id !== undefined && id !== null && String(id).length > 0) {
    return String(id);
  }
  return `row:${index}`;
};

const isClientReview = (review: unknown): review is Review =>
  Boolean(review) &&
  typeof review === "object" &&
  typeof (review as { text?: unknown }).text === "string" &&
  typeof (review as { rating?: unknown }).rating === "number";

const canManageByOwnership = ({
  itemUserId,
  itemAuthor,
  currentUserId,
  currentUserName,
}: {
  itemUserId?: string;
  itemAuthor?: string;
  currentUserId?: string;
  currentUserName?: string;
}) => {
  if (currentUserId && itemUserId && currentUserId === itemUserId) {
    return true;
  }

  return !itemUserId && Boolean(currentUserName) && displayUserName(itemAuthor) === currentUserName;
};

export default function PlacePopup({
  place,
  onMouseEnter,
  onMouseLeave,
  onClose,
  onOpenDetails,
  variant = "card",
  onPlaceUpdated,
}: PlacePopupProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const currentUserName = displayUserName(session?.user?.name);
  const [reviews, setReviews] = useState(buildVisibleReviews(place));
  const [activeSection, setActiveSection] = useState<"overview" | "reviews">("overview");
  const [menuUploads, setMenuUploads] = useState<PlaceMedia[]>(place.menuImages ?? place.menu ?? []);
  const [photoUploads, setPhotoUploads] = useState<PlaceMedia[]>(place.photos ?? place.images ?? []);
  const [isUploadingMenu, setIsUploadingMenu] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [menuUploadError, setMenuUploadError] = useState("");
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [isPhotoGalleryOpen, setIsPhotoGalleryOpen] = useState(false);
  const [tipDraft, setTipDraft] = useState("");
  const [tipRating, setTipRating] = useState(0);
  const [isTipFormOpen, setIsTipFormOpen] = useState(false);
  const [isSubmittingTip, setIsSubmittingTip] = useState(false);
  const [voteLoadingKey, setVoteLoadingKey] = useState<string | null>(null);
  const [deleteReviewKey, setDeleteReviewKey] = useState<string | null>(null);
  const [deletePhotoKey, setDeletePhotoKey] = useState<string | null>(null);
  const [deleteMenuKey, setDeleteMenuKey] = useState<string | null>(null);
  const [voteError, setVoteError] = useState("");
  const [tipError, setTipError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const menuInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const prevPlaceIdRef = useRef<string | undefined>(undefined);
  const voteGlobalInFlightRef = useRef(false);

  useEffect(() => {
    setReviews(buildVisibleReviews(place));
    setMenuUploads(place.menuImages ?? place.menu ?? []);
    setPhotoUploads(place.photos ?? place.images ?? []);
    const nextKey = place._id ?? "";
    const prevKey = prevPlaceIdRef.current ?? "";
    if (nextKey !== prevKey) {
      prevPlaceIdRef.current = nextKey;
      setActiveSection("overview");
      setIsPhotoGalleryOpen(false);
    }
  }, [place]);

  const displayedRating = averageRatingFromReviews(reviews) ?? place.rating ?? null;

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={onOpenDetails}
        className="min-w-[220px] space-y-2 text-left text-black transition hover:opacity-90"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
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
        <p className="text-xs font-medium text-[#8b6f4e]">Click to open full place details</p>
      </button>
    );
  }

  const photoItems = normalizeMedia(photoUploads);
  const visiblePhotoItems = photoItems.slice(0, 3);
  const menuItems = normalizeMedia(menuUploads);
  const overview = place.overview ?? place.description;
  const reviewCount = reviews.length;
  const supportsMenu = ["cafe", "restaurant", "street-food", "bakery", "dessert", "study-cafe"].includes(place.category.trim().toLowerCase());
  const addedByName = displayUserName(place.addedBy);
  const addedAt = formatAddedAt(place.createdAt);
  const creatorReviewAuthor = displayUserName(place.creatorReview?.author) || addedByName;

  const handleMenuFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    const files = fileList ? Array.from(fileList).filter((file) => file.type.startsWith("image/")) : [];

    if (!currentUserId) {
      setMenuUploadError("Sign in to add menu images.");
      event.target.value = "";
      return;
    }

    if (!place._id) {
      setMenuUploadError("This place cannot accept menu uploads yet.");
      event.target.value = "";
      return;
    }

    if (!files.length) {
      event.target.value = "";
      return;
    }

    setIsUploadingMenu(true);
    setMenuUploadError("");

    try {
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  resolve(reader.result);
                  return;
                }
                reject(new Error("Failed to read image."));
              };
              reader.onerror = () => reject(new Error("Failed to read image."));
              reader.readAsDataURL(file);
            })
        )
      );

      const response = await fetch("/api/addMenu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place._id,
          images,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to upload menu images.");
      }

      const savedPlace = data.place && typeof data.place === "object" ? data.place : null;
      const nextMenuImages = Array.isArray(savedPlace?.menuImages)
        ? (savedPlace.menuImages as PlaceMedia[])
        : [];

      setMenuUploads(nextMenuImages);
      onPlaceUpdated?.({
        _id: typeof savedPlace?._id === "string" ? savedPlace._id : place._id,
        menuImages: nextMenuImages,
      });
    } catch (error) {
      setMenuUploadError(error instanceof Error ? error.message : "Failed to upload menu images.");
    } finally {
      setIsUploadingMenu(false);
      event.target.value = "";
    }
  };

  const handlePhotoFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    const files = fileList ? Array.from(fileList).filter((file) => file.type.startsWith("image/")) : [];

    if (!currentUserId) {
      setPhotoUploadError("Sign in to add photos.");
      event.target.value = "";
      return;
    }

    if (!place._id) {
      setPhotoUploadError("This place cannot accept photo uploads yet.");
      event.target.value = "";
      return;
    }

    if (!files.length) {
      event.target.value = "";
      return;
    }

    setIsUploadingPhotos(true);
    setPhotoUploadError("");

    try {
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  resolve(reader.result);
                  return;
                }
                reject(new Error("Failed to read image."));
              };
              reader.onerror = () => reject(new Error("Failed to read image."));
              reader.readAsDataURL(file);
            })
        )
      );

      const response = await fetch("/api/addPhoto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place._id,
          images,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to upload photos.");
      }

      const savedPlace = data.place && typeof data.place === "object" ? data.place : null;
      const nextPhotos = Array.isArray(savedPlace?.photos)
        ? (savedPlace.photos as PlaceMedia[])
        : [];

      setPhotoUploads(nextPhotos);
      onPlaceUpdated?.({
        _id: typeof savedPlace?._id === "string" ? savedPlace._id : place._id,
        photos: nextPhotos,
      });
    } catch (error) {
      setPhotoUploadError(error instanceof Error ? error.message : "Failed to upload photos.");
    } finally {
      setIsUploadingPhotos(false);
      event.target.value = "";
    }
  };

  const handleAddTip = async () => {
    if (!currentUserId) {
      setTipError("Sign in to add a review.");
      return;
    }

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
        ? savedPlace.reviews.filter(isClientReview)
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

  const handleDeleteReview = async (review: Review, rowKey: string) => {
    if (!place._id || !review._id) {
      return;
    }

    setDeleteReviewKey(rowKey);
    setDeleteError("");

    try {
      const response = await fetch("/api/deleteReview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place._id,
          reviewId: review._id,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to delete review.");
      }

      const savedPlace = data.place && typeof data.place === "object" ? data.place : null;
      const nextReviews = Array.isArray(savedPlace?.reviews)
        ? savedPlace.reviews.filter(isClientReview)
        : [];
      const creatorReview =
        savedPlace?.creatorReview &&
        typeof savedPlace.creatorReview.text === "string" &&
        typeof savedPlace.creatorReview.rating === "number"
          ? savedPlace.creatorReview
          : null;

      const visibleReviews = buildVisibleReviews({
        creatorReview,
        reviews: nextReviews,
      });

      setReviews(visibleReviews);
      onPlaceUpdated?.({
        _id: typeof savedPlace?._id === "string" ? savedPlace._id : place._id,
        rating: typeof savedPlace?.rating === "number" ? savedPlace.rating : place.rating,
        creatorReview,
        reviews: nextReviews,
      });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete review.");
    } finally {
      setDeleteReviewKey(null);
    }
  };

  const handleDeleteMedia = async ({
    type,
    mediaId,
  }: {
    type: "photo" | "menu";
    mediaId: string;
  }) => {
    if (!place._id || !mediaId) {
      return;
    }

    if (type === "photo") {
      setDeletePhotoKey(mediaId);
    } else {
      setDeleteMenuKey(mediaId);
    }
    setDeleteError("");

    try {
      const response = await fetch(type === "photo" ? "/api/deletePhoto" : "/api/deleteMenu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place._id,
          mediaId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : `Failed to delete ${type === "photo" ? "photo" : "menu image"}.`
        );
      }

      const savedPlace = data.place && typeof data.place === "object" ? data.place : null;
      const nextPhotos = Array.isArray(savedPlace?.photos) ? (savedPlace.photos as PlaceMedia[]) : [];
      const nextMenuImages = Array.isArray(savedPlace?.menuImages) ? (savedPlace.menuImages as PlaceMedia[]) : [];

      setPhotoUploads(nextPhotos);
      setMenuUploads(nextMenuImages);
      onPlaceUpdated?.({
        _id: typeof savedPlace?._id === "string" ? savedPlace._id : place._id,
        photos: nextPhotos,
        menuImages: nextMenuImages,
      });
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : `Failed to delete ${type === "photo" ? "photo" : "menu image"}.`
      );
    } finally {
      setDeletePhotoKey(null);
      setDeleteMenuKey(null);
    }
  };

  const handleVote = async (review: Review, rowKey: string, voteType: "upvote" | "downvote") => {
    if (!place._id) {
      return;
    }

    if (!session?.user?.id) {
      setVoteError("Sign in to vote.");
      return;
    }

    if (voteGlobalInFlightRef.current) {
      return;
    }
    voteGlobalInFlightRef.current = true;

    setVoteLoadingKey(rowKey);
    setVoteError("");

    try {
      const response = await fetch("/api/reviewVote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place._id,
          reviewId: review._id ? String(review._id) : "",
          voteType,
          reviewText: review.text,
          reviewRating: review.rating,
          reviewAuthor: review.author ?? "",
          reviewCreatedAt: review.createdAt ?? "",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to update vote.");
      }

      const savedPlace = data.place && typeof data.place === "object" ? data.place : null;
      const nextReviews = Array.isArray(savedPlace?.reviews)
        ? savedPlace.reviews.filter(isClientReview)
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
      onPlaceUpdated?.({
        _id: typeof savedPlace?._id === "string" ? savedPlace._id : place._id,
        creatorReview,
        reviews: nextReviews,
      });
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "Failed to update vote.");
    } finally {
      voteGlobalInFlightRef.current = false;
      setVoteLoadingKey(null);
    }
  };

  return (
    <div
      className="relative flex h-full flex-col bg-[#f6f1e8] text-[#1b140e]"
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
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="text-amber-500">
                    ★
                  </span>
                  <span>{displayedRating.toFixed(1)}</span>
                </span>
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
        {deleteError ? (
          <p className="rounded-2xl border border-[#e3b4ad] bg-[#fff3f1] px-4 py-3 text-sm text-[#b53f2d]">
            {deleteError}
          </p>
        ) : null}
        <div className="sticky top-0 z-10 -mx-5 border-b border-white/10 bg-[#f6f1e8] px-5 pb-3">
          <div className="flex items-center gap-8 text-base font-medium">
            <button
              type="button"
              onClick={() => setActiveSection("overview")}
              className={`relative pb-2 transition ${
                activeSection === "overview" ? "text-[#8b6f4e]" : "text-[#7a654f]"
              }`}
            >
              Overview
              {activeSection === "overview" ? (
                <span className="absolute inset-x-0 -bottom-[13px] h-1 rounded-full bg-[#8b6f4e]" />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("reviews")}
              className={`relative pb-2 transition ${
                activeSection === "reviews" ? "text-[#8b6f4e]" : "text-[#7a654f]"
              }`}
            >
              Reviews
              {activeSection === "reviews" ? (
                <span className="absolute inset-x-0 -bottom-[13px] h-1 rounded-full bg-[#8b6f4e]" />
              ) : null}
            </button>
          </div>
        </div>

        {activeSection === "overview" ? (
          <>
            {overview ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">One-Liner</h3>
                <p className="text-sm leading-6 text-[#3f2f22]">{overview}</p>
                {addedByName ? (
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8b6f4e]">
                    Added by {addedByName}
                  </p>
                ) : null}
                {addedAt ? <p className="text-xs text-[#93795d]">{addedAt}</p> : null}
              </section>
            ) : null}

            {supportsMenu ? (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">Menu</h3>
                {menuItems.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {menuItems.map((item) => {
                      const canDeleteMenuImage = canManageByOwnership({
                        itemUserId: item.userId,
                        itemAuthor: item.author,
                        currentUserId,
                        currentUserName,
                      });

                      return (
                      <figure key={item.id} className="relative overflow-hidden rounded-2xl bg-[#ead7bc]">
                        <Image src={item.src} alt={item.alt || `${place.name} menu`} width={300} height={128} className="h-32 w-full object-cover" />
                        {canDeleteMenuImage && item.mediaId ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia({ type: "menu", mediaId: item.mediaId })}
                            disabled={deleteMenuKey === item.mediaId}
                            className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-black/70 disabled:opacity-60"
                          >
                            {deleteMenuKey === item.mediaId ? "Deleting..." : "Delete"}
                          </button>
                        ) : null}
                        {item.label ? <figcaption className="px-3 py-2 text-xs font-medium text-[#5c4631]">{item.label}</figcaption> : null}
                      </figure>
                    )})}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#d5c7b6] px-4 py-5 text-sm text-[#7a654f]">
                    <p>No menu yet</p>
                    <p className="mt-1 text-[#93795d]">Be the first to add</p>
                    <button
                      type="button"
                      onClick={() => menuInputRef.current?.click()}
                      disabled={isUploadingMenu}
                      className="mt-4 rounded-full border border-[#cdb79f] bg-white/70 px-4 py-2 text-sm font-medium text-[#4f3a28] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploadingMenu ? "Uploading..." : "+ Add Menu"}
                    </button>
                    {menuUploadError ? <p className="mt-3 text-sm text-[#b53f2d]">{menuUploadError}</p> : null}
                    {!currentUserId ? <p className="mt-3 text-xs text-[#93795d]">Sign in to add or delete menu images.</p> : null}
                  </div>
                )}
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">Photos</h3>
              {photoItems.length ? (
                <>
                  <div className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex w-max gap-3">
                      {visiblePhotoItems.map((item, index) => {
                        const canDeletePhoto = canManageByOwnership({
                          itemUserId: item.userId,
                          itemAuthor: item.author,
                          currentUserId,
                          currentUserName,
                        });

                        return (
                          <div
                            key={item.id}
                            className={`group relative shrink-0 overflow-hidden rounded-[28px] bg-[#ead7bc] ${
                              index === 0 ? "h-72 w-[18.5rem]" : "h-72 w-[11.5rem]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setIsPhotoGalleryOpen(true)}
                              className="relative h-full w-full text-left"
                            >
                              <Image
                                src={item.src}
                                alt={item.alt || `${place.name} photo`}
                                fill
                                className="object-cover transition duration-300 group-hover:scale-[1.02]"
                              />
                              {item.label ? (
                                <span className="absolute inset-x-3 bottom-3 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                  {item.label}
                                </span>
                              ) : null}
                            </button>
                            {canDeletePhoto && item.mediaId ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteMedia({ type: "photo", mediaId: item.mediaId })}
                                disabled={deletePhotoKey === item.mediaId}
                                className="absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-black/70 disabled:opacity-60"
                              >
                                {deletePhotoKey === item.mediaId ? "Deleting..." : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}

                      <div className="grid h-72 w-[11.5rem] shrink-0 grid-rows-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setIsPhotoGalleryOpen(true)}
                          className="relative overflow-hidden rounded-[28px] bg-[#7a654f] text-left text-white"
                        >
                          {visiblePhotoItems[1] ? (
                            <>
                              <Image
                                src={visiblePhotoItems[1].src}
                                alt={visiblePhotoItems[1].alt || `${place.name} photo gallery`}
                                fill
                                className="object-cover opacity-75"
                              />
                              <div className="absolute inset-0 bg-black/35" />
                            </>
                          ) : null}
                          <div className="relative flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                            <span className="text-2xl">▦</span>
                            <span className="text-2xl font-semibold leading-none">See all</span>
                            <span className="text-sm text-white/85">{photoItems.length} photos</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={isUploadingPhotos}
                          className="rounded-[28px] bg-[#7a654f] px-4 py-5 text-white transition hover:bg-[#35281d] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                            <span className="text-3xl">+</span>
                            <span className="text-xl font-semibold leading-none">
                              {isUploadingPhotos ? "Uploading..." : "Add photos"}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  {photoUploadError ? <p className="text-sm text-[#b53f2d]">{photoUploadError}</p> : null}
                  {!currentUserId ? <p className="text-xs text-[#93795d]">Sign in to add or delete photos.</p> : null}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d5c7b6] px-4 py-5 text-sm text-[#7a654f]">
                  <p>No photos yet</p>
                  <p className="mt-1 text-[#93795d]">Be the first to add</p>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhotos}
                    className="mt-4 rounded-full border border-[#cdb79f] bg-white/70 px-4 py-2 text-sm font-medium text-[#4f3a28] transition hover:bg-white"
                  >
                    {isUploadingPhotos ? "Uploading..." : "+ Add Photo"}
                  </button>
                  {photoUploadError ? <p className="mt-3 text-sm text-[#b53f2d]">{photoUploadError}</p> : null}
                  {!currentUserId ? <p className="mt-3 text-xs text-[#93795d]">Sign in to add or delete photos.</p> : null}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6f4e]">
              {`Reviews (${reviewCount})`}
            </h3>
            {voteError ? <p className="text-sm text-[#b53f2d]">{voteError}</p> : null}
            {!session?.user?.id ? (
              <p className="text-xs text-[#93795d]">Sign in to vote on reviews.</p>
            ) : null}
            {reviews.length ? (
              <div className="rounded-2xl border border-[#d5c7b6] bg-white/55 px-4 py-4">
                <ul className="space-y-2 text-sm leading-6 text-[#3f2f22]">
                  {reviews.map((review, index) => (
                    <li
                      key={review._id ?? `${review.text}-${index}`}
                      className="rounded-xl border border-[#e4d7c8] bg-[#fffaf2] px-3 py-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-medium text-[#3f2f22]">
                            {displayUserName(review.author) ||
                              (review.text === place.creatorReview?.text &&
                              review.rating === place.creatorReview?.rating
                                ? creatorReviewAuthor
                                : `Review ${index + 1}`)}
                          </span>
                          {formatAddedAt(review.createdAt) ? (
                            <p className="text-xs text-[#93795d]">{formatAddedAt(review.createdAt)}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#8b6f4e]">{`${review.rating.toFixed(1)} / 5`}</span>
                          {review._id && canManageByOwnership({
                            itemUserId: review.userId,
                            itemAuthor: review.author,
                            currentUserId,
                            currentUserName,
                          }) ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(review, voteRowKey(review, index))}
                              disabled={deleteReviewKey === voteRowKey(review, index)}
                              className="rounded-full border border-[#cdb79f] bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[#4f3a28] transition hover:bg-white disabled:opacity-60"
                            >
                              {deleteReviewKey === voteRowKey(review, index) ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p>{review.text}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!session?.user?.id || voteLoadingKey !== null}
                          onClick={() => handleVote(review, voteRowKey(review, index), "upvote")}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            review.myVote === "up"
                              ? "border-[#8b6f4e] bg-[#ead7bc] text-[#35281d]"
                              : "border-[#cdb79f] bg-white/70 text-[#4f3a28] hover:bg-white"
                          }`}
                          aria-label="Upvote review"
                          aria-pressed={review.myVote === "up"}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 19V5" />
                            <path d="m6 11 6-6 6 6" />
                          </svg>
                          <span>{typeof review.upvotes === "number" ? review.upvotes : 0}</span>
                        </button>
                        <button
                          type="button"
                          disabled={!session?.user?.id || voteLoadingKey !== null}
                          onClick={() => handleVote(review, voteRowKey(review, index), "downvote")}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            review.myVote === "down"
                              ? "border-[#8b6f4e] bg-[#ead7bc] text-[#35281d]"
                              : "border-[#cdb79f] bg-white/70 text-[#4f3a28] hover:bg-white"
                          }`}
                          aria-label="Downvote review"
                          aria-pressed={review.myVote === "down"}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 5v14" />
                            <path d="m6 13 6 6 6-6" />
                          </svg>
                          <span>{typeof review.downvotes === "number" ? review.downvotes : 0}</span>
                        </button>
                      </div>
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
              <div className="space-y-2">
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
                {!currentUserId ? (
                  <p className="text-xs text-[#93795d]">Sign in to add or delete reviews.</p>
                ) : null}
              </div>
            )}
          </section>
        )}

        <input
          ref={menuInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleMenuFilesSelected}
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoFilesSelected}
        />
      </div>
      {isPhotoGalleryOpen && photoItems.length ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-[#1b140e]/92 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Photos</p>
              <h3 className="mt-1 text-lg font-semibold">{place.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsPhotoGalleryOpen(false)}
              className="rounded-full border border-white/15 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-5 py-5 sm:grid-cols-3">
            {photoItems.map((item) => {
              const canDeletePhoto = canManageByOwnership({
                itemUserId: item.userId,
                itemAuthor: item.author,
                currentUserId,
                currentUserName,
              });

              return (
                <figure key={`gallery-${item.id}`} className="relative aspect-square overflow-hidden rounded-2xl bg-white/10">
                  <Image src={item.src} alt={item.alt || `${place.name} photo`} fill className="object-cover" />
                  {canDeletePhoto && item.mediaId ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia({ type: "photo", mediaId: item.mediaId })}
                      disabled={deletePhotoKey === item.mediaId}
                      className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-black/70 disabled:opacity-60"
                    >
                      {deletePhotoKey === item.mediaId ? "Deleting..." : "Delete"}
                    </button>
                  ) : null}
                </figure>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
