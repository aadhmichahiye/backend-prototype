// controllers/authController.js (add this)
import jwt from "jsonwebtoken";
import {
  findRefreshTokenRecord,
  revokeRefreshToken,
  generateRefreshToken,
  generateAccessToken,
} from "../utils/token.js";
// import RefreshToken from "../models/refreshToken";
import User from "../models/userSchema.js";
import bcrypt from "bcryptjs";

export const refreshAccessToken = async (req, res) => {
  try {
    // Read cookie
    const tokenFromCookie = req.cookies?.refreshToken;
    if (!tokenFromCookie) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Verify signature first
    let payload;
    try {
      payload = jwt.verify(tokenFromCookie, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokenId = payload.jti;
    if (!tokenId)
      return res.status(401).json({ message: "Invalid token payload" });

    // Find DB record
    const record = await findRefreshTokenRecord(tokenId);
    if (!record || record.revoked) {
      return res
        .status(401)
        .json({ message: "Refresh token revoked or missing" });
    }

    if (new Date(record.expiresAt) < new Date()) {
      // expired
      await revokeRefreshToken(tokenId);
      return res.status(401).json({ message: "Refresh token expired" });
    }

    // At this point token is valid. Get the user id and issue new access token
    const userId = record.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    // Issue new access token
    const newAccessToken = generateAccessToken({
      sub: user._id,
      role: user.role,
    });

    // Rotate refresh token: create new refresh JWT & db record, revoke old record
    const {
      refreshTokenJwt: newRefreshJwt,
      tokenId: newTokenId,
      expiresAt: newExpiresAt,
    } = await generateRefreshToken(user._id);

    // mark old token revoked and link to new token
    await revokeRefreshToken(tokenId, newTokenId);

    // set new cookie (browser will replace previous)
    res.cookie("refreshToken", newRefreshJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      path: "/",
      expires: new Date(newExpiresAt),
    });

    // Return new access token
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
    const accessToken = generateAccessToken({ sub: user._id, role: user.role });

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
