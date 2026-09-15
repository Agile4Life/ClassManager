function parseOrigins(value) {
  return (value || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getRequestHost(req) {
  const forwardedHost = req.get('x-forwarded-host');
  return (forwardedHost ? forwardedHost.split(',')[0] : req.get('host'))?.trim().toLowerCase();
}

function getRequestProtocol(req) {
  const forwardedProtocol = req.get('x-forwarded-proto');
  return (forwardedProtocol ? forwardedProtocol.split(',')[0] : req.protocol)?.trim().toLowerCase();
}

function isSameOrigin(req, origin) {
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host.toLowerCase() === getRequestHost(req)
      && parsedOrigin.protocol.replace(':', '').toLowerCase() === getRequestProtocol(req);
  } catch {
    return false;
  }
}

function isDevelopmentLoopback(origin, nodeEnv) {
  if (nodeEnv === 'production') return false;

  try {
    const { hostname, protocol } = new URL(origin);
    return ['http:', 'https:'].includes(protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

function isOriginAllowed({ req, origin, configuredOrigins, nodeEnv }) {
  return !origin
    || configuredOrigins.includes('*')
    || configuredOrigins.includes(origin)
    || isSameOrigin(req, origin)
    || isDevelopmentLoopback(origin, nodeEnv);
}

module.exports = { parseOrigins, isOriginAllowed };
