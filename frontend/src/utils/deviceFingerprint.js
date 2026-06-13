import FingerprintJS from '@fingerprintjs/fingerprintjs';

let _fpPromise = null;

function getFpAgent() {
  if (!_fpPromise) {
    _fpPromise = FingerprintJS.load();
  }
  return _fpPromise;
}

/**
 * Returns a stable device identifier object.
 * { deviceId, fingerprintHash, deviceName, browser }
 *
 * deviceId    – stored in localStorage, regenerated only if missing
 * fingerprintHash – FingerprintJS visitor ID (hardware-based entropy)
 */
export async function getDeviceInfo() {
  // Stable UUID stored per browser profile
  let deviceId = localStorage.getItem('sos_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('sos_device_id', deviceId);
  }

  let fingerprintHash = null;
  try {
    const agent  = await getFpAgent();
    const result = await agent.get();
    fingerprintHash = result.visitorId;
  } catch {
    // FingerprintJS failure is non-fatal
  }

  const ua          = navigator.userAgent || '';
  const browser     = parseBrowser(ua);
  const deviceName  = `${browser} — ${navigator.platform || 'Web'}`;

  return { deviceId, fingerprintHash, browser, deviceName };
}

function parseBrowser(ua) {
  if (/Edg\//.test(ua))     return 'Microsoft Edge';
  if (/Chrome\//.test(ua))  return 'Google Chrome';
  if (/Firefox\//.test(ua)) return 'Mozilla Firefox';
  if (/Safari\//.test(ua))  return 'Apple Safari';
  if (/MSIE|Trident/.test(ua)) return 'Internet Explorer';
  return 'Browser Tidak Diketahui';
}
