const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

/**
 * Thông báo qua email khi được thêm vào project
 * @param {string} to
 * @param {{ projectName: string, inviterName: string, role: string }} opts
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendProjectMemberInviteEmail(to, opts) {
  const { projectName, inviterName, role } = opts;
  const roleVi = role === "admin" ? "Quản trị viên" : "Thành viên";

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "[sendProjectMemberInviteEmail] Chưa cấu hình EMAIL — bỏ qua gửi mail tới",
      to,
    );
    return { success: true };
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: `Bạn được thêm vào dự án "${projectName}" - Event App`,
      html: `
        <p>Xin chào,</p>
        <p><strong>${inviterName || "Người quản lý dự án"}</strong> vừa thêm bạn vào dự án <strong>${projectName}</strong> với vai trò: <strong>${roleVi}</strong>.</p>
        <p>Mở ứng dụng Event App để xem chi tiết và làm việc cùng nhóm.</p>
        <p>Nếu bạn không mong đợi lời mời này, có thể bỏ qua email hoặc liên hệ người mời.</p>
        <p style="color:#666;font-size:12px;margin-top:24px;">— Event App</p>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Send project member invite email error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Thông báo được gán vào công việc
 */
async function sendTaskAssignedEmail(to, opts) {
  const { taskTitle, assignerName, taskId } = opts;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[sendTaskAssignedEmail] Chưa cấu hình EMAIL — bỏ qua gửi mail tới", to);
    return { success: true };
  }

  const tTitle = escapeHtml(taskTitle);
  const tName = escapeHtml(assignerName);
  const tId = escapeHtml(taskId);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: `Bạn được gán công việc: ${taskTitle} - Event App`,
      html: `
        <p>Xin chào,</p>
        <p><strong>${tName}</strong> vừa gán bạn vào công việc: <strong>${tTitle}</strong>.</p>
        <p>Mã tham chiếu task: <code>${tId}</code></p>
        <p>Mở ứng dụng Event App để xem chi tiết và cập nhật tiến độ.</p>
        <p style="color:#666;font-size:12px;margin-top:24px;">— Event App</p>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Send task assigned email error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Thông báo có bình luận mới trên task
 */
async function sendTaskCommentEmail(to, opts) {
  const { taskTitle, authorName, preview, hasImage, taskId } = opts;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[sendTaskCommentEmail] Chưa cấu hình EMAIL — bỏ qua gửi mail tới", to);
    return { success: true };
  }

  try {
    const safePreview = preview ? escapeHtml(preview) : "";
    const bodyLine = safePreview
      ? `<p style="background:#f4f4f5;padding:12px;border-radius:8px;">${safePreview}</p>`
      : hasImage
        ? "<p><em>Bình luận có đính kèm ảnh.</em></p>"
        : "<p><em>Có hoạt động mới trên công việc.</em></p>";

    const tTitle = escapeHtml(taskTitle);
    const tAuthor = escapeHtml(authorName);
    const tId = escapeHtml(taskId);

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: `Bình luận mới: ${taskTitle} - Event App`,
      html: `
        <p>Xin chào,</p>
        <p><strong>${tAuthor}</strong> vừa bình luận trên công việc <strong>${tTitle}</strong>.</p>
        ${bodyLine}
        <p>Mã tham chiếu: <code>${tId}</code></p>
        <p>Mở ứng dụng Event App để xem đầy đủ.</p>
        <p style="color:#666;font-size:12px;margin-top:24px;">— Event App</p>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Send task comment email error:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOtpEmail,
  sendProjectMemberInviteEmail,
  sendTaskAssignedEmail,
  sendTaskCommentEmail,
};
