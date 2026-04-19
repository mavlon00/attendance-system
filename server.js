const express = require('express');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to determine department from matric correctly (embedded)
function getDepartment(matricNo) {
    if (!matricNo) return 'Other';
    const normalized = matricNo.toUpperCase().replace(/\s+/g, '');
    
    // Regex rule: /^[A-Z]+/([A-Z]{2,4})/\d{2}/\d+$/
    const regex = /^[A-Z]+\/([A-Z]{2,4})\/\d{2}\/\d+$/;
    const match = normalized.match(regex);
    
    if (!match) return 'Other';
    
    const deptCode = match[1];
    
    // Clean mapping object
    const deptMap = {
        'CME': 'Computer Engineering',
        'CHE': 'Chemical Engineering',
        'EEE': 'Electrical/Electronics Engineering'
    };
    
    return deptMap[deptCode] || 'Other';
}

// Start a new session
app.post('/api/sessions/start', async (req, res) => {
    const { className, level } = req.body;
    if (!className || !level) {
        return res.status(400).json({ error: 'Class name and level are required' });
    }

    try {
        await db.run("UPDATE sessions SET status = 'closed' WHERE status = 'active'");
        
        let classRecord = await db.get("SELECT id FROM classes WHERE class_name = ? AND level = ?", [className, level]);
        let classId;

        if (classRecord) {
            classId = classRecord.id;
        } else {
            classId = uuidv4();
            await db.run("INSERT INTO classes (id, class_name, level) VALUES (?, ?, ?)", [classId, className, level]);
        }
        
        const sessionId = uuidv4();
        await db.run(
            "INSERT INTO sessions (id, class_id, class_name, level, status) VALUES (?, ?, ?, ?, 'active')", 
            [sessionId, classId, className, level]
        );
        
        const qrUrl = `http://localhost:${PORT}/attend.html?token=${sessionId}`;
        const qrDataUrl = await qrcode.toDataURL(qrUrl);
        
        res.json({ success: true, sessionId, qrDataUrl, className, level });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// End current session
app.post('/api/sessions/end', async (req, res) => {
    try {
        await db.run("UPDATE sessions SET status = 'closed' WHERE status = 'active'");
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get active session
app.get('/api/sessions/active', async (req, res) => {
    try {
        const session = await db.get("SELECT * FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
        if (session) {
            const qrUrl = `http://localhost:${PORT}/attend.html?token=${session.id}`;
            const qrDataUrl = await qrcode.toDataURL(qrUrl);
            res.json({ session, qrDataUrl });
        } else {
            res.json({ session: null });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit attendance
app.post('/api/attendance', async (req, res) => {
    const { name, matricNumber, token } = req.body;
    
    if (!name || !matricNumber || !token) {
        return res.status(400).json({ error: 'Name, matric number, and token are required' });
    }

    try {
        const session = await db.get("SELECT * FROM sessions WHERE id = ? AND status = 'active'", [token]);
        if (!session) {
            return res.status(400).json({ error: 'Invalid or inactive session' });
        }

        const existing = await db.get("SELECT * FROM attendance WHERE session_id = ? AND matric_number = ?", [token, matricNumber]);
        if (existing) {
            return res.status(400).json({ error: 'Attendance already submitted for this session by this matric number' });
        }

        const department = getDepartment(matricNumber);

        await db.run(
            "INSERT INTO attendance (session_id, class_id, name, matric_number, department) VALUES (?, ?, ?, ?, ?)", 
            [token, session.class_id, name, matricNumber, department]
        );
        res.json({ success: true, name, department });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get dashboard summary for active session
app.get('/api/dashboard/:sessionId', async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        
        // Total count
        const countRes = await db.get("SELECT COUNT(*) as count FROM attendance WHERE session_id = ?", [sessionId]);
        
        // Department breakdown
        const depts = await db.all(`
            SELECT department, COUNT(*) as count 
            FROM attendance 
            WHERE session_id = ? 
            GROUP BY department
            ORDER BY count DESC
        `, [sessionId]);

        // Student list
        const students = await db.all(`
            SELECT name, matric_number, department, timestamp 
            FROM attendance 
            WHERE session_id = ? 
            ORDER BY timestamp DESC
        `, [sessionId]);

        res.json({ 
            count: countRes.count, 
            departments: depts, 
            students 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NEW: Get all classes
app.get('/api/classes', async (req, res) => {
    try {
        const classes = await db.all("SELECT * FROM classes ORDER BY created_at DESC");
        res.json({ classes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NEW: Get sessions under a class
app.get('/api/classes/:classId/sessions', async (req, res) => {
    try {
        const sessions = await db.all(`
            SELECT s.*, COUNT(a.id) as attendance_count 
            FROM sessions s 
            LEFT JOIN attendance a ON s.id = a.session_id 
            WHERE s.class_id = ? 
            GROUP BY s.id 
            ORDER BY s.created_at DESC
        `, [req.params.classId]);
        res.json({ sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NEW: Get attendance for a specific session (for retrieval)
app.get('/api/sessions/:sessionId/attendance', async (req, res) => {
    try {
        const attendance = await db.all(`
            SELECT * FROM attendance WHERE session_id = ? ORDER BY timestamp DESC
        `, [req.params.sessionId]);
        res.json({ attendance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NEW: Grading system endpoint
app.get('/api/classes/:classId/grades', async (req, res) => {
    try {
        const classId = req.params.classId;
        const maxMarks = parseFloat(req.query.max_marks) || 30;

        const totalSessionsResult = await db.get("SELECT COUNT(*) as count FROM sessions WHERE class_id = ?", [classId]);
        const totalSessions = totalSessionsResult.count || 1; // Prevent division by zero

        const attendanceData = await db.all(`
            SELECT matric_number, name, department, COUNT(*) as sessions_attended 
            FROM attendance 
            WHERE class_id = ?
            GROUP BY matric_number
            ORDER BY name ASC
        `, [classId]);

        const grades = attendanceData.map(s => {
            const score = totalSessions > 0 ? ((s.sessions_attended / totalSessions) * maxMarks) : 0;
            return {
                ...s,
                score: score.toFixed(2),
                totalSessions
            };
        });

        res.json({ class_id: classId, totalSessions, maxMarks, grades });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
