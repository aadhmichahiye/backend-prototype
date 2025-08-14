import jwt from "jsonwebtoken";
export const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authorization header missing or malformed" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded; // decoded should contain { id, role, ... }
    next();
  } catch (err) {
    console.error("❌ JWT verification error:", err.message);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
