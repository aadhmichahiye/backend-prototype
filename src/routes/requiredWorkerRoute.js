import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeContractor } from "../middleware/authorizeContractor.js";
import { getAllRequiredWorkers } from "../controllers/clientRequestedWorkersController.js";

const router = express.Router();

router.get(
  "/get-all-client-requested-workers",
  verifyAccessToken,
  authorizeContractor,
  getAllRequiredWorkers
);

export default router;
