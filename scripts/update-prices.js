const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const SiteSettingsSchema = new mongoose.Schema({
  membershipPrices: {
    "3months": { type: Number },
    "6months": { type: Number },
    "1year":   { type: Number },
  },
  paymentMethods: [{ name: String, type: String, accountNumber: String, accountName: String }],
}, { timestamps: true });

const SiteSettings = mongoose.model('SiteSettings', SiteSettingsSchema);

async function run() {
  const uri = process.env.MONGODB_URI_DIRECT || process.env.MONGODB_URI;
  if (!uri) { console.error('No MONGODB_URI'); process.exit(1); }

  await mongoose.connect(uri, { family: 4, serverSelectionTimeoutMS: 10000 });
  console.log('Connected!');

  const result = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { 'membershipPrices.3months': 300000, 'membershipPrices.6months': 550000, 'membershipPrices.1year': 1100000 } },
    { upsert: true, new: true }
  );

  console.log('Updated prices:');
  console.log('  3 Bulan  : Rp', result.membershipPrices['3months'].toLocaleString('id-ID'));
  console.log('  6 Bulan  : Rp', result.membershipPrices['6months'].toLocaleString('id-ID'));
  console.log('  1 Tahun  : Rp', result.membershipPrices['1year'].toLocaleString('id-ID'));

  await mongoose.disconnect();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });

