// seed-spitters.js
// Creates the St. Louis Seed Spitters demo team with pitchers showcasing PitchShuffle features
// Usage: node seed-spitters.js <userId>

require('dotenv').config();
const mongoose = require('mongoose');
const Pitcher = require('./models/pitcher');
const Team = require('./models/team');
const StrikeZone = require('./models/strikeZone');

const userId = process.argv[2];
if (!userId) {
    console.error('Usage: node seed-spitters.js <userId>');
    process.exit(1);
}

function toWeightMap(obj) {
    return new Map(Object.entries(obj));
}

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // ── Clean up only pitchers actually linked to a previous Seed Spitters team
    const existingTeam = await Team.findOne({ name: 'St. Louis Seed Spitters' });
    if (existingTeam) {
        console.log('Found existing Seed Spitters team — cleaning up...');
        if (existingTeam.pitchers && existingTeam.pitchers.length > 0) {
            await Pitcher.deleteMany({ _id: { $in: existingTeam.pitchers } });
            console.log(`  ✓ Deleted ${existingTeam.pitchers.length} linked pitchers`);
        }
        await Team.deleteOne({ _id: existingTeam._id });
        console.log('  ✓ Deleted team');
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

        // 1. Angela Delvecchio — Zone A, simple 3-pitch
        // Demo: minimal setup, great entry-level example
        {
            firstName: 'Angela',
            lastName: 'Delvecchio',
            name: 'Angela Delvecchio',
            number: 11,
            throws: 'R',
            zone: zoneA._id,
            pitchTypes: [
                { name: 'Fastball',  abbreviation: 'FB', locations: buildLocations(zoneA) },
                { name: 'Changeup',  abbreviation: 'CH', locations: buildLocations(zoneA) },
                { name: 'Curveball', abbreviation: 'CB', locations: buildLocations(zoneA) },
            ],
            shuffleSettings: { strikeChancePct: null, pitchWeights: toWeightMap({}) }
        },

        // 2. Stephanie Morgan — Zone B, max 8-pitch repertoire
        // Demo: full arsenal, shuffle across many pitch types
        {
            firstName: 'Stephanie',
            lastName: 'Morgan',
            name: 'Stephanie Morgan',
            number: 22,
            throws: 'R',
            zone: zoneB._id,
            pitchTypes: [
                { name: 'Fastball',    abbreviation: 'FB', locations: buildLocations(zoneB) },
                { name: 'Riseball',    abbreviation: 'RB', locations: buildLocations(zoneB) },
                { name: 'Dropball',    abbreviation: 'DB', locations: buildLocations(zoneB) },
                { name: 'Changeup',    abbreviation: 'CH', locations: buildLocations(zoneB) },
                { name: 'Curveball',   abbreviation: 'CB', locations: buildLocations(zoneB) },
                { name: 'Screwball',   abbreviation: 'SC', locations: buildLocations(zoneB) },
                { name: 'Inside Move', abbreviation: 'IM', locations: buildLocations(zoneB) },
                { name: 'Pitchout',    abbreviation: 'PO', locations: buildLocations(zoneB) },
            ],
            shuffleSettings: { strikeChancePct: null, pitchWeights: toWeightMap({}) }
        },

        // 3. Jocinda Smith — Zone B, weighted fastball
        // Demo: pitch weight settings — heavy fastball bias
        {
            firstName: 'Jocinda',
            lastName: 'Smith',
            name: 'Jocinda Smith',
            number: 7,
            throws: 'R',
            zone: zoneB._id,
            pitchTypes: [
                { name: 'Fastball', abbreviation: 'FB', locations: buildLocations(zoneB) },
                { name: 'Changeup', abbreviation: 'CH', locations: buildLocations(zoneB) },
                { name: 'Dropball', abbreviation: 'DB', locations: buildLocations(zoneB) },
            ],
            shuffleSettings: {
                strikeChancePct: 70,
                pitchWeights: toWeightMap({ 'Fastball': 60, 'Changeup': 20, 'Dropball': 20 })
            }
        },

        // 4. Vicki Kawaguchi — Zone C, arm/glove terminology
        // Demo: Zone C with directional pitch names
        {
            firstName: 'Vicki',
            lastName: 'Kawaguchi',
            name: 'Vicki Kawaguchi',
            number: 14,
            throws: 'L',
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
                    name: 'Glove Side Drop', abbreviation: 'GD',
                    locations: buildLocations(zoneC, [
                        'glove-down','mid-down','arm-down',
                        'glove-out-down','down-out','arm-out-down'
                    ])
                },
                {
                    name: 'Arm Side Rise', abbreviation: 'AR',
                    locations: buildLocations(zoneC, [
                        'arm-up','mid-up','glove-up',
                        'arm-out-up','up-out','glove-out-up'
                    ])
                },
                {
                    name: 'Backdoor Curve', abbreviation: 'BC',
                    locations: buildLocations(zoneC, [
                        'glove-mid','glove-down',
                        'glove-out-mid','glove-out-down'
                    ])
                },
            ],
            shuffleSettings: { strikeChancePct: 65, pitchWeights: toWeightMap({}) }
        },

        // 5. Sidney Webber — Zone D, balanced 4-pitch
        // Demo: quadrant zone with standard pitch names
        {
            firstName: 'Sidney',
            lastName: 'Webber',
            name: 'Sidney Webber',
            number: 33,
            throws: 'R',
            zone: zoneD._id,
            pitchTypes: [
                { name: 'Fastball',  abbreviation: 'FB', locations: buildLocations(zoneD) },
                { name: 'Changeup',  abbreviation: 'CH', locations: buildLocations(zoneD) },
                { name: 'Dropball',  abbreviation: 'DB', locations: buildLocations(zoneD) },
                { name: 'Curveball', abbreviation: 'CB', locations: buildLocations(zoneD) },
            ],
            shuffleSettings: { strikeChancePct: null, pitchWeights: toWeightMap({}) }
        },

        // 6. Ashley Webber — Zone D, custom pitch names (twins!)
        // Demo: same zone as Sidney, totally different pitch feel
        {
            firstName: 'Ashley',
            lastName: 'Webber',
            name: 'Ashley Webber',
            number: 34,
            throws: 'L',
            zone: zoneD._id,
            pitchTypes: [
                { name: 'Shell Splitter',    abbreviation: 'SS', locations: buildLocations(zoneD) },
                { name: 'The Wobble',        abbreviation: 'WB', locations: buildLocations(zoneD) },
                { name: 'South City Sinker', abbreviation: 'SC', locations: buildLocations(zoneD) },
                {
                    name: 'High Cheese', abbreviation: 'HC',
                    locations: buildLocations(zoneD, ['glove-up','arm-up','up-out'])
                },
                { name: 'Knuckle Curve', abbreviation: 'KC', locations: buildLocations(zoneD) },
            ],
            shuffleSettings: {
                strikeChancePct: 55,
                pitchWeights: toWeightMap({
                    'Shell Splitter':    35,
                    'The Wobble':        20,
                    'South City Sinker': 20,
                    'High Cheese':       10,
                    'Knuckle Curve':     15
                })
            }
        },

        // 7. Katie Johnson — Zone C, chase-heavy settings
        // Demo: strikeChancePct pushed low to showcase chase slider
        {
            firstName: 'Katie',
            lastName: 'Johnson',
            name: 'Katie Johnson',
            number: 1,
            throws: 'R',
            zone: zoneC._id,
            pitchTypes: [
                {
                    name: 'Fastball', abbreviation: 'FB',
                    locations: buildLocations(zoneC, [
                        'glove-up','arm-up','mid-up',
                        'glove-mid','mid-mid','arm-mid',
                        'up-out','arm-out-up','glove-out-up'
                    ])
                },
                {
                    name: 'Yakker', abbreviation: 'YK',
                    locations: buildLocations(zoneC, [
                        'glove-down','mid-down','arm-down',
                        'glove-out-down','down-out','arm-out-down'
                    ])
                },
                {
                    name: 'Cement Mixer', abbreviation: 'CM',
                    locations: buildLocations(zoneC, [
                        'arm-mid','arm-down',
                        'arm-out-mid','arm-out-down','arm-out-up'
                    ])
                },
                {
                    name: 'Changeup', abbreviation: 'CH',
                    locations: buildLocations(zoneC, [
                        'glove-mid','mid-mid','arm-mid',
                        'glove-down','mid-down','arm-down',
                        'down-out','glove-out-down','arm-out-down'
                    ])
                },
            ],
            shuffleSettings: { strikeChancePct: 35, pitchWeights: toWeightMap({}) }
        },

        // 8. Maria — Zone A, fully custom everything
        // Demo: audio calling "Shell Game", "Bug Spray" etc — custom truly means custom
        {
            firstName: '',
            lastName: 'Maria',
            name: 'Maria',
            number: 44,
            throws: 'R',
            zone: zoneA._id,
            pitchTypes: [
                { name: 'The Seed',            abbreviation: 'TS', locations: buildLocations(zoneA) },
                { name: 'Bug Spray',           abbreviation: 'BS', locations: buildLocations(zoneA) },
                { name: 'The Juke',            abbreviation: 'JK', locations: buildLocations(zoneA) },
                { name: 'South City Surprise', abbreviation: 'SX', locations: buildLocations(zoneA) },
                { name: 'Shell Game',          abbreviation: 'SG', locations: buildLocations(zoneA) },
                { name: 'Backdoor Bender',     abbreviation: 'BB', locations: buildLocations(zoneA) },
                { name: 'The Wobble Jr',       abbreviation: 'WJ', locations: buildLocations(zoneA) },
            ],
            shuffleSettings: {
                strikeChancePct: null,
                pitchWeights: toWeightMap({
                    'The Seed':            30,
                    'Bug Spray':           15,
                    'The Juke':            15,
                    'South City Surprise': 10,
                    'Shell Game':          15,
                    'Backdoor Bender':     10,
                    'The Wobble Jr':        5
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
        const display = pitcher.firstName ? `${pitcher.firstName} ${pitcher.lastName}` : pitcher.lastName;
        console.log(`  ✓ ${display} (#${pitcher.number})`);
        pitcherIds.push(pitcher._id);
    }

    // ── Create the team ───────────────────────────────────────────────────────
    console.log('Creating team...');
    const team = new Team({
        name: 'St. Louis Seed Spitters',
        sport: 'softball',
        owner: new mongoose.Types.ObjectId(userId),
        pitchers: pitcherIds,
        primaryColor:   '#f5c518',
        secondaryColor: '#1a1a1a',
        strikeColor:    '#fff8dc',
        chaseColor:     '#f5c518',
    });

    await team.save();
    console.log(`  ✓ Team "${team.name}" created`);
    console.log('\n✅ Seed Spitters seeded successfully!');
    console.log(`   Team ID: ${team._id}`);
    console.log(`   Pitchers: ${pitcherIds.length}`);

    mongoose.connection.close();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    mongoose.connection.close();
    process.exit(1);
});
