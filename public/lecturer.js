let currentSessionId = null;
let pollInterval = null;

const elements = {
    setupSection: document.getElementById('setupSection'),
    activeSessionSection: document.getElementById('activeSessionSection'),
    logSection: document.getElementById('logSection'),
    classNameInput: document.getElementById('className'),
    classLevelInput: document.getElementById('classLevel'),
    setupError: document.getElementById('setupError'),
    startBtn: document.getElementById('startBtn'),
    endBtn: document.getElementById('endBtn'),
    displayClassName: document.getElementById('displayClassName'),
    displayClassLevel: document.getElementById('displayClassLevel'),
    copyBtn: document.getElementById('copyBtn'),
    qrImage: document.getElementById('qrImage'),
    studentCount: document.getElementById('studentCount'),
    deptList: document.getElementById('deptList'),
    studentTableBody: document.getElementById('studentTableBody'),
    lastUpdate: document.getElementById('lastUpdate'),
    // History Tracking Elements
    historyClassesSection: document.getElementById('historyClassesSection'),
    historyClassesList: document.getElementById('historyClassesList'),
    historySessionsSection: document.getElementById('historySessionsSection'),
    historySessionsList: document.getElementById('historySessionsList'),
    historySessionsClassTitle: document.getElementById('historySessionsClassTitle'),
    backToClassesBtn: document.getElementById('backToClassesBtn'),
    viewGradesBtn: document.getElementById('viewGradesBtn'),
    historyDetailSection: document.getElementById('historyDetailSection'),
    historyDetailTitle: document.getElementById('historyDetailTitle'),
    historyDetailHead: document.getElementById('historyDetailHead'),
    historyDetailBody: document.getElementById('historyDetailBody'),
    backToSessionsBtn: document.getElementById('backToSessionsBtn')
};

let selectedClassId = null;

// Check for active session on load
async function checkActiveSession() {
    try {
        const res = await fetch('/api/sessions/active');
        const data = await res.json();
        if (data.session) {
            setupLiveSession(data.session.id, data.qrDataUrl, data.session.class_name, data.session.level);
        }
        loadHistoryClasses();
    } catch (err) {
        console.error('Error checking active session:', err);
    }
}

function setupLiveSession(sessionId, qrDataUrl, className, level) {
    currentSessionId = sessionId;

    // Update UI elements
    elements.displayClassName.innerText = className;
    elements.displayClassLevel.innerText = `Level ${level}`;
    elements.qrImage.src = qrDataUrl;

    // Toggle Visibility
    elements.setupSection.style.display = 'none';
    elements.activeSessionSection.style.display = 'block';
    elements.logSection.style.display = 'block';

    // Start polling
    startPolling();
}

elements.startBtn.addEventListener('click', async () => {
    const className = elements.classNameInput.value.trim();
    const level = elements.classLevelInput.value.trim();

    if (!className || !level) {
        elements.setupError.innerText = "Please provide both Class Name and Level.";
        elements.setupError.style.display = 'block';
        return;
    }

    try {
        elements.startBtn.disabled = true;
        elements.startBtn.innerText = 'Creating...';

        const res = await fetch('/api/sessions/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, level })
        });
        const data = await res.json();

        if (data.success) {
            elements.setupError.style.display = 'none';
            setupLiveSession(data.sessionId, data.qrDataUrl, data.className, data.level);
        } else {
            elements.setupError.innerText = data.error || "Failed to start session";
            elements.setupError.style.display = 'block';
            elements.startBtn.disabled = false;
            elements.startBtn.innerText = 'Create & Start Session';
        }
    } catch (err) {
        elements.setupError.innerText = "Network error occurred.";
        elements.setupError.style.display = 'block';
        elements.startBtn.disabled = false;
        elements.startBtn.innerText = 'Create & Start Session';
    }
});

