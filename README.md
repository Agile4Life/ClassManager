# ClassManager - Hệ Thống Quản Lý Trung Tâm Dạy Thêm Toàn Diện

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/)

Hệ thống quản lý trung tâm giáo dục & dạy thêm **ClassManager** được xây dựng theo mô hình Fullstack Client-Server hiện đại, hỗ trợ toàn bộ quy trình vận hành: Quản lý học vụ, Phân công giảng dạy, Thời khóa biểu, Điểm danh, Bài tập & Bảng điểm, Quản lý tài chính - học phí và Cổng thông tin tương tác dành cho Phụ huynh.

---

## 1. Cấu Trúc Thư Mục Dự Án (Project Structure)

Mã nguồn được phân tách rõ ràng theo các tầng nghiệp vụ và tiêu chuẩn công nghệ phần mềm:

```text
ClassManager/
├── .env.example                # Mẫu biến môi trường an toàn cho hệ thống
├── .env.vercel                 # Mẫu cấu hình Production cho Vercel
├── .gitignore                  # Cấu hình bỏ qua các file nhạy cảm và build artifacts
├── package.json                # Dependencies backend, scripts kiểm tra và build
├── vercel.json                 # Cấu hình Vercel Serverless Function & SPA Rewrite
├── README.md                   # Tài liệu giới thiệu và hướng dẫn tổng thể dự án
│
├── api/                        # Serverless Entry Point cho Vercel
│   └── index.js                # Chuyển tiếp HTTP request vào Express application
│
├── docs/                       # HỆ THỐNG TÀI LIỆU KỸ THUẬT TOÀN DIỆN
│   ├── README.md               # Mục lục và bản đồ tài liệu kỹ thuật
│   ├── architecture/           # Kiến trúc hệ thống & đặc tả cấu trúc mã nguồn
│   │   ├── SYSTEM_ARCHITECTURE.md
│   │   ├── CODE_STRUCTURE.md
│   │   └── BACKEND_SPECIFICATIONS.md
│   ├── security/               # Cơ chế an toàn thông tin & phân quyền RBAC 5 vai trò
│   │   └── SECURITY_AND_RBAC.md
│   ├── database/               # Thiết kế CSDL, chuẩn hóa 3NF và chiến lược Index
│   │   └── DATABASE_DESIGN.md
│   ├── performance/            # Kỹ thuật tối ưu hóa hiệu năng Database & Frontend
│   │   └── PERFORMANCE_OPTIMIZATION.md
│   ├── deployment/             # Hướng dẫn triển khai Vercel & Supabase Pooler
│   │   └── DEPLOYMENT_GUIDE.md
│   ├── ui-ux/                  # Bản vẽ thiết kế giao diện & Design tokens
│   │   └── UI_REDESIGN_BLUEPRINT.md
│   └── defense/                # CẨM NANG ĐỐI CHẤT & VẤN ĐÁP BẢO VỆ ĐỒ ÁN VỚI THẦY CÔ
│       └── DEFENSE_QA_GUIDE.md # 15+ câu hỏi hóc búa & câu trả lời chuẩn lý thuyết
│
├── database/                   # TẦNG CƠ SỞ DỮ LIỆU (POSTGRESQL / SUPABASE)
│   ├── README_DATABASE.md      # Đặc tả chi tiết 31 bảng dữ liệu
│   ├── schema.sql              # Script khởi tạo bảng, quan hệ, khóa ngoại, views
│   ├── seed.sql                # Dữ liệu mẫu hoàn chỉnh phục vụ kiểm thử
│   ├── performance_indexes.sql # Các chỉ mục (indexes) tối ưu truy vấn
│   └── migrations/             # Các phiên bản migration cập nhật schema
│
├── backend/                    # TẦNG BACKEND API (EXPRESS.JS / NODE.JS - 5 LAYERS)
│   ├── README.md               # Đặc tả chi tiết 5 tầng kiến trúc Backend
│   ├── app.js                  # Khởi tạo Express, cấu hình CORS, gzip, routes
│   ├── server.js               # Khởi chạy HTTP Server trên môi trường Local
│   ├── config/                 # Cấu hình CSDL & Connection Pool
│   ├── routes/                 # Khai báo endpoint URL và gắn role middleware
│   ├── middlewares/            # Xác thực JWT, phân quyền RBAC, xử lý lỗi toàn cục
│   ├── controllers/            # Logic nghiệp vụ, kiểm tra dữ liệu, điều phối SQL
│   └── utils/                  # Helper: Query builder an toàn, JWT, mã hóa, CORS
│
├── frontend/                   # TẦNG GIAO DIỆN CLIENT (REACT 18 + VITE SPA - 8 LAYERS)
│   ├── README.md               # Đặc tả chi tiết 8 tầng kiến trúc Frontend
│   ├── index.html              # HTML Entry point của ứng dụng
│   ├── vite.config.js          # Cấu hình build Vite và proxy /api trong dev
│   └── src/
│       ├── api/                # HTTP Client (Fetch wrapper, cache, in-flight dedup)
│       ├── auth/               # AuthContext, bảo vệ route phân quyền
│       ├── components/         # Các UI component tái sử dụng (Fluent UI)
│       ├── layout/             # Shell ứng dụng, sidebar, topbar điều hướng
│       ├── pages/              # 11 màn hình nghiệp vụ (Dashboard, Classes, ...)
│       ├── hooks/              # Custom React hooks quản lý dữ liệu
│       ├── styles.css          # Design tokens, theme và layout responsive
│       └── App.jsx             # Cấu hình React Router và Lazy Loading
│
└── scripts/                    # CÔNG CỤ TỰ ĐỘNG HÓA & KIỂM TRA CHẤT LƯỢNG
    ├── check-syntax.js         # Kiểm tra cú pháp toàn bộ file JavaScript
    ├── check-regressions.js    # Kiểm tra hồi quy các logic nghiệp vụ trọng yếu
    ├── check-database.js       # Kiểm tra kết nối CSDL và các bảng bắt buộc
    └── database/               # Công cụ bảo trì và kiểm tra cột CSDL
```

