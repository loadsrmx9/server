const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
  email: { type: String, required: false },
  name: { type: String, required: false },
  phone: { type: String, required: true },
  profileImage: { data: Buffer, contentType: String }
})

const UserData = mongoose.model('userData', userDataSchema);

module.exports ={UserData}