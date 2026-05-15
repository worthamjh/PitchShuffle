const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const Team = require('../models/team');
const Pitcher = require('../models/pitcher');
const { isLoggedIn } = require('../middleware');

function setTeamLocals(res, team) {
    res.locals.teamColor          = team.primaryColor   || '#1a2e4a';
    res.locals.teamSecondaryColor = team.secondaryColor || '#4a7fa5';
    res.locals.teamStrikeColor    = team.strikeColor    || '#c8ecd4';
    res.locals.teamChaseColor     = team.chaseColor     || '#fef3cd';
}

// ── Home ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.render('home');
    res.redirect('/login');
});

// ── Quick Game ────────────────────────────────────────────────
router.get('/quick-game', isLoggedIn, (req, res) => {
    const quickPitcher = {
        number: 1,
        name:   'Pitcher',
        throws: 'R',
        pitchTypes: [
            { name: 'Fastball',  abbreviation: 'FB' },
            { name: 'Curveball', abbreviation: 'CB' },
            { name: 'Changeup',  abbreviation: 'CH' },
            { name: 'Slider',    abbreviation: 'SL' },
        ],
        zone: {
            availableLocations: [
                { name: 'glove-up',       type: 'strike', enabled: true },
                { name: 'mid-up',         type: 'strike', enabled: true },
                { name: 'arm-up',         type: 'strike', enabled: true },
                { name: 'glove-mid',      type: 'strike', enabled: true },
                { name: 'mid-mid',        type: 'strike', enabled: true },
                { name: 'arm-mid',        type: 'strike', enabled: true },
                { name: 'glove-down',     type: 'strike', enabled: true },
                { name: 'mid-down',       type: 'strike', enabled: true },
                { name: 'arm-down',       type: 'strike', enabled: true },
                { name: 'glove-out-up',   type: 'chase',  enabled: true },
                { name: 'up-out',         type: 'chase',  enabled: true },
                { name: 'arm-out-up',     type: 'chase',  enabled: true },
                { name: 'glove-out-mid',  type: 'chase',  enabled: true },
                { name: 'arm-out-mid',    type: 'chase',  enabled: true },
                { name: 'glove-out-down', type: 'chase',  enabled: true },
                { name: 'down-out',       type: 'chase',  enabled: true },
                { name: 'arm-out-down',   type: 'chase',  enabled: true },
            ]
        }
    };
    res.render('pitchers/quick-game', { pitcher: quickPitcher });
});

// ── Game flow ─────────────────────────────────────────────────

router.get('/game', isLoggedIn, async (req, res) => {
    try {
        const teams = await Team.find({ owner: req.user._id }).populate('pitchers');
        res.render('game/select-team', { teams });
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});

router.get('/game/:teamId', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        if (!team) return res.redirect('/game');
        setTeamLocals(res, team);
        res.render('game/select-pitcher', { team });
    } catch (e) {
        console.error(e);
        res.redirect('/game');
    }
});

// ── Auth ──────────────────────────────────────────────────────

router.get('/register', (req, res) => res.render('auth/register'));

router.post('/register', async (req, res) => {
    try {
        const { email, username, password, zoneTerminology } = req.body;
        const safeTerminology = ['arm-glove', 'inside-away'].includes(zoneTerminology)
            ? zoneTerminology
            : 'arm-glove';
        const user = new User({
            email,
            username,
            preferences: {
                zoneTerminology: safeTerminology,
            }
        });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect('/');
        });
    } catch (e) {
        res.redirect('/register');
    }
});

router.get('/login', (req, res) => res.render('auth/login'));

router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    keepSessionInfo: true
}), (req, res) => res.redirect('/'));

router.post('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) return next(err);
        res.redirect('/login');
    });
});

module.exports = router;
