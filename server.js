const express = require('express');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = "https://attendance-system-1-eusi.onrender.com";

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- In-Memory Data Storage ---
let classes = [];     // { id, class_name, level, created_at }
let sessions = [];    // { id, class_id, class_name, level, status, created_at, lecturerGps, gpsRadius }
let attendance = [];  // { id, session_id, class_id, name, matric_number, department, timestamp, studentGps, deviceId }
let attendanceIdCounter = 1;
let deviceSessions = {}; // Track device-session combinations for duplicate prevention

// Helper to determine department from matric correctly (embedded format)
function getDepartment(matricNo) {
    if (!matricNo) return 'Other';
    const normalized = matricNo.toUpperCase().replace(/\s+/g, '');
    
    // Regex rule: /^[A-Z]+/([A-Z]{2,4})/\d{2}/\d+$/
    const regex = /^[A-Z]+\/([A-Z]{2,4})\/\d{2}\/\d+$/;
    const match = normalized.match(regex);
    
    if (!match) return 'Other';
    
    const deptCode = match[1];
    
    const deptMap = {
        'CME': 'Computer Engineering',
        'CHE': 'Chemical Engineering',
        'EEE': 'Electrical/Electronics Engineering'
    };
    
    return deptMap[deptCode] || 'Other';
}

// Helper to calculate distance between two GPS coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    // Ensure all values are numbers
    lat1 = Number(lat1);
    lon1 = Number(lon1);
    lat2 = Number(lat2);
    lon2 = Number(lon2);
    
    // Validate inputs
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.error('❌ Invalid coordinates for distance calculation:', { lat1, lon1, lat2, lon2 });
        return Infinity;
    }
    
    const R = 6371000; // Earth's radius in meters
    
    // Convert degrees to radians
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    // Haversine formula
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    console.log(`📍 Distance calculation: (${lat1}, ${lon1}) → (${lat2}, ${lon2}) = ${distance.toFixed(2)}m`);
    return distance;
}

// Helper to validate GPS is within session radius
function isWithinGpsRadius(studentGps, lecturerGps, radius) {
    console.log('\n=== GPS VALIDATION START ===');
    console.log('📌 Lecturer GPS:', lecturerGps);
    console.log('📱 Student GPS:', studentGps);
    console.log('⭕ Radius requirement:', radius, 'meters');
    
    // Validate student GPS
    if (!studentGps) {
        console.error('❌ Student GPS is null/undefined');
        return false;
    }
    
    const studentLat = Number(studentGps.latitude);
    const studentLng = Number(studentGps.longitude);
    
    if (isNaN(studentLat) || isNaN(studentLng)) {
        console.error('❌ Student GPS has invalid coordinates:', { 
            lat: studentGps.latitude, 
            lng: studentGps.longitude 
        });
        return false;
    }
    
    // Validate lecturer GPS
    if (!lecturerGps) {
        console.error('❌ Lecturer GPS is null/undefined');
        return false;
    }
    
    const lecturerLat = Number(lecturerGps.latitude);
    const lecturerLng = Number(lecturerGps.longitude);
    
    if (isNaN(lecturerLat) || isNaN(lecturerLng)) {
        console.error('❌ Lecturer GPS has invalid coordinates:', { 
            lat: lecturerGps.latitude, 
            lng: lecturerGps.longitude 
        });
        return false;
    }
    
    const distance = calculateDistance(lecturerLat, lecturerLng, studentLat, studentLng);
    const isWithin = distance <= radius;
    
    console.log(`\n📊 Result: Distance ${distance.toFixed(2)}m vs Radius ${radius}m = ${isWithin ? '✅ PASS' : '❌ FAIL'}`);
    console.log('=== GPS VALIDATION END ===\n');
    
    return isWithin;
}

// --- API Endpoints ---

