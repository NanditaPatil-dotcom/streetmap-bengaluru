import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

type ReviewDocument = {
  placeId: mongoose.Types.ObjectId;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  photos: string[];
  tags: string[];
  createdAt: Date;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ReviewSchema = new mongoose.Schema<ReviewDocument>({
  placeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Place",
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    trim: true,
  },
  userName: {
    type: String,
    required: true,
    trim: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
  },
  photos: {
    type: [String],
    default: [],
  },
  tags: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Review =
  (mongoose.models.Review as mongoose.Model<ReviewDocument> | undefined) ??
  mongoose.model<ReviewDocument>("Review", ReviewSchema);

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().toLowerCase())
    : [];

const getDominantTag = (reviews: Pick<ReviewDocument, "tags">[]) => {
  const tagCounts = new Map<string, number>();

  reviews
    .flatMap((review) => review.tags)
    .forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });

  if (tagCounts.size === 0) {
    return "";
  }

  return [...tagCounts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  })[0][0];
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    await connectDB();

    const { id: placeId } = await Promise.resolve(context.params);

    if (!mongoose.Types.ObjectId.isValid(placeId)) {
      return NextResponse.json({ error: "Invalid place id." }, { status: 400 });
    }

    const reviews = await Review.find({ placeId }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Failed to fetch reviews", error);
    const message = error instanceof Error ? error.message : "Failed to fetch reviews.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    await connectDB();

    const { id: placeId } = await Promise.resolve(context.params);

    if (!mongoose.Types.ObjectId.isValid(placeId)) {
      return NextResponse.json({ error: "Invalid place id." }, { status: 400 });
    }

    const body = await req.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const userName = typeof body.userName === "string" ? body.userName.trim() : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
    const photos = normalizeStringArray(body.photos);
    const tags = normalizeStringArray(body.tags);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!userName) {
      return NextResponse.json({ error: "userName is required." }, { status: 400 });
    }

    if (!comment) {
      return NextResponse.json({ error: "comment is required." }, { status: 400 });
    }

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be between 1 and 5." }, { status: 400 });
    }

    const place = await Place.findById(placeId).select("_id");

    if (!place) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    const review = await Review.create({
      placeId,
      userId,
      userName,
      rating,
      comment,
      photos,
      tags,
    });

    const allReviews = await Review.find({ placeId }).select("tags").lean<Pick<ReviewDocument, "tags">[]>();
    const dominantTag = getDominantTag(allReviews);

    await Place.findByIdAndUpdate(placeId, { dominantTag });

    return NextResponse.json({ review: review.toObject(), dominantTag }, { status: 201 });
  } catch (error) {
    console.error("Failed to save review", error);
    const message = error instanceof Error ? error.message : "Failed to save review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
