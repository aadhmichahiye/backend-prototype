import express from "express";
import { createUser, updateUserPin } from "../controllers/userController.js";
import { verifyAccessToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", createUser);
router.post("/pin", verifyAccessToken, updateUserPin);

export default router;
