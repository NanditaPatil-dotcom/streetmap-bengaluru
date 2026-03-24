import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { authOptions } from "@/lib/auth";
import { sanitizePlaceForClient } from "@/lib/sanitizePlaceForClient";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

type ReviewLike = {
  _id?: { toString?: () => string };
  text?: string;
  rating?: number;
  author?: string;
  createdAt?: Date;
  upvotes?: number;
  downvotes?: number;
  reviewVotes?: unknown;
};

type VoteEntry = { userId: string; direction: "up" | "down" };

function reviewIdEquals(review: ReviewLike | null | undefined, reviewId: string) {
  if (!review?._id?.toString) {
    return false;
  }
  return review._id.toString() === reviewId;
}

function timesClose(a: unknown, bIso: string | undefined, toleranceMs: number) {
  if (!bIso?.trim()) {
    return true;
  }

  const tA = a instanceof Date ? a.getTime() : new Date(a as string).getTime();
  const tB = new Date(bIso).getTime();

  if (Number.isNaN(tA) || Number.isNaN(tB)) {
    return false;
  }

  return Math.abs(tA - tB) <= toleranceMs;
}

function matchesSignature(
  review: ReviewLike,
  text: string,
  rating: number,
  author: string,
  createdAtIso?: string
) {
  if (review.text !== text || review.rating !== rating) {
    return false;
  }

  const rAuthor = typeof review.author === "string" ? review.author.trim() : "";
  if (author && rAuthor !== author) {
    return false;
  }

  return timesClose(review.createdAt, createdAtIso, 120_000);
}

/** Normalize raw DB / Mongoose data into VoteEntry[], at most one row per userId (last wins). */
function toVoteEntries(raw: unknown): VoteEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: VoteEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const userIdRaw = (item as { userId?: unknown }).userId;
    const directionRaw = (item as { direction?: unknown }).direction;
    const userId = typeof userIdRaw === "string" ? userIdRaw.trim() : String(userIdRaw ?? "").trim();
    if (!userId) {
      continue;
    }
    if (directionRaw !== "up" && directionRaw !== "down") {
      continue;
    }
    parsed.push({ userId, direction: directionRaw });
  }

  const byUser = new Map<string, VoteEntry>();
  for (const entry of parsed) {
    byUser.set(entry.userId, entry);
  }
  return [...byUser.values()];
}

function computeNextVotes(votes: VoteEntry[], userId: string, voteKind: "upvote" | "downvote"): VoteEntry[] {
  const next = [...votes];
  const wantUp = voteKind === "upvote";
  const idx = next.findIndex((v) => v.userId === userId);
  const current = idx >= 0 ? next[idx].direction : null;

  if (wantUp) {
    if (current === "up") {
      next.splice(idx, 1);
    } else if (current === "down") {
      next[idx] = { userId, direction: "up" };
    } else {
      next.push({ userId, direction: "up" });
    }
  } else if (current === "down") {
    next.splice(idx, 1);
  } else if (current === "up") {
    next[idx] = { userId, direction: "down" };
  } else {
    next.push({ userId, direction: "down" });
  }

  return next;
}

function countsFromVotes(votes: VoteEntry[]) {
  return {
    upvotes: votes.filter((v) => v.direction === "up").length,
    downvotes: votes.filter((v) => v.direction === "down").length,
  };
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
    }

    const body = await req.json();
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const reviewId = typeof body.reviewId === "string" ? body.reviewId.trim() : "";
    const voteType = body.voteType === "downvote" ? "downvote" : body.voteType === "upvote" ? "upvote" : "";

    const sigText = typeof body.reviewText === "string" ? body.reviewText : "";
    const sigRatingRaw = body.reviewRating;
    const sigRating = typeof sigRatingRaw === "number" ? sigRatingRaw : Number(sigRatingRaw);
    const sigAuthor = typeof body.reviewAuthor === "string" ? body.reviewAuthor.trim() : "";
    const sigCreatedAt = typeof body.reviewCreatedAt === "string" ? body.reviewCreatedAt.trim() : "";

    if (!placeId || !mongoose.Types.ObjectId.isValid(placeId)) {
      return NextResponse.json({ error: "Valid placeId is required." }, { status: 400 });
    }

    if (!voteType) {
      return NextResponse.json({ error: "voteType must be upvote or downvote." }, { status: 400 });
    }

    const hasSignature =
      sigText.length > 0 && typeof sigRating === "number" && !Number.isNaN(sigRating) && sigRating >= 1 && sigRating <= 5;

    if (!reviewId && !hasSignature) {
      return NextResponse.json(
        { error: "reviewId or review text + rating (and optional author/date) is required." },
        { status: 400 }
      );
    }

    const place = await Place.findById(placeId).lean();

    if (!place) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    const p = place as {
      reviews?: ReviewLike[];
      creatorReview?: ReviewLike | null;
    };

    let target: { kind: "reviews"; index: number } | { kind: "creatorReview" } | null = null;

    if (reviewId) {
      const idx = (p.reviews ?? []).findIndex((item: ReviewLike) => reviewIdEquals(item, reviewId));
      if (idx >= 0) {
        target = { kind: "reviews", index: idx };
      } else if (p.creatorReview && reviewIdEquals(p.creatorReview, reviewId)) {
        target = { kind: "creatorReview" };
      }
    }

    if (!target && hasSignature) {
      const idx = (p.reviews ?? []).findIndex((item: ReviewLike) =>
        matchesSignature(item, sigText, sigRating, sigAuthor, sigCreatedAt || undefined)
      );
      if (idx >= 0) {
        target = { kind: "reviews", index: idx };
      } else if (
        p.creatorReview &&
        matchesSignature(p.creatorReview, sigText, sigRating, sigAuthor, sigCreatedAt || undefined)
      ) {
        target = { kind: "creatorReview" };
      }
    }

    if (!target) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const reviewSnapshot =
      target.kind === "creatorReview" ? (p.creatorReview as ReviewLike) : (p.reviews as ReviewLike[])[target.index];

    const priorVotes = toVoteEntries(reviewSnapshot.reviewVotes);
    const nextVotes = computeNextVotes(priorVotes, userId, voteType);
    const { upvotes, downvotes } = countsFromVotes(nextVotes);

    if (target.kind === "creatorReview") {
      await Place.updateOne(
        { _id: placeId },
        {
          $set: {
            "creatorReview.reviewVotes": nextVotes,
            "creatorReview.upvotes": upvotes,
            "creatorReview.downvotes": downvotes,
          },
        }
      );
    } else {
      await Place.updateOne(
        { _id: placeId },
        {
          $set: {
            [`reviews.${target.index}.reviewVotes`]: nextVotes,
            [`reviews.${target.index}.upvotes`]: upvotes,
            [`reviews.${target.index}.downvotes`]: downvotes,
          },
        }
      );
    }

    const savedPlace = await Place.findById(placeId).lean();

    if (!savedPlace) {
      return NextResponse.json({ error: "Place not found after update." }, { status: 404 });
    }

    return NextResponse.json({ place: sanitizePlaceForClient(savedPlace, userId) });
  } catch (error) {
    console.error("Failed to vote on review", error);
    const message = error instanceof Error ? error.message : "Failed to vote on review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
