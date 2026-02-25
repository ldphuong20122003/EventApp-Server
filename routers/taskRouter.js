const Router = require("express");
const { authenticateToken } = require("../middlewares/authMiddleware");
const taskController = require("../controllers/taskController");

const taskRouter = Router();

// Tạo công việc mới
taskRouter.post("/", authenticateToken, taskController.createTask);

// Lấy danh sách công việc của user hiện tại
taskRouter.get("/", authenticateToken, taskController.getTasks);

// Lấy danh sách công việc đã xóa (soft delete)
taskRouter.get("/deleted/list", authenticateToken, taskController.getDeletedTasks);

// Chi tiết công việc
taskRouter.get("/:id", authenticateToken, taskController.getTaskDetail);

// Xóa (mềm) công việc: cập nhật deletedAt
taskRouter.delete("/:id", authenticateToken, taskController.deleteTask);

// Cập nhật công việc
taskRouter.put("/:id", authenticateToken, taskController.updateTask);

module.exports = taskRouter;    

