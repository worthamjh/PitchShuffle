const mongoose = require('mongoose');

const PitchLocationSchema = new mongoose.Schema({
    name:    { type: String, required: true },
    type:    { type: String, enum: ['strike', 'chase'], required: true },
    enabled: { type: Boolean, default: true }
});

const PitchTypeSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    signalCode: { type: String },
    locations:  [PitchLocationSchema]
});

const PitcherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    number: { type: Number },
    throws: { type: String, enum: ['R', 'L'] },
    zone: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StrikeZone'
    },
    pitchTypes: [PitchTypeSchema]
});

module.exports = mongoose.model('Pitcher', PitcherSchema);