const Router = require("express");
const authController = require("../controlers/authController");

const authRouter = Router();

// Đăng ký
authRouter.post("/register", authController.register);

// Đăng nhập
authRouter.post("/login", authController.login);

// Xác thực
authRouter.post("/send-otp", authController.sendOtp);
authRouter.post("/verify-otp", authController.verifyOtp);


module.exports = authRouter;
