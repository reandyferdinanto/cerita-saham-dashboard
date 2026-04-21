const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function syncToPostgres() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found.");
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === 'true' }
  });

  const detailsFile = path.join(__dirname, '../external/idx-bei/data/companyDetailsByKodeEmiten.json');
  if (!fs.existsSync(detailsFile)) {
    console.error("Details file not found.");
    return;
  }

  const allDetails = JSON.parse(fs.readFileSync(detailsFile, 'utf8'));
  console.log(`Found ${Object.keys(allDetails).length} company details to sync.`);

  const client = await pool.connect();
  try {
    let syncedCount = 0;
    for (const [ticker, response] of Object.entries(allDetails)) {
      const profile = (response.data && response.data.length > 0) ? response.data[0] : {};
      
      const query = `
        INSERT INTO indonesia_stocks (
          ticker, name, listing_date, sector, industry, sub_industry, website, address, description, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (ticker) DO UPDATE SET
          name = EXCLUDED.name,
          listing_date = EXCLUDED.listing_date,
          sector = EXCLUDED.sector,
          industry = EXCLUDED.industry,
          sub_industry = EXCLUDED.sub_industry,
          website = EXCLUDED.website,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `;

      const values = [
        ticker,
        profile.NamaEmiten || 'N/A',
        profile.TanggalPencatatan || null,
        profile.Sektor || '',
        profile.Industri || '',
        profile.SubIndustri || '',
        profile.Website || '',
        profile.Alamat || '',
        profile.ProfilSingkat || '',
        true
      ];

      await client.query(query, values);
      syncedCount++;
    }
    console.log(`Successfully synced ${syncedCount} stocks to Postgres.`);
  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

syncToPostgres();
