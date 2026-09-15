# Cấu trúc mã nguồn ClassManager Backend

Tài liệu này mô tả cấu trúc backend hiện tại của hệ thống quản lý trung tâm học thêm ClassManager. Backend sử dụng Node.js, Express.js, PostgreSQL/Supabase và CommonJS.

## 1. Tổng quan kiến trúc

Backend được chia thành các lớp chính:

```text
HTTP Request
    │
    ▼
Express App / Router
    │
    ├── Authentication middleware
    ├── Role middleware
    │
    ▼
Controller
    │
    ├── Kiểm tra dữ liệu và quyền sở hữu
    ├── Transaction / business rules
    └── Parameterized SQL
    │
    ▼
PostgreSQL / Supabase
    │
    ▼
Standard JSON Response / Error Middleware
```

Các nguyên tắc đang được áp dụng:

- `database/schema.sql` là nguồn sự thật cho tên bảng, cột, khóa và constraint.
- Mọi dữ liệu đầu vào trong SQL đều dùng tham số `$1`, `$2`, ...
- Route chịu trách nhiệm khai báo URL và vai trò được phép truy cập.
- Controller xử lý nghiệp vụ và truy vấn database.
- Middleware xử lý xác thực, phân quyền và lỗi dùng chung.
- API trả về một định dạng JSON thống nhất.
- Secret chỉ nằm trong `.env`, không được commit vào Git.

## 2. Cây thư mục

```text
ClassManager/
├── .env                         # Cấu hình thật trên máy, bị Git bỏ qua
├── .env.example                 # Mẫu biến môi trường an toàn
├── .gitignore                   # Danh sách file/thư mục không commit
├── AGENTS_BACKEND_GUIDE.md      # Đặc tả nghiệp vụ backend ban đầu
├── CODE_STRUCTURE.md            # Tài liệu cấu trúc mã nguồn này
├── README.md                    # Hướng dẫn cài đặt và chạy nhanh
├── package.json                 # Dependency và npm scripts
├── package-lock.json            # Khóa phiên bản dependency
│
├── database/
│   ├── README_DATABASE.md       # Tài liệu thiết kế database
│   ├── schema.sql               # Tạo bảng, khóa, index và view
│   └── seed.sql                 # Dữ liệu mẫu và tài khoản kiểm thử
│
├── frontend/
│   ├── .env.example             # API URL cho Vite
│   ├── index.html               # HTML entry point
│   ├── package.json             # React, Vite và Fluent UI
│   ├── vite.config.js           # Dev server và /api proxy
│   └── src/
│       ├── api/                 # HTTP client và API errors
│       ├── auth/                # Auth context và protected route
│       ├── components/          # UI dùng chung
│       ├── hooks/               # Data-loading hook
│       ├── layout/              # Sidebar, mobile topbar và app shell
│       ├── pages/               # Các màn hình nghiệp vụ
│       ├── utils/               # Format ngày, giờ và tiền tệ
│       ├── App.jsx              # Route-level code splitting
│       ├── main.jsx             # Fluent theme và React root
│       └── styles.css           # Design tokens và responsive CSS
│
├── scripts/
│   ├── check-regressions.js     # Regression checks cho query/validation
│   ├── check-database.js        # Kiểm tra kết nối và bảng bắt buộc
│   └── check-syntax.js          # Kiểm tra cú pháp toàn bộ file JavaScript
│
└── src/
    ├── app.js                   # Cấu hình Express và gắn toàn bộ router
    ├── server.js                # Điểm khởi động HTTP server
    │
    ├── config/
    │   └── db.js                # PostgreSQL connection pool
    │
    ├── controllers/
    │   ├── academic.controller.js
    │   ├── auth.controller.js
    │   ├── class.controller.js
    │   ├── crud.controller.js
    │   ├── finance.controller.js
    │   ├── report.controller.js
    │   ├── session.controller.js
    │   └── timetable.controller.js
    │
    ├── middlewares/
    │   ├── auth.middleware.js
    │   ├── error.middleware.js
    │   └── role.middleware.js
    │
    ├── routes/
    │   ├── academic.routes.js
    │   ├── auth.routes.js
    │   ├── class.routes.js
    │   ├── finance.routes.js
    │   ├── relationship.routes.js
    │   ├── report.routes.js
    │   ├── resources.routes.js
    │   ├── session.routes.js
    │   └── timetable.routes.js
    │
    └── utils/
        ├── async-handler.js
        ├── access.js
        ├── errors.js
        ├── jwt.js
        ├── query.js
        ├── response.js
        └── validation.js
```

