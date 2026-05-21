const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose').default;

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    subscription: {
        status: {
            type: String,
            enum: ['trialing', 'active', 'past_due', 'cancelled', 'none'],
            default: 'none'
        },
        stripeCustomerId:  { type: String, default: null },
        stripeSubId:       { type: String, default: null },
        trialEndsAt:       { type: Date,   default: null },
        currentPeriodEnds: { type: Date,   default: null },
    },

    // Profile picture (Cloudinary URL)
    avatar: { type: String, default: '' },

    // User-level preferences
    preferences: {
        theme:           { type: String, enum: ['light', 'dark'], default: 'light' },
        gameFontSize:    { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },
        voiceURI:        { type: String, default: '' },
        zoneTerminology: { type: String, enum: ['arm-glove', 'inside-away'], default: 'arm-glove' },
    }
});

// Convenience: is this user currently allowed to use the app?
UserSchema.methods.isActive = function () {
    const s = this.subscription;
    if (s.status === 'active') return true;
    if (s.status === 'trialing' && s.trialEndsAt && s.trialEndsAt > new Date()) return true;
    return false;
};

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);
