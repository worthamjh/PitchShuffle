const express = require('express');
const router = express.Router({ mergeParams: true });
const Pitcher = require('../models/pitcher');
const Team = require('../models/team');
const StrikeZone = require('../models/strikeZone');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../upload');
const { isLoggedIn, isOwner, isPitcherInTeam } = require('../middleware');

const MAX_PITCH_TYPES = 8;
const MAX_PITCHERS = 20;

function setTeamLocals(res, team) {
    res.locals.teamColor          = team.primaryColor   || '#1a2e4a';
    res.locals.teamSecondaryColor = team.secondaryColor || '#4a7fa5';
    res.locals.teamStrikeColor    = team.strikeColor    || '#c8ecd4';
    res.locals.teamChaseColor     = team.chaseColor     || '#fef3cd';
}

// ── Game routes ───────────────────────────────────────────────

router.get('/game', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        setTeamLocals(res, team);
        const currentPitcherId = req.query.from || null;
        res.render('pitchers/game-select', { team, currentPitcherId });
    } catch (e) {
        next(e);
    }
});

router.get('/game/:pitcherId', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
    try {
        const team    = await Team.findById(req.params.teamId);
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        if (!pitcher) {
            req.flash('error', 'Pitcher not found.');
            return res.redirect(`/teams/${req.params.teamId}/pitchers/game`);
        }
        setTeamLocals(res, team);
        res.render('pitchers/game', { team, pitcher });
    } catch (e) {
        next(e);
    }
});
// ── AJAX: save shuffle settings in-game ──────────────────────
router.post('/:pitcherId/shuffle-settings', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId);
        const { strikeChancePct, pitchWeights } = req.body;
        pitcher.shuffleSettings = pitcher.shuffleSettings || {};
        if (strikeChancePct != null) {
            pitcher.shuffleSettings.strikeChancePct = parseInt(strikeChancePct);
        }
        if (pitchWeights && typeof pitchWeights === 'object') {
            const weights = new Map();
            for (const [name, val] of Object.entries(pitchWeights)) {
                weights.set(name, parseInt(val));
            }
            pitcher.shuffleSettings.pitchWeights = weights;
        }
        pitcher.markModified('shuffleSettings');
        await pitcher.save();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ── Standard pitcher CRUD ─────────────────────────────────────

router.get('/new', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team     = await Team.findById(req.params.teamId);
        const zones    = await StrikeZone.find({});
        const redirect = req.query.redirect || null;
        setTeamLocals(res, team);
        res.render('pitchers/new', { team, zones, redirect, user: req.user });
    } catch (e) {
        next(e);
    }
});

router.post('/', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.teamId);
        if (team.pitchers.length >= MAX_PITCHERS) {
            req.flash('error', `A team can have a maximum of ${MAX_PITCHERS} pitchers.`);
            return res.redirect(`/teams/${req.params.teamId}/pitchers/new`);
        }
        const zone = await StrikeZone.findById(req.body.pitcher.zone);
        if (!zone) {
            req.flash('error', 'Please select a valid strike zone.');
            return res.redirect(`/teams/${req.params.teamId}/pitchers/new`);
        }
        const pitchTypes = req.body.pitcher.pitchTypes || [];
        if (pitchTypes.length > MAX_PITCH_TYPES) {
            req.flash('error', `A pitcher can have a maximum of ${MAX_PITCH_TYPES} pitch types.`);
            return res.redirect(`/teams/${req.params.teamId}/pitchers/new`);
        }
        const pitcherBody = req.body.pitcher;
        // Build name from parts for legacy compatibility
        pitcherBody.name = [pitcherBody.firstName, pitcherBody.lastName].filter(Boolean).join(' ');
        const pitcher = new Pitcher(pitcherBody);
        pitcher.pitchTypes = (pitcher.pitchTypes || []).filter(pt => pt.name && pt.name.trim());
        for (let i = 0; i < pitcher.pitchTypes.length; i++) {
            const submittedLocs = pitchTypes[i]?.locations || [];
            pitcher.pitchTypes[i].locations = zone.availableLocations.map((loc, j) => {
                const submitted = submittedLocs[j];
                const enabled = submitted ? submitted.enabled !== 'false' && submitted.enabled !== false : true;
                return { name: loc.name, type: loc.type, enabled };
            });
        }
        await pitcher.save();
        team.pitchers.push(pitcher);
        await team.save();
        req.flash('success', `${pitcher.name} added.`);
        const redirect = req.body.redirect;
        res.redirect(redirect || `/teams/${team._id}/pitchers/${pitcher._id}`);
    } catch (e) {
        next(e);
    }
});

