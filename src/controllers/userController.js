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
    return res.status(200).json({
      message: "Login successful",
      user: sanitizedUser,
      tokens: { accessToken },
    });
  } catch (error) {
    console.error("❌ Error logging in user:", error.message);
    return res.status(500).json({ message: "Failed to login" });
  }
};

export const updateUserProfile = async (req, res) => {
  const userId = req.user?.id;
  const { name, phone } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // nothing to do
  if (!name && !phone) {
    return res.status(400).json({ message: "No fields to update" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let updated = false;

    // update name
    if (typeof name === "string" && name.trim() && name.trim() !== user.name) {
      user.name = name.trim();
      updated = true;
    }

    // update phone (expect phone like +91XXXXXXXXXX or 10-15 digits)
    if (typeof phone === "string" && phone.trim()) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return res.status(400).json({ message: "Phone must be 10-15 digits" });
      }

      // normalize to +<digits> format (keep existing country code if provided)
      const normalized = phone.startsWith("+") ? `+${digits}` : `+${digits}`;

      // if phone changed, ensure uniqueness
      if (normalized !== user.phone) {
        const exists = await User.findOne({
          phone: normalized,
          _id: { $ne: userId },
        }).lean();
        if (exists) {
          return res.status(409).json({ message: "Phone is already in use" });
        }
        user.phone = normalized;
        updated = true;
      }
    }

    if (!updated) {
      return res
        .status(200)
        .json({ message: "No changes detected", data: null });
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      data: {
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isApproved: user.isApproved,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("❌ updateUserProfile error:", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

/**
 * Change or set user PIN.
 * - Accepts { old_pin, pin }.
 * - If user already had a hashed pin, old_pin is required and must match.
 * - Validates new pin format (exactly 6 digits).
 */
export const changeUserPin = async (req, res) => {
  const userId = req.user?.id;
  const { oldPin, pin } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!pin || !/^\d{6}$/.test(String(pin))) {
    return res
      .status(400)
      .json({ message: "New PIN must be exactly 6 digits" });
  }

  try {
    const user = await User.findById(userId).select("+pin"); // ensure hashed pin field (if excluded)
    if (!user) return res.status(404).json({ message: "User not found" });

    // If a PIN already exists, require oldPin and verify
    if (user.pin) {
      if (!oldPin) {
        return res.status(400).json({ message: "Current PIN is required" });
      }
      const match = await bcrypt.compare(String(oldPin), user.pin);
      if (!match) {
        return res.status(401).json({ message: "Incorrect current PIN" });
      }
    }

    // Hash & save new pin
    const saltRounds = 10;
    user.pin = await bcrypt.hash(String(pin), saltRounds);

    // Optionally mark as approved when PIN is set
    user.isApproved = true;

    await user.save();

    return res.status(200).json({ message: "PIN updated successfully" });
  } catch (err) {
    console.error("❌ changeUserPin error:", err);
    return res.status(500).json({ message: "Failed to update PIN" });
  }
};

export const getProfileInfo = async (req, res) => {
  const id = req.user.id || req.user._id;
  try {
    const user = await User.findById(id).select("_id name phone role status");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      _id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error("❌ Error fetching profile:", error.message);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
};
