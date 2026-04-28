const mongoose = require('mongoose');
const StrikeZone = require('../models/strikeZone');

const zones = [
    {
        name: 'Zone A - Glove/Arm',
        availableLocations: [
            { name: 'glove-side', type: 'strike' },
            { name: 'arm-side',   type: 'strike' },
        ]
    },
    {
        name: 'Zone B - Up/Down',
        availableLocations: [
            { name: 'up',   type: 'strike' },
            { name: 'down', type: 'strike' },
        ]
    },
    {
        name: 'Zone C',
        availableLocations: [
            { name: 'glove-side-up',   type: 'strike' },
            { name: 'glove-side-down', type: 'strike' },
            { name: 'arm-side-up',     type: 'strike' },
            { name: 'arm-side-down',   type: 'strike' },
            { name: 'mid-mid',         type: 'strike' },
            { name: 'up-out',          type: 'chase'  },
            { name: 'down-out',        type: 'chase'  },
            { name: 'glove-out',       type: 'chase'  },
            { name: 'arm-out',         type: 'chase'  },
        ]
    },
    {
        name: 'Zone D',
        availableLocations: [
            { name: 'glove-up',       type: 'strike'    },
            { name: 'mid-up',         type: 'strike'    },
            { name: 'arm-up',         type: 'strike'    },
            { name: 'glove-mid',      type: 'strike'    },
            { name: 'mid-mid',        type: 'strike'    },
            { name: 'arm-mid',        type: 'strike'    },
            { name: 'glove-down',     type: 'strike'    },
            { name: 'mid-down',       type: 'strike'    },
            { name: 'arm-down',       type: 'strike'    },
            { name: 'glove-out-up',   type: 'chase'     },
            { name: 'mid-out-up',     type: 'chase'     },
            { name: 'arm-out-up',     type: 'chase'     },
            { name: 'glove-out-mid',  type: 'chase'     },
            { name: 'arm-out-mid',    type: 'chase'     },
            { name: 'glove-out-down', type: 'chase'     },
            { name: 'mid-out-down',   type: 'chase'     },
            { name: 'arm-out-down',   type: 'chase'     },
        ]
    }
];

mongoose.connect('mongodb://localhost:27017/pitchShuffle')
    .then(async () => {
        console.log('Database connected');
        await StrikeZone.deleteMany({});
        await StrikeZone.insertMany(zones);
        console.log('Zones seeded successfully!');
        mongoose.connection.close();
    })
    .catch(err => {
        console.error('Error seeding zones:', err);
        mongoose.connection.close();
    });