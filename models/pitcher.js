const mongoose = require('mongoose');

const PitchLocationSchema = new mongoose.Schema({
    name:    { type: String, required: true },
    type:    { type: String, enum: ['strike', 'chase'], required: true },
    enabled: { type: Boolean, default: true }
});

const PitchTypeSchema = new mongoose.Schema({
    name:         { type: String, required: true },
    abbreviation: { type: String },
    signalCode:   { type: String },
    locations:    [PitchLocationSchema]
});

const PitcherSchema = new mongoose.Schema({
    name:   { type: String, required: true },
    number: { type: Number },
    throws: { type: String, enum: ['R', 'L'] },
    zone: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StrikeZone'
    },
    pitchTypes: [PitchTypeSchema],

    // Snapshot of previous zone state — used for revert after zone change
    previousZone:       { type: mongoose.Schema.Types.ObjectId, ref: 'StrikeZone', default: null },
    previousPitchTypes: { type: mongoose.Schema.Types.Mixed, default: null }
});

module.exports = mongoose.model('Pitcher', PitcherSchema);
