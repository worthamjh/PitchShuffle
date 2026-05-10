const mongoose = require('mongoose');
const Pitcher = require('../models/pitcher');

const ABBR_MAP = {
    'Fastball':            'FB',
    'Two-Seam Fastball':   '2FB',
    'Cutter':              'CUT',
    'Sinker':              'SIN',
    'Curveball':           'CB',
    'Slider':              'SL',
    'Sweeper':             'SWP',
    'Slurve':              'SLV',
    'Changeup':            'CH',
    'Splitter':            'SPL',
    'Screwball':           'SCR',
    'Knuckleball':         'KN',
};

mongoose.connect('mongodb://localhost:27017/pitchShuffle')
    .then(async () => {
        const pitchers = await Pitcher.find({});
        let updated = 0;

        for (const pitcher of pitchers) {
            let changed = false;
            for (const pt of pitcher.pitchTypes) {
                if (!pt.abbreviation && ABBR_MAP[pt.name]) {
                    pt.abbreviation = ABBR_MAP[pt.name];
                    changed = true;
                }
            }
            if (changed) {
                await pitcher.save();
                updated++;
            }
        }

        console.log(`Done — updated ${updated} pitcher(s).`);
        mongoose.connection.close();
    })
    .catch(err => {
        console.error(err);
        mongoose.connection.close();
    });