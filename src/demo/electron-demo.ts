import { app, BrowserWindow, globalShortcut, Menu, ipcMain, clipboard } from 'electron'
import { join } from 'node:path'
import { OverlayController, OVERLAY_WINDOW_OPTS } from '../'
import { NutJsService } from './nutjs-service'
import { randomUUID } from 'crypto'

app.disableHardwareAcceleration()

let window: BrowserWindow
const nutService = new NutJsService()

nutService.on('status', (status) => {
  if (window && !window.isDestroyed()) {
    window.webContents.send('nutjs-status', status)
  }
})

const toggleMouseKey = 'CmdOrCtrl+J'
const toggleShowKey = 'CmdOrCtrl+K'

function createWindow() {
  if (window) return
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    ...OVERLAY_WINDOW_OPTS
  })

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline';">
  <title>Overlay Demo</title>
  <style>
    :root {
      --glass-bg: rgba(20, 20, 20, 0.85);
      --glass-border: rgba(255, 255, 255, 0.1);
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --text-main: #ffffff;
      --text-muted: #a1a1aa;
      --danger: #ef4444;
      --success: #22c55e;
      --warning: #f59e0b;
    }
    
    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text-main);
      overflow: hidden;
      background: transparent;
    }

    /* Hide UI elements when hidden-ui class is present (keep passthrough warning visible) */
    body.hidden-ui .panel,
    body.hidden-ui .overlay-guide,
    body.hidden-ui .heavy-list {
      display: none !important;
    }
    body.hidden-ui #passthroughWarning {
      display: none !important;
    }

    #passthroughWarning {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 30px;
      border-radius: 12px;
      pointer-events: none;
      z-index: 9999;
      text-align: center;
    }
    #passthroughWarning h3 { margin: 0 0 10px 0; }

    /* Floating Control Panel */
    .panel {
      position: fixed;
      top: 20px;
      left: 20px;
      width: 600px;
      min-width: 600px;
      max-width: 600px;
      min-height: 200px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 100;
    }
    body.mode-transition .panel {
      box-shadow: 0 0 0 2px var(--accent), 0 10px 36px rgba(0,0,0,0.35);
    }
    body.mode-transition .status-dot.active { box-shadow: 0 0 10px var(--success); }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 12px;
    }

    .panel-title {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      transition: all 0.3s;
    }
    .status-dot.active { background: var(--success); box-shadow: 0 0 8px var(--success); }
    .status-dot.inactive { background: var(--danger); }

    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }

    .section-title .chev { width: 10px; height: 10px; border-right: 2px solid var(--text-muted); border-bottom: 2px solid var(--text-muted); transform: rotate(-45deg); transition: transform 0.2s; }
    .section.collapsed .section-title .chev { transform: rotate(135deg); }
    .section.collapsed > *:not(.section-title) { display: none; }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
    }

    button {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--glass-border);
      color: var(--text-main);
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
      text-align: center;
      min-width: 44px;
      min-height: 36px;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    button:active {
      transform: translateY(1px);
    }
    button:focus {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
    }
    button.primary:hover {
      background: var(--accent-hover);
    }
    button.small {
      padding: 4px 8px;
      font-size: 11px;
    }

    .key-hint {
      font-size: 9px;
      background: rgba(0,0,0,0.3);
      padding: 2px 4px;
      border-radius: 3px;
      color: var(--text-muted);
      margin-left: 4px;
    }

    /* Slider */
    .slider-container {
      margin: 8px 0;
    }
    .slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 4px;
    }
    input[type="range"] {
      width: 100%;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
      -webkit-appearance: none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
    }

    /* Input */
    input[type="text"], select {
      width: 100%;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--glass-border);
      border-radius: 6px;
      color: var(--text-main);
      font-size: 12px;
    }
    input[type="text"]:focus, select:focus {
      outline: none;
      border-color: var(--accent);
    }

    /* Event Log */
    .log-container {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      height: 120px;
      overflow-y: auto;
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 10px;
      padding: 8px;
      border: 1px solid var(--glass-border);
      -webkit-font-smoothing: antialiased;
      will-change: auto;
    }
    .log-entry {
      margin-bottom: 2px;
      color: var(--text-muted);
      border-bottom: 1px solid rgba(255,255,255,0.03);
      padding-bottom: 2px;
    }
    .log-entry span.time { color: #64748b; margin-right: 6px; }
    .log-entry span.type { color: var(--accent); margin-right: 6px; font-weight: bold; }
    .log-entry span.info { color: var(--text-main); }

    /* Metrics */
    .metric-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .metric-value {
      font-family: monospace;
      color: var(--accent);
      font-size: 10px;
    }

    /* Heavy Mode List */
    .heavy-list {
      position: fixed;
      right: 20px;
      top: 20px;
      bottom: 20px;
      width: 200px;
      overflow-y: auto;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 10px;
      display: none;
      z-index: 100;
      border: 1px solid var(--glass-border);
    }
    .heavy-item {
      padding: 4px;
      border-bottom: 1px solid var(--glass-border);
      font-size: 11px;
    }

    /* Tour */
    .tour-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000;
    }
    .tour-tooltip {
      position: fixed;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      border: 2px solid var(--accent);
      border-radius: 8px;
      padding: 16px;
      max-width: 300px;
      z-index: 1001;
    }
    .tour-tooltip h4 {
      margin: 0 0 8px 0;
      color: var(--accent);
    }
    .tour-tooltip p {
      margin: 0 0 12px 0;
      font-size: 13px;
    }

    /* Highlight Border Feature */
    body.border-active {
      box-shadow: inset 0 0 0 4px var(--danger);
      transition: box-shadow 0.3s;
    }

    /* Fake Cursor for Auto Clicker */
    #fakeCursor {
      position: fixed;
      width: 20px;
      height: 20px;
      background: rgba(255, 0, 0, 0.8);
      border: 2px solid white;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      display: none;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      transition: top 0.2s, left 0.2s;
    }

    /* Click Ripple Effect */
    .click-effect {
      position: fixed;
      width: 40px;
      height: 40px;
      border: 2px solid var(--accent);
      border-radius: 50%;
      animation: ripple 0.5s linear forwards;
      pointer-events: none;
      z-index: 9998;
    }

    @keyframes ripple {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(2); opacity: 0; }
    }

    /* Toast Notification */
    #toastMsg {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 10000;
      border: 1px solid var(--glass-border);
    }
    #toastMsg.show { opacity: 1; }

    /* Sticky Help Button */
    .sticky-help {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 1002;
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 12px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    }
    .sticky-help.hidden { display: none; }
    .sticky-help:hover { background: var(--accent-hover); }

  </style>
