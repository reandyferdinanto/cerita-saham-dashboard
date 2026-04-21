# Machine Learning Plan (Cerita Saham)

## Objective
Membangun model machine learning sederhana untuk memprediksi pergerakan harga saham IDX (Naik/Turun) dalam jangka pendek (1 hari ke depan).

## Tech Stack
- **Bahasa:** Python
- **Library:** `pandas`, `scikit-learn`, `yfinance` (atau mengambil dari database Postgres lokal)
- **Model:** Random Forest Classifier (karena tangguh terhadap outlier dan tidak memerlukan scaling fitur yang rumit, cocok untuk baseline sederhana).

## Tahapan Implementasi
1. **Data Collection:** Mengambil data historis OHLCV (Open, High, Low, Close, Volume) saham IDX (misal BBCA.JK) menggunakan `yfinance`.
2. **Feature Engineering:** 
   - Menghitung indikator teknikal dasar seperti RSI (Relative Strength Index), Moving Averages (MA20, MA50), dan Volatilitas.
   - Menghitung persentase perubahan harga harian.
3. **Target Variable:** 
   - `1` jika harga Close besok lebih tinggi dari Close hari ini (Naik).
   - `0` jika sebaliknya (Turun).
4. **Training & Evaluation:** 
   - Membagi data menjadi Train (80%) dan Test (20%).
   - Melatih model Random Forest Classifier.
   - Evaluasi menggunakan metrik Akurasi, Precision, dan Recall.
5. **Prediction:** Memberikan probabilitas kenaikan untuk data terbaru hari ini.

## Lokasi File
- `scripts/ml/train_simple_model.py` (Script utama untuk eksperimen dan training awal)
- `scripts/ml/requirements.txt` (Daftar dependensi Python)
