# 🚀 Hướng Dẫn Tối Ưu Hiệu Năng — ClassManager

> Tài liệu này phân tích toàn bộ các vấn đề hiệu năng trong dự án ClassManager (Backend + Frontend) và đưa ra giải pháp cụ thể với mã nguồn mẫu.

---

## Mục Lục

1. [Tổng quan vấn đề](#1-tổng-quan-vấn-đề)
2. [Backend — Mức CRITICAL](#2-backend--mức-critical)
3. [Backend — Mức HIGH](#3-backend--mức-high)
4. [Backend — Mức MEDIUM](#4-backend--mức-medium)
5. [Frontend — Mức CRITICAL](#5-frontend--mức-critical)
6. [Frontend — Mức HIGH](#6-frontend--mức-high)
7. [Frontend — Mức MEDIUM](#7-frontend--mức-medium)
8. [Danh sách index SQL cần thêm](#8-danh-sách-index-sql-cần-thêm)
9. [Checklist thực hiện](#9-checklist-thực-hiện)

---

## 1. Tổng Quan Vấn Đề

| Phân loại | Backend | Frontend | Tổng |
|-----------|---------|----------|------|
| 🔴 Critical | 4 | 5 | 9 |
| 🟠 High | 6 | 5 | 11 |
| 🟡 Medium | 7 | 7 | 14 |

**5 nguyên nhân chính gây delay nặng nhất:**

1. **Auth middleware query database MỌI request** → mỗi API call đều JOIN 2 bảng
2. **Frontend không có cache API** → mỗi lần navigate đều fetch lại toàn bộ data
3. **Không có compression** → JSON response truyền nguyên dung lượng qua mạng
4. **N+1 query trong điểm danh** → 40 học sinh = 80 query tuần tự trong 1 request
5. **14+ endpoints không có pagination** → trả toàn bộ data không giới hạn

---

## 2. Backend — Mức CRITICAL

### 🔴 C1: Auth Middleware Query DB Trên Mỗi Request

**File:** `src/middlewares/auth.middleware.js` — dòng 16-34

**Vấn đề:** Mỗi request được bảo vệ đều chạy một câu JOIN giữa `user_accounts` và `user_sessions`. Với 100 request đồng thời = 100 query xác thực.

**Sửa: Thêm in-memory cache cho session**

```js
// src/middlewares/auth.middleware.js

const pool = require('../config/db');
const { verifyAccessToken } = require('../utils/jwt');
const { AppError } = require('../utils/errors');

// ===== SESSION CACHE =====
const sessionCache = new Map();
const CACHE_TTL = 60_000; // 60 giây

function getCachedSession(userId, sessionId) {
  const key = `${userId}:${sessionId}`;
  const entry = sessionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    sessionCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSession(userId, sessionId, data) {
  const key = `${userId}:${sessionId}`;
  sessionCache.set(key, { data, timestamp: Date.now() });

  // Giới hạn cache tối đa 1000 session
  if (sessionCache.size > 1000) {
    const firstKey = sessionCache.keys().next().value;
    sessionCache.delete(firstKey);
  }
}

// Gọi hàm này khi user logout để xóa cache
function invalidateSession(userId, sessionId) {
  sessionCache.delete(`${userId}:${sessionId}`);
}
// ===== END SESSION CACHE =====

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Token không hợp lệ');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    const userId = payload.sub;
    const sessionId = payload.sid;

    // Kiểm tra cache trước
    let user = getCachedSession(userId, sessionId);

    if (!user) {
      // Cache miss → query DB
      const result = await pool.query(
        `SELECT ua.id, ua.username, ua.role, ua.is_active,
                us.id AS session_id
         FROM user_accounts ua
         JOIN user_sessions us ON us.user_id = ua.id
         WHERE ua.id = $1 AND us.id = $2
           AND ua.is_active = true
           AND us.is_revoked = false
           AND us.expires_at > now()`,
        [userId, sessionId]
      );

      if (result.rows.length === 0) {
        throw new AppError(401, 'Phiên đăng nhập không hợp lệ');
      }

      user = result.rows[0];
      // Lưu vào cache
      setCachedSession(userId, sessionId, user);
    }

    req.user = {
      ...user,
      teacher_id: payload.teacher_id || null,
      student_id: payload.student_id || null,
      parent_id: payload.parent_id || null,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token không hợp lệ hoặc đã hết hạn'));
    }
    next(error);
  }
};

module.exports = { requireAuth, invalidateSession };
```

> [!IMPORTANT]
> Nhớ gọi `invalidateSession(userId, sessionId)` trong `auth.controller.js` khi user logout để xóa cache ngay lập tức.

---

### 🔴 C2: Database Pool Không Có Cấu Hình

**File:** `src/config/db.js`

**Vấn đề:** Pool dùng mặc định `pg`: chỉ 10 connection, không có timeout, không có statement_timeout. Khi nhiều user cùng truy cập, pool cạn kiệt → request bị treo.

**Sửa:**

```js
// src/config/db.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

let connectionString = process.env.DATABASE_URL;
const useSSL = process.env.DATABASE_SSL !== 'false';

let ssl = false;
if (useSSL) {
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '');
  ssl = { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString,
  ssl,

  // ===== CẤU HÌNH POOL TỐI ƯU =====
  max: 20,                        // Tăng từ 10 (mặc định) lên 20
  idleTimeoutMillis: 30_000,      // Đóng connection rảnh sau 30s
  connectionTimeoutMillis: 5_000, // Timeout nếu không lấy được connection trong 5s
  statement_timeout: 15_000,      // Kill query chạy quá 15s
  // ==================================
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

module.exports = pool;
```

---

### 🔴 C3: Không Có Response Compression

**File:** `src/app.js`

**Vấn đề:** JSON response (đặc biệt danh sách, timetable, report) được gửi nguyên dung lượng. Một response 200KB chỉ còn ~30KB sau khi nén gzip.

**Sửa:**

```bash
npm install compression
```

```js
// src/app.js — thêm ngay sau cors()
const compression = require('compression');

app.use(compression({
  level: 6,            // Cân bằng tốc độ nén và CPU
  threshold: 1024,     // Chỉ nén response > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));
```

---

### 🔴 C4: N+1 Query Trong saveAttendance

**File:** `src/controllers/session.controller.js` — dòng 107-122

**Vấn đề:** Vòng lặp `for (const entry of entries)` chạy **2 query riêng biệt cho mỗi học sinh**: 1 `SELECT` kiểm tra enrollment + 1 `INSERT ON CONFLICT`. Lớp 40 học sinh = **80 query tuần tự** trong 1 request.

**Sửa: Batch enrollment check + multi-row INSERT**

```js
// Thay vì vòng lặp N+1:
const studentIds = entries.map(e => e.student_id);

// 1 query duy nhất kiểm tra enrollment cho TẤT CẢ học sinh
const enrollCheck = await client.query(
  `SELECT student_id FROM enrollments
   WHERE class_id = $1 AND student_id = ANY($2::bigint[])
     AND status IN ('studying', 'completed')`,
  [session.class_id, studentIds]
);

const enrolledSet = new Set(enrollCheck.rows.map(r => r.student_id));
const notEnrolled = studentIds.filter(id => !enrolledSet.has(id));
if (notEnrolled.length) {
  throw new AppError(400, `Students not enrolled: ${notEnrolled.join(', ')}`);
}

// 1 query duy nhất INSERT tất cả attendance records
const values = entries.map((e, i) => {
  const offset = i * 5;
  return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5})`;
}).join(', ');

const params = entries.flatMap(e => [
  req.params.sessionId, e.student_id, e.status,
  e.check_in_time || null, e.note || null
]);

const result = await client.query(
  `INSERT INTO attendance (session_id, student_id, status, check_in_time, note)
   VALUES ${values}
   ON CONFLICT (session_id, student_id) DO UPDATE
   SET status = EXCLUDED.status, check_in_time = EXCLUDED.check_in_time, note = EXCLUDED.note
   RETURNING *`,
  params
);
```

> [!IMPORTANT]
> Thay đổi này giảm từ **2N query** xuống còn **2 query** cho mỗi lần điểm danh, bất kể số lượng học sinh.

---

### 🔴 C5: Không Có HTTP Caching Headers

**File:** `src/app.js`

**Vấn đề:** Không có `Cache-Control`, `ETag`. Mỗi request đều lấy data mới dù data chưa thay đổi.

**Sửa: Thêm middleware cache headers**

```js
// src/middlewares/cache.middleware.js

/**
 * Cache cho các resource ít thay đổi (subjects, rooms, teachers)
 */
function cachePublic(maxAge = 60) {
  return (req, res, next) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${maxAge}`);
    }
    next();
  };
}

/**
 * Cache private cho dữ liệu của user
 */
function cachePrivate(maxAge = 30) {
  return (req, res, next) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `private, max-age=${maxAge}`);
    }
    next();
  };
}

/**
 * Không cache (mutation, auth)
 */
function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

module.exports = { cachePublic, cachePrivate, noCache };
```

Áp dụng vào routes:

```js
// resources.routes.js — cho subjects, rooms
router.get('/subjects', cachePublic(120), requireAuth, getAll);
router.get('/rooms',    cachePublic(120), requireAuth, getAll);

// Dữ liệu cá nhân
router.get('/timetable/student/:id', cachePrivate(30), requireAuth, getStudentTimetable);
```

---

## 3. Backend — Mức HIGH

### 🟠 H1: SELECT * Ở Nhiều Controller

**Files:** `crud.controller.js`, `session.controller.js`, `academic.controller.js`, `report.controller.js`, `finance.controller.js`

**Vấn đề:** `SELECT *` kéo tất cả cột không cần thiết, tăng dung lượng truyền và bộ nhớ.

**Sửa:** Chỉ select các cột cần dùng. Ví dụ:

```js
// Thay vì:
const result = await pool.query('SELECT * FROM students');

// Sử dụng:
const result = await pool.query(
  'SELECT id, full_name, email, phone, date_of_birth, gender, status FROM students'
);
```

---

### 🟠 H2: Thiếu Database Indexes

Xem [Mục 8](#8-danh-sách-index-sql-cần-thêm) để xem toàn bộ danh sách index cần thêm.

---

### 🟠 H3: 14+ Endpoints Không Có Pagination — Trả Data Không Giới Hạn

**Files:** `timetable.controller.js`, `session.controller.js`, `academic.controller.js`, `report.controller.js`, `finance.controller.js`, `class.controller.js`

**Vấn đề:** Chỉ có `crud.controller.js` và một phần `finance.controller.js` có pagination. Tất cả endpoint còn lại trả **toàn bộ kết quả** không có LIMIT.

**Các endpoint bị ảnh hưởng:**

| Controller | Endpoint | Rủi ro |
|-----------|---------|--------|
| timetable | `GET /timetable` | Toàn bộ schedule, JOIN 5 bảng |
| timetable | `GET /timetable/class/:id` | Không limit |
| session | `GET /classes/:id/sessions` | Tất cả sessions |
| academic | `GET /topics` | Tất cả topics |
| academic | `GET /classes/:id/assignments` | Tất cả assignments |
| academic | `GET /assignments/:id/questions` | Tất cả questions |
| academic | `GET /assignments/:id/submissions` | Tất cả submissions |
| report | `GET /reports/weak-topics` | Scan toàn bộ 7-table view |
| report | `GET /reports/student/:id` | Tất cả reports |
| class | `GET /classes/:id/students` | Tất cả students |
| class | `GET /students/:id/parents` | Tất cả parents |

**Sửa:** Thêm pagination vào tất cả list endpoints sử dụng utility `getPagination` đã có sẵn:

```js
const { getPagination } = require('../utils/validation');

const listSessions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);

  const result = await pool.query(
    `SELECT *, count(*) OVER() AS total_count
     FROM class_sessions
     WHERE class_id = $1
     ORDER BY session_date DESC
     LIMIT $2 OFFSET $3`,
    [req.params.classId, limit, offset]
  );

  const totalCount = result.rows[0]?.total_count || 0;
  const data = result.rows.map(({ total_count, ...row }) => row);

  return success(res, {
    items: data,
    pagination: { page, limit, total: Number(totalCount) }
  });
});
```

---

### 🟠 H4: Không Có Rate Limiting

**File:** `src/app.js`

**Vấn đề:** API mở cho brute-force, làm quá tải server.

**Sửa:**

```bash
npm install express-rate-limit
```

```js
// src/app.js
const rateLimit = require('express-rate-limit');

// Giới hạn chung: 100 request / 1 phút / IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều request. Vui lòng thử lại sau.' },
});

// Giới hạn auth: 10 request / 15 phút / IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Quá nhiều lần thử đăng nhập.' },
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
```

---

### 🟠 H4: Report Views Chậm Khi Data Lớn

**File:** `src/controllers/report.controller.js`

**Vấn đề:** 3 reporting views (`v_student_topic_performance`, `v_student_weak_topics`, `v_student_assignment_summary`) chạy lại full query mỗi lần truy vấn.

**Sửa:**

**Phương án A — Cache trong Node.js:**

```js
// src/utils/report-cache.js
const reportCache = new Map();
const REPORT_TTL = 5 * 60 * 1000; // 5 phút

function getCachedReport(key) {
  const entry = reportCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > REPORT_TTL) {
    reportCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedReport(key, data) {
  reportCache.set(key, { data, timestamp: Date.now() });
  // Giới hạn tối đa 200 cache entries
  if (reportCache.size > 200) {
    const oldest = reportCache.keys().next().value;
    reportCache.delete(oldest);
  }
}

function invalidateReportCache(pattern) {
  for (const key of reportCache.keys()) {
    if (key.includes(pattern)) reportCache.delete(key);
  }
}

module.exports = { getCachedReport, setCachedReport, invalidateReportCache };
```

**Phương án B — Materialized Views trong PostgreSQL (khuyến nghị khi data lớn):**

```sql
-- Chuyển view thành materialized view
CREATE MATERIALIZED VIEW mv_student_topic_performance AS
  SELECT ... ; -- copy logic từ v_student_topic_performance

CREATE UNIQUE INDEX ON mv_student_topic_performance(student_id, topic_id);

-- Refresh mỗi 5 phút (dùng pg_cron hoặc cron job bên ngoài)
-- SELECT cron.schedule('refresh-performance', '*/5 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_topic_performance');
```

---

### 🟠 H5: Timetable Lấy TOÀN BỘ Dữ Liệu Không Phân Trang

**File:** `src/controllers/timetable.controller.js`

**Vấn đề:** `getAll` query JOIN 4 bảng và trả về mọi schedule trong hệ thống. Không có pagination hay filter.

**Sửa:**

```js
// Thêm filter và pagination
const getAll = async (req, res) => {
  const { day_of_week, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (day_of_week) {
    params.push(day_of_week);
    whereClause = `WHERE cs.day_of_week = $${params.length}`;
  }

  params.push(limit, offset);

  const result = await pool.query(
    `SELECT cs.id, cs.day_of_week, cs.start_time, cs.end_time,
            c.class_name, s.subject_name, r.room_name, t.full_name AS teacher_name,
            count(*) OVER() AS total_count
     FROM class_schedules cs
     JOIN classes c ON c.id = cs.class_id
     JOIN subjects s ON s.id = c.subject_id
     LEFT JOIN rooms r ON r.id = cs.room_id
     LEFT JOIN teachers t ON t.id = c.teacher_id
     ${whereClause}
     ORDER BY cs.day_of_week, cs.start_time
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // ...
};
```

---

### 🟠 H6: Bảng `login_logs` Tăng Vô Hạn

**Vấn đề:** Mỗi lần đăng nhập (thành công hay thất bại) đều INSERT vào `login_logs`. Bảng này không có cơ chế cleanup.

**Sửa:**

```sql
-- Thêm index cho query admin
CREATE INDEX idx_login_logs_user_created
  ON login_logs(user_id, created_at DESC);

-- Script cleanup chạy hàng tuần (hoặc dùng pg_cron)
DELETE FROM login_logs WHERE created_at < now() - interval '90 days';
```

---

## 4. Backend — Mức MEDIUM

### 🟡 M1: Count + Select = 2 Query Cho Mỗi Trang

**File:** `src/controllers/crud.controller.js`

**Vấn đề:** Phân trang chạy `SELECT count(*)` rồi `SELECT ... LIMIT OFFSET` = 2 round-trip.

**Sửa: Dùng window function**

```js
// Thay vì 2 query riêng:
// Query 1: SELECT count(*) FROM students
// Query 2: SELECT * FROM students LIMIT 20 OFFSET 0

// Dùng 1 query duy nhất:
const result = await pool.query(
  `SELECT *, count(*) OVER() AS total_count
   FROM students
   ORDER BY id
   LIMIT $1 OFFSET $2`,
  [limit, offset]
);

const totalCount = result.rows[0]?.total_count || 0;
const data = result.rows.map(({ total_count, ...row }) => row);
```

---

### 🟡 M2: Static Files Không Có Cache Headers

**File:** `src/app.js`

```js
// Thay:
app.use(express.static('public'));

// Bằng:
app.use(express.static('public', {
  maxAge: '7d',       // Cache 7 ngày (Vite build có content hash)
  immutable: true,     // Browser không cần revalidate
  etag: true,
}));
```

---

### 🟡 M3: Health Endpoint Query DB Không Cần Thiết

```js
// Tách thành 2 endpoint:
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/health/deep', async (req, res) => {
  const dbResult = await pool.query('SELECT now()');
  res.json({ status: 'ok', db: dbResult.rows[0] });
});
```

---

### 🟡 M4: JWT Verify Đồng Bộ Chặn Event Loop

**File:** `src/utils/jwt.js`

```js
// Thay:
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Bằng phiên bản async (nếu traffic cao):
function verifyAccessToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}
```

> [!NOTE]
> Nếu dùng bản async, cần thêm `await` trong auth middleware: `const payload = await verifyAccessToken(token)`.

---

### 🟡 M5: Thêm Request Logging

```bash
npm install pino pino-http
```

```js
// src/app.js
const pinoHttp = require('pino-http');

app.use(pinoHttp({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  autoLogging: {
    ignore: (req) => req.url === '/api/health', // Bỏ qua health check
  },
}));
```

---

### 🟡 M6: CORS Origin Parse Mỗi Request

**File:** `src/app.js`

```js
// Thay vì parse mỗi request:
// origin: (origin, callback) => { const allowed = process.env.CORS_ORIGIN.split(',')... }

// Parse 1 lần khi khởi động:
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
}));
```

---

## 5. Frontend — Mức CRITICAL

### 🔴 F1: Barrel Import `@fluentui/react-icons` — Bundle Tăng Hàng Trăm KB

**Files:** `AppShell.jsx`, `DashboardPage.jsx`, `StudentsPage.jsx`, `ClassesPage.jsx`, `TimetablePage.jsx`, `LoginPage.jsx`, `AttendancePage.jsx`, `ParentNotificationPage.jsx`, `FinancePage.jsx`

**Vấn đề:** `@fluentui/react-icons` v2 chứa **4,000+ icons**. Import từ root barrel (`from '@fluentui/react-icons'`) kéo theo side-effect registrations khiến tree-shaking không hiệu quả, có thể **tăng bundle 200-500KB**.

**Sửa: Deep import cho từng icon**

```jsx
// ❌ Barrel import — kéo side effects của toàn bộ package
import { BookOpen24Filled, CalendarLtr24Regular, People24Regular } from '@fluentui/react-icons';

// ✅ Deep import — chỉ kéo đúng icon cần dùng
import BookOpen24Filled from '@fluentui/react-icons/lib/icons/BookOpen24Filled';
import CalendarLtr24Regular from '@fluentui/react-icons/lib/icons/CalendarLtr24Regular';
import People24Regular from '@fluentui/react-icons/lib/icons/People24Regular';
```

> [!TIP]
> Nếu deep import path không hoạt động với version hiện tại, hãy kiểm tra bằng cách build và chạy `npx vite-bundle-visualizer` để xác nhận kích thước bundle. Một số version mới hơn của `@fluentui/react-icons` đã cải thiện tree-shaking từ barrel import.

---

### 🔴 F2: Không Có API Cache — Mỗi Lần Navigate Đều Fetch Lại

**File:** `frontend/src/hooks/usePageData.js`

**Vấn đề:** Hook `useApiData` chỉ dùng `useState` + `useEffect` + `fetch`. Không có cache, deduplication, hay stale-while-revalidate. Mỗi lần user navigate đi rồi quay lại đều fetch lại từ đầu.

**Hook hiện tại** (`usePageData.js`) có các vấn đề:
- Không cache → navigate đi rồi quay lại đều fetch lại từ đầu
- Không abort → fetch cũ vẫn chạy khi navigate nhanh  
- Dependency array spread `[...dependencies, refreshKey]` với ESLint disabled → fragile

**Sửa: Cài và dùng TanStack Query (React Query)**

```bash
cd frontend
npm install @tanstack/react-query
```

```jsx
// frontend/src/main.jsx — thêm QueryClientProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // Data "tươi" trong 30s
      gcTime: 5 * 60_000,       // Giữ cache 5 phút
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Wrap app:
<QueryClientProvider client={queryClient}>
  <FluentProvider theme={theme}>
    <App />
  </FluentProvider>
</QueryClientProvider>
```

```jsx
// frontend/src/hooks/useApiData.js — viết lại dùng React Query
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export function useApiData(url, options = {}) {
  const { enabled = true, ...queryOptions } = options;

  return useQuery({
    queryKey: [url],
    queryFn: async ({ signal }) => {
      const response = await apiFetch(url, { signal });
      return response.data;
    },
    enabled: Boolean(url) && enabled,
    ...queryOptions,
  });
}
```

> [!IMPORTANT]
> Đây là thay đổi có tác động lớn nhất đối với hiệu năng frontend. Sau khi áp dụng:
> - Navigate giữa các trang sẽ **tức thì** (data đã cache)
> - Không fetch lại nếu data chưa cũ (staleTime)
> - Tự động retry khi lỗi mạng
> - Tự động có AbortController (giải quyết cả F5)

---

### 🔴 F3: LoginPage và NotFoundPage Không Lazy Load

**File:** `frontend/src/App.jsx` — dòng 6-7

**Vấn đề:** `LoginPage` và `NotFoundPage` được import trực tiếp (eager), luôn nằm trong main bundle dù user đã đăng nhập (không bao giờ thấy LoginPage) hoặc hiếm khi gặp 404.

**Sửa:**

```jsx
// ❌ Eager import
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';

// ✅ Lazy import
const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
```

---

### 🔴 F4: Dashboard Fetch Toàn Bộ Data Chỉ Để Đếm

**File:** `frontend/src/pages/DashboardPage.jsx`

**Vấn đề:** Dashboard gọi `api.get('/classes?limit=100')` và `api.get('/students?limit=100')` rồi chỉ dùng `.length` để hiển thị số đếm. Fetch 100 bản ghi đầy đủ chỉ để đếm!

**Sửa:**

```jsx
// ❌ Fetch 100 records chỉ để đếm
const classes = await api.get('/classes?limit=100');
const count = classes.data.length;

// ✅ Fetch 1 record và dùng pagination.total
const classes = await api.get('/classes?limit=1');
const count = classes.pagination.total;

// ✅ Hoặc tốt hơn: tạo endpoint /api/dashboard/stats trên backend
```

---

### 🔴 F5: ClassesPage Fetch Lại Reference Data Mỗi Lần Đổi Trang

**File:** `frontend/src/pages/ClassesPage.jsx`

**Vấn đề:** Khi user đổi page 1→2, trang fetch lại `/subjects?limit=100`, `/teachers?limit=100`, `/rooms?limit=100` dù data này không thay đổi.

**Sửa:** Tách reference data ra khỏi dependency array:

```jsx
// ❌ Fetch lại subjects, teachers, rooms mỗi khi đổi page
const { data } = usePageData(async () => {
  const [classes, subjects, teachers, rooms] = await Promise.all([...]);
  return { classes, subjects, teachers, rooms };
}, [page, search]); // page thay đổi → fetch LẠI tất cả

// ✅ Tách thành 2 hook riêng
const { data: refData } = usePageData(
  () => Promise.all([
    api.get('/subjects?limit=100'),
    api.get('/teachers?limit=100'),
    api.get('/rooms?limit=100'),
  ]).then(([s, t, r]) => ({ subjects: s.data, teachers: t.data, rooms: r.data })),
  [] // Chỉ fetch 1 lần
);

const { data: classData } = usePageData(
  () => api.get(`/classes?page=${page}&search=${search}`),
  [page, search] // Chỉ fetch lại classes
);
```

> [!IMPORTANT]
> Hoặc nếu dùng React Query (xem F2), reference data sẽ tự động được cache với `staleTime` dài.

---

### 🔴 F6: Không Có Error Boundaries

**Vấn đề:** Bất kỳ lỗi nào trong component con sẽ crash toàn bộ app → trắng màn hình.

**Sửa:**

```jsx
// frontend/src/components/ErrorBoundary.jsx
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Đã xảy ra lỗi</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

```jsx
// App.jsx — wrap mỗi lazy route
<ErrorBoundary>
  <Suspense fallback={<Spinner />}>
    <LazyPage />
  </Suspense>
</ErrorBoundary>
```

---

### 🔴 F7: Waterfall API Calls — Các Request Tuần Tự

**Vấn đề:** Nhiều trang gọi nhiều API nhưng chạy tuần tự (mỗi `useApiData` hook chạy riêng).

**Sửa: Gọi song song với React Query**

```jsx
// Ví dụ ClassDetailPage cần fetch class + students + sessions
import { useQueries } from '@tanstack/react-query';

const results = useQueries({
  queries: [
    { queryKey: [`/classes/${classId}`], queryFn: () => apiFetch(`/classes/${classId}`) },
    { queryKey: [`/classes/${classId}/students`], queryFn: () => apiFetch(`/classes/${classId}/students`) },
    { queryKey: [`/classes/${classId}/sessions`], queryFn: () => apiFetch(`/classes/${classId}/sessions`) },
  ],
});

const isLoading = results.some(r => r.isLoading);
const [classData, students, sessions] = results.map(r => r.data);
```

---

### 🔴 F8: Không Có AbortController — Memory Leak

**File:** `frontend/src/hooks/useApiData.js`

**Vấn đề:** Khi user navigate nhanh, fetch cũ vẫn chạy và cố gắng `setState` trên component đã unmount.

> [!NOTE]
> Nếu dùng React Query (F1), vấn đề này tự động được giải quyết. Nếu giữ hook cũ, thêm AbortController:

```jsx
useEffect(() => {
  const controller = new AbortController();

  apiFetch(url, { signal: controller.signal })
    .then(data => setData(data))
    .catch(err => {
      if (err.name !== 'AbortError') setError(err);
    });

  return () => controller.abort(); // Cleanup khi unmount
}, [url]);
```

---

### 🔴 F9: File CSS Monolithic

**File:** `frontend/src/styles.css`

**Vấn đề:** Toàn bộ 3,193 dòng CSS được load cho mỗi trang, kể cả các style không dùng đến.

**Sửa:**

```
frontend/src/
├── styles/
│   ├── variables.css      ← Design tokens, CSS custom properties
│   ├── base.css           ← Reset, typography, global styles
│   ├── layout.css         ← Sidebar, topbar, app shell
│   ├── components.css     ← Buttons, cards, badges chung
│   ├── animations.css     ← @keyframes (chỉ load khi cần)
│   └── responsive.css     ← Media queries
```

```jsx
// main.jsx — import theo thứ tự
import './styles/variables.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
```

> [!TIP]
> Với Vite, bạn cũng có thể dùng CSS Modules (`*.module.css`) cho component-level styles để tự động scope và tree-shake.

---

## 6. Frontend — Mức HIGH

### 🟠 F10: Thiếu Debounce Trên Search Input

**Files:** `StudentsPage.jsx`, `ClassesPage.jsx`, `InvoicesPage.jsx` và tất cả trang có ô search

**Vấn đề:** Mỗi ký tự gõ vào ô tìm kiếm đều trigger API call hoặc re-filter.

**Sửa:**

```jsx
// frontend/src/hooks/useDebounce.js
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

```jsx
// Trong page component:
import { useDebounce } from '../hooks/useDebounce';

const [searchText, setSearchText] = useState('');
const debouncedSearch = useDebounce(searchText, 300);

// Dùng debouncedSearch thay vì searchText cho API call/filter
useEffect(() => {
  fetchData({ search: debouncedSearch });
}, [debouncedSearch]);
```

---

### 🟠 F11: Component Quá Lớn (500-1500 Dòng)

**Files:**
- `StudentsPage.jsx` — ~1,100 dòng
- `ClassDetailPage.jsx` — ~1,500 dòng
- `AssignmentsPage.jsx` — ~1,200 dòng

**Vấn đề:** Bất kỳ state change nào cũng re-render toàn bộ 1000+ dòng component.

**Sửa: Tách thành sub-components**

```
pages/students/
├── StudentsPage.jsx        ← Container, state management
├── StudentTable.jsx        ← Table rendering (React.memo)
├── StudentForm.jsx         ← Create/Edit dialog
├── StudentFilters.jsx      ← Search + filter bar
└── StudentRow.jsx          ← Individual row (React.memo)
```

```jsx
// StudentRow.jsx
import React from 'react';

export const StudentRow = React.memo(function StudentRow({ student, onEdit, onDelete }) {
  return (
    <TableRow>
      <TableCell>{student.full_name}</TableCell>
      <TableCell>{student.email}</TableCell>
      {/* ... */}
    </TableRow>
  );
});
```

---

### 🟠 F12: Không Có Virtualization Cho Bảng Lớn

**Vấn đề:** Bảng render TẤT CẢ rows vào DOM. 500 students = 500 DOM rows.

**Sửa:**

```bash
cd frontend
npm install @tanstack/react-virtual
```

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTable({ items, renderRow }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // row height
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
              width: '100%',
            }}
          >
            {renderRow(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 🟠 F13: Vite Không Có Chunk Splitting

**File:** `frontend/vite.config.js`

**Vấn đề:** Toàn bộ vendor code (React, Fluent UI, Recharts) có thể nằm trong 1 chunk lớn.

**Sửa:**

```js
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    // ===== CHUNK SPLITTING =====
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-fluent': ['@fluentui/react-components', '@fluentui/react-icons'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    // Cảnh báo khi chunk > 300KB
    chunkSizeWarningLimit: 300,
    // ==========================
  },
});
```

---

### 🟠 F14: Thiếu Skeleton Loading

> [!NOTE]
> Dự án đã có `LoadingState` component với skeleton-style loading. Tuy nhiên, cần đảm bảo nó được dùng nhất quán ở tất cả các trang thay vì chỉ dùng `<Spinner />`.


**Vấn đề:** User chỉ thấy spinner → layout shift khi data load xong.

**Sửa:**

```jsx
// frontend/src/components/TableSkeleton.jsx
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="table-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="skeleton-cell">
              <div className="skeleton-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

