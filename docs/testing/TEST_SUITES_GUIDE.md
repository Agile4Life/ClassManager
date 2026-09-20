# Hướng Dẫn & Tài Liệu Bộ Kiểm Thử Tự Động Toàn Diện (ClassManager Automated Test Suites)

Hệ thống kiểm thử tự động của ClassManager được thiết kế theo kiến trúc phân tầng chuẩn doanh nghiệp (End-to-End & Integration Testing), chạy trực tiếp trên nền tảng Node.js mà không cần cài đặt thêm các công cụ bên thứ ba phức tạp như k6 hay Mocha.

---

## 1. Cấu Trúc Thư Mục Kiểm Thử

```text
tests/
├── helpers/
│   └── test-env.js              # Khởi tạo ephemeral server, quản lý kết nối DB & JWT tokens
├── 01-health-smoke.test.js      # Kiểm tra sức khỏe, CORS, 404 handler, X-Powered-By, admin debug
├── 02-auth-rbac.test.js         # Đăng nhập 5 vai trò, JWT verify, phân quyền RBAC, thu hồi session
├── 03-resources-crud.test.js    # CRUD Môn học, Phòng học, Giáo viên (soft delete), Phụ huynh, Lớp học
├── 04-students-relations.test.js# CRUD Học sinh, liên kết phụ huynh, import batch, ghi danh lớp học
├── 05-timetable-sessions.test.js# Lịch học tuần, tự động sinh buổi học, thời khóa biểu & điểm danh
├── 06-academic-assignments.test.js # Chuyên đề, bài tập, câu hỏi trắc nghiệm/tự luận, nộp bài & chấm điểm
├── 07-finance-invoices.test.js  # Học phí, xuất hóa đơn, ghi nhận thanh toán & lịch sử tài chính
├── 08-reports-analytics.test.js # Báo cáo chuyên đề yếu (View), tổng kết bài tập, sổ liên lạc điện tử
├── 09-security-validation.test.js # Phòng chống SQL Injection, Query Builder sanitization, validation
├── 10-concurrency-race.test.js  # Race Condition: Overbooking 1 suất cuối, Stress login, Advisory lock
└── run-all.js                   # Master Runner điều phối toàn bộ 10 suites và xuất báo cáo tổng hợp
```

---

## 2. Hướng Dẫn Thực Thi Kiểm Thử

### 2.1. Chạy Toàn Bộ 10 Test Suites (Khuyến Nghị)
```bash
npm run test:all
# Hoặc:
node tests/run-all.js
```
*Kết quả sẽ hiển thị bảng tổng kết trực quan trên terminal và lưu tệp JSON chi tiết tại `tests/test-results.json`.*

### 2.2. Chạy Riêng Lẻ Từng Test Suite
Bạn có thể chạy bất kỳ test suite nào độc lập:
```bash
node tests/01-health-smoke.test.js
node tests/02-auth-rbac.test.js
node tests/03-resources-crud.test.js
node tests/04-students-relations.test.js
node tests/05-timetable-sessions.test.js
node tests/06-academic-assignments.test.js
node tests/07-finance-invoices.test.js
node tests/08-reports-analytics.test.js
node tests/09-security-validation.test.js
node tests/10-concurrency-race.test.js
```

---

## 3. Chi Tiết Các Trường Hợp Kiểm Thử Theo Từng Suite

### Suite 01: Health, Smoke & System Infrastructure
- **Test 1.1**: `GET /api/health` trả về mã 200, status `'ok'` và thời gian máy chủ database hợp lệ.
- **Test 1.2**: Header `x-powered-by` bị vô hiệu hóa hoàn toàn để bảo mật thông tin công nghệ backend.
- **Test 1.3**: Endpoint không tồn tại ngoài API trả về mã lỗi 404 tiêu chuẩn.
- **Test 1.4**: Gọi API không tồn tại có token xác thực trả về JSON 404 `{ success: false, message: 'Route not found' }`.
- **Test 1.5**: Kiểm tra CORS: Cho phép Origin phát triển (`http://127.0.0.1:5174`).
- **Test 1.6**: Phân quyền Debug: `GET /api/admin/debug/class-schema` yêu cầu quyền Admin, chặn Học sinh (403) và người chưa đăng nhập (401).
- **Test 1.7**: Endpoint Probe: `POST /api/admin/debug/class-create-probe` thực thi tạo lớp mẫu trong Transaction và rollback an toàn.

