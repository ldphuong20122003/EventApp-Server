const Router = require("express");
const { authenticateToken } = require("../middlewares/authMiddleware");
const userController = require("../controllers/userController");

const userRouter = Router();

userRouter.get("/me", authenticateToken, userController.getProfile);
// userRouter.put("/update-profile", authenticateToken, userController.updateProfile);
userRouter.put("/update-password", authenticateToken, userController.updatePassword);
module.exports = userRouter;