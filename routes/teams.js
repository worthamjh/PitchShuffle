const express = require('express');
const router  = express.Router();
const Team    = require('../models/team');
const { isLoggedIn }          = require('../middleware');
const { upload, uploadToCloudinary } = require('../upload');

const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
const sanitizeColor = (val, fallback) => HEX_RE.test(val) ? val : fallback;

function setTeamLocals(res, team) {
    res.locals.teamColor          = team.primaryColor   || '#1a2e4a';
    res.locals.teamSecondaryColor = team.secondaryColor || '#4a7fa5';
    res.locals.teamStrikeColor    = team.strikeColor    || '#c8ecd4';
    res.locals.teamChaseColor     = team.chaseColor     || '#fef3cd';
}

// All teams
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const teams = await Team.find({ owner: req.user._id });
        res.render('teams/index', { teams });
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});

// New team form
router.get('/new', isLoggedIn, (req, res) => {
    res.render('teams/new');
});

// Create team
router.post('/', isLoggedIn, upload.single('logo'), async (req, res) => {
    try {
        const t = req.body.team;
        const team = new Team({
            name:           t.name,
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
        res.redirect(`/teams/${team._id}`);
    } catch (e) {
        console.error(e);
        res.redirect('/teams');
    }
});

// Show team
router.get('/:id', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id).populate('pitchers');
        setTeamLocals(res, team);
        res.render('teams/show', { team });
    } catch (e) {
        console.error(e);
        res.redirect('/teams');
    }
});

// Edit team form
router.get('/:id/edit', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        setTeamLocals(res, team);
        res.render('teams/edit', { team });
    } catch (e) {
        console.error(e);
        res.redirect('/teams');
    }
});

// Update team
router.put('/:id', isLoggedIn, upload.single('logo'), async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        const t    = req.body.team;
        team.name           = t.name;
        team.primaryColor   = sanitizeColor(t.primaryColor,   team.primaryColor   || '#1a2e4a');
        team.secondaryColor = sanitizeColor(t.secondaryColor, team.secondaryColor || '#4a7fa5');
        team.strikeColor    = sanitizeColor(t.strikeColor,    team.strikeColor    || '#c8ecd4');
        team.chaseColor     = sanitizeColor(t.chaseColor,     team.chaseColor     || '#fef3cd');
        if (req.file) {
            team.logo = await uploadToCloudinary(req.file.buffer, 'pitchshuffle/logos', {
                public_id:      `logo_${team._id}`,
                overwrite:      true,
                transformation: [{ width: 400, height: 400, crop: 'fill' }]
            });
        }
        await team.save();
        res.redirect(`/teams/${team._id}`);
    } catch (e) {
        console.error(e);
        res.redirect('/teams');
    }
});

// Delete team
router.delete('/:id', isLoggedIn, async (req, res) => {
    try {
        await Team.findByIdAndDelete(req.params.id);
        res.redirect('/teams');
    } catch (e) {
        console.error(e);
        res.redirect('/teams');
    }
});

module.exports = router;