### Suite 02: Authentication, Sessions & RBAC Authorization
- **Test 2.1**: Đăng nhập Admin thành công với tài khoản chuẩn (`admin / Admin@123`).
- **Test 2.2**: Đăng nhập thành công cho cả 4 vai trò còn lại: `staff01`, `teacher01`, `parent01`, `student01`.
- **Test 2.3**: Đăng nhập sai mật khẩu trả về 401 Unauthorized.
- **Test 2.4**: Đăng nhập với tên tài khoản không tồn tại trả về 401.
- **Test 2.5**: Thiếu username hoặc password trả về 400 Bad Request.
- **Test 2.6**: Truy cập `/api/auth/me` không có token trả về 401.
- **Test 2.7**: Truy cập `/api/auth/me` với token giả mạo trả về 401.
- **Test 2.8**: `/api/auth/me` trả về đúng danh tính, vai trò và ID liên kết (teacher_id, student_id,...).
- **Test 2.9 - 2.13**: Kiểm tra RBAC ma trận phân quyền: Chỉ Admin được vào `/api/admin/accounts` (200), Staff, Teacher, Parent, Student đều bị từ chối 403 Forbidden.
- **Test 2.14**: Quản lý phiên đăng xuất: `POST /api/auth/logout` hủy session trong CSDL, token đó lập tức bị từ chối ở request tiếp theo.

### Suite 03: Core Resources CRUD
- **Test 3.1 - 3.4**: Môn học (Subjects): Lấy danh sách, tạo mới, lấy chi tiết, cập nhật mô tả.
- **Test 3.5 - 3.7**: Phòng học (Rooms): Lấy danh sách, tạo phòng, cập nhật sức chứa.
- **Test 3.8 - 3.10**: Giáo viên (Teachers): Tạo giáo viên, kiểm tra danh sách, kiểm tra Xóa Mềm (`is_deleted = true`) không còn xuất hiện trong danh sách hoạt động.
- **Test 3.11**: Phụ huynh (Parents): Tạo hồ sơ phụ huynh.
- **Test 3.12 - 3.15**: Lớp học (Classes): Kiểm tra ràng buộc hợp lệ dữ liệu (từ chối học phí âm, từ chối sĩ số <= 0), tạo lớp học liên kết môn và phòng học, lấy danh sách lớp có đính kèm thông tin giáo viên phụ trách.

### Suite 04: Students, Relationships & Class Enrollment
- **Test 4.1 - 4.4**: Học sinh (Students): Lấy danh sách phân trang, tạo học sinh mới kèm tự sinh mã học sinh (`student_code`), xem chi tiết, cập nhật trường học.
- **Test 4.5**: Nhập dữ liệu hàng loạt (`POST /api/students/import`): Chuẩn hóa số điện thoại, định dạng tên và tạo hồ sơ.
- **Test 4.6 - 4.7**: Quan hệ Phụ huynh - Học sinh: Liên kết phụ huynh (`mother`/`father`, `is_primary_contact`), tra cứu danh sách phụ huynh của học sinh.
- **Test 4.8 - 4.10**: Ghi danh lớp học (`POST /api/classes/:id/enroll/:studentId`): Ghi danh học sinh vào lớp, chặn ghi danh trùng lặp (409 Conflict), lấy danh sách học sinh theo lớp.
- **Test 4.11**: Xóa mềm học sinh: Đánh dấu `is_deleted = true` và xác minh không xuất hiện trong danh sách thông thường.

### Suite 05: Timetable, Sessions & Attendance
- **Test 5.1**: Tạo lịch học định kỳ trong tuần (`day_of_week`, `start_time`, `end_time`).
- **Test 5.2 - 5.4**: Tự động sinh các buổi học thực tế (`generate-sessions`) từ ngày bắt đầu đến ngày kết thúc của lớp, cập nhật nội dung bài học buổi học.
- **Test 5.5 - 5.6**: Tra cứu thời khóa biểu toàn hệ thống và thời khóa biểu theo từng lớp học.
- **Test 5.7 - 5.9**: Quản lý điểm danh: Lưu kết quả điểm danh học sinh (`present`, `absent`, `late`), tra cứu điểm danh theo buổi và xem lịch sử điểm danh của lớp.

