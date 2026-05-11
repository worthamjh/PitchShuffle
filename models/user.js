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
    },

    // Profile picture (Cloudinary URL)
    avatar: { type: String, default: '' },

    // Visual preferences
    preferences: {
        theme:        { type: String, enum: ['light', 'dark'], default: 'light' },
        accentColor:  { type: String, default: '#1a2e4a' },
        strikeColor:  { type: String, default: '#c8ecd4' },
        chaseColor:   { type: String, default: '#fef3cd' },
        gameFontSize: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },
    }
});

UserSchema.plugin(passportLocalMongoose); // adds username + password hashing

module.exports = mongoose.model('User', UserSchema);
