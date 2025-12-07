const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
    email: { type: String, required: false },
    name: { type: String, required: false },
    phone: { type: String, required: true },
    profileImage: { data: Buffer, contentType: String }
})

const publishLoadSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userData',
        required: true
    },
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: Number, required: true },
    loadType: { type: String, required: false },
    capacity: { type: String, required: false },
    truckType: { type: String, required: false },
    company: { type: String, required: true },
    phoneNo: { type: String, required: true },
    alternativeNo: { type: String, required: false },
    userPhone: { type: String, required: false },
    scheduleDate: { type: Date, required: true},
    expireAt: { type: Date},
    createdAt: { type: Date },
    status: { type: String, default: "active" }, // active | completed | deleted
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId }]
});

const UserData = mongoose.model('userData', userDataSchema);
const PublishLoad = mongoose.model('publishLoad', publishLoadSchema);

module.exports = { UserData, PublishLoad };