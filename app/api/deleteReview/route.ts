import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { authOptions } from "@/lib/auth";
import { sanitizePlaceForClient } from "@/lib/sanitizePlaceForClient";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type ReviewLike = {
  _id?: { toString?: () => string };
  userId?: string;
  author?: string;
  text?: string;
  rating?: number;
  createdAt?: Date;
};

const displayUserName = (value?: string | null) => value?.trim().split(" ")[0] || "";

const reviewMatchesId = (review: ReviewLike | null | undefined, reviewId: string) =>
  Boolean(review?._id?.toString && review._id.toString() === reviewId);

const sameReviewSignature = (left: ReviewLike | null | undefined, right: ReviewLike | null | undefined) =>
  Boolean(left && right) &&
  left.text === right.text &&
  left.rating === right.rating &&
  displayUserName(left.author) === displayUserName(right.author);

const canDeleteReview = (review: ReviewLike | null | undefined, userId: string, currentUserName: string) =>
  Boolean(review) &&
  ((typeof review?.userId === "string" && review.userId === userId) ||
    (!review?.userId && displayUserName(review?.author) === currentUserName));

const collectReviewRatings = (creatorReview: ReviewLike | null | undefined, reviews: ReviewLike[]) => {
  const normalized = [...reviews];

  if (creatorReview && !normalized.some((review) => sameReviewSignature(review, creatorReview))) {
    normalized.unshift(creatorReview);
  }

  const ratings = normalized
    .map((review) => review.rating)
    .filter((rating): rating is number => typeof rating === "number" && !Number.isNaN(rating));

  return ratings;
};

export async function POST(req: Request) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? "";
    const currentUserName = displayUserName(session?.user?.name);

    if (!userId) {
      return NextResponse.json({ error: "Sign in to delete reviews." }, { status: 401 });
    }

    const body = await req.json();
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const reviewId = typeof body.reviewId === "string" ? body.reviewId.trim() : "";

    if (!placeId || !reviewId) {
      return NextResponse.json({ error: "placeId and reviewId are required." }, { status: 400 });
    }

    const place = await Place.findById(placeId);

    if (!place) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    const reviews = Array.isArray(place.reviews) ? place.reviews : [];
    const reviewIndex = reviews.findIndex((review: ReviewLike) => reviewMatchesId(review, reviewId));
    const targetReview = reviewIndex >= 0 ? reviews[reviewIndex] : null;
    const creatorReview = place.creatorReview as ReviewLike | null | undefined;
    const creatorReviewMatched = creatorReview && reviewMatchesId(creatorReview, reviewId);

    if (!targetReview && !creatorReviewMatched) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const reviewToAuthorize = targetReview ?? creatorReview;

    if (!canDeleteReview(reviewToAuthorize, userId, currentUserName)) {
      return NextResponse.json({ error: "You can only delete your own reviews." }, { status: 403 });
    }

    if (reviewIndex >= 0) {
      place.reviews.splice(reviewIndex, 1);
    }

    if (creatorReviewMatched || sameReviewSignature(targetReview, creatorReview)) {
      place.creatorReview = null;
      place.reviews = place.reviews.filter((review: ReviewLike) => !sameReviewSignature(review, creatorReview));
    }

    const ratings = collectReviewRatings(place.creatorReview as ReviewLike | null | undefined, place.reviews as ReviewLike[]);
    place.rating = ratings.length
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1))
      : 0;

    await place.save();

    return NextResponse.json({
      place: sanitizePlaceForClient(place.toObject(), userId),
    });
  } catch (error) {
    console.error("Failed to delete review", error);
    const message = error instanceof Error ? error.message : "Failed to delete review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
