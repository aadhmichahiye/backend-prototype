import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeContractor } from "../middleware/authorizeContractor.js";
import { createManpower } from "../controllers/manpowerPostController.js";

const router = express.Router();

router.post("/create", verifyAccessToken, authorizeContractor, createManpower);

export default router;
