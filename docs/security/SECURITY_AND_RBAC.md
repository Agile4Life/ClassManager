# Cơ Chế Bảo Mật & Phân Quyền (Security & RBAC) - ClassManager

Tài liệu này đặc tả toàn bộ các giải pháp an toàn thông tin, bảo vệ dữ liệu và hệ thống phân quyền 5 tầng được cài đặt trong **ClassManager**.

---

## 1. Phân Quyền Đa Tầng Dựa Trên Vai Trò (Role-Based Access Control - RBAC)

Hệ thống hỗ trợ 5 vai trò (Roles) với phạm vi quyền hạn (Scope) được phân định rõ ràng:

| Vai Trò | Mã Quyền | Phạm Vi Quyền Hạn |
| :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin` | Toàn quyền hệ thống: Cấu hình hệ thống, quản lý tài khoản, xem mọi dữ liệu tài chính, lớp học, phân công giáo viên. |
| **Nhân viên (Staff)** | `staff` | Quản lý học vụ, tạo lớp, xếp lịch, ghi danh học sinh, tạo và thu hóa đơn học phí. Không được sửa quyền tài khoản cấp admin. |
| **Giáo viên (Teacher)** | `teacher` | Chỉ xem và thao tác trên các lớp học mà mình được phân công phụ trách: Điểm danh, nhập điểm, giao bài tập, chấm bài. |
| **Học sinh (Student)** | `student` | Chỉ xem lịch học cá nhân, bảng điểm cá nhân, làm bài tập và xem thông tin lớp học mình đang tham gia. |
| **Phụ huynh (Parent)** | `parent` | Chỉ xem thông tin học tập, điểm danh, kết quả và hóa đơn học phí của các học sinh được liên kết với hồ sơ phụ huynh. |

### Cơ chế thực thi (Enforcement):
- **Phía Backend**: Sử dụng middleware `requireRole(...)` ([backend/middlewares/role.middleware.js](file:///d:/ClassManagement/ClassManager/backend/middlewares/role.middleware.js)) chặn ngay tại Router trước khi gọi Controller. Nếu vai trò không khớp, trả về HTTP `403 Forbidden`.
- **Phía Controller (Ownership Checking)**: Ngoài việc kiểm tra Role, Controller kiểm tra quyền sở hữu (Data Ownership). Ví dụ: Giáo viên A không thể chấm bài của lớp do Giáo viên B phụ trách, Phụ huynh X không thể xem điểm của con Phụ huynh Y.
- **Phía Frontend**: Sử dụng `ProtectedRoute` ([frontend/src/auth/ProtectedRoute.jsx](file:///d:/ClassManagement/ClassManager/frontend/src/auth/ProtectedRoute.jsx)) ẩn các menu và chặn điều hướng trực tiếp qua URL.

---

## 2. Cơ Chế Xác Thực (Authentication with JWT & Refresh Tokens)

1. **Access Token (JWT)**:
   - Được tạo bởi `signAccessToken(payload)` ([backend/utils/jwt.js](file:///d:/ClassManagement/ClassManager/backend/utils/jwt.js)) có chữ ký điện tử HMAC-SHA256 với `JWT_SECRET`.
   - Thời hạn hiệu lực cấu hình qua `JWT_EXPIRES_IN` (mặc định 1 ngày hoặc ngắn hơn trong production).
   - Đính kèm trong HTTP Header: `Authorization: Bearer <token>`.
2. **Phiên Làm Việc (Database-backed Sessions / Refresh Token)**:
   - Khi đăng nhập thành công, một bản ghi phiên làm việc được lưu trong bảng `user_sessions` kèm IP và `User-Agent` của thiết bị ([backend/controllers/auth.controller.js](file:///d:/ClassManagement/ClassManager/backend/controllers/auth.controller.js#L97-L115)).
   - Cho phép Admin hoặc người dùng chủ động thu hồi (revoke) phiên làm việc khi đăng xuất hoặc nghi ngờ bị lộ tài khoản.

---

## 3. Phòng Chống Tấn Công SQL Injection

Hệ thống tuyệt đối **KHÔNG** sử dụng cơ chế nối chuỗi string trực tiếp vào câu lệnh SQL (`sql = "SELECT * FROM ... WHERE id = " + id` - Anti-pattern).

### Giải pháp áp dụng:
1. **Parameterized Queries ($1, $2, ...)**:
   Mọi tham số đầu vào từ Client đều được truyền dưới dạng mảng tham số riêng biệt vào thư viện `pg`:
   ```javascript
   // AN TOÀN TUYỆT ĐỐI
   const result = await client.query(
     'SELECT * FROM user_accounts WHERE username = $1 AND is_deleted = false',
     [usernameInput.toLowerCase()]
   );
   ```
2. **Query Builder An Toàn ([backend/utils/query.js](file:///d:/ClassManagement/ClassManager/backend/utils/query.js))**:
   Các hàm `buildInsert`, `buildUpdate` tự động ánh xạ tên cột thành danh sách placeholder `$1, $2, $3...`, cách ly hoàn toàn dữ liệu người dùng khỏi cấu trúc cú pháp của lệnh SQL.

---

## 4. Bảo Vệ Mật Khẩu & Dữ Liệu Nhạy Cảm

1. **Băm Mật Khẩu (Password Hashing)**:
   - Sử dụng giải thuật mật mã tiêu chuẩn (Salt ngẫu nhiên kết hợp thuật toán băm một chiều an toàn). Không bao giờ lưu mật khẩu dưới dạng văn bản thô (Plain Text).
2. **Quên & Đặt Lại Mật Khẩu (Password Reset Flow)**:
   - Khi người dùng yêu cầu đặt lại mật khẩu, hệ thống sinh ra một `rawToken` ngẫu nhiên có độ dài 64 bytes (`crypto.randomBytes(32).toString('hex')`).
   - Chỉ lưu trữ mã băm SHA-256 của token vào database (`reset_token_hash`).
   - Token chỉ có hiệu lực trong 15 phút. Khi người dùng nhập lại token, hệ thống băm token đó rồi so sánh với bản ghi trong database, ngăn chặn hoàn toàn rủi ro lộ token từ CSDL.

---

## 5. Xác Thực Google OAuth 2.0

- Tích hợp Google Identity Services ([backend/controllers/auth.controller.js](file:///d:/ClassManagement/ClassManager/backend/controllers/auth.controller.js#L14-L40)).
- Mã token Google Credential được gửi lên server và xác thực qua thư viện chính thức `google-auth-library` (`OAuth2Client.verifyIdToken`).
- Server kiểm tra `client_id` và xác thực định danh Google `sub` (Google Subject ID duy nhất).
- Nếu email chưa tồn tại trong hệ thống, sinh ra `setup_token` có chữ ký JWT tạm thời (15 phút) để người dùng hoàn thiện thông tin (họ tên, số điện thoại, vai trò) trước khi tạo tài khoản chính thức.

---

## 6. Kiểm Soát Truy Cập Nguồn Gốc (CORS Policy)

- Được quản trị tập trung tại [backend/utils/cors.js](file:///d:/ClassManagement/ClassManager/backend/utils/cors.js).
- Trong môi trường Production: Chỉ cho phép các domain nằm trong biến môi trường `CORS_ORIGIN` (hoặc cùng origin của Vercel).
- Tự động từ chối mọi request giả mạo origin khác với thông báo lỗi rõ ràng.
