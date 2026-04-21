export function calculateSharpeRatio(returns: number[], riskFreeRate = 0) {
  if (returns.length < 2) return 0;
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  return (avgReturn - riskFreeRate) / stdDev;
}

export function calculateMaxDrawdown(returns: number[]) {
  if (returns.length === 0) return 0;
  
  let peak = 0;
  let maxDrawdown = 0;
  let cumulativeReturn = 0;
  
  // Assuming returns are percentage points (e.g. 5 for 5%)
  for (const r of returns) {
    cumulativeReturn += r;
    if (cumulativeReturn > peak) {
      peak = cumulativeReturn;
    }
    const drawdown = cumulativeReturn - peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

export function calculateEquityCurve(returns: number[]) {
  let current = 0;
  const curve = [0];
  for (const r of returns) {
    current += r;
    curve.push(current);
  }
  return curve;
}
