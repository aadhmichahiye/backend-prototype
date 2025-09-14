import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeContractor } from "../middleware/authorizeContractor.js";
import {
  createManpower,
  getAllManpowerPosts,
} from "../controllers/contractorManPowerController.js";
import { authorizeClient } from "../middleware/authorizeClient.js";

const router = express.Router();

router.post("/create", verifyAccessToken, authorizeContractor, createManpower);
router.get("/all", verifyAccessToken, authorizeClient, getAllManpowerPosts);

export default router;
