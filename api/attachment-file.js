const attachmentFileHandler = require("../lib/api/attachment-file-handler");

module.exports = async function attachmentFileRoute(req, res) {
  return attachmentFileHandler(req, res);
};
