import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker parameter is required' }, { status: 400 });
  }

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'ml', 'predict_api.py');
    const pythonExecutable = path.join(process.cwd(), '.venv', 'bin', 'python');
    
    const { stdout, stderr } = await execAsync(`${pythonExecutable} ${scriptPath} ${ticker}`);
    
    // Log stderr for debugging if needed, but don't fail immediately
    if (stderr && !stdout) {
      console.error('Python ML Stderr:', stderr);
    }

    try {
      const result = JSON.parse(stdout.trim());
      if (result.error) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result);
    } catch (parseError) {
      console.error('Failed to parse Python output:', stdout);
      return NextResponse.json({ error: 'Failed to parse ML prediction output', raw: stdout }, { status: 500 });
    }

  } catch (error: any) {
    console.error('ML Execution Error:', error);
    return NextResponse.json({ error: 'Failed to execute ML script', details: error.message }, { status: 500 });
  }
}
