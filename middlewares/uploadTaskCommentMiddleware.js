const fs = require("fs");
const multer = require("multer");
const path = require("path");

const dir = path.join(__dirname, "..", "uploads", "task-comments");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const userId = (req.user && req.user.userId) || "anon";
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `c-${userId}-${Date.now()}${safeExt}`);
  },
});

const fileFilter = (_, file, cb) => {
  const ok = /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype);
  if (!ok) {
    cb(new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP"));
    return;
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});
