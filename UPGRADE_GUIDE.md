# Attendance System v2.0 - Upgrade Guide

## Overview
This document details the upgrades made to the attendance system while maintaining full backward compatibility with existing deployments.

---

## 🎯 Feature 1: GPS Location Validation

### Technical Implementation

**Server-Side (`server.js`)**
```javascript
// Haversine distance calculation
calculateDistance(lat1, lon1, lat2, lon2)
// Returns: distance in meters

// GPS radius validation
isWithinGpsRadius(studentGps, lecturerGps, radius)
// Returns: boolean (true if student is within radius)

// Session object now stores:
{
  lecturerGps: {
    latitude: number,
    longitude: number,
    timestamp: ISO8601
  },
  gpsRadius: number (default: 50)
}
```

**Client-Side (`student.js`)**
```javascript
// Capture student location
navigator.geolocation.getCurrentPosition()
// Submits: { studentGps: { latitude, longitude, accuracy } }
```

**Lecturer Side (`lecturer.js`)**
```javascript
// GPS is requested on page load
// Toggle available before session starts: "Enable GPS Tracking" button
// GPS Radius input: 10-500 meters (default: 50)
```

### Endpoint Changes

**POST /api/sessions/start**
- New parameters: `lecturerGps`, `gpsRadius` (optional)
- Response includes: `gpsEnabled: boolean`

**POST /api/attendance**
- New parameters: `studentGps`, `deviceId` (optional)
- Validation logic:
  1. Check session is active
  2. Check matric not duplicate (existing)
  3. Check device not duplicate (new)
  4. If GPS enabled: validate distance
  5. If GPS denied: return 403 "Location permission required"
  6. If outside radius: return 403 with distance info

**GET /api/sessions/active**
- Response includes: `gpsEnabled: boolean`, `gpsRadius: number`

### Error Messages

| Scenario | HTTP Status | Message |
|----------|----------|---------|
| GPS denied by user | 403 | "Location permission required" |
| Outside GPS radius | 403 | "You are not within the class location" (includes distance) |
| Session invalid | 400 | "Invalid or inactive session" |

---

## 🎯 Feature 2: Lecturer Session Control

### Session States
- **active**: Session is live, accepts submissions
- **closed**: Session ended, rejects submissions

### Endpoints

**POST /api/sessions/end**
- Closes active session
- Any pending submissions rejected
- Automatically called when "End Session" button clicked

### UI Changes
- Session status displays as badge: "Session in Progress"
- Dashboard includes "End Session" button (with confirmation)
- GPS info displayed when GPS enabled

---

## 🎯 Feature 3: Device + Duplicate Protection

### Device Tracking
- Device ID generated on first visit: `localStorage.attendanceDeviceId`
- Format: `device-{timestamp}-{randomString}`
- Persists across page refreshes (same browser/device)
- Unique per browser/domain

### Validation Logic
```javascript
// Both checks required:
1. Matric duplicate: attendance.find(a => a.session_id === token && a.matric_number === matricNumber)
2. Device duplicate: attendance.find(a => a.session_id === token && a.deviceId === deviceId)
```

### Storage
```javascript
attendance record includes:
{
  id: number,
  session_id: string,
  class_id: string,
  name: string,
  matric_number: string,
  department: string,
  timestamp: ISO8601,
  studentGps: { latitude, longitude, accuracy } // optional
  deviceId: string // optional
}
```

---

## 🎯 Feature 4: QR Code Stability

### URL Format
```
https://attendance-system-1-eusi.onrender.com/attend.html?token={sessionId}
```

### Requirements Met
✓ No localhost references (all production URL)
✓ HTTPS only (secure for mobile)
✓ QR scannable and clickable via mobile browser
✓ Token-based session identification
✓ Public folder routes to static assets

### Production Deployment
- `BASE_URL` set to Render deployment URL
- Can be updated via environment variable if needed
- All API endpoints use relative paths (inherited from BASE_URL)

---

## 🎯 Feature 5: Fail-Safe Behavior

### Error Handling Matrix

| Condition | Prevention | User Sees |
|-----------|-----------|-----------|
| GPS denied | Block at form submission | "Location permission required" |
| GPS outside radius | Reject API | "You are not within the class location" + distance |
| Session ended | Reject API | "Invalid or inactive session" |
| Matric duplicate | Reject API | "Attendance already submitted for this session by this matric number" |
| Device duplicate | Reject API | "Attendance already submitted from this device for this session" |
| Session invalid | Reject API | "Invalid or inactive session" |

