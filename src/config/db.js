import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI; // default: production

    const hostname = process.env.HOSTNAME || "";
    const nodeEnv = process.env.NODE_ENV || "";

    // 👇 Choose local DB if running on localhost or dev.aadhmichahiye.com
    if (
      hostname.includes("localhost") ||
      hostname.includes("127.0.0.1") ||
      hostname.includes("dev.aadhmichahiye.com") ||
      nodeEnv === "development"
    ) {
      uri = process.env.MONGO_URI_LOCAL;
    }

    const conn = await mongoose.connect(uri, {});
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ DB Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
