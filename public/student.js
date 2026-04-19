const elements = {
    formSection: document.getElementById('formSection'),
    successSection: document.getElementById('successSection'),
    submitBtn: document.getElementById('submitBtn'),
    fullName: document.getElementById('fullName'),
    matricNumber: document.getElementById('matricNumber'),
    message: document.getElementById('message'),
    successName: document.getElementById('successName'),
    successDept: document.getElementById('successDept')
};

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

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

        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fullName, matricNumber, token })
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
