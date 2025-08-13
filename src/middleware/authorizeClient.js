export const authorizeClient = (req, res, next) => {
  if (req.user?.role !== "client") {
    return res.status(403).json({ message: "Only clients can post jobs" });
  }
  next();
};