---

## 2. Công Nghệ & Lý Do Lựa Chọn (Tech Stack & Rationale)

| Tầng | Công Nghệ | Lý Do Lựa Chọn |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | Tốc độ build siêu nhanh, hỗ trợ Code Splitting (Lazy Loading), tối ưu trải nghiệm người dùng với Single Page Application. |
| **Backend API** | Node.js + Express.js | Nhẹ, phi chặn (non-blocking I/O), khởi động nhanh, thích hợp hoàn hảo với kiến trúc Serverless Function. |
| **Database** | PostgreSQL 15+ (Supabase) | Cơ sở dữ liệu quan hệ mạnh mẽ, hỗ trợ transaction ACID toàn vẹn, ràng buộc khóa ngoại chặt chẽ. |
| **Connection** | PgBouncer (Transaction Pooler) | Cho phép hàng ngàn Serverless Function cùng truy cập CSDL mà không bị cạn kiệt connection limit. |
| **Xác thực** | JWT + Google OAuth 2.0 | Xác thực không lưu trạng thái (stateless) kết hợp phiên làm việc trên CSDL, hỗ trợ đăng nhập 1 chạm an toàn. |
| **Deploy** | Vercel Serverless | Triển khai Same-Origin (cả FE và BE cùng domain), tự động mở rộng theo tải, miễn phí SSL và CDN toàn cầu. |

---

## 3. Hướng Dẫn Cài Đặt & Chạy Thử (Getting Started)

### Yêu Cầu Môi Trường
- **Node.js**: Phiên bản 18 trở lên.
- **PostgreSQL**: Tài khoản Supabase hoặc PostgreSQL local.

