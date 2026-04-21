import sys
import json
import warnings
import yfinance as yf
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from concurrent.futures import ThreadPoolExecutor
import datetime

warnings.filterwarnings('ignore')

def calculate_rsi(data, window=14):
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def predict_ticker(ticker):
    try:
        # Fetch data - 1y is enough for screening to save time
        df = yf.download(ticker, period="1y", progress=False)
        if df.empty or len(df) < 50:
            return None
            
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)
            
        latest_price = float(df['Close'].iloc[-1])

        # Features
        df['Return'] = df['Close'].pct_change()
        df['MA5'] = df['Close'].rolling(window=5).mean()
        df['MA20'] = df['Close'].rolling(window=20).mean()
        df['MA_Ratio'] = df['MA5'] / df['MA20']
        df['RSI'] = calculate_rsi(df)
        df['Vol_MA20'] = df['Volume'].rolling(window=20).mean()
        df['Vol_Ratio'] = df['Volume'] / df['Vol_MA20']
        df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
        
        df = df.dropna()
        if len(df) < 40:
             return None

        features = ['Return', 'MA_Ratio', 'RSI', 'Vol_Ratio']
        X = df[features]
        y = df['Target']
        
        # Simple split for speed in screener
        split_idx = int(len(df) * 0.8)
        X_train = X.iloc[:split_idx]
        y_train = y.iloc[:split_idx]
        
        model = RandomForestClassifier(n_estimators=50, random_state=42, max_depth=5)
        model.fit(X_train, y_train)
        
        latest_data = df.iloc[-1:]
        X_latest = latest_data[features]
        prediction = int(model.predict(X_latest)[0])
        prob = model.predict_proba(X_latest)[0]
        
        if prediction == 1:
            return {
                "ticker": ticker.replace('.JK', ''),
                "price": round(latest_price, 2),
                "probability": round(prob[1] * 100, 2),
                "rsi": round(float(latest_data['RSI'].values[0]), 2),
                "ma_ratio": round(float(latest_data['MA_Ratio'].values[0]), 4)
            }
        return None
        
    except Exception:
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Tickers required"}))
        sys.exit(1)
        
    tickers_input = sys.argv[1].split(',')
    tickers = [t.strip().upper() for t in tickers_input]
    tickers = [t if t.endswith('.JK') else t + '.JK' for t in tickers]
    
    results = []
    # Use ThreadPoolExecutor for parallel processing
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(predict_ticker, ticker) for ticker in tickers]
        for future in futures:
            res = future.result()
            if res:
                results.append(res)
    
    # Sort by probability descending
    results.sort(key=lambda x: x['probability'], reverse=True)
    
    print(json.dumps({
        "count": len(results),
        "results": results,
        "timestamp": datetime.datetime.now().isoformat()
    }))

if __name__ == "__main__":
    main()
