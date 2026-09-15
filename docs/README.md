# Tài Liệu Kỹ Thuật Dự Án ClassManager (Project Documentation Index)

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật của hệ thống **ClassManager**. Toàn bộ tài liệu được phân loại theo các tiêu chuẩn công nghệ phần mềm:

---

## Danh Mục Tài Liệu

### 1. Kiến Trúc & Cấu Trúc Mã Nguồn (Architecture)
- [Kiến Trúc Hệ Thống (System Architecture)](file:///d:/ClassManagement/ClassManager/docs/architecture/SYSTEM_ARCHITECTURE.md): Mô hình tổng thể Client-Server, phân tầng Backend (5 layers) và vòng đời của một Request.
- [Chi Tiết Cấu Trúc Mã Nguồn (Code Structure)](file:///d:/ClassManagement/ClassManager/docs/architecture/CODE_STRUCTURE.md): Bản đồ phân tích từng file và module trong Backend và Frontend.
- [Đặc Tả Nghiệp Vụ Backend (Backend Specifications)](file:///d:/ClassManagement/ClassManager/docs/architecture/BACKEND_SPECIFICATIONS.md): Đặc tả chi tiết các luồng nghiệp vụ học vụ, điểm danh, tài chính.

### 2. An Toàn Thông Tin & Phân Quyền (Security)
- [Bảo Mật & Cơ Chế RBAC 5 Vai Trò (Security & RBAC)](file:///d:/ClassManagement/ClassManager/docs/security/SECURITY_AND_RBAC.md): Chi tiết xác thực JWT, cơ chế Database Session, phòng chống tấn công SQL Injection và tích hợp Google OAuth 2.0.

### 3. Cơ Sở Dữ Liệu (Database)
- [Tổng Quan Thiết Kế CSDL (Database Design)](file:///d:/ClassManagement/ClassManager/docs/database/DATABASE_DESIGN.md): Nguyên tắc chuẩn hóa 3NF, ràng buộc toàn vẹn, chiến lược Xóa Mềm (Soft Delete) và hệ thống Index tối ưu.
- [Đặc Tả Chi Tiết Lược Đồ CSDL (Detailed Database Spec)](file:///d:/ClassManagement/ClassManager/database/README_DATABASE.md): Chi tiết cấu trúc từng trường của 31 bảng quan hệ trong PostgreSQL.

### 4. Tối Ưu Hóa & Hiệu Năng (Performance)
- [Tối Ưu Hiệu Năng Toàn Diện (Performance Optimization)](file:///d:/ClassManagement/ClassManager/docs/performance/PERFORMANCE_OPTIMIZATION.md): Kỹ thuật tối ưu truy vấn SQL, Connection Pooler, In-Flight Request Deduplication và Route-level Code Splitting.

### 5. Triển Khai & Vận Hành (Deployment)
- [Hướng Dẫn Triển Khai Vercel & Supabase (Deployment Guide)](file:///d:/ClassManagement/ClassManager/docs/deployment/DEPLOYMENT_GUIDE.md): Hướng dẫn cấu hình môi trường Serverless Function trên Vercel và Transaction Pooler trên Supabase.

### 6. Giao Diện & Trải Nghiệm Người Dùng (UI/UX)
- [Bản Thiết Kế Giao Diện (UI Redesign Blueprint)](file:///d:/ClassManagement/ClassManager/docs/ui-ux/UI_REDESIGN_BLUEPRINT.md): Hệ thống Design Tokens, Responsive Layout và bảng màu Fluent UI.

### 7. Bảo Vệ Đồ Án & Đối Chất Với Thầy Cô (Defense Guide)
- [Cẩm Nang Đối Chất & Vấn Đáp Với Thầy Cô (Defense Q&A Guide)](file:///d:/ClassManagement/ClassManager/docs/defense/DEFENSE_QA_GUIDE.md): Tổng hợp 15+ câu hỏi hóc búa nhất của Hội đồng chấm đồ án (Kiến trúc, Concurrency, Bảo mật, Serverless) kèm câu trả lời mẫu chuẩn chỉ và dẫn chứng mã nguồn.
