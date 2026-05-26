# Telegram Spike Conclusion

Dokumen ini menjelaskan logic ringkas untuk kesimpulan bot Telegram saat user mengetik ticker atau `/chart TICKER`.

## Data yang Dipakai

- Quote aktif: `open`, `high`, `low`, `previousClose`, `price`, `volume`, `changePercent`.
- Intraday 1 menit, fallback 5 menit: rekor high/low dan posisi harga dalam range hari ini, difilter ke tanggal WIB hari berjalan.
- Daily 45 hari terakhir: previous day high/low, high 20 hari, rata-rata range 20 hari, rata-rata volume 20 hari.

## Output Bot

Respons tetap dikirim sebagai blok Markdown agar rapi di Telegram:

```md
──────────────────────
Open : 100
High : 108
Low  : 98
Prev : 99
Now  : 106
Chg% : +7.07%
──────────────────────
# High Records (WIB):
• 104 at 09:35
• 106 at 10:20
• 108 at 11:05
──────────────────────
# Low Records (WIB):
• 99 at 09:01
• 98 at 09:07
──────────────────────
# Kesimpulan:
Bias : Markup menguat
Score: 6/9
Potensi: Bagus, ada potensi naik lanjutan
Catatan: valid selama harga bertahan di atas 103 dan volume tidak mengering
PDH  : 103
PDL  : 96
Range: 1.8x 20D
Vol  : 2.1x 20D
Pos  : 80% range
Alasan:
• Harga bertahan di atas prev high 103
• Volume 2.1x rata-rata 20D
• Harga dekat high intraday (80% range)
Level:
• Valid jika tahan > 103
• Waspada jika turun < 96
──────────────────────
# Pra-Volume:
Status: Akumulasi kuat pra-volume
Score : 78/100
Potensi: Potensi markup dini sebelum ramai
Vol20: 0.8x | Range20: 9.5%
Akumulasi:
• Volume belum ramai (0.8x vs rata-rata 20D)
• Range 20D menyempit (9.5%)
• OBV dan A/D naik saat harga belum meledak
Trigger:
• Valid jika close > 103 atau break high 20D dengan volume bertahap
──────────────────────
```

## Scoring

Score dipakai untuk membaca apakah spike lebih dekat ke markup, markup awal, sideways, atau rejection.

```ts
+2 jika harga sekarang > previous day high
+1 jika high hari ini sempat menembus previous day high
+2 jika harga sekarang > rolling high 20 hari
+2 jika volume >= 1.5x rata-rata volume 20 hari
+1 jika volume >= 1.1x rata-rata volume 20 hari
-1 jika volume < 0.8x rata-rata volume 20 hari
+1 jika harga berada di 70% teratas range intraday
-1 jika harga turun ke bawah 45% range intraday
+1 jika range hari ini >= 1.4x rata-rata range 20 hari
+1 jika low hari ini masih di atas low hari sebelumnya
-2 jika sempat tembus previous day high tetapi tidak bertahan
-1 jika wick/rejection dari high >= 35% range hari ini
-1 jika harga masih di bawah previous close
```

## Bias

```ts
score >= 5  -> Markup menguat
score >= 3  -> Markup awal, tunggu konfirmasi
score >= 1  -> Netral / rawan sideways
score <= 0  -> Spike lemah / sideways
```

## Potensi

Label `Potensi` ditambahkan ke respons Telegram agar user tidak perlu menebak apakah setup termasuk bagus dan masih punya peluang lanjut naik.

```ts
Bagus, ada potensi naik lanjutan
  jika score >= 4,
  ada dukungan volume atau breakout level,
  harga close dekat high / bertahan di atas level penting,
  tidak ada rejection besar,
  dan harga tidak berada di bawah previous close.

Cukup bagus, tunggu konfirmasi
  jika score >= 3 tetapi belum memenuhi semua syarat potensi naik lanjutan.

Belum cukup kuat
  jika score di bawah 3.
```

## Pra-Volume

Section `Pra-Volume` membaca fase sebelum volume besar terjadi. Tujuannya mencari saham yang masih relatif sepi, tetapi mulai menunjukkan jejak akumulasi.

Command khusus:

```md
/prevol BUMI
/prevolume BUMI
/akumulasi BUMI
```

Sinyal utama:

```ts
volume belum ramai          -> volume < 1.5x rata-rata 20D
range compression           -> range 20D menyempit
price sideways              -> harga 20D tidak bergerak terlalu jauh
OBV/A-D naik                -> aliran volume naik saat harga belum markup
dry pullback                -> candle turun volumenya lebih kering
close dekat high berulang   -> buyer menjaga close harian
support held                -> low 10D tidak merusak support 20D
near breakout               -> jarak ke high 20D makin dekat
```

Label:

```ts
score >= 75 dan volume belum besar -> Akumulasi kuat pra-volume
score >= 55                        -> Mulai menarik, tunggu trigger
volume sudah >= 1.5x dan score kuat -> Volume sudah mulai besar
score < 55                         -> Belum ada akumulasi jelas
```

## Catatan Implementasi

- Kesimpulan dibuat di `app/api/telegram/webhook/route.ts`.
- Logic pra-volume dibuat di `lib/preVolumeAccumulation.ts`.
- Caption foto Telegram dibatasi sekitar 1024 karakter, jadi high/low records hanya ditampilkan maksimal 3 item terakhir.
- Jika caption terlalu panjang, helper `fitTelegramCaption` menghapus daftar records lebih dulu agar chart photo tetap bisa terkirim.
- Jika Yahoo mengembalikan fallback intraday beberapa hari saat market libur, records lama tidak dipakai untuk kesimpulan hari ini.
