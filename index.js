const express = require("express");
const app = express();
const cors = require("cors");

app.use(cors());

const PORT = 3000;

app.listen(PORT, (error) => {
  if (error) {
    console.log("Error: ", error);
    return;
  }
  console.log(`Server is running at http://localhost:${PORT}`);
});
