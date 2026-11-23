# GNBVG — G. Narayanamma Balikala Vasathi Gruham
### G. Pulla Reddy Engineering College (Autonomous), Kurnool
**100% Cloud-Free Local Biometric FRS & GPS Geofenced Hostel Management System**

---

## 🌟 Overview

The GNBVG Hostel Portal is a self-contained, enterprise-grade residence safety and daily evening attendance system built specifically for G. Pulla Reddy Engineering College (GPREC), Kurnool. It runs completely locally with **zero external cloud, Firebase, or third-party API dependencies**.

All data is stored permanently on disk in SQLite (`database/gnbvg.db`), persisting seamlessly across server reboots, power cuts, and multi-year academic sessions.

---

## 🚀 Quick Start (Production on Port 5000)

### 1. Install & Build
```bash
# Install dependencies
npm install

# Build client and server bundles
npm run build
```

### 2. Launch Local Server
```bash
npm start
```

The system will start on **port 5000**:
- **Application URL:** [http://localhost:5000](http://localhost:5000)
- **Direct Portal View:** [http://localhost:5000/hostel](http://localhost:5000/hostel)
- **Permanent Database:** `./database/gnbvg.db`
- **Bundled Face Models:** `./client/public/models/`

---

## 🔑 Default Seed Credentials

| Role | Email / Identifier | Password | Access Level |
|---|---|---|---|
| **Chief Warden** | `warden.gnbvg@gprec.ac.in` | `Warden@123` | Full Warden Dashboard & Reports |
| **Warden Backup** | `warden@gprec.ac.in` | `Warden@123` | Multi-block Operations |
| **Administrator** | `admin.hostel@gprec.ac.in` | `Warden@123` | Academic Rollover & System Config |
| **Resident Student** | Any Admitted Roll Number (e.g. `249X1A0504`) | `Student@123` | FRS Attendance, Outpasses, Tickets |

---

## 📱 Mobile Attendance via Cloudflare Tunnel (4G/5G & Wi-Fi)

To allow hostellers to mark evening attendance from their smartphones using **Mobile Data (Jio/Airtel 4G/5G)** or **Hostel Wi-Fi**, modern mobile browsers require an **HTTPS** connection to access the camera (`getUserMedia`) and GPS geolocation (`navigator.geolocation`).

You can securely expose local port `5000` to the internet with **Cloudflare Tunnel (100% Free, Zero Port Forwarding)**:

### Step 1: Download Cloudflared
- **Windows (PowerShell):**
  ```powershell
  winget install --id Cloudflare.cloudflared
  ```
  *(Or download the binary directly from [Cloudflare Releases](https://github.com/cloudflare/cloudflared/releases))*

- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt install cloudflared
  ```

### Step 2: Start Tunnel
Run this single command in a terminal while `npm start` is running:
```bash
cloudflared tunnel --url http://localhost:5000
```

### Step 3: Share the Generated HTTPS Link
Cloudflare will output a secure public URL like:
```text
https://gnbvg-hostel-kurnool.trycloudflare.com
```
Students can open this link on their phones, log in with their Roll Number or College Email, and mark their biometric FRS and GPS attendance inside their residential wing.

---

## 🔄 24/7 Production Deployment with PM2

To ensure the server runs continuously in the background and restarts automatically if the computer reboots:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Start the GNBVG backend server on port 5000
pm2 start server/index.js --name "gnbvg-hostel"

# 3. Check status & logs
pm2 status
pm2 logs gnbvg-hostel

# 4. Save PM2 state to auto-launch on Windows/Linux boot
pm2 save
pm2 startup
```

---

## 🧠 Biometric Face Recognition Architecture

- **Engine:** `@vladmandic/face-api` (TensorFlow.js)
- **Local Model Weights:** Bundled permanently in `client/public/models/`:
  - `tiny_face_detector_model`
  - `face_landmark_68_model`
  - `face_recognition_model` (Extracts 128-dimensional biometric embeddings)
- **Enrollment (`POST /api/students/enroll-face`):** Captures the student's 128-point face descriptor via webcam and saves it permanently to `users.face_descriptor`.
- **Attendance Verification (`POST /api/attendance/mark`):**
  1. **Euclidean Distance:** Calculates Euclidean distance between live face and stored descriptor:
     $$\text{dist} = \sqrt{\sum_{i=0}^{127} (d_{\text{live}}[i] - d_{\text{enrolled}}[i])^2}$$
     Attendance is strictly accepted only when $\text{dist} < 0.45$.
  2. **GPS Geofence:** Calculates Haversine distance between phone GPS and the student's assigned block (`Anapurna-A`, `Arundhathi-B`, `Anuradha-C`). Attendance is rejected if distance exceeds `radius_meters` (default 150m).

---

## 🎓 Annual Academic Batch Rollover

At the start of each new academic year, the Chief Warden or Admin can execute the **Promote Academic Batch** operation with 1 click:
- `POST /api/warden/promote-batch`
- **Batch Progression:**
  - `4th Year` $\to$ `Alumni`
  - `3rd Year` $\to$ `4th Year`
  - `2nd Year` $\to$ `3rd Year`
  - `1st Year` $\to$ `2nd Year`
- All historical attendance, leaves, and biometric descriptors remain safely archived on disk.

---

## 🛡️ Privacy & Compliance

- **Zero Cloud Leakage:** All face embeddings, passwords (hashed with bcrypt), parent contacts, and GPS readings reside exclusively inside `./database/gnbvg.db`.
- **Domain Whitelist:** Registration is restricted to official institutional emails ending with `@gprec.ac.in`.
