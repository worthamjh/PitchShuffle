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

    // User-level preferences
    // Strike/chase/team colors are configured per team on the team edit page
    preferences: {
        theme:        { type: String, enum: ['light', 'dark'], default: 'light' },
        gameFontSize: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },
        voiceURI:     { type: String, default: '' }, // speech synthesis voice
    }
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);
