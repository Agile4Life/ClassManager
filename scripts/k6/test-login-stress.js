import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ============================================================================
// K6 TEST: STRESS & CONNECTION POOL EXHAUSTION CHO API ĐĂNG NHẬP
// Điểm nghẽn kiểm thử: POST /api/auth/login
// Lý do DỄ LỖI NHẤT:
// 1. bcrypt (pgcrypto crypt) ngốn CPU cực mạnh khi tính hash.
// 2. Mỗi request login mở 1 Transaction thực hiện tới 7 câu lệnh SQL nối tiếp
//    (user_accounts, user_sessions, update hash, update last_login, login_logs).
// 3. Database connection pool (DATABASE_POOL_MAX) chỉ có 10 kết nối.
//    Khi có 30-50 users dồn vào, hàng đợi bị nghẽn, dẫn đến lỗi 500 Connection Timeout!
// ============================================================================

const loginDuration = new Trend('login_duration_ms');
const errorRate = new Rate('login_error_rate');
const poolExhaustion500 = new Counter('pool_timeout_500_errors');

export const options = {
  stages: [
    { duration: '5s', target: 5 },    // Khởi động nhẹ: 5 người đăng nhập
    { duration: '10s', target: 20 },  // Tăng tải vượt quá Pool Max (10): 20 người
    { duration: '10s', target: 40 },  // Đỉnh tải (Spike): 40 người cùng đăng nhập dồn dập
    { duration: '5s', target: 0 },    // Hạ tải về 0
  ],
  thresholds: {
    // Thời gian phản hồi 95% số request phải dưới 3000ms
    'login_duration_ms': ['p(95)<3000'],
    // Tỷ lệ lỗi cho phép dưới 10% khi bị quá tải
    'login_error_rate': ['rate<0.10'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3005';

// Danh sách các tài khoản có sẵn trong hệ thống (từ seed.sql)
const TEST_ACCOUNTS = [
  { u: 'admin', p: 'Admin@123' },
  { u: 'staff01', p: 'Staff@123' },
  { u: 'teacher01', p: 'Teacher@123' },
  { u: 'parent01', p: 'Parent@123' },
  { u: 'student01', p: 'Student@123' },
];

export default function () {
  // Mỗi Virtual User chọn luân phiên một tài khoản để đăng nhập
  const account = TEST_ACCOUNTS[__VU % TEST_ACCOUNTS.length];

  const payload = JSON.stringify({
    username: account.u,
    password: account.p,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s', // Timeout 10 giây nếu server bị treo
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  const duration = Date.now() - startTime;

  loginDuration.add(duration);

  const isSuccess = res.status === 200;
  const is500 = res.status >= 500;

  errorRate.add(!isSuccess);
  if (is500) {
    poolExhaustion500.add(1);
    console.warn(`[VU ${__VU}] Server bị quá tải / cạn kết nối Pool! Status: ${res.status}, Body: ${res.body}`);
  }

  check(res, {
    'Đăng nhập thành công (HTTP 200)': (r) => r.status === 200,
    'Có trả về access token': (r) => {
      try {
        return !!r.json('data.token');
      } catch (e) {
        return false;
      }
    },
    'Không bị lỗi cạn Pool / Crash 500': (r) => r.status < 500,
  });

  // Nghỉ nhẹ giữa các lần request giả lập hành vi người dùng thật
  sleep(0.5);
}
