const errorMiddleware = (err, _req, res, next) => {
    const statusCode = res.statusCode ? res.statusCode : 500;
    const message = err.message || "Lỗi server";
    res.status(statusCode).json({ success: false, message, stack: err.stack });
};

module.exports = errorMiddleware;