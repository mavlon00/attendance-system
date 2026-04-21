# 🧪 COMPLETE TEST SCENARIOS

## Test Environment Setup

**Prerequisites**:
- Node server running: http://localhost:3000 ✅
- Browser DevTools open (F12)
- Console tab active for logging

---

## SCENARIO 1: ✅ SUCCESS - Student Within Classroom

### Setup
- **Lecturer**: Device A (desktop/mobile near window)
- **Student**: Device B (mobile <50m from Device A)
- **Both**: GPS permission ALLOWED

### Step-by-Step

#### LECTURER SIDE (Device A)
1. Open http://localhost:3000/index.html
2. Enter: Class Name = "GET222", Level = "200"
3. Click "Start Session"
4. Wait for GPS to acquire (⏳ then ✅)
5. Click **"✓ Enable GPS Tracking"**
6. Dashboard shows GPS coordinates and 100m radius

**Expected Console Output**:
```
✅ GPS Acquired: {latitude: 6.8456, longitude: 3.6789, accuracy: 5}
Active session: {..., gpsEnabled: true, gpsRadius: 100}
```

#### STUDENT SIDE (Device B)
1. Open QR code from lecturer dashboard OR http://localhost:3000/attend.html?token=ABC123...
2. Watch for GPS status: ⏳ Acquiring → ✅ Location acquired
3. Fill form:
   - Full Name: "John Doe"
   - Matric Number: "CME/01/001"
4. Click "Sign In"

**Expected Console Output**:
```
✅ GPS Acquired: {latitude: 6.8457, longitude: 3.6790, accuracy: 8}
```

#### SERVER CONSOLE (Your Computer)
```
╔══ ATTENDANCE SUBMISSION ══╗
📋 Raw Request Body: {
  "name": "John Doe",
  "matricNumber": "CME/01/001",
  "token": "abc123...",
  "studentGps": {
    "latitude": 6.8457,
    "longitude": 3.6790,
    "accuracy": 8
  },
  "deviceId": "device-1713699000000-abc123..."
}

📍 STEP 1: Field Validation
  Name: John Doe
  Matric: CME/01/001
  Token: abc123...
  Device ID: device-xxx...

📍 STEP 2: Session Validation
✅ Session found: abc123...
   GPS Enabled: true
   Lecturer Location: 6.8456, 3.6789
   Radius: 100

📍 STEP 3: Matric Duplicate Check
✅ Matric not yet submitted

📍 STEP 4: Device Duplicate Check
✅ Device not yet submitted

📍 STEP 5: GPS Validation
🔒 GPS validation is REQUIRED for this session

  5a. Student GPS Data Check:
      Raw studentGps: {latitude: 6.8457, longitude: 3.6790, accuracy: 8}
      Student Latitude: 6.8457 → 6.8457 (type: number)
      Student Longitude: 3.6790 → 3.6790 (type: number)
  ✅ Student GPS data is valid

  5b. Lecturer GPS Data Check:
      Raw lecturerGps: {latitude: 6.8456, longitude: 3.6789, ...}
      Lecturer Latitude: 6.8456 → 6.8456 (type: number)
      Lecturer Longitude: 3.6789 → 3.6789 (type: number)
  ✅ Lecturer GPS data is valid

  5c. Distance Calculation:
      📍 Distance calculation: (6.8456, 3.6789) → (6.8457, 3.6790) = 12.34m
      Distance: 12.34 meters
      Allowed Radius: 100 meters
      Result: ✅ WITHIN RADIUS

✅ GPS validation PASSED

📍 STEP 6: Creating Attendance Record
✅ Attendance recorded: 1
   Name: John Doe
   Matric: CME/01/001
   Department: Computer Engineering
   Time: 2024-04-21T10:30:00.000Z
╚════════════════════════╝
```

#### STUDENT SIDE - RESULT
```
Form: HIDDEN
Success Screen: VISIBLE showing "Welcome, John Doe!"
```

### PASS CRITERIA ✅
- Server console shows "✅ WITHIN RADIUS"
- Distance is 10-20m
- Student sees success page
- Attendance recorded in dashboard

---

## SCENARIO 2: ❌ FAILURE - Student Too Far Away