`node_modules/` không được trình bày trong cây vì đây là mã dependency được tạo bởi `npm install`.

## 3. Các file ở thư mục gốc

### `.env`

Chứa cấu hình thật của môi trường hiện tại:

- `PORT`: cổng HTTP.
- `NODE_ENV`: môi trường chạy.
- `DATABASE_URL`: chuỗi kết nối Supabase PostgreSQL.
- `DATABASE_SSL`: bật hoặc tắt TLS cho database.
- `JWT_SECRET`: khóa ký JWT.
- `JWT_EXPIRES_IN`: thời hạn access token.
- `REFRESH_TOKEN_EXPIRES_DAYS`: thời hạn session trong database.
- `EXPOSE_RESET_TOKEN`: chỉ bật rõ ràng khi kiểm thử reset password cục bộ.
- `CORS_ORIGIN`: danh sách frontend origin được phép gọi API.

Không được đưa nội dung `.env` vào tài liệu, log hoặc Git.

### `.env.example`

Mẫu cấu hình để thành viên khác tạo `.env` mà không làm lộ credential thật.

### `package.json`

Khai báo:

- Runtime dependencies: `express`, `pg`, `dotenv`, `cors`, `jsonwebtoken`.
- Development dependency: `nodemon`.
- Node.js yêu cầu phiên bản 18 trở lên.

Các lệnh npm:

| Lệnh | Chức năng |
|---|---|
| `npm start` | Chạy server bằng Node.js |
| `npm run dev` | Chạy server bằng Nodemon |
| `npm run check` | Kiểm tra cú pháp JavaScript |
| `npm run db:check` | Kiểm tra kết nối database theo kiểu read-only |
| `npm test` | Chạy regression checks cho query builder và validation |

### `README.md`

Hướng dẫn cài dependency, cấu hình môi trường, chạy server và các nhóm API chính.

### `AGENTS_BACKEND_GUIDE.md`

Đặc tả backend: stack công nghệ, module cần xây dựng, API yêu cầu, vai trò, SQL mẫu và quy tắc timetable.

## 4. Thư mục `database`

### `database/schema.sql`

Tạo extension `pgcrypto`, 23 bảng nghiệp vụ, index và 3 reporting view.

Các nhóm bảng:

| Nhóm | Bảng |
|---|---|
| Người dùng | `user_accounts`, `user_sessions`, `login_logs`, `password_reset_tokens` |
| Học sinh/phụ huynh | `students`, `parents`, `student_parents` |
| Giáo viên/môn/phòng | `teachers`, `subjects`, `rooms` |
| Lớp học | `classes`, `class_schedules`, `class_sessions`, `enrollments` |
| Điểm danh | `attendance` |
| Bài tập | `learning_topics`, `assignments`, `assignment_questions`, `assignment_submissions`, `student_answers` |
| Báo cáo | `progress_reports` |
| Tài chính | `invoices`, `payments` |

Các view báo cáo:

- `v_student_topic_performance`: kết quả theo học sinh và chủ đề.
- `v_student_weak_topics`: các chủ đề có mastery dưới 60%.
- `v_student_assignment_summary`: tổng hợp bài tập và điểm nộp bài.

### `database/seed.sql`

Thêm dữ liệu mẫu cho môn học, giáo viên, phòng, học sinh, lớp, lịch học, bài tập, học phí và tài khoản đăng nhập kiểm thử.

### `database/README_DATABASE.md`

Giải thích ý nghĩa bảng, quan hệ, constraint, view và thứ tự chạy SQL.

## 5. Điểm khởi động ứng dụng

### `src/server.js`

Đây là entry point khi chạy `npm start` hoặc `npm run dev`.

Trình tự:

