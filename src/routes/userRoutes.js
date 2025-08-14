import express from "express";
import {
  createUser,
  updateUserPin,
  loginUser,
} from "../controllers/userController.js";
import { verifyAccessToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", createUser);
router.patch("/pin", verifyAccessToken, updateUserPin);
router.post("/login", loginUser);

export default router;
