import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: false,
      lowercase: true,
      sparse: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    address: {
      type: String,
    },

    role: {
      type: String,
      enum: ["client", "contractor"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "active", "inactive", "banned"],
      default: "pending",
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    // Future fields like password (for auth)
    pin: {
      type: String,
      required: false, // Make it true if you're handling auth
    },
  },
  {
    versionKey: false, // Disable __v field
    timestamps: true, // Adds createdAt & updatedAt
  }
);

const User = mongoose.model("User", userSchema);

export default User;
