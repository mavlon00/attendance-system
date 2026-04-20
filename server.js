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
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

// Helper to validate GPS is within session radius
function isWithinGpsRadius(studentGps, lecturerGps, radius) {
    if (!studentGps || !studentGps.latitude || !studentGps.longitude) return false;
    if (!lecturerGps || !lecturerGps.latitude || !lecturerGps.longitude) return false;
    
    const distance = calculateDistance(
        studentGps.latitude,
        studentGps.longitude,
        lecturerGps.latitude,
        lecturerGps.longitude
    );
    
    return distance <= radius;
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
            session.gpsRadius = gpsRadius || 50; // Default 50 meters
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
                gpsRadius: activeSession.gpsRadius || 50
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
    const { name, matricNumber, token, studentGps, deviceId } = req.body;
    
    console.log('Attendance submission attempt:', {
        name,
        matricNumber,
        token: token?.substring(0, 8) + '...',
        studentGps: studentGps ? `${studentGps.latitude}, ${studentGps.longitude}` : null,
        deviceId: deviceId?.substring(0, 10) + '...'
    });
    
    if (!name || !matricNumber || !token) {
        return res.status(400).json({ error: 'Name, matric number, and token are required' });
    }

    const session = sessions.find(s => s.id === token && s.status === 'active');
    if (!session) {
        return res.status(400).json({ error: 'Invalid or inactive session' });
    }

    // Check if matric already submitted (existing logic - KEEP)
    const existing = attendance.find(a => a.session_id === token && a.matric_number === matricNumber);
    if (existing) {
        return res.status(400).json({ error: 'Attendance already submitted for this session by this matric number' });
    }

    // Check if device already submitted (new logic - device-level duplicate protection)
    if (deviceId) {
        const deviceKey = `${token}-${deviceId}`;
        const deviceSubmitted = attendance.find(a => a.session_id === token && a.deviceId === deviceId);
        if (deviceSubmitted) {
            return res.status(400).json({ error: 'Attendance already submitted from this device for this session' });
        }
    }

    // GPS validation (if session has GPS enabled)
    if (session.lecturerGps) {
        console.log('GPS validation required. Session GPS:', session.lecturerGps, 'Radius:', session.gpsRadius);
        
        if (!studentGps || !studentGps.latitude || !studentGps.longitude) {
            console.log('✗ Student GPS missing:', studentGps);
            return res.status(403).json({ error: 'Location permission required' });
        }
        
        console.log('Student GPS received:', studentGps);
        
        const withinRadius = isWithinGpsRadius(studentGps, session.lecturerGps, session.gpsRadius);
        console.log('GPS within radius?', withinRadius);
        
        if (!withinRadius) {
            const distance = calculateDistance(
                studentGps.latitude,
                studentGps.longitude,
                session.lecturerGps.latitude,
                session.lecturerGps.longitude
            );
            console.log(`✗ Student outside radius: ${Math.round(distance)}m (radius: ${session.gpsRadius}m)`);
            return res.status(403).json({ 
                error: 'You are not within the class location',
                distance: Math.round(distance),
                radius: session.gpsRadius
            });
        }
        console.log('✓ GPS validation passed');
    }

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
    
    // Attach GPS and device info if provided
    if (studentGps) {
        record.studentGps = studentGps;
    }
    if (deviceId) {
        record.deviceId = deviceId;
    }

    attendance.push(record);
    console.log('✓ Attendance recorded for:', name, matricNumber);

    res.json({ success: true, name, department });
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
