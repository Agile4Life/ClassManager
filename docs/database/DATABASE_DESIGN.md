# Thiết Kế Cơ Sở Dữ Liệu (Database Architecture & Design) - ClassManager

Tài liệu này tóm tắt mô hình thực thể quan hệ (ERD), nguyên tắc chuẩn hóa và các quyết định kỹ thuật liên quan đến tầng lưu trữ dữ liệu của **ClassManager**.

Tài liệu chi tiết toàn bộ các bảng và trường dữ liệu xem tại: [database/README_DATABASE.md](file:///d:/ClassManagement/ClassManager/database/README_DATABASE.md).

---

## 1. Tổng Quan Mô Hình Thực Thể

Cơ sở dữ liệu được xây dựng trên nền tảng **PostgreSQL 15+** (Supabase), bao gồm 31 bảng quan hệ được chuẩn hóa theo dạng chuẩn 3NF (Third Normal Form) nhằm loại bỏ dư thừa dữ liệu và đảm bảo toàn vẹn tham chiếu.

### Các Phân Hệ Dữ Liệu Chính:

1. **Hệ thống Người dùng & Tài khoản**:
   - `user_accounts`: Lưu trữ tài khoản đăng nhập, hash mật khẩu, vai trò (`admin`, `staff`, `teacher`, `student`, `parent`), trạng thái và Google OAuth subject ID.
   - `user_sessions`: Lưu trữ phiên đăng nhập, refresh token, IP và User Agent.
   - `password_reset_tokens`: Lưu trữ hash token phục vụ quên/đặt lại mật khẩu an toàn.
2. **Hệ thống Thực thể Học vụ (Core Entities)**:
   - `teachers`: Thông tin giáo viên, chuyên môn, lương cơ bản, trạng thái xóa mềm.
   - `students`: Hồ sơ học sinh, ngày sinh, khối lớp, trường học, tình trạng hoạt động.
   - `parents`: Hồ sơ phụ huynh, nghề nghiệp, địa chỉ, liên hệ.
   - `student_parents`: Bảng quan hệ N-N giữa học sinh và phụ huynh (ghi nhận vai trò quan hệ như cha, mẹ, người giám hộ).
   - `subjects`: Danh mục môn học và học phí đề xuất.
   - `rooms`: Quản lý phòng học và sức chứa tối đa.
3. **Hệ thống Lớp học & Thời khóa biểu**:
   - `classes`: Lớp học, sĩ số tối đa, trạng thái (`active`, `completed`, `cancelled`).
   - `class_teachers`: Quan hệ N-N giữa lớp học và giáo viên phụ trách.
   - `schedules`: Lịch học hàng tuần (thứ trong tuần, giờ bắt đầu, giờ kết thúc, phòng học).
   - `enrollments`: Học sinh đăng ký tham gia lớp học và trạng thái học.
4. **Hệ thống Buổi học, Điểm danh & Học tập**:
   - `sessions`: Buổi học thực tế được sinh ra từ lịch trình hoặc tạo bổ sung.
   - `attendance`: Ghi nhận điểm danh từng học sinh trong buổi học (`present`, `absent`, `late`, `excused`) kèm ghi chú.
   - `topics`: Chủ đề bài học theo chương trình.
   - `assignments`: Bài tập về nhà, thời hạn nộp, điểm tối đa.
   - `submissions`: Bài làm của học sinh, thời điểm nộp, điểm số, nhận xét của giáo viên.
   - `learning_reports`: Đánh giá định kỳ quá trình học tập của học sinh gửi cho phụ huynh.
5. **Hệ thống Tài chính & Học phí**:
   - `invoices`: Hóa đơn học phí theo kỳ của học sinh, tổng tiền, hạn nộp, trạng thái (`unpaid`, `partially_paid`, `paid`, `overdue`).
   - `payments`: Lịch sử các đợt thanh toán học phí (tiền mặt, chuyển khoản ngân hàng) gắn liền với hóa đơn.

---

## 2. Toàn Vẹn Tham Chiếu & Ràng Buộc Dữ Liệu (Constraints & Foreign Keys)

- **Primary Keys**: Mỗi bảng đều có khóa chính đơn (`SERIAL` hoặc `UUID`).
- **Foreign Keys**: Sử dụng khóa ngoại ràng buộc nghiêm ngặt:
  - `ON DELETE RESTRICT`: Đối với các thực thể cốt lõi (không cho phép xóa giáo viên hoặc môn học nếu đang có lớp học tham chiếu).
  - `ON DELETE CASCADE`: Chỉ áp dụng cho các dữ liệu phụ thuộc hoàn toàn vào cha (ví dụ: xóa buổi học thì xóa các bản ghi điểm danh tương ứng của buổi đó).
- **Ràng buộc kiểm tra (CHECK Constraints)**:
  - Kiểm tra vai trò hợp lệ: `role IN ('admin', 'staff', 'teacher', 'student', 'parent')`.
  - Kiểm tra trạng thái điểm danh: `status IN ('present', 'absent', 'late', 'excused')`.
  - Kiểm tra số tiền học phí và điểm số không được âm: `amount >= 0`, `score >= 0`.

---

## 3. Chiến Lược Xóa Mềm (Soft Delete Pattern)

Các bảng quan trọng (`students`, `teachers`, `classes`) sử dụng cột cờ `is_deleted BOOLEAN NOT NULL DEFAULT FALSE` thay vì xóa vật lý (`DELETE FROM table`):
- **Lợi ích**:
  - Không bao giờ làm mất lịch sử học tập, bảng điểm hay dữ liệu kế toán tài chính trong quá khứ.
  - Phục hồi dữ liệu tức thời khi có thao tác nhầm lẫn.
  - Các truy vấn tìm kiếm nghiệp vụ đều tự động bổ sung điều kiện `WHERE is_deleted = false`.

---

## 4. Tối Ưu Hóa & Đánh Chỉ Mục (Indexes & Performance)

Ngoài các B-tree index mặc định trên khóa chính và khóa ngoại, hệ thống áp dụng các index bổ sung tại [database/performance_indexes.sql](file:///d:/ClassManagement/ClassManager/database/performance_indexes.sql):
- **Index hỗ trợ lọc**:
  - `idx_sessions_class_date`: Tối ưu hóa truy vấn xem lịch học và điểm danh theo khoảng ngày.
  - `idx_enrollments_student_class`: Tối ưu kiểm tra học sinh đã vào lớp hay chưa.
  - `idx_invoices_status_due_date`: Tối ưu trang thống kê công nợ và hóa đơn quá hạn.
- **Partial Indexes**:
  - `idx_user_accounts_google_sub`: Chỉ đánh index trên các dòng có `google_sub IS NOT NULL`, giảm thiểu 80% dung lượng index trên đĩa.
