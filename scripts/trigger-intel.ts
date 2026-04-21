
import { config } from 'dotenv';
import path from 'path';

// Load env from root
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = 'http://localhost:3000';

async function triggerCron(name: string, endpoint: string) {
  console.log(`\nTriggering ${name}...`);
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    
    if (!res.ok) {
      const err = await res.json();
      console.error(`❌ ${name} Failed:`, err);
      return false;
    }
    
    const data = await res.json();
    console.log(`✅ ${name} Success:`, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ ${name} Error:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Manual Intelligence Trigger...');
  
  // Trigger Morning Intel
  await triggerCron('Morning Intel', '/api/cron/morning-intel');
  
  // Trigger Daily Summary
  await triggerCron('Daily Summary', '/api/cron/daily-summary');
  
  console.log('\n✨ All triggers completed.');
}

main().catch(console.error);
