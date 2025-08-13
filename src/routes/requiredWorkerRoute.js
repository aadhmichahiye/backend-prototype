import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeContractor } from "../middleware/authorizeContractor.js";
import { getAllRequiredWorkers } from "../controllers/requiredWorkersController.js";

const router = express.Router();

router.get(
  "/all",
  verifyAccessToken,
  authorizeContractor,
  getAllRequiredWorkers
);

export default router;