1. Nạp biến môi trường bằng `dotenv`.
2. Import Express app và database pool.
3. Chạy `select 1` để kiểm tra database trước khi mở cổng HTTP.
4. Lắng nghe trên `PORT`, mặc định là `3000`.
5. Khi nhận `SIGINT` hoặc `SIGTERM`, đóng HTTP server và pool an toàn.
6. Nếu kết nối ban đầu thất bại, ghi lỗi và kết thúc process với exit code `1`.

### `src/app.js`

Tạo và cấu hình Express application:

- Tắt header `X-Powered-By`.
- Cấu hình CORS theo `CORS_ORIGIN`.
- Giới hạn JSON body ở mức `1mb`.
- Khai báo `GET /api/health` và kiểm tra database bằng `select now()`.
- Gắn toàn bộ router dưới prefix `/api`.
- Gắn middleware 404 sau routes.
- Gắn error middleware ở cuối cùng.

Thứ tự gắn router:

```text
/api/auth        -> auth.routes.js
/api             -> relationship.routes.js
/api/classes     -> class.routes.js
/api/timetable   -> timetable.routes.js
/api             -> session.routes.js
/api             -> academic.routes.js
/api             -> report.routes.js
/api             -> finance.routes.js
/api/{resource}  -> resources.routes.js
```

## 6. Cấu hình database

### `src/config/db.js`

Tạo một `pg.Pool` dùng chung cho toàn ứng dụng.

Đặc điểm:

- Dừng ngay nếu thiếu `DATABASE_URL`.
- Hỗ trợ `DATABASE_SSL=false` khi chạy PostgreSQL local.
- Khi dùng TLS, loại `sslmode` khỏi URL để cấu hình SSL tường minh không bị `pg-connection-string` ghi đè.
- Dùng `rejectUnauthorized: false` để tương thích Supabase pooler hiện tại.
- Theo dõi lỗi bất ngờ phát sinh từ pool.

Controller dùng hai kiểu truy cập:

- `pool.query(...)` cho truy vấn đơn.
- `pool.connect()` + `begin/commit/rollback` cho transaction nhiều bước.

## 7. Middleware

### `src/middlewares/auth.middleware.js`

Middleware `requireAuth`:

1. Đọc header `Authorization: Bearer <token>`.
2. Xác minh chữ ký và thời hạn JWT.
3. Lấy `sub` và `sid` từ payload.
4. Join `user_accounts` với `user_sessions`.
5. Chỉ chấp nhận tài khoản `active`, session chưa revoke và chưa hết hạn.
6. Gắn hồ sơ an toàn vào `req.user`.

JWT hợp lệ nhưng session đã logout vẫn bị từ chối.

### `src/middlewares/role.middleware.js`

Factory `requireRole(...roles)` kiểm tra `req.user.role`. Nếu vai trò không nằm trong danh sách, trả lỗi `403`.

Các role hợp lệ:

- `admin`
- `staff`
- `teacher`
- `student`
- `parent`

### `src/middlewares/error.middleware.js`

Bao gồm:

- `notFound`: trả `404` cho route không tồn tại.
- `errorHandler`: chuyển lỗi application và PostgreSQL sang JSON thống nhất.

Một số mã PostgreSQL được xử lý:

| Mã | Ý nghĩa HTTP |
|---|---|
| `23505` | `409` trùng unique value |
| `23503` | `409` lỗi quan hệ/foreign key |
| `23514` | `400` vi phạm check constraint |
| `22P02` | `400` sai định dạng dữ liệu |
| `22007`, `22008` | `400` ngày hoặc giờ không hợp lệ |

Middleware cũng xử lý JSON body lỗi và CORS origin không được phép.

## 8. Utility dùng chung

### `src/utils/async-handler.js`

Bọc async controller và chuyển Promise rejection tới error middleware, tránh phải lặp `try/catch` ở mọi route.

### `src/utils/access.js`

Chứa kiểm tra quyền truy cập class dùng chung cho teacher, admin và staff. Helper này thay thế các bản sao logic trước đây trong session, academic và report controller.

### `src/utils/errors.js`

