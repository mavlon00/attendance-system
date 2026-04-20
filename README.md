# University Class Attendance System (Demo)

A full-stack web application designed for university lecturers to manage class attendance cleanly and efficiently. Built without heavy frameworks for maximum simplicity and portability.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js installed on your machine.
- No database installation required (uses built-in SQLite).

### 2. Installation
Open your terminal in the project directory and run:
```bash
npm install
```

### 3. Running the Server
```bash
npm start
```
*Note: If `npm start` is not defined, simply run:*
```bash
node server.js
```
The server will start at `http://localhost:3000`.

## 📱 How to Use

### Lecturer Flow
1. Open `http://localhost:3000` in your browser.
2. The system will request your location (for GPS tracking).
3. Enter the **Class Title** (e.g., `GET 222`) and **Course Level** (e.g., `200`).
4. **(Optional)** Enable GPS tracking:
   - Click **"✓ Enable GPS Tracking"** to require students to be within a certain radius.
   - Set a custom **GPS Radius** (default: 50 meters).
5. Click **"Create & Start Session"**. A unique QR code will be generated.
6. The dashboard will go live, showing:
   - **GPS Info** (if enabled): Session coordinates and radius.
   - Total students checked in.
   - A breakdown of attendance grouped by **Department**.
   - A live log of every sign-in.
7. Click **"End Session"** when the class is over (no more submissions allowed after).

### Student Flow
1. Students scan the QR code or visit the copied quick link.
2. The system requests their location (if GPS is enabled for the session).
3. They enter their **Full Name** and **Matriculation Number** (e.g., `CME/20/1230`).
4. The system checks:
   - ✓ GPS distance (if enabled) - must be within the lecturer's set radius.
   - ✓ Matric duplicate - cannot submit twice with same ID.
   - ✓ Device duplicate - cannot submit twice from the same device.
5. The system automatically detects their department based on the matric prefix:
   - `CME` → Computer Engineering
   - `CHE` → Chemical Engineering
   - `EEE` → Electrical Engineering
6. Upon successful submission, a confirmation screen displays the extracted department.

## 🎯 New Features (v2.0)

### 📍 GPS-Based Location Validation
- Lecturers can enable GPS tracking for enhanced security.
- Students must be within the configured radius (default: 50m) to mark attendance.
- Automatic distance calculation using Haversine formula.
- Error messages guide users if they are outside the class location.

### 🔐 Enhanced Duplication Prevention
- **Matric Check**: Prevents the same student ID from submitting twice per session.
- **Device Check**: Prevents attendance from the same device twice per session.
- **Session Control**: Only active sessions accept attendance; closed sessions reject submissions.

### 🎨 Improved Session Control
- Lecturers can toggle GPS tracking before session starts.
- All sessions display status (active/closed) in real-time.
- GPS coordinates and radius visible on the lecturer dashboard.

### 📱 Mobile-First QR Codes
- All QR codes link to the production URL (no localhost).
- Mobile students can submit attendance with full GPS validation.
- Device fingerprinting ensures authentic submissions.

## 🛠 Tech Stack
- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML, CSS (Glassmorphism UI), JavaScript
- **Geolocation**: Browser Geolocation API
- **Libraries**:
  - `qrcode` (for QR tag generation)
  - `uuid` (for session token IDs)
  - `cors` (for cross-origin requests)

## 💾 Data Storage
- **Session Data**: In-memory (server resets on restart)
- **Attendance Records**: Persisted in-memory during server runtime
- **Device IDs**: Stored in browser localStorage
- **No external database required** for core functionality
