const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true },
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
    primaryColor:   { type: String, default: '#1a2e4a' }, // navbar, headers, buttons
    secondaryColor: { type: String, default: '#4a7fa5' }, // pitcher badge circles
    strikeColor:    { type: String, default: '#c8ecd4' }, // strike zone cells
    chaseColor:     { type: String, default: '#fef3cd' }, // chase zone cells
});

module.exports = mongoose.model('Team', TeamSchema);
