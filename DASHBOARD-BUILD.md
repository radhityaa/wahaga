# 🔧 Dashboard Build Guide

Panduan untuk build dan deploy dashboard React ke server Express.

---

## ⚠️ Masalah Umum: Dashboard Blank / 404

Jika dashboard tampil blank dengan error di console browser:

```
net::ERR_ABORTED 404 (Not Found)
Refused to apply style ... MIME type ('application/json') is not a supported stylesheet MIME type
```

**Penyebab:** Dashboard di-build tanpa `NODE_ENV=production`, sehingga base path asset salah.

### Penjelasan

File `dashboard/vite.config.js` menggunakan konfigurasi:

```js
base: process.env.NODE_ENV === 'production' ? '/dashboard/' : '/',
```

- **Tanpa production**: asset di-reference sebagai `/assets/...` → **tidak ditemukan** oleh Express
- **Dengan production**: asset di-reference sebagai `/dashboard/assets/...` → **benar**

Ketika file tidak ditemukan, Express mengembalikan JSON error (404), sehingga browser menolak file CSS karena MIME type `application/json`.

---

## 📋 Step by Step: Build Dashboard

### 1. Masuk ke folder dashboard

```bash
cd dashboard
```

### 2. Install dependencies (jika belum)

```bash
npm install
```

### 3. Build dengan NODE_ENV=production

**Windows (PowerShell):**

```powershell
$env:NODE_ENV="production"; npx vite build
```

**Windows (CMD):**

```cmd
set NODE_ENV=production && npx vite build
```

**Linux/Mac:**

```bash
NODE_ENV=production npx vite build
```

### 4. Verifikasi hasil build

Pastikan file `dashboard/dist/index.html` memiliki path dengan prefix `/dashboard/`:

```html
<!-- ✅ BENAR -->
<script src="/dashboard/assets/index-XXXXX.js"></script>
<link href="/dashboard/assets/index-XXXXX.css">

<!-- ❌ SALAH (tanpa /dashboard/) -->
<script src="/assets/index-XXXXX.js"></script>
<link href="/assets/index-XXXXX.css">
```

### 5. Copy hasil build ke public/dashboard

**Windows (PowerShell):**

```powershell
Remove-Item -Recurse -Force "..\public\dashboard\*"
Copy-Item -Recurse -Force "dist\*" "..\public\dashboard\"
```

**Linux/Mac:**

```bash
rm -rf ../public/dashboard/*
cp -r dist/* ../public/dashboard/
```

### 6. Restart server

```bash
# Jika pakai nodemon (development), otomatis restart
# Jika pakai PM2 (production):
pm2 restart whatsapp-gateway
```

### 7. Akses dashboard

Buka browser: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

---

## 🔄 Quick Command (All-in-One)

### Windows PowerShell

```powershell
cd dashboard
npm install
$env:NODE_ENV="production"; npx vite build
Remove-Item -Recurse -Force "..\public\dashboard\*"
Copy-Item -Recurse -Force "dist\*" "..\public\dashboard\"
cd ..
```

### Linux/Mac

```bash
cd dashboard
npm install
NODE_ENV=production npx vite build
rm -rf ../public/dashboard/*
cp -r dist/* ../public/dashboard/
cd ..
```

---

## 📁 Struktur File

```
wahaga/
├── dashboard/              # Source code dashboard (React + Vite)
│   ├── src/                # React source files
│   ├── dist/               # Hasil build (jangan edit manual)
│   │   ├── index.html
│   │   └── assets/
│   │       ├── index-XXXXX.js
│   │       └── index-XXXXX.css
│   ├── vite.config.js      # Konfigurasi Vite (base path)
│   └── package.json
│
├── public/
│   └── dashboard/          # File yang di-serve oleh Express
│       ├── index.html      # Copy dari dist/index.html
│       └── assets/         # Copy dari dist/assets/
│
└── src/
    └── app.js              # Express serve: /dashboard -> public/dashboard
```

### Alur Request

```
Browser: GET /dashboard
    → Express: express.static('public/dashboard')
    → public/dashboard/index.html
    → Browser load: /dashboard/assets/index-XXXXX.js
    → Express: express.static('public/dashboard') match /assets/index-XXXXX.js
    → ✅ File ditemukan, dashboard tampil
```

---

## ❓ Troubleshooting

### Dashboard masih blank setelah build

1. **Cek file di `public/dashboard/assets/`** — pastikan file JS dan CSS ada
2. **Cek `public/dashboard/index.html`** — pastikan path menggunakan `/dashboard/assets/...`
3. **Clear browser cache** — tekan `Ctrl+Shift+R` atau buka di Incognito
4. **Restart server** — pastikan Express membaca file terbaru

### Error "npm install" gagal

```bash
# Hapus node_modules dan install ulang
rm -rf node_modules package-lock.json
npm install
```

### Port 3000 sudah digunakan

```powershell
# Windows: cari proses yang pakai port 3000
netstat -ano | findstr :3000

# Kill proses (ganti PID dengan ID yang ditemukan)
taskkill /PID <PID> /F
```
