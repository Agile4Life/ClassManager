# Backend Architecture - ClassManager API

Thư mục `backend/` chứa toàn bộ mã nguồn xử lý phía máy chủ (Server-side) của hệ thống ClassManager. Được xây dựng trên nền tảng **Node.js + Express.js**, tuân thủ nghiêm ngặt mô hình **Kiến trúc phân tầng (Layered Architecture)**.

---

## 1. Bản Đồ Các Tầng Kiến Trúc (5 Architectural Layers)

```text
backend/
├── app.js                         # Application Config (CORS, Gzip, Middleware, Routes)
├── server.js                      # HTTP Server Entry Point (Local Development)
│
├── 1. config/                     # TẦNG CẤU HÌNH & KẾT NỐI (Infrastructure / Config Layer)
│   ├── db.js                      # PostgreSQL Connection Pool & SSL config
│   └── google-login-users.js      # Mapping danh sách tài khoản liên kết Google
│
├── 2. routes/                     # TẦNG ĐỊNH TUYẾN (Routing Layer)
│   ├── academic.routes.js         # Điểm số, bảng điểm, bài tập, nộp bài
│   ├── account.routes.js          # Quản lý tài khoản người dùng, phân quyền admin
│   ├── auth.routes.js             # Đăng ký, đăng nhập, Google OAuth, đổi mật khẩu
│   ├── class.routes.js            # Danh sách lớp, thông tin lớp, sĩ số
│   ├── finance.routes.js          # Hóa đơn học phí, ghi nhận thanh toán
│   ├── learning-history.routes.js # Lịch sử học tập, chuyên cần, tiến độ
│   ├── relationship.routes.js     # Liên kết học sinh - phụ huynh (N-N)
│   ├── report.routes.js           # Báo cáo doanh thu, sĩ số, chuyên cần
│   ├── resources.routes.js        # Generic CRUD router cho các danh mục
│   ├── session.routes.js          # Buổi học, điểm danh từng học sinh
│   ├── student.routes.js          # Hồ sơ học sinh, tìm kiếm, import Excel/CSV
│   └── timetable.routes.js        # Thời khóa biểu, lịch học hàng tuần
│
├── 3. middlewares/                # TẦNG TIỀN XỬ LÝ (Middleware Layer)
│   ├── auth.middleware.js         # Trích xuất, kiểm tra chữ ký JWT & nạp req.user
│   ├── role.middleware.js         # Kiểm tra quyền RBAC (admin, staff, teacher, student, parent)
│   └── error.middleware.js        # Bắt lỗi toàn cục, ánh xạ mã lỗi CSDL ra JSON chuẩn
│
├── 4. controllers/                # TẦNG NGHIỆP VỤ & ĐIỀU KHIỂN (Controller Layer)
│   ├── academic.controller.js
│   ├── account.controller.js
│   ├── auth.controller.js
│   ├── class.controller.js
│   ├── crud.controller.js
│   ├── finance.controller.js
│   ├── learning-history.controller.js
│   ├── report.controller.js
│   ├── session.controller.js
│   ├── student.controller.js
│   └── timetable.controller.js
│
└── 5. utils/                      # TẦNG TIỆN ÍCH & TRUY VẤN (Helpers & Query Builder Layer)
    ├── async-handler.js           # Bọc async hàm bắt lỗi tự động sang next()
    ├── class-teachers.js          # Chuẩn hóa quan hệ lớp học và giáo viên
    ├── code-generator.js          # Sinh mã định danh tự động (C001, S001, T001)
    ├── cors.js                    # Xác thực origin theo danh sách trắng
    ├── errors.js                  # Lớp AppError chuẩn hóa mã HTTP
    ├── jwt.js                     # Ký và xác minh JWT Access Token
    ├── query.js                   # Query Builder tham số hóa an toàn (buildInsert, buildUpdate)
    ├── registration.js            # Kiểm tra định dạng đăng ký tài khoản
    ├── response.js                # Định dạng JSON trả về chuẩn { success, message, data }
    ├── student-import.js          # Validate và chuẩn hóa dữ liệu import học sinh
    └── validation.js              # Kiểm tra ngày tháng ISO, phân trang, định dạng giờ
```

---

## 2. Nguyên Tắc Thiết Kế (Design Principles)

1. **Single Responsibility (Đơn nhiệm)**:
   - `routes/` chỉ định nghĩa URL và kiểm tra Role.
   - `middlewares/` tiền xử lý bảo mật (Auth/Role/Validation).
   - `controllers/` xử lý quy tắc nghiệp vụ (Business Rules) và điều phối giao dịch CSDL.
   - `utils/query.js` đảm bảo mọi câu lệnh SQL đều được tham số hóa ($1, $2, ...), chống 100% SQL Injection.
2. **Centralized Error Handling**:
   - Mọi hàm Controller đều được bọc bởi `asyncHandler()`. Không bao giờ để Exception rơi ra ngoài làm sập tiến trình Node.js.
3. **Consistent JSON Protocol**:
   - Thành công: `{ "success": true, "message": "...", "data": ... }`
   - Thất bại: `{ "success": false, "message": "..." }`
