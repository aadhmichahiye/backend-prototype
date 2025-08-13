import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeClient } from "../middleware/authorizeClient.js";
import { getAllAvailableWorkers } from "../controllers/availableWorkersController.js";

const router = express.Router();

router.get("/all", verifyAccessToken, authorizeClient, getAllAvailableWorkers);

export default router;
