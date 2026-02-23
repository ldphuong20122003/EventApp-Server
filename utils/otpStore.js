/**
 * Lưu OTP chờ xác thực (in-memory).
 * Key: email (lowercase), value: { otp, expiresAt, ...data }
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
  if (!pending)
    return {
      valid: false,
      message: "Không tìm thấy yêu cầu gửi OTP. Vui lòng yêu cầu lại mã.",
    };
  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(key);
    return {
      valid: false,
      message: "Mã OTP đã hết hạn. Vui lòng yêu cầu lại mã.",
    };
  }
  if (pending.otp !== String(otp).trim()) {
    return { valid: false, message: "Mã OTP không đúng." };
  }
  pendingRegistrations.delete(key);
  return { valid: true };
}

module.exports = {
  generateOtp,
  setPending,
  getPending,
  verifyAndConsumeOtp,
  OTP_EXPIRY_MINUTES,
};