### Setup
- **Lecturer**: Device A (at specific GPS coordinates)
- **Student**: Device B (>150m away from Device A)
- **Distance**: ~250 meters

### Step-by-Step

#### LECTURER SIDE (Device A)
1. Same as Scenario 1 - Enable GPS Tracking
2. Dashboard shows: Latitude: 6.8456, Longitude: 3.6789

#### STUDENT SIDE (Device B)
1. Open same attendance link
2. Wait for GPS (≈2-5 seconds)
3. Fill form with same credentials
4. Click "Sign In"

**Expected Browser Alert**:
```
"You are not within the class location"
```

#### SERVER CONSOLE
```
📍 STEP 5c: Distance Calculation:
      📍 Distance calculation: (6.8456, 3.6789) → (6.9200, 3.7100) = 242.56m
      Distance: 242.56 meters
      Allowed Radius: 100 meters
      Result: ❌ OUTSIDE RADIUS

❌ GPS validation failed. Student is 242.56m away (radius: 100m)
```

### PASS CRITERIA ✅
- Server console shows "❌ OUTSIDE RADIUS"  
- Distance shown > 100m
- Student sees error notification
- Attendance NOT recorded

---

## SCENARIO 3: ⚠️ GPS PERMISSION DENIED

### Setup
- **Student**: Denies location permission on browser
- **Browser**: Blocks GPS access

### Step-by-Step

#### STUDENT SIDE
1. Open attendance link
2. Browser asks: "Allow location access?" → Click "Block"
3. Try to fill form and submit

**Expected UI Display**:
```
Status Icon: ❌
Status Text: "Location access DENIED - You cannot sign in"
Submit Button: DISABLED (grayed out, shows "Location Required (Denied)")
```

#### BROWSER CONSOLE
```
✗ GPS Error: 1 User denied geolocation prompt
```

#### RESULT
- Form cannot be submitted
- Server never receives attendance request

### PASS CRITERIA ✅
- UI prevents submission
- Button is disabled
- Clear error message shown

---

## SCENARIO 4: 📡 GPS STILL ACQUIRING (Slow Network/GPS)

### Setup
- **Student**: Just opened page
- **GPS**: Taking >2 seconds to respond
- **Student**: Tries to submit immediately

### Step-by-Step

#### STUDENT SIDE
1. Open attendance link
2. See: ⏳ "Acquiring location... (please wait)"
3. Immediately try clicking "Sign In" button

**Expected Response**:
```
Message: "Still acquiring location... Please wait a few seconds."
Form: STAYS OPEN (not submitted)
```

#### BROWSER CONSOLE
```
gpsAquired = false
```

#### RESULT
- Submission blocked
- User must wait 2-5 more seconds
- ✅ appears, then submission allowed

### PASS CRITERIA ✅
- Submission blocked while acquiring
- No premature GPS data sent
- User must wait for ✅

---

## SCENARIO 5: 🔄 DUPLICATE MATRIC SUBMISSION

### Setup
- **Student**: "John Doe" / "CME/01/001"
- **Session**: Already submitted once
- **Attempt**: Try to submit again

### Step-by-Step

#### STUDENT SIDE (Second Attempt)
1. Same student opens attendance link again
2. Fills form with SAME matric number: "CME/01/001"
3. Click "Sign In"

#### SERVER CONSOLE
```
📍 STEP 3: Matric Duplicate Check
❌ Duplicate matric submission: CME/01/001
```

### RESULT
- Error: "Attendance already submitted for this session by this matric number"
- Attendance NOT recorded twice
- Success page NOT shown

### PASS CRITERIA ✅
- No duplicate entries
- Clear error message
- Matric protection working

---

## SCENARIO 6: 🚫 DUPLICATE DEVICE SUBMISSION

### Setup
- **Device**: Same browser (Device A)
- **Session**: Same session
- **Attempt**: Different student, same device

### Step-by-Step

#### DEVICE A (First Submission)
- Student "John Doe" / "CME/01/001"
- Submit successfully

#### DEVICE A (Second Submission - Different Person)
1. Student "Jane Smith" / "CME/01/002"
2. Same device (localStorage persists device ID)
3. Click "Sign In"

