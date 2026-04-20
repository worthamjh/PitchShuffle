const mongoose = require('mongoose');

const PitchTypeSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g. "Fastball", "Curveball"
    signalCode: { type: String },           // the code sent to the catcher
});

const PitcherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    number: { type: Number },               // jersey number
    throws: { type: String, enum: ['R', 'L'] },
    pitchTypes: [PitchTypeSchema]
});

module.exports = mongoose.model('Pitcher', PitcherSchema);