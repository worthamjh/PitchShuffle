const express = require('express');
const router  = express.Router();
const User    = require('../models/user');
const Team    = require('../models/team');
const { isLoggedIn } = require('../middleware');

// Show profile
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const teams = await Team.find({ owner: req.user._id });
        res.render('profile/show', { user: req.user, teams });
    } catch (e) {
        console.error(e);
        res.redirect('/teams');
    }
});

// Update email
router.post('/', isLoggedIn, async (req, res) => {
    try {
        const { email } = req.body;
        await User.findByIdAndUpdate(req.user._id, { email });
        req.flash('success', 'Email updated successfully.');
        res.redirect('/profile');
    } catch (e) {
        console.error(e);
        req.flash('error', 'Could not update email.');
        res.redirect('/profile');
    }
});

// Change password
router.post('/password', isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        // passport-local-mongoose's changePassword handles verification + hashing
        await req.user.changePassword(currentPassword, newPassword);
        await req.user.save();
        req.flash('success', 'Password updated successfully.');
        res.redirect('/profile');
    } catch (e) {
        console.error(e);
        req.flash('error', 'Current password is incorrect.');
        res.redirect('/profile');
    }
});

module.exports = router;
