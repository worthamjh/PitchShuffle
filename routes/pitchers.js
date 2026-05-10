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

// Update pitcher (full save from edit form)
router.put('/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const pitcher   = await Pitcher.findById(req.params.pitcherId);
        const newZoneId = req.body.pitcher.zone;
        const zoneChanged = pitcher.zone?.toString() !== newZoneId?.toString();

        // If zone changed and no snapshot exists yet, take one
        if (zoneChanged && newZoneId && !pitcher.previousZone) {
            pitcher.previousZone       = pitcher.zone;
            pitcher.previousPitchTypes = JSON.parse(JSON.stringify(pitcher.pitchTypes));
        }

        pitcher.name       = req.body.pitcher.name;
        pitcher.number     = req.body.pitcher.number;
        pitcher.throws     = req.body.pitcher.throws;
        pitcher.zone       = newZoneId;
        pitcher.pitchTypes = req.body.pitcher.pitchTypes || pitcher.pitchTypes;

        // Rebuild locations if zone changed
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

        // Clear snapshot on full save — revert no longer makes sense after committing
        pitcher.previousZone       = null;
        pitcher.previousPitchTypes = null;

        pitcher.markModified('pitchTypes');
        pitcher.markModified('previousPitchTypes');
        await pitcher.save();
        res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// ── Zone change auto-save (triggered by zone image click in edit) ──
// Saves just the zone change + rebuilds locations, snapshots original state once.
router.post('/:pitcherId/change-zone', isLoggedIn, async (req, res) => {
    try {
        const pitcher   = await Pitcher.findById(req.params.pitcherId);
        const newZoneId = req.body.zoneId;

        if (!newZoneId || pitcher.zone?.toString() === newZoneId) {
            return res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
        }

        const newZone = await StrikeZone.findById(newZoneId);
        if (!newZone) return res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);

        // Only snapshot if one doesn't already exist — this preserves the
        // original zone/locations across multiple zone changes, so revert
        // always takes the coach back to where they started, not just one step back.
        if (!pitcher.previousZone) {
            pitcher.previousZone       = pitcher.zone;
            pitcher.previousPitchTypes = JSON.parse(JSON.stringify(pitcher.pitchTypes));
        }

        // Apply new zone and rebuild all locations
        pitcher.zone = newZoneId;
        for (let pitchType of pitcher.pitchTypes) {
            pitchType.locations = newZone.availableLocations.map(loc => ({
                name:    loc.name,
                type:    loc.type,
                enabled: true
            }));
        }

        pitcher.markModified('pitchTypes');
        pitcher.markModified('previousPitchTypes');
        await pitcher.save();
        res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// ── Revert zone to previous snapshot ─────────────────────────
router.post('/:pitcherId/revert-zone', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId);

        if (!pitcher.previousZone || !pitcher.previousPitchTypes) {
            return res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
        }

        // Restore previous state
        pitcher.zone       = pitcher.previousZone;
        pitcher.pitchTypes = pitcher.previousPitchTypes;

        // Clear the snapshot so revert can't be clicked twice
        pitcher.previousZone       = null;
        pitcher.previousPitchTypes = null;

        pitcher.markModified('pitchTypes');
        pitcher.markModified('previousPitchTypes');
        await pitcher.save();
        res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
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
