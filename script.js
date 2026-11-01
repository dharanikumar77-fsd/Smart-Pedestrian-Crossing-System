import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ===================================================
// PASTE YOUR FIREBASE WEB APP CONFIGURATION HERE
// ===================================================
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

// DOM References
const loginSec = document.getElementById('login-section');
const appSec = document.getElementById('app-section');
const errorMsg = document.getElementById('error-message');
const tabControlBtn = document.getElementById('tab-control');
const tabDataBtn = document.getElementById('tab-data');
const viewControl = document.getElementById('view-control');
const viewData = document.getElementById('view-data');
const overrideSelect = document.getElementById('override-select');
const roleWarning = document.getElementById('role-warning');

// Alert Banner Elements
const alertBanner = document.getElementById('system-alert-banner');
const alertText = document.getElementById('system-alert-text');

let currentData = {};
let lastSyncTimestamp = 0;
let anomalyLogCount = 0;

// --- Tab Navigation Handlers ---
tabControlBtn.addEventListener('click', () => {
    viewControl.style.display = 'flex';
    viewData.style.display = 'none';
    tabControlBtn.classList.add('active');
    tabDataBtn.classList.remove('active');
});

tabDataBtn.addEventListener('click', () => {
    viewControl.style.display = 'none';
    viewData.style.display = 'flex';
    tabDataBtn.classList.add('active');
    tabControlBtn.classList.remove('active');
});

// --- Domain-Based Multi-User Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSec.style.display = 'none';
        appSec.style.display = 'block';

        const userEmail = user.email || "";

        if (userEmail.endsWith(ADMIN_DOMAIN)) {
            // ADMIN PRIVILEGES (@admin.com)
            tabControlBtn.style.display = 'inline-block';
            overrideSelect.disabled = false;
            roleWarning.textContent = "Admin privileges active. Full hardware control enabled.";
            roleWarning.style.color = "#27ae60";
        } else {
            // VIEW-ONLY PRIVILEGES (All other domains)
            tabControlBtn.style.display = 'none';
            overrideSelect.disabled = true;
            roleWarning.textContent = "View-only mode active. Hardware control restricted to administrators.";
            roleWarning.style.color = "#c0392b";

            // Force view to Data & Reports tab for non-admins
            viewControl.style.display = 'none';
            viewData.style.display = 'flex';
            tabDataBtn.classList.add('active');
            tabControlBtn.classList.remove('active');
        }

        startDatabaseListener();
    } else {
        loginSec.style.display = 'block';
        appSec.style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            errorMsg.style.display = 'block';
            errorMsg.textContent = "Login Failed: " + error.message;
        });
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- Realtime Database Sync & Anomaly Monitoring ---
function startDatabaseListener() {
    const statusRef = ref(db, 'status');
    const overrideRef = ref(db, 'controls/override');

    onValue(statusRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentData = data;
            lastSyncTimestamp = Date.now();

            // 1. Check Hardware Anomaly Status (IR > 10s / Buzzer Triggered)
            const irDuration = data.irDurationSec || 0;
            const isAnomaly = data.irAnomaly || (irDuration > 10);

            if (isAnomaly) {
                alertBanner.style.display = 'flex';
                alertText.textContent = `CRITICAL WARNING: Pedestrian IR Sensor obstructed for ${irDuration}s! Hardware Buzzer Active.`;
                document.getElementById('val-buzzer-status').textContent = "ACTIVE (BUZZER)";
                document.getElementById('val-buzzer-status').className = "status-badge badge-alert";
                anomalyLogCount++;
            } else {
                alertBanner.style.display = 'none';
                document.getElementById('val-buzzer-status').textContent = "OFF";
                document.getElementById('val-buzzer-status').className = "status-badge badge-ok";
            }

            // 2. Render Text Metrics across both dashboards
            document.getElementById('val-phase').textContent = data.phase;
            document.getElementById('val-time-left').textContent = data.timeLeft;
            document.getElementById('val-ir-timer').textContent = `${irDuration}s`;

            const irEl = document.getElementById('val-ir');
            irEl.textContent = data.irActive ? "OBSTRUCTED (LOW)" : "CLEAR (HIGH)";
            irEl.style.color = data.irActive ? "#e74c3c" : "#27ae60";

            document.getElementById('val-ped-count').textContent = data.pedCount;
            document.getElementById('val-total-peds').textContent = data.totalPeds;
            document.getElementById('val-total-cycles').textContent = data.totalCycles;
            document.getElementById('val-anomaly-count').textContent = anomalyLogCount;
            document.getElementById('val-time-str').textContent = data.timeStr;

            // 3. Update Web Data Visualization Progress Bars
            const maxQueueScale = 15;
            const pedPct = Math.min((data.pedCount / maxQueueScale) * 100, 100);
            document.getElementById('bar-ped-count').style.width = `${pedPct}%`;

            const maxPedsScale = 100;
            const totalPedsPct = Math.min((data.totalPeds / maxPedsScale) * 100, 100);
            document.getElementById('bar-total-peds').style.width = `${totalPedsPct}%`;

            // 4. Update Vehicle Traffic Bulbs
            const cRed = document.getElementById('car-red');
            const cYellow = document.getElementById('car-yellow');
            const cGreen = document.getElementById('car-green');
            cRed.classList.remove('red-active');
            cYellow.classList.remove('yellow-active');
            cGreen.classList.remove('green-active');
            if (data.cColor === "red") cRed.classList.add('red-active');
            if (data.cColor === "yellow") cYellow.classList.add('yellow-active');
            if (data.cColor === "green") cGreen.classList.add('green-active');

            // 5. Update Pedestrian Signal Bulbs
            const pRed = document.getElementById('ped-red');
            const pGreen = document.getElementById('ped-green');
            pRed.classList.remove('red-active');
            pGreen.classList.remove('green-active');
            if (data.pColor === "red") pRed.classList.add('red-active');
            if (data.pColor === "green") pGreen.classList.add('green-active');
        }
    });

    // Write Emergency Override Selection
    overrideSelect.addEventListener('change', (e) => {
        set(overrideRef, parseInt(e.target.value)).catch(() => {
            alert("Permission Denied: Only admin accounts can issue overrides.");
        });
    });
}