elements.endBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to end this session?")) return;

    try {
        const res = await fetch('/api/sessions/end', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            stopPolling();
            // Reset UI
            elements.activeSessionSection.style.display = 'none';
            elements.logSection.style.display = 'none';
            elements.setupSection.style.display = 'block';

            elements.classNameInput.value = '';
            elements.classLevelInput.value = '';
            elements.startBtn.disabled = false;
            elements.startBtn.innerText = 'Create & Start Session';

            elements.studentCount.innerText = '0';
            elements.studentTableBody.innerHTML = '';
            elements.deptList.innerHTML = '<div style="color: var(--text-dim); font-size: 0.9rem; font-style: italic;">Awaiting students...</div>';

            currentSessionId = null;

            // Reload history to show the newly finished class/session
            loadHistoryClasses();
        }
    } catch (err) {
        alert('Failed to end session');
    }
});

elements.copyBtn.addEventListener('click', () => {
    const sessionId = currentSessionId;
    if (!sessionId) return;
    const url = `${window.location.origin}/session/${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
        const originalText = elements.copyBtn.innerText;
        elements.copyBtn.innerText = 'Copied!';
        elements.copyBtn.style.background = 'var(--accent)';
        setTimeout(() => {
            elements.copyBtn.innerText = originalText;
            elements.copyBtn.style.background = '';
        }, 2000);
    });
});

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    updateDashboard(); // initial call
    pollInterval = setInterval(updateDashboard, 3000);
}

function stopPolling() {
    if (pollInterval) clearInterval(pollInterval);
}

// Map styles for different departments for visual flair
function getDeptColor(dept) {
    if (dept.includes('Computer')) return '#6ea8fe'; // blue
    if (dept.includes('Chemical')) return '#fca311'; // orange
    if (dept.includes('Electrical')) return '#ffbe0b'; // yellow
    return '#a9bacc'; // default
}

async function updateDashboard() {
    if (!currentSessionId) return;

    try {
        const res = await fetch(`/api/dashboard/${currentSessionId}`);
        const data = await res.json();

        // 1. Update Total Count
        elements.studentCount.innerText = data.count || 0;

        // 2. Update Department Breakdown
        if (data.departments && data.departments.length > 0) {
            elements.deptList.innerHTML = data.departments.map(d => {
                const color = getDeptColor(d.department);
                return `
                <div style="background: rgba(255,255,255,0.05); border-left: 3px solid ${color}; padding: 12px 16px; border-radius: 8px;">
                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px;">${d.department}</div>
                    <div style="color: var(--accent); font-size: 1.2rem; font-weight: 700;">${d.count}</div>
                </div>`;
            }).join('');
        } else {
            elements.deptList.innerHTML = '<div style="color: var(--text-dim); font-size: 0.9rem; font-style: italic;">Awaiting students...</div>';
        }

        // 3. Update Student List
        elements.studentTableBody.innerHTML = data.students && data.students.length > 0
            ? data.students.map(s => `
                <tr>
                    <td data-label="Student Info">
                        <div style="font-weight: 600;">${s.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-dim); font-family: monospace;">${s.matric_number}</div>
                    </td>
                    <td data-label="Department">
                        <span style="font-size: 0.85rem; padding: 4px 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">${s.department}</span>
                    </td>
                    <td data-label="Check-in Time" style="color: var(--text-dim); font-size: 0.9rem;">${new Date(s.timestamp).toLocaleTimeString()}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="3" style="text-align: center; color: var(--text-dim); padding: 40px;">No attendance recorded yet.</td></tr>';

        elements.lastUpdate.innerText = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error('Polling error:', err);
    }
}

// Init
checkActiveSession();

// --- History & Retrieval Logic ---

async function loadHistoryClasses() {
    try {
        const res = await fetch('/api/classes');
        const data = await res.json();
        if (data.classes && data.classes.length > 0) {
            elements.historyClassesList.innerHTML = data.classes.map(c => `
                <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 16px; border-radius: 8px; cursor: pointer; transition: background 0.2s;" 
                     onclick="loadHistorySessions('${c.id}', '${c.class_name}')"
                     onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                     onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    <div style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">${c.class_name}</div>
                    <div style="color: var(--text-dim); font-size: 0.9rem;">Level ${c.level}</div>
                </div>
            `).join('');
        } else {
            elements.historyClassesList.innerHTML = '<div style="color: var(--text-dim);">No past classes found.</div>';
        }
    } catch (err) {
        console.error('Failed to load history classes', err);
    }
}

