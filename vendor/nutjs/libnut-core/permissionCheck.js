let libnut = require("bindings")("libnut");

let hasScreenRecordingPermission = false;
let hasAccessibilityPermission = false;

try {
  const permissions = require("node-mac-permissions");

  const wrapWithWarning =
    (message, nativeFunction) =>
    (...args) => {
      console.warn(message);
      return nativeFunction(...args);
    };

  const askForAccessibility = (nativeFunction, functionName) => {
    if (process.platform !== "darwin" || hasAccessibilityPermission) {
      return nativeFunction;
    }
    const accessibilityStatus = permissions.getAuthStatus("accessibility");

    if (accessibilityStatus === "authorized") {
      hasAccessibilityPermission = true;
      return nativeFunction;
    } else if (
      accessibilityStatus === "not determined" ||
      accessibilityStatus === "denied"
    ) {
      permissions.askForAccessibilityAccess();
      return wrapWithWarning(
        `##### WARNING! The application running this script tries to access accessibility features to execute ${functionName}! Please grant requested access and visit https://github.com/nut-tree/nut.js#macos for further information. #####`,
        nativeFunction
      );
    }
  };
  const askForScreenRecording = (nativeFunction, functionName) => {
    if (process.platform !== "darwin" || hasScreenRecordingPermission) {
      return nativeFunction;
    }
    const screenCaptureStatus = permissions.getAuthStatus("screen");

    if (screenCaptureStatus === "authorized") {
      hasScreenRecordingPermission = true;
      return nativeFunction;
    } else if (
      screenCaptureStatus === "not determined" ||
      screenCaptureStatus === "denied"
    ) {
      permissions.askForScreenCaptureAccess();
      return wrapWithWarning(
        `##### WARNING! The application running this script tries to screen recording features to execute ${functionName}! Please grant the requested access and visit https://github.com/nut-tree/nut.js#macos for further information. #####`,
        nativeFunction
      );
    }
  };

  const accessibilityAccess = [
    "dragMouse",
    "moveMouse",
    "getMousePos",
    "mouseClick",
    "mouseToggle",
    "scrollMouse",
    "keyTap",
    "keyToggle",
    "typeString",
    "getScreenSize",
    "highlight",
    "captureScreen",
    "getWindows",
    "getActiveWindow",
    "getWindowRect",
    "getWindowTitle",
    "focusWindow",
    "resizeWindow",
  ];
  const screenCaptureAccess = ["getWindowTitle", "captureScreen"];

  for (const functionName of accessibilityAccess) {
    const originalFunction = libnut[functionName];
    libnut[functionName] = (...args) =>
      askForAccessibility(originalFunction, functionName)(...args);
  }
  for (const functionName of screenCaptureAccess) {
    const originalFunction = libnut[functionName];
    libnut[functionName] = (...args) =>
      askForScreenRecording(originalFunction, functionName)(...args);
  }
} catch (e) {
  try {
    if (process.env.DEBUG_PERMISSIONS === '1') {
      console.warn(`mac-permissions not available:`, e && e.message)
    }
  } catch {}
  libnut = require("bindings")("libnut");
} finally {
  module.exports = libnut;
}
