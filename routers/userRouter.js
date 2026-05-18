const Router = require("express");
const { authenticateToken } = require("../middlewares/authMiddleware");
const uploadAvatar = require("../middlewares/uploadAvatarMiddleware");
const userController = require("../controllers/userController");

const userRouter = Router();

userRouter.get("/me", authenticateToken, userController.getProfile);
userRouter.get("/list", authenticateToken, userController.getUsers);
userRouter.put("/update-profile", authenticateToken, userController.updateProfile);
userRouter.post(
  "/avatar",
  authenticateToken,
  uploadAvatar.single("avatar"),
  userController.uploadAvatar,
);
userRouter.put("/update-password", authenticateToken, userController.updatePassword);
module.exports = userRouter;