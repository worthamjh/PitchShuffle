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
    }]
});

module.exports = mongoose.model('Team', TeamSchema);