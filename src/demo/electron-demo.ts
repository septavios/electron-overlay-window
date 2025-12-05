import { app, BrowserWindow, globalShortcut, Menu } from 'electron'
import { OverlayController, OVERLAY_WINDOW_OPTS } from '../'

// https://github.com/electron/electron/issues/25153
app.disableHardwareAcceleration()

let window: BrowserWindow

const toggleMouseKey = 'CmdOrCtrl + J'
const toggleShowKey = 'CmdOrCtrl + K'

function createWindow () {
  window = new BrowserWindow({
    width: 640,
    height: 480,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    ...OVERLAY_WINDOW_OPTS
  })

  window.loadURL(`data:text/html;charset=utf-8,
    <head>
      <title>overlay-demo</title>
    </head>
    <body style="padding: 0; margin: 0;">
      <div style="position: absolute; width: 100%; height: 100%; border: 4px solid red; background: rgba(255,255,255,0.1); box-sizing: border-box; pointer-events: none;"></div>
      <div style="padding-top: 50vh; text-align: center;">
        <div style="padding: 16px; border-radius: 8px; background: rgb(255,255,255); border: 4px solid red; display: inline-block;">
          <span>Overlay Window</span>
          <span id="text1"></span>
          <br><span><b>${toggleMouseKey}</b> to toggle setIgnoreMouseEvents</span>
          <br><span><b>${toggleShowKey}</b> to "hide" overlay using CSS</span>
        </div>
      </div>
      <script>
        const electron = require('electron');

        electron.ipcRenderer.on('focus-change', (e, state) => {
          document.getElementById('text1').textContent = (state) ? ' (overlay is clickable) ' : 'clicks go through overlay'
        });

        electron.ipcRenderer.on('visibility-change', (e, state) => {
          if (document.body.style.display) {
            document.body.style.display = null
          } else {
            document.body.style.display = 'none'
          }
        });
      </script>
    </body>
  `)

  window.webContents.on('did-finish-load', () => {
    const ui = `
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
        .hud{position:fixed;top:8px;left:8px;background:rgba(255,255,255,0.9);border:1px solid #ddd;border-radius:8px;padding:8px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
        .hud h3{margin:0 0 6px 0;font-size:13px}
        .row{display:flex;gap:8px;align-items:center}
        .badge{display:inline-block;background:#eee;border-radius:6px;padding:2px 6px;font-size:12px}
        .panel{position:fixed;bottom:8px;left:8px;right:8px;background:rgba(255,255,255,0.95);border:1px solid #ddd;border-radius:8px;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .card{border:1px solid #eee;border-radius:8px;padding:8px}
        .card h4{margin:0 0 6px 0;font-size:13px}
        .list{height:150px;overflow:auto;border:1px solid #eee;border-radius:6px}
        .code{background:#f7f7f7;border:1px solid #eee;border-radius:6px;padding:8px;font-family:Menlo,Consolas,monospace;font-size:12px}
        .btn{padding:6px 10px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer}
        .btn:hover{background:#f0f0f0}
        .highlight{outline:3px solid #00aaff}
      </style>
      <div class="hud">
        <h3>Overlay Status</h3>
        <div class="row">
          <span class="badge" id="status-focus">blur</span>
          <span class="badge" id="status-fullscreen">windowed</span>
          <span class="badge" id="status-bounds">x:0 y:0 w:0 h:0</span>
          <span class="badge" id="status-fps">events/s:0</span>
        </div>
      </div>
      <div class="panel" id="panel">
        <div class="card" id="card-actions">
          <h4>Actions</h4>
          <button class="btn" id="btnToggleClick" title="Toggle click-through vs interactive">${toggleMouseKey}</button>
          <button class="btn" id="btnToggleVisibility" title="Toggle overlay visibility">${toggleShowKey}</button>
          <button class="btn" id="btnHeavy" title="Render a large list to demonstrate scalability">Toggle Heavy Mode</button>
          <button class="btn" id="btnTour" title="Start guided tour">Start Tour</button>
        </div>
        <div class="card">
          <h4>API Usage</h4>
          <div class="code"><pre>OverlayController.attachByTitle(window, '${process.platform === 'darwin' ? 'Untitled' : 'Notepad'}', { hasTitleBarOnMac: true })\nOverlayController.activateOverlay()\nOverlayController.focusTarget()</pre></div>
          <a href="https://github.com/septavios/electron-overlay-window" target="_blank" class="btn">Documentation</a>
        </div>
        <div class="card">
          <h4>Events</h4>
          <div class="list" id="events"></div>
        </div>
        <div class="card">
          <h4>Benchmarks</h4>
          <div id="benchmarks">
            <div class="row"><span>Time to attach:</span><span class="badge" id="metric-attach">0 ms</span></div>
            <div class="row"><span>Last event latency:</span><span class="badge" id="metric-latency">0 ms</span></div>
          </div>
        </div>
      </div>
      <script>
        const electron = require('electron');
        const eventsEl = document.getElementById('events');
        const statusFocus = document.getElementById('status-focus');
        const statusFullscreen = document.getElementById('status-fullscreen');
        const statusBounds = document.getElementById('status-bounds');
        const statusFps = document.getElementById('status-fps');
        const metricAttach = document.getElementById('metric-attach');
        const metricLatency = document.getElementById('metric-latency');
        let counter = 0; let lastSec = Math.floor(Date.now()/1000);
        document.getElementById('btnToggleClick').onclick = () => electron.ipcRenderer.send('action', 'toggle-click');
        document.getElementById('btnToggleVisibility').onclick = () => electron.ipcRenderer.send('action', 'toggle-visibility');
        document.getElementById('btnHeavy').onclick = () => electron.ipcRenderer.send('action', 'toggle-heavy');
        document.getElementById('btnTour').onclick = () => electron.ipcRenderer.send('action', 'tour-start');
        electron.ipcRenderer.on('overlay-event', (e, payload) => {
          const ts = Date.now();
          const t = payload.type;
          const item = document.createElement('div');
          item.textContent = t + ' ' + (payload.info || '');
          eventsEl.prepend(item);
          if (eventsEl.children.length > 200) eventsEl.removeChild(eventsEl.lastChild);
          if (t === 'focus') statusFocus.textContent = 'focus';
          if (t === 'blur') statusFocus.textContent = 'blur';
          if (t === 'fullscreen') statusFullscreen.textContent = payload.isFullscreen ? 'fullscreen' : 'windowed';
          if (t === 'moveresize' || t === 'attach') statusBounds.textContent = 'x:' + payload.x + ' y:' + payload.y + ' w:' + payload.width + ' h:' + payload.height;
          const sec = Math.floor(ts/1000);
          if (sec === lastSec) counter++; else { statusFps.textContent = 'events/s:' + counter; counter = 1; lastSec = sec; }
        });
        electron.ipcRenderer.on('benchmark-update', (e, payload) => {
          if (payload.type === 'attach') metricAttach.textContent = payload.ms + ' ms';
          if (payload.type === 'latency') metricLatency.textContent = payload.ms + ' ms';
        });
        electron.ipcRenderer.on('heavy-mode', (e, state) => {
          const list = document.getElementById('events');
          if (state) {
            for (let i=0;i<2000;i++){const d=document.createElement('div');d.textContent='Row '+(i+1);list.appendChild(d);} 
          } else {
            while (list.firstChild) list.removeChild(list.firstChild);
          }
        });
        let tourStep = 0;
        function setHighlight(on){document.querySelector('.hud').classList.toggle('highlight', on);} 
        electron.ipcRenderer.on('tour-step', (e, step) => { tourStep = step; setHighlight(step===1); });
      </script>
    `
    window.webContents.executeJavaScript(`document.body.insertAdjacentHTML('beforeend', \`${ui}\`)`)
  })

  // DevTools disabled in demo to align with macOS HIG

  makeDemoInteractive()

  OverlayController.attachByTitle(
    window,
    process.platform === 'darwin' ? 'Untitled' : 'Notepad',
    { hasTitleBarOnMac: true }
  )

  const startTs = Date.now()
  ;(OverlayController as any).events.on('attach', (e: any) => {
    window.webContents.send('overlay-event', { type: 'attach', x: e.x, y: e.y, width: e.width, height: e.height })
    window.webContents.send('benchmark-update', { type: 'attach', ms: Date.now() - startTs })
  })
  ;(OverlayController as any).events.on('moveresize', (e: any) => {
    window.webContents.send('overlay-event', { type: 'moveresize', x: e.x, y: e.y, width: e.width, height: e.height })
  })
  ;(OverlayController as any).events.on('focus', () => {
    window.webContents.send('overlay-event', { type: 'focus' })
  })
  ;(OverlayController as any).events.on('blur', () => {
    window.webContents.send('overlay-event', { type: 'blur' })
  })
  ;(OverlayController as any).events.on('fullscreen', (e: any) => {
    window.webContents.send('overlay-event', { type: 'fullscreen', isFullscreen: e.isFullscreen })
  })
}

