const express = require("express");
const app = express();
const cors = require("cors");
const authRouter = require("./routers/authRouter");
const userRouter = require("./routers/userRouter");
const taskRouter = require("./routers/taskRouter");
const connectDb = require("./configs/connectDb");
const errorMiddleware = require("./middlewares/errorMiddleware");

app.use(express.json());
app.use(cors());

const PORT = 3000;

app.use("/auth", authRouter);
app.use("/user", userRouter);
app.use("/tasks", taskRouter);

connectDb();

app.use(errorMiddleware)

app.listen(PORT, (error) => {
  if (error) {
    console.log("Error: ", error);
    return;
  }
  console.log(`Server is running at http://localhost:${PORT}`);
});
