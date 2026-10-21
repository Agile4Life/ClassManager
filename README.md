<div align="center">

<img src="frontend/public/teacher-logo.png" alt="ClassManager" width="80" />

# ClassManager

**Quản lý trung tâm dạy thêm · Kết nối lớp học, giáo viên và phụ huynh**

Quản lý học sinh, lịch học, điểm danh và quá trình học tập trong một ứng dụng web.

![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-333333?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-7952B3?logo=bootstrap&logoColor=white)

[Giao diện](#giao-diện-ứng-dụng) · [Frontend](#frontend) · [Backend](#backend) · [Cài đặt](#cài-đặt-và-chạy-local) · [Tài liệu](#tài-liệu-chuyên-sâu)

</div>

![Tổng quan ClassManager với menu, bảng màu và thống kê](docs/screenshots/dashboard.png)

## Giới thiệu

ClassManager hỗ trợ vận hành trung tâm dạy thêm với năm vai trò: **quản trị viên, nhân viên, giáo viên, học sinh và phụ huynh**. Frontend React hiển thị các màn hình nghiệp vụ; backend Express cung cấp REST API và xử lý dữ liệu PostgreSQL.

- **Học sinh:** quản lý hồ sơ, tìm kiếm, nhập CSV và gán lớp hàng loạt.
- **Lớp học:** quản lý lớp, danh sách học sinh, phòng học và phân công nhiều giáo viên.
- **Thời khóa biểu:** thiết lập tuần mẫu, xem lịch lặp theo tuần và tạo buổi học phục vụ điểm danh.
- **Điểm danh:** ghi nhận có mặt/vắng mặt theo buổi, tra cứu lịch sử chuyên cần.
- **Quá trình học tập:** lưu sự kiện học tập, lọc theo lớp và học sinh.
- **Thông báo phụ huynh:** soạn từ mẫu, chọn học sinh, sao chép hoặc in nội dung.
- **Quản trị:** quản lý phòng, giáo viên, tài khoản và hồ sơ cá nhân; đăng nhập bằng mật khẩu hoặc Google.

Backend còn có API bài tập, câu hỏi, bài nộp, báo cáo, hóa đơn và thanh toán. Trong router frontend hiện tại, `/finance` chuyển về tổng quan và `/reports` chuyển sang quá trình học tập; các nhóm API này được mô tả riêng ở phần backend.

## Giao diện ứng dụng

Ảnh chụp từ giao diện React chạy trên trình duyệt ở kích thước **1440 × 1080**, dùng dữ liệu minh họa giả lập tại lớp gọi API. Thông tin trong ảnh phục vụ giới thiệu giao diện; ảnh không xác nhận kết nối database hay đăng nhập Google đã hoạt động.

### Đăng nhập

Đăng nhập tài khoản, ghi nhớ tên đăng nhập, đăng ký phụ huynh và lựa chọn đăng nhập Google.

![Màn hình đăng nhập bằng tài khoản và Google](docs/screenshots/login.png)

### Quản lý học sinh

Danh sách học sinh kèm trạng thái, lớp và thông tin liên hệ; hỗ trợ tìm kiếm, nhập CSV và thao tác theo nhóm.

![Quản lý học sinh, tìm kiếm và nhập danh sách](docs/screenshots/students.png)

### Quản lý lớp học

Theo dõi môn học, giáo viên phụ trách, phòng học, thời gian hoạt động và trạng thái lớp.

![Danh sách lớp cùng môn học, giáo viên và trạng thái](docs/screenshots/classes.png)

### Thời khóa biểu

Tuần mẫu trình bày giờ học, lớp, giáo viên và phòng học theo từng ngày.

![Thời khóa biểu tuần mẫu](docs/screenshots/timetable.png)

### Điểm danh

Chọn lớp và buổi học, đánh dấu có mặt/vắng mặt, xem tổng số trước khi lưu.

![Điểm danh học sinh và tổng hợp chuyên cần](docs/screenshots/attendance.png)

## Công nghệ sử dụng

| Thành phần | Công nghệ trong mã nguồn | Vai trò |
| --- | --- | --- |
| Giao diện | React 19, React DOM 19 | SPA và màn hình nghiệp vụ |
| Điều hướng | React Router DOM 7 | Route, layout và bảo vệ trang đăng nhập |
| Công cụ frontend | Vite 8, plugin React 6 | Dev server và build |
| UI | Bootstrap 5.3, Bootstrap Icons, CSS tùy chỉnh | Component, biểu tượng và responsive |
| Máy chủ | Node.js, Express 4 | REST API và phục vụ frontend sau build |
| Database | PostgreSQL, thư viện `pg` | SQL, connection pool và transaction |
| Xác thực | `jsonwebtoken`, `google-auth-library`, `pgcrypto` | JWT, xác minh Google và băm mật khẩu |
| Middleware | `cors`, `compression`, `dotenv` | Origin, nén phản hồi và cấu hình |
| Triển khai | Vercel, PostgreSQL/Supabase | Serverless API và dữ liệu |

## Cấu trúc dự án

```text
ClassManager/
├── api/index.js              # Entry point Express cho Vercel
├── backend/
│   ├── app.js                # Express, middleware và mount API
│   ├── server.js             # Kiểm tra DB và chạy server local
│   ├── config/               # Connection pool, cấu hình Google
│   ├── routes/               # URL, HTTP method và quyền truy cập
│   ├── middlewares/          # JWT, vai trò, xử lý lỗi
│   ├── controllers/          # Nghiệp vụ và truy vấn dữ liệu
│   └── utils/                # SQL helper, validation, import, mã định danh
├── frontend/
│   ├── public/               # Tài nguyên tĩnh và logo
│   ├── vite.config.js        # Proxy /api và output build
│   └── src/
│       ├── main.jsx          # React và các provider
│       ├── App.jsx           # Router, lazy loading, error boundary
│       ├── api/              # Fetch client, cache, lỗi mạng
│       ├── auth/             # AuthContext, ProtectedRoute
│       ├── components/       # UI dùng chung
│       ├── hooks/            # Hook tải dữ liệu
│       ├── layout/           # AppShell, navigation theo vai trò
│       ├── pages/            # Màn hình nghiệp vụ
│       ├── theme/            # ThemeProvider và bảng màu
│       ├── utils/            # Định dạng, CSV, mẫu thông báo
│       └── styles.css        # Style và responsive
├── database/
│   ├── schema.sql            # Cấu trúc PostgreSQL
│   ├── seed.sql              # Dữ liệu và tài khoản mẫu
│   ├── migrations/           # Cập nhật cấu trúc theo phiên bản
│   └── performance_indexes.sql
├── docs/                     # Kiến trúc, bảo mật, triển khai, kiểm thử
│   └── screenshots/          # Ảnh dùng trong README
├── scripts/                  # Kiểm tra cú pháp, hồi quy, DB, k6
├── tests/                    # Kiểm thử tích hợp theo nghiệp vụ
├── public/                   # Output build, được Git bỏ qua
├── .env.example              # Cấu hình backend mẫu
├── package.json              # Dependency backend và lệnh toàn dự án
└── vercel.json               # Rewrite API và SPA
```

## Frontend

### Kiến trúc và quản lý dữ liệu

Frontend là SPA viết bằng JavaScript/JSX. `main.jsx` khởi tạo `BrowserRouter`, `ThemeProvider` và `AuthProvider`. `App.jsx` khai báo route; trang được tải bằng `React.lazy`, hiển thị trạng thái chờ qua `Suspense`. `ErrorBoundary` xử lý lỗi render ở cấp ứng dụng.

`AppShell` cung cấp điều hướng và vùng nội dung. Menu lọc theo vai trò tại `layout/navigation.js`. `ProtectedRoute` đưa người chưa đăng nhập về `/login`; một số trang kiểm tra thêm vai trò tại component. Backend kiểm tra quyền độc lập cho từng request.

| Module | Trách nhiệm |
| --- | --- |
| `auth/AuthContext.jsx` | Đăng nhập/đăng xuất, đăng ký, Google, hoàn thiện hồ sơ; xác minh phiên qua `/auth/me` |
| `api/client.js` | Gọi `fetch`, gắn Bearer token, timeout/hủy request, chuẩn hóa `ApiError` |
| Cache API | Lưu GET 30 giây, dùng chung GET đang chạy; làm mất hiệu lực cache khi ghi dữ liệu |
| `hooks/usePageData.js` | Dữ liệu, trạng thái tải, lỗi và tải lại theo dependency |
| `components/` | Button, form, bảng, dialog, phân trang, badge, trạng thái tải/rỗng/lỗi |
| `theme/ThemeContext.jsx` | Màu theo ngày hoặc lựa chọn lưu trên trình duyệt |
| `utils/` | Ngày/giờ/tiền tệ, đọc CSV, xuất mẫu CSV, xây dựng thông báo |

Token và người dùng được lưu trong `localStorage` bằng khóa `classmanager_token` và `classmanager_user`. Khi mở lại ứng dụng, frontend gọi backend để xác minh phiên.

### Màn hình và đường dẫn

Bảng mô tả menu và giới hạn giao diện chính; quyền đọc/ghi chi tiết do API quyết định.

| Đường dẫn | Màn hình | Vai trò trên menu |
| --- | --- | --- |
| `/login` | Đăng nhập, đăng ký phụ huynh, Google | Công khai |
| `/` | Tổng quan, truy cập nhanh, thống kê, lịch học | Cả 5 vai trò |
| `/rooms` | Phòng học | Quản trị viên |
| `/teachers` | Giáo viên | Quản trị viên |
| `/accounts` | Tài khoản và đặt lại mật khẩu | Quản trị viên |
| `/students` | Học sinh, CSV, gán lớp hàng loạt | Quản trị viên, nhân viên, giáo viên |
| `/classes` | Lớp học | Cả 5 vai trò |
| `/timetable` | Tuần mẫu và lịch lặp | Cả 5 vai trò |
| `/attendance` | Điểm danh theo lớp/buổi | Quản trị viên, giáo viên |
| `/attendance-history` | Lịch sử điểm danh | Quản trị viên, giáo viên |
| `/parent-notifications` | Soạn thông báo, sao chép/in | Quản trị viên, nhân viên, giáo viên |
| `/learning-history` | Sự kiện học tập theo lớp/học sinh | Quản trị viên, giáo viên |
| `/profile` | Hồ sơ cá nhân | Cả 5 vai trò |

Đường dẫn không tồn tại hiển thị trang 404. `/home` chuyển về `/`.

### Chạy và build

Từ thư mục gốc:

```bash
npm run dev:frontend
npm run build:frontend
```

Vite chạy ở cổng `5173`, chuyển `/api` tới `http://localhost:3005`. Build xuất vào **`public/` ở thư mục gốc**, thay vì `frontend/dist/`.

## Backend

### Kiến trúc và vòng đời request

Backend tách tạo ứng dụng (`app.js`) khỏi khởi chạy HTTP (`server.js`), để cùng ứng dụng Express chạy local hoặc qua `api/index.js` trên Vercel.

1. `app.js` áp dụng CORS, nén phản hồi, đọc JSON với giới hạn `1mb`.
2. Router chọn handler và middleware xác thực/phân quyền.
3. `auth.middleware.js` xác minh JWT, tài khoản hoạt động và phiên trong `user_sessions` chưa bị thu hồi/hết hạn.
4. Controller kiểm tra dữ liệu, phạm vi truy cập và xử lý nghiệp vụ.
5. Controller dùng connection pool `pg` để truy vấn PostgreSQL; nghiệp vụ cần nhiều thao tác dùng transaction.
6. Helper trả JSON; lỗi được chuyển tới middleware xử lý lỗi chung.

SQL được gọi trực tiếp từ controller/helper; dự án không dùng ORM. `utils/query.js` tạo truy vấn có tham số và kiểm tra tên bảng/cột. Các helper khác xử lý quyền trên tài nguyên, quan hệ nhiều giáo viên, nhập học sinh, validation và sinh mã tự động.

### Các nhóm REST API

Các đường dẫn dưới đây có tiền tố **`/api`**. Ngoại trừ health check và thao tác xác thực công khai, API yêu cầu Bearer token; quyền thay đổi theo endpoint và vai trò.

| Nhóm | Endpoint tiêu biểu | Chức năng |
| --- | --- | --- |
| Sức khỏe | `GET /health` | Kiểm tra API và truy vấn DB |
| Xác thực | `POST /auth/login`, `/auth/register`, `/auth/google`, `/auth/google/complete-profile` | Đăng nhập, đăng ký, Google |
| Phiên và hồ sơ | `GET/PUT /auth/me`, `POST /auth/logout` | Hồ sơ, thu hồi phiên |
| Khôi phục mật khẩu | `POST /auth/forgot-password`, `/auth/reset-password` | Token đặt lại mật khẩu |
| Tài khoản | `/admin/accounts`, `/admin/accounts/:userId`, `/admin/accounts/:userId/password` | Quản trị tài khoản/mật khẩu |
| Học sinh | `GET/POST /students`, `GET/PUT/DELETE /students/:id` | Hồ sơ, tìm kiếm, phân trang |
| Nhập/gán lớp | `POST /students/import`, `/students/bulk-assign-class` | Nhập danh sách, gán lớp hàng loạt |
| Danh mục | `/teachers`, `/rooms`, `/subjects`, `/parents`, `/classes` | CRUD với quyền theo tài nguyên |
| Ghi danh | `GET /classes/:classId/students`, `POST /classes/:classId/enroll/:studentId` | Danh sách học sinh, ghi danh |
| Quan hệ | `/students/:studentId/parents`, `/students/:studentId/parents/:parentId`, `/enrollments/:id` | Phụ huynh, ghi danh |
| Thời khóa biểu | `/timetable`, `/timetable/class/:classId`, `/timetable/teacher/:teacherId`, `/timetable/student/:studentId`, `/timetable/parent/:parentId`, `/timetable/room/:roomId` | Tra lịch theo đối tượng |
| Lịch/buổi học | `/classes/:classId/schedules`, `/classes/:classId/generate-sessions`, `/classes/:classId/sessions` | Xếp lịch mẫu, tạo buổi học |
| Sửa lịch | `PUT/DELETE /schedules/:scheduleId`, `PUT/DELETE /sessions/:sessionId` | Điều chỉnh lịch/buổi |
| Điểm danh | `GET/POST /sessions/:sessionId/attendance`, `GET /classes/:classId/attendance-history` | Lưu và tra cứu chuyên cần |
| Học tập | `/learning-history`, `/learning-history/events`, `/learning-history/notification-templates` | Nhật ký, mẫu thông báo |
| Bài tập | `/topics`, `/classes/:classId/assignments`, `/assignments/:assignmentId/questions` | Chủ đề, bài tập, câu hỏi |
| Bài nộp | `/assignments/:assignmentId/submissions`, `/students/:studentId/submissions`, `/submissions/:submissionId/answers` | Bài làm, câu trả lời |
| Báo cáo | `/reports/student/:studentId`, `/reports`, `/reports/:reportId` | Báo cáo học tập |
| Tài chính | `/invoices`, `/payments`, `/students/:studentId/invoices`, `/students/:studentId/payments` | Hóa đơn, thanh toán |

Xem đầy đủ HTTP method và quyền tại [`backend/routes/`](backend/routes/), cùng cấu hình CRUD tại [`resources.routes.js`](backend/routes/resources.routes.js).

### Xác thực, phân quyền và phản hồi

- **JWT kết hợp phiên DB:** token chứa định danh người dùng/phiên; server kiểm tra phiên khi gọi API được bảo vệ.
- **RBAC:** middleware kiểm tra `admin`, `staff`, `teacher`, `student`, `parent`; helper/controller kiểm tra thêm phạm vi dữ liệu trong các nghiệp vụ liên quan.
- **Mật khẩu:** `pgcrypto` băm/đối chiếu; Google dùng thư viện xác minh token.
- **Truy vấn:** tham số SQL, pool, timeout và transaction cho nghiệp vụ liên quan.
- **Lỗi:** JSON thống nhất; chi tiết lỗi được giới hạn theo cấu hình môi trường.

Ví dụ phản hồi thành công:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

Thất bại dùng `success: false` và `message`. Danh sách phân trang thường đặt `items`, `pagination` trong `data`.

## Cơ sở dữ liệu

| Nhóm | Bảng chính |
| --- | --- |
| Con người | `students`, `parents`, `student_parents`, `teachers` |
| Tổ chức lớp | `subjects`, `rooms`, `classes`, `class_teachers`, `enrollments` |
| Lịch/chuyên cần | `class_schedules`, `class_schedule_teachers`, `class_sessions`, `attendance` |
| Tài khoản | `user_accounts`, `user_sessions`, `login_logs`, `password_reset_tokens` |
| Học tập | `learning_topics`, `assignments`, `assignment_questions`, `assignment_submissions`, `student_answers`, `progress_reports` |
| Nhật ký/thông báo | `student_learning_events`, `notification_templates` |
| Tài chính | `invoices`, `payments` |

Khóa ngoại liên kết các nhóm; bảng trung gian biểu diễn học sinh–phụ huynh, lớp–giáo viên và lịch–giáo viên. Schema còn có view báo cáo. Xem [`schema.sql`](database/schema.sql), [`migrations/`](database/migrations/) và [`performance_indexes.sql`](database/performance_indexes.sql).

## Cài đặt và chạy local

### 1. Chuẩn bị

- **Node.js 22.12+ hoặc 24.x** cho bộ công cụ hiện tại. Vite 8 yêu cầu Node `^20.19.0 || >=22.12.0`; mức `>=18` trong package gốc là khai báo backend.
- npm đi kèm Node.js.
- PostgreSQL có quyền tạo extension `pgcrypto`, hoặc database Supabase.
- `psql` hoặc trình soạn SQL của dịch vụ database.

### 2. Cài dependency

Chạy từ thư mục dự án:

```bash
npm ci
npm --prefix frontend ci
```

### 3. Cấu hình môi trường

Sao chép file mẫu bằng PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
```

Trên macOS/Linux dùng `cp` thay `Copy-Item`. Cập nhật `.env` gốc:

```dotenv
NODE_ENV=development
PORT=3005
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/classmanager
DATABASE_SSL=false
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_DAYS=7
CORS_ORIGIN=http://localhost:5173
EXPOSE_RESET_TOKEN=false
```

**Đặt `PORT=3005` để khớp proxy Vite.** `.env.example` gốc để `3000`; nếu giữ cổng này, sửa `server.proxy['/api'].target` trong `frontend/vite.config.js` tương ứng.

Với Supabase/PostgreSQL yêu cầu SSL, thay URL theo thông tin được cấp và đặt `DATABASE_SSL=true`. Có thể điều chỉnh `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_STATEMENT_TIMEOUT_MS` theo file mẫu.

Trong `frontend/.env`:

```dotenv
VITE_API_URL=/api
```

Để dùng Google, đặt `GOOGLE_CLIENT_ID` ở backend và `VITE_GOOGLE_CLIENT_ID` ở frontend với cùng client ID; đăng ký origin local/triển khai trong cấu hình OAuth. Thay giá trị mẫu trước khi dùng. Không đưa `.env` chứa thông tin thật lên Git.

### 4. Khởi tạo database

Trên **database mới dành cho dự án**:

1. Chạy [`database/schema.sql`](database/schema.sql) để tạo cấu trúc/extension.
2. Chạy [`database/seed.sql`](database/seed.sql) để thêm dữ liệu và tài khoản mẫu.
3. Đối chiếu migration chưa áp dụng trong [`database/migrations/`](database/migrations/), chạy theo phiên bản khi nâng cấp database cũ.
4. Áp dụng [`database/performance_indexes.sql`](database/performance_indexes.sql) nếu cần bổ sung chỉ mục.

> `schema.sql` có lệnh `DROP` xóa bảng/view cùng tên. Chỉ dùng cho database mới hoặc khi chủ động tạo lại dữ liệu. `seed.sql` giả định database vừa được tạo; chạy lặp có thể trùng dữ liệu.

### 5. Khởi chạy

Terminal thứ nhất — backend:

```bash
npm run dev
```

Terminal thứ hai — frontend, cũng từ thư mục gốc:

```bash
npm run dev:frontend
```

| Dịch vụ | Địa chỉ |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3005/api |
| Kiểm tra API/DB | http://localhost:3005/api/health |

Backend kiểm tra kết nối DB trước khi mở cổng. Nếu không khởi động, kiểm tra kết nối, SSL và quyền truy cập DB. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` với cùng tham số.

### Tài khoản dữ liệu mẫu

Tài khoản được tạo bởi `database/seed.sql`:

| Vai trò | Tên đăng nhập | Mật khẩu |
| --- | --- | --- |
| Quản trị viên | `admin` | `Admin@123` |
| Nhân viên | `staff01` | `Staff@123` |
| Giáo viên | `teacher01` | `Teacher@123` |
| Phụ huynh | `parent01` | `Parent@123` |
| Học sinh | `student01` | `Student@123` |

Đây là tài khoản phát triển/kiểm thử; đổi mật khẩu hoặc loại bỏ trước khi sử dụng thực tế.

## Kiểm tra và build

| Lệnh từ thư mục gốc | Mục đích | Cần database |
| --- | --- | --- |
| `npm run check` | Kiểm tra cú pháp JavaScript theo script dự án | Không |
| `npm test` | Hồi quy helper và quy tắc nghiệp vụ | Không |
| `npm run db:check` | Kết nối và cấu trúc DB | Có |
| `npm run test:all` | Tích hợp API, quyền, nghiệp vụ, cạnh tranh dữ liệu | Có |
| `npm run test:k6:race` | Kiểm thử cạnh tranh bằng k6 | Có; cần k6 |
| `npm run test:k6:login` | Kiểm thử tải đăng nhập bằng k6 | Có; cần k6 |
| `npm run build:frontend` | Build frontend vào `public/` | Không |
| `npm run build` | Cài dependency frontend rồi build | Không |
| `npm start` | Chạy backend, phục vụ frontend nếu đã build | Có |

Kiểm thử tích hợp tạo/sửa/xóa dữ liệu và chuẩn bị cấu trúc DB; dùng database kiểm thử riêng. Xem [`hướng dẫn kiểm thử`](docs/testing/TEST_SUITES_GUIDE.md).

## Triển khai

`vercel.json` đặt output tại `public/`, chuyển `/api/*` vào `api/index.js` và đường dẫn giao diện vào `index.html` để React Router xử lý. Build bằng `npm run build`; cấu hình biến backend và `VITE_*` cần thiết trên môi trường triển khai. Biến frontend được đọc lúc build.

Frontend/API chung domain có thể giữ `VITE_API_URL=/api`. Database phải truy cập được từ môi trường triển khai; cấu hình SSL, pool và origin phù hợp. Xem [`hướng dẫn triển khai`](docs/deployment/DEPLOYMENT_GUIDE.md).

## Tài liệu chuyên sâu

| Tài liệu | Nội dung |
| --- | --- |
| [Mục lục](docs/README.md) | Các nhóm tài liệu |
| [Kiến trúc hệ thống](docs/architecture/SYSTEM_ARCHITECTURE.md) | Thành phần và luồng xử lý |
| [Cấu trúc mã nguồn](docs/architecture/CODE_STRUCTURE.md) | Module frontend/backend |
| [Đặc tả backend](docs/architecture/BACKEND_SPECIFICATIONS.md) | Nghiệp vụ API |
| [Bảo mật/RBAC](docs/security/SECURITY_AND_RBAC.md) | Xác thực, quyền, phạm vi truy cập |
| [Database](docs/database/DATABASE_DESIGN.md) | Dữ liệu và quan hệ |
| [Hiệu năng](docs/performance/PERFORMANCE_OPTIMIZATION.md) | Truy vấn, chỉ mục, tải dữ liệu |
| [Kiểm thử](docs/testing/TEST_SUITES_GUIDE.md) | Tổ chức và chạy kiểm thử |
| [Triển khai](docs/deployment/DEPLOYMENT_GUIDE.md) | Môi trường và hosting |
| [Hỏi đáp bảo vệ đồ án](docs/defense/DEFENSE_QA_GUIDE.md) | Trình bày và giải thích kỹ thuật |

Mô tả FE/BE trong README được đối chiếu với mã nguồn hiện tại. Khi thay đổi route, dependency hoặc cổng chạy, hãy cập nhật bảng và ảnh tương ứng.
