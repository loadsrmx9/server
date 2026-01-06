const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
  email: { type: String, required: false },
  name: { type: String, required: false },
  phone: { type: String, required: true },
  profileImage: { type: String, default: null },
  totalLoads: { type: Number, default: 0 },
  completed: { type: Number, default: 0 },
  cancelled: { type: Number, default: 0 }
})

const UserData = mongoose.model('userData', userDataSchema);

module.exports = { UserData }