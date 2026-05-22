import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import connectDB, { ConfigurationError } from "@/lib/mongodb";
import {
  clearRateLimit,
  isRateLimited,
  isValidEmail,
  normalizeEmail,
  normalizeName,
} from "@/lib/authSecurity";
import User from "@/models/User";

const authSecret = process.env.NEXTAUTH_SECRET;
const dummyPasswordHash =
  "$2b$12$GG1WSapL0Zbrcc1GnG8nYO8eQ/iSK5rtQorII6WmMP71ArT8OSpxa";

if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error("NEXTAUTH_SECRET is required in production.");
}

type AuthRequestHeaders = Record<string, string | string[] | undefined>;

const getHeaderValue = (
  headers: AuthRequestHeaders | undefined,
  name: string
) => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
};

const getRequestIp = (req: { headers?: AuthRequestHeaders }) =>
  getHeaderValue(req.headers, "x-forwarded-for").split(",")[0]?.trim() ||
  getHeaderValue(req.headers, "x-real-ip").trim() ||
  "unknown";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      const email = normalizeEmail(credentials?.email);
      const password = credentials?.password ?? "";

      if (!isValidEmail(email) || typeof password !== "string" || password.length > 128) {
        return null;
      }

      const rateLimitKey = `signin:${getRequestIp(req)}:${email}`;

      if (isRateLimited(rateLimitKey)) {
        return null;
      }

      try {
        await connectDB();
      } catch (error) {
        if (error instanceof ConfigurationError) {
          console.error("Credentials auth is missing required server configuration", error);
        }

        return null;
      }

      const user = await User.findOne({ email }).select("+password name email");
      const passwordHash = typeof user?.password === "string" ? user.password : dummyPasswordHash;
      const isValid = await bcrypt.compare(password, passwordHash);

      if (!user?.password || !isValid) {
        return null;
      }

      clearRateLimit(rateLimitKey);
      return { id: user._id.toString(), name: user.name, email: user.email };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: authSecret,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: { signIn: "/" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = normalizeEmail(user.email);
      const isVerifiedGoogleEmail =
        typeof profile === "object" &&
        profile !== null &&
        "email_verified" in profile &&
        profile.email_verified === true;

      if (!isValidEmail(email) || !isVerifiedGoogleEmail) {
        return false;
      }

      try {
        await connectDB();
      } catch (error) {
        if (error instanceof ConfigurationError) {
          console.error("Google auth is missing required server configuration", error);
        }

        return false;
      }

      const existingUser = await User.findOne({ email });

      if (!existingUser) {
        const createdUser = await User.create({
          name: normalizeName(user.name) || email.split("@")[0],
          email,
          emailVerified: new Date(),
          password: null,
          avatar: user.image || "",
          authProvider: "google",
        });

        user.id = createdUser._id.toString();
        return true;
      }

      const updates: { avatar?: string; authProvider?: string; emailVerified?: Date } = {};

      if (!existingUser.avatar && user.image) {
        updates.avatar = user.image;
      }

      if (!existingUser.authProvider || existingUser.authProvider === "credentials") {
        updates.authProvider = "google";
      }

      if (!existingUser.emailVerified) {
        updates.emailVerified = new Date();
      }

      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: existingUser._id }, { $set: updates });
      }

      user.id = existingUser._id.toString();
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      if (!token.id && token.email) {
        try {
          await connectDB();
        } catch (error) {
          if (error instanceof ConfigurationError) {
            console.error("JWT callback is missing required server configuration", error);
          }

          return token;
        }

        const existingUser = await User.findOne({ email: normalizeEmail(token.email) });

        if (existingUser) {
          token.id = existingUser._id.toString();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        if (new URL(url).origin === baseUrl) {
          return url;
        }
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
  },
};
