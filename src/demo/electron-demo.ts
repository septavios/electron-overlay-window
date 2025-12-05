import { app, BrowserWindow, globalShortcut, Menu, ipcMain } from 'electron'
import { OverlayController, OVERLAY_WINDOW_OPTS } from '../'

app.disableHardwareAcceleration()

let window: BrowserWindow

const toggleMouseKey = 'CmdOrCtrl + J'
const toggleShowKey = 'CmdOrCtrl + K'

function createWindow() {
  window = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    ...OVERLAY_WINDOW_OPTS
  })

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
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

    /* Hide UI elements when hidden-ui class is present */
    body.hidden-ui .panel,
    body.hidden-ui .overlay-guide,
    body.hidden-ui .heavy-list,
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
      width: 380px;
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
    }

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
    }
    button:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    button:active {
      transform: translateY(1px);
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
    <div class="section">
      <div class="section-title">Core Controls</div>
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
    <div class="section">
      <div class="section-title">Appearance</div>
      <div class="slider-container">
        <div class="slider-label">
          <span>Background Opacity</span>
          <span id="opacityValue">85%</span>
        </div>
        <input type="range" id="opacitySlider" min="0" max="100" value="85">
      </div>
    </div>

    <!-- Target Window -->
    <div class="section">
      <div class="section-title">Target Window</div>
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
    <div class="section">
      <div class="section-title">Positioning</div>
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
    <div class="section">
      <div class="section-title">Performance</div>
      <button id="btnHeavy" style="width: 100%;">Toggle Heavy Render Test</button>
      <div class="metric-row" style="margin-top: 8px;">
        <span>Render Items</span>
        <span class="metric-value" id="valItems">0</span>
      </div>
    </div>

    <!-- Status -->
    <div class="section">
      <div class="section-title">Status</div>
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
    <div class="section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div class="section-title" style="margin: 0;">Event Log</div>
        <button class="small" id="btnClearLog">Clear</button>
      </div>
      <div class="log-container" id="eventLog"></div>
    </div>

    <!-- Tour -->
    <div class="section">
      <div class="section-title">Help</div>
      <button id="btnTour" style="width: 100%;">🎯 Start Guided Tour</button>
    </div>
  </div>

  <div class="heavy-list" id="heavyList"></div>

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
    const { ipcRenderer } = require('electron');

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

    // State
    let isInteractive = true;
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
    document.getElementById('btnToggleClick').onclick = () => ipcRenderer.send('action', 'toggle-click');
    document.getElementById('btnToggleVis').onclick = () => ipcRenderer.send('action', 'toggle-visibility');
    document.getElementById('btnHeavy').onclick = () => ipcRenderer.send('action', 'toggle-heavy');
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
        ipcRenderer.send('action', 'attach', target);
        log('CMD', \`Attaching to: \${target}\`);
      }
    };

    // Positioning
    document.getElementById('btnTopLeft').onclick = () => ipcRenderer.send('action', 'position', 'top-left');
    document.getElementById('btnCenter').onclick = () => ipcRenderer.send('action', 'position', 'center');
    document.getElementById('btnTopRight').onclick = () => ipcRenderer.send('action', 'position', 'top-right');
    document.getElementById('btnBottomLeft').onclick = () => ipcRenderer.send('action', 'position', 'bottom-left');
    document.getElementById('btnBottomRight').onclick = () => ipcRenderer.send('action', 'position', 'bottom-right');
    document.getElementById('btnResize').onclick = () => ipcRenderer.send('action', 'resize');

    // Tour
    let tourStep = 0;
    const tourSteps = [
      { title: 'Welcome!', text: 'This demo showcases the electron-overlay-window library. Click Next to start the tour.' },
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

    // IPC Listeners
    ipcRenderer.on('focus-change', (e, state) => {
      isInteractive = state;
      statusDot.className = state ? 'status-dot active' : 'status-dot inactive';
      valMode.textContent = state ? 'Interactive' : 'Passthrough';
      
      const warning = document.getElementById('passthroughWarning');
      warning.style.display = state ? 'none' : 'block';
      mainPanel.style.opacity = state ? '1' : '0.6';
      
      log('MODE', state ? 'Interactive' : 'Passthrough');
    });

    ipcRenderer.on('heavy-mode', (e, enable) => {
      heavyList.style.display = enable ? 'block' : 'none';
      heavyList.innerHTML = '';
      if (enable) {
        for(let i=0; i<1000; i++) {
          const div = document.createElement('div');
          div.className = 'heavy-item';
          div.textContent = \`Item #\${i + 1}\`;
          heavyList.appendChild(div);
        }
        valItems.textContent = '1000';
        log('PERF', 'Heavy mode enabled (1000 items)');
      } else {
        valItems.textContent = '0';
        log('PERF', 'Heavy mode disabled');
      }
    });

    ipcRenderer.on('overlay-event', (e, payload) => {
      const { type, x, y, width, height, isFullscreen } = payload;
      
      if (type === 'moveresize' || type === 'attach') {
        valBounds.textContent = \`\${x},\${y} (\${width}×\${height})\`;
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

    ipcRenderer.on('attach-error', (e, message) => {
      log('ERROR', message);
      valAttachTime.textContent = 'Failed';
      valAttachTime.style.color = 'var(--danger)';
    });

  </script>
</body>
</html>
  `

  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

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

  OverlayController.activateOverlay()

    // Proxy events to renderer
    ; (OverlayController as any).events.on('attach', (e: any) => {
      window.webContents.send('overlay-event', { type: 'attach', ...e })
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
}

function makeDemoInteractive() {
  let isInteractable = true

  function toggleOverlayState() {
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

  window.on('blur', () => {
    isInteractable = false
    window.webContents.send('focus-change', false)
  })

  globalShortcut.register(toggleMouseKey, toggleOverlayState)

  function toggleVisibility() {
    if (!window || !window.webContents) {
      console.error('Window or webContents not available')
      return
    }

    window.webContents.executeJavaScript(`
      document.body.classList.toggle('hidden-ui');
    `).catch(err => {
      console.error('Failed to toggle visibility:', err)
    })
  }

  globalShortcut.register(toggleShowKey, toggleVisibility)

  // Menu
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
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
      const sizes = [[640, 480], [800, 600], [1024, 768], [900, 700]]
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
