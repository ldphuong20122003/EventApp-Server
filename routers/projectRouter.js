const Router = require("express");
const { authenticateToken } = require("../middlewares/authMiddleware");
const projectController = require("../controllers/projectController");

const projectRouter = Router();

projectRouter.get("/", authenticateToken, projectController.getProjects);
projectRouter.get(
  "/deleted/list",
  authenticateToken,
  projectController.getDeletedProjects
);
projectRouter.put(
  "/:id/restore",
  authenticateToken,
  projectController.restoreProject
);
projectRouter.get("/:id/stats", authenticateToken, projectController.getProjectStats);
projectRouter.get("/:id/members", authenticateToken, projectController.getProjectMembers);
projectRouter.post("/:id/members", authenticateToken, projectController.addProjectMember);
projectRouter.put(
  "/:id/members/:userId/role",
  authenticateToken,
  projectController.updateProjectMemberRole
);
projectRouter.delete(
  "/:id/members/:userId",
  authenticateToken,
  projectController.removeProjectMember
);
projectRouter.get("/:id", authenticateToken, projectController.getProjectById);
projectRouter.post("/", authenticateToken, projectController.createProject);
projectRouter.put("/:id", authenticateToken, projectController.updateProject);
projectRouter.delete("/:id", authenticateToken, projectController.deleteProject);

module.exports = projectRouter;
