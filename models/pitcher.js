const mongoose = require('mongoose');

const PitchLocationSchema = new mongoose.Schema({
    name:    { type: String, required: true },
    type:    { type: String, enum: ['strike', 'chase'], required: true },
    enabled: { type: Boolean, default: true }
});

const PitchTypeSchema = new mongoose.Schema({
    name:         { type: String, required: true },
    abbreviation: { type: String },
    locations:    [PitchLocationSchema]
});

const PitcherSchema = new mongoose.Schema({
    // Split name fields — firstName may be empty for single-name pitchers
    firstName: { type: String, default: '' },
    lastName:  { type: String, required: true },

    // Legacy field — kept for backward compatibility during transition
    name:   { type: String },

    number: { type: Number },
    throws: { type: String, enum: ['R', 'L'] },
    zone: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StrikeZone'
    },
    pitchTypes: [PitchTypeSchema],

    // Profile photo (Cloudinary URL)
    photo: { type: String, default: '' },

    // Snapshot of previous zone state — used for revert after zone change
    previousZone:       { type: mongoose.Schema.Types.ObjectId, ref: 'StrikeZone', default: null },
    previousPitchTypes: { type: mongoose.Schema.Types.Mixed, default: null }
});

// Virtual: full display name
PitcherSchema.virtual('fullName').get(function () {
    if (this.firstName) return `${this.firstName} ${this.lastName}`;
    return this.lastName || this.name || '';
});

module.exports = mongoose.model('Pitcher', PitcherSchema);
