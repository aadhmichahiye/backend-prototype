export const authorizeContractor = (req, res, next) => {
  if (req.user?.role !== "contractor") {
    return res
      .status(403)
      .json({ message: "Only contractor are allowed to access this route" });
  }
  next();
};
