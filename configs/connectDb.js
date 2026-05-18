require("dotenv").config();
const mongoose = require("mongoose");
const Task = require("../models/taskModel");

const dbUrl = `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@cluster0.nfe26zu.mongodb.net/?appName=Cluster0`;

/** Một lần: field cũ assignee → assignees[] */
async function migrateTaskAssigneesField() {
  try {
    const r = await Task.collection.updateMany(
      { assignee: { $exists: true, $ne: null } },
      [
        {
          $set: {
            assignees: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$assignees", []] } }, 0] },
                { $ifNull: ["$assignees", []] },
                {
                  $cond: [
                    { $ne: [{ $ifNull: ["$assignee", null] }, null] },
                    ["$assignee"],
                    [],
                  ],
                },
              ],
            },
          },
        },
        { $unset: "assignee" },
      ],
    );
    if (r.modifiedCount > 0) {
      console.log(`Migrated ${r.modifiedCount} tasks (assignee → assignees).`);
    }
  } catch (err) {
    console.error("migrateTaskAssigneesField:", err.message);
  }
}

const connectDb = async () => {
    try {
      const connection = await mongoose.connect(dbUrl);
      console.log(`Connected to MongoDB: ${connection.connection.host} successfully`);
      await migrateTaskAssigneesField();
    } catch (error) {
        console.log("Error connecting to MongoDB", error);
        process.exit(1);
    }
}

module.exports = connectDb;