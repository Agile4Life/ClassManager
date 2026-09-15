# Frontend Architecture - ClassManager Client

Thư mục `frontend/` chứa toàn bộ mã nguồn giao diện người dùng (Client-side) của hệ thống ClassManager. Được xây dựng trên nền tảng **React 18 + Vite** theo kiến trúc **Single Page Application (SPA)** hiện đại.

---

## 1. Bản Đồ Các Tầng Kiến Trúc Frontend (Frontend Architecture Layers)

```text
frontend/
├── index.html                     # HTML Entry Point
├── vite.config.js                 # Cấu hình Vite build & Dev Server API Proxy
├── package.json                   # Dependencies Frontend (React, Fluent UI icons, Router)
│
└── src/
    ├── main.jsx                   # Entry point React, nạp theme và AuthProvider
    ├── App.jsx                    # TẦNG ROUTING: Code Splitting (React.lazy) & Suspense
    ├── styles.css                 # TẦNG GIAO DIỆN NỀN TẢNG: CSS Design Tokens & Layout
    │
    ├── 1. api/                    # TẦNG GIAO TIẾP MẠNG (Network & API Client Layer)
    │   └── client.js              # Fetch client tích hợp In-Flight Deduplication & 30s Cache
    │
    ├── 2. auth/                   # TẦNG QUẢN LÝ PHIÊN & TRẠNG THÁI (State & Auth Layer)
    │   ├── AuthContext.jsx        # Context lưu trữ user, token, hàm login/logout/Google OAuth
    │   └── ProtectedRoute.jsx     # Kiểm tra quyền truy cập route ở cấp giao diện
    │
    ├── 3. hooks/                  # TẦNG DATA HOOKS (Custom React Hooks)
    │   ├── useApiData.js          # Hook tải dữ liệu bất đồng bộ kèm trạng thái loading/error
    │   └── usePageData.js         # Hook nạp dữ liệu phân trang
    │
    ├── 4. components/             # TẦNG THÀNH PHẦN GIAO DIỆN DÙNG CHUNG (UI Components Layer)
    │   ├── bootstrap-icons.jsx    # Bộ icon tối ưu hóa
    │   └── bootstrap-ui.jsx       # Button, Input, Field, Table, Modal, Card tái sử dụng
    │
    ├── 5. layout/                 # TẦNG KHUNG VỎ ỨNG DỤNG (Layout Shell Layer)
    │   ├── AppLayout.jsx          # Khung trang chính (gồm Sidebar + Content Area)
    │   ├── AppSidebar.jsx         # Thanh menu điều hướng theo vai trò (Role-based Navigation)
    │   └── MobileTopbar.jsx       # Thanh tiêu đề và nút mở menu trên thiết bị di động
    │
    ├── 6. pages/                  # TẦNG MÀN HÌNH NGHIỆP VỤ (View / Pages Layer)
    │   ├── DashboardPage.jsx      # Tổng quan thống kê trung tâm
    │   ├── ClassesPage.jsx        # Quản lý danh sách lớp, sĩ số, lịch học
    │   ├── StudentsPage.jsx       # Hồ sơ học sinh, tìm kiếm, nhập Excel
    │   ├── TeachersPage.jsx       # Danh sách giáo viên, phân công môn dạy
    │   ├── TimetablePage.jsx      # Thời khóa biểu tuần trực quan
    │   ├── AttendancePage.jsx     # Điểm danh buổi học thời gian thực
    │   ├── AttendanceHistoryPage.jsx # Lịch sử điểm danh và tỷ lệ chuyên cần
    │   ├── LearningHistoryPage.jsx# Sổ theo dõi học tập của học sinh
    │   ├── FinancePage.jsx        # Quản lý hóa đơn và thanh toán học phí
    │   ├── AccountsPage.jsx       # Quản trị tài khoản và phân quyền người dùng
    │   ├── RoomsPage.jsx          # Quản lý phòng học và cơ sở vật chất
    │   ├── ParentNotificationPage.jsx # Cổng thông tin thông báo cho phụ huynh
    │   ├── ProfilePage.jsx        # Cập nhật hồ sơ cá nhân và đổi mật khẩu
    │   ├── LoginPage.jsx          # Đăng nhập hệ thống, đăng ký phụ huynh & Google One Tap
    │   └── NotFoundPage.jsx       # Trang thông báo lỗi 404
    │
    ├── 7. theme/                  # TẦNG THIẾT KẾ & BẢNG MÀU (Design Tokens Layer)
    │   └── tokens.js              # Định nghĩa biến màu sắc, typography chuẩn
    │
    └── 8. utils/                  # TẦNG TIỆN ÍCH HIỂN THỊ (Format Helpers Layer)
        └── format.js              # Định dạng tiền tệ VND, ngày tháng tiếng Việt
```

---

## 2. Kỹ Thuật Tối Ưu Hóa Giao Diện (Performance Highlights)

1. **Route-level Code Splitting**:
   - Mọi trang trong `pages/` đều được nạp thông qua `React.lazy()` trong [src/App.jsx](file:///d:/ClassManagement/ClassManager/frontend/src/App.jsx). Người dùng vào trang nào chỉ tải đúng mã nguồn của trang đó.
2. **Request Deduplication & 30s Caching**:
   - Khi có nhiều component cùng gọi một API `GET` tại một thời điểm, [src/api/client.js](file:///d:/ClassManagement/ClassManager/frontend/src/api/client.js) chỉ thực hiện 1 request HTTP duy nhất và chia sẻ kết quả, đồng thời lưu cache trong 30 giây để tránh gọi lại API liên tục.
3. **Role-Based UI Rendering**:
   - Menu thanh bên [AppSidebar.jsx](file:///d:/ClassManagement/ClassManager/frontend/src/layout/AppSidebar.jsx) tự động lọc các mục hiển thị dựa trên `user.role` từ `AuthContext`, mang lại trải nghiệm tối giản và bảo mật cho từng nhóm người dùng (Admin, Giáo viên, Học sinh, Phụ huynh).
