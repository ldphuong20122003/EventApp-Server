const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "event-app-secret-key";

/**
 * Middleware xác thực JWT - gắn user vào req.user nếu token hợp lệ
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: "Token không được cung cấp" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "Token đã hết hạn" });
      }
      return res.status(403).json({ success: false, message: "Token không hợp lệ" });
    }
    req.user = decoded; // { userId, email }
    next();
  });
};

module.exports = { authenticateToken, JWT_SECRET };
