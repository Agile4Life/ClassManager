import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow,
} from '../components/bootstrap-ui';
import { Add24Regular, Delete24Regular, Edit24Regular, Search24Regular } from '../components/bootstrap-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { usePageData } from '../hooks/usePageData';

const initialForm = {
  room_name: '',
  capacity: 30,
  location: '',
  status: 'available',
};

function roomToForm(room) {
  return {
    room_name: room.room_name ?? '',
    capacity: room.capacity ?? 30,
    location: room.location ?? '',
    status: room.status ?? 'available',
  };
}

export default function RoomsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const canManage = user.role === 'admin';

  const { data, loading, error, refresh } = usePageData(
    () => api.get(`/rooms?page=${page}&limit=10&search=${encodeURIComponent(search)}`).then((res) => res.data),
    [page, search],
  );

  if (!canManage) {
    return (
      <div className="page-flow">
        <PageHeader title="Quản lý Phòng học" description="Khu vực dành riêng cho Quản trị viên." />
        <ErrorState
          title="Không có quyền truy cập"
          message="Chức năng thêm, sửa và xóa phòng học trên hệ thống chỉ dành cho Quản trị viên (Admin)."
        />
      </div>
    );
  }

  function updateField(field, value) {
    setForm((curr) => ({ ...curr, [field]: value }));
  }

  function openCreateDialog() {
    setEditingRoom(null);
    setForm(initialForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(room) {
    setEditingRoom(room);
    setForm(roomToForm(room));
    setFormError('');
    setDialogOpen(true);
  }

  function closeDialog(force = false) {
    if (saving && !force) return;
    setDialogOpen(false);
    setEditingRoom(null);
    setFormError('');
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!form.room_name.trim()) {
      setFormError('Vui lòng nhập tên phòng học.');
      return;
    }
    const cap = Number(form.capacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      setFormError('Sức chứa phòng học phải là số nguyên dương.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        room_name: form.room_name.trim(),
        capacity: cap,
        location: form.location.trim(),
        status: form.status,
      };

      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.room_id}`, payload);
      } else {
        await api.post('/rooms', payload);
      }
      closeDialog(true);
      refresh();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Lưu thông tin phòng học thất bại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/rooms/${deleteTarget.room_id}`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Xóa phòng học thất bại.');
    } finally {
      setDeleting(false);
    }
  }

  const items = data?.items || [];
  const total = data?.pagination?.total || 0;

  return (
    <div className="page-flow">
      <PageHeader
        title="Quản lý Phòng học"
        description="Thiết lập danh sách phòng học, cơ sở và sức chứa tối đa của trung tâm."
        action={(
          <Button appearance="primary" icon={<Add24Regular />} onClick={openCreateDialog}>
            Thêm phòng học
          </Button>
        )}
      />

      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <Input
          aria-label="Tìm phòng học"
          contentBefore={<Search24Regular />}
          placeholder="Tìm theo tên phòng hoặc vị trí..."
          value={searchInput}
          onChange={(_, dataValue) => setSearchInput(dataValue ? dataValue.value : _)}
        />
        <Button type="submit" appearance="secondary">Tìm kiếm</Button>
      </form>

      {loading && <LoadingState rows={6} />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Chưa có phòng học nào"
          description="Thử tìm kiếm từ khóa khác hoặc bấm nút Thêm phòng học ở góc trên để tạo phòng đầu tiên."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="table-surface student-table">
            <Table aria-label="Danh sách phòng học">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Tên phòng</TableHeaderCell>
                  <TableHeaderCell>Sức chứa</TableHeaderCell>
                  <TableHeaderCell>Khu vực / Vị trí</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Thao tác</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((room) => (
                  <TableRow key={room.room_id}>
                    <TableCell>
                      <strong>{room.room_name}</strong>
                    </TableCell>
                    <TableCell>{room.capacity} học sinh</TableCell>
                    <TableCell>{room.location || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={room.status} />
                    </TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          appearance="subtle"
                          icon={<Edit24Regular />}
                          aria-label={`Sửa ${room.room_name}`}
                          onClick={() => openEditDialog(room)}
                        />
                        <Button
                          appearance="subtle"
                          icon={<Delete24Regular />}
                          aria-label={`Xóa ${room.room_name}`}
                          onClick={() => setDeleteTarget(room)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination page={page} total={total} limit={10} onChange={setPage} />
        </>
      )}

      {/* Dialog Create / Edit */}
      {dialogOpen && (
        <Dialog open={dialogOpen} onOpenChange={(_, d) => !d.open && closeDialog()}>
          <DialogSurface>
            <form onSubmit={handleSave}>
              <DialogBody>
                <DialogTitle>{editingRoom ? 'Chỉnh sửa phòng học' : 'Thêm phòng học mới'}</DialogTitle>
                <DialogContent className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                  {formError && (
                    <MessageBar intent="error">
                      <MessageBarBody>{formError}</MessageBarBody>
                    </MessageBar>
                  )}

                  <Field label="Tên phòng học" required>
                    <Input
                      placeholder="VD: Phòng 101 - Cơ sở chính"
                      value={form.room_name}
                      onChange={(e) => updateField('room_name', e.target.value)}
                    />
                  </Field>

                  <Field label="Sức chứa tối đa (Học sinh)" required>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={form.capacity}
                      onChange={(e) => updateField('capacity', e.target.value)}
                    />
                  </Field>

                  <Field label="Vị trí / Tầng / Cơ sở">
                    <Input
                      placeholder="VD: Tầng 2, Tòa nhà A"
                      value={form.location}
                      onChange={(e) => updateField('location', e.target.value)}
                    />
                  </Field>

                  <Field label="Trạng thái hoạt động">
                    <Select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                      <option value="available">Sẵn sàng sử dụng</option>
                      <option value="maintenance">Đang bảo trì</option>
                      <option value="inactive">Tạm dừng hoạt động</option>
                    </Select>
                  </Field>
                </DialogContent>
                <DialogActions style={{ marginTop: '20px' }}>
                  <Button type="button" appearance="secondary" onClick={() => closeDialog()} disabled={saving}>
                    Hủy
                  </Button>
                  <Button type="submit" appearance="primary" disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu thông tin'}
                  </Button>
                </DialogActions>
              </DialogBody>
            </form>
          </DialogSurface>
        </Dialog>
      )}

      {/* Dialog Confirm Delete */}
      {deleteTarget && (
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, d) => !d.open && !deleting && setDeleteTarget(null)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Xóa phòng học</DialogTitle>
              <DialogContent style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deleteError && (
                  <MessageBar intent="error">
                    <MessageBarBody>{deleteError}</MessageBarBody>
                  </MessageBar>
                )}
                <p>
                  Bạn có chắc chắn muốn xóa phòng học <strong>{deleteTarget.room_name}</strong> không?
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Hệ thống sử dụng cơ chế xóa mềm (Soft Delete), phòng học này sẽ được ẩn khỏi danh sách nhưng không làm ảnh hưởng đến lịch sử các lớp học cũ từng sử dụng phòng này.
                </p>
              </DialogContent>
              <DialogActions style={{ marginTop: '20px' }}>
                <Button type="button" appearance="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Hủy
                </Button>
                <Button type="button" appearance="primary" style={{ backgroundColor: 'var(--danger, #dc2626)', color: '#fff' }} onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Đang xóa...' : 'Xóa phòng học'}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
