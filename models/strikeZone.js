const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['strike', 'chase'],
        required: true 
    }
});

const StrikeZoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    availableLocations: [LocationSchema]
});

module.exports = mongoose.model('StrikeZone', StrikeZoneSchema);