</head>
<body>

  <div id="passthroughWarning">
    <h3>⚠️ Passthrough Mode</h3>
    <p>Press <strong>${toggleMouseKey}</strong> to interact</p>
  </div>

  <div class="panel" id="mainPanel">
    <div class="panel-header">
      <div class="panel-title">
        <div class="status-dot active" id="statusDot"></div>
        Electron Overlay Demo
      </div>
      <div style="font-size: 10px; color: var(--text-muted);">v4.0.1</div>
    </div>

    <!-- Core Controls -->
    <div class="section" id="sectionCore">
      <div class="section-title">Core Controls <span class="chev"></span></div>
      <div class="grid-2">
        <button id="btnToggleClick">
          Interactive <span class="key-hint">${toggleMouseKey}</span>
        </button>
        <button id="btnToggleVis">
          Visibility <span class="key-hint">${toggleShowKey}</span>
        </button>
      </div>
    </div>


    <!-- Opacity Control -->
    <div class="section" id="sectionAppearance">
      <div class="section-title">Appearance <span class="chev"></span></div>
      <div class="slider-container">
        <div class="slider-label">
          <span>Background Opacity</span>
          <span id="opacityValue">85%</span>
        </div>
        <input type="range" id="opacitySlider" min="0" max="100" value="85">
      </div>
    </div>

    <!-- Target Window -->
    <div class="section" id="sectionTarget">
      <div class="section-title">Target Window <span class="chev"></span></div>
      <select id="targetSelect">
        <option value="Untitled">Untitled (Mac TextEdit)</option>
        <option value="Notepad">Notepad (Windows)</option>
        <option value="Code">Visual Studio Code</option>
        <option value="custom">Custom...</option>
      </select>
      <input type="text" id="customTarget" placeholder="Enter window title..." style="margin-top: 6px; display: none;">
      <button id="btnAttach" style="width: 100%; margin-top: 6px;">Reattach</button>
    </div>

    <!-- Positioning -->
    <div class="section" id="sectionPosition">
      <div class="section-title">Positioning <span class="chev"></span></div>
      <div class="grid-3">
        <button class="small" id="btnTopLeft">⬉ TL</button>
        <button class="small" id="btnCenter">⊙ Center</button>
        <button class="small" id="btnTopRight">⬈ TR</button>
      </div>
      <div class="grid-3" style="margin-top: 4px;">
        <button class="small" id="btnBottomLeft">⬋ BL</button>
        <button class="small" id="btnResize">↔ Resize</button>
        <button class="small" id="btnBottomRight">⬊ BR</button>
      </div>
    </div>

    <!-- Performance Test -->
    <div class="section" id="sectionPerf">
      <div class="section-title">Performance <span class="chev"></span></div>
      <button id="btnHeavy" style="width: 100%;">Toggle Heavy Render Test</button>
      <div class="metric-row" style="margin-top: 8px;">
        <span>Render Items</span>
        <span class="metric-value" id="valItems">0</span>
      </div>
    </div>

    <!-- Status -->
    <div class="section" id="sectionStatus">
      <div class="section-title">Status <span class="chev"></span></div>
      <div class="metric-row">
        <span>Mode</span>
        <span class="metric-value" id="valMode">Interactive</span>
      </div>
      <div class="metric-row">
        <span>Target Focus</span>
        <span class="metric-value" id="valFocus">Unknown</span>
      </div>
      <div class="metric-row">
        <span>Bounds</span>
        <span class="metric-value" id="valBounds">-</span>
      </div>
      <div class="metric-row">
        <span>Events/sec</span>
        <span class="metric-value" id="valFps">0</span>
      </div>
      <div class="metric-row">
        <span>Attach Time</span>
        <span class="metric-value" id="valAttachTime">-</span>
      </div>
    </div>

    <!-- Event Log -->
    <div class="section" id="sectionLog">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div class="section-title" style="margin: 0;">Event Log <span class="chev"></span></div>
        <button class="small" id="btnClearLog">Clear</button>
      </div>
      <div class="log-container" id="eventLog"></div>
    </div>

    <!-- Tour -->
    <div class="section" id="sectionHelp">
      <div class="section-title">Help <span class="chev"></span></div>
      <button id="btnTour" style="width: 100%;">🎯 Start Guided Tour</button>
    </div>

    <!-- Features -->
    <div class="section" id="sectionFeatures">
      <div class="section-title">Features <span class="chev"></span></div>
      <div class="grid-2">
        <button id="btnBorder">Toggle Border</button>
        <button id="btnAutoClick">Auto Clicker</button>
      </div>
      <div style="display: flex; gap: 4px; margin-top: 6px;">
        <input type="text" id="inputMsg" placeholder="Text to simulate..." style="flex: 1;">
        <button id="btnSendText" class="small">Send</button>
      </div>
    </div>
  </div>

  <div class="heavy-list" id="heavyList"></div>
  <div id="fakeCursor"></div>
  <div id="toastMsg">Message sent</div>
  <button class="sticky-help hidden" id="stickyHelp" aria-label="Open Help (CmdOrCtrl+/)">Help</button>

  <!-- Tour Overlay -->
  <div class="tour-overlay" id="tourOverlay">
    <div class="tour-tooltip" id="tourTooltip">
      <h4 id="tourTitle">Title</h4>
      <p id="tourText">Text</p>
      <div style="display: flex; gap: 8px;">
        <button class="small" id="btnTourPrev">← Previous</button>
        <button class="small primary" id="btnTourNext" style="flex: 1;">Next →</button>
        <button class="small" id="btnTourSkip">Skip</button>
      </div>
    </div>
  </div>

  <script>
    const ipc = window.overlay;

    // UI Elements
    const statusDot = document.getElementById('statusDot');
    const valMode = document.getElementById('valMode');
    const valFocus = document.getElementById('valFocus');
    const valBounds = document.getElementById('valBounds');
    const valFps = document.getElementById('valFps');
    const valItems = document.getElementById('valItems');
    const valAttachTime = document.getElementById('valAttachTime');
    const eventLog = document.getElementById('eventLog');
    const heavyList = document.getElementById('heavyList');
    const mainPanel = document.getElementById('mainPanel');
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityValue = document.getElementById('opacityValue');
    const targetSelect = document.getElementById('targetSelect');
    const customTarget = document.getElementById('customTarget');
    const stickyHelp = document.getElementById('stickyHelp');

    // State
    let isInteractive = true;
    let isUIHiddenManual = false;
    let isSending = false;
    let eventCount = 0;
    let lastTime = Date.now();
    let attachStartTime = 0;
    let hasAttached = false;

    // FPS Counter
    setInterval(() => {
      const now = Date.now();
      if (now - lastTime >= 1000) {
        valFps.textContent = eventCount;
        eventCount = 0;
        lastTime = now;
      }
    }, 1000);

    function log(type, info) {
      const div = document.createElement('div');
      div.className = 'log-entry';
      const time = new Date().toLocaleTimeString();
      div.innerHTML = \`<span class="time">\${time}</span><span class="type">\${type}</span><span class="info">\${info}</span>\`;
      eventLog.prepend(div);
      if (eventLog.children.length > 100) eventLog.lastChild.remove();
      eventCount++;
    }

    // Core Controls
    document.getElementById('btnToggleClick').onclick = () => {
      try {
        log('UI', 'Interactive button clicked')
        ipc.send('action', 'toggle-click')
      } catch (err) {
        log('ERROR', 'Failed to send toggle-click')
      }
    };
    document.getElementById('btnToggleVis').onclick = () => {
      try {
        log('UI', 'Visibility button clicked')
        ipc.send('action', 'toggle-visibility')
      } catch (err) {
        log('ERROR', 'Failed to send toggle-visibility')
      }
    };
    document.getElementById('btnHeavy').onclick = () => ipc.send('action', 'toggle-heavy');
    document.getElementById('btnClearLog').onclick = () => { eventLog.innerHTML = ''; log('UI', 'Log cleared'); };

    // Opacity Slider
    opacitySlider.oninput = function() {
      const val = this.value;
      opacityValue.textContent = val + '%';
      const opacity = val / 100;
      mainPanel.style.background = \`rgba(20, 20, 20, \${opacity})\`;
      log('UI', \`Opacity: \${val}%\`);
    };

    // Target Window Selector
    targetSelect.onchange = function() {
      if (this.value === 'custom') {
        customTarget.style.display = 'block';
      } else {
        customTarget.style.display = 'none';
      }
    };

    const btnAttach = document.getElementById('btnAttach');
    btnAttach.onclick = () => {
      if (hasAttached) {
        log('ERROR', 'Already attached. Restart the app to attach to a different window.');
        return;
      }
      
      const target = targetSelect.value === 'custom' ? customTarget.value : targetSelect.value;
      if (target) {
        attachStartTime = Date.now();
        ipc.send('action', 'attach', target);
        log('CMD', \`Attaching to: \${target}\`);
      }
    };

    // Positioning
    document.getElementById('btnTopLeft').onclick = () => ipc.send('action', 'position', 'top-left');
    document.getElementById('btnCenter').onclick = () => ipc.send('action', 'position', 'center');
    document.getElementById('btnTopRight').onclick = () => ipc.send('action', 'position', 'top-right');
    document.getElementById('btnBottomLeft').onclick = () => ipc.send('action', 'position', 'bottom-left');
    document.getElementById('btnBottomRight').onclick = () => ipc.send('action', 'position', 'bottom-right');
    document.getElementById('btnResize').onclick = () => ipc.send('action', 'resize');

    // Feature Controls
    document.getElementById('btnBorder').onclick = () => {
      document.body.classList.toggle('border-active');
      const isActive = document.body.classList.contains('border-active');
      log('FEAT', \`Border highlight \${isActive ? 'enabled' : 'disabled'}\`);
    };

    const inputMsg = document.getElementById('inputMsg');
    const toastMsg = document.getElementById('toastMsg');
    const btnSendText = document.getElementById('btnSendText');

    btnSendText.onclick = () => {
      const text = inputMsg.value;
      if (!text || isSending) return;
      
      isSending = true;
      btnSendText.disabled = true;
      btnSendText.textContent = '...';
      
      // Hide warning immediately to prevent overlap during focus switch
      document.getElementById('passthroughWarning').style.display = 'none';

      log('INPUT', \`Simulated keystrokes: "\${text}"\`);
      
      try {
        ipc.send('action', 'send-text', text)
      } catch (err) {
        log('ERROR', 'Failed to send text to target')
        isSending = false;
        btnSendText.disabled = false;
        btnSendText.textContent = 'Send';
      }
    };

    let autoClickInterval;
    const fakeCursor = document.getElementById('fakeCursor');
    document.getElementById('btnAutoClick').onclick = function() {
      if (autoClickInterval) {
        clearInterval(autoClickInterval);
        autoClickInterval = null;
        this.textContent = 'Auto Clicker';
        this.classList.remove('primary');
        fakeCursor.style.display = 'none';
        log('FEAT', 'Auto clicker stopped');
      } else {
        this.textContent = 'Stop Clicking';
        this.classList.add('primary');
        fakeCursor.style.display = 'block';
        log('FEAT', 'Auto clicker started');
        
        autoClickInterval = setInterval(() => {
          const x = Math.random() * (window.innerWidth - 50);
          const y = Math.random() * (window.innerHeight - 50);
          
          fakeCursor.style.top = y + 'px';
          fakeCursor.style.left = x + 'px';
          
          setTimeout(() => {
            // Show click effect
            const ripple = document.createElement('div');
            ripple.className = 'click-effect';
            ripple.style.top = (y - 10) + 'px';
            ripple.style.left = (x - 10) + 'px';
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
            
            log('CLICK', \`Simulated click at \${Math.floor(x)}, \${Math.floor(y)}\`);
          }, 200);
        }, 1000);
      }
    };

    // Tour
    let tourStep = 0;
    const tourSteps = [
      { title: 'Welcome!', text: 'This demo showcases the electron-overlay-window library. Click Next to start the tour.' },
      { title: 'New Features', text: 'Try the new "Features" section! Toggle border highlight, simulate text input, and test auto-clicking.' },
      { title: 'Interactive Mode', text: 'Toggle between Interactive (can click overlay) and Passthrough (clicks go through).' },
      { title: 'Opacity Control', text: 'Adjust the overlay transparency with this slider.' },
      { title: 'Target Window', text: 'Change which window the overlay attaches to.' },
      { title: 'Positioning', text: 'Move the overlay to different screen corners or resize it.' },
      { title: 'Performance Test', text: 'Test rendering performance with 1000 items.' },
      { title: 'Event Log', text: 'All overlay events are logged here in real-time.' },
    ];

    document.getElementById('btnTour').onclick = startTour;
    document.getElementById('btnTourNext').onclick = () => { tourStep++; updateTour(); };
    document.getElementById('btnTourPrev').onclick = () => { tourStep--; updateTour(); };
    document.getElementById('btnTourSkip').onclick = endTour;

    function startTour() {
      tourStep = 0;
      document.getElementById('tourOverlay').style.display = 'block';
      updateTour();
    }

    function updateTour() {
      if (tourStep >= tourSteps.length) {
        endTour();
        return;
      }
      const step = tourSteps[tourStep];
      document.getElementById('tourTitle').textContent = step.title;
      document.getElementById('tourText').textContent = step.text;
      document.getElementById('btnTourPrev').disabled = tourStep === 0;
    }

    function endTour() {
      document.getElementById('tourOverlay').style.display = 'none';
    }

    Array.from(document.querySelectorAll('.section')).forEach(sec => {
      const title = sec.querySelector('.section-title');
      if (title) title.addEventListener('click', () => sec.classList.toggle('collapsed'))
    });
    document.getElementById('sectionPerf')?.classList.add('collapsed');
    document.getElementById('sectionStatus')?.classList.add('collapsed');
    document.getElementById('sectionLog')?.classList.add('collapsed');
    document.getElementById('sectionHelp')?.classList.add('collapsed');

    function isFullyVisible(el) {
      if (!el) return true;
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
    }

    function updateHelpVisibilityIndicator() {
      const helpSection = document.getElementById('sectionHelp');
      const helpButton = document.getElementById('btnTour');
      const obscured = !isFullyVisible(helpSection) || !isFullyVisible(helpButton);
      stickyHelp.classList.toggle('hidden', !obscured);
      if (obscured) stickyHelp.title = 'Help is hidden. Click to open.';
    }

    stickyHelp.addEventListener('click', () => startTour());
    window.addEventListener('resize', updateHelpVisibilityIndicator);
    updateHelpVisibilityIndicator();

    // Panel Dimension Locking
    function lockPanelDimensions() {
      const panel = document.getElementById('mainPanel');
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const w = Math.max(600, Math.round(rect.width || 0));
        if (w > 0) {
          panel.style.width = w + 'px';
          panel.style.minWidth = w + 'px';
          panel.style.maxWidth = w + 'px';
        }
        if (panel.offsetHeight < 200) {
          panel.style.minHeight = '200px';
        }
      }
    }
    lockPanelDimensions();
    window.addEventListener('resize', () => {
      // Debounce slightly if needed, but lightweight enough
      requestAnimationFrame(lockPanelDimensions);
    });

    window.addEventListener('contextmenu', (e) => { e.preventDefault(); startTour(); });

    // IPC Listeners
    ipc.on('focus-change', (state) => {
      isInteractive = state;
      document.body.classList.add('mode-transition')
      statusDot.className = state ? 'status-dot active' : 'status-dot inactive';
      valMode.textContent = state ? 'Interactive' : 'Passthrough';
      valFocus.textContent = state ? 'Focused' : 'Blurred';
      valFocus.style.color = state ? 'var(--success)' : 'var(--text-muted)';
      
      const warning = document.getElementById('passthroughWarning');
      // Suppress warning if we are in the middle of a send operation
      if (isSending) {
        warning.style.display = 'none';
      } else {
        warning.style.display = state ? 'none' : 'block';
      }
      document.body.classList.toggle('passthrough-mode', !state);
      // Only auto-hide UI in passthrough when not manually overridden
      if (!isUIHiddenManual) {
        document.body.classList.toggle('hidden-ui', !state);
      }
      
      log('MODE', state ? 'Interactive' : 'Passthrough');
      setTimeout(() => document.body.classList.remove('mode-transition'), 180)
    });

    ipc.on('heavy-mode', (enable) => {
      heavyList.style.display = enable ? 'block' : 'none';
      heavyList.innerHTML = '';
      if (enable) {
        for(let i=0; i<1000; i++) {
          const div = document.createElement('div');
          div.className = 'heavy-item';
          div.textContent = 'Item #' + (i + 1);
          heavyList.appendChild(div);
        }
        valItems.textContent = '1000';
        log('PERF', 'Heavy mode enabled (1000 items)');
      } else {
        valItems.textContent = '0';
        log('PERF', 'Heavy mode disabled');
      }
    });

    ipc.on('overlay-event', (payload) => {
      const { type, x, y, width, height, isFullscreen } = payload;
      
      if (type === 'moveresize' || type === 'attach') {
        valBounds.textContent = x + ',' + y + ' (' + width + '×' + height + ')';
        if (type === 'attach') {
          valFocus.textContent = 'Focused';
          valFocus.style.color = 'var(--success)';
        }
        if (type === 'attach' && attachStartTime) {
          const elapsed = Date.now() - attachStartTime;
          valAttachTime.textContent = elapsed + 'ms';
          attachStartTime = 0;
          
          // Mark as attached and update button
          hasAttached = true;
          btnAttach.disabled = true;
          btnAttach.style.opacity = '0.5';
          btnAttach.style.cursor = 'not-allowed';
          btnAttach.title = 'Restart the app to attach to a different window';
        }
      }
      
      if (type === 'focus') {
        valFocus.textContent = 'Focused';
        valFocus.style.color = 'var(--success)';
        log('FOCUS', 'Target window focused');
      }
      
      if (type === 'blur') {
        valFocus.textContent = 'Blurred';
        valFocus.style.color = 'var(--text-muted)';
        log('BLUR', 'Target window blurred');
      }

      if (type === 'fullscreen') {
        log('SCREEN', isFullscreen ? 'Fullscreen' : 'Windowed');
      }
    });

    ipc.on('attach-error', (message) => {
      log('ERROR', message);
      valAttachTime.textContent = 'Failed';
      valAttachTime.style.color = 'var(--danger)';
    });

    ipc.on('ui:toggle-visibility', () => {
      try {
        // Manual override toggles regardless of interactive mode
        isUIHiddenManual = !isUIHiddenManual
        document.body.classList.toggle('hidden-ui', isUIHiddenManual)
        const hidden = document.body.classList.contains('hidden-ui')
        log('UI', hidden ? 'UI hidden (manual)' : 'UI visible (manual)')
      } catch (err) {
        log('ERROR', 'Failed to toggle UI visibility')
      }
    })

    ipc.on('ui:open-help', () => startTour());

    ipc.on('text-send', (payload) => {
      isSending = false;
      const btnSendText = document.getElementById('btnSendText');
      if (btnSendText) {
        btnSendText.disabled = false;
        btnSendText.textContent = 'Send';
      }

      if (payload && payload.ok) {
        const method = String(payload.method || 'applescript')
        log('INPUT', 'Text delivered to TextEdit (' + method + ')')
        
        // Show success toast only after actual completion
        const toastMsg = document.getElementById('toastMsg');
        const inputMsg = document.getElementById('inputMsg');
        if (toastMsg) {
          toastMsg.textContent = 'Message sent successfully';
          toastMsg.classList.add('show');
          setTimeout(() => toastMsg.classList.remove('show'), 2000);
        }
        if (inputMsg) inputMsg.value = '';

      } else {
        if (payload && payload.error === 'automation_or_accessibility_denied') {
          log('ERROR', 'Permission required: enable Automation for this app (TextEdit), and Accessibility for keystrokes')
        } else if (payload && payload.error === 'nutjs_failed') {
          log('ERROR', 'nut.js typing failed, ensure Accessibility is enabled and module is compatible')
        } else {
          log('ERROR', 'Text delivery failed')
        }
      }
    })

    ipc.on('nutjs-status', (payload) => {
      if (!payload || !payload.stage) return
      
      const cid = payload.correlationId ? '[' + payload.correlationId.slice(0, 6) + ']' : ''
      
      if (payload.stage === 'module-available') {
        log('NUT', cid + ' nut.js available')
      } else if (payload.stage === 'module-missing') {
        log('NUT', cid + ' nut.js module missing, using fallback')
      } else if (payload.stage === 'typing-start') {
        const details = payload.details || {}
        log('NUT', cid + ' Typing started (' + (details.length || 0) + ' chars): ' + (details.preview || ''))
      } else if (payload.stage === 'typing-success') {
        log('NUT', cid + ' Typing success. Confirmed.')
      } else if (payload.stage === 'typing-error') {
        const msg = String(payload.error || 'unknown error')
        log('NUT', cid + ' Typing error: ' + msg)
        if (payload.details && payload.details.stack) {
          console.error(payload.details.stack)
        }
      }
    })

  </script>
</body>
</html>
  `

  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  window.webContents.once('did-finish-load', () => {
    try {
      OverlayController.activateOverlay()
      window.webContents.send('focus-change', true)
      console.log('Overlay activated after load')
    } catch (err) {
      console.error('Failed to activate overlay after load', err)
    }
  })

  // Uncomment for debugging:
  // window.webContents.openDevTools({ mode: 'detach' })

  makeDemoInteractive()

  const targetTitle = process.platform === 'darwin' ? 'Untitled' : 'Notepad'
  attachToTarget(targetTitle)
}

