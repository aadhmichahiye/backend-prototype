import User from "../models/userSchema.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { sendOTP } from "./otpController.js";
import bcrypt from "bcryptjs";

export const createUser = async (req, res) => {
  try {
    const { name, phone, role, pin } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }
    if (!pin) {
      return res.status(400).json({ message: "PIN is required" });
    }
    if (!["client", "contractor"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be exactly 6 digits" });
    }
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(409).json({ message: "User already exists" });
    }
    const hashPin = await bcrypt.hash(pin, 10);
    const user = await User.create({
      name,
      phone,
      role,
      pin: hashPin,
      status: "active",
      isApproved: true, // Default to true
    });
    const sanitizedUser = {
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isApproved: user.isApproved,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return res
      .status(201)
      .json({ message: "User created", user: sanitizedUser });
  } catch (err) {
    console.error("❌ Error creating user:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
export const updateUserPin = async (req, res) => {
  const userId = req.user.id; // ✅ Secure source
  const { pin, old_pin } = req.body;

  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: "PIN must be exactly 6 digits" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check old PIN if user already has one
    if (user.pin) {
      if (!old_pin) {
        return res.status(400).json({ message: "Old PIN is required" });
      }

      const isMatch = await bcrypt.compare(old_pin, user.pin);
      if (!isMatch) {
        return res.status(401).json({ message: "Incorrect old PIN" });
      }
    }

    // Set or update PIN
    user.pin = await bcrypt.hash(pin, 10);
    user.isApproved = true; // Automatically approve user when PIN is set
    await user.save();

    return res.status(200).json({ message: "PIN updated successfully" });
  } catch (error) {
    console.error("❌ Error updating PIN:", error.message);
    return res.status(500).json({ message: "Failed to update PIN" });
  }
};

export const loginUser = async (req, res) => {
  const { phone, pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ message: "Phone and PIN are required" });
  }

  try {
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isApproved)
      return res.status(403).json({ message: "User not approved yet" });
    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) return res.status(401).json({ message: "Invalid PIN" });

    const sanitizedUser = {
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isApproved: user.isApproved,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // generate access token (put minimal info)
    const accessToken = generateAccessToken({ id: user._id, role: user.role });

    // generate refresh token (signed JWT with jti) and persist token record
    const { refreshTokenJwt, tokenId, expiresAt } = await generateRefreshToken(
      user._id
    );

    // Set refresh token cookie (HttpOnly)
    // Cookie options — adapt domain/path per your deployment
    res.cookie("refreshToken", refreshTokenJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // only send over HTTPS in prod
      sameSite: "Strict",
      path: "/",
      expires: new Date(expiresAt),
      // Optionally add `domain` if needed: domain: 'yourdomain.com'
    });

    // Return access token and user (no refresh token in body)
    return res
      .status(200)
      .json({
        message: "Login successful",
        user: sanitizedUser,
        tokens: { accessToken },
      });
  } catch (error) {
    console.error("❌ Error logging in user:", error.message);
    return res.status(500).json({ message: "Failed to login" });
  }
};
