import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { NextResponse } from "next/server";

const normalizeReviews = (
  creatorReview: { text?: string; rating?: number; createdAt?: Date } | null | undefined,
  reviews: Array<{ text?: string; rating?: number; createdAt?: Date }> | null | undefined
) => {
  const normalizedReviews = Array.isArray(reviews)
    ? reviews.filter(
        (review): review is { text: string; rating: number; createdAt?: Date } =>
          Boolean(review) &&
          typeof review.text === "string" &&
          typeof review.rating === "number" &&
          !Number.isNaN(review.rating)
      )
    : [];

  if (
    creatorReview &&
    typeof creatorReview.text === "string" &&
    typeof creatorReview.rating === "number" &&
    !normalizedReviews.some(
      (review) =>
        review.text === creatorReview.text &&
        review.rating === creatorReview.rating
    )
  ) {
    return [creatorReview, ...normalizedReviews];
  }

  return normalizedReviews;
};

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const tip = typeof body.tip === "string" ? body.tip.trim() : "";
    const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);

    if (!placeId) {
      return NextResponse.json({ error: "placeId is required." }, { status: 400 });
    }

    if (!tip) {
      return NextResponse.json({ error: "tip is required." }, { status: 400 });
    }

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be between 1 and 5." }, { status: 400 });
    }

    const updatedPlace = await Place.findById(placeId);

    if (!updatedPlace) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    if (
      !updatedPlace.creatorReview &&
      typeof updatedPlace.rating === "number" &&
      updatedPlace.rating > 0 &&
      typeof updatedPlace.description === "string" &&
      updatedPlace.description.trim()
    ) {
      updatedPlace.creatorReview = {
        text: updatedPlace.description.trim(),
        rating: updatedPlace.rating,
        createdAt: updatedPlace.createdAt ?? new Date(),
      };
    }

    updatedPlace.reviews = normalizeReviews(updatedPlace.creatorReview, updatedPlace.reviews);

    updatedPlace.reviews.push({
      text: tip,
      rating,
      createdAt: new Date(),
    });

    const ratings = updatedPlace.reviews
      .map((review: { rating?: number }) => review.rating)
      .filter((value: unknown): value is number => typeof value === "number" && !Number.isNaN(value));

    updatedPlace.rating = ratings.length
      ? Number((ratings.reduce((sum: number, value: number) => sum + value, 0) / ratings.length).toFixed(1))
      : 0;

    await updatedPlace.save();

    const savedPlace = await Place.findById(placeId).lean();

    if (!savedPlace) {
      return NextResponse.json({ error: "Place not found after save." }, { status: 404 });
    }

    return NextResponse.json({
      place: savedPlace,
    });
  } catch (error) {
    console.error("Failed to add tip", error);
    const message = error instanceof Error ? error.message : "Failed to add tip.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
