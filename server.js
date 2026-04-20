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
let sessions = [];    // { id, class_id, class_name, level, status, created_at }
let attendance = [];  // { id, session_id, class_id, name, matric_number, department, timestamp }
let attendanceIdCounter = 1;

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

// --- API Endpoints ---

// Start a new session
app.post('/api/sessions/start', async (req, res) => {
    const { className, level } = req.body;
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
        sessions.push({
            id: sessionId,
            class_id: classId,
            class_name: className,
            level: level,
            status: 'active',
            created_at: new Date().toISOString()
        });
        
        const qrUrl = `${BASE_URL}/attend.html?token=${sessionId}`;
        
        const qrDataUrl = await qrcode.toDataURL(qrUrl);
        
        res.json({ success: true, sessionId, qrDataUrl, className, level });
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

// Get active session
app.get('/api/sessions/active', async (req, res) => {
    try {
        const activeSession = sessions.find(s => s.status === 'active');
        if (activeSession) {
            const qrUrl = `${BASE_URL}/attend.html?token=${activeSession.id}`;
            const qrDataUrl = await qrcode.toDataURL(qrUrl);
            res.json({ session: activeSession, qrDataUrl });
        } else {
            res.json({ session: null });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit attendance
app.post('/api/attendance', (req, res) => {
    const { name, matricNumber, token } = req.body;
    
    if (!name || !matricNumber || !token) {
        return res.status(400).json({ error: 'Name, matric number, and token are required' });
    }

    const session = sessions.find(s => s.id === token && s.status === 'active');
    if (!session) {
        return res.status(400).json({ error: 'Invalid or inactive session' });
    }

    const existing = attendance.find(a => a.session_id === token && a.matric_number === matricNumber);
    if (existing) {
        return res.status(400).json({ error: 'Attendance already submitted for this session by this matric number' });
    }

    const department = getDepartment(matricNumber);

    attendance.push({
        id: attendanceIdCounter++,
        session_id: token,
        class_id: session.class_id,
        name: name,
        matric_number: matricNumber,
        department: department,
        timestamp: new Date().toISOString()
    });

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
