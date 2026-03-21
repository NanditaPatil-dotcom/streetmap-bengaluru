import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, default: null },
  authProvider: { type: String, default: "credentials" },
  createdAt: { type: Date, default: Date.now },
  avatar: { type: String, default: "" },
});

export default mongoose.models.User || mongoose.model("User", UserSchema);
