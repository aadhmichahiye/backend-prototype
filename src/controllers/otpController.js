// controllers/otpController.js
import twilio from "twilio";
import dotenv from "dotenv";
import User from "../models/userSchema.js";
import { generateAccessToken } from "../utils/token.js";
dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendOTP = async (req, res) => {
  const { phone } = req.body;
  if (!phone)
    return res.status(400).json({ message: "Phone number is required" });

  try {
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phone, channel: "sms" });

    console.log(`📤 OTP sent to ${phone}`);
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error(`❌ Failed to send OTP: ${err.message}`);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const verifyOTP = async (req, res) => {
  const { phone, otp } = req.body;
  try {
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code: otp });

    if (verification.status !== "approved") {
      console.warn(`❌ Invalid OTP for ${phone}`);
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await User.findOneAndUpdate(
      { phone },
      { status: "active" },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    const tokens = generateAccessToken(user);
    res
      .status(200)
      .json({ message: "OTP verified successfully", user, tokens });
  } catch (error) {
    console.error(`❌ OTP verification error: ${error.message}`);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};
