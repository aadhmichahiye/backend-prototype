import express from "express";

import { createJobPost } from "../controllers/jobPostController.js";
import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeClient } from "../middleware/authorizeClient.js";

const router = express.Router();

router.post("/create", verifyAccessToken, authorizeClient, createJobPost);

export default router;
