import express from "express";
import {
  createUser,
  updateUserPin,
  loginUser,
} from "../controllers/userController.js";
import { verifyAccessToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", createUser);
router.post("/pin", verifyAccessToken, updateUserPin);
router.get("/login", loginUser);

export default router;
