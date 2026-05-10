const express = require('express');
const router = express.Router({ mergeParams: true });
const Pitcher = require('../models/pitcher');
const Team = require('../models/team');
const StrikeZone = require('../models/strikeZone');
const { isLoggedIn } = require('../middleware');

// ── Game routes ───────────────────────────────────────────────
// These must come BEFORE /:pitcherId to avoid route conflicts

// Pitcher selection screen (change pitcher)
router.get('/game', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        const currentPitcherId = req.query.from || null;
        res.render('pitchers/game-select', { team, currentPitcherId });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Game screen for a specific pitcher
router.get('/game/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const team    = await Team.findById(req.params.teamId);
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        if (!pitcher) return res.redirect(`/teams/${req.params.teamId}/pitchers/game`);
        res.render('pitchers/game', { team, pitcher });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// ── Standard pitcher CRUD ─────────────────────────────────────

// New pitcher form
router.get('/new', isLoggedIn, async (req, res) => {
    try {
        const team     = await Team.findById(req.params.teamId);
        const zones    = await StrikeZone.find({});
        const redirect = req.query.redirect || null;
        res.render('pitchers/new', { team, zones, redirect });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Create pitcher
router.post('/', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        const zone = await StrikeZone.findById(req.body.pitcher.zone);

        const pitcher = new Pitcher({ ...req.body.pitcher });

        for (let pitchType of pitcher.pitchTypes) {
            pitchType.locations = zone.availableLocations.map(loc => ({
                name:    loc.name,
                type:    loc.type,
                enabled: true
            }));
        }

        await pitcher.save();
        team.pitchers.push(pitcher);
        await team.save();
        const redirect = req.body.redirect;
        res.redirect(redirect || `/teams/${team._id}/pitchers/${pitcher._id}`);
    } catch (e) {
        console.error('CREATE ERROR:', e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// Show pitcher
router.get('/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        const team    = await Team.findById(req.params.teamId);
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
        const team    = await Team.findById(req.params.teamId);
        const zones   = await StrikeZone.find({});
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
        const newZoneId = req.body.pitcher.zone;

        // Detect if the zone has changed
        const zoneChanged = pitcher.zone?.toString() !== newZoneId?.toString();

        pitcher.name       = req.body.pitcher.name;
        pitcher.number     = req.body.pitcher.number;
        pitcher.throws     = req.body.pitcher.throws;
        pitcher.zone       = newZoneId;
        pitcher.pitchTypes = req.body.pitcher.pitchTypes || pitcher.pitchTypes;

        // If the zone changed, rebuild all pitch type locations from the new zone
        if (zoneChanged && newZoneId) {
            const newZone = await StrikeZone.findById(newZoneId);
            if (newZone) {
                for (let pitchType of pitcher.pitchTypes) {
                    pitchType.locations = newZone.availableLocations.map(loc => ({
                        name:    loc.name,
                        type:    loc.type,
                        enabled: true
                    }));
                }
            }
        }

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