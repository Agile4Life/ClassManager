# ClassManager UI Redesign Blueprint

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 */

Mục tiêu của tài liệu này là hướng dẫn cải tiến toàn bộ giao diện ClassManager, trừ màn hình đăng nhập, theo hướng sáng, sạch, cao cấp hơn nhưng vẫn giữ vibe lớp học và giữ nguyên toàn bộ chức năng hiện có.

Phạm vi áp dụng:

- Áp dụng cho các route nằm trong `AppShell`: Tổng quan, Phòng học, Giáo viên, Tài khoản, Học sinh, Lớp học, Thời khóa biểu, Điểm danh, Lịch sử điểm danh, Thông báo phụ huynh, Quá trình học tập, Hồ sơ cá nhân, Not Found và các trạng thái loading/error/empty bên trong app.
- Không áp dụng cho `frontend/src/pages/LoginPage.jsx` và mọi class CSS bắt đầu bằng `hallmark-login`, `login-`, `hallmark-panel`, `hallmark-form`, `hallmark-btn-submit`, `hallmark-google-btn`.
- Không đổi API, quyền theo role, URL route, tên field form, thứ tự nghiệp vụ, logic auth, logic import CSV, logic lưu/xóa/sửa, pagination, chọn hàng, tạo thông báo, clipboard, in ấn, hoặc validation hiện có.

## Design Read

Đọc project này như một classroom operations app cho trung tâm/lớp học nhỏ: người dùng cần quét dữ liệu nhanh, thao tác lặp lại nhiều lần trong ngày, và vẫn thấy cảm giác thân thiện của lớp học. Hướng thiết kế nên là **modern-minimal classroom workbench**: nền sáng, xanh học đường dịu, bút chì/vở kẻ làm chi tiết phụ, typography chắc tay, bảng/form rõ ràng, motion vừa đủ để phản hồi thao tác.

Dials:

- `DESIGN_VARIANCE: 5` vì đây là app vận hành, không phải landing page.
- `MOTION_INTENSITY: 3` vì thao tác dữ liệu cần nhanh, ít xao nhãng.
- `VISUAL_DENSITY: 6` vì có nhiều bảng, form, danh sách học sinh/lớp/lịch.

## Existing Signals

Project hiện tại:

- Frontend: React + Vite.
- UI base: Bootstrap 5.3 + custom wrapper trong `frontend/src/components/bootstrap-ui.jsx`.
- Icons: component icon nội bộ trong `frontend/src/components/bootstrap-icons.jsx`.
- Global CSS: `frontend/src/styles.css`.
- Layout shell: `frontend/src/layout/AppShell.jsx`.
- Page shared component: `PageHeader`, `FeedbackState`, `Pagination`, `StatusBadge`.
- Login đang có visual riêng, cần giữ nguyên.

Các điểm tốt nên giữ:

- Vibe lớp học đã có: `welcome-strip` dạng vở kẻ, `sidebar-note`, `book-stamp`, tone xanh sáng, ghi chú màu bút chì.
- Điều hướng theo role đã rõ.
- Loading, Error, Empty state đã có component chung.
- Mobile sidebar đã có scrim và topbar.
- Các page dùng component chung khá đều, dễ nâng cấp bằng CSS + component shared.

Các điểm cần cải thiện:

- `styles.css` quá lớn, token màu đang trộn hex trực tiếp với biến semantic.
- Nhiều vùng dùng card trắng + border + shadow lặp lại, dễ đọc thành template.
- Có một số inline style trong page, ví dụ bulk actions ở `StudentsPage`, cần đưa về class.
- Motion đang dùng `ease`/transition khá lẫn lộn, cần chuẩn hóa bằng token.
- Bảng dữ liệu và toolbar cần system rõ hơn để giữ mật độ nhưng bớt nặng.
- Dropdown custom cần bổ sung keyboard/focus behavior nếu tiếp tục dùng thay native select.

## North Star

Giao diện sau redesign nên có cảm giác:

- Sáng, sạch, thoáng, không lạnh.
- Có dấu hiệu lớp học qua chi tiết tinh tế: giấy kẻ, màu bút chì, nhãn lớp, code lớp, lịch học, ô điểm danh.
- Là app làm việc hằng ngày, không phải trang marketing.
- Dữ liệu quan trọng nổi lên trước: hôm nay học gì, lớp nào cần chú ý, học sinh nào được chọn, trạng thái lưu/xóa.
- Ít trang trí, nhiều nhịp đọc.

Không dùng:

- Nền tối toàn app.
- Purple/blue AI gradient.
- Card lồng card nhiều tầng.
- Shadow đậm kiểu template.
- Text mô tả tính năng trong UI chỉ để “làm đầy”.
- Animation dài hoặc liên tục.
- Thay login.

## Locked Design System

Tạo hoặc refactor token ở đầu `frontend/src/styles.css`. Nếu muốn sạch hơn, có thể tạo `frontend/src/design-tokens.css` rồi import trong `main.jsx` hoặc `styles.css`, nhưng không bắt buộc.

Token đề xuất:

```css
:root {
  --color-canvas: oklch(97.5% 0.012 250);
  --color-paper: oklch(100% 0 0);
  --color-paper-2: oklch(96.5% 0.018 246);
  --color-paper-3: oklch(94.5% 0.028 247);
  --color-ink: oklch(23% 0.045 255);
  --color-ink-2: oklch(46% 0.04 255);
  --color-muted: oklch(58% 0.035 255);
  --color-rule: oklch(88% 0.024 250);
  --color-accent: oklch(49% 0.13 252);
  --color-accent-strong: oklch(39% 0.13 252);
  --color-accent-soft: oklch(93.5% 0.04 248);
  --color-pencil: oklch(84% 0.13 88);
  --color-pencil-soft: oklch(96% 0.055 92);
  --color-success: oklch(48% 0.12 150);
  --color-warning: oklch(62% 0.13 78);
  --color-danger: oklch(52% 0.16 28);
  --color-focus: oklch(62% 0.15 252);

  --font-display: "Segoe UI Variable", "Aptos Display", "Avenir Next", system-ui, sans-serif;
  --font-body: "Segoe UI Variable", "Aptos", "Avenir Next", system-ui, sans-serif;
  --font-mono: "Cascadia Mono", "SFMono-Regular", Consolas, monospace;

  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  --space-2xl: 4.5rem;

  --radius-xs: 8px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  --shadow-soft: 0 18px 44px color-mix(in oklch, var(--color-accent) 13%, transparent);
  --shadow-raised: 0 22px 60px color-mix(in oklch, var(--color-accent) 18%, transparent);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.87, 0, 0.13, 1);
  --dur-fast: 140ms;
  --dur-base: 220ms;
  --dur-slow: 360ms;
}
```

Mapping legacy để không phải sửa mọi class cùng lúc:

```css
:root {
  --canvas: var(--color-canvas);
  --paper: var(--color-paper);
  --paper-blue: var(--color-paper-2);
  --ink: var(--color-ink);
  --muted: var(--color-muted);
  --accent: var(--color-accent);
  --accent-dark: var(--color-accent-strong);
  --accent-soft: var(--color-accent-soft);
  --pencil: var(--color-pencil);
  --pencil-soft: var(--color-pencil-soft);
  --line: var(--color-rule);
  --radius: var(--radius-md);
  --radius-control: var(--radius-sm);
}
```

## Visual Language

### Canvas

Giữ nền sáng. Dùng một lớp nền rất nhẹ gợi giấy học:

- Base `--color-canvas`.
- Grid giấy kẻ chỉ ở `welcome-strip`, dashboard hero hoặc empty state lớn, không phủ toàn bộ page quá rõ.
- Không dùng orb lớn/blur nhiều ở toàn app. Nếu giữ `body::before/after`, giảm opacity mạnh hoặc thay bằng texture cố định rất nhẹ.

### Typography

- H1 page: 32-42px desktop, 26-30px mobile, line-height 1.08.
- H2 surface: 18-22px, weight 700.
- Body: 14-15px, line-height 1.55.
- Table: 13.5-14px, dùng `font-variant-numeric: tabular-nums` cho số, ngày, giờ.
- Label form: 12.5-13px, sentence case, không lạm dụng uppercase.
- Không italic heading.

### Color

Giữ accent xanh học đường làm màu chính. Màu bút chì vàng chỉ dùng 3-5% viewport:

- Active nav, primary button, focus ring: xanh.
- Notes, reminders, small highlights: vàng bút chì.
- Status badges: success/warning/danger có hue riêng nhưng nhạt, không quá rực.
- Không đổi mỗi section sang một theme khác. Theme picker nếu giữ thì chỉ thay accent trong cùng hệ token.

### Surfaces

Thay vì mọi thứ đều là card trắng có shadow, chia 4 loại:

- `surface-flat`: không shadow, chỉ dùng spacing và border-top cho danh sách đơn giản.
- `surface-paper`: nền trắng, radius 14, border mảnh, shadow rất nhẹ.
- `surface-board`: nền xanh rất nhạt + grid giấy, dùng cho welcome/dashboard.
- `surface-focus`: nền trắng, border accent mềm, dùng cho panel đang được chọn như lớp đang chọn, dòng nhận xét active.

Không đặt card bên trong card nếu không cần. Với dashboard, dùng grid/panel rõ thay vì bọc thêm nhiều lớp.

## Layout System

### App Shell

Giữ `AppShell.jsx` và role-based navigation. Chỉ cải tiến visual:

- Sidebar desktop rộng 260-280px, nền `surface-paper` pha xanh nhẹ.
- Brand lockup giữ logo giáo viên, bỏ inline style bằng class riêng.
- Active nav dùng thanh dọc nhỏ + nền xanh mềm, không shadow mạnh.
- Sidebar note biến thành “Today note” nhỏ, có icon/line như giấy nhớ.
- User footer rõ vai trò, logout là icon button 40px có focus ring.
- Mobile topbar sticky, cao ổn định, có backdrop nhẹ, không che nội dung.

### Page Container

- Desktop: max-width 1440-1480px, padding top 32-40px, bottom 56-72px.
- Tablet: 24px.
- Mobile: 16px, dưới 360px là 12px.
- `.page-flow` gap 20-28px tùy page, không để tất cả sections cùng khoảng cách máy móc.

### Page Header

Nâng `PageHeader.jsx` thành header có optional meta/actions:

- Trái: title + description.
- Phải: action group.
- Mobile: action full width dưới title.
- Không thêm badge/eyebrow trên mọi page.
- Button group không được wrap xấu; nếu nhiều action dùng `.page-header-actions`.

## Component Rules

### Buttons

Giữ API `Button` hiện tại để không phá page:

- `primary`: nền accent, chữ trắng, hover đậm nhẹ, active translateY(1px).
- `secondary`: nền paper, border rule, hover accent-soft.
- `subtle`: nền trong suốt, dùng cho icon/action row.
- `danger-button`: không chỉ dùng đỏ nền lớn; dùng border đỏ + text đỏ, khi confirm destructive mới fill đỏ.
- Mọi button có `:focus-visible` rõ, không animate focus ring.

### Forms

- Input/select/textarea min-height 42-44px.
- Border 1px `--color-rule`, focus ring 3px `color-mix` từ focus.
- Placeholder phải đủ contrast.
- Error inline trong form, không dùng alert global cho lỗi từng field.
- Select custom hiện tại cần đảm bảo: click outside, Escape đóng menu, ArrowDown/ArrowUp di chuyển, Enter chọn, `aria-activedescendant` nếu cải tiến sâu. Nếu chưa làm được keyboard đầy đủ thì ưu tiên native select styled.

### Tables

Bảng là trung tâm của app, cần nâng cấp kỹ:

- Header sticky trong table surface nếu danh sách dài.
- Cell padding 14-16px desktop, 12px mobile.
- Row hover rất nhẹ, selected row có nền accent-soft + left bar.
- Primary cell dùng avatar/initial tile 36-40px, không quá nổi.
- Actions đặt trong icon button group, chỉ hiện rõ khi hover/focus trên desktop nhưng luôn thấy trên touch/mobile.
- Mobile không ép bảng quá nhỏ. Với bảng nhiều cột, dùng horizontal scroll trong `.table-surface` và thêm shadow mép phải/trái.

### Dialogs

- Dialog max-width theo nội dung: form nhỏ 560px, form grid 720px, import CSV 920px.
- Header dialog có title rõ, body scroll, footer sticky nếu nội dung dài.
- Không đổi tên field hoặc submit logic.
- Destructive confirmation phải nêu hậu quả chính xác như hiện tại.

### Feedback States

Nâng cấp `LoadingState`, `ErrorState`, `EmptyState`:

- Loading: skeleton theo đúng layout, không spinner tròn.
- Empty: dùng icon lớp học nhẹ + nội dung ngắn, có action nếu page có create.
- Error: message rõ, nút retry cùng hàng.
- Success: ngắn, bình tĩnh, không dùng dấu chấm than.

## Page-by-Page Redesign Plan

### 1. Dashboard

File: `frontend/src/pages/DashboardPage.jsx`.

Giữ:

- Greeting theo giờ.
- Theme picker.
- Shortcuts theo role.
- Stat tổng quan.
- Preview thời khóa biểu và lớp gần đây.

Cải tiến:

- `welcome-strip` thành classroom board: giấy kẻ tinh tế, một `book-stamp` nhỏ, không quá trang trí.
- Dashboard shortcuts đổi từ card đều nhau thành command grid 2-4 cột, icon nhẹ, arrow chỉ là affordance.
- Stat grid dùng số lớn tabular, không ép 3 cột nếu chỉ có 2 item.
- Schedule preview có timeline trái bằng ngày/giờ, class info phải.
- Theme picker thu gọn thành segmented color tray, có thể collapse nếu chiếm quá nhiều diện tích.

### 2. Students

File: `frontend/src/pages/StudentsPage.jsx`.

Giữ:

- Search, add, edit, delete.
- Import CSV.
- Bulk assign class.
- Pagination.
- Role permission.

Cải tiến:

- Xóa inline style của `.bulk-actions`, đưa vào CSS.
- Bulk action bar nên là sticky selection bar trong `table-surface`, màu accent-soft.
- Student table ưu tiên cột: Học sinh, Lớp, Liên hệ, Trạng thái, Thao tác.
- Liên hệ gom trong stacked cell nhưng giảm text lặp lại bằng label nhỏ: Ba, Mẹ, HS.
- Import dialog chia 3 step rõ: tải mẫu, chọn file, kiểm tra dữ liệu.
- Preview CSV nếu rộng thì horizontal scroll.

### 3. Classes

File: `frontend/src/pages/ClassesPage.jsx`.

Giữ:

- Search, create/edit/cancel class.
- Chọn lớp để xem học sinh.
- Teacher multi-checkbox.
- Soft cancel bằng status `cancelled`.

Cải tiến:

- Table row selected cần nổi rõ vì mở panel học sinh bên dưới.
- `class-students-panel` đổi thành detail drawer/panel dưới bảng với header dính code lớp.
- Teacher names nếu dài nên wrap đẹp, không làm row quá cao bất ngờ.
- `teacher-checkbox-list` thành checklist panel có max-height, search sau này nếu nhiều giáo viên.

### 4. Timetable

File: `frontend/src/pages/TimetablePage.jsx`.

Giữ toàn bộ logic lịch học.

Cải tiến:

- Treat as weekly planner, không như bảng CRUD.
- Days là columns/cards ổn định, time chips dùng mono/tabular.
- Class block có color bar accent, room chip nhỏ.
- Toolbar filter sticky phía trên board.
- Mobile ưu tiên horizontal scroll ngày trong tuần, không nén chữ.

### 5. Attendance

File: `frontend/src/pages/AttendancePage.jsx`.

Giữ:

- Chọn lớp/session.
- Toggle present/absent.
- Save bar.

Cải tiến:

- Đây là workflow tốc độ cao. Row học sinh cần cao 64-76px, target chạm rõ.
- Present/absent dùng segmented toggle, trạng thái current có fill rõ.
- Save bar sticky bottom trên mobile, sticky top/bottom trong panel desktop tùy layout.
- Unsaved state cần hiện rõ nhưng không dùng modal.

### 6. Attendance History

File: `frontend/src/pages/AttendanceHistoryPage.jsx`.

Cải tiến:

- Filter panel dạng compact rail.
- Summary cards dùng số tabular.
- Bảng lịch sử có group theo ngày/lớp nếu dữ liệu nhiều.
- Empty state gợi ý chọn lớp/khoảng ngày.

### 7. Parent Notifications

File: `frontend/src/pages/ParentNotificationPage.jsx`.

Giữ:

- Chọn lớp.
- Student picker.
- Nhiều dòng nhận xét.
- Template saved/custom.
- Preview editable.
- Lưu history + copy + print.

Cải tiến:

- Đây là page phức tạp nhất, nên chuyển thành 2-pane workbench:
  - Left: editor lines.
  - Right: preview sticky.
- `notification-line` là surface-focus nhẹ, line number nhỏ, delete icon ở góc phải.
- Student picker có selected count rõ, list scroll ổn định, selected item có check rõ.
- Preview textarea nhìn như tờ thông báo gửi phụ huynh: paper surface, line-height rộng, action sticky.
- Success copy nên hiển thị inline dưới action, không làm layout nhảy nhiều.

### 8. Learning History

File: `frontend/src/pages/LearningHistoryPage.jsx`.

Cải tiến:

- Biến thành timeline học tập.
- Mỗi event có ngày, lớp, category, nội dung.
- Filter đặt trên cùng, summary nhỏ bên dưới.
- Không dùng table nếu nội dung narrative dài; dùng list/timeline dễ đọc hơn.

### 9. Rooms, Teachers, Accounts, Profile

Files:

- `frontend/src/pages/RoomsPage.jsx`
- `frontend/src/pages/TeachersPage.jsx`
- `frontend/src/pages/AccountsPage.jsx`
- `frontend/src/pages/ProfilePage.jsx`

Cải tiến chung:

- Giữ CRUD logic.
- Dùng cùng table/form/dialog system.
- Profile nên là settings layout 2 cột desktop: account card + editable details.
- Accounts cần rõ role/status, tránh màu role quá nhiều; dùng badge trung tính.

### 10. Not Found

File: `frontend/src/pages/NotFoundPage.jsx`.

Cải tiến:

- Giữ sáng, nhỏ gọn.
- Dùng classroom empty illustration nhẹ bằng CSS hoặc icon sẵn có, không fake SVG phức tạp.
- CTA về Tổng quan.

## Implementation Order

Làm theo thứ tự này để ít rủi ro:

1. Khóa token và base CSS ở `frontend/src/styles.css`.
2. Refactor visual của shared components: `Button`, `Field`, `Select`, `Dialog`, `Table`, `FeedbackState`, `PageHeader`, `Pagination`, `StatusBadge`.
3. Làm `AppShell`: sidebar, mobile topbar, page container.
4. Làm Dashboard vì nó định hình vibe.
5. Làm table-heavy pages: Students, Classes, Teachers, Rooms, Accounts.
6. Làm workflow pages: Timetable, Attendance, Parent Notifications.
7. Làm history/profile/not found.
8. Chạy QA responsive và regression.

Không làm cùng lúc cả logic và visual. Mỗi bước chỉ đổi class/style/markup phụ trợ, không đổi API call.

## File Change Map

Nên sửa:

- `frontend/src/styles.css`: token, global surfaces, tables, forms, modals, app shell, responsive.
- `frontend/src/components/bootstrap-ui.jsx`: chỉ sửa class/ARIA/state nếu cần, giữ API props.
- `frontend/src/components/PageHeader.jsx`: thêm wrapper/action layout, giữ props cũ.
- `frontend/src/components/FeedbackState.jsx`: nâng markup loading/error/empty, giữ props cũ.
- `frontend/src/components/StatusBadge.jsx`: chuẩn hóa badge.
- `frontend/src/components/Pagination.jsx`: chuẩn hóa controls.
- Page files trong `frontend/src/pages/*Page.jsx` ngoại trừ `LoginPage.jsx`: chỉ đổi className/semantic wrappers khi cần.

Không sửa:

- `frontend/src/pages/LoginPage.jsx`.
- Auth/session context trừ khi có bug riêng.
- Backend routes/controllers.
- API client behavior.

## CSS Architecture Proposal

Nếu tiếp tục dùng một file CSS:

```text
styles.css
1. tokens + bootstrap variable bridge
2. reset/base/accessibility
3. app shell
4. shared components
5. page primitives
6. table/form/dialog patterns
7. page-specific sections
8. responsive
9. reduced motion
```

Nếu tách file:

```text
frontend/src/styles/
  tokens.css
  base.css
  shell.css
  components.css
  pages.css
  responsive.css
```

Với project hiện tại, phương án an toàn hơn là giữ `styles.css` trước, nhưng comment rõ từng vùng. Sau khi ổn mới tách.

## Accessibility Checklist

Trước khi coi redesign hoàn tất:

- Mọi button/icon-only button có `aria-label` hoặc title hợp lý.
- Focus ring hiện rõ trên button, input, select, table row clickable, nav item.
- Modal đóng được bằng Escape và click backdrop như hiện tại.
- Không có text dưới 12px cho nội dung chính.
- Input/select trên mobile >= 16px để tránh iOS zoom.
- Table có `aria-label`.
- Empty/error/loading state có `aria-live` khi phù hợp.
- Color contrast: text chính AA, button primary AA, placeholder đủ đọc.
- Không horizontal scroll toàn page, chỉ scroll trong table/board cần thiết.

## Responsive QA

Test ít nhất các viewport:

- 320px mobile nhỏ.
- 375px iPhone phổ biến.
- 414px mobile lớn.
- 768px tablet.
- 1024px laptop.
- 1440px desktop.

Các điểm phải kiểm:

- Sidebar mobile mở/đóng không che mất topbar bất thường.
- PageHeader action không tràn.
- Table surface không làm body scroll ngang.
- ParentNotification two-pane chuyển thành một cột.
- Timetable board scroll ngang mượt.
- Attendance save bar không che row cuối.
- Dialog vừa màn hình, body scroll được, footer vẫn bấm được.
- Login không thay đổi.

## Anti-Slop Gate

Không merge nếu còn các dấu hiệu sau:

- Mỗi page đều là card trắng + shadow giống nhau.
- Có nhiều màu accent cạnh tranh.
- Có gradient xanh tím trang trí lớn.
- Có section/card lồng nhau không cần thiết.
- Button thiếu hover/active/focus/disabled.
- Bảng nén chữ đến khó đọc trên mobile.
- Select custom không dùng được bằng keyboard.
- Copy UI dùng câu chung chung như “nâng tầm trải nghiệm”.
- Login bị ảnh hưởng visual ngoài ý muốn.

## Regression Checklist

Sau mỗi batch thay đổi, chạy:

```bash
cd frontend
npm run build
```

Sau đó kiểm thủ công:

- Đăng nhập vẫn vào app bình thường.
- Logout vẫn hoạt động.
- Role admin/staff/teacher/student/parent vẫn thấy đúng menu.
- Search + pagination vẫn chạy.
- Create/edit/delete/cancel vẫn gọi đúng API.
- Import CSV học sinh vẫn parse và preview.
- Bulk assign class vẫn hoạt động.
- Chọn lớp xem học sinh vẫn hoạt động.
- Tạo thông báo phụ huynh, copy, print, lưu history vẫn hoạt động.
- Attendance save không mất trạng thái.

## Final Direction

Hãy coi redesign này là nâng cấp “phòng học vận hành” chứ không phải thay áo marketing. Nền vẫn sáng, màu xanh vẫn là neo nhận diện, chi tiết lớp học vẫn còn nhưng tiết chế hơn. Chức năng cũ là xương sống, visual system chỉ làm mọi thao tác rõ hơn, nhanh hơn và dễ tin hơn.
