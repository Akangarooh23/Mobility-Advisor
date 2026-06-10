// Lightweight alias — delegates to the main auth handler (GET = session check)
const authHandler = require("./auth");
module.exports = authHandler;