function attachToTarget(title: string) {
  OverlayController.attachByTitle(
    window,
    title,
    { hasTitleBarOnMac: true }
  )

  let attachedOnce = false

    // Proxy events to renderer
    ; (OverlayController as any).events.on('attach', (e: any) => {
      attachedOnce = true
      window.webContents.send('overlay-event', { type: 'attach', ...e })
      try {
        OverlayController.activateOverlay()
        window.webContents.send('focus-change', true)
        console.log('Defaulting to interactive after attach')
      } catch (err) {
        console.error('Failed to default to interactive after attach', err)
      }
    })
    ; (OverlayController as any).events.on('moveresize', (e: any) => {
      window.webContents.send('overlay-event', { type: 'moveresize', ...e })
    })
    ; (OverlayController as any).events.on('focus', () => {
      window.webContents.send('overlay-event', { type: 'focus' })
    })
    ; (OverlayController as any).events.on('blur', () => {
      window.webContents.send('overlay-event', { type: 'blur' })
    })
    ; (OverlayController as any).events.on('fullscreen', (e: any) => {
      window.webContents.send('overlay-event', { type: 'fullscreen', isFullscreen: e.isFullscreen })
    })

  setTimeout(() => {
    if (!attachedOnce) {
      try {
        if (process.platform === 'darwin') {
          const { execFile } = require('node:child_process')
          execFile('open', ['-a', 'TextEdit'])
        } else if (process.platform === 'win32') {
          const { execFile } = require('node:child_process')
          execFile('notepad.exe')
        }
        console.log('Auto-launching target app to ensure initial attach')
      } catch (err) {
        console.error('Failed to auto-launch target app', err)
      }
    }
  }, 2000)
}

