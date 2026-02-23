require("dotenv").config();
const mongoose = require("mongoose");

const dbUrl = `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@cluster0.nfe26zu.mongodb.net/?appName=Cluster0`;

const connectDb = async () => {
    try {
      const connection = await mongoose.connect(dbUrl);
      console.log(`Connected to MongoDB: ${connection.connection.host} successfully`);
    } catch (error) {
        console.log("Error connecting to MongoDB", error);
        process.exit(1);
    }
}

module.exports = connectDb;