- `AppError`: lỗi có HTTP status, message và details.
- `assert`: helper ném `AppError` khi điều kiện không đúng.

### `src/utils/jwt.js`

- `signAccessToken(user, sessionId)`: tạo JWT chứa user ID, session ID, role và ID hồ sơ liên kết.
- `verifyAccessToken(token)`: xác minh JWT bằng `JWT_SECRET`.

Payload JWT chính:

```text
sub, sid, role, teacher_id, student_id, parent_id
```

### `src/utils/query.js`

- `pick`: chỉ lấy các field nằm trong allowlist.
- `buildInsert`: tạo câu `INSERT` có parameter placeholders.
- `buildUpdate`: tạo câu `UPDATE` có parameter placeholders.
- `assertIdentifier` và `quoteIdentifier`: từ chối identifier không đúng regex an toàn và quote tên bảng/cột.

Tên bảng và tên cột chỉ đến từ cấu hình nội bộ, không đến trực tiếp từ request.

### `src/utils/response.js`

Response thành công:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

Response lỗi:

```json
{
  "success": false,
  "message": "Something went wrong"
}
```

`details` chỉ xuất hiện ngoài production.

### `src/utils/validation.js`

Chứa validation dùng chung cho thời gian, ngày ISO `YYYY-MM-DD` và phân trang. `timeToMinutes` được dùng chung bởi timetable và session controller.

## 9. Controller

### `src/controllers/crud.controller.js`

Factory tạo controller CRUD dùng chung cho:

- `students`
- `parents`
- `teachers`
- `subjects`
- `rooms`
- `classes`

Các chức năng:

- Danh sách có phân trang.
- `search` trên các cột được allowlist.
- Filter theo resource.
- Scope dữ liệu theo người dùng.
- Lấy chi tiết theo primary key.
- Tạo, cập nhật và xóa bản ghi.

Giới hạn danh sách tối đa 100 bản ghi mỗi trang.

### `src/controllers/auth.controller.js`

Phụ trách:

- Đăng nhập bằng PostgreSQL `crypt()`.
- Ghi cả đăng nhập thành công và thất bại vào `login_logs`.
- Tạo `user_sessions` và JWT trong transaction.
- Cập nhật `last_login_at`.
- Logout bằng cách revoke session.
- Trả hồ sơ người dùng hiện tại.
- Tạo reset token ngẫu nhiên và chỉ lưu SHA-256 hash.
- Đặt lại password bằng `crypt(..., gen_salt('bf'))`.
- Revoke toàn bộ session sau khi đổi password.

Reset token chỉ được trả về khi không chạy production và `EXPOSE_RESET_TOKEN=true` được bật rõ ràng. Production không trả token ra API.

### `src/controllers/class.controller.js`

Phụ trách quan hệ lớp học:

- Liên kết học sinh và phụ huynh bằng upsert.
- Lấy danh sách phụ huynh của học sinh.
- Lấy danh sách học sinh trong lớp.
- Ghi danh học sinh.
- Cập nhật hoặc xóa enrollment.

Khi ghi danh, transaction khóa lớp và kiểm tra:

- Lớp tồn tại.
- Học sinh tồn tại.
- Không vượt `max_students`.
- Không trùng unique `(student_id, class_id)`.

### `src/controllers/timetable.controller.js`

Phụ trách lịch học tuần và sinh buổi học:

- Xem toàn bộ timetable.
- Xem theo lớp, giáo viên, học sinh, phụ huynh hoặc phòng.
- Tạo, sửa và xóa `class_schedules`.
- Kiểm tra định dạng và thứ tự thời gian.
- Chặn xung đột phòng.
- Chặn xung đột giáo viên.
- Sinh `class_sessions` từ khoảng ngày.

Chống race condition bằng PostgreSQL advisory transaction lock theo:

- `room + day_of_week`
- `teacher + day_of_week`
- `class` khi sinh session hàng loạt

Session được sinh bằng `generate_series`, so khớp thứ trong tuần bằng `extract(isodow)` và bỏ qua session đã tồn tại.

### `src/controllers/session.controller.js`

Phụ trách:

