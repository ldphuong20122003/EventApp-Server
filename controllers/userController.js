const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");

const sanitizeUser = (user) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : user;
  const { password, ...rest } = obj;
  return rest;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const userController = {
  /**
   * GET /user/me - Lấy thông tin user hiện tại (dựa trên token đã được xác thực)
   */
  getProfile: asyncHandler(async (req, res) => {
    try {
      // req.user đã được gắn từ middleware authenticateToken
      const userId = req.user && req.user.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng",
        });
      }

      return res.json({
        success: true,
        data: { user: sanitizeUser(user) },
      });
    } catch (err) {
      console.error("Get profile by token error:", err);
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn",
      });
    }
  }),

  /**
   * PUT /user/update-profile - Cập nhật thông tin user (fullName, email)
   */
  updateProfile: asyncHandler(async (req, res) => {
    try {
      const { fullName, email } = req.body;

      const userId = req.user && req.user.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng",
        });
      }

      if (email) {
        if (!validateEmail(email)) {
          return res.status(400).json({
            success: false,
            message: "Email không hợp lệ",
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        // Kiểm tra email đã được dùng bởi user khác chưa
        const existing = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id },
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: "Email đã được sử dụng bởi tài khoản khác",
          });
        }

        user.email = normalizedEmail;
      }

      if (fullName !== undefined) {
        user.fullName = fullName ? fullName.trim() : null;
      }

      await user.save();

      return res.json({
        success: true,
        message: "Cập nhật thông tin người dùng thành công",
        data: { user: sanitizeUser(user) },
      });
    } catch (err) {
      console.error("Update profile error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi cập nhật thông tin người dùng",
      });
    }
  }),

  /**
   * PUT /user/update-password - Cập nhật mật khẩu user
   */
  updatePassword: asyncHandler(async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu hiện tại và mật khẩu mới không được để trống",
        });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu mới phải có ít nhất 6 ký tự",
        });
      }
      // req.user được gắn sẵn từ middleware authenticateToken dựa trên token
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng",
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(401).json({
          success: false,
          message: "Mật khẩu hiện tại không đúng",
        });
      }
      user.password = hashedPassword;
      await user.save();
      return res.json({
        success: true,
        message: "Mật khẩu đã được cập nhật thành công",
      });
    } catch (err) {
      console.error("Update password error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi cập nhật mật khẩu",
      });
    }
  }),
};

module.exports = userController;