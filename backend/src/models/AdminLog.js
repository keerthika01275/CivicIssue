const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // admin performing the action
  timestamp: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed },
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);

