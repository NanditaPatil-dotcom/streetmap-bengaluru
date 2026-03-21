import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

const providers = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) {
        return null;
      }

      await connectDB();
      const user = await User.findOne({ email: credentials.email.trim().toLowerCase() });

      if (!user?.password) {
        return null;
      }

      const isValid = await bcrypt.compare(credentials.password, user.password);

      if (!isValid) {
        return null;
      }

      return { id: user._id.toString(), name: user.name, email: user.email };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

const handler = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) {
        return true;
      }

      await connectDB();

      const normalizedEmail = user.email.trim().toLowerCase();
      const existingUser = await User.findOne({ email: normalizedEmail });

      if (!existingUser) {
        const createdUser = await User.create({
          name: user.name?.trim() || normalizedEmail.split("@")[0],
          email: normalizedEmail,
          password: null,
          avatar: user.image || "",
          authProvider: "google",
        });

        user.id = createdUser._id.toString();
        return true;
      }

      const updates: { avatar?: string; authProvider?: string } = {};

      if (!existingUser.avatar && user.image) {
        updates.avatar = user.image;
      }

      if (!existingUser.authProvider || existingUser.authProvider === "credentials") {
        updates.authProvider = "google";
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
        await connectDB();
        const existingUser = await User.findOne({ email: token.email.trim().toLowerCase() });

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
  },
});

export { handler as GET, handler as POST };
