const express = require('express');
const router = express.Router({ mergeParams: true });
const Pitcher = require('../models/pitcher');
const Team = require('../models/team');
const StrikeZone = require('../models/strikeZone');
const { isLoggedIn } = require('../middleware');

function setTeamLocals(res, team) {
    res.locals.teamColor          = team.primaryColor   || '#1a2e4a';
    res.locals.teamSecondaryColor = team.secondaryColor || '#4a7fa5';
    res.locals.teamStrikeColor    = team.strikeColor    || '#c8ecd4';
    res.locals.teamChaseColor     = team.chaseColor     || '#fef3cd';
}

// ── Game routes ───────────────────────────────────────────────

router.get('/game', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        setTeamLocals(res, team);
        const currentPitcherId = req.query.from || null;
        res.render('pitchers/game-select', { team, currentPitcherId });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

router.get('/game/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const team    = await Team.findById(req.params.teamId);
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        if (!pitcher) return res.redirect(`/teams/${req.params.teamId}/pitchers/game`);
        setTeamLocals(res, team);
        res.render('pitchers/game', { team, pitcher });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

// ── Standard pitcher CRUD ─────────────────────────────────────

router.get('/new', isLoggedIn, async (req, res) => {
    try {
        const team     = await Team.findById(req.params.teamId);
        const zones    = await StrikeZone.find({});
        const redirect = req.query.redirect || null;
        setTeamLocals(res, team);
        res.render('pitchers/new', { team, zones, redirect });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

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

router.get('/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        const team    = await Team.findById(req.params.teamId);
        setTeamLocals(res, team);
        res.render('pitchers/show', { pitcher, team });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

router.get('/:pitcherId/edit', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        const team    = await Team.findById(req.params.teamId);
        const zones   = await StrikeZone.find({});
        setTeamLocals(res, team);
        res.render('pitchers/edit', { pitcher, team, zones });
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

router.put('/:pitcherId', isLoggedIn, async (req, res) => {
    try {
        const pitcher   = await Pitcher.findById(req.params.pitcherId);
        const newZoneId = req.body.pitcher.zone;
        const zoneChanged = pitcher.zone?.toString() !== newZoneId?.toString();
        if (zoneChanged && newZoneId && !pitcher.previousZone) {
            pitcher.previousZone       = pitcher.zone;
            pitcher.previousPitchTypes = JSON.parse(JSON.stringify(pitcher.pitchTypes));
        }
        pitcher.name       = req.body.pitcher.name;
        pitcher.number     = req.body.pitcher.number;
        pitcher.throws     = req.body.pitcher.throws;
        pitcher.zone       = newZoneId;
        pitcher.pitchTypes = req.body.pitcher.pitchTypes || pitcher.pitchTypes;
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

router.post('/:pitcherId/change-zone', isLoggedIn, async (req, res) => {
    try {
        const pitcher   = await Pitcher.findById(req.params.pitcherId);
        const newZoneId = req.body.zoneId;
        if (!newZoneId || pitcher.zone?.toString() === newZoneId) {
            return res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
        }
        const newZone = await StrikeZone.findById(newZoneId);
        if (!newZone) return res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
        if (!pitcher.previousZone) {
            pitcher.previousZone       = pitcher.zone;
            pitcher.previousPitchTypes = JSON.parse(JSON.stringify(pitcher.pitchTypes));
        }
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

router.post('/:pitcherId/revert-zone', isLoggedIn, async (req, res) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId);
        if (pitcher.previousZone) {
            pitcher.zone       = pitcher.previousZone;
            pitcher.pitchTypes = pitcher.previousPitchTypes;
            pitcher.previousZone       = null;
            pitcher.previousPitchTypes = null;
            pitcher.markModified('pitchTypes');
            pitcher.markModified('previousPitchTypes');
            await pitcher.save();
        }
        res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
    } catch (e) {
        console.error(e);
        res.redirect(`/teams/${req.params.teamId}`);
    }
});

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
