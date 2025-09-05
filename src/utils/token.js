import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import RefreshToken from "../models/refreshToken.js";

const REFRESH_EXPIRES_DAYS = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS || "30",
  10
);
const REFRESH_EXPIRES_MS = REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

export function generateAccessToken(payload) {
  // keep payload small and safe (user id, role)
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
  });
}

export async function generateRefreshToken(userId) {
  // create a random token id (jti) and save it in DB
  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  // Option A: store full JWT as cookie value (signed with REFRESH_TOKEN_SECRET)
  // Option B (recommended): store tokenId in signed cookie and keep server DB mapping
  // Here we will sign a JWT containing the tokenId so we can verify signature as an anti-forgery measure.
  const refreshTokenJwt = jwt.sign(
    { jti: tokenId },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: `${REFRESH_EXPIRES_DAYS}d`,
    }
  );

  // Save DB record for tokenId
  await RefreshToken.create({
    tokenId,
    userId,
    expiresAt,
  });

  return { refreshTokenJwt, tokenId, expiresAt };
}

export async function revokeRefreshToken(tokenId, replacedByTokenId = null) {
  if (!tokenId) return;
  await RefreshToken.findOneAndUpdate(
    { tokenId },
    { revoked: true, replacedBy: replacedByTokenId },
    { new: true }
  );
}

export async function findRefreshTokenRecord(tokenId) {
  return RefreshToken.findOne({ tokenId }).lean();
}
