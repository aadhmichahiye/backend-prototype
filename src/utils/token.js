import jwt from "jsonwebtoken";

export const generateTokens = (user) => {
  const userData = {
    id: user._id,
    phone: user.phone,
    role: user.role,
  };

  const accessToken = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "6m",
  });

  const refreshToken = jwt.sign(userData, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });

  return { accessToken, refreshToken };
};
