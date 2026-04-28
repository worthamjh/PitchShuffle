const express = require('express');
const router = express.Router();
const Team = require('../models/team');
const { isLoggedIn } = require('../middleware');

// All teams for logged in coach
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
router.post('/', isLoggedIn, async (req, res) => {
    try {
        const team = new Team({ ...req.body.team, owner: req.user._id });
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
        res.render('teams/edit', { team });
    } catch (e) {
        console.error(e);
        res.redirect('/teams');
    }
});

// Update team
router.put('/:id', isLoggedIn, async (req, res) => {
    try {
        await Team.findByIdAndUpdate(req.params.id, { ...req.body.team });
        res.redirect(`/teams/${req.params.id}`);
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