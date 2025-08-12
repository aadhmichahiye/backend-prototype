import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./src/config/db.js";
import otpRoutes from "./src/routes/otpRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Be explicit with CORS
app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  console.log("Auth endpoint hit");
  res.send("🚀 Backend Prototype Running");
});

app.use("/api/otp", otpRoutes);
app.use("/api/user", userRoutes);

app.listen(PORT, async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB Connected");
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  } catch (err) {
    console.error("❌ DB Connection Failed", err.message);
    process.exit(1);
  }
});
