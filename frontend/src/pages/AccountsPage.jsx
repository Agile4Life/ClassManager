import { useState } from 'react';
import {
  Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Table, TableBody, TableCell, TableHeader,
  TableHeaderCell, TableRow,
} from '../components/bootstrap-ui';
import { Add24Regular, Delete24Regular, Key24Regular, Search24Regular, Edit24Regular } from '../components/bootstrap-icons';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { usePageData } from '../hooks/usePageData';

const roleLabels = { admin: 'Quản trị viên', staff: 'Nhân viên', teacher: 'Giáo viên', student: 'Học sinh', parent: 'Phụ huynh' };
const statusLabels = { active: 'Hoạt động', inactive: 'Ngừng hoạt động', locked: 'Đã khóa' };
const initialCreateForm = {
  role: 'student', username: '', password: '', status: 'active',
  full_name: '', phone: '', email: '',
};
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

function roleColor(role) {
  return { admin: 'danger', staff: 'warning', teacher: 'informative', student: 'success', parent: 'brand' }[role] || 'subtle';
}

export default function AccountsPage() {
  const { user } = useAuth();
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <AccountsWorkspace currentUser={user} />;
}

function AccountsWorkspace({ currentUser }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createPasswordConfirmation, setCreatePasswordConfirmation] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', full_name: '', phone: '', email: '' });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  const { data, loading, error, refresh } = usePageData(
    () => api.get(`/admin/accounts?page=${page}&limit=15&search=${encodeURIComponent(search)}&role=${role}&status=${status}`).then((response) => response.data),
    [page, search, role, status],
  );
  function updateCreateForm(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateError('');
  }

  function closeCreateDialog(force = false) {
    if (creating && !force) return;
    setCreateOpen(false);
    setCreateForm(initialCreateForm);
    setCreatePasswordConfirmation('');
    setCreateError('');
  }

  async function createAccount(event) {
    event.preventDefault();
    if (createForm.password !== createPasswordConfirmation) {
      setCreateError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const payload = {
        role: createForm.role,
        username: createForm.username.trim(),
        password: createForm.password,
        status: createForm.status,
        full_name: createForm.full_name.trim(),
        phone: createForm.phone.trim() || null,
        email: createForm.email.trim() || null,
      };
      await api.post('/admin/accounts', payload);
      closeCreateDialog(true);
      setPage(1);
      setActionMessage('Đã tạo tài khoản mới thành công.');
      refresh();
    } catch (requestError) {
      setCreateError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleAccountStatus(account) {
    const nextStatus = account.status === 'active' ? 'locked' : 'active';
    setBusyId(account.user_id);
    setActionError('');
    setActionMessage('');
    try {
      await api.put(`/admin/accounts/${account.user_id}`, { status: nextStatus });
      setActionMessage(nextStatus === 'active' ? `Đã mở khóa ${account.username}.` : `Đã khóa ${account.username}.`);
      refresh();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  function openPasswordDialog(account) {
    setPasswordTarget(account);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setResettingPassword(true);
    setPasswordError('');
    try {
      await api.put(`/admin/accounts/${passwordTarget.user_id}/password`, { password: newPassword });
      setPasswordTarget(null);
      setActionMessage(`Đã đặt lại mật khẩu cho ${passwordTarget.username}.`);
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setResettingPassword(false);
    }
  }

  async function deleteAccount() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/admin/accounts/${deleteTarget.user_id}`);
      setDeleteTarget(null);
      setActionMessage('Đã xóa tài khoản. Hồ sơ giáo viên, học sinh hoặc phụ huynh vẫn được giữ lại.');
      if (data.items.length === 1 && page > 1) setPage((current) => current - 1);
      else refresh();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  const [profiles, setProfiles] = useState([]);

  function openEditDialog(account) {
    setEditTarget(account);
    setEditForm({
      username: account.username,
      full_name: account.full_name,
      phone: account.phone || '',
      email: account.email || '',
      linked_profile_id: account[`${account.role}_id`] || '',
    });
    setEditError('');
    setProfiles([]);
    if (['teacher', 'student', 'parent'].includes(account.role)) {
      api.get(`/${account.role}s?limit=1000`).then((res) => {
        setProfiles(res.data.items);
      });
    }
  }

  async function updateAccount(event) {
    event.preventDefault();
    setEditing(true);
    setEditError('');
    try {
      const payload = {
        username: editForm.username.trim(),
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
      };
      if (editTarget.role === 'teacher') payload.teacher_id = editForm.linked_profile_id || null;
      if (editTarget.role === 'student') payload.student_id = editForm.linked_profile_id || null;
      if (editTarget.role === 'parent') payload.parent_id = editForm.linked_profile_id || null;
      
      await api.put(`/admin/accounts/${editTarget.user_id}`, payload);
      setEditTarget(null);
      setActionMessage(`Đã cập nhật thông tin tài khoản ${editTarget.username}.`);
      refresh();
    } catch (requestError) {
      setEditError(requestError.message);
    } finally {
      setEditing(false);
    }
  }

  const canCreate = createForm.username.trim() && createForm.full_name.trim()
    && createForm.password && createPasswordConfirmation
    && createForm.password === createPasswordConfirmation
    && (createForm.role !== 'parent' || createForm.phone.trim());
  const summary = data?.summary || { total: 0, active: 0, locked: 0, admins: 0 };

  return (
    <div className="page-flow accounts-page">
      <PageHeader
        title="Quản trị tài khoản"
        description="Tạo tài khoản theo đúng vai trò và kiểm soát trạng thái đăng nhập của từng người dùng."
        action={<Button appearance="primary" icon={<Add24Regular />} onClick={() => setCreateOpen(true)}>Tạo tài khoản</Button>}
      />

      <section className="account-summary" aria-label="Tổng hợp tài khoản">
        <div><span>Tổng tài khoản</span><strong>{summary.total}</strong></div>
        <div><span>Đang hoạt động</span><strong>{summary.active}</strong></div>
        <div><span>Đã khóa</span><strong>{summary.locked}</strong></div>
        <div><span>Quản trị viên</span><strong>{summary.admins}</strong></div>
      </section>

      <form className="toolbar account-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <Input contentBefore={<Search24Regular />} aria-label="Tìm tài khoản" placeholder="Tên, username, email hoặc số điện thoại" value={searchInput} onChange={(_, value) => setSearchInput(value.value)} />
        <Select aria-label="Lọc vai trò" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}>
          <option value="">Tất cả vai trò</option>
          {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select aria-label="Lọc trạng thái" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Button type="submit">Tìm kiếm</Button>
      </form>

      {actionError && <MessageBar intent="error"><MessageBarBody>{actionError}</MessageBarBody></MessageBar>}
      {actionMessage && <MessageBar intent="success"><MessageBarBody>{actionMessage}</MessageBarBody></MessageBar>}
      {loading && <LoadingState rows={7} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && <EmptyState title="Chưa có tài khoản phù hợp" description="Thử thay đổi bộ lọc hoặc tạo tài khoản mới." />}
      {data?.items.length > 0 && (
        <div className="table-surface account-table">
          <Table aria-label="Danh sách tài khoản"><TableHeader><TableRow>
            <TableHeaderCell>Tài khoản</TableHeaderCell><TableHeaderCell>Vai trò</TableHeaderCell>
            <TableHeaderCell>Hồ sơ liên kết</TableHeaderCell><TableHeaderCell>Liên hệ</TableHeaderCell>
            <TableHeaderCell>Đăng nhập gần nhất</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell>
            <TableHeaderCell>Thao tác</TableHeaderCell>
          </TableRow></TableHeader><TableBody>{data.items.map((account) => (
            <TableRow key={account.user_id}>
              <TableCell><div className="primary-cell"><span className="initial-tile">{account.full_name.slice(0, 1)}</span><div><strong>{account.full_name}</strong><span>@{account.username}</span></div></div></TableCell>
              <TableCell><Badge appearance="tint" color={roleColor(account.role)}>{roleLabels[account.role]}</Badge></TableCell>
              <TableCell><div className="stacked-cell"><span>{account.linked_profile_name || (['admin', 'staff'].includes(account.role) ? 'Tài khoản nội bộ' : 'Chưa liên kết')}</span><small>{account.linked_profile_code || 'Không có mã hồ sơ'}</small></div></TableCell>
              <TableCell><div className="stacked-cell"><span>{account.phone || 'Chưa có số điện thoại'}</span><small>{account.email || 'Chưa có email'}</small></div></TableCell>
              <TableCell>{account.last_login_at ? dateTimeFormatter.format(new Date(account.last_login_at)) : 'Chưa đăng nhập'}</TableCell>
              <TableCell><Badge appearance="filled" color={account.status === 'active' ? 'success' : account.status === 'locked' ? 'danger' : 'subtle'}>{statusLabels[account.status]}</Badge></TableCell>
              <TableCell><div className="account-actions">
                <Button size="small" appearance="subtle" icon={<Edit24Regular />} aria-label={`Sửa ${account.username}`} title="Sửa thông tin" onClick={() => openEditDialog(account)} />
                <Button size="small" appearance="subtle" disabled={busyId === account.user_id || String(account.user_id) === String(currentUser.user_id)} onClick={() => toggleAccountStatus(account)}>{account.status === 'active' ? 'Khóa' : 'Mở khóa'}</Button>
                <Button size="small" appearance="subtle" icon={<Key24Regular />} aria-label={`Đặt lại mật khẩu ${account.username}`} title="Đặt lại mật khẩu" onClick={() => openPasswordDialog(account)} />
                <Button size="small" appearance="subtle" icon={<Delete24Regular />} aria-label={`Xóa ${account.username}`} title="Xóa tài khoản" disabled={String(account.user_id) === String(currentUser.user_id)} onClick={() => { setDeleteTarget(account); setDeleteError(''); }} />
              </div></TableCell>
            </TableRow>
          ))}</TableBody></Table>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(_, details) => { if (!details.open) closeCreateDialog(); }}>
        <DialogSurface className="account-dialog"><form onSubmit={createAccount}><DialogBody>
          <DialogTitle>Tạo tài khoản mới</DialogTitle>
          <DialogContent className="form-grid account-form">
            {createError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{createError}</MessageBarBody></MessageBar>}
            <Field label="Vai trò" required><Select value={createForm.role} onChange={(event) => updateCreateForm('role', event.target.value)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Trạng thái"><Select value={createForm.status} onChange={(event) => updateCreateForm('status', event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Họ và tên" required><Input autoComplete="name" value={createForm.full_name} onChange={(_, value) => updateCreateForm('full_name', value.value)} /></Field>
            <Field label="Số điện thoại" required={createForm.role === 'parent'}><Input type="tel" autoComplete="tel" value={createForm.phone} onChange={(_, value) => updateCreateForm('phone', value.value)} /></Field>
            <Field label="Email"><Input type="email" autoComplete="email" value={createForm.email} onChange={(_, value) => updateCreateForm('email', value.value)} /></Field>
            <Field label="Tên đăng nhập" required><Input autoComplete="off" value={createForm.username} onChange={(_, value) => updateCreateForm('username', value.value)} /></Field>
            <Field label="Mật khẩu ban đầu" required><Input type="password" autoComplete="new-password" value={createForm.password} onChange={(_, value) => updateCreateForm('password', value.value)} /></Field>
            <Field label="Xác nhận mật khẩu" required><Input type="password" autoComplete="new-password" value={createPasswordConfirmation} onChange={(_, value) => { setCreatePasswordConfirmation(value.value); setCreateError(''); }} /></Field>
            <p className="account-password-hint form-grid__wide">Mật khẩu gồm 8-72 ký tự, có ít nhất một chữ và một số.</p>
          </DialogContent>
          <DialogActions><Button type="button" appearance="secondary" disabled={creating} onClick={() => closeCreateDialog()}>Hủy</Button><Button appearance="primary" type="submit" disabled={creating || !canCreate}>{creating ? 'Đang tạo...' : 'Tạo tài khoản'}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>

      <Dialog open={Boolean(passwordTarget)} onOpenChange={(_, details) => { if (!details.open && !resettingPassword) setPasswordTarget(null); }}>
        <DialogSurface><form onSubmit={resetPassword}><DialogBody>
          <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          <DialogContent className="form-grid">
            <p className="form-grid__wide dialog-description">Tạo mật khẩu mới cho <strong>@{passwordTarget?.username}</strong>. Các phiên đăng nhập khác của tài khoản sẽ bị đăng xuất.</p>
            {passwordError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{passwordError}</MessageBarBody></MessageBar>}
            <Field label="Mật khẩu mới" hint="8-72 ký tự, có chữ và số" required><Input type="password" autoComplete="new-password" value={newPassword} onChange={(_, value) => setNewPassword(value.value)} /></Field>
            <Field label="Xác nhận mật khẩu" required><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(_, value) => setConfirmPassword(value.value)} /></Field>
          </DialogContent>
          <DialogActions><Button type="button" appearance="secondary" disabled={resettingPassword} onClick={() => setPasswordTarget(null)}>Hủy</Button><Button type="submit" appearance="primary" disabled={resettingPassword || !newPassword || !confirmPassword}>{resettingPassword ? 'Đang lưu...' : 'Đặt lại mật khẩu'}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, details) => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <DialogSurface><DialogBody>
          <DialogTitle>Xóa tài khoản?</DialogTitle>
          <DialogContent>{deleteError && <MessageBar intent="error"><MessageBarBody>{deleteError}</MessageBarBody></MessageBar>}<p className="delete-confirmation">Tài khoản <strong>@{deleteTarget?.username}</strong> sẽ không thể đăng nhập. Hồ sơ liên kết và dữ liệu học tập không bị xóa.</p></DialogContent>
          <DialogActions><Button appearance="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button><Button className="danger-button" appearance="primary" disabled={deleting} onClick={deleteAccount}>{deleting ? 'Đang xóa...' : 'Xóa tài khoản'}</Button></DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(_, details) => { if (!details.open && !editing) setEditTarget(null); }}>
        <DialogSurface className="account-dialog"><form onSubmit={updateAccount}><DialogBody>
          <DialogTitle>Sửa thông tin tài khoản</DialogTitle>
          <DialogContent className="form-grid account-form">
            {editError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{editError}</MessageBarBody></MessageBar>}
            <Field label="Họ và tên" required><Input autoComplete="name" value={editForm.full_name} onChange={(_, value) => setEditForm(cur => ({ ...cur, full_name: value.value }))} /></Field>
            <Field label="Tên đăng nhập" required><Input autoComplete="off" value={editForm.username} onChange={(_, value) => setEditForm(cur => ({ ...cur, username: value.value }))} /></Field>
            <Field label="Số điện thoại" required={editTarget?.role === 'parent'}><Input type="tel" autoComplete="tel" value={editForm.phone} onChange={(_, value) => setEditForm(cur => ({ ...cur, phone: value.value }))} /></Field>
            <Field label="Email"><Input type="email" autoComplete="email" value={editForm.email} onChange={(_, value) => setEditForm(cur => ({ ...cur, email: value.value }))} /></Field>
            {['teacher', 'student', 'parent'].includes(editTarget?.role) && (
              <Field label="Hồ sơ liên kết (Tùy chọn)" className="form-grid__wide">
                <Select value={editForm.linked_profile_id || ''} onChange={(e) => setEditForm(cur => ({ ...cur, linked_profile_id: e.target.value }))}>
                  <option value="">-- Không liên kết --</option>
                  {profiles.map(p => (
                    <option key={p[`${editTarget.role}_id`]} value={p[`${editTarget.role}_id`]}>
                      {p.full_name} {p[`${editTarget.role}_code`] ? `(${p[`${editTarget.role}_code`]})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </DialogContent>
          <DialogActions><Button type="button" appearance="secondary" disabled={editing} onClick={() => setEditTarget(null)}>Hủy</Button><Button appearance="primary" type="submit" disabled={editing || !editForm.full_name.trim() || !editForm.username.trim()}>{editing ? 'Đang lưu...' : 'Lưu thay đổi'}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>
    </div>
  );
}
