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
2. Enter the **Class Title** (e.g., `GET 222`) and **Course Level** (e.g., `200`).
3. Click **"Create & Start Session"**. A unique QR code will be generated.
4. The dashboard will go live, showing:
   - Total students checked in.
   - A breakdown of attendance grouped by **Department**.
   - A live log of every sign-in.
5. Click **"End Session"** when the class is over.

### Student Flow
1. Students scan the QR code or visit the copied quick link.
2. They enter their **Full Name** and **Matriculation Number** (e.g., `CME/20/1230`).
3. The system automatically detects their department based on the matric prefix:
   - `CME` → Computer Engineering
   - `CHE` → Chemical Engineering
   - `EEE` → Electrical Engineering
4. If a student tries to sign in twice during the same session, the system prevents it.
5. Upon successful submission, a confirmation screen displays the extracted department.

## 🛠 Tech Stack
- **Backend**: Node.js, Express
- **Database**: SQLite
- **Frontend**: Vanilla HTML, CSS (Glassmorphism UI), JavaScript
- **Libraries**:
  - `qrcode` (for QR tag generation)
  - `uuid` (for session token IDs)

## 💡 Notes for Demo Presentation
- Ensure any previous testing data doesn't conflict by noting that a new database file `univ_attendance.db` is used for this version.
- Open multiple tabs or use an incognito window to simulate different students joining the class.
