# twitklore

Kolektor tweet untuk keperluan **akademik dan riset pribadi**. CLI berbasis
Playwright + stealth plugin, mengambil tweet dari search X/Twitter (tab Latest/Top)
atau dari satu thread, lalu menyimpannya sebagai CSV atau XLSX.

> **Bukan produk komersial.** Lihat [NOTICE](./NOTICE) dan
> [UPSTREAM-LICENSE](./UPSTREAM-LICENSE).

## Asal-usul

Derivative dari [tweet-harvest](https://github.com/helmisatria/tweet-harvest)
oleh Helmi Satria. Lisensi upstream mengizinkan pemakaian edukatif dan
non-komersil, dengan syarat atribusi dan menyertakan lisensinya — keduanya
dipenuhi di repo ini.

## Cara pakai

```bash
pnpm install
pnpm start
```

Atau langsung pakai flag (direkomendasikan untuk Google Colab, supaya prompt
interaktif tidak menggantung):

```bash
pnpm start -- --token "AUTH_TOKEN" --search "kata kunci" --limit 100 \
  --from 01-01-2024 --to 31-12-2024 --tab LATEST --export csv
```

Mode thread:

```bash
pnpm start -- --token "AUTH_TOKEN" --thread "https://x.com/user/status/123"
```

### Opsi

| Flag | Arti |
|---|---|
| `-t, --token` | Cookie `auth_token` dari akun X |
| `-s, --search` | Keyword pencarian |
| `--thread` | URL tweet (mode detail, bukan search) |
| `-f, --from` | Tanggal mulai `DD-MM-YYYY` |
| `--to` | Tanggal akhir `DD-MM-YYYY` |
| `-l, --limit` | Target jumlah tweet (default 10) |
| `-d, --delay` | Delay per tweet, detik (default 3) |
| `-o, --output` | Nama file output |
| `--tab` | `TOP` atau `LATEST` (default LATEST) |
| `-e, --export` | `csv` atau `xlsx` (default csv) |
| `--headed` | Tampilkan browser, jangan headless |
| `--insert` | `REPLACE` (arsipkan file lama jadi `.old`) atau `APPEND` |

## Di Google Colab

Sama seperti versi aslinya — ini Node.js CLI biasa, tidak butuh display.
Yang perlu diperhatikan:

- Selalu pakai flag lengkap; prompt interaktif menggantung di notebook.
- Setelah runtime selesai, salin folder `twitklore-data/` ke Drive sebelum
  session di-reset, karena filesystem Colab bersifat sementara.
- Kalau muncul error shared library, jalankan `!playwright install-deps`.

## Output

File masuk ke `twitklore-data/`. Kolom yang disimpan (15):

`created_at`, `id_str`, `full_text`, `reply_count`, `retweet_count`,
`favorite_count`, `quote_count`, `lang`, `user_id_str`,
`conversation_id_str`, `username`, `tweet_url`, `image_url`, `location`,
`in_reply_to_screen_name`.

## Test

```bash
node --experimental-strip-types --test src/*.test.ts
```

## Catatan risiko

Menggunakan akun pribadi untuk scraping otomatis dapat menyebabkan akun
dikenakan pembatasan atau penangguhan. Rate limit X bersifat dinamis.
Struktur response internal X dapat berubah tanpa pemberitahuan, yang membuat
scraper berhenti bekerja sampai diperbaiki.
