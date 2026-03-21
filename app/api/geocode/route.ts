import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${q}, Bengaluru, India`);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "en");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "StreetMapBengaluru/1.0 (fosshack)",
        "Accept": "application/json",
      },
      next: { revalidate: 60 }, // cache identical queries for 60s
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Geocode proxy error:", err);
    return NextResponse.json([]);
  }
}