```css
/* skeleton styles */
.skeleton-row {
  display: flex; gap: 1rem; padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border);
}
.skeleton-cell { flex: 1; }
.skeleton-pulse {
  height: 16px; border-radius: 4px;
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 7. Frontend — Mức MEDIUM

### 🟡 F15: `Intl.NumberFormat` và `Intl.DateTimeFormat` Tạo Mới Mỗi Lần Gọi

**File:** `frontend/src/utils/format.js`

**Vấn đề:** `formatCurrency()` tạo `new Intl.NumberFormat(...)` mỗi lần gọi. Trong bảng 50 dòng, tạo 50 formatter instances.

**Sửa:**

```js
// ❌ Tạo mới mỗi lần
export function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

// ✅ Cache formatter
const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0
});
const dateFormatter = new Intl.DateTimeFormat('vi-VN');

export function formatCurrency(value) {
  return currencyFormatter.format(value);
}

export function formatDate(value) {
  return dateFormatter.format(new Date(value));
}
```

---

### 🟡 F16: Inline Functions Gây Re-render

```jsx
// ❌ Tạo function mới mỗi render
<Button onClick={() => handleEdit(item)}>Edit</Button>

// ✅ Dùng useCallback + data attribute
const handleEditClick = useCallback((e) => {
  const id = e.currentTarget.dataset.id;
  handleEdit(id);
}, [handleEdit]);

