const express = require('express');
const router  = express.Router();
const Team    = require('../models/team');
const Pitcher = require('../models/pitcher');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../upload');
const { isLoggedIn, isOwner }         = require('../middleware');

const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
const sanitizeColor = (val, fallback) => HEX_RE.test(val) ? val : fallback;
const sanitizeSport = (val) => ['baseball', 'softball'].includes(val) ? val : 'baseball';

const TEAM_LIMIT = 5;

function setTeamLocals(res, team) {
    res.locals.teamColor          = team.primaryColor   || '#1a2e4a';
    res.locals.teamSecondaryColor = team.secondaryColor || '#4a7fa5';
    res.locals.teamStrikeColor    = team.strikeColor    || '#c8ecd4';
    res.locals.teamChaseColor     = team.chaseColor     || '#fef3cd';
}

// All teams
router.get('/', isLoggedIn, async (req, res, next) => {
    try {
        const teams = await Team.find({ owner: req.user._id });
        res.render('teams/index', { teams, teamLimit: TEAM_LIMIT });
    } catch (e) {
        next(e);
    }
});

// New team form
router.get('/new', isLoggedIn, async (req, res, next) => {
    try {
        const count = await Team.countDocuments({ owner: req.user._id });
        if (count >= TEAM_LIMIT) {
            req.flash('error', `You can have a maximum of ${TEAM_LIMIT} teams.`);
            return res.redirect('/teams');
        }
        res.render('teams/new', { onboarding: req.query.onboarding === '1' });
    } catch (e) {
        next(e);
    }
});

// Create team
router.post('/', isLoggedIn, upload.single('logo'), async (req, res, next) => {
    try {
        const t = req.body.team;
        if (!t || !t.name || !t.name.trim()) {
            req.flash('error', 'Team name is required.');
            return res.redirect('/teams/new');
        }
        const count = await Team.countDocuments({ owner: req.user._id });
        if (count >= TEAM_LIMIT) {
            req.flash('error', `You can have a maximum of ${TEAM_LIMIT} teams.`);
            return res.redirect('/teams');
        }
        const team = new Team({
            name:           t.name.trim(),
            sport:          sanitizeSport(t.sport),
            primaryColor:   sanitizeColor(t.primaryColor,   '#1a2e4a'),
            secondaryColor: sanitizeColor(t.secondaryColor, '#4a7fa5'),
            strikeColor:    sanitizeColor(t.strikeColor,    '#c8ecd4'),
            chaseColor:     sanitizeColor(t.chaseColor,     '#fef3cd'),
            owner:          req.user._id
        });
        if (req.file) {
            team.logo = await uploadToCloudinary(req.file.buffer, 'pitchshuffle/logos', {
                public_id:      `logo_${team._id}`,
                overwrite:      true,
                transformation: [{ width: 400, height: 400, crop: 'fill' }]
            });
        }
        await team.save();
        req.user.teams.push(team);
        await req.user.save();
        req.flash('success', `${team.name} created!`);
        const onboarding = req.body.onboarding === '1';
        if (onboarding) {
            return res.redirect(`/teams/${team._id}/pitchers/new?onboarding=1`);
        }
        res.redirect(`/teams/${team._id}`);
    } catch (e) {
        next(e);
    }
});

// Show team
router.get('/:id', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id).populate('pitchers');

        // Clean up any ghost pitcher refs (Mongoose silently drops nulls on populate)
        const rawTeam = await Team.findById(req.params.id).select('pitchers');
        if (rawTeam.pitchers.length !== team.pitchers.length) {
            const validIds = team.pitchers.map(p => p._id);
            await Team.findByIdAndUpdate(req.params.id, { pitchers: validIds });
        }

        setTeamLocals(res, team);
        res.render('teams/show', { team });
    } catch (e) {
        next(e);
    }
});

// Edit team form
router.get('/:id/edit', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id);
        setTeamLocals(res, team);
        res.render('teams/edit', { team });
    } catch (e) {
        next(e);
    }
});

// Update team
router.put('/:id', isLoggedIn, isOwner, upload.single('logo'), async (req, res, next) => {
    try {
        const t    = req.body.team;
        const team = await Team.findById(req.params.id);
        team.name           = t.name?.trim() || team.name;
        team.sport          = sanitizeSport(t.sport);
        team.primaryColor   = sanitizeColor(t.primaryColor,   team.primaryColor);
        team.secondaryColor = sanitizeColor(t.secondaryColor, team.secondaryColor);
        team.strikeColor    = sanitizeColor(t.strikeColor,    team.strikeColor);
        team.chaseColor     = sanitizeColor(t.chaseColor,     team.chaseColor);

        if (t.removeLogo === 'true' && team.logo) {
            await deleteFromCloudinary(team.logo);
            team.logo = '';
        } else if (req.file) {
            team.logo = await uploadToCloudinary(req.file.buffer, 'pitchshuffle/logos', {
                public_id:      `logo_${team._id}`,
                overwrite:      true,
                transformation: [{ width: 400, height: 400, crop: 'fill' }]
            });
        }

        await team.save();
        req.flash('success', 'Team updated.');
        res.redirect(`/teams/${team._id}`);
    } catch (e) {
        next(e);
    }
});

// Bulk set strike % for all pitchers on a team
router.post('/:teamId/shuffle-strike', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        const pct  = parseInt(req.body.strikeChancePct);
        const safe = (!isNaN(pct) && pct >= 0 && pct <= 100) ? pct : 70;
        for (const pitcher of team.pitchers) {
            pitcher.shuffleSettings = pitcher.shuffleSettings || {};
            pitcher.shuffleSettings.strikeChancePct = safe;
            pitcher.markModified('shuffleSettings');
            await pitcher.save();
        }
        req.flash('success', `Strike % set to ${safe}% for all ${team.pitchers.length} pitchers.`);
        res.redirect(`/teams/${team._id}/edit`);
    } catch (e) {
        next(e);
    }
});

// Reset pitch weights to equal for all pitchers on a team
router.post('/:teamId/shuffle-reset', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        for (const pitcher of team.pitchers) {
            pitcher.shuffleSettings = pitcher.shuffleSettings || {};
            pitcher.shuffleSettings.pitchWeights = new Map();
            pitcher.markModified('shuffleSettings');
            await pitcher.save();
        }
        req.flash('success', `Pitch weights reset to equal for all ${team.pitchers.length} pitchers.`);
        res.redirect(`/teams/${team._id}/edit`);
    } catch (e) {
        next(e);
    }
});

// Delete team
router.delete('/:id', isLoggedIn, isOwner, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id).populate('pitchers');
        if (!team) return res.redirect('/teams');

        for (const pitcher of team.pitchers) {
            if (pitcher.photo) await deleteFromCloudinary(pitcher.photo);
        }
        await Pitcher.deleteMany({ _id: { $in: team.pitchers.map(p => p._id) } });

        if (team.logo) await deleteFromCloudinary(team.logo);

        await Team.findByIdAndDelete(req.params.id);
        await req.user.updateOne({ $pull: { teams: req.params.id } });
        req.flash('success', 'Team deleted.');
        res.redirect('/teams');
    } catch (e) {
        next(e);
    }
});

module.exports = router;
