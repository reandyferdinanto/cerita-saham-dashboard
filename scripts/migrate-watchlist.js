const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const WatchlistSchema = new mongoose.Schema({
  ticker: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  tp: { type: Number, default: null },
  sl: { type: Number, default: null },
  bandarmology: { type: String, default: '' },
  addedAt: { type: String, required: true },
});
const Watchlist = mongoose.model('Watchlist', WatchlistSchema);

const data = [
  {
    ticker: 'TOSK.JK',
    name: 'TOSK.JK',
    tp: 75,
    sl: 68,
    bandarmology: 'ada akumulasi dan murah',
    addedAt: '2026-03-02T21:52:39.453Z'
  },
  {
    ticker: 'REAL.JK',
    name: 'Repower Asia Indonesia Tbk.',
    tp: 70,
    sl: 55,
    bandarmology: 'mulai ada akumulasi',
    addedAt: '2026-03-03T03:55:21.320Z'
  }
];

// Use direct hosts (non-SRV) to bypass Windows Node.js SRV DNS issue
const DIRECT_URI = 'mongodb://reandy:XuISHforC8mWVEKd@ac-pfdd5xf-shard-00-00.ybmffcl.mongodb.net:27017,ac-pfdd5xf-shard-00-01.ybmffcl.mongodb.net:27017,ac-pfdd5xf-shard-00-02.ybmffcl.mongodb.net:27017/ceritasaham?replicaSet=atlas-lnuwmi-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority';

async function migrate() {
  var uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  console.log('Connecting to MongoDB (direct hosts)...');
  await mongoose.connect(DIRECT_URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4,
  });
  console.log('Connected!');

  var inserted = 0;
  var skipped = 0;

  for (var i = 0; i < data.length; i++) {
    var entry = data[i];
    var exists = await Watchlist.findOne({ ticker: entry.ticker });
    if (exists) {
      console.log('  SKIP (already exists):', entry.ticker);
      skipped++;
      continue;
    }
    await Watchlist.create(entry);
    console.log('  INSERTED:', entry.ticker);
    inserted++;
  }

  console.log('\nMigration complete!');
  console.log('  Inserted:', inserted);
  console.log('  Skipped: ', skipped);
  await mongoose.disconnect();
}

migrate().catch(function(e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