<Button data-id={item.id} onClick={handleEditClick}>Edit</Button>
```

---

### 🟡 F17: Thiếu `useMemo` Cho Filter/Sort

```jsx
// ❌ Filter chạy lại mỗi render
const filtered = data.filter(item => item.name.includes(search));

// ✅ Chỉ filter khi data hoặc search thay đổi
const filtered = useMemo(
  () => data.filter(item => item.name.includes(search)),
  [data, search]
);
```

---

### 🟡 F18: API Client Không Có Timeout

**File:** `frontend/src/api/client.js`

```js
// Thêm timeout vào apiFetch:
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    // ...
  } finally {
    clearTimeout(timeout);
  }
}
```

---

### 🟡 F19: Google Fonts Dùng @import (Chặn CSS)

**File:** `frontend/src/styles.css` — dòng 1

```css
/* ❌ Chặn CSS parsing */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

**Sửa:** Chuyển sang `<link>` trong `index.html`:

```html
<!-- frontend/index.html — trong <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
```

Rồi xóa dòng `@import` trong `styles.css`.

---

### 🟡 F20: CSS Animation Chạy Liên Tục

**File:** `frontend/src/styles.css`

```css
/* Thêm hỗ trợ reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Danh Sách Index SQL Cần Thêm

Chạy script SQL sau trên database:

```sql
-- =============================================
-- PERFORMANCE INDEXES — ClassManager
-- =============================================

