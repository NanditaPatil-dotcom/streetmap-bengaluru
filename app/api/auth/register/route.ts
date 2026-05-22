import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB, { ConfigurationError } from "@/lib/mongodb";
import {
  clearRateLimit,
  getClientIp,
  isRateLimited,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  normalizeName,
  PASSWORD_RULES_MESSAGE,
} from "@/lib/authSecurity";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = normalizeName(body.name);
    const email = normalizeEmail(body.email);
    const password = body.password;
    const rateLimitKey = `register:${getClientIp(req)}:${email || "unknown"}`;

    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashed,
      authProvider: "credentials",
    });

    clearRateLimit(rateLimitKey);

    return NextResponse.json({
      id: user._id,
      name: user.name,
      email: user.email,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to register user", error);

    if (error instanceof ConfigurationError) {
      return NextResponse.json(
        { error: "Authentication is not configured. Set MONGODB_URI on the server." },
        { status: 500 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}
