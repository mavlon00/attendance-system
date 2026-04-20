const elements = {
    formSection: document.getElementById('formSection'),
    successSection: document.getElementById('successSection'),
    submitBtn: document.getElementById('submitBtn'),
    fullName: document.getElementById('fullName'),
    matricNumber: document.getElementById('matricNumber'),
    message: document.getElementById('message'),
    successName: document.getElementById('successName'),
    successDept: document.getElementById('successDept'),
    gpsStatusDiv: document.getElementById('gpsStatusDiv'),
    gpsStatusIcon: document.getElementById('gpsStatusIcon'),
    gpsStatusText: document.getElementById('gpsStatusText')
};

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// Device identification for duplicate prevention
let deviceId = localStorage.getItem('attendanceDeviceId');
if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('attendanceDeviceId', deviceId);
}

let studentGps = null;
let gpsPermissionDenied = false;

// Request GPS on page load
if (navigator.geolocation) {
    elements.gpsStatusDiv.style.display = 'block';
    navigator.geolocation.getCurrentPosition(
        (position) => {
            studentGps = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            elements.gpsStatusDiv.style.display = 'none';
        },
        (error) => {
            gpsPermissionDenied = true;
            elements.gpsStatusIcon.innerText = '⚠️';
            elements.gpsStatusText.innerText = 'Location access denied. You can still sign in if location is optional.';
            elements.gpsStatusDiv.style.borderLeft = '3px solid var(--accent)';
            console.warn('GPS Error:', error.message);
        },
        { timeout: 10000, enableHighAccuracy: false }
    );
} else {
    console.warn('Geolocation not supported');
}

if (!token) {
    showMessage('Invalid Session Link. Please scan a valid QR code.', 'error');
    elements.formSection.style.display = 'none';
}

elements.submitBtn.addEventListener('click', async () => {
    const fullName = elements.fullName.value.trim();
    const matricNumber = elements.matricNumber.value.trim();

    if (!fullName || !matricNumber) {
        showMessage('Please provide both your Full Name and Matric Number.', 'error');
        return;
    }

    try {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerText = 'Submitting...';

        const payload = { 
            name: fullName, 
            matricNumber, 
            token,
            deviceId 
        };

        // Include GPS if available
        if (studentGps) {
            payload.studentGps = studentGps;
        }

        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
            elements.formSection.style.display = 'none';
            
            // Populate success screen
            elements.successName.innerText = `Welcome, ${data.name}!`;
            elements.successDept.innerText = data.department;
            
            elements.successSection.style.display = 'block';
            elements.message.style.display = 'none';
        } else {
            showMessage(data.error || 'Failed to submit attendance.', 'error');
            elements.submitBtn.disabled = false;
            elements.submitBtn.innerText = 'Sign In';
        }
    } catch (err) {
        showMessage('Network error. Please check your connection and try again.', 'error');
        elements.submitBtn.disabled = false;
        elements.submitBtn.innerText = 'Sign In';
    }
});

function showMessage(text, type) {
    elements.message.innerText = text;
    elements.message.className = `message ${type}`;
    elements.message.style.display = 'block';
}

// Allow Enter key to submit on last input
elements.matricNumber.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.submitBtn.click();
});
