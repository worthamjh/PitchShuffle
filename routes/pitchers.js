const express = require('express');
const router = express.Router({ mergeParams: true });
const Pitcher = require('../models/pitcher');
const Team = require('../models/team');
const StrikeZone = require('../models/strikeZone');
const { isLoggedIn } = require('../middleware');

// New pitcher form
router.get('/new', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        const zones = await StrikeZone.find({});
        res.render('pitchers/new', { team, zones });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Create pitcher
router.post('/', isLoggedIn, async (req, res) => {
    try {
        console.log('--- CREATE PITCHER ---');
        console.log('req.body.pitcher:', JSON.stringify(req.body.pitcher, null, 2));

        const team = await Team.findById(req.params.teamId);
        const zone = await StrikeZone.findById(req.body.pitcher.zone);

        console.log('zone found:', zone ? zone.name : 'NULL - zone not found!');
        if (zone) console.log('zone.availableLocations:', JSON.stringify(zone.availableLocations, null, 2));

        const pitcher = new Pitcher({ ...req.body.pitcher });

        console.log('pitcher.pitchTypes after construction:', JSON.stringify(pitcher.pitchTypes, null, 2));

        for (let pitchType of pitcher.pitchTypes) {
            pitchType.locations = zone.availableLocations.map(loc => ({
                name: loc.name,
                type: loc.type,
                enabled: true
            }));
        }

        console.log('pitcher.pitchTypes after location copy:', JSON.stringify(pitcher.pitchTypes, null, 2));

        await pitcher.save();
        team.pitchers.push(pitcher);
        await team.save();
        res.redirect(`/teams/${team._id}/pitchers/${pitcher._id}`);
    } catch (e) {
        console.error('CREATE ERROR:', e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Show pitcher
router.get('/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        const team = await Team.findById(req.params.teamId);
        console.log('--- SHOW PITCHER ---');
        console.log('pitcher.pitchTypes:', JSON.stringify(pitcher.pitchTypes, null, 2));
        res.render('pitchers/show', { pitcher, team });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Edit pitcher form
router.get('/:pitcherId/edit', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        const team = await Team.findById(req.params.teamId);
        const zones = await StrikeZone.find({});
        res.render('pitchers/edit', { pitcher, team, zones });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Update pitcher
router.put('/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId);
        pitcher.name = req.body.pitcher.name;
        pitcher.number = req.body.pitcher.number;
        pitcher.throws = req.body.pitcher.throws;
        pitcher.zone = req.body.pitcher.zone;
        pitcher.pitchTypes = req.body.pitcher.pitchTypes;
        pitcher.markModified('pitchTypes');
        await pitcher.save();
        res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}`);
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Delete pitcher
router.delete('/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const { teamId, pitcherId } = req.params;
        await Team.findByIdAndUpdate(teamId, { $pull: { pitchers: pitcherId } });
        await Pitcher.findByIdAndDelete(pitcherId);
        res.redirect(`/teams/${teamId}`);
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

module.exports = router;