### Suite 06: Academic Topics, Assignments & Grading
- **Test 6.1 - 6.3**: Chuyên đề học tập (Topics): Tra cứu chuyên đề, tạo chuyên đề môn học, cập nhật mức độ khó.
- **Test 6.4 - 6.6**: Bài tập về nhà (Assignments): Giao bài tập cho lớp, xem danh sách bài tập của lớp, xem chi tiết bài tập.
- **Test 6.7 - 6.8**: Câu hỏi bài tập (Questions): Thêm câu hỏi vào bài tập (trắc nghiệm, tính toán, tự luận), tra cứu danh sách câu hỏi.
- **Test 6.9 - 6.11**: Nộp bài & Chấm điểm (Submissions): Học sinh nộp bài tập, lưu câu trả lời kèm điểm số và lời nhận xét của giáo viên.

### Suite 07: Finance, Invoices & Payments
- **Test 7.1 - 7.4**: Hóa đơn học phí (Invoices): Lấy danh sách hóa đơn, tạo hóa đơn học phí tháng cho học sinh, tra cứu chi tiết hóa đơn, xem hóa đơn theo từng học sinh.
- **Test 7.5 - 7.7**: Ghi nhận thanh toán (Payments): Thu học phí (tiền mặt / chuyển khoản), xem danh sách giao dịch, xem lịch sử thanh toán của học sinh.
- **Test 7.8**: Cập nhật trạng thái hóa đơn sang `paid` khi đã thanh toán đủ.

### Suite 08: Reports & Academic Analytics
- **Test 8.1 - 8.2**: Phân tích chuyên đề yếu: Truy vấn View `v_student_weak_topics` toàn trung tâm và theo từng học sinh.
- **Test 8.3**: Báo cáo tổng kết bài tập: Truy vấn View `v_student_assignment_summary`.
- **Test 8.4**: Thống kê hiệu suất học tập của lớp học (`/api/reports/class/:id/performance`).
- **Test 8.5 - 8.8**: Sổ liên lạc điện tử (Progress Reports): Tạo báo cáo định kỳ tháng, tra cứu theo học sinh, cập nhật trạng thái đã gửi cho phụ huynh (`sent`), xóa báo cáo.

### Suite 09: Security & SQL Injection Defenses
- **Test 9.1**: Tấn công SQLi qua ô tìm kiếm: Input chuỗi `' OR '1'='1' --` được xử lý an toàn dưới dạng chuỗi thuần qua Parameterized Queries `$1`.
- **Test 9.2**: Tấn công chèn mã phá hủy: Chuỗi `; DROP TABLE students; --` không làm ảnh hưởng đến cấu trúc CSDL.
- **Test 9.3 - 9.5**: Query Builder Defenses: Hàm `buildInsert`, `buildUpdate` ném lỗi khi tên bảng, tên cột hoặc khóa chính chứa ký tự độc hại.
- **Test 9.6 - 9.8**: Ràng buộc dữ liệu đầu vào: Chặn giờ vượt quá 24:00, phát hiện ngày không tồn tại (2026-02-30), chặn số trang phân trang <= 0.
- **Test 9.9 - 9.10**: Ngăn chặn leo thang đặc quyền (Privilege Escalation): Học sinh không thể tự đổi vai trò lên Admin, Giáo viên không thể tạo tài khoản Admin trong module quản trị.

### Suite 10: Concurrency, Race Conditions & Stress Testing
- **Test 10.1**: **Chống bán vượt quá số lượng (Overbooking Defense)**:
  - Tạo lớp học chỉ còn đúng **1 suất duy nhất** (`max_students = 1`).
  - Gửi đồng thời 3 request ghi danh ở cùng 1 mili-giây bằng `Promise.all`.
  - Xác nhận: **Đúng 1 request thành công (201 Created)** và **2 request còn lại bị từ chối (409 Conflict - Class has reached its student capacity)**.
  - Kiểm tra trực tiếp trong CSDL: Sĩ số lớp thực tế đạt chính xác 1, không xảy ra overbooking.
- **Test 10.2**: **Stress Login**: Gửi đồng thời 10 request đăng nhập song song để kiểm tra giới hạn chịu tải của connection pool và bảo đảm không có connection leak.
- **Test 10.3**: **Advisory Lock đăng ký tài khoản**: Gửi đồng thời 2 request đăng ký cùng username/email, cơ chế `pg_advisory_xact_lock` ngăn chặn xung đột, đảm bảo đúng 1 tài khoản được tạo và 1 request trả về 409 Conflict.
