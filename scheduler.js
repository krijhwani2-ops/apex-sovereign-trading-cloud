import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SENTINEL_SCRIPT = path.join(__dirname, 'run_master_sentinel.js');
const ENHANCER_SCRIPT = path.join(__dirname, 'run_adaptive_enhancer.js');
const FORENSIC_SCRIPT = path.join(__dirname, 'scripts', 'run_eod_forensic_audit.js');


let isTaskRunning = false;

function getISTDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
}

function formatIST(date = getISTDate()) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
}

function runScript(scriptPath, taskName) {
  return new Promise((resolve) => {
    if (isTaskRunning) {
      console.log(`[${formatIST()}] ⏳ Task '${taskName}' queued - another process is currently active.`);
      return resolve(false);
    }

    isTaskRunning = true;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🚀 [SCHEDULER TRIGGER] Running: ${taskName}`);
    console.log(`⏰ Time: ${formatIST()} IST`);
    console.log(`${'═'.repeat(70)}\n`);

    const child = spawn('node', [scriptPath], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      isTaskRunning = false;
      console.log(`\n✅ [${formatIST()}] Task '${taskName}' completed with code: ${code}`);
      console.log(`${'═'.repeat(70)}\n`);
      resolve(true);
    });

    child.on('error', (err) => {
      isTaskRunning = false;
      console.error(`❌ [${formatIST()}] Task '${taskName}' encountered error:`, err.message);
      resolve(false);
    });
  });
}

// Track last executed days/slots to prevent duplicate triggers in the same minute
let lastMorningScanDate = '';
let lastForensicScanDate = '';
let lastEodScanDate = '';
let lastEnhancerMinute = -1;

async function checkAndExecuteSchedule() {
  const ist = getISTDate();
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const dayOfWeek = ist.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // 1. Morning Market Scan: Mon-Fri at 09:30 IST
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hours === 9 && minutes === 30 && lastMorningScanDate !== dateStr) {
    lastMorningScanDate = dateStr;
    console.log(`🎯 Triggering Morning Market Scan for ${dateStr}...`);
    await runScript(SENTINEL_SCRIPT, 'Morning Market Scan (09:30 AM IST)');
  }

  // 2. Post-Market EOD Loss Forensic & Auto-Improvement Audit: Mon-Fri at 16:00 (04:00 PM IST)
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hours === 16 && minutes === 0 && lastForensicScanDate !== dateStr) {
    lastForensicScanDate = dateStr;
    console.log(`🔬 Triggering Post-Market EOD Forensic Loss Autopsy & Auto-Healing for ${dateStr}...`);
    await runScript(FORENSIC_SCRIPT, 'Post-Market EOD Forensic & Auto-Healing (04:00 PM IST)');
  }

  // 3. EOD Master Sentinel Audit: Daily at 21:00 (9:00 PM IST)
  if (hours === 21 && minutes === 0 && lastEodScanDate !== dateStr) {
    lastEodScanDate = dateStr;
    console.log(`🌙 Triggering EOD Master Sentinel Audit for ${dateStr}...`);
    await runScript(SENTINEL_SCRIPT, 'EOD Master Sentinel Audit (09:00 PM IST)');
  }


  // 3. AI Accuracy Enhancer: Every 10 Minutes (e.g. :00, :10, :20, :30, :40, :50)
  if (minutes % 10 === 0 && lastEnhancerMinute !== minutes) {
    lastEnhancerMinute = minutes;
    console.log(`🧠 Triggering 10-Minute AI Accuracy Enhancer...`);
    await runScript(ENHANCER_SCRIPT, 'AI Accuracy Enhancer (10-Min Cycle)');
  }
}

console.log(`\n${'═'.repeat(74)}`);
console.log(`⚡ APEX-OMNIVERSE SOVEREIGN TITAN v12.0 — MASTER PRODUCTION SCHEDULER`);
console.log(`🕒 Scheduler Started at: ${formatIST()} IST`);
console.log(`📋 Active Production Jobs:`);
console.log(`   1. 🌅 Morning Market Scan    : 09:30 AM IST (Monday to Friday)`);
console.log(`   2. 🌙 EOD Master Sentinel    : 09:00 PM IST (Daily)`);
console.log(`   3. 🧠 AI Accuracy Enhancer   : Every 10 Minutes (*/10 * * * *)`);
console.log(`${'═'.repeat(74)}\n`);

// Run an initial quick health-check run of the enhancer on startup
runScript(ENHANCER_SCRIPT, 'Startup AI Accuracy Calibration').then(() => {
  console.log(`[${formatIST()}] 📡 Scheduler daemon is now live and listening for triggers...`);
});

// Check scheduler heartbeat every 20 seconds
setInterval(checkAndExecuteSchedule, 20000);