- Danh sách buổi học của lớp.
- Tạo, sửa và xóa buổi học thực tế.
- Lấy danh sách điểm danh.
- Ghi một hoặc nhiều attendance record.
- Upsert attendance theo `(session_id, student_id)`.
- Cập nhật attendance.

Giáo viên chỉ thao tác trên lớp được gán cho mình. Học sinh phải có enrollment hợp lệ trước khi được điểm danh.

### `src/controllers/academic.controller.js`

Phụ trách toàn bộ học tập và bài tập:

- CRUD `learning_topics`.
- CRUD `assignments`.
- CRUD `assignment_questions`.
- Tạo và xem `assignment_submissions`.
- Tạo/cập nhật `student_answers`.

Quy tắc chính:

- Giáo viên chỉ quản lý lớp được phân công.
- Học sinh chỉ xem assignment của lớp đã ghi danh.
- Học sinh chỉ thấy assignment có status `assigned`.
- `correct_answer` bị loại khỏi response dành cho học sinh.
- Question phải dùng topic thuộc cùng subject với class.
- Submission phải thuộc học sinh đã ghi danh trong class.
- Học sinh chỉ sửa câu trả lời của chính mình.
- Giáo viên/admin/staff mới có thể nhập điểm và nhận xét.

### `src/controllers/report.controller.js`

Phụ trách:

- Báo cáo tiến độ của học sinh.
- Tạo, sửa và xóa `progress_reports`.
- Weak-topic report.
- Assignment summary.
- Hiệu suất học tập theo lớp.

Controller đọc trực tiếp ba reporting view trong schema. Student và parent chỉ thấy report đã gửi (`sent`). Parent phải liên kết với student. Teacher chỉ xem dữ liệu thuộc lớp của mình.

### `src/controllers/finance.controller.js`

Phụ trách:

- CRUD hóa đơn.
- Danh sách hóa đơn theo học sinh.
- Danh sách payment.
- Ghi payment mới.
- Danh sách payment theo học sinh.

Khi tạo invoice:

```text
final_amount = total_amount - discount_amount
```

Khi thanh toán:

1. Khóa invoice bằng `for update`.
2. Tính số tiền đã trả.
3. Không cho trả vượt số dư.
4. Ghi payment trong transaction.
5. Cập nhật invoice thành `partial` hoặc `paid`.

Student chỉ xem tài chính của chính mình. Parent chỉ xem tài chính của con được liên kết.

## 10. Router và API

Tất cả URL dưới đây có prefix `/api`.

### Authentication — `auth.routes.js`

| Method | URL | Xác thực |
|---|---|---|
| POST | `/auth/login` | Không |
| POST | `/auth/logout` | Có |
| GET | `/auth/me` | Có |
| POST | `/auth/forgot-password` | Không |
| POST | `/auth/reset-password` | Không |

### CRUD resource — `resources.routes.js`

Mỗi resource có các route:

```text
GET    /{resource}
GET    /{resource}/:id
POST   /{resource}
PUT    /{resource}/:id
DELETE /{resource}/:id
```

Resource và quyền:

| Resource | Quyền đọc | Quyền ghi |
|---|---|---|
| `students` | admin, staff, teacher có scope | admin, staff |
| `parents` | admin, staff | admin, staff |
| `teachers` | mọi role đã đăng nhập | admin, staff |
| `subjects` | mọi role đã đăng nhập | admin, staff |
| `rooms` | admin, staff, teacher | admin, staff |
| `classes` | mọi role đã đăng nhập, có scope | admin, staff |

Scope của `classes`:

- Teacher: chỉ lớp mình dạy.
- Student: chỉ lớp đã ghi danh.
- Parent: chỉ lớp của con được liên kết.

### Quan hệ — `relationship.routes.js`

| Method | URL | Role |
|---|---|---|
| POST | `/students/:studentId/parents/:parentId` | admin, staff |
| GET | `/students/:studentId/parents` | admin, staff |
| PUT | `/enrollments/:id` | admin, staff |
| DELETE | `/enrollments/:id` | admin, staff |

### Lớp học — `class.routes.js`

