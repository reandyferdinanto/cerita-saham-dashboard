import sys
import json
import warnings
import yfinance as yf
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

warnings.filterwarnings('ignore')

def calculate_rsi(data, window=14):
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Ticker required"}))
        sys.exit(1)
        
    ticker = sys.argv[1].upper()
    if not ticker.endswith('.JK'):
        ticker += '.JK'
        
    try:
        # Fetch data
        df = yf.download(ticker, period="2y", progress=False)
        if df.empty:
            print(json.dumps({"error": f"No data found for {ticker}"}))
            sys.exit(1)
            
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)
            
        # Features
        df['Return'] = df['Close'].pct_change()
        df['MA5'] = df['Close'].rolling(window=5).mean()
        df['MA20'] = df['Close'].rolling(window=20).mean()
        df['MA_Ratio'] = df['MA5'] / df['MA20']
        df['RSI'] = calculate_rsi(df)
        df['Vol_MA20'] = df['Volume'].rolling(window=20).mean()
        df['Vol_Ratio'] = df['Volume'] / df['Vol_MA20']
        df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
        
        # Prepare for JSON (Historical Data - Last 60 days)
        # We need to save the original date index as strings
        hist_df = df.tail(60).copy()
        historical_data = []
        for date, row in hist_df.iterrows():
            historical_data.append({
                "time": date.strftime('%Y-%m-%d'),
                "open": float(row['Open']) if not pd.isna(row['Open']) else 0,
                "high": float(row['High']) if not pd.isna(row['High']) else 0,
                "low": float(row['Low']) if not pd.isna(row['Low']) else 0,
                "close": float(row['Close']) if not pd.isna(row['Close']) else 0,
                "volume": int(row['Volume']) if not pd.isna(row['Volume']) else 0
            })
            
        df = df.dropna()
        if len(df) < 50:
             print(json.dumps({"error": "Not enough data points after dropping NaNs"}))
             sys.exit(1)

        features = ['Return', 'MA_Ratio', 'RSI', 'Vol_Ratio']
        X = df[features]
        y = df['Target']
        
        split_idx = int(len(df) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
        
        model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=5)
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        latest_data = df.iloc[-1:]
        X_latest = latest_data[features]
        prediction = int(model.predict(X_latest)[0])
        prob = model.predict_proba(X_latest)[0]
        
        result = {
            "ticker": ticker,
            "prediction": "NAIK" if prediction == 1 else "TURUN / TETAP",
            "probability": round(prob[1] * 100, 2) if prediction == 1 else round(prob[0] * 100, 2),
            "accuracy": round(accuracy * 100, 2),
            "indicators": {
                "rsi": round(float(latest_data['RSI'].values[0]), 2),
                "ma_ratio": round(float(latest_data['MA_Ratio'].values[0]), 4),
                "vol_ratio": round(float(latest_data['Vol_Ratio'].values[0]), 4)
            },
            "historical_data": historical_data
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