### Graceful Degradation
- If GPS is not available: works without GPS (if lecturer didn't enable)
- If localStorage unavailable: device check skipped (matric check still works)
- If QR code fails: URL can be copied and shared manually
- If session closes: students see clear error instead of silent rejection

---

## 🔄 Backward Compatibility

### Breaking Changes
**None.** All changes are additive.

### Existing Functionality Preserved
- ✓ Matric number validation
- ✓ Department extraction from matric
- ✓ QR code generation
- ✓ Dashboard live updates
- ✓ History tracking
- ✓ Grading system
- ✓ Session management
- ✓ Class tracking

### Optional Features
- GPS tracking is **optional** - lecturers choose whether to enable
- Device protection is **optional** - transparently added
- Sessions without GPS work exactly as before

---

## 📊 Data Storage

### In-Memory (Server Restart Clears)
```javascript
classes []        // Class metadata
sessions []       // Active/closed sessions with possible GPS data
attendance []     // Attendance records with optional GPS/device data
```

### Browser Storage (Persistent)
```javascript
localStorage.attendanceDeviceId  // Device ID (per browser)
```

### No External Database Required
- Existing SQLite setup optional (not used by default)
- Can be integrated later without code changes

---

## 🚀 Deployment Steps

### 1. Before Deployment
```bash
npm install  # Ensure dependencies are installed
npm start    # Test locally
```

### 2. Testing Checklist
- [ ] Lecturer can start session with GPS enabled
- [ ] GPS coordinates display on dashboard
- [ ] Student sees GPS permission request
- [ ] Student outside radius gets error
- [ ] Student inside radius accepted
- [ ] Device duplicate rejected
- [ ] Session end prevents new submissions
- [ ] QR code scans to production URL
- [ ] History tracking still works

### 3. Production Deployment (Render)
- Push code to repository
- Render automatically deploys
- No environment variables needed (defaults work)
- Server port automatically detected from environment

---

## 🧪 Testing Scenarios

### Scenario 1: Basic GPS Attendance
1. Lecturer opens app, enables GPS
2. Student scans QR near instructor
3. Student signs in successfully
4. **Expected**: Attendance recorded

### Scenario 2: GPS Radius Rejection
1. Lecturer sets 50m radius GPS session
2. Student opens app 100m away
3. Student attempts to sign in
4. **Expected**: Error "You are not within the class location"

### Scenario 3: Device Duplicate Prevention
1. Student 1 signs in from phone
2. Same student tries to sign in again from same phone
3. **Expected**: Error "Attendance already submitted from this device"

### Scenario 4: Session Ended
1. Lecturer starts session, some students sign in
2. Lecturer clicks "End Session"
3. New student tries to scan QR code and sign in
4. **Expected**: Error "Invalid or inactive session"

### Scenario 5: No GPS (Optional)
1. Lecturer starts session WITHOUT enabling GPS
2. Student opens app, denies location permission
3. Student signs in successfully
4. **Expected**: Attendance recorded (GPS not required)

---

## 🔧 Configuration Options

### Lecturer-Configurable
- GPS Radius: 10-500 meters (default: 50)
- GPS Enabled: toggle button (yes/no)
- Class Name: any text
- Class Level: any text

### System-Level (Code changes)
- Default GPS radius: `50` meters (in server.js)
- Polling interval: `3000` ms (in lecturer.js)
- Device ID format: customizable (in student.js)
- Base URL: `https://attendance-system-1-eusi.onrender.com`

---

## 📝 API Reference

### POST /api/sessions/start
```json
Request: {
  "className": "GET 222",
  "level": "200",
  "lecturerGps": { "latitude": -1.234, "longitude": 36.789 },
  "gpsRadius": 50
}

Response: {
  "success": true,
  "sessionId": "uuid",
  "qrDataUrl": "data:image/png;...",
  "className": "GET 222",
  "level": "200",
  "gpsEnabled": true
}
```

### POST /api/attendance
```json
Request: {
  "name": "John Doe",
  "matricNumber": "CME/20/1234",
  "token": "sessionId",
  "studentGps": { "latitude": -1.234, "longitude": 36.789, "accuracy": 5 },
  "deviceId": "device-123456-abc"
}

Response (Success): {
  "success": true,
  "name": "John Doe",
  "department": "Computer Engineering"
}

Response (GPS Error): {
  "error": "You are not within the class location",
  "distance": 75,
  "radius": 50
}
```

### GET /api/sessions/active
```json
Response: {
  "session": {
    "id": "uuid",
    "class_name": "GET 222",
    "level": "200",
    "status": "active",
    "lecturerGps": { "latitude": -1.234, "longitude": 36.789 },
    "gpsRadius": 50
  },
  "qrDataUrl": "data:image/png;...",
  "gpsEnabled": true,
  "gpsRadius": 50
}
```

---

## ✅ Verification Checklist

- [x] GPS distance calculation implemented (Haversine)
- [x] Session GPS data stored correctly
- [x] Student GPS captured and validated
- [x] Device ID generation and tracking
- [x] Error messages per spec
- [x] Production URL configured
- [x] Session active/closed status enforced
- [x] QR code uses production URL
- [x] No localhost references
- [x] Backward compatibility maintained
- [x] All existing endpoints work unchanged
- [x] In-memory storage preserved
- [x] Dashboard displays GPS info when enabled

---

## 📞 Support & Troubleshooting

### GPS Permission Denied
- Ensure browser allows location access (check browser settings)
- Refresh page and try again
- HTTPS required for Geolocation API

### QR Not Scanning
- Ensure HTTPS (Render uses HTTPS by default)
- Try opening link manually: `https://attendance-system-1-eusi.onrender.com/attend.html?token=[sessionId]`
- Test QR code scanner on device

### Device ID Not Persisting
- Ensure localStorage enabled in browser
- Private/Incognito mode may not persist
- Different browsers have different device IDs

### Session Not Ending
- Check browser console for errors
- Ensure "End Session" button is clicked and confirmed
- Refresh page to reload session state
