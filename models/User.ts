import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  emailVerified: { type: Date, default: null },
  password: { type: String, default: null, select: false },
  authProvider: {
    type: String,
    enum: ["credentials", "google"],
    default: "credentials",
  },
  createdAt: { type: Date, default: Date.now },
  avatar: { type: String, default: "" },
});

UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
