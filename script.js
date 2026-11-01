import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// PASTE YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCbPc8ke55lrodJU1q_YyQvj0oHrtvcy9k",
    authDomain: "smart-pedestrian-system-fef41.firebaseapp.com",
    projectId: "smart-pedestrian-system-fef41",
    databaseURL: "https://smart-pedestrian-system-fef41-default-rtdb.firebaseio.com",
    storageBucket: "smart-pedestrian-system-fef41.firebasestorage.app",
    messagingSenderId: "840685606655",
    appId: "1:840685606655:web:80cb8713e8cb78083cdeca"
};
const ADMIN_DOMAIN = "@admin.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentData = {};
let isAdmin = false;

// Navigation Logic
document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.id === 'logout-btn') return;
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// Auth Logic
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';

        isAdmin = (user.email || "").endsWith(ADMIN_DOMAIN);
        const roleMsg = document.getElementById('role-warning');

        if (isAdmin) {
            roleMsg.textContent = "✓ Admin Mode: Full hardware control enabled.";
            roleMsg.style.color = "var(--green-glow)";
        } else {
            roleMsg.textContent = "🔒 Viewer Mode: Buttons disabled. Admin required to change states.";
            roleMsg.style.color = "var(--red-glow)";
        }
        startDatabaseListener();
    } else {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('app-section').style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .catch(err => {
            const errEl = document.getElementById('error-message');
            errEl.style.display = 'block';
            errEl.textContent = err.message;
        });
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// Database Logic
function startDatabaseListener() {
    onValue(ref(db, 'status'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentData = data;

            // Big Number Update
            document.getElementById('val-ped-count').textContent = data.pedCount;

            // Anomaly Alert (Obstructed > 10s OR pedCount >= 20 threshold limit)
            const isAnomaly = data.irAnomaly || data.pedThresholdReached;
            document.getElementById('system-alert-banner').style.display = isAnomaly ? 'block' : 'none';
            document.getElementById('val-buzzer-status').textContent = isAnomaly ? "ACTIVE (BUZZER)" : "OFF";
            document.getElementById('val-buzzer-status').style.color = isAnomaly ? "red" : "green";

            // Emergency Banner
            const emgBanner = document.getElementById('emergency-alert-banner');
            const emgText = document.getElementById('emergency-mode-text');
            if (data.override === 1) { emgBanner.style.display = 'block'; emgText.textContent = "HOLD CAR GREEN"; }
            else if (data.override === 2) { emgBanner.style.display = 'block'; emgText.textContent = "HOLD PED GREEN"; }
            else { emgBanner.style.display = 'none'; }

            // Sync Button States
            document.querySelectorAll('.emg-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(`btn-emg-${data.override || 0}`).classList.add('active');

            document.getElementById('btn-normal-hour').classList.toggle('active', !data.isPeakHour);
            document.getElementById('btn-peak-hour').classList.toggle('active', !!data.isPeakHour);

            // Data UI Updates
            document.getElementById('val-phase').textContent = data.phase;
            document.getElementById('val-time-left').textContent = data.timeLeft;
            document.getElementById('val-total-peds').textContent = data.totalPeds;
            document.getElementById('val-total-cycles').textContent = data.totalCycles;
            document.getElementById('val-ir-timer').textContent = data.irDurationSec || 0;
            document.getElementById('val-ir').textContent = data.irActive ? "OBSTRUCTED" : "CLEAR";

            // Traffic Lights
            ['car-red', 'car-yellow', 'car-green', 'ped-red', 'ped-green'].forEach(id => {
                document.getElementById(id).className = 'bulb';
            });
            if (data.cColor) document.getElementById(`car-${data.cColor}`).classList.add(`${data.cColor}-active`);
            if (data.pColor) document.getElementById(`ped-${data.pColor}`).classList.add(`${data.pColor}-active`);
        }
    });

    onValue(ref(db, 'controls'), (snapshot) => {
        const controls = snapshot.val() || { override: 0, peakHour: false };
        currentData.override = controls.override;
        currentData.isPeakHour = controls.peakHour;
    });
}

// Button Click Handlers (Write to DB)
function writeControl(node, value) {
    if (!isAdmin) return alert("Admin Privileges Required.");
    set(ref(db, `controls/${node}`), value);
}

document.getElementById('btn-emg-0').onclick = () => writeControl('override', 0);
document.getElementById('btn-emg-1').onclick = () => writeControl('override', 1);
document.getElementById('btn-emg-2').onclick = () => writeControl('override', 2);

document.getElementById('btn-normal-hour').onclick = () => writeControl('peakHour', false);
document.getElementById('btn-peak-hour').onclick = () => writeControl('peakHour', true);

// Center-Aligned PDF Generation
document.getElementById('download-pdf-btn').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Centered Headers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Kalasalingam Academy of Research and Education", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Department of Computer Science Engineering / IT", pageWidth / 2, 27, { align: "center" });
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("IoT Traffic Node Analytics & Hardware Diagnostics", pageWidth / 2, 38, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Timestamp: ${new Date().toLocaleString()}`, pageWidth / 2, 45, { align: "center" });

    doc.autoTable({
        startY: 50,
        head: [['Metric / Sensor', 'Recorded Value']],
        body: [
            ['Total Pedestrians Today', String(currentData.totalPeds || 0)],
            ['Total Signal Cycles', String(currentData.totalCycles || 0)],
            ['Current Waiting Queue', String(currentData.pedCount || 0)],
            ['Hour Mode', currentData.isPeakHour ? 'Peak Hour (+30s)' : 'Normal Hour'],
            ['IR Sensor State', currentData.irActive ? 'Obstructed (LOW)' : 'Clear (HIGH)'],
            ['Emergency Mode Active', currentData.override !== 0 ? 'YES' : 'NO']
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], halign: 'center' },
        bodyStyles: { halign: 'center' },
        styles: { fontSize: 11, cellPadding: 5 }
    });

    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Data Visualization: Volume Bar Chart", pageWidth / 2, finalY, { align: "center" });

    // Clean, Centered Bar Chart
    const startX = (pageWidth - 100) / 2; // Center a 100mm wide chart area
    doc.setFillColor(41, 128, 185); // Blue
    doc.rect(startX, finalY + 10, Math.min((currentData.totalPeds || 0), 100), 10, "F");
    doc.text("Pedestrians", startX - 30, finalY + 17);

    doc.setFillColor(46, 213, 115); // Green
    doc.rect(startX, finalY + 25, Math.min((currentData.totalCycles || 0), 100), 10, "F");
    doc.text("Cycles", startX - 30, finalY + 32);

    doc.save("Traffic_Report.pdf");
});