router.get('/:pitcherId', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        const team    = await Team.findById(req.params.teamId);
        if (!pitcher) {
            req.flash('error', 'Pitcher not found.');
            return res.redirect(`/teams/${req.params.teamId}`);
        }
        setTeamLocals(res, team);
        res.render('pitchers/show', { pitcher, team, user: req.user });
    } catch (e) {
        next(e);
    }
});

router.get('/:pitcherId/edit', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
    try {
        const pitcher = await Pitcher.findById(req.params.pitcherId).populate('zone');
        const team    = await Team.findById(req.params.teamId);
        const zones   = await StrikeZone.find({});
        if (!pitcher) {
            req.flash('error', 'Pitcher not found.');
            return res.redirect(`/teams/${req.params.teamId}`);
        }
        setTeamLocals(res, team);
        res.render('pitchers/edit', { pitcher, team, zones, user: req.user });
    } catch (e) {
        next(e);
    }
});

router.put('/:pitcherId', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
    try {
        const pitchTypes = req.body.pitcher.pitchTypes || [];
        if (pitchTypes.length > MAX_PITCH_TYPES) {
            req.flash('error', `A pitcher can have a maximum of ${MAX_PITCH_TYPES} pitch types.`);
            return res.redirect(`/teams/${req.params.teamId}/pitchers/${req.params.pitcherId}/edit`);
        }
        const pitcher   = await Pitcher.findById(req.params.pitcherId);
        const newZoneId = req.body.pitcher.zone;
        const zoneChanged = pitcher.zone?.toString() !== newZoneId?.toString();
        if (zoneChanged && newZoneId && !pitcher.previousZone) {
            pitcher.previousZone       = pitcher.zone;
            pitcher.previousPitchTypes = JSON.parse(JSON.stringify(pitcher.pitchTypes));
        }
        pitcher.firstName  = req.body.pitcher.firstName || '';
        pitcher.lastName   = req.body.pitcher.lastName;
        pitcher.name       = [pitcher.firstName, pitcher.lastName].filter(Boolean).join(' ');
        pitcher.number     = req.body.pitcher.number;
        pitcher.throws     = req.body.pitcher.throws;
        pitcher.zone       = newZoneId;
        pitcher.pitchTypes = pitchTypes.filter(pt => pt.name && pt.name.trim());

        // Populate locations for any pitch types that have none
        const currentZone = await StrikeZone.findById(newZoneId || pitcher.zone);
        if (currentZone) {
            for (let pitchType of pitcher.pitchTypes) {
                if (!pitchType.locations || pitchType.locations.length === 0) {
                    pitchType.locations = currentZone.availableLocations.map(loc => ({
                        name:    loc.name,
                        type:    loc.type,
                        enabled: true
                    }));
                }
            }
        }

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

        // Save shuffle settings
        const ss = req.body.shuffleSettings;
        if (ss) {
            pitcher.shuffleSettings = pitcher.shuffleSettings || {};
            pitcher.shuffleSettings.strikeChancePct = ss.strikeChancePct != null ? parseInt(ss.strikeChancePct) : null;
            if (ss.pitchWeights) {
                const weights = new Map();
                for (const [name, val] of Object.entries(ss.pitchWeights)) {
                    weights.set(name, parseInt(val));
                }
                pitcher.shuffleSettings.pitchWeights = weights;
            }
            pitcher.markModified('shuffleSettings');
        }

        pitcher.markModified('pitchTypes');
        pitcher.markModified('previousPitchTypes');
        await pitcher.save();
        req.flash('success', 'Pitcher updated.');
        res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
    } catch (e) {
        next(e);
    }
});

router.post('/:pitcherId/change-zone', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
    try {
        const pitcher   = await Pitcher.findById(req.params.pitcherId);
        const newZoneId = req.body.zoneId;
        if (!newZoneId || pitcher.zone?.toString() === newZoneId) {
            return res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
        }
        const newZone = await StrikeZone.findById(newZoneId);
        if (!newZone) {
            req.flash('error', 'Zone not found.');
            return res.redirect(`/teams/${req.params.teamId}/pitchers/${pitcher._id}/edit`);
        }
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
        next(e);
    }
});

router.post('/:pitcherId/revert-zone', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
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
        next(e);
    }
});

router.delete('/:pitcherId', isLoggedIn, isOwner, isPitcherInTeam, async (req, res, next) => {
    try {
        const { teamId, pitcherId } = req.params;
        const pitcher = await Pitcher.findById(pitcherId);
        if (pitcher?.photo) await deleteFromCloudinary(pitcher.photo);
        await Team.findByIdAndUpdate(teamId, { $pull: { pitchers: pitcherId } });
        await Pitcher.findByIdAndDelete(pitcherId);
        req.flash('success', 'Pitcher removed.');
        res.redirect(`/teams/${teamId}`);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
