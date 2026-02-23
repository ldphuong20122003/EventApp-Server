const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Dùng biến môi trường: EMAIL_USER, EMAIL_PASS (App Password nếu dùng Gmail)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Gửi email chứa mã OTP đăng ký
 * @param {string} to - Email người nhận
 * @param {string} otp - Mã OTP 6 số
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendOtpEmail(to, otp) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Chưa cấu hình EMAIL_USER / EMAIL_PASS trong .env - in OTP ra console:", otp);
    return { success: true }; // Cho phép dev chạy không cấu hình email
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: "Mã xác thực đăng ký - Event App",
      html: `
        <p>Xin chào,</p>
        <p>Mã OTP để hoàn tất đăng ký của bạn là: <strong>${otp}</strong></p>
        <p>Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
        <p>Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.</p>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Send OTP email error:", err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendOtpEmail };
