# Cẩm Nang Đối Chất & Vấn Đáp Bảo Vệ Đồ Án (Defense Q&A Guide)

> **Dành cho sinh viên bảo vệ đồ án ClassManager trước Thầy/Cô và Hội đồng chuyên môn.**  
> Tài liệu này tổng hợp các câu hỏi hóc búa nhất mà Thầy/Cô thường hỏi khi chấm đồ án phần mềm (Architecture, Database, Security, Concurrency, Performance) kèm câu trả lời chuẩn lý thuyết và dẫn chứng trực tiếp vào mã nguồn.

---

## MỤC LỤC CÂU HỎI

1. [Về Kiến Trúc: Tại sao tổ chức thư mục như thế này? Theo mẫu kiến trúc (Pattern) nào?](#cau-1)
2. [Về Cấu Trúc Dự Án: Tại sao để cả Frontend và Backend trong cùng một Git Repository?](#cau-2)
3. [Về Tầng Dữ Liệu: Tại sao không dùng ORM (Prisma/TypeORM/Sequelize) mà dùng `pg` thuần?](#cau-3)
4. [Về An Toàn Thông Tin: Hệ thống phòng chống tấn công SQL Injection bằng cách nào? Dẫn chứng?](#cau-4)
5. [Về Phân Quyền: Cơ chế RBAC 5 vai trò được hiện thực ở đâu? Làm sao ngăn chặn leo thang đặc quyền (Privilege Escalation)?](#cau-5)
6. [Về Xác Thực: Quá trình xác thực JWT và Session diễn ra như thế nào? Phân biệt Access Token và Refresh Token?](#cau-6)
7. [Về Triển Khai: Tại sao khi deploy lên Vercel Serverless lại phải dùng Supabase Pooler (Port 6543) thay vì kết nối trực tiếp (Port 5432)?](#cau-7)
8. [Về Serverless: Tại sao `DATABASE_POOL_MAX` trên Vercel lại đặt là 1 thay vì 20 hay 50?](#cau-8)
9. [Về Tính Toàn Vẹn: Khi 2 phụ huynh cùng lúc bấm đăng ký suất học cuối cùng (Race Condition / Concurrency), hệ thống xử lý ra sao?](#cau-9)
10. [Về Quản Trị Lỗi: Cơ chế xử lý lỗi tập trung (Centralized Error Handling) hoạt động thế nào?](#cau-10)
11. [Về Bảo Mật Mật Khẩu: Mật khẩu và token quên mật khẩu được lưu trữ và kiểm tra ra sao?](#cau-11)
12. [Về Đăng Nhập Google: Luồng Google OAuth 2.0 hoạt động thế nào giữa Client, Google API và Server?](#cau-12)
13. [Về Tối Ưu Frontend: Những kỹ thuật tối ưu tốc độ tải trang (Web Performance) nào đã được áp dụng?](#cau-13)
14. [Về Thiết Kế CSDL: Tại sao dùng Soft Delete (`is_deleted`) thay vì Hard Delete?](#cau-14)
15. [Về Luồng Dữ Liệu Toàn Cục: Em hãy giải thích chi tiết luồng đi của 1 HTTP Request từ A đến Z?](#cau-15)

---

<a name="cau-1"></a>
### Câu 1: Tại sao em tổ chức thư mục như thế này? Theo mẫu kiến trúc (Pattern) nào?
* **Trả lời ngắn gọn**:
  Hệ thống được tổ chức theo mẫu **Kiến trúc phân tầng (Layered Architecture)** kết hợp nguyên lý phân tách mối quan tâm (**Separation of Concerns - SoC**).
* **Chi tiết kỹ thuật**:
  - `backend/routes/`: Tầng định tuyến (Routing Layer) — chỉ định nghĩa URL, HTTP method và gắn middleware bảo vệ.
  - `backend/middlewares/`: Tầng tiền xử lý (Middleware Layer) — xác thực JWT (`auth.middleware.js`), kiểm tra quyền truy cập (`role.middleware.js`), và bắt lỗi tập trung (`error.middleware.js`).
  - `backend/controllers/`: Tầng điều khiển & nghiệp vụ (Controller/Business Layer) — kiểm tra tính hợp lệ của dữ liệu đầu vào, áp dụng luật nghiệp vụ (ví dụ: sĩ số tối đa, kiểm tra xung đột lịch) và điều phối giao dịch.
  - `backend/config/` & `backend/utils/query.js`: Tầng truy cập dữ liệu (Data Access Layer) — quản lý connection pool và tạo câu lệnh SQL tham số hóa an toàn.
* **Dẫn chứng mã nguồn**:
  Xem [docs/architecture/SYSTEM_ARCHITECTURE.md](file:///d:/ClassManagement/ClassManager/docs/architecture/SYSTEM_ARCHITECTURE.md) và [backend/app.js](file:///d:/ClassManagement/ClassManager/backend/app.js#L150-L166).

---

<a name="cau-2"></a>
### Câu 2: Tại sao để cả Frontend và Backend trong cùng một Git Repository mà không tách làm 2 repo riêng?
* **Trả lời ngắn gọn**:
  Dự án áp dụng mô hình **Monorepo thu nhỏ (Unified Fullstack Repo)** nhằm tối ưu quy trình phát triển, đồng bộ hóa phiên bản và hỗ trợ triển khai **Atomic Deployment** trên Vercel.
* **Chi tiết kỹ thuật**:
  - **Dễ kiểm soát hợp đồng API (API Contract Sync)**: Khi backend thay đổi định dạng dữ liệu trả về, frontend có thể cập nhật và commit trong cùng một Pull Request/Commit, tránh tình trạng lệch phiên bản giữa 2 repo.
  - **Triển khai Same-Origin**: Nhờ file [vercel.json](file:///d:/ClassManagement/ClassManager/vercel.json), toàn bộ frontend build ra thư mục `public/`, còn backend chạy dưới dạng serverless qua `/api/*`. Nhờ cùng chung một domain (`same-origin`), hệ thống giảm thiểu các rủi ro phức tạp về cấu hình CORS và cookie của trình duyệt.

---

<a name="cau-3"></a>
### Câu 3: Tại sao không dùng ORM như Prisma hay Sequelize mà lại dùng thư viện `pg` (node-postgres) thuần?
* **Trả lời ngắn gọn**:
  Sử dụng thư viện `pg` thuần giúp **tối ưu hiệu năng tối đa (Zero ORM Overhead)**, kiểm soát chính xác 100% câu lệnh SQL gửi đến PostgreSQL, và tương thích hoàn hảo với môi trường Serverless.
* **Chi tiết kỹ thuật**:
  - Các ORM như Prisma tạo một query engine nhị phân nặng nề, làm tăng kích thước bundle và gây độ trễ khởi động lạnh (**Cold Start**) đáng kể trên Serverless Function của Vercel.
  - Thư viện `pg` kết hợp với PgBouncer (Supabase Pooler) có tốc độ xử lý nhanh nhất, tiêu tốn ít bộ nhớ RAM nhất.
  - Để tránh việc viết lại code lặp đi lặp lại, nhóm đã tự xây dựng module Query Builder an toàn [backend/utils/query.js](file:///d:/ClassManagement/ClassManager/backend/utils/query.js) (`buildInsert`, `buildUpdate`), vừa giữ được sự tiện lợi vừa đảm bảo hiệu năng gốc của SQL.

---

<a name="cau-4"></a>
### Câu 4: Hệ thống phòng chống tấn công SQL Injection bằng cách nào? Em hãy chỉ ra một ví dụ cụ thể trong code?
* **Trả lời ngắn gọn**:
  Hệ thống áp dụng nguyên tắc **100% Parameterized Queries (Truy vấn tham số hóa)**. Tuyệt đối không bao giờ dùng phép cộng chuỗi hoặc template string để đưa biến của người dùng vào câu lệnh SQL.
* **Chi tiết kỹ thuật**:
  - Trong PostgreSQL, khi dùng tham số hóa `$1, $2, ...`, cơ sở dữ liệu sẽ biên dịch trước cấu trúc câu lệnh (Pre-compilation) rồi mới truyền dữ liệu vào. Dữ liệu đầu vào dù có chứa các ký tự nguy hiểm như `' OR '1'='1' --` hay `DROP TABLE` cũng chỉ được coi là một chuỗi ký tự thuần túy (string literal), không thể làm thay đổi cú pháp của lệnh SQL.
* **Dẫn chứng mã nguồn**:
  Xem [backend/controllers/auth.controller.js](file:///d:/ClassManagement/ClassManager/backend/controllers/auth.controller.js#L100-L110):
  ```javascript
  const sessionResult = await client.query(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING session_id`,
    [user.user_id, tokenHash, ip, userAgent, expiresAt]
  );
  ```

---

<a name="cau-5"></a>
### Câu 5: Cơ chế phân quyền (RBAC) 5 vai trò được hiện thực ở đâu? Nếu học sinh cố tình gọi API của giáo viên thì bị chặn thế nào?
* **Trả lời ngắn gọn**:
  Phân quyền được hiện thực ở 2 cấp độ: **Cấp độ Route (Role Middleware)** và **Cấp độ Dữ liệu (Data Ownership in Controller)**.
* **Chi tiết kỹ thuật**:
  1. **Cấp 1 - Route Level**: Middleware `requireRole('teacher', 'admin')` ([backend/middlewares/role.middleware.js](file:///d:/ClassManagement/ClassManager/backend/middlewares/role.middleware.js)) kiểm tra trường `req.user.role` đã được giải mã từ JWT token. Nếu một `student` gửi request đến API nhập điểm, middleware sẽ chặn ngay lập tức và trả về mã lỗi `403 Forbidden` kèm thông điệp: `"Bạn không có quyền thực hiện hành động này"`. Controller hoàn toàn không bị kích hoạt.
  2. **Cấp 2 - Data Ownership**: Ngay cả khi một `teacher` gọi API, controller vẫn truy vấn bảng `class_teachers` để xác minh xem giáo viên đó có thực sự được phân công dạy lớp học đó hay không. Giáo viên không thể sửa điểm của lớp do giáo viên khác dạy.

---

<a name="cau-6"></a>
### Câu 6: Quá trình xác thực JWT và Session diễn ra như thế nào? Phân biệt Access Token và Refresh Token?
* **Trả lời ngắn gọn**:
  Hệ thống sử dụng cơ chế xác thực kép: **Stateless JWT Access Token** để xác thực nhanh trên từng request, kết hợp với **Stateful Database Session** để có thể chủ động thu hồi quyền đăng nhập khi cần thiết.
* **Chi tiết kỹ thuật**:
  - **Access Token**: Chứa thông tin cơ bản (`user_id`, `role`, `username`), được ký bằng thuật toán HMAC-SHA256 với `JWT_SECRET`. Client gửi token này trong header `Authorization: Bearer <token>` mỗi lần gọi API. Backend xác thực tức thời bằng hàm `jwt.verify()` mà không cần truy vấn CSDL liên tục.
  - **Refresh Token / Session Record**: Được lưu trữ dưới dạng mã băm trong bảng `user_sessions` kèm thời điểm hết hạn, địa chỉ IP và trình duyệt của người dùng. Khi người dùng bấm Đăng xuất, bản ghi session bị xóa/vô hiệu hóa, giúp bảo vệ tài khoản nếu người dùng bị đánh cắp token.
* **Dẫn chứng mã nguồn**:
  Xem [backend/middlewares/auth.middleware.js](file:///d:/ClassManagement/ClassManager/backend/middlewares/auth.middleware.js) và [backend/utils/jwt.js](file:///d:/ClassManagement/ClassManager/backend/utils/jwt.js).

---

<a name="cau-7"></a>
### Câu 7: Tại sao khi deploy lên Vercel Serverless lại phải dùng Supabase Connection Pooler (Port 6543) thay vì kết nối trực tiếp (Port 5432)?
* **Trả lời ngắn gọn**:
  Vì môi trường Serverless tự động tạo ra nhiều container độc lập theo lượng truy cập. Kết nối trực tiếp (Port 5432) sẽ làm **cạn kiệt giới hạn kết nối (Connection Exhaustion)** của PostgreSQL chỉ trong vài giây, dẫn đến sập toàn bộ CSDL.
* **Chi tiết kỹ thuật**:
  - Mỗi container Vercel khi khởi chạy sẽ mở các kết nối TCP riêng đến database. Nếu có 100 người dùng đồng thời, sẽ có 100 kết nối độc lập. Database thông thường chỉ chịu được tối đa 50 - 100 kết nối đồng thời.
  - Cổng 6543 của Supabase sử dụng **PgBouncer** chạy ở chế độ **Transaction Pooling**: Các container Serverless dùng chung một nhóm kết nối sẵn có. Khi một truy vấn kết thúc, kết nối đó ngay lập tức được chuyển cho request khác tái sử dụng, giúp hệ thống chịu tải được hàng ngàn request đồng thời mà không làm quá tải PostgreSQL.
* **Dẫn chứng mã nguồn**:
  Xem [docs/deployment/DEPLOYMENT_GUIDE.md](file:///d:/ClassManagement/ClassManager/docs/deployment/DEPLOYMENT_GUIDE.md#L17) và [backend/config/db.js](file:///d:/ClassManagement/ClassManager/backend/config/db.js#L11-L26).

---

<a name="cau-8"></a>
### Câu 8: Tại sao `DATABASE_POOL_MAX` trên Vercel lại đặt là 1 thay vì 20 hay 50?
* **Trả lời ngắn gọn**:
  Trong môi trường Serverless (Vercel Lambda), mỗi Function Instance chỉ xử lý **1 request tại một thời điểm** (Concurrency per container = 1). Do đó, đặt `max: 1` là kích thước tối ưu nhất để không chiếm dụng lãng phí pool của PgBouncer.
* **Chi tiết kỹ thuật**:
  - Nếu đặt `DATABASE_POOL_MAX = 10`, mỗi Lambda instance vừa bật lên sẽ cố gắng giữ 10 kết nối nhàn rỗi (idle connections). Khi có 10 instance hoạt động, chúng sẽ chiếm 100 kết nối dù thực tế chỉ có 10 query đang chạy.
  - Đặt `DATABASE_POOL_MAX = 1` giúp mỗi instance chỉ giữ đúng 1 kết nối duy nhất vừa đủ để xử lý request hiện tại, giải phóng tối đa tài nguyên cho toàn hệ thống.

---

<a name="cau-9"></a>
### Câu 9: Khi 2 phụ huynh cùng lúc bấm đăng ký suất học cuối cùng của một lớp (Race Condition / Concurrency), hệ thống xử lý ra sao?
* **Trả lời ngắn gọn**:
  Hệ thống sử dụng **Database Transactions (`BEGIN ... COMMIT`)** kết hợp kiểm tra điều kiện sĩ số trong cùng một phiên giao dịch, ngăn chặn hoàn toàn hiện tượng bán vượt quá số lượng (Overbooking).
* **Chi tiết kỹ thuật**:
  - Khi thực hiện ghi danh, backend mở một transaction độc lập:
    1. Đếm số lượng học sinh hiện tại đang có trạng thái `active` trong lớp: `SELECT count(*) FROM enrollments WHERE class_id = $1 AND status = 'active'`.
    2. So sánh với `max_students` của bảng `classes`.
    3. Nếu `current_count >= max_students`, lập tức ném lỗi nghiệp vụ và gọi `ROLLBACK`.
    4. Nếu còn chỗ, thực hiện lệnh `INSERT INTO enrollments ...` và gọi `COMMIT`.
  - Nhờ cơ chế cô lập giao dịch (Transaction Isolation) của PostgreSQL, hai giao dịch đồng thời sẽ được tuần tự hóa, đảm bảo chỉ có người đầu tiên ghi danh thành công, người thứ hai sẽ nhận thông báo lớp đã đủ sĩ số.

---

<a name="cau-10"></a>
### Câu 10: Cơ chế xử lý lỗi tập trung (Centralized Error Handling) của backend hoạt động thế nào? Có trường hợp nào làm sập server không?
* **Trả lời ngắn gọn**:
  Tất cả các route handlers đều được bọc trong hàm **`asyncHandler`**, kết hợp với lớp lỗi tùy biến **`AppError`** và middleware bắt lỗi cuối cùng **`errorHandler`**, đảm bảo 100% lỗi không đồng bộ đều được bắt gọn và không bao giờ làm crash tiến trình Node.js.
* **Chi tiết kỹ thuật**:
  - `asyncHandler` ([backend/utils/async-handler.js](file:///d:/ClassManagement/ClassManager/backend/utils/async-handler.js)): Nhận vào một hàm async, tự động gọi `.catch(next)` để chuyển bất kỳ Exception hay Promise Rejection nào sang cho Express Error Middleware.
  - `AppError` ([backend/utils/errors.js](file:///d:/ClassManagement/ClassManager/backend/utils/errors.js)): Định nghĩa mã HTTP status và thông điệp thân thiện với người dùng.
  - `errorHandler` ([backend/middlewares/error.middleware.js](file:///d:/ClassManagement/ClassManager/backend/middlewares/error.middleware.js)): Nhận lỗi, ánh xạ các mã lỗi đặc biệt của PostgreSQL (như lỗi trùng khóa chính `23505`, lỗi vi phạm khóa ngoại `23503`) thành phản hồi JSON chuẩn: `{ success: false, message: "..." }`.

---

<a name="cau-11"></a>
### Câu 11: Mật khẩu và token quên mật khẩu được lưu trữ và kiểm tra ra sao?
* **Trả lời ngắn gọn**:
  Mật khẩu và token quên mật khẩu **không bao giờ được lưu dưới dạng thô**. Hệ thống chỉ lưu trữ chuỗi hash mật mã một chiều (One-way Hash).
* **Chi tiết kỹ thuật**:
  - **Mật khẩu**: Được băm bằng thuật toán mật mã kết hợp chuỗi muối ngẫu nhiên (Salt). Khi đăng nhập, hệ thống băm mật khẩu người dùng nhập với cùng salt đó rồi so sánh giá trị hash. Kẻ tấn công nếu có trích xuất được CSDL cũng không thể giải mã ngược lại mật khẩu gốc.
  - **Reset Token**: Khi người dùng yêu cầu đặt lại mật khẩu, server sinh ra chuỗi ngẫu nhiên 64 ký tự hex (`crypto.randomBytes(32)`). Server tính hash SHA-256 của token này và lưu vào CSDL kèm hạn sử dụng 15 phút. Chuỗi token thô chỉ gửi cho người dùng (qua email). Khi người dùng nhập lại token, server băm token đó rồi so sánh trong CSDL. Điều này đảm bảo dù database có bị lộ, kẻ tấn công cũng không thể dùng dữ liệu trong bảng để reset mật khẩu.

---

<a name="cau-12"></a>
### Câu 12: Luồng đăng nhập bằng Google OAuth 2.0 hoạt động thế nào?
* **Trả lời ngắn gọn**:
  Hệ thống sử dụng luồng **Google One Tap / Sign-In with Google** dựa trên ID Token (JWT do Google ký), được backend xác thực trực tiếp với máy chủ Google thông qua thư viện `google-auth-library`.
* **Chi tiết kỹ thuật**:
  1. Trình duyệt tải Google GIS script và hiển thị nút đăng nhập Google.
  2. Người dùng chọn tài khoản Google -> Google trả về một chuỗi `credential` (JWT đã được Google ký điện tử).
  3. Frontend gửi credential lên backend: `POST /api/auth/google`.
  4. Backend dùng `OAuth2Client.verifyIdToken()` để kiểm tra chữ ký với Google Public Keys và đối chiếu `audience` với `GOOGLE_CLIENT_ID`.
  5. Sau khi xác thực danh tính, backend trích xuất `google_sub` (định danh người dùng Google vĩnh viễn) và `email`:
     - Nếu đã liên kết: Đăng nhập ngay, sinh JWT của hệ thống ClassManager.
     - Nếu là người dùng mới: Trả về trạng thái `needs_profile: true` kèm `setup_token` tạm thời để yêu cầu người dùng hoàn thiện thông tin trước khi tạo tài khoản chính thức.
* **Dẫn chứng mã nguồn**:
  Xem [backend/controllers/auth.controller.js](file:///d:/ClassManagement/ClassManager/backend/controllers/auth.controller.js#L180-L245).

---

<a name="cau-13"></a>
### Câu 13: Frontend tối ưu tốc độ tải trang (Web Performance) bằng những kỹ thuật nào?
* **Trả lời ngắn gọn**:
  Frontend áp dụng 4 kỹ thuật tối ưu hóa trọng yếu: **Code Splitting (Lazy Loading)**, **In-Flight Request Deduplication**, **Client-side Response Caching**, và **Gzip/Brotli Compression**.
* **Chi tiết kỹ thuật**:
  1. **Route-level Code Splitting**: Trong [frontend/src/App.jsx](file:///d:/ClassManagement/ClassManager/frontend/src/App.jsx#L7-L18), toàn bộ 11 trang nghiệp vụ (Dashboard, Classes, Students, Timetable, Finance, ...) đều được tải lười qua `React.lazy()`. Khi mở trang chủ, trình duyệt chỉ tải bundle khoảng vài chục KB thay vì phải tải toàn bộ ứng dụng.
  2. **In-Flight Request Deduplication**: Trong [frontend/src/api/client.js](file:///d:/ClassManagement/ClassManager/frontend/src/api/client.js#L64-L78), nếu nhiều component cùng lúc gọi chung một API `GET` (ví dụ: lấy danh sách môn học), client chỉ phát 1 HTTP request duy nhất và chia sẻ Promise cho các component còn lại.
  3. **Client-side Caching**: Tự động lưu cache các kết quả `GET` trong 30 giây để người dùng chuyển qua lại giữa các tab không phải chờ tải lại dữ liệu.
  4. **Nén dữ liệu**: Backend kích hoạt middleware `compression` với thuật toán gzip mức 6 cho toàn bộ payload JSON trên 1KB.

---

<a name="cau-14"></a>
### Câu 14: Tại sao thiết kế CSDL lại dùng Xóa Mềm (Soft Delete) thay vì Xóa Cứng (Hard Delete)?
* **Trả lời ngắn gọn**:
  Trong hệ thống quản lý giáo dục và tài chính, dữ liệu có tính chất **lịch sử và pháp lý** cao. Xóa mềm bằng cờ `is_deleted = true` giúp bảo toàn toàn vẹn tham chiếu lịch sử, phục vụ kiểm toán tài chính và có thể khôi phục tức thì khi người dùng thao tác nhầm.
* **Chi tiết kỹ thuật**:
  - Nếu áp dụng Hard Delete (`DELETE FROM teachers WHERE teacher_id = 5`):
    - Hoặc câu lệnh sẽ bị lỗi khóa ngoại `FOREIGN KEY CONSTRAINT VIOLATION` do giáo viên này đã từng chấm bài, từng điểm danh hàng trăm buổi học trong quá khứ.
    - Hoặc nếu dùng `CASCADE`, toàn bộ lịch sử điểm danh, bảng điểm, lớp học của học sinh sẽ biến mất hoàn toàn, gây tổn thất dữ liệu nghiêm trọng.
  - Với Soft Delete: Bản ghi vẫn tồn tại trong CSDL để phục vụ báo cáo doanh thu và bảng điểm cũ, nhưng các màn hình chức năng thông thường sẽ lọc `WHERE is_deleted = false`.

---

<a name="cau-15"></a>
### Câu 15: Em hãy giải thích chi tiết luồng đi của 1 HTTP Request từ lúc User thao tác trên trình duyệt cho tới khi nhận về dữ liệu?
* **Ví dụ cụ thể**: Thao tác *Xem bảng điểm học sinh* (`GET /api/academic/transcripts?student_id=12`):
  1. **Tầng Presentation (Giao diện)**:
     - User bấm vào tab Bảng điểm trên màn hình học sinh.
     - Component React gọi `api.get('/academic/transcripts?student_id=12')`.
  2. **Tầng API Client (Frontend)**:
     - File `client.js` kiểm tra cache bộ nhớ. Nếu chưa có, lấy `token` từ `localStorage` đính kèm vào Header `Authorization: Bearer <token>` và gửi HTTP request đến `/api/academic/transcripts`.
  3. **Tầng Network & Gateway (Vercel Serverless / Express)**:
     - Request đến Vercel Serverless qua file [api/index.js](file:///d:/ClassManagement/ClassManager/api/index.js).
     - Middleware `cors` kiểm tra domain gửi request có hợp lệ không.
     - Middleware `compression` chuẩn bị bộ nén phản hồi.
  4. **Tầng Xác Thực & Phân Quyền (Middlewares)**:
     - `requireAuth`: Giải mã chuỗi JWT trong Header, kiểm tra chữ ký và hạn dùng. Nếu hợp lệ, gán thông tin vào `req.user`.
     - `requireRole`: Kiểm tra vai trò của người gọi. Nếu là phụ huynh/học sinh, kiểm tra xem có quyền xem bảng điểm của `student_id=12` không (chỉ xem được của chính mình hoặc con mình).
  5. **Tầng Nghiệp Vụ & Dữ Liệu (Controller & DB Pool)**:
     - `academic.controller.js` nhận request, gọi `pool.query(...)` với câu lệnh SQL có tham số `$1` để truy vấn bảng `submissions`, `assignments` và tính toán điểm trung bình.
     - Truy vấn đi qua kết nối PgBouncer (cổng 6543) vào PostgreSQL.
  6. **Tầng Phản Hồi (Response)**:
     - Controller nhận kết quả từ CSDL, định dạng dữ liệu và gọi helper `success(res, data)`.
     - Payload được nén gzip và trả về HTTP 200 OK với định dạng:
       `{ "success": true, "data": { "transcripts": [...] } }`.
     - React Component nhận dữ liệu, cập nhật state và re-render bảng điểm trên màn hình.
