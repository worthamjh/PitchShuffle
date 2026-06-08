// seed-splinters.js
// Creates the Maplewood Splinters demo team with pitchers showcasing PitchShuffle features
// Usage: node seed-splinters.js <userId>

require('dotenv').config();
const mongoose = require('mongoose');
const Pitcher = require('./models/pitcher');
const Team = require('./models/team');
const StrikeZone = require('./models/strikeZone');

const userId = process.argv[2];
if (!userId) {
    console.error('Usage: node seed-splinters.js <userId>');
    process.exit(1);
}

function toWeightMap(obj) {
    return new Map(Object.entries(obj));
}

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // ── Clean up any previous partial run ────────────────────────────────────
    const existingTeam = await Team.findOne({ name: 'Maplewood Splinters' });
    if (existingTeam) {
        console.log('Found existing Maplewood Splinters team — cleaning up...');
        await Pitcher.deleteMany({ _id: { $in: existingTeam.pitchers } });
        await Team.deleteOne({ _id: existingTeam._id });
        console.log('  ✓ Cleaned up previous run');
    } else {
        const orphanLastNames = ['Sanchez','Wheeler','Delvecchio','Petrovich','Kawaguchi','Robinson','Johnson','Khan'];
        const orphans = await Pitcher.find({ lastName: { $in: orphanLastNames } });
        if (orphans.length > 0) {
            await Pitcher.deleteMany({ _id: { $in: orphans.map(p => p._id) } });
            console.log(`  ✓ Cleaned up ${orphans.length} orphaned pitchers`);
        }
    }

    // ── Look up zone IDs ──────────────────────────────────────────────────────
    const zoneA = await StrikeZone.findOne({ name: 'Zone A - Glove/Arm' });
    const zoneB = await StrikeZone.findOne({ name: 'Zone B - Up/Down' });
    const zoneC = await StrikeZone.findOne({ name: 'Zone C' });
    const zoneD = await StrikeZone.findOne({ name: 'Zone D' });

    if (!zoneA || !zoneB || !zoneC || !zoneD) {
        console.error('One or more zones not found. Run your zones seed first.');
        process.exit(1);
    }
    console.log('Zones found ✓');

    function buildLocations(zone, enabledNames = null) {
        return zone.availableLocations.map(loc => ({
            name: loc.name,
            type: loc.type,
            enabled: enabledNames === null ? true : enabledNames.includes(loc.name)
        }));
    }

    const pitcherDefs = [

        // 1. Pablo Sanchez — Zone A, simple 3-pitch ace
        // Demo: minimal setup, clean entry-level example
        {
            firstName: 'Pablo',
            lastName: 'Sanchez',
            name: 'Pablo Sanchez',
            number: 1,
            throws: 'R',
            zone: zoneA._id,
            pitchTypes: [
                { name: 'Fastball',  abbreviation: 'FB', locations: buildLocations(zoneA) },
                { name: 'Curveball', abbreviation: 'CB', locations: buildLocations(zoneA) },
                { name: 'Changeup',  abbreviation: 'CH', locations: buildLocations(zoneA) },
            ],
            shuffleSettings: { strikeChancePct: null, pitchWeights: toWeightMap({}) }
        },

        // 2. Pete Wheeler — Zone B, max 8-pitch repertoire
        // Demo: full standard baseball arsenal, shuffle across many types
        {
            firstName: 'Pete',
            lastName: 'Wheeler',
            name: 'Pete Wheeler',
            number: 14,
            throws: 'R',
            zone: zoneB._id,
            pitchTypes: [
                { name: 'Fastball',   abbreviation: 'FB', locations: buildLocations(zoneB) },
                { name: 'Sinker',     abbreviation: 'SI', locations: buildLocations(zoneB) },
                { name: 'Curveball',  abbreviation: 'CB', locations: buildLocations(zoneB) },
                { name: 'Slider',     abbreviation: 'SL', locations: buildLocations(zoneB) },
                { name: 'Changeup',   abbreviation: 'CH', locations: buildLocations(zoneB) },
                { name: 'Cutter',     abbreviation: 'CT', locations: buildLocations(zoneB) },
                { name: 'Splitter',   abbreviation: 'SP', locations: buildLocations(zoneB) },
                { name: 'Pitchout',   abbreviation: 'PO', locations: buildLocations(zoneB) },
            ],
            shuffleSettings: { strikeChancePct: null, pitchWeights: toWeightMap({}) }
        },

        // 3. Tony Delvecchio — Zone B, weighted fastball power arm
        // Demo: pitch weight settings — heavy fastball bias
        {
            firstName: 'Tony',
            lastName: 'Delvecchio',
            name: 'Tony Delvecchio',
            number: 22,
            throws: 'R',
            zone: zoneB._id,
            pitchTypes: [
                { name: 'Fastball', abbreviation: 'FB', locations: buildLocations(zoneB) },
                { name: 'Slider',   abbreviation: 'SL', locations: buildLocations(zoneB) },
                { name: 'Changeup', abbreviation: 'CH', locations: buildLocations(zoneB) },
            ],
            shuffleSettings: {
                strikeChancePct: 72,
                pitchWeights: toWeightMap({ 'Fastball': 65, 'Slider': 20, 'Changeup': 15 })
            }
        },

        // 4. Dmitri Petrovich — Zone C, arm/glove terminology
        // Demo: Zone C with directional location names, analytics-style pitch mix
        {
            firstName: 'Dmitri',
            lastName: 'Petrovich',
            name: 'Dmitri Petrovich',
            number: 7,
            throws: 'R',
            zone: zoneC._id,
            pitchTypes: [
                {
                    name: 'Fastball', abbreviation: 'FB',
                    locations: buildLocations(zoneC, [
                        'glove-up','mid-up','arm-up',
                        'glove-mid','mid-mid','arm-mid',
                        'glove-down','mid-down','arm-down',
                        'glove-out-mid','arm-out-mid'
                    ])
                },
                {
                    name: 'Cutter', abbreviation: 'CT',
                    locations: buildLocations(zoneC, [
                        'glove-up','glove-mid','glove-down',
                        'glove-out-up','glove-out-mid','glove-out-down'
                    ])
                },
                {
                    name: '2-Seam', abbreviation: '2S',
                    locations: buildLocations(zoneC, [
                        'arm-mid','arm-down','mid-down',
                        'arm-out-mid','arm-out-down','down-out'
                    ])
                },
                {
                    name: 'Curveball', abbreviation: 'CB',
                    locations: buildLocations(zoneC, [
                        'mid-down','arm-down','glove-down',
                        'down-out','arm-out-down','glove-out-down'
                    ])
                },
            ],
            shuffleSettings: { strikeChancePct: 65, pitchWeights: toWeightMap({}) }
        },

        // 5. Kenny Kawaguchi — Zone D, pinpoint control
        // Demo: quadrant zone with standard pitch names
        {
            firstName: 'Kenny',
            lastName: 'Kawaguchi',
            name: 'Kenny Kawaguchi',
            number: 33,
            throws: 'R',
            zone: zoneD._id,
            pitchTypes: [
                { name: 'Fastball',  abbreviation: 'FB', locations: buildLocations(zoneD) },
                { name: 'Changeup',  abbreviation: 'CH', locations: buildLocations(zoneD) },
                { name: 'Slider',    abbreviation: 'SL', locations: buildLocations(zoneD) },
                { name: 'Curveball', abbreviation: 'CB', locations: buildLocations(zoneD) },
            ],
            shuffleSettings: { strikeChancePct: null, pitchWeights: toWeightMap({}) }
        },

        // 6. Dante Robinson — Zone D, custom names
        // Demo: "custom means custom" — audio calling "The Filth", "Uncle Charlie" etc
        {
            firstName: 'Dante',
            lastName: 'Robinson',
            name: 'Dante Robinson',
            number: 34,
            throws: 'R',
            zone: zoneD._id,
            pitchTypes: [
                { name: 'The Heater',    abbreviation: 'HT', locations: buildLocations(zoneD) },
                { name: 'Yakker',        abbreviation: 'YK', locations: buildLocations(zoneD) },
                { name: 'Uncle Charlie', abbreviation: 'UC', locations: buildLocations(zoneD) },
                { name: 'Cement Mixer',  abbreviation: 'CM', locations: buildLocations(zoneD) },
                { name: 'The Filth',     abbreviation: 'FL', locations: buildLocations(zoneD) },
            ],
            shuffleSettings: {
                strikeChancePct: 58,
                pitchWeights: toWeightMap({
                    'The Heater':    40,
                    'Yakker':        20,
                    'Uncle Charlie': 20,
                    'Cement Mixer':  10,
                    'The Filth':     10
                })
            }
        },

        // 7. Ricky Johnson — Zone C, chase-heavy settings
        // Demo: strikeChancePct pushed low, shows the chase slider in action
        {
            firstName: 'Ricky',
            lastName: 'Johnson',
            name: 'Ricky Johnson',
            number: 11,
            throws: 'L',
            zone: zoneC._id,
            pitchTypes: [
                {
                    name: 'Fastball', abbreviation: 'FB',
                    locations: buildLocations(zoneC, [
                        'glove-up','mid-up','arm-up',
                        'glove-mid','mid-mid','arm-mid',
                        'up-out','arm-out-up','glove-out-up'
                    ])
                },
                {
                    name: 'High Cheese', abbreviation: 'HC',
                    locations: buildLocations(zoneC, [
                        'glove-up','mid-up','arm-up',
                        'up-out','arm-out-up','glove-out-up'
                    ])
                },
                {
                    name: 'Backdoor Hook', abbreviation: 'BH',
                    locations: buildLocations(zoneC, [
                        'glove-mid','glove-down',
                        'glove-out-mid','glove-out-down','down-out'
                    ])
                },
            ],
            shuffleSettings: { strikeChancePct: 35, pitchWeights: toWeightMap({}) }
        },

        // 8. Achmed Khan — Zone A, fully custom everything
        // Demo: max personality, audio calling "Drop the Bass", "The Remix" etc
        {
            firstName: 'Achmed',
            lastName: 'Khan',
            name: 'Achmed Khan',
            number: 44,
            throws: 'R',
            zone: zoneA._id,
            pitchTypes: [
                { name: 'The Axe',       abbreviation: 'AX', locations: buildLocations(zoneA) },
                { name: 'Headphones',    abbreviation: 'HP', locations: buildLocations(zoneA) },
                { name: 'Drop the Bass', abbreviation: 'DB', locations: buildLocations(zoneA) },
                { name: 'Subway',        abbreviation: 'SW', locations: buildLocations(zoneA) },
                { name: 'The Remix',     abbreviation: 'RX', locations: buildLocations(zoneA) },
                { name: 'Boom Stick',    abbreviation: 'BS', locations: buildLocations(zoneA) },
                { name: 'The Noise',     abbreviation: 'TN', locations: buildLocations(zoneA) },
            ],
            shuffleSettings: {
                strikeChancePct: null,
                pitchWeights: toWeightMap({
                    'The Axe':       30,
                    'Headphones':    15,
                    'Drop the Bass': 15,
                    'Subway':        10,
                    'The Remix':     15,
                    'Boom Stick':    10,
                    'The Noise':      5
                })
            }
        },
    ];

    // ── Create pitchers ───────────────────────────────────────────────────────
    console.log('Creating pitchers...');
    const pitcherIds = [];

    for (const def of pitcherDefs) {
        const pitcher = new Pitcher(def);
        await pitcher.save();
        console.log(`  ✓ ${pitcher.firstName} ${pitcher.lastName} (#${pitcher.number})`);
        pitcherIds.push(pitcher._id);
    }

    // ── Create the team ───────────────────────────────────────────────────────
    console.log('Creating team...');
    const team = new Team({
        name: 'Maplewood Splinters',
        sport: 'baseball',
        owner: new mongoose.Types.ObjectId(userId),
        pitchers: pitcherIds,
        primaryColor:   '#2d5016',  // forest green
        secondaryColor: '#c8a96e',  // raw wood tan
        strikeColor:    '#d4edda',  // light green
        chaseColor:     '#fff3cd',  // cream
    });

    await team.save();
    console.log(`  ✓ Team "${team.name}" created`);
    console.log('\n✅ Maplewood Splinters seeded successfully!');
    console.log(`   Team ID: ${team._id}`);
    console.log(`   Pitchers: ${pitcherIds.length}`);

    mongoose.connection.close();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    mongoose.connection.close();
    process.exit(1);
});
