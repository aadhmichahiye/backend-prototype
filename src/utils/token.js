import jwt from "jsonwebtoken";
import dotenv from "dotenv";

export const generateTokens = (user) => {
  const userData = {
    id: user._id,
    phone: user.phone,
    role: user.role,
  };

  const accessToken = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(userData, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });

  return { accessToken, refreshToken };
};
