const db = require('./database');

const students = [
    { matric_no: '2023001', name: 'Alice Johnson' },
    { matric_no: '2023002', name: 'Bob Smith' },
    { matric_no: '2023003', name: 'Charlie Brown' },
    { matric_no: '2023004', name: 'David Wilson' },
    { matric_no: '2023005', name: 'Eva Garcia' },
    { matric_no: '2023006', name: 'Frank Miller' },
    { matric_no: '2023007', name: 'Grace Lee' },
    { matric_no: '2023008', name: 'Henry Ford' },
    { matric_no: '2023009', name: 'Ivy Chen' },
    { matric_no: '2023010', name: 'Jack Robinson' },
    { matric_no: '2023011', name: 'Karen Taylor' },
    { matric_no: '2023012', name: 'Leo Martinez' },
    { matric_no: '2023013', name: 'Maya Gupta' },
    { matric_no: '2023014', name: 'Noah Williams' },
    { matric_no: '2023015', name: 'Olivia Davis' },
    { matric_no: '2023016', name: 'Peter Parker' },
    { matric_no: '2023017', name: 'Quinn Sullivan' },
    { matric_no: '2023018', name: 'Riley Jones' },
    { matric_no: '2023019', name: 'Sophia Brown' },
    { matric_no: '2023020', name: 'Thomas Anderson' }
];

async function seed() {
    console.log('Seeding student data...');
    try {
        for (const student of students) {
            await db.run('INSERT OR IGNORE INTO students (matric_no, name) VALUES (?, ?)', [student.matric_no, student.name]);
        }
        console.log('Successfully seeded 20 students.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();
