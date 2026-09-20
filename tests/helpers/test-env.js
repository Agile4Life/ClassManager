require('dotenv').config();
const http = require('http');
const app = require('../../backend/app');
const pool = require('../../backend/config/db');
const { signAccessToken } = require('../../backend/utils/jwt');
const { ensureClassTeacherSchema } = require('../../backend/utils/class-teachers');

let serverInstance = null;
let baseUrl = '';
let cachedTokens = {};

let isInitialized = false;

/**
 * Starts an ephemeral server on a free port and sets up DB prerequisites.
 */
async function setupTestEnvironment() {
  if (isInitialized && serverInstance) {
    return { baseUrl, pool };
  }

  // Ensure schema migrations exist
  try {
    await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await pool.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS google_sub TEXT');
    await ensureClassTeacherSchema(pool);
  } catch (err) {
    // Ignore if already applied
  }

  // Spin up ephemeral HTTP server
  if (!serverInstance) {
    serverInstance = http.createServer(app);
    await new Promise((resolve) => {
      serverInstance.listen(0, '127.0.0.1', () => {
        const port = serverInstance.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }

  isInitialized = true;
  return { baseUrl, pool };
}

/**
 * Shuts down the test server and pool if needed.
 */
async function teardownTestEnvironment(closePool = false) {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
    serverInstance = null;
    baseUrl = '';
  }
  if (closePool && pool) {
    await pool.end().catch(() => {});
  }
}

/**
 * Generates or retrieves cached JWT tokens by performing real logins.
 */
async function getAuthTokens() {
  if (Object.keys(cachedTokens).length > 0) {
    return cachedTokens;
  }

  const credentials = [
    { username: 'admin', password: 'Admin@123', role: 'admin' },
    { username: 'staff01', password: 'Staff@123', role: 'staff' },
    { username: 'teacher01', password: 'Teacher@123', role: 'teacher' },
    { username: 'parent01', password: 'Parent@123', role: 'parent' },
    { username: 'student01', password: 'Student@123', role: 'student' },
  ];

  for (const cred of credentials) {
    let attempts = 0;
    while (attempts < 3) {
      attempts += 1;
      const res = await api('POST', '/api/auth/login', {
        body: { username: cred.username, password: cred.password },
      });
      if (res.status === 200 && res.data?.data?.token) {
        const token = res.data.data.token;
        cachedTokens[cred.role] = token;
        cachedTokens[cred.username] = token;
        cachedTokens[`${cred.role}_user`] = res.data.data.user;
        break;
      }
      if (attempts === 3) {
        console.warn(`Could not log in as ${cred.username}: status=${res.status}`, res.data);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  return cachedTokens;
}

/**
 * Standard HTTP request wrapper against the test server.
 */
async function api(method, path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let body = undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  let json = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    json = await res.json().catch(() => null);
  } else {
    const text = await res.text();
    json = { raw: text };
  }

  return {
    status: res.status,
    headers: res.headers,
    data: json,
    ok: res.ok,
  };
}

/**
 * Simple test harness utilities
 */
function createSuiteRunner(suiteTitle) {
  let passed = 0;
  let failed = 0;
  const errors = [];
  const testResults = [];

  return {
    async test(name, fn) {
      const start = Date.now();
      try {
        await fn();
        const duration = Date.now() - start;
        passed += 1;
        testResults.push({ name, status: 'PASSED', duration });
        console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
      } catch (err) {
        const duration = Date.now() - start;
        failed += 1;
        testResults.push({ name, status: 'FAILED', duration, error: err.message });
        errors.push({ test: name, error: err });
        console.log(`  \x1b[31m✖\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
        console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
      }
    },
    summary() {
      return {
        suiteTitle,
        passed,
        failed,
        total: passed + failed,
        errors,
        testResults,
      };
    },
  };
}

/**
 * Extracts list array from either paginated { items: [...] } or direct [...] responses
 */
function getList(res) {
  if (!res || !res.data) return [];
  if (Array.isArray(res.data.data)) return res.data.data;
  if (Array.isArray(res.data.data?.items)) return res.data.data.items;
  return [];
}

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  getAuthTokens,
  api,
  getList,
  createSuiteRunner,
  pool,
};

