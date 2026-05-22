import connectDB from "@/lib/mongodb";
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

export async function GET(_req: Request, context: RouteContext) {
  try {
    await connectDB();

    const { id: placeId } = await Promise.resolve(context.params);
    const hourArray = Array.from({ length: 24 }, () => 0);

    if (!mongoose.Types.ObjectId.isValid(placeId)) {
      return NextResponse.json(hourArray);
    }

    const reviews = await Review.find({ placeId }).select("createdAt").lean<Pick<ReviewDocument, "createdAt">[]>();

    reviews.forEach((review) => {
      const createdAt = new Date(review.createdAt);

      if (Number.isNaN(createdAt.getTime())) {
        return;
      }

      hourArray[createdAt.getHours()] += 1;
    });

    return NextResponse.json(hourArray);
  } catch (error) {
    console.error("Failed to fetch visit times", error);
    return NextResponse.json(Array.from({ length: 24 }, () => 0), { status: 500 });
  }
}
