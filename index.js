const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const cors = require("cors");
const authRouter = require("./routers/authRouter");
const userRouter = require("./routers/userRouter");
const taskRouter = require("./routers/taskRouter");
const projectRouter = require("./routers/projectRouter");
const connectDb = require("./configs/connectDb");
const errorMiddleware = require("./middlewares/errorMiddleware");

const uploadsRoot = path.join(__dirname, "uploads");
const avatarsDir = path.join(uploadsRoot, "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(uploadsRoot));

const PORT = 3000;

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/projects", projectRouter);

connectDb();

app.use(errorMiddleware)

app.listen(PORT, (error) => {
  if (error) {
    console.log("Error: ", error);
    return;
  }
  console.log(`Server is running at http://localhost:${PORT}`);
});