// Client Heartbeat Health Check (Hardware Offline Detection)
setInterval(() => {
    if (lastSyncTimestamp > 0 && (Date.now() - lastSyncTimestamp > 10000)) {
        alertBanner.style.display = 'flex';
        alertText.textContent = "OFFLINE ALERT: ESP32 Traffic Node Connection Lost (>10s)!";
    }
}, 3000);

// --- Enhanced PDF Report Generation with Visual Charts ---
document.getElementById('download-pdf-btn').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Academic Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Kalasalingam Academy of Research and Education", 105, 18, null, null, "center");

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Department of Computer Science Engineering / IT", 105, 25, null, null, "center");

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("IoT Traffic Node Analytics & Safety Diagnostic Report", 105, 36, null, null, "center");

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleString();
    doc.text(`Report Timestamp: ${dateStr}`, 14, 48);

    // Primary Analytics Table
    doc.autoTable({
        startY: 54,
        head: [['System Metric / Sensor', 'Recorded Status / Value']],
        body: [
            ['Total Pedestrians Served Today', String(currentData.totalPeds || 0)],
            ['Total Signal Cycles Completed', String(currentData.totalCycles || 0)],
            ['Current Waiting Queue', String(currentData.pedCount || 0)],
            ['IR Sensor State', currentData.irActive ? 'Obstructed (LOW)' : 'Clear (HIGH)'],
            ['Continuous Obstruction Duration', `${currentData.irDurationSec || 0} seconds`],
            ['Hardware Buzzer Alarm', currentData.irAnomaly ? 'TRIGGERED (ACTIVE)' : 'NORMAL (OFF)'],
            ['Current Signal Phase', currentData.phase || 'N/A'],
            ['Last Database Sync', currentData.timeStr || 'N/A']
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 4 }
    });

    // Drawing Data Visualization Graphic directly on PDF Canvas
    const finalY = doc.lastAutoTable.finalY + 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Data Visualization: Daily Traffic Volume Distribution", 14, finalY);

    // Outer Graph Frame
    doc.setDrawColor(160, 160, 160);
    doc.setFillColor(245, 247, 250);
    doc.rect(14, finalY + 5, 182, 55, "FD");

    // Bar 1: Pedestrians Volume
    const pedsVal = currentData.totalPeds || 0;
    const pedsBarWidth = Math.min((pedsVal / 100) * 120, 120);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Pedestrian Volume:", 20, finalY + 22);
    doc.setFillColor(41, 128, 185); // Blue
    doc.rect(70, finalY + 16, Math.max(pedsBarWidth, 2), 8, "F");
    doc.text(`${pedsVal} Peds`, 75 + Math.max(pedsBarWidth, 2), finalY + 22);

    // Bar 2: Signal Cycles Volume
    const cyclesVal = currentData.totalCycles || 0;
    const cyclesBarWidth = Math.min((cyclesVal / 50) * 120, 120);
    doc.text("Traffic Cycles:", 20, finalY + 37);
    doc.setFillColor(46, 213, 115); // Green
    doc.rect(70, finalY + 31, Math.max(cyclesBarWidth, 2), 8, "F");
    doc.text(`${cyclesVal} Cycles`, 75 + Math.max(cyclesBarWidth, 2), finalY + 37);

    // Bar 3: Anomaly Event Count
    const anomalyWidth = Math.min((anomalyLogCount / 10) * 120, 120);
    doc.text("Sensor Alerts:", 20, finalY + 52);
    doc.setFillColor(255, 71, 87); // Red
    doc.rect(70, finalY + 46, Math.max(anomalyWidth, 2), 8, "F");
    doc.text(`${anomalyLogCount} Incidents`, 75 + Math.max(anomalyWidth, 2), finalY + 52);

    doc.save("Smart_Traffic_Analytics_Report.pdf");
});