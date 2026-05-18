const asyncHandler = require("express-async-handler");
const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const User = require("../models/userModel");
const { sendProjectMemberInviteEmail } = require("../utils/sendEmail");

/** Khớp `projectModel`: status */
const PROJECT_STATUS_VALUES = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
];
/** Khớp `projectModel`: priority */
const PROJECT_PRIORITY_VALUES = ["low", "medium", "high"];

function normalizeIncomingStatus(status) {
  if (status === undefined || status === null) return undefined;
  return String(status).trim();
}

function isValidStatus(s) {
  return PROJECT_STATUS_VALUES.includes(s);
}

function normalizeIncomingPriority(priority) {
  if (priority === undefined || priority === null) return undefined;
  return String(priority).trim();
}

function isValidPriority(p) {
  return PROJECT_PRIORITY_VALUES.includes(p);
}

/** Khớp bảng màu ưu tiên phía client (`projectForm` / appColors) */
const PRIORITY_COLORS = {
  low: "#3B82F6",
  medium: "#F59E0B",
  high: "#E74C3C",
};

function colorFromPriority(priority) {
  if (priority === "low") return PRIORITY_COLORS.low;
  if (priority === "high") return PRIORITY_COLORS.high;
  return PRIORITY_COLORS.medium;
}

function normalizeMember(project, owner) {
  const members = Array.isArray(project.members)
    ? project.members.map((member) => ({
        userId: String(member.user?._id || member.user),
        email: member.user?.email || "",
        fullName: member.user?.fullName || "",
        role: member.role || "member",
        addedAt: member.addedAt,
      }))
    : [];

  if (owner && !members.some((m) => m.userId === String(owner._id))) {
    members.unshift({
      userId: String(owner._id),
      email: owner.email || "",
      fullName: owner.fullName || "",
      role: "owner",
      addedAt: project.createdAt,
    });
  }

  return members;
}

/**
 * userId lấy từ JWT sau middleware authenticateToken (Bearer token).
 * Không dùng owner/userId từ body để tránh giả mạo.
 */
const getOwnerIdFromToken = (req) =>
  req.user && req.user.userId ? req.user.userId : null;

const withComputedProgress = async (project, ownerId) => {
  const [totalTasks, doneTasks] = await Promise.all([
    Task.countDocuments({
      owner: ownerId,
      project: project._id,
      deletedAt: null,
    }),
    Task.countDocuments({
      owner: ownerId,
      project: project._id,
      status: "done",
      deletedAt: null,
    }),
  ]);

  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  return {
    ...project.toObject(),
    progress,
    taskNumber: totalTasks,
  };
};

