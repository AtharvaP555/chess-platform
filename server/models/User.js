import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/, // alphanumeric + underscore only
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // Separate ELO per time control
    ratings: {
      bullet: { type: Number, default: 1200 },
      blitz: { type: Number, default: 1200 },
      rapid: { type: Number, default: 1200 },
      classic: { type: Number, default: 1200 },
    },

    // Game counts per time control (used for K-factor calculation)
    gamesPlayed: {
      bullet: { type: Number, default: 0 },
      blitz: { type: Number, default: 0 },
      rapid: { type: Number, default: 0 },
      classic: { type: Number, default: 0 },
    },

    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password helper
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", UserSchema);