#### SERVER CONSOLE
```
📍 STEP 4: Device Duplicate Check
❌ Device already submitted: device-1713699000000-abc123...
```

### RESULT
- Error: "Attendance already submitted from this device for this session"
- Attendance NOT recorded
- Device protection working

### PASS CRITERIA ✅
- Device-level duplicate prevention working
- Different matric numbers blocked from same device
- Security protection verified

---

## SCENARIO 7: 🧪 DEBUG ENDPOINT TEST

### Manual Test (No Submission)

#### Using PowerShell:

```powershell
# Get session token
$sessionData = irm http://localhost:3000/api/sessions/active
$token = $sessionData.session.id
$lecturerGps = $sessionData.session.lecturerGps

# Test with student 15 meters away
$testStudent = @{
    latitude = $lecturerGps.latitude + 0.000135
    longitude = $lecturerGps.longitude + 0.000135
    accuracy = 5
}

# Call debug endpoint
$result = @{
    token = $token
    studentGps = $testStudent
} | ConvertTo-Json

irm http://localhost:3000/api/debug/gps-check `
    -Method Post `
    -ContentType "application/json" `
    -Body $result | ConvertTo-Json | Write-Host
```

#### Expected Response:
```json
{
  "gpsEnabled": true,
  "studentGpsValid": true,
  "studentLocation": [6.8457, 3.6790],
  "lecturerLocation": [6.8456, 3.6789],
  "distance": 15,
  "radius": 100,
  "withinRadius": true,
  "message": "✅ Student is within the classroom range"
}
```

### PASS CRITERIA ✅
- Debug endpoint works
- Distance calculated correctly
- No false positives/negatives
- Safe to test without blocking attendance

---

## QUICK REFERENCE: CONSOLE GREP

### On Server Console
Look for these strings to understand status:

```
✅ WITHIN RADIUS          = Student should be accepted
❌ OUTSIDE RADIUS         = Student should be rejected
📍 Distance calculation   = Distance math being performed
(type: number)            = Confirms coordinates are numbers
isNaN                     = If seen, data type mismatch
Infinity                  = Invalid GPS data (NaN caused math error)
```

### On Student Browser Console
```
✅ GPS Acquired           = GPS ready, can submit
✗ GPS Error              = Permission denied
⏳ Acquiring location     = GPS not ready yet
❌ User denied            = Browser location blocked
```

---

## DEBUGGING FLOWCHART

```
START
│
├─ Student sees ⏳ icon?
│  ├─ NO → Check GPS permission in browser settings 🔒
│  └─ YES → Wait for ✅
│
├─ Student sees ✅ icon?
│  ├─ NO → Wait 5 more seconds
│  └─ YES → Can submit
│
├─ Submit form
│  ├─ "Still acquiring..." → Wait more
│  ├─ "Location not available" → Refresh page
│  └─ "Attendance submitted!" → Check server console
│
└─ Check server console for Step 5c distance
   ├─ Distance is NUMBER? (not NaN, not Infinity)
   │  ├─ YES → Distance calculation working! ✅
   │  └─ NO → Type mismatch (string/undefined) ❌
   │
   ├─ Distance reasonable? (<100m for same building)
   │  ├─ YES → GPS coordinates are accurate
   │  └─ NO → Test devices too far apart
   │
   └─ Result: ✅ WITHIN or ❌ OUTSIDE?
      ├─ ✅ WITHIN → Acceptance working ✅
      └─ ❌ OUTSIDE → Rejection working ✅
```

---

## FINAL VERIFICATION CHECKLIST

- [ ] Server starts without errors
- [ ] Lecturer can enable GPS tracking
- [ ] Student sees GPS status (⏳ then ✅)
- [ ] Server console shows Step 1-6 logging
- [ ] Distance shown as NUMBER (not NaN)
- [ ] Student within 50m: Accepted ✅
- [ ] Student >100m away: Rejected ✅
- [ ] Debug endpoint returns correct distance
- [ ] Duplicate matric blocked
- [ ] Duplicate device blocked
- [ ] GPS permission denied properly handled

---

✅ **Ready to test!**
