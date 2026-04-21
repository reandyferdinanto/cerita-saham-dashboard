import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getIndonesiaStockUniverse } from '@/lib/indonesiaStockMaster';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') || "under300";

    // 1. Get tickers based on bucket from DB
    const universe = await getIndonesiaStockUniverse({ 
      priceBucket: bucket as any, 
      candidateLimit: 150 
    });
    
    const tickers = universe.stocks.map(s => s.symbol).join(',');
    
    if (!tickers) {
      return NextResponse.json({ count: 0, results: [], message: "No stocks found under 300" });
    }

    // 2. Call Python screener
    const scriptPath = path.join(process.cwd(), 'scripts', 'ml', 'screener.py');
    const pythonExecutable = path.join(process.cwd(), '.venv', 'bin', 'python');
    
    // Using a longer timeout for the screener as it processes multiple stocks
    const { stdout, stderr } = await execAsync(`${pythonExecutable} ${scriptPath} "${tickers}"`, {
      timeout: 120000 // 2 minutes timeout
    });
    
    if (stderr && !stdout) {
      console.error('Python ML Screener Stderr:', stderr);
    }

    try {
      const result = JSON.parse(stdout.trim());
      
      // Enrich with names from universe
      const nameMap = new Map(universe.stocks.map(s => [s.symbol, s.name]));
      const enrichedResults = result.results.map((item: any) => ({
        ...item,
        name: nameMap.get(item.ticker) || item.ticker
      }));

      return NextResponse.json({
        ...result,
        results: enrichedResults
      });
    } catch (parseError) {
      console.error('Failed to parse Python output:', stdout);
      return NextResponse.json({ error: 'Failed to parse ML screener output', raw: stdout }, { status: 500 });
    }

  } catch (error: any) {
    console.error('ML Screener Error:', error);
    return NextResponse.json({ error: 'Failed to execute ML screener', details: error.message }, { status: 500 });
  }
}
