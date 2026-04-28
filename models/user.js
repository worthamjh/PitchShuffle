const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose').default;

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    subscription: {
        status: { 
            type: String, 
            enum: ['free', 'active', 'past_due', 'cancelled'],
            default: 'free' 
        },
        stripeCustomerId: { type: String },
    }
});

UserSchema.plugin(passportLocalMongoose); // adds username + password hashing

module.exports = mongoose.model('User', UserSchema);