export type ClientMyVote = "up" | "down" | null;

function sanitizeReviewForClient(review: unknown, viewerId: string | null): unknown {
  if (review === null || review === undefined) {
    return review;
  }
  if (typeof review !== "object") {
    return review;
  }

  const r = review as Record<string, unknown>;
  const next: Record<string, unknown> = { ...r };
  const votes = r.reviewVotes as Array<{ userId?: string; direction?: string }> | undefined;
  delete next.reviewVotes;

  let myVote: ClientMyVote = null;
  if (viewerId && Array.isArray(votes)) {
    const id = String(viewerId);
    for (let i = votes.length - 1; i >= 0; i -= 1) {
      const v = votes[i];
      if (v && String(v.userId ?? "") === id) {
        if (v.direction === "up" || v.direction === "down") {
          myVote = v.direction;
        }
        break;
      }
    }
  }
  next.myVote = myVote;
  return next;
}

export function sanitizePlaceForClient(place: unknown, viewerId: string | null): unknown {
  if (!place || typeof place !== "object") {
    return place;
  }

  const p = place as Record<string, unknown>;
  const next: Record<string, unknown> = { ...p };

  if (Array.isArray(p.reviews)) {
    next.reviews = p.reviews.map((rev) => sanitizeReviewForClient(rev, viewerId));
  }

  if (p.creatorReview) {
    next.creatorReview = sanitizeReviewForClient(p.creatorReview, viewerId);
  }

  return next;
}
