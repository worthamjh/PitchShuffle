const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const Team = require('../models/team');
const Pitcher = require('../models/pitcher');
const { isLoggedIn } = require('../middleware');

// ── Home ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.render('home');
    }
    res.redirect('/login');
});

// ── Quick Game ────────────────────────────────────────────────
// No setup required — renders the game screen with default pitcher data.
// Nothing is saved to the database.
router.get('/quick-game', isLoggedIn, (req, res) => {
    const quickPitcher = {
        number: 1,
        name:   'Pitcher',
        throws: 'R',
        pitchTypes: [
            { name: 'Fastball',  abbreviation: 'FB'  },
            { name: 'Curveball', abbreviation: 'CB'  },
            { name: 'Changeup',  abbreviation: 'CH'  },
            { name: 'Slider',    abbreviation: 'SL'  },
        ],
        // Zone C locations — all enabled by default
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

// Step 1 — select team
router.get('/game', isLoggedIn, async (req, res) => {
    try {
        const teams = await Team.find({ owner: req.user._id }).populate('pitchers');
        res.render('game/select-team', { teams });
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});

// Step 2 — select pitcher from chosen team
router.get('/game/:teamId', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        if (!team) return res.redirect('/game');
        res.render('game/select-pitcher', { team });
    } catch (e) {
        console.error(e);
        res.redirect('/game');
    }
});

// ── Auth ──────────────────────────────────────────────────────

// Register form
router.get('/register', (req, res) => {
    res.render('auth/register');
});

// Register logic
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect('/');
        });
    } catch (e) {
        res.redirect('/register');
    }
});

// Login form
router.get('/login', (req, res) => {
    res.render('auth/login');
});

// Login logic
router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    keepSessionInfo: true
}), (req, res) => {
    res.redirect('/');
});

// Logout
router.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) return next(err);
        res.redirect('/login');
    });
});

module.exports = router;
