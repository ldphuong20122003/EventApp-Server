const express = require("express");
const app = express();
const cors = require("cors");
const authRouter = require("./routers/authRouter");
const connectDb = require("./configs/connectDb");
const errorMiddleware = require("./middlewares/errorMiddleware");

app.use(express.json());
app.use(cors());

const PORT = 3000;

app.use("/auth", authRouter);

connectDb();

app.use(errorMiddleware)

app.listen(PORT, (error) => {
  if (error) {
    console.log("Error: ", error);
    return;
  }
  console.log(`Server is running at http://localhost:${PORT}`);
});