function makeDemoInteractive () {
  let isInteractable = false

  function toggleOverlayState () {
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

  globalShortcut.register(toggleShowKey, () => {
    window.webContents.send('visibility-change', false)
  })

  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Overlay',
      submenu: [
        {
          label: 'Toggle Click-Through',
          accelerator: toggleMouseKey,
          click: toggleOverlayState
        },
        {
          label: 'Toggle Visibility',
          accelerator: toggleShowKey,
          click: () => window.webContents.send('visibility-change', false)
        },
        {
          label: 'Toggle Heavy Mode',
          click: () => window.webContents.send('heavy-mode', true)
        },
        {
          label: 'Start Guided Tour',
          click: () => window.webContents.send('tour-step', 1)
        }
      ]
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
    { role: 'help', submenu: [] }
  ])
  Menu.setApplicationMenu(menu)

  const { ipcMain } = require('electron')
  ipcMain.on('action', (_e: any, type: string) => {
    if (type === 'toggle-click') toggleOverlayState()
    if (type === 'toggle-visibility') window.webContents.send('visibility-change', false)
    if (type === 'toggle-heavy') window.webContents.send('heavy-mode', true)
    if (type === 'tour-start') window.webContents.send('tour-step', 1)
  })
}

app.on('ready', () => {
  setTimeout(
    createWindow,
    process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
  )
})