### Bước 1: Khởi Tạo Cơ Sở Dữ Liệu
1. Chạy file [database/schema.sql](file:///d:/ClassManagement/ClassManager/database/schema.sql) để tạo 31 bảng và các ràng buộc toàn vẹn.
2. Chạy file [database/seed.sql](file:///d:/ClassManagement/ClassManager/database/seed.sql) để nạp dữ liệu mẫu và các tài khoản thử nghiệm.
3. Chạy các file trong [database/migrations/](file:///d:/ClassManagement/ClassManager/database/migrations/) nếu có cập nhật mới nhất.

### Bước 2: Cấu Hình Biến Môi Trường
Sao chép file `.env.example` thành `.env` tại thư mục gốc và điền thông số kết nối:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:PASSWORD@YOUR_SUPABASE_HOST:6543/postgres?sslmode=require
DATABASE_SSL=true
JWT_SECRET=your_super_secret_jwt_key_here
```

### Bước 3: Cài Đặt & Chạy Local
Mở 2 cửa sổ terminal:

**Terminal 1 (Backend API):**
```bash
npm install
npm run dev
```
*Backend khởi chạy tại: `http://localhost:3000` (Kiểm tra sức khỏe hệ thống: `GET http://localhost:3000/api/health`).*

**Terminal 2 (Frontend Client):**
```bash
cd frontend
npm install
npm run dev
```
*Giao diện mở tại: `http://localhost:5173`.*

### Tài Khoản Kiểm Thử Mặc Định:
- **Quản trị viên (Admin)**: `admin` / `Admin@123`
- **Giáo viên (Teacher)**: `teacher1` / `Teacher@123`
- **Phụ huynh (Parent)**: `parent1` / `Parent@123`
- **Học sinh (Student)**: `student1` / `Student@123`

---

## 4. Kiểm Tra Tự Động & Đảm Bảo Chất Lượng (Quality Assurance)

Dự án tích hợp sẵn các bộ kiểm tra tự động để đảm bảo tính toàn vẹn của mã nguồn:

```bash
# 1. Kiểm tra cú pháp toàn bộ mã nguồn JavaScript
node scripts/check-syntax.js

# 2. Chạy kiểm tra hồi quy các logic nghiệp vụ trọng yếu
node scripts/check-regressions.js

# 3. Kiểm tra kết nối CSDL và tính sẵn sàng của các bảng
node scripts/check-database.js
```

---

## 5. Tài Liệu Hướng Dẫn Chi Tiết & Bảo Vệ Đồ Án

Mọi tài liệu chuyên sâu được lưu trữ tại thư mục [docs/](file:///d:/ClassManagement/ClassManager/docs/):
- **[Cẩm Nang Đối Chất Với Thầy Cô](file:///d:/ClassManagement/ClassManager/docs/defense/DEFENSE_QA_GUIDE.md)**: 15+ câu hỏi chuyên sâu về kiến trúc, bảo mật, xử lý tranh chấp dữ liệu và câu trả lời chuẩn mực để bảo vệ đồ án đạt điểm cao nhất.
- **[Kiến Trúc Hệ Thống](file:///d:/ClassManagement/ClassManager/docs/architecture/SYSTEM_ARCHITECTURE.md)**: Sơ đồ phân tầng và vòng đời Request.
- **[Bảo Mật & Phân Quyền](file:///d:/ClassManagement/ClassManager/docs/security/SECURITY_AND_RBAC.md)**: RBAC 5 vai trò, JWT, phòng chống SQL Injection.
- **[Thiết Kế CSDL](file:///d:/ClassManagement/ClassManager/docs/database/DATABASE_DESIGN.md)**: Thiết kế chuẩn hóa 3NF và Soft Delete.
- **[Hướng Dẫn Triển Khai Vercel](file:///d:/ClassManagement/ClassManager/docs/deployment/DEPLOYMENT_GUIDE.md)**: Hướng dẫn cấu hình Serverless Production.
