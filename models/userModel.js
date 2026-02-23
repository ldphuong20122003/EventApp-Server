const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
    },
    updatedAt: {
        type: Date,
        default: Date.now(),
    },
    imageUrl: {
        type: String,
        default: "",
    },
    address: {
        type: String,
        default: "",
    },
});

const User = mongoose.model("User", userSchema);

module.exports = User;