// controllers/authController.js (add this)
import jwt from "jsonwebtoken";
import {
  findRefreshTokenRecord,
  revokeRefreshToken,
  generateRefreshToken,
  generateAccessToken,
} from "../utils/token.js";
import RefreshToken from "../models/refreshToken.js";
import User from "../models/userSchema.js";
import bcrypt from "bcryptjs";

export const refreshAccessToken = async (req, res) => {
  try {
    const tokenFromCookie = req.cookies?.refreshToken;
    if (!tokenFromCookie) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // 1) Verify refresh JWT and get payload
    let payload;
    try {
      payload = jwt.verify(
        tokenFromCookie,
        process.env.JWT_REFRESH_SECRET // must match secret used in generateRefreshToken
      );
    } catch (err) {
      console.error("Invalid/expired refresh token:", err.message);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // payload now looks like: { jti: 'uuid-string', iat: 17123..., exp: 17189... }
    const tokenId = payload.jti;

    // 2) Find refresh token record in DB
    let record;
    try {
      record = await RefreshToken.findOne({ tokenId }).lean();
    } catch (dbErr) {
      console.error("DB error when looking up refresh token:", dbErr);
      return res.status(503).json({
        message: "Authentication service unavailable. Please try again later.",
      });
    }
    console.log("Refresh token record:", record);
    if (!record || record.revoked) {
      return res
        .status(401)
        .json({ message: "Refresh token revoked or missing" });
    }

    if (new Date(record.expiresAt) < new Date()) {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    // 3) Load user
    const user = await User.findById(record.userId).lean();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // 4) Issue a new access token
    const newAccessToken = generateAccessToken({
      id: user._id || user.id,
      role: user.role,
      phone: user.phone,
    });

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("refreshAccessToken error:", err);
    return res.status(500).json({ message: "Failed to refresh token" });
  }
};

// controllers/authController.js (add logout)
export const logout = async (req, res) => {
  try {
    const tokenFromCookie = req.cookies?.refreshToken;
    if (tokenFromCookie) {
      try {
        const payload = jwt.verify(
          tokenFromCookie,
          process.env.JWT_REFRESH_SECRET
        );
        const tokenId = payload.jti;
        // revoke in DB
        await revokeRefreshToken(tokenId);
      } catch (e) {
        // ignore
      }
    }

    // Clear cookie
    res.clearCookie("refreshToken", { path: "/" });
    return res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ message: "Logout failed" });
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