| Method | URL | Role |
|---|---|---|
| GET | `/classes/:classId/students` | admin, staff, teacher |
| POST | `/classes/:classId/enroll/:studentId` | admin, staff |
| POST | `/classes/:classId/schedules` | admin, staff |
| POST | `/classes/:classId/generate-sessions` | admin, staff |
| GET | `/classes/:classId/sessions` | admin, staff, teacher |
| POST | `/classes/:classId/sessions` | admin, staff, teacher |

### Timetable — `timetable.routes.js`

| Method | URL | Role |
|---|---|---|
| GET | `/timetable` | admin, staff |
| GET | `/timetable/class/:classId` | admin, staff, teacher |
| GET | `/timetable/teacher/:teacherId` | admin, staff, teacher |
| GET | `/timetable/student/:studentId` | admin, staff, student |
| GET | `/timetable/parent/:parentId` | admin, staff, parent |
| GET | `/timetable/room/:roomId` | admin, staff, teacher |

Teacher, student và parent bị kiểm tra ID sở hữu khi xem timetable cá nhân.

### Session, attendance và schedule — `session.routes.js`

Toàn bộ nhóm này dành cho `admin`, `staff`, `teacher`.

| Method | URL |
|---|---|
| PUT | `/sessions/:sessionId` |
| DELETE | `/sessions/:sessionId` |
| GET | `/sessions/:sessionId/attendance` |
| POST | `/sessions/:sessionId/attendance` |
| PUT | `/attendance/:attendanceId` |
| PUT | `/schedules/:scheduleId` |
| DELETE | `/schedules/:scheduleId` |

### Học tập — `academic.routes.js`

| Method | URL |
|---|---|
| GET | `/topics` |
| POST | `/topics` |
| PUT | `/topics/:topicId` |
| DELETE | `/topics/:topicId` |
| GET | `/classes/:classId/assignments` |
| POST | `/classes/:classId/assignments` |
| GET | `/assignments/:assignmentId` |
| PUT | `/assignments/:assignmentId` |
| DELETE | `/assignments/:assignmentId` |
| GET | `/assignments/:assignmentId/questions` |
| POST | `/assignments/:assignmentId/questions` |
| PUT | `/questions/:questionId` |
| DELETE | `/questions/:questionId` |
| GET | `/assignments/:assignmentId/submissions` |
| POST | `/assignments/:assignmentId/submissions` |
| GET | `/students/:studentId/submissions` |
| POST | `/submissions/:submissionId/answers` |
| PUT | `/answers/:answerId` |

Quyền cụ thể được khai báo trực tiếp cạnh từng route trong `academic.routes.js`, sau đó controller tiếp tục kiểm tra quyền sở hữu class/student.

### Báo cáo — `report.routes.js`

| Method | URL |
|---|---|
| GET | `/reports/student/:studentId` |
| POST | `/reports` |
| PUT | `/reports/:reportId` |
| DELETE | `/reports/:reportId` |
| GET | `/reports/weak-topics` |
| GET | `/reports/student/:studentId/weak-topics` |
| GET | `/reports/student/:studentId/assignment-summary` |
| GET | `/reports/class/:classId/performance` |

### Tài chính — `finance.routes.js`

| Method | URL | Role chính |
|---|---|---|
| GET | `/invoices` | admin, staff |
| GET | `/invoices/:invoiceId` | admin, staff |
| POST | `/invoices` | admin, staff |
| PUT | `/invoices/:invoiceId` | admin, staff |
| DELETE | `/invoices/:invoiceId` | admin, staff |
| GET | `/students/:studentId/invoices` | admin, staff, student, parent |
| GET | `/payments` | admin, staff |
| POST | `/payments` | admin, staff |
| GET | `/students/:studentId/payments` | admin, staff, student, parent |

## 11. Luồng authentication

### Login

```text
POST /api/auth/login
    │
    ├── Kiểm tra username/password
    ├── PostgreSQL crypt() xác minh password
    ├── BEGIN transaction
    ├── INSERT user_sessions
    ├── Tạo JWT chứa user_id + session_id
    ├── Hash token vào session
    ├── UPDATE last_login_at
    ├── INSERT login_logs
    └── COMMIT
```

### Request được bảo vệ

