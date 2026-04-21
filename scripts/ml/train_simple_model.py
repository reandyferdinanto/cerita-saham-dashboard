import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import warnings

warnings.filterwarnings('ignore')

def calculate_rsi(data, window=14):
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def prepare_data(ticker):
    print(f"Fetching data for {ticker}...")
    # Ambil data 2 tahun terakhir
    df = yf.download(ticker, period="2y", progress=False)
    
    if df.empty:
        raise ValueError("Data tidak ditemukan.")

    # Jika multi-index (dari yfinance terbaru), ratakan index kolom
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.droplevel(1)
        
    print("Mengkalkulasi fitur teknikal (RSI, MA, Returns)...")
    # Feature 1: Daily Return
    df['Return'] = df['Close'].pct_change()
    
    # Feature 2: Moving Averages (MA5, MA20)
    df['MA5'] = df['Close'].rolling(window=5).mean()
    df['MA20'] = df['Close'].rolling(window=20).mean()
    
    # Feature 3: Rasio MA (MA5 / MA20) untuk melihat trend
    df['MA_Ratio'] = df['MA5'] / df['MA20']
    
    # Feature 4: RSI
    df['RSI'] = calculate_rsi(df)
    
    # Feature 5: Volume momentum (Volume / MA20 Volume)
    df['Vol_MA20'] = df['Volume'].rolling(window=20).mean()
    df['Vol_Ratio'] = df['Volume'] / df['Vol_MA20']

    # Target: 1 jika besok harga naik (Close besok > Close hari ini), 0 jika turun/tetap
    df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
    
    # Drop baris dengan nilai NaN akibat perhitungan indikator dan shift target
    df = df.dropna()
    
    return df

def train_model(df):
    features = ['Return', 'MA_Ratio', 'RSI', 'Vol_Ratio']
    X = df[features]
    y = df['Target']
    
    # Gunakan data masa lalu untuk train, data terbaru untuk test agar tidak ada data leakage (Time Series Split sederhana)
    split_idx = int(len(df) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    print(f"Training data: {len(X_train)} hari, Testing data: {len(X_test)} hari.")
    
    # Model: Random Forest Classifier (sederhana & robust)
    model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=5)
    model.fit(X_train, y_train)
    
    # Evaluasi
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print("\n--- HASIL EVALUASI MODEL ---")
    print(f"Akurasi: {accuracy:.2f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Feature Importance
    print("\nFeature Importance:")
    for feature, imp in zip(features, model.feature_importances_):
        print(f"- {feature}: {imp:.4f}")
        
    return model, features

def predict_today(model, df, features, ticker):
    # Ambil baris data paling terakhir (kondisi pasar terbaru)
    latest_data = df.iloc[-1:]
    X_latest = latest_data[features]
    
    prediction = model.predict(X_latest)[0]
    prob = model.predict_proba(X_latest)[0]
    
    print(f"\n--- PREDIKSI UNTUK {ticker} (HARI SELANJUTNYA) ---")
    if prediction == 1:
        print(f"Prediksi: NAIK (Probabilitas: {prob[1]:.2%})")
    else:
        print(f"Prediksi: TURUN / TETAP (Probabilitas: {prob[0]:.2%})")
        
    print("Indikator Saat Ini:")
    for feature in features:
        print(f"- {feature}: {latest_data[feature].values[0]:.4f}")

if __name__ == "__main__":
    # Pilih saham yang cukup liquid untuk baseline (misal BBCA atau BBRI)
    TICKER = "BBCA.JK"
    try:
        data = prepare_data(TICKER)
        trained_model, used_features = train_model(data)
        predict_today(trained_model, data, used_features, TICKER)
    except Exception as e:
        print(f"Error: {e}")