// Start a new session (with optional GPS capture from lecturer)
app.post('/api/sessions/start', async (req, res) => {
    const { className, level, lecturerGps, gpsRadius } = req.body;
    if (!className || !level) {
        return res.status(400).json({ error: 'Class name and level are required' });
    }

    try {
        // Close existing active sessions
        sessions.forEach(s => {
            if (s.status === 'active') s.status = 'closed';
        });
        
        let classRecord = classes.find(c => c.class_name === className && c.level === level);
        let classId;

        if (classRecord) {
            classId = classRecord.id;
        } else {
            classId = uuidv4();
            classes.push({
                id: classId,
                class_name: className,
                level: level,
                created_at: new Date().toISOString()
            });
        }
        
        const sessionId = uuidv4();
        const session = {
            id: sessionId,
            class_id: classId,
            class_name: className,
            level: level,
            status: 'active',
            created_at: new Date().toISOString()
        };
        
        // Add GPS tracking if provided
        if (lecturerGps && typeof lecturerGps.latitude === 'number' && typeof lecturerGps.longitude === 'number') {
            session.lecturerGps = {
                latitude: lecturerGps.latitude,
                longitude: lecturerGps.longitude,
                timestamp: new Date().toISOString()
            };
            session.gpsRadius = gpsRadius || 100; // Default 100 meters (generous for real-world GPS accuracy)
        }
        
        sessions.push(session);
        
        const qrUrl = `${BASE_URL}/attend.html?token=${sessionId}`;
        const qrDataUrl = await qrcode.toDataURL(qrUrl);
        
        res.json({ success: true, sessionId, qrDataUrl, className, level, gpsEnabled: !!session.lecturerGps });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// End current session
app.post('/api/sessions/end', (req, res) => {
    sessions.forEach(s => {
        if (s.status === 'active') s.status = 'closed';
    });
    res.json({ success: true });
});

// Get active session (includes GPS info for mobile verification)
app.get('/api/sessions/active', async (req, res) => {
    try {
        const activeSession = sessions.find(s => s.status === 'active');
        if (activeSession) {
            const qrUrl = `${BASE_URL}/attend.html?token=${activeSession.id}`;
            const qrDataUrl = await qrcode.toDataURL(qrUrl);
            
            console.log('Active session:', {
                sessionId: activeSession.id,
                gpsEnabled: !!activeSession.lecturerGps,
                lecturerGps: activeSession.lecturerGps,
                gpsRadius: activeSession.gpsRadius
            });
            
            res.json({ 
                session: activeSession, 
                qrDataUrl,
                gpsEnabled: !!activeSession.lecturerGps,
                gpsRadius: activeSession.gpsRadius || 100
            });
        } else {
            res.json({ session: null, gpsEnabled: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit attendance with GPS and device validation
app.post('/api/attendance', (req, res) => {
    console.log('\n\n╔══ ATTENDANCE SUBMISSION ══╗');
    console.log('📋 Raw Request Body:', JSON.stringify(req.body, null, 2));
    
    const { name, matricNumber, token, studentGps, deviceId } = req.body;
    
    // Step 1: Validate required fields
    console.log('\n📍 STEP 1: Field Validation');
    console.log('  Name:', name || '❌ MISSING');
    console.log('  Matric:', matricNumber || '❌ MISSING');
    console.log('  Token:', token ? token.substring(0, 8) + '...' : '❌ MISSING');
    console.log('  Device ID:', deviceId || '⚠️  not provided');
    
    if (!name || !matricNumber || !token) {
        console.error('❌ Missing required fields');
        return res.status(400).json({ error: 'Name, matric number, and token are required' });
    }

    // Step 2: Validate session exists and is active
    console.log('\n📍 STEP 2: Session Validation');
    const session = sessions.find(s => s.id === token && s.status === 'active');
    if (!session) {
        console.error('❌ Session not found or inactive:', token);
        return res.status(400).json({ error: 'Invalid or inactive session' });
    }
    console.log('✅ Session found:', session.id);
    console.log('   GPS Enabled:', !!session.lecturerGps);
    console.log('   Lecturer Location:', session.lecturerGps? `${session.lecturerGps.latitude}, ${session.lecturerGps.longitude}` : 'N/A');
    console.log('   Radius:', session.gpsRadius || 'N/A');

    // Step 3: Check matric duplicate
    console.log('\n📍 STEP 3: Matric Duplicate Check');
    const existing = attendance.find(a => a.session_id === token && a.matric_number === matricNumber);
    if (existing) {
        console.error('❌ Duplicate matric submission:', matricNumber);
        return res.status(400).json({ error: 'Attendance already submitted for this session by this matric number' });
    }
    console.log('✅ Matric not yet submitted');

    // Step 4: Check device duplicate
    console.log('\n📍 STEP 4: Device Duplicate Check');
    if (deviceId) {
        const deviceSubmitted = attendance.find(a => a.session_id === token && a.deviceId === deviceId);
        if (deviceSubmitted) {
            console.error('❌ Device already submitted:', deviceId);
            return res.status(400).json({ error: 'Attendance already submitted from this device for this session' });
        }
        console.log('✅ Device not yet submitted');
    } else {
        console.warn('⚠️  No device ID provided');
    }

    // Step 5: GPS Validation (if session has GPS enabled)
    console.log('\n📍 STEP 5: GPS Validation');
    if (session.lecturerGps) {
        console.log('🔒 GPS validation is REQUIRED for this session');
        
        // Validate student GPS data
        console.log('\n  5a. Student GPS Data Check:');
        console.log('      Raw studentGps:', studentGps);
        
        if (!studentGps) {
            console.error('  ❌ Student GPS is NULL');
            return res.status(403).json({ error: 'Location permission required' });
        }
        
        if (!studentGps.latitude || !studentGps.longitude) {
            console.error('  ❌ Student GPS missing lat/lon:', studentGps);
            return res.status(403).json({ error: 'Location permission required' });
        }
        
        // Convert to numbers and validate
        const studentLat = Number(studentGps.latitude);
        const studentLng = Number(studentGps.longitude);
        
        console.log(`      Student Latitude: ${studentGps.latitude} → ${studentLat} (type: ${typeof studentLat})`);
        console.log(`      Student Longitude: ${studentGps.longitude} → ${studentLng} (type: ${typeof studentLng})`);
        
        if (isNaN(studentLat) || isNaN(studentLng)) {
            console.error('  ❌ Student GPS coordinates are not valid numbers');
            return res.status(403).json({ error: 'Invalid location data' });
        }
        
        console.log('  ✅ Student GPS data is valid');
        
        // Validate lecturer GPS data
        console.log('\n  5b. Lecturer GPS Data Check:');
        console.log('      Raw lecturerGps:', session.lecturerGps);
        
        const lecturerLat = Number(session.lecturerGps.latitude);
        const lecturerLng = Number(session.lecturerGps.longitude);
        
        console.log(`      Lecturer Latitude: ${session.lecturerGps.latitude} → ${lecturerLat} (type: ${typeof lecturerLat})`);
        console.log(`      Lecturer Longitude: ${session.lecturerGps.longitude} → ${lecturerLng} (type: ${typeof lecturerLng})`);
        
        if (isNaN(lecturerLat) || isNaN(lecturerLng)) {
            console.error('  ❌ Lecturer GPS coordinates are not valid numbers');
            return res.status(500).json({ error: 'Server GPS configuration error' });
        }
        
        console.log('  ✅ Lecturer GPS data is valid');
        
        // Calculate distance
        console.log('\n  5c. Distance Calculation:');
        const distance = calculateDistance(lecturerLat, lecturerLng, studentLat, studentLng);
        console.log(`      Distance: ${distance.toFixed(2)} meters`);
        console.log(`      Allowed Radius: ${session.gpsRadius} meters`);
        
        const withinRadius = distance <= session.gpsRadius;
        console.log(`      Result: ${withinRadius ? '✅ WITHIN RADIUS' : '❌ OUTSIDE RADIUS'}`);
        
        if (!withinRadius) {
            console.error(`❌ GPS validation failed. Student is ${distance.toFixed(2)}m away (radius: ${session.gpsRadius}m)`);
            return res.status(403).json({ 
                error: 'You are not within the class location',
                debug: {
                    studentLocation: [studentLat, studentLng],
                    lecturerLocation: [lecturerLat, lecturerLng],
                    distance: Math.round(distance),
                    radius: session.gpsRadius
                },
                distance: Math.round(distance),
                radius: session.gpsRadius
            });
        }
        console.log('✅ GPS validation PASSED');
    } else {
        console.log('⚠️  GPS validation is NOT required for this session');
    }

    // Step 6: Create attendance record
    console.log('\n📍 STEP 6: Creating Attendance Record');
    const department = getDepartment(matricNumber);

    const record = {
        id: attendanceIdCounter++,
        session_id: token,
        class_id: session.class_id,
        name: name,
        matric_number: matricNumber,
        department: department,
        timestamp: new Date().toISOString()
    };
    
    if (studentGps) {
        record.studentGps = studentGps;
    }
    if (deviceId) {
        record.deviceId = deviceId;
    }

    attendance.push(record);
    console.log('✅ Attendance recorded:', record.id);
    console.log('   Name:', record.name);
    console.log('   Matric:', record.matric_number);
    console.log('   Department:', record.department);
    console.log('   Time:', record.timestamp);
    console.log('╚════════════════════════╝\n');

    res.json({ success: true, name, department });
});

// DEBUG ENDPOINT: Test GPS validation without enforcing restriction
app.post('/api/debug/gps-check', (req, res) => {
    console.log('\n\n╔══ GPS DEBUG CHECK ══╗');
    const { token, studentGps } = req.body;
    
    console.log('📋 Debug GPS Check Request');
    console.log('   Token:', token ? token.substring(0, 8) + '...' : 'MISSING');
    console.log('   Student GPS:', studentGps);
    
    // Find session
    const session = sessions.find(s => s.id === token && s.status === 'active');
    if (!session) {
        console.error('❌ Session not found');
        return res.status(400).json({ error: 'Session not found' });
    }
    
    console.log('✅ Session found');
    console.log('   Lecturer GPS:', session.lecturerGps);
    console.log('   Radius:', session.gpsRadius);
    
    // Check if GPS is enabled
    if (!session.lecturerGps) {
        console.log('⚠️  GPS not enabled for this session');
        return res.json({ 
            gpsEnabled: false,
            message: 'GPS validation is not enabled for this session'
        });
    }
    
    // Validate student GPS
    if (!studentGps) {
        console.error('❌ Student GPS is null');
        return res.json({ 
            gpsEnabled: true,
            studentGpsValid: false,
            error: 'Student GPS is missing'
        });
    }
    
    const studentLat = Number(studentGps.latitude);
    const studentLng = Number(studentGps.longitude);
    
    if (isNaN(studentLat) || isNaN(studentLng)) {
        console.error('❌ Student GPS has invalid numbers');
        return res.json({
            gpsEnabled: true,
            studentGpsValid: false,
            error: 'Student GPS coordinates are not valid numbers',
            received: studentGps
        });
    }
    
    // Calculate distance
    const distance = calculateDistance(
        Number(session.lecturerGps.latitude),
        Number(session.lecturerGps.longitude),
        studentLat,
        studentLng
    );
    
    const withinRadius = distance <= session.gpsRadius;
    
    console.log(`\n📊 Result: ${distance.toFixed(2)}m vs ${session.gpsRadius}m = ${withinRadius ? '✅ PASS' : '❌ FAIL'}`);
    console.log('╚═══════════════════╝\n');
    
    res.json({
        gpsEnabled: true,
        studentGpsValid: true,
        studentLocation: [studentLat, studentLng],
        lecturerLocation: [Number(session.lecturerGps.latitude), Number(session.lecturerGps.longitude)],
        distance: Math.round(distance),
        radius: session.gpsRadius,
        withinRadius: withinRadius,
        message: withinRadius ? '✅ Student is within the classroom range' : `❌ Student is ${Math.round(distance)}m away (outside ${session.gpsRadius}m radius)`
    });
});

// Get dashboard summary for active session
app.get('/api/dashboard/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    
    const sessionAttendance = attendance.filter(a => a.session_id === sessionId);
    
    const count = sessionAttendance.length;
    
    // Group by department
    const deptMap = {};
    sessionAttendance.forEach(a => {
        deptMap[a.department] = (deptMap[a.department] || 0) + 1;
    });
    
    const departments = Object.keys(deptMap).map(k => ({
        department: k,
        count: deptMap[k]
    })).sort((a, b) => b.count - a.count);

    // Sort students desc by timestamp
    const sortedStudents = [...sessionAttendance].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ 
        count: count, 
        departments: departments, 
        students: sortedStudents 
    });
});

// Get all classes
app.get('/api/classes', (req, res) => {
    const sortedClasses = [...classes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ classes: sortedClasses });
});

// Get sessions under a class
app.get('/api/classes/:classId/sessions', (req, res) => {
    const classSessions = sessions.filter(s => s.class_id === req.params.classId);
    
    const enhancedSessions = classSessions.map(s => {
        const attendanceCount = attendance.filter(a => a.session_id === s.id).length;
        return { ...s, attendance_count: attendanceCount };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ sessions: enhancedSessions });
});

// Get attendance for a specific session (for retrieval)
app.get('/api/sessions/:sessionId/attendance', (req, res) => {
    const sessionAttendance = attendance
        .filter(a => a.session_id === req.params.sessionId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
    res.json({ attendance: sessionAttendance });
});

// Grading system endpoint
app.get('/api/classes/:classId/grades', (req, res) => {
    const classId = req.params.classId;
    const maxMarks = parseFloat(req.query.max_marks) || 30;

    const classSessions = sessions.filter(s => s.class_id === classId);
    const totalSessions = classSessions.length || 1; // Prevent division by zero

    const classAttendance = attendance.filter(a => a.class_id === classId);

    // Group by matric_number
    const studentMap = {};
    classAttendance.forEach(a => {
        if (!studentMap[a.matric_number]) {
            studentMap[a.matric_number] = {
                matric_number: a.matric_number,
                name: a.name,
                department: a.department,
                sessions_attended: 0
            };
        }
        studentMap[a.matric_number].sessions_attended += 1;
    });

    // Calculate scores
    const grades = Object.values(studentMap).map(s => {
        const score = totalSessions > 0 ? ((s.sessions_attended / totalSessions) * maxMarks) : 0;
        return {
            ...s,
            score: score.toFixed(2),
            totalSessions
        };
    }).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ class_id: classId, totalSessions, maxMarks, grades });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
