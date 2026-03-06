require('dotenv').config({ path: '.env.local' });
var uri = process.env.MONGODB_URI;
console.log('MONGODB_URI =', uri ? uri.replace(/:[^:@]+@/, ':***@') : 'NOT SET');

if (!uri) process.exit(1);

// Test DNS resolution of the SRV record
var dns = require('dns');
var host = uri.split('@')[1].split('/')[0];
console.log('Resolving host:', host);
dns.resolveSrv('_mongodb._tcp.' + host, function(err, records) {
  if (err) {
    console.log('DNS SRV error:', err.code, err.message);
    // Try plain DNS
    dns.lookup(host, function(err2, addr) {
      if (err2) console.log('DNS lookup also failed:', err2.message);
      else console.log('DNS lookup OK:', addr);
    });
  } else {
    console.log('DNS SRV OK:', records.length, 'records');
    console.log('First record:', records[0]);
  }
});