```text
Authorization: Bearer JWT
    │
    ├── verify JWT
    ├── lấy sub + sid
    ├── kiểm tra user active
    ├── kiểm tra session chưa revoke/hết hạn
    ├── gắn req.user
    └── kiểm tra role và quyền sở hữu
```

### Logout

`POST /api/auth/logout` đặt `is_revoked = true` và `logout_at = now()`. Token cũ không thể tiếp tục sử dụng dù JWT chưa hết hạn.

## 12. Phân quyền hai lớp

Hệ thống không chỉ kiểm tra role ở router mà còn kiểm tra ownership trong controller.

Ví dụ:

- Teacher có role hợp lệ nhưng chỉ được thao tác class có `classes.teacher_id` bằng `req.user.teacher_id`.
- Student chỉ xem timetable, assignment, submission và tài chính của chính mình.
- Parent chỉ xem dữ liệu của student có dòng tương ứng trong `student_parents`.
- Admin có toàn quyền.
- Staff quản lý dữ liệu vận hành nhưng các route vẫn được giới hạn rõ ràng.

## 13. Transaction và chống xung đột

Transaction được dùng tại các nghiệp vụ nhiều bước:

- Login.
- Reset password.
- Enrollment và kiểm tra sĩ số.
- Tạo/cập nhật schedule.
- Sinh class session.
- Tạo class session thủ công.
- Lưu attendance hàng loạt.
- Ghi payment và cập nhật invoice.

Mẫu chung:

```js
const client = await pool.connect();
try {
  await client.query('begin');
  // business queries
  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
}
```

## 14. Script kiểm tra

### `scripts/check-syntax.js`

Quét đệ quy `src/` và `scripts/`, sau đó chạy `node --check` cho từng file JavaScript.

### `scripts/check-database.js`

Thực hiện kiểm tra read-only:

- Kết nối database.
- Lấy thời gian server.
- Đếm bảng public.
- Đếm view public.
- Kiểm tra các bảng bắt buộc: `user_accounts`, `students`, `classes`, `class_schedules`, `class_sessions`.

Script không chạy schema, seed, insert, update hoặc delete.

### `scripts/check-regressions.js`

Kiểm tra các lỗi đã được sửa mà không cần database:

- Query builder tạo identifier đã quote.
- Table, column và primary-key identifier độc hại bị từ chối.
- Chuyển đổi thời gian hợp lệ/không hợp lệ.
- Ngày ISO được kiểm tra đúng.
- Pagination tính page, limit và offset chính xác.

## 15. Quy trình chạy dự án

```text
1. npm install
2. Tạo .env từ .env.example
3. Chạy database/schema.sql
4. Chạy database/seed.sql
5. npm run db:check
6. npm run check
7. npm test
8. npm run dev
9. Gọi GET /api/health
```

## 16. Cách thêm module mới

Khi thêm một module mới:

1. Kiểm tra bảng và cột trong `database/schema.sql`.
2. Tạo hoặc mở rộng controller trong `src/controllers/`.
3. Chỉ nhận field nằm trong allowlist.
4. Dùng parameterized SQL.
5. Thêm transaction nếu nghiệp vụ có nhiều bước phụ thuộc nhau.
6. Tạo route trong `src/routes/`.
7. Gắn `requireAuth` và `requireRole` phù hợp.
8. Kiểm tra ownership trong controller, không chỉ kiểm tra role.
9. Gắn router vào `src/app.js` nếu là router mới.
10. Cập nhật `README.md` và tài liệu này.
11. Chạy `npm run check` và `npm run db:check`.

## 17. Những file không nên chỉnh tùy tiện

- Không sửa tên bảng/cột trong code khác với `schema.sql`.
- Không chạy lại `schema.sql` trên database có dữ liệu thật vì file chứa `DROP`.
- Không commit `.env`.
- Không đưa `password_hash`, `refresh_token_hash` hoặc secret vào response.
- Không bỏ kiểm tra conflict trong timetable.
- Không thay parameterized SQL bằng nối chuỗi từ request.
- Không bỏ transaction ở enrollment, schedule, attendance hoặc payment nếu chưa đánh giá tính toàn vẹn dữ liệu.
