const Router = require("express");
const authControler = require("../controlers/authControler");
const { authenticateToken } = require("../middlewares/authMiddleware");

const authRouter = Router();

// Đăng ký
authRouter.post("/register", authControler.register);

// Đăng nhập
authRouter.post("/login", authControler.login);

// Lấy thông tin user hiện tại (yêu cầu đăng nhập)
authRouter.get("/me", authenticateToken, authControler.getProfile);

module.exports = authRouter;
