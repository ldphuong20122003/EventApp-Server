const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const { sendOtpEmail } = require("../utils/sendEmail");
const { JWT_SECRET } = require("../middlewares/authMiddleware");

const TOKEN_EXPIRES = "7d";

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const sanitizeUser = (user) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : user;
  const { password, ...rest } = obj;
  return rest;
};

const generateToken = (userId, email) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
};

const authControler = {
  /**
   * POST /auth/register - Đăng ký tài khoản mới
   */
  register: asyncHandler(async (req, res) => {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập email và mật khẩu",
        });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Email không hợp lệ",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu phải có ít nhất 6 ký tự",
        });
      }

      const existing = await User.findOne({ email: email.trim().toLowerCase() });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Email đã được sử dụng",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        fullName: fullName ? fullName.trim() : null,
      });

      await newUser.save();

      const token = generateToken(newUser._id.toString(), newUser.email);

      return res.status(201).json({
        success: true,
        message: "Đăng ký thành công",
        data: {
          token,
        },
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi đăng ký",
      });
    }
  }),

  /**
   * POST /auth/login - Đăng nhập
   */
  login: asyncHandler(async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập email và mật khẩu",
        });
      }

      const user = await User.findOne({ email: email.trim().toLowerCase() });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Email hoặc mật khẩu không đúng",
        });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({
          success: false,
          message: "Email hoặc mật khẩu không đúng",
        });
      }

      const token = generateToken(user._id.toString(), user.email);

      return res.json({
        success: true,
        message: "Đăng nhập thành công",
        data: {
          token,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi đăng nhập",
      });
    }
  }),

  /**
   * POST /auth/send-otp - Gửi mã OTP đến email
   */
  sendOtp: asyncHandler(async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email không được để trống",
        });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Email không hợp lệ",
        });
      }
      const otp = Math.floor(100000 + Math.random() * 900000);
      await sendOtpEmail(email, otp);
      return res.json({
        success: true,
        message: "Mã xác thực đã được gửi đến email",
        data: {
          otp,
        },
      });
    } catch (err) {
      console.error("Verification error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi xác thực",
      });
    }
  }),

  /**
   * GET /auth/me - Lấy thông tin user hiện tại (cần gửi kèm token)
   */
  getProfile: asyncHandler(async (req, res) => {
    try {
      // Lấy token từ header Authorization: Bearer <token>
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ hoặc thiếu token",
        });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ hoặc thiếu token",
        });
      }

      // Xác thực token
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.userId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      // Tìm người dùng dựa vào userId trong token
      const user = await User.findById(decoded.userId);
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
};

module.exports = authControler;