const projectController = {
  /**
   * GET /projects — Danh sách project của user (chưa xóa mềm)
   */
  getProjects: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const { q, status, priority, is_favorite } = req.query;
    const query = {
      createdBy: ownerId,
      deletedAt: null,
    };

    if (q && String(q).trim()) {
      const keyword = String(q).trim();
      query.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }

    const statusNorm = normalizeIncomingStatus(status);
    if (statusNorm) {
      if (!isValidStatus(statusNorm)) {
        return res.status(400).json({
          success: false,
          message: `status không hợp lệ. Cho phép: ${PROJECT_STATUS_VALUES.join(", ")}`,
        });
      }
      query.status = statusNorm;
    }

    const priorityNorm = normalizeIncomingPriority(priority);
    if (priorityNorm) {
      if (!isValidPriority(priorityNorm)) {
        return res.status(400).json({
          success: false,
          message: `priority không hợp lệ. Cho phép: ${PROJECT_PRIORITY_VALUES.join(", ")}`,
        });
      }
      query.priority = priorityNorm;
    }

    if (is_favorite !== undefined) {
      const favoriteRaw = String(is_favorite).toLowerCase().trim();
      if (favoriteRaw !== "true" && favoriteRaw !== "false") {
        return res.status(400).json({
          success: false,
          message: "is_favorite chỉ nhận true hoặc false",
        });
      }
      query.is_favorite = favoriteRaw === "true";
    }

    const projects = await Project.find(query).sort({ createdAt: -1 });

    const projectsWithProgress = await Promise.all(
      projects.map((project) => withComputedProgress(project, ownerId))
    );

    return res.json({
      success: true,
      message: "Lấy danh sách project thành công",
      data: { projects: projectsWithProgress },
    });
  }),

  /**
   * GET /projects/:id/stats — Thống kê task theo project
   */
  getProjectStats: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy project",
      });
    }

    const [total, done, inProgress, pending] = await Promise.all([
      Task.countDocuments({
        owner: ownerId,
        project: project._id,
        deletedAt: null,
      }),
      Task.countDocuments({
        owner: ownerId,
        project: project._id,
        status: "done",
        deletedAt: null,
      }),
      Task.countDocuments({
        owner: ownerId,
        project: project._id,
        status: "in_progress",
        deletedAt: null,
      }),
      Task.countDocuments({
        owner: ownerId,
        project: project._id,
        status: "pending",
        deletedAt: null,
      }),
    ]);

    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

    return res.json({
      success: true,
      message: "Lấy thống kê project thành công",
      data: {
        stats: {
          projectId: String(project._id),
          totalTasks: total,
          doneTasks: done,
          inProgressTasks: inProgress,
          pendingTasks: pending,
          progress,
        },
      },
    });
  }),

  /**
   * GET /projects/:id/members — Lấy danh sách thành viên project
   */
  getProjectMembers: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    }).populate("members.user", "fullName email");

    if (!project) {
      return res.status(404).json({ success: false, message: "Không tìm thấy project" });
    }

    const owner = await User.findById(ownerId).select("fullName email");

    return res.json({
      success: true,
      message: "Lấy danh sách thành viên thành công",
      data: { members: normalizeMember(project, owner) },
    });
  }),

  /**
   * POST /projects/:id/members — Thêm thành viên theo email
   * Body: { email, role? }
   */
  addProjectMember: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    });
    if (!project) {
      return res.status(404).json({ success: false, message: "Không tìm thấy project" });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "member").trim();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email không được để trống" });
    }
    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role không hợp lệ" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user theo email" });
    }
    if (String(user._id) === String(ownerId)) {
      return res.status(400).json({ success: false, message: "Owner đã là thành viên mặc định" });
    }

    const exists = (project.members || []).some(
      (m) => String(m.user) === String(user._id)
    );
    if (exists) {
      return res.status(409).json({ success: false, message: "User đã thuộc project này" });
    }

    project.members.push({
      user: user._id,
      role,
      addedAt: new Date(),
    });
    await project.save();

    await project.populate("members.user", "fullName email");
    const owner = await User.findById(ownerId).select("fullName email");

    const inviterName = (owner && (owner.fullName || "").trim()) || owner?.email || "Người tạo dự án";
    sendProjectMemberInviteEmail(user.email, {
      projectName: project.name || "Dự án",
      inviterName,
      role,
    }).catch((err) => console.error("Project invite email (async):", err));

    return res.status(201).json({
      success: true,
      message: "Thêm thành viên thành công",
      data: { members: normalizeMember(project, owner) },
    });
  }),

  /**
   * PUT /projects/:id/members/:userId/role — Cập nhật role thành viên
   * Body: { role }
   */
  updateProjectMemberRole: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }

    const role = String(req.body?.role || "").trim();
    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role không hợp lệ" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    });
    if (!project) {
      return res.status(404).json({ success: false, message: "Không tìm thấy project" });
    }

    const targetUserId = String(req.params.userId);
    const member = (project.members || []).find(
      (m) => String(m.user) === targetUserId
    );
    if (!member) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thành viên" });
    }

    member.role = role;
    await project.save();
    await project.populate("members.user", "fullName email");
    const owner = await User.findById(ownerId).select("fullName email");

    return res.json({
      success: true,
      message: "Cập nhật quyền thành viên thành công",
      data: { members: normalizeMember(project, owner) },
    });
  }),

  /**
   * DELETE /projects/:id/members/:userId — Xóa thành viên khỏi project
   */
  removeProjectMember: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    });
    if (!project) {
      return res.status(404).json({ success: false, message: "Không tìm thấy project" });
    }

    const targetUserId = String(req.params.userId);
    const beforeCount = project.members.length;
    project.members = project.members.filter(
      (m) => String(m.user) !== targetUserId
    );

    if (beforeCount === project.members.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thành viên" });
    }

    await project.save();
    await project.populate("members.user", "fullName email");
    const owner = await User.findById(ownerId).select("fullName email");

    return res.json({
      success: true,
      message: "Đã xóa thành viên khỏi project",
      data: { members: normalizeMember(project, owner) },
    });
  }),

  /**
   * GET /projects/deleted/list — Danh sách project đã xóa mềm
   */
  getDeletedProjects: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const projects = await Project.find({
      createdBy: ownerId,
      deletedAt: { $ne: null },
    }).sort({ deletedAt: -1 });

    const projectsWithProgress = await Promise.all(
      projects.map((project) => withComputedProgress(project, ownerId))
    );

    return res.json({
      success: true,
      message: "Lấy danh sách project đã xóa thành công",
      data: { projects: projectsWithProgress },
    });
  }),

  /**
   * GET /projects/:id — Chi tiết một project
   */
  getProjectById: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy project",
      });
    }

    const projectWithProgress = await withComputedProgress(project, ownerId);

    return res.json({
      success: true,
      message: "OK",
      data: { project: projectWithProgress },
    });
  }),

  /**
   * POST /projects — Tạo project
   * Body: { name, description?, status?, priority?, startDate?, endDate?, color?, is_favorite? }
   * status: todo | in_progress | done | blocked | cancelled
   * priority: low | medium | high
   * color: nếu không gửi → gán theo priority (low=#3B82F6, medium=#F59E0B, high=#E74C3C)
   * createdBy từ token (MongoDB tự tạo `_id`).
   */
  createProject: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập hoặc token không hợp lệ",
      });
    }

    const {
      name,
      description,
      status,
      priority,
      startDate,
      endDate,
      is_favorite,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên project không được để trống",
      });
    }

    const statusNorm = normalizeIncomingStatus(status);
    if (statusNorm !== undefined && !isValidStatus(statusNorm)) {
      return res.status(400).json({
        success: false,
        message: `status không hợp lệ. Cho phép: ${PROJECT_STATUS_VALUES.join(", ")}`,
      });
    }

    const priorityNorm = normalizeIncomingPriority(priority);
    if (priorityNorm !== undefined && !isValidPriority(priorityNorm)) {
      return res.status(400).json({
        success: false,
        message: `priority không hợp lệ. Cho phép: ${PROJECT_PRIORITY_VALUES.join(", ")}`,
      });
    }

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    if (startDate && Number.isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "startDate không hợp lệ",
      });
    }

    if (endDate && Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "endDate không hợp lệ",
      });
    }

    if (
      parsedStartDate &&
      parsedEndDate &&
      parsedEndDate.getTime() < parsedStartDate.getTime()
    ) {
      return res.status(400).json({
        success: false,
        message: "endDate phải lớn hơn hoặc bằng startDate",
      });
    }

    const resolvedPriority = priorityNorm !== undefined ? priorityNorm : "medium";
    const resolvedColor = colorFromPriority(resolvedPriority);

    const project = await Project.create({
      name: String(name).trim(),
      description:
        description !== undefined && description !== null
          ? String(description).trim()
          : undefined,
      status: statusNorm !== undefined ? statusNorm : "todo",
      priority: resolvedPriority,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      color: resolvedColor,
      is_favorite: is_favorite !== undefined ? Boolean(is_favorite) : false,
      createdBy: ownerId,
    });

    const projectWithProgress = await withComputedProgress(project, ownerId);

    return res.status(201).json({
      success: true,
      message: "Tạo project thành công",
      data: { project: projectWithProgress },
    });
  }),

  /**
   * PUT /projects/:id — Cập nhật project
   * Body: { name?, description?, status?, priority?, progress?, startDate?, endDate?, color?, is_favorite? }
   * Đổi priority mà không gửi color → cập nhật color theo priority mới.
   */
  updateProject: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const {
      name,
      description,
      status,
      priority,
      progress: progressBody,
      startDate,
      endDate,
      color,
      is_favorite,
    } = req.body;

    let project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    });

    if (!project) {
      const memberProject = await Project.findOne({
        _id: req.params.id,
        deletedAt: null,
        members: { $elemMatch: { user: ownerId } },
      });
      if (memberProject) {
        const memberTriesOtherFields =
          name !== undefined ||
          description !== undefined ||
          status !== undefined ||
          priority !== undefined ||
          progressBody !== undefined ||
          startDate !== undefined ||
          endDate !== undefined ||
          color !== undefined;
        if (memberTriesOtherFields) {
          return res.status(403).json({
            success: false,
            message: "Thành viên chỉ được cập nhật yêu thích (is_favorite)",
          });
        }
        if (is_favorite === undefined) {
          return res.status(400).json({
            success: false,
            message: "Thành viên chỉ được gửi is_favorite",
          });
        }
        memberProject.is_favorite = Boolean(is_favorite);
        await memberProject.save();
        const projectWithProgress = await withComputedProgress(
          memberProject,
          String(memberProject.createdBy),
        );
        return res.json({
          success: true,
          message: "Cập nhật yêu thích thành công",
          data: { project: projectWithProgress },
        });
      }
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy project",
      });
    }

    const statusNorm = normalizeIncomingStatus(status);
    if (status !== undefined && statusNorm !== undefined && !isValidStatus(statusNorm)) {
      return res.status(400).json({
        success: false,
        message: `status không hợp lệ. Cho phép: ${PROJECT_STATUS_VALUES.join(", ")}`,
      });
    }

    const priorityNorm = normalizeIncomingPriority(priority);
    if (priority !== undefined && priorityNorm !== undefined && !isValidPriority(priorityNorm)) {
      return res.status(400).json({
        success: false,
        message: `priority không hợp lệ. Cho phép: ${PROJECT_PRIORITY_VALUES.join(", ")}`,
      });
    }

    if (progressBody !== undefined) {
      const n = Number(progressBody);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        return res.status(400).json({
          success: false,
          message: "progress phải là số từ 0 đến 100",
        });
      }
    }

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    if (startDate && Number.isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "startDate không hợp lệ",
      });
    }

    if (endDate && Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "endDate không hợp lệ",
      });
    }

    if (
      parsedStartDate &&
      parsedEndDate &&
      parsedEndDate.getTime() < parsedStartDate.getTime()
    ) {
      return res.status(400).json({
        success: false,
        message: "endDate phải lớn hơn hoặc bằng startDate",
      });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Tên project không được để trống",
        });
      }
      project.name = String(name).trim();
    }
    if (description !== undefined) {
      project.description = description !== null ? String(description).trim() : "";
    }
    if (status !== undefined && statusNorm !== undefined) {
      project.status = statusNorm;
    }
    if (priority !== undefined && priorityNorm !== undefined) {
      project.priority = priorityNorm;
    }
    if (color !== undefined && String(color).trim()) {
      project.color = String(color).trim();
    } else if (priority !== undefined && priorityNorm !== undefined) {
      project.color = colorFromPriority(priorityNorm);
    }
    if (progressBody !== undefined) {
      project.progress = Number(progressBody);
    }
    if (startDate !== undefined) {
      project.startDate = parsedStartDate;
    }
    if (endDate !== undefined) {
      project.endDate = parsedEndDate;
    }
    if (is_favorite !== undefined) {
      project.is_favorite = Boolean(is_favorite);
    }

    await project.save();
    const projectWithProgress = await withComputedProgress(project, ownerId);

    return res.json({
      success: true,
      message: "Cập nhật project thành công",
      data: { project: projectWithProgress },
    });
  }),

  /**
   * DELETE /projects/:id — Xóa mềm project; gỡ project khỏi các task liên quan
   */
  deleteProject: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: null,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy project",
      });
    }

    project.deletedAt = new Date();
    await project.save();

    await Task.updateMany(
      { owner: ownerId, project: project._id },
      { $unset: { project: 1 } }
    );

    return res.json({
      success: true,
      message: "Đã xóa project",
      data: { project },
    });
  }),

  /**
   * PUT /projects/:id/restore — Khôi phục project đã xóa mềm (đặt deletedAt = null)
   */
  restoreProject: asyncHandler(async (req, res) => {
    const ownerId = getOwnerIdFromToken(req);
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      createdBy: ownerId,
      deletedAt: { $ne: null },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy project đã xóa hoặc project vẫn đang hoạt động",
      });
    }

    project.deletedAt = null;
    await project.save();

    const projectWithProgress = await withComputedProgress(project, ownerId);

    return res.json({
      success: true,
      message: "Đã khôi phục project",
      data: { project: projectWithProgress },
    });
  }),
};

module.exports = projectController;
