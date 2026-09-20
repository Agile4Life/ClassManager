import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ============================================================================
// K6 TEST: RACE CONDITION & ADVISORY LOCK (Kiểm tra chống trùng lịch học)
// Điểm nghẽn kiểm thử: POST /api/classes/:classId/sessions
// Backend xử lý: pg_advisory_xact_lock(hashtext(...)) trong session.controller.js
// ============================================================================

const successCount = new Counter('session_created_201');
const conflictCount = new Counter('session_conflict_409');
const serverErrorCount = new Counter('server_error_500');
const validResponseRate = new Rate('valid_concurrency_handling');

export const options = {
  scenarios: {
    // 20 Virtual Users (VUs) cùng ập vào bắn đồng thời trong cùng 1 tích tắc
    race_rush: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 20,
      maxDuration: '20s',
    },
  },
  thresholds: {
    // Đảm bảo không có lỗi sập server (500 / Connection pool timeout)
    'server_error_500': ['count==0'],
    // Đúng duy nhất 1 request được phép thành công tạo lịch
    'session_created_201': ['count==1'],
    // Toàn bộ các request còn lại phải được chặn bằng 409
    'session_conflict_409': ['count==19'],
    // 100% request phải được xử lý hợp lệ (201 hoặc 409)
    'valid_concurrency_handling': ['rate==1.0'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3005';
const USERNAME = __ENV.TEST_USER || 'admin';
const PASSWORD = __ENV.TEST_PASS || 'Admin@123';

// 1. SETUP: Chạy 1 lần duy nhất trước khi các VUs bắt đầu
export function setup() {
  console.log(`[SETUP] Đang đăng nhập tài khoản ${USERNAME} tại ${BASE_URL}...`);
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    throw new Error(`Đăng nhập thất bại (${loginRes.status}): ${loginRes.body}`);
  }

  const token = loginRes.json('data.token');
  console.log('[SETUP] Đăng nhập thành công! Đang lấy danh sách lớp học active...');

  // Tự động tìm một lớp có trạng thái active
  let targetClassId = Number(__ENV.CLASS_ID) || null;
  if (!targetClassId) {
    const classesRes = http.get(`${BASE_URL}/api/classes`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (classesRes.status === 200) {
      const body = classesRes.json('data');
      const items = Array.isArray(body) ? body : (body?.items || []);
      for (let i = 0; i < items.length; i++) {
        if (items[i].status === 'active') {
          targetClassId = Number(items[i].class_id);
          break;
        }
      }
    }
  }
  if (!targetClassId) targetClassId = 4; // Fallback vào lớp Toán 8

  console.log(`[SETUP] Chọn lớp thử nghiệm: class_id = ${targetClassId}. Bắt đầu 20 VUs tranh chấp...`);

  // Sinh ngày ngẫu nhiên trong tương lai để không bị trùng lặp
  const randomDay = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
  const testDate = `2027-11-${randomDay}`;

  return {
    token,
    classId: targetClassId,
    testDate,
    startTime: '08:00',
    endTime: '10:00',
  };
}

// 2. VU EXECUTION: 20 VUs cùng cố gắng tạo lịch học tại CÙNG 1 NGÀY và CÙNG 1 GIỜ
export default function (data) {
  const payload = JSON.stringify({
    session_date: data.testDate,
    start_time: data.startTime,
    end_time: data.endTime,
    topic: `K6 Concurrency Race Test (VU ${__VU})`,
    status: 'scheduled',
    note: 'Tạo bởi k6 để kiểm tra Advisory Lock',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
  };

  const res = http.post(
    `${BASE_URL}/api/classes/${data.classId}/sessions`,
    payload,
    params
  );

  const is201 = res.status === 201;
  const is409 = res.status === 409;
  const is500 = res.status >= 500;

  if (is201) successCount.add(1);
  if (is409) conflictCount.add(1);
  if (is500) serverErrorCount.add(1);

  validResponseRate.add(is201 || is409);

  check(res, {
    'Mã phản hồi hợp lệ (201 Created hoặc 409 Conflict)': (r) => r.status === 201 || r.status === 409,
    'Không bị lỗi sập Server / Pool Timeout (500)': (r) => r.status < 500,
  });
}

// 3. TEARDOWN: Tự động dọn dẹp buổi học vừa tạo để có thể chạy lại nhiều lần
export function teardown(data) {
  console.log('[TEARDOWN] Đang dọn dẹp dữ liệu test trên database...');
  const listRes = http.get(
    `${BASE_URL}/api/classes/${data.classId}/sessions?from_date=${data.testDate}&to_date=${data.testDate}`,
    { headers: { 'Authorization': `Bearer ${data.token}` } }
  );

  if (listRes.status === 200) {
    const sessions = listRes.json('data') || [];
    for (const s of sessions) {
      if (s.session_date.startsWith(data.testDate)) {
        http.del(
          `${BASE_URL}/api/sessions/${s.session_id}`,
          null,
          { headers: { 'Authorization': `Bearer ${data.token}` } }
        );
        console.log(`[TEARDOWN] Đã xóa session_id=${s.session_id} thành công.`);
      }
    }
  }
  console.log('[TEARDOWN] Hoàn tất dọn dẹp! CSDL sạch 100%.');
}
