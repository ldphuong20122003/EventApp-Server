/**
 * Lưu đăng ký chờ xác thực OTP (in-memory).
 * Key: email (lowercase), value: { hashedPassword, fullName, otp, expiresAt }
 */
const pendingRegistrations = new Map();

const OTP_EXPIRY_MINUTES = 5;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 số
}

function setPending(email, data) {
  const key = email.trim().toLowerCase();
  pendingRegistrations.set(key, {
    ...data,
    expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
  });
}

function getPending(email) {
  const key = email.trim().toLowerCase();
  return pendingRegistrations.get(key);
}

function verifyAndConsumeOtp(email, otp) {
  const key = email.trim().toLowerCase();
  const pending = pendingRegistrations.get(key);
  if (!pending) return { valid: false, message: "Không tìm thấy yêu cầu đăng ký. Vui lòng gửi lại OTP." };
  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(key);
    return { valid: false, message: "Mã OTP đã hết hạn. Vui lòng đăng ký lại." };
  }
  if (pending.otp !== String(otp).trim()) {
    return { valid: false, message: "Mã OTP không đúng." };
  }
  pendingRegistrations.delete(key);
  return { valid: true, data: { hashedPassword: pending.hashedPassword, fullName: pending.fullName } };
}

module.exports = {
  generateOtp,
  setPending,
  getPending,
  verifyAndConsumeOtp,
  OTP_EXPIRY_MINUTES,
};