function makeDemoInteractive() {
  let isInteractable = true

  function toggleOverlayState() {
    if (window && window.webContents) {
      try { window.webContents.send('focus-change', !isInteractable) } catch { }
    }
    if (isInteractable) {
      isInteractable = false
      OverlayController.focusTarget()
      window.webContents.send('focus-change', false)
    } else {
      isInteractable = true
      OverlayController.activateOverlay()
      window.webContents.send('focus-change', true)
    }
  }



  globalShortcut.register(toggleMouseKey, toggleOverlayState)

  globalShortcut.register('CmdOrCtrl+/', () => {
    if (!window || !window.webContents) return
    window.webContents.send('ui:open-help')
  })

  function toggleVisibility() {
    if (!window || !window.webContents) {
      console.error('Window or webContents not available')
      return
    }
    try {
      window.webContents.send('ui:toggle-visibility')
      console.log('Sent ui:toggle-visibility')
    } catch (err) {
      console.error('Failed to send ui:toggle-visibility', err)
    }
  }

  function toggleAppVisibility() {
    if (!window) return
    try {
      if (window.isVisible()) {
        window.hide()
      } else {
        window.show()
        try {
          OverlayController.activateOverlay()
          window.webContents.send('focus-change', true)
        } catch { }
      }
    } catch (err) {
      console.error('Failed to toggle app visibility', err)
    }
  }

  let lastToggleVisibility = 0
  const toggleVisibilityDebounced = () => {
    const now = Date.now()
    if (now - lastToggleVisibility < 250) return
    lastToggleVisibility = now
    toggleVisibility()
  }
  const toggleAppVisibilityDebounced = () => {
    const now = Date.now()
    if (now - lastToggleVisibility < 250) return
    lastToggleVisibility = now
    toggleAppVisibility()
  }
  globalShortcut.register(toggleShowKey, toggleAppVisibilityDebounced)
  if (process.platform === 'darwin') {
    try { globalShortcut.register('Command+K', toggleAppVisibilityDebounced) } catch { }
    try { globalShortcut.register('Control+K', toggleAppVisibilityDebounced) } catch { }
  }
  try {
    const ok1 = globalShortcut.isRegistered(toggleShowKey)
    const ok2 = process.platform === 'darwin' ? globalShortcut.isRegistered('Command+K') : true
    const ok3 = process.platform === 'darwin' ? globalShortcut.isRegistered('Control+K') : true
    console.log(ok1 || ok2 || ok3 ? 'Shortcut for app visibility registered' : 'Shortcut for app visibility not registered')
  } catch (err) {
    console.error('Failed to verify/register app visibility shortcut', err)
  }

  // Menu
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { label: 'Help', accelerator: 'CmdOrCtrl+/', click: () => window.webContents.send('ui:open-help') },
        { role: 'quit' }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)

  // IPC
  let heavyEnabled = false
  ipcMain.on('action', (_e: any, type: string, data?: any) => {
    if (type === 'toggle-click') toggleOverlayState()

    if (type === 'toggle-visibility') {
      toggleVisibility()
    }

    if (type === 'toggle-heavy') {
      heavyEnabled = !heavyEnabled
      window.webContents.send('heavy-mode', heavyEnabled)
    }

    if (type === 'attach') {
      // Reattach to new target
      try {
        attachToTarget(data)
      } catch (error: any) {
        // Handle the case where library is already initialized
        window.webContents.send('attach-error', error.message || 'Failed to attach to target window')
      }
    }

    if (type === 'send-text') {
      const text: string = String(data || '')
      if (!text.trim()) return

      const correlationId = randomUUID();

      (async () => {
        try {
          OverlayController.focusTarget()

          // 1. Try Nut.js first (Cross-platform)
          try {
            if (nutService.isAvailable()) {
              await nutService.typeText(text, correlationId)
              window.webContents.send('text-send', { ok: true, method: 'nutjs', correlationId })
              OverlayController.activateOverlay()
              return
            } else {
              // Emulate missing module status for consistency or just fall through
              // But nutService.typeText throws if missing, so let's just try calling it
              // if we want to rely on its internal check. 
              // However, calling typeText when we know it's missing is cleaner.
              await nutService.typeText(text, correlationId)
            }
          } catch (err: any) {
            // Check if it's a module missing error or a typing error
            if (err.message !== 'Nut.js module missing') {
              console.error('Nut.js typing error', err)
              // If it's a real typing error, we might stop here or try fallback.
              // Given user wants reliability, let's try fallback but log the error.
            }
            // Fall through to platform-specific fallbacks
          }

          // 2. Fallbacks
          if (process.platform === 'darwin') {
            const { execFile } = require('node:child_process')
            const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            const t = esc(text)
            const script = `tell application "TextEdit"\n` +
              `  activate\n` +
              `  if (count of windows) = 0 then make new document\n` +
              `  set existingText to text of front document\n` +
              `  set text of front document to existingText & "${t}"\n` +
              `end tell`;

            execFile('osascript', ['-e', script], (err: any) => {
              if (err) {
                console.error('AppleScript write failed', err)
                // Fallback: clipboard + Cmd+V
                try {
                  clipboard.writeText(text)
                  const pasteScript = `tell application "TextEdit" to activate\n` +
                    `delay 0.1\n` +
                    `tell application "System Events" to keystroke "v" using {command down}`
                  execFile('osascript', ['-e', pasteScript], (err2: any) => {
                    if (err2) {
                      console.error('Fallback paste failed', err2)
                      window.webContents.send('text-send', { ok: false, error: 'automation_or_accessibility_denied', correlationId })
                      return
                    }
                    window.webContents.send('text-send', { ok: true, method: 'paste', correlationId })
                    OverlayController.activateOverlay()
                  })
                } catch (fallbackErr) {
                  window.webContents.send('text-send', { ok: false, error: 'fallback_error', correlationId })
                }
                return
              }
              window.webContents.send('text-send', { ok: true, method: 'applescript', correlationId })
              OverlayController.activateOverlay()
            })
          } else if (process.platform === 'win32') {
            const { execFile } = require('node:child_process')
            const cmd = `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^v')`
            clipboard.writeText(text)
            execFile('powershell', ['-NoProfile', '-Command', cmd], (err: any) => {
              if (err) {
                console.error('Failed to paste on Windows', err)
                window.webContents.send('attach-error', 'Failed to paste on Windows')
                window.webContents.send('text-send', { ok: false, error: 'paste_failed', correlationId })
                return
              }
              window.webContents.send('text-send', { ok: true, method: 'paste', correlationId })
              OverlayController.activateOverlay()
            })
          } else {
            window.webContents.send('attach-error', 'Send text not implemented on your platform')
          }
        } catch (error) {
          console.error('Error during send-text', error)
          window.webContents.send('text-send', { ok: false, error: 'exception', correlationId })
        }
      })()
    }

    if (type === 'position') {
      const { screen } = require('electron')
      const display = screen.getPrimaryDisplay()
      const { bounds } = display
      const [w, h] = window.getSize()

      let x = 0, y = 0

      if (data === 'top-left') {
        x = 0
        y = 0
      } else if (data === 'top-right') {
        x = bounds.width - w
        y = 0
      } else if (data === 'bottom-left') {
        x = 0
        y = bounds.height - h
      } else if (data === 'bottom-right') {
        x = bounds.width - w
        y = bounds.height - h
      } else if (data === 'center') {
        x = (bounds.width - w) / 2
        y = (bounds.height - h) / 2
      }

      window.setBounds({ x, y, width: w, height: h })
    }

    if (type === 'resize') {
      // Cycle through common sizes
      const sizes = [[1280, 800], [1600, 900], [1920, 1080], [900, 700]]
      const [currentW, currentH] = window.getSize()
      const currentIndex = sizes.findIndex(([w, h]) => w === currentW && h === currentH)
      const nextIndex = (currentIndex + 1) % sizes.length
      const [newW, newH] = sizes[nextIndex]

      const [x, y] = window.getPosition()
      window.setBounds({ x, y, width: newW, height: newH })
    }

  })
}

app.on('ready', () => {
  setTimeout(
    createWindow,
    process.platform === 'linux' ? 1000 : 0
  )
})

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll()
  } catch { }
})

// Quit the app when the window is closed (macOS red close button or any close request)
app.on('window-all-closed', () => {
  app.quit()
})
