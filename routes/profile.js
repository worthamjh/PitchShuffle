const express  = require('express');
const router   = express.Router();
const User     = require('../models/user');
const Team     = require('../models/team');
const Pitcher  = require('../models/pitcher');
const StrikeZone = require('../models/strikeZone');
const { isLoggedIn }          = require('../middleware');
const { upload, uploadToCloudinary } = require('../upload');

// Show profile
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const teams = await Team.find({ owner: req.user._id }).populate({
            path: 'pitchers',
            populate: { path: 'zone' }
        });
        const currentTerm = req.user.preferences?.zoneTerminology || 'arm-glove';
        let pitcherMismatchCount = 0;
        const mismatchedPitchers = [];
        for (const team of teams) {
            for (const pitcher of team.pitchers) {
                if (pitcher.zone && pitcher.zone.terminology !== 'both' && pitcher.zone.terminology !== currentTerm) {
                    pitcherMismatchCount++;
                    mismatchedPitchers.push({ name: pitcher.name, number: pitcher.number, team: team.name });
                }
            }
        }
        res.render('profile/show', { user: req.user, teams, pitcherMismatchCount, mismatchedPitchers });
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

// Upload / update avatar
router.post('/avatar', isLoggedIn, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error', 'Please select an image to upload.');
            return res.redirect('/profile');
        }
        const url = await uploadToCloudinary(req.file.buffer, 'pitchshuffle/avatars', {
            public_id:      `avatar_${req.user._id}`,
            overwrite:      true,
            transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }]
        });
        await User.findByIdAndUpdate(req.user._id, { avatar: url });
        req.flash('success', 'Profile picture updated.');
        res.redirect('/profile');
    } catch (e) {
        console.error(e);
        req.flash('error', 'Image upload failed. Please try again.');
        res.redirect('/profile');
    }
});

// Save visual preferences
router.post('/preferences', isLoggedIn, async (req, res) => {
    try {
        const { theme, gameFontSize, voiceURI, zoneTerminology } = req.body;
        const safeTheme       = ['light', 'dark'].includes(theme)              ? theme            : 'light';
        const safeFontSize    = ['sm', 'md', 'lg'].includes(gameFontSize)      ? gameFontSize      : 'md';
        const safeTerminology = ['arm-glove', 'inside-away'].includes(zoneTerminology)
            ? zoneTerminology
            : 'arm-glove';

        const currentTerminology = req.user.preferences?.zoneTerminology || 'arm-glove';
        const terminologyChanged = safeTerminology !== currentTerminology;

        if (terminologyChanged) {
            // Count pitchers that use zones from the OLD terminology
            // so we can warn the user they won't be affected
            const teams = await Team.find({ owner: req.user._id }).populate({
                path: 'pitchers',
                populate: { path: 'zone' }
            });
            let mismatchCount = 0;
            for (const team of teams) {
                for (const pitcher of team.pitchers) {
                    if (pitcher.zone && pitcher.zone.terminology === currentTerminology) {
                        mismatchCount++;
                    }
                }
            }
            if (mismatchCount > 0) {
                const oldLabel = currentTerminology === 'arm-glove' ? 'Arm/Glove' : 'Inside/Away';
                const newLabel = safeTerminology    === 'arm-glove' ? 'Arm/Glove' : 'Inside/Away';
                req.flash('warning',
                    `${mismatchCount} of your pitcher${mismatchCount !== 1 ? 's' : ''} still use${mismatchCount === 1 ? 's' : ''} ${oldLabel} zones. `
                    + `To update them, go to each pitcher's edit page and re-select their strike zone. `
                    + `Only new pitchers will automatically use ${newLabel} terminology.`
                );
            }
        }

        await User.findByIdAndUpdate(req.user._id, {
            preferences: {
                theme:           safeTheme,
                gameFontSize:    safeFontSize,
                voiceURI:        voiceURI || '',
                zoneTerminology: safeTerminology,
            }
        });
        req.flash('success', 'Preferences saved.');
        res.redirect('/profile');
    } catch (e) {
        console.error(e);
        req.flash('error', 'Could not save preferences.');
        res.redirect('/profile');
    }
});

module.exports = router;
