const asyncHandler = require("express-async-handler");
const Task = require("../models/taskModel");

const taskController = {
  /**
   * POST /tasks - Tạo công việc mới
   * Body: { title, description?, status?, dueDate?, priority?, project? }
   * Yêu cầu đã đăng nhập (dùng authenticateToken), gắn owner = req.user.userId
   */
  createTask: asyncHandler(async (req, res) => {
    try {
      const { title, description, status, dueDate, priority, project } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Tiêu đề công việc không được để trống",
        });
      }

      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const task = new Task({
        title: title.trim(),
        description: description ? description.trim() : "",
        status: status || "pending",
        priority: priority || "medium",
        project: project || null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        owner: ownerId,
      });

      await task.save();

      return res.status(201).json({
        success: true,
        message: "Tạo công việc thành công",
        data: { task },
      });
    } catch (err) {
      console.error("Create task error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo công việc",
      });
    }
  }),

  /**
   * GET /tasks - Lấy danh sách công việc của user hiện tại
   * Query optional: status, priority, search
   */
  getTasks: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const { status, priority, search } = req.query;
      const filter = { owner: ownerId, deletedAt: null };

      if (status) {
        filter.status = status;
      }

      if (priority) {
        filter.priority = priority;
      }

      if (search && search.trim()) {
        const keyword = search.trim();
        filter.$or = [
          { title: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
        ];
      }

      const tasks = await Task.find(filter).sort({ createdAt: -1 });

      return res.json({
        success: true,
        data: { tasks },
      });
    } catch (err) {
      console.error("Get tasks error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy danh sách công việc",
      });
    }
  }),

  /**
   * GET /tasks/deleted - Lấy danh sách công việc đã xóa (soft delete)
   * Query optional: status, priority, search
   */
  getDeletedTasks: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const { status, priority, search } = req.query;
      const filter = { owner: ownerId, deletedAt: { $ne: null } };

      if (status) {
        filter.status = status;
      }

      if (priority) {
        filter.priority = priority;
      }

      if (search && search.trim()) {
        const keyword = search.trim();
        filter.$or = [
          { title: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
        ];
      }

      const tasks = await Task.find(filter).sort({ deletedAt: -1 });

      return res.json({
        success: true,
        data: { tasks },
      });
    } catch (err) {
      console.error("Get deleted tasks error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy danh sách công việc đã xóa",
      });
    }
  }),

  /**
   * GET /tasks/:id - Chi tiết công việc
   */
  getTaskDetail: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const { id } = req.params;

      const task = await Task.findOne({
        _id: id,
        owner: ownerId,
        deletedAt: null,
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy công việc",
        });
      }

      return res.json({
        success: true,
        data: { task },
      });
    } catch (err) {
      console.error("Get task detail error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy chi tiết công việc",
      });
    }
  }),

  /**
   * DELETE /tasks/:id - Xóa (mềm) công việc: cập nhật deletedAt
   */
  deleteTask: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const { id } = req.params;

      const task = await Task.findOne({
        _id: id,
        owner: ownerId,
        deletedAt: null,
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy công việc",
        });
      }

      task.deletedAt = new Date();
      await task.save();

      return res.json({
        success: true,
        message: "Xóa công việc thành công",
      });
    } catch (err) {
      console.error("Delete task error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi xóa công việc",
      });
    }
  }),

  /**
   * PUT /tasks/:id - Cập nhật công việc
   * Body optional: { title, description, status, priority, dueDate, project }
   */
  updateTask: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const { id } = req.params;
      const { title, description, status, priority, dueDate, project } = req.body;

      const task = await Task.findOne({
        _id: id,
        owner: ownerId,
        deletedAt: null,
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy công việc",
        });
      }

      if (title !== undefined) {
        if (!title || !title.trim()) {
          return res.status(400).json({
            success: false,
            message: "Tiêu đề công việc không được để trống",
          });
        }
        task.title = title.trim();
      }

      if (description !== undefined) {
        task.description = description ? description.trim() : "";
      }

      if (status !== undefined) {
        task.status = status;
      }

      if (priority !== undefined) {
        task.priority = priority;
      }

      if (dueDate !== undefined) {
        task.dueDate = dueDate ? new Date(dueDate) : undefined;
      }

      if (project !== undefined) {
        task.project = project || null;
      }

      await task.save();

      return res.json({
        success: true,
        message: "Cập nhật công việc thành công",
        data: { task },
      });
    } catch (err) {
      console.error("Update task error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi cập nhật công việc",
      });
    }
  }),
};

module.exports = taskController;

