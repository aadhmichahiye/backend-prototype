import jwt from "jsonwebtoken";
import User from "../models/userSchema.js"; // make sure this path is correct
import dotenv from "dotenv";
dotenv.config();
export const verifyAccessToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // support cookie-based token as fallback (optional)
    const cookieToken = req.cookies?.accessToken || req.cookies?.token;

    if (!authHeader && !cookieToken) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    // prefer Authorization header, fallback to cookie
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : cookieToken;

    if (!token) return res.status(401).json({ message: "No token provided" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      // handle expired vs invalid separately
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Access token expired" });
      }
      return res.status(401).json({ message: "Invalid access token" });
    }

    console.debug("decoded jwt from auth middleware:", decoded);

    const userId = decoded.id || decoded._id || decoded.userId;
    if (!userId)
      return res.status(401).json({ message: "Token missing user id" });

    // fetch user (wrap DB call in try/catch implicitly by outer try)
    const user = await User.findById(userId).select(
      "_id name phone role status isApproved"
    );
    if (!user) return res.status(401).json({ message: "User not found" });

    // attach sanitized user
    req.user = {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isApproved: user.isApproved,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
