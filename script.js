import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCbPc8ke55lrodJU1q_YyQvj0oHrtvcy9k",
    authDomain: "smart-pedestrian-system-fef41.firebaseapp.com",
    databaseURL: "https://smart-pedestrian-system-fef41-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "smart-pedestrian-system-fef41",
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

// Navigation Handler
document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.id === 'logout-btn') return;
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// Authentication & Role Routing
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';

        isAdmin = (user.email || "").endsWith(ADMIN_DOMAIN);
        const roleMsg = document.getElementById('role-warning');

        const hourNavBtn = document.querySelector('[data-target="sec-hour"]');
        const emgNavBtn = document.querySelector('[data-target="sec-emergency"]');

        if (isAdmin) {
            roleMsg.textContent = "✓ Admin Mode: Full hardware control enabled.";
            roleMsg.style.color = "var(--green-glow)";
            if (hourNavBtn) hourNavBtn.style.display = 'inline-block';
            if (emgNavBtn) emgNavBtn.style.display = 'inline-block';
        } else {
            roleMsg.textContent = "🔒 Viewer Mode: Read-only access enabled.";
            roleMsg.style.color = "var(--red-glow)";
            if (hourNavBtn) hourNavBtn.style.display = 'none';
            if (emgNavBtn) emgNavBtn.style.display = 'none';

            // Default viewers to traffic visualizer tab
            document.querySelector('[data-target="sec-traffic"]').click();
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

// Realtime Synchronization
function startDatabaseListener() {
    // 1. Listen to Controls Node (/controls)
    onValue(ref(db, 'controls'), (snapshot) => {
        const controls = snapshot.val() || { override: 0, peakHour: false };
        currentData.override = controls.override;
        currentData.isPeakHour = controls.peakHour;

        // Sync Emergency Alert Banner
        const emgBanner = document.getElementById('emergency-alert-banner');
        const emgText = document.getElementById('emergency-mode-text');
        if (controls.override === 1) {
            emgBanner.style.display = 'block';
            emgText.textContent = "HOLD CAR GREEN";
        } else if (controls.override === 2) {
            emgBanner.style.display = 'block';
            emgText.textContent = "HOLD PED GREEN";
        } else {
            emgBanner.style.display = 'none';
        }

        // Sync Control Buttons Active Highlight
        document.querySelectorAll('.emg-btn').forEach(b => b.classList.remove('active'));
        const activeEmgBtn = document.getElementById(`btn-emg-${controls.override || 0}`);
        if (activeEmgBtn) activeEmgBtn.classList.add('active');

        document.getElementById('btn-normal-hour').classList.toggle('active', !controls.peakHour);
        document.getElementById('btn-peak-hour').classList.toggle('active', !!controls.peakHour);
    });

    // 2. Listen to Status Telemetry Node (/status)
    onValue(ref(db, 'status'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            Object.assign(currentData, data);

            // Display Pedestrian Count
            document.getElementById('val-ped-count').textContent = data.pedCount;

            // Display Anomaly Alerts
            const isAnomaly = data.irAnomaly || data.pedThresholdReached;
            document.getElementById('system-alert-banner').style.display = isAnomaly ? 'block' : 'none';
            document.getElementById('val-buzzer-status').textContent = isAnomaly ? "ACTIVE (BUZZER)" : "OFF";
            document.getElementById('val-buzzer-status').style.color = isAnomaly ? "red" : "green";

            // Signal Metrics
            document.getElementById('val-phase').textContent = data.phase;
            document.getElementById('val-time-left').textContent = data.timeLeft;
            document.getElementById('val-total-peds').textContent = data.totalPeds;
            document.getElementById('val-total-cycles').textContent = data.totalCycles;
            document.getElementById('val-ir-timer').textContent = data.irDurationSec || 0;
            document.getElementById('val-ir').textContent = data.irActive ? "OBSTRUCTED" : "CLEAR";

            // Light Bulbs
            ['car-red', 'car-yellow', 'car-green', 'ped-red', 'ped-green'].forEach(id => {
                document.getElementById(id).className = 'bulb';
            });
            if (data.cColor) document.getElementById(`car-${data.cColor}`).classList.add(`${data.cColor}-active`);
            if (data.pColor) document.getElementById(`ped-${data.pColor}`).classList.add(`${data.pColor}-active`);
        }
    });
}

// Database Writes
function writeControl(node, value) {
    if (!isAdmin) return alert("Admin Privileges Required.");
    set(ref(db, `controls/${node}`), value);
}

document.getElementById('btn-emg-0').onclick = () => writeControl('override', 0);
document.getElementById('btn-emg-1').onclick = () => writeControl('override', 1);
document.getElementById('btn-emg-2').onclick = () => writeControl('override', 2);

document.getElementById('btn-normal-hour').onclick = () => writeControl('peakHour', false);
document.getElementById('btn-peak-hour').onclick = () => writeControl('peakHour', true);

// PDF Report Generation
document.getElementById('download-pdf-btn').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Smart Pedestrian Crossing System", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("ECE100 - IoT Sensors and Devices", pageWidth / 2, 27, { align: "center" });
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
            ['Emergency Mode Active', (currentData.override && currentData.override !== 0) ? 'YES' : 'NO']
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

    const startX = (pageWidth - 100) / 2;
    doc.setFillColor(41, 128, 185);
    doc.rect(startX, finalY + 10, Math.min((currentData.totalPeds || 0), 100), 10, "F");
    doc.text("Pedestrians", startX - 30, finalY + 17);

    doc.setFillColor(46, 213, 115);
    doc.rect(startX, finalY + 25, Math.min((currentData.totalCycles || 0), 100), 10, "F");
    doc.text("Cycles", startX - 30, finalY + 32);

    doc.save("Traffic_Report.pdf");
});