async function loadHistorySessions(classId, className) {
    selectedClassId = classId;
    elements.historyClassesSection.style.display = 'none';
    elements.historySessionsSection.style.display = 'block';
    elements.historySessionsClassTitle.innerText = `Sessions for ${className}`;
    elements.historySessionsList.innerHTML = 'Loading...';

    try {
        const res = await fetch(`/api/classes/${classId}/sessions`);
        const data = await res.json();

        elements.historySessionsList.innerHTML = data.sessions.length > 0
            ? data.sessions.map(s => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px;">
                    <div>
                        <div style="font-weight: 600; font-size: 1rem;">Session Date: ${new Date(s.created_at).toLocaleString()}</div>
                        <div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 4px;">Status: <span style="text-transform: uppercase;">${s.status}</span> | Attendance: ${s.attendance_count}</div>
                    </div>
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="loadSessionAttendance('${s.id}')">View</button>
                </div>
            `).join('')
            : '<div style="color: var(--text-dim);">No sessions recorded.</div>';
    } catch (err) {
        console.error('Failed to load history sessions', err);
    }
}

elements.backToClassesBtn.addEventListener('click', () => {
    elements.historySessionsSection.style.display = 'none';
    elements.historyClassesSection.style.display = 'block';
    selectedClassId = null;
});

async function loadSessionAttendance(sessionId) {
    elements.historySessionsSection.style.display = 'none';
    elements.historyDetailSection.style.display = 'block';
    elements.historyDetailTitle.innerText = `Session Attendance`;

    elements.historyDetailHead.innerHTML = `
        <tr>
            <th style="width: 40%;">Student Info</th>
            <th style="width: 35%;">Department</th>
            <th style="width: 25%;">Timestamp</th>
        </tr>
    `;
    elements.historyDetailBody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    try {
        const res = await fetch(`/api/sessions/${sessionId}/attendance`);
        const data = await res.json();

        elements.historyDetailBody.innerHTML = data.attendance && data.attendance.length > 0
            ? data.attendance.map(a => `
                <tr>
                    <td data-label="Student Info">
                        <div style="font-weight: 600;">${a.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-dim); font-family: monospace;">${a.matric_number}</div>
                    </td>
                    <td data-label="Department"><span style="font-size: 0.85rem; padding: 4px 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">${a.department}</span></td>
                    <td data-label="Timestamp" style="color: var(--text-dim); font-size: 0.9rem;">${new Date(a.timestamp).toLocaleString()}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="3" style="text-align: center; color: var(--text-dim);">No records.</td></tr>';
    } catch (err) {
        console.error(err);
    }
}

elements.viewGradesBtn.addEventListener('click', async () => {
    if (!selectedClassId) return;
    elements.historySessionsSection.style.display = 'none';
    elements.historyDetailSection.style.display = 'block';
    elements.historyDetailTitle.innerText = `Final Grades (Max: 30 Marks)`;

    elements.historyDetailHead.innerHTML = `
        <tr>
            <th style="width: 40%;">Student Info</th>
            <th style="width: 35%;">Attendance Rate</th>
            <th style="width: 25%;">Score (/30)</th>
        </tr>
    `;
    elements.historyDetailBody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    try {
        const res = await fetch(`/api/classes/${selectedClassId}/grades?max_marks=30`);
        const data = await res.json();

        elements.historyDetailBody.innerHTML = data.grades && data.grades.length > 0
            ? data.grades.map(g => `
                <tr>
                    <td data-label="Student Info">
                        <div style="font-weight: 600;">${g.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-dim); font-family: monospace;">${g.matric_number}</div>
                    </td>
                    <td data-label="Attendance Rate" style="color: var(--text-dim); font-size: 0.9rem;">${g.sessions_attended} / ${data.totalSessions} sessions</td>
                    <td data-label="Score (/30)"><strong style="color: var(--accent); font-size: 1.1rem;">${g.score}</strong></td>
                </tr>
            `).join('')
            : '<tr><td colspan="3" style="text-align: center; color: var(--text-dim);">No records calculated.</td></tr>';
    } catch (err) {
        console.error(err);
    }
});

elements.backToSessionsBtn.addEventListener('click', () => {
    elements.historyDetailSection.style.display = 'none';
    elements.historySessionsSection.style.display = 'block';
});

