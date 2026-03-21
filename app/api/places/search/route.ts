import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Text search across name, description, tags, area
  const byText = await Place.find(
    { $text: { $search: q } },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(8);

  // Also do a regex fallback on name + area in case text index isn't built yet
  const regex = new RegExp(q, "i");
  const byRegex = await Place.find({
    $or: [{ name: regex }, { area: regex }],
  }).limit(8);

  // Merge, deduplicate by _id
  const seen = new Set();
  const combined = [...byText, ...byRegex].filter((p) => {
    const id = p._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return NextResponse.json(combined.slice(0, 8));
}