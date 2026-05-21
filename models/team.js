const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sport: {
        type: String,
        enum: ['baseball', 'softball'],
        default: 'baseball'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pitchers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pitcher'
    }],

    // Team logo (Cloudinary URL)
    logo: { type: String, default: '' },

    // Team colors
    primaryColor:   { type: String, default: '#1a2e4a' },
    secondaryColor: { type: String, default: '#4a7fa5' },
    strikeColor:    { type: String, default: '#c8ecd4' },
    chaseColor:     { type: String, default: '#fef3cd' },
});

module.exports = mongoose.model('Team', TeamSchema);
