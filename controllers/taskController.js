const asyncHandler = require("express-async-handler");
const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const User = require("../models/userModel");
const {
  notifyAssigneesAdded,
  notifyTaskCommentRecipients,
} = require("../utils/taskNotify");

const TASK_STATUS_VALUES = ["pending", "in_progress", "done"];
const TASK_PRIORITY_VALUES = ["low", "medium", "high"];

async function populateTaskComments(task) {
  if (!task) return task;
  await task.populate({
    path: "comments.author",
    select: "fullName email",
  });
  return task;
}

function normalizeAssigneesFromBody(body) {
  if (body.assignees !== undefined) {
    if (!Array.isArray(body.assignees)) return [];
    return [...new Set(body.assignees.map((x) => String(x).trim()).filter(Boolean))];
  }
  if (body.assignee !== undefined) {
    if (!body.assignee) return [];
    return [String(body.assignee).trim()].filter(Boolean);
  }
  return [];
}

function shouldUpdateAssigneesFromBody(body) {
  return body.assignees !== undefined || body.assignee !== undefined;
}

/** Mỗi user trong assigneeIds phải là thành viên dự án khi task có project */
async function validateAssigneesForTask(projectId, assigneeIds) {
  const ids = Array.isArray(assigneeIds)
    ? [...new Set(assigneeIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];
  if (ids.length === 0) return null;
  if (!projectId) {
    return {
      status: 400,
      message: "Chỉ có thể gán thành viên khi công việc thuộc một dự án.",
    };
  }
  const project = await Project.findById(projectId);
  if (!project) {
    return { status: 404, message: "Không tìm thấy dự án." };
  }
  const allowed = new Set();
  if (project.createdBy) allowed.add(String(project.createdBy));
  for (const m of project.members || []) {
    if (m.user) allowed.add(String(m.user));
  }
  for (const aid of ids) {
    if (!allowed.has(aid)) {
      return {
        status: 400,
        message: "Chỉ có thể gán thành viên đang tham gia dự án này.",
      };
    }
  }
  return null;
}

async function populateTaskForResponse(task) {
  if (!task) return task;
  await task.populate({ path: "assignees", select: "fullName email" });
  await populateTaskComments(task);
  return task;
}

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

      if (status && !TASK_STATUS_VALUES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status không hợp lệ",
        });
      }
      if (priority && !TASK_PRIORITY_VALUES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "priority không hợp lệ",
        });
      }

      const parsedDueDate = dueDate ? new Date(dueDate) : undefined;
      if (dueDate && Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "dueDate không hợp lệ",
        });
      }

      const assigneeIds = normalizeAssigneesFromBody(req.body);
      const assigneeErr = await validateAssigneesForTask(project, assigneeIds);
      if (assigneeErr) {
        return res.status(assigneeErr.status).json({
          success: false,
          message: assigneeErr.message,
        });
      }

      const task = new Task({
        title: title.trim(),
        description: description ? description.trim() : "",
        status: status || "pending",
        priority: priority || "medium",
        project: project || null,
        dueDate: parsedDueDate,
        assignees: assigneeIds,
        completedAt: status === "done" ? new Date() : null,
        owner: ownerId,
      });

      await task.save();
      await populateTaskForResponse(task);

      if (assigneeIds.length) {
        notifyAssigneesAdded(ownerId, assigneeIds, task).catch((e) =>
          console.error("notifyAssigneesAdded(createTask):", e),
        );
      }

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

      const { status, priority, search, project } = req.query;
      const filter = { owner: ownerId, deletedAt: null };

      if (status) {
        filter.status = status;
      }

      if (priority) {
        filter.priority = priority;
      }
      if (project) {
        filter.project = project;
      }

      if (search && search.trim()) {
        const keyword = search.trim();
        filter.$or = [
          { title: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
        ];
      }

      const tasks = await Task.find(filter).select("-comments").sort({ createdAt: -1 });

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

      await populateTaskForResponse(task);

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

      const prevAssigneeIds = (task.assignees || []).map((id) => String(id));

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
        if (!TASK_STATUS_VALUES.includes(status)) {
          return res.status(400).json({
            success: false,
            message: "status không hợp lệ",
          });
        }
        task.status = status;
        task.completedAt = status === "done" ? new Date() : null;
      }

      if (priority !== undefined) {
        if (!TASK_PRIORITY_VALUES.includes(priority)) {
          return res.status(400).json({
            success: false,
            message: "priority không hợp lệ",
          });
        }
        task.priority = priority;
      }

      if (dueDate !== undefined) {
        task.dueDate = dueDate ? new Date(dueDate) : undefined;
      }

      if (project !== undefined) {
        task.project = project || null;
        if (!task.project) {
          task.assignees = [];
        }
      }
      if (shouldUpdateAssigneesFromBody(req.body)) {
        task.assignees = normalizeAssigneesFromBody(req.body);
      }

      const assigneeErr = await validateAssigneesForTask(task.project, task.assignees);
      if (assigneeErr) {
        return res.status(assigneeErr.status).json({
          success: false,
          message: assigneeErr.message,
        });
      }

      await task.save();
      await populateTaskForResponse(task);

      const nextAssigneeIds = (task.assignees || []).map((id) => String(id));
      const addedAssignees = nextAssigneeIds.filter((id) => !prevAssigneeIds.includes(id));
      if (addedAssignees.length) {
        notifyAssigneesAdded(ownerId, addedAssignees, task).catch((e) =>
          console.error("notifyAssigneesAdded(updateTask):", e),
        );
      }

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

  /**
   * POST /tasks/:id/comments — Thêm bình luận (chỉ chủ task)
   * multipart: text (optional), image (optional) — cần ít nhất một trong hai
   */
  addTaskComment: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const text = String(req.body?.text || "").trim();
      const hasFile = Boolean(req.file);
      if (!text && !hasFile) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập nội dung hoặc đính kèm ảnh",
        });
      }
      if (text.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Bình luận tối đa 2000 ký tự",
        });
      }

      const task = await Task.findOne({
        _id: req.params.id,
        owner: ownerId,
        deletedAt: null,
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy công việc",
        });
      }

      const imageUrl = hasFile ? `/uploads/task-comments/${req.file.filename}` : "";

      task.comments.push({
        author: ownerId,
        text,
        imageUrl,
        createdAt: new Date(),
      });
      await task.save();
      await populateTaskForResponse(task);

      notifyTaskCommentRecipients(task, ownerId, text, hasFile).catch((e) =>
        console.error("notifyTaskCommentRecipients:", e),
      );

      return res.status(201).json({
        success: true,
        message: "Đã thêm bình luận",
        data: { task },
      });
    } catch (err) {
      console.error("Add task comment error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi thêm bình luận",
      });
    }
  }),

  /**
   * PUT /tasks/:id/restore - Khôi phục task đã xóa mềm
   */
  restoreTask: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const task = await Task.findOne({
        _id: req.params.id,
        owner: ownerId,
        deletedAt: { $ne: null },
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy task đã xóa",
        });
      }

      task.deletedAt = null;
      await task.save();

      return res.json({
        success: true,
        message: "Khôi phục task thành công",
        data: { task },
      });
    } catch (err) {
      console.error("Restore task error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi khôi phục task",
      });
    }
  }),

  /**
   * PUT /tasks/:id/assign - Gán danh sách người thực hiện
   * Body: { assignees: string[] } hoặc legacy { assignee }
   */
  assignTask: asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user && req.user.userId;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
      }

      const task = await Task.findOne({
        _id: req.params.id,
        owner: ownerId,
        deletedAt: null,
      });
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy công việc",
        });
      }

      const prevAssigneeIds = (task.assignees || []).map((id) => String(id));

      const nextIds = normalizeAssigneesFromBody(req.body);
      for (const id of nextIds) {
        const u = await User.findById(id);
        if (!u) {
          return res.status(404).json({
            success: false,
            message: `Không tìm thấy user: ${id}`,
          });
        }
      }
      task.assignees = nextIds;
      const assigneeErr = await validateAssigneesForTask(task.project, task.assignees);
      if (assigneeErr) {
        return res.status(assigneeErr.status).json({
          success: false,
          message: assigneeErr.message,
        });
      }

      await task.save();
      await populateTaskForResponse(task);

      const addedAssignees = nextIds
        .map((id) => String(id))
        .filter((id) => !prevAssigneeIds.includes(id));
      if (addedAssignees.length) {
        notifyAssigneesAdded(ownerId, addedAssignees, task).catch((e) =>
          console.error("notifyAssigneesAdded(assignTask):", e),
        );
      }

      return res.json({
        success: true,
        message: "Cập nhật người thực hiện thành công",
        data: { task },
      });
    } catch (err) {
      console.error("Assign task error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi gán người thực hiện",
      });
    }
  }),
};

module.exports = taskController;

