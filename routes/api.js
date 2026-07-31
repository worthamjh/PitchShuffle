const express    = require('express');
const router     = express.Router();
const Team       = require('../models/team');
const User       = require('../models/user');
const { isLoggedIn } = require('../middleware');

// ── GET /api/my-data ──────────────────────────────────────────────────────────
// Returns everything the offline game page needs: user preferences + all teams
// with fully populated pitchers and strike zones.
// Called automatically on every page load while online (see boilerplate.ejs).
// Result is written to localStorage('ps_offline_data') on the client.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-data', isLoggedIn, async (req, res, next) => {
    try {
        const user  = await User.findById(req.user._id).select('preferences');
        const teams = await Team.find({ owner: req.user._id })
            .populate({ path: 'pitchers', populate: { path: 'zone' } });

        res.json({
            preferences: user.preferences || {},
            teams: teams.map(t => ({
                _id:            t._id,
                name:           t.name,
                sport:          t.sport,
                primaryColor:   t.primaryColor,
                secondaryColor: t.secondaryColor,
                strikeColor:    t.strikeColor,
                chaseColor:     t.chaseColor,
                pitchers: (t.pitchers || []).map(p => ({
                    _id:             p._id,
                    name:            p.name,
                    number:          p.number,
                    throws:          p.throws,
                    pitchTypes:      p.pitchTypes,
                    shuffleSettings: p.shuffleSettings,
                    zone:            p.zone,
                })),
            })),
        });
    } catch (e) {
        next(e);
    }
});

module.exports = router;