-- Auth: Tăng tốc session lookup trong auth middleware
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions(user_id, id)
  WHERE is_revoked = false;

-- Attendance: Lookup theo session
CREATE INDEX IF NOT EXISTS idx_attendance_session
  ON attendance(session_id);

-- Enrollment: Lookup active enrollments theo class
CREATE INDEX IF NOT EXISTS idx_enrollments_class_active
  ON enrollments(class_id)
  WHERE status = 'active';

-- Class Sessions: Danh sách theo class, sắp xếp theo ngày
CREATE INDEX IF NOT EXISTS idx_sessions_class_date
  ON class_sessions(class_id, session_date);

-- Invoices: Lookup theo student
CREATE INDEX IF NOT EXISTS idx_invoices_student
  ON invoices(student_id);

-- Payments: Lookup theo invoice
CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON payments(invoice_id);

-- Login logs: Query admin theo user và thời gian
CREATE INDEX IF NOT EXISTS idx_login_logs_user_created
  ON login_logs(user_id, created_at DESC);

-- Schedule conflict check: Room + Day
CREATE INDEX IF NOT EXISTS idx_schedules_room_day
  ON class_schedules(room_id, day_of_week);

-- Schedule conflict check: Class (for teacher conflict via JOIN)
CREATE INDEX IF NOT EXISTS idx_schedules_class
  ON class_schedules(class_id);
```

---

## 9. Checklist Thực Hiện

Thực hiện theo thứ tự ưu tiên từ cao xuống thấp:

### Đợt 1 — Tác Động Lớn Nhất (Ưu tiên làm ngay)

- [ ] **C3** — Cài `compression` middleware → giảm 60-80% dung lượng response
- [ ] **C2** — Cấu hình pool: `max:20`, timeouts
- [ ] **C4** — Batch attendance query (N+1 → 2 query)
- [ ] **H2** — Chạy script thêm indexes SQL
- [ ] **F1** — Deep import Fluent UI icons → giảm 200-500KB bundle
- [ ] **F2** — Cài React Query, viết lại `usePageData` → xóa delay navigate
- [ ] **F19** — Chuyển Google Fonts từ `@import` sang `<link>`

### Đợt 2 — Cải Thiện Rõ Rệt

- [ ] **C1** — Session cache trong auth middleware
- [ ] **C5** — Cache headers cho static và API
- [ ] **H3** — Thêm pagination cho 14+ endpoints
- [ ] **F3** — Lazy load LoginPage và NotFoundPage
- [ ] **F4** — Dashboard chỉ fetch count thay vì full data
- [ ] **F5** — Tách reference data fetch khỏi page data
- [ ] **F10** — Debounce search inputs
- [ ] **F13** — Vite chunk splitting
- [ ] **F15** — Cache Intl formatters
- [ ] **M1** — Window function thay 2 query phân trang
- [ ] **M2** — Static file cache headers

### Đợt 3 — Ổn Định và Mở Rộng

- [ ] **F6** — Error Boundaries
- [ ] **F11** — Tách component lớn
- [ ] **F12** — Virtualization cho bảng
- [ ] **F14** — Skeleton loading nhất quán
- [ ] **H1** — Thay SELECT * bằng columns cụ thể
- [ ] **H4** — Rate limiting

### Đợt 4 — Nâng Cao

- [ ] **H5** — Cache/materialize report views
- [ ] **H6** — Pagination cho timetable getAll
- [ ] **M4** — JWT verify async
- [ ] **M5** — Request logging (pino)
- [ ] **F9** — Tách CSS monolithic
- [ ] **F20** — Reduced-motion support

---

> [!TIP]
> **Ước tính hiệu quả sau khi áp dụng Đợt 1 + Đợt 2:**
> - API response time: giảm **40-60%** (compression + indexes + pool tuning)
> - Perceived load time: giảm **70%+** (React Query cache → trang mở tức thì khi revisit)
> - Bundle size: giảm **20-30%** (chunk splitting)
> - Network traffic: giảm **60-80%** (compression + cache headers)

---

*Tài liệu này được tạo ngày 24/06/2026 bởi phân tích tự động toàn bộ source code.*
