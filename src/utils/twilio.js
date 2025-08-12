import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendSMS = async (to, message) => {
  try {
    // const result = await client.messages.create({
    //   body: message || "Your OTP is: 123456",
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to,
    // });
    // return result.sid;
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to, channel: "sms" });
    return verification.sid;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Failed to send SMS");
  }
};

export const verifySMS = async (req, res) => {
  const { phone, otp } = req.body;
  try {
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code: otp });
    if (verification.status === "approved") {
      console.log(`✅ OTP verified for ${mobile}`);
      return res.status(200).json({ message: "OTP verified successfully" });
    } else {
      console.warn(`❌ Invalid OTP for ${mobile}`);
      return res.status(400).json({ message: "Invalid OTP" });
    }
  } catch (error) {
    console.error(`❌ OTP verification error: ${error.message}`);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};
