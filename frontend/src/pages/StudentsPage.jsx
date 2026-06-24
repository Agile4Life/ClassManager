import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow, Combobox, Option, Checkbox, TableSelectionCell
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Edit24Regular, Search24Regular } from '@fluentui/react-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { usePageData } from '../hooks/usePageData';
import { formatDate } from '../utils/format';
import { downloadStudentCsvTemplate, parseStudentCsv } from '../utils/student-csv';

const initialForm = {
  student_code: '', full_name: '', status: 'active', father_phone: '', mother_phone: '', student_phone: '', class_id: null,
};

function studentToForm(student) {
  return {
    ...initialForm,
    ...Object.fromEntries(Object.keys(initialForm).map((field) => [field, student[field] ?? ''])),
  };
}

export default function StudentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const canCreate = ['admin', 'staff', 'teacher'].includes(user.role);
  const canEdit = ['admin', 'staff', 'teacher'].includes(user.role);
  const canDelete = ['admin', 'staff'].includes(user.role);

  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const { data, loading, error, refresh } = usePageData(
    () => api.get(`/students?page=${page}&limit=10&search=${encodeURIComponent(search)}`).then((response) => response.data),
    [page, search],
  );

  const { data: classesData } = usePageData(
    () => api.get('/classes?limit=1000').then((response) => response.data),
    [],
  );
  const classes = classesData?.items || [];

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateDialog() {
    setEditingStudent(null);
    setForm(initialForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(student) {
    setEditingStudent(student);
    setForm(studentToForm(student));
    setFormError('');
    setDialogOpen(true);
  }

  function closeStudentDialog(force = false) {
    if (saving && !force) return;
    setDialogOpen(false);
    setEditingStudent(null);
    setForm(initialForm);
    setFormError('');
  }

  async function saveStudent(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = Object.fromEntries(
      Object.entries(form).map(([field, value]) => [field, value === '' ? null : value]),
    );
    if (!editingStudent) delete payload.student_code;
    try {
      if (editingStudent) await api.put(`/students/${editingStudent.student_id}`, payload);
      else await api.post('/students', payload);
      closeStudentDialog(true);
      if (!editingStudent) setPage(1);
      refresh();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function askToDelete(student) {
    setDeleteTarget(student);
    setDeleteError('');
  }

  async function deleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/students/${deleteTarget.student_id}`);
      setDeleteTarget(null);
      if (data.items.length === 1 && page > 1) setPage((current) => current - 1);
      else refresh();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  function toggleStudentSelection(studentId) {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) newSelected.delete(studentId);
    else newSelected.add(studentId);
    setSelectedStudentIds(newSelected);
  }

  function toggleAllSelection() {
    if (!data?.items.length) return;
    if (selectedStudentIds.size === data.items.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(data.items.map((s) => s.student_id)));
    }
  }

  async function applyBulkAssignClass() {
    if (selectedStudentIds.size === 0) return;
    setBulkSaving(true);
    setBulkError('');
    try {
      await api.post('/students/bulk-assign-class', {
        student_ids: Array.from(selectedStudentIds),
        class_id: bulkClassId || null
      });
      setSelectedStudentIds(new Set());
      setBulkClassId('');
      refresh();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSaving(false);
    }
  }

  function openImportDialog() {
    setImportFileName('');
    setImportRows([]);
    setImportErrors([]);
    setImportError('');
    setImportResult(null);
    setImportOpen(true);
  }

  function closeImportDialog(force = false) {
    if (importing && !force) return;
    setImportOpen(false);
    setImportFileName('');
    setImportRows([]);
    setImportErrors([]);
    setImportError('');
    setImportResult(null);
  }

  async function selectCsvFile(event) {
    const file = event.target.files?.[0];
    setImportFileName(file?.name || '');
    setImportRows([]);
    setImportErrors([]);
    setImportError('');
    setImportResult(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Vui lòng chọn đúng file có đuôi .csv.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setImportError('File CSV không được lớn hơn 1 MB.');
      return;
    }
    try {
      const parsed = parseStudentCsv(await file.text());
      if (parsed.rows.length > 1000) {
        setImportError('Mỗi lần chỉ được nhập tối đa 1000 học sinh.');
        return;
      }
      setImportRows(parsed.rows);
      setImportErrors(parsed.errors);
    } catch (parseError) {
      setImportError(parseError.message);
    }
  }

  async function importStudents() {
    if (!importRows.length || importErrors.length) return;
    setImporting(true);
    setImportError('');
    try {
      const response = await api.post('/students/import', { rows: importRows });
      setImportResult(response.data);
      setPage(1);
      refresh();
    } catch (requestError) {
      setImportError(requestError.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page-flow">
      <PageHeader
        title="Học sinh"
        description="Theo dõi hồ sơ và tình trạng học tập của từng bạn."
        action={canCreate && <div className="page-header-actions"><Button appearance="secondary" onClick={openImportDialog}>Nhập danh sách CSV</Button><Button appearance="primary" icon={<Add24Regular />} onClick={openCreateDialog}>Thêm học sinh</Button></div>}
      />
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <Input aria-label="Tìm học sinh" contentBefore={<Search24Regular />} placeholder="Tìm theo tên, mã hoặc số điện thoại" value={searchInput} onChange={(_, dataValue) => setSearchInput(dataValue.value)} />
        <Button type="submit" appearance="secondary">Tìm kiếm</Button>
      </form>

      {loading && <LoadingState rows={7} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && <EmptyState title="Chưa tìm thấy học sinh" description={canCreate ? 'Thử từ khóa khác hoặc thêm hồ sơ học sinh mới.' : 'Thử từ khóa khác hoặc kiểm tra lại danh sách lớp được phân công.'} />}
      {data?.items.length > 0 && (
        <div className="table-surface student-table">
          {selectedStudentIds.size > 0 && (
            <div className="bulk-actions toolbar" style={{ background: '#f5f5f5', padding: '8px 16px', borderRadius: '4px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <strong>Đã chọn {selectedStudentIds.size} học sinh</strong>
              <Select value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)} style={{ minWidth: 200 }}>
                <option value="">Không có lớp</option>
                {classes.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
              </Select>
              <Button appearance="primary" disabled={bulkSaving} onClick={applyBulkAssignClass}>
                {bulkSaving ? 'Đang áp dụng...' : 'Áp dụng'}
              </Button>
              {bulkError && <MessageBar intent="error"><MessageBarBody>{bulkError}</MessageBarBody></MessageBar>}
            </div>
          )}
          <Table aria-label="Danh sách học sinh">
            <TableHeader><TableRow>
              <TableSelectionCell checked={selectedStudentIds.size > 0 && selectedStudentIds.size === data.items.length} onChange={toggleAllSelection} />
              <TableHeaderCell>Học sinh</TableHeaderCell>
              <TableHeaderCell>Liên hệ</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              <TableHeaderCell>Lớp</TableHeaderCell>
              {(canEdit || canDelete) && <TableHeaderCell>Thao tác</TableHeaderCell>}
            </TableRow></TableHeader>
            <TableBody>{data.items.map((student) => (
              <TableRow key={student.student_id}>
                <TableSelectionCell checked={selectedStudentIds.has(student.student_id)} onChange={() => toggleStudentSelection(student.student_id)} />
                <TableCell><div className="primary-cell"><span className="initial-tile">{student.full_name.slice(0, 1)}</span><div><strong>{student.full_name}</strong><span>{student.student_code}</span></div></div></TableCell>
                <TableCell><div className="stacked-cell"><span>Số điện thoại ba: {student.father_phone || 'Chưa có'}</span><span>Số điện thoại mẹ: {student.mother_phone || 'Chưa có'}</span><span>Số điện thoại học sinh: {student.student_phone || 'Chưa có'}</span></div></TableCell>
                <TableCell><StatusBadge status={student.status} /></TableCell>
                <TableCell>{student.class_name || 'Không có lớp'}</TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="student-actions">
                      {canEdit && <Button appearance="subtle" size="small" icon={<Edit24Regular />} aria-label={`Sửa ${student.full_name}`} title="Chỉnh sửa" onClick={() => openEditDialog(student)} />}
                      {canDelete && <Button appearance="subtle" size="small" icon={<Delete24Regular />} aria-label={`Xóa ${student.full_name}`} title="Xóa học sinh" onClick={() => askToDelete(student)} />}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => { if (!details.open) closeStudentDialog(); }}>
        <DialogSurface className="student-dialog"><form onSubmit={saveStudent}><DialogBody>
          <DialogTitle>{editingStudent ? `Chỉnh sửa ${editingStudent.full_name}` : 'Thêm học sinh mới'}</DialogTitle>
          <DialogContent className="form-grid student-form">
            {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
            <Field label="Mã học sinh"><Input disabled={!editingStudent} value={editingStudent ? form.student_code : 'Tự động tạo khi lưu'} onChange={(_, dataValue) => updateField('student_code', dataValue.value)} /></Field>
            <Field label="Họ và tên" required><Input value={form.full_name} onChange={(_, dataValue) => updateField('full_name', dataValue.value)} /></Field>
            <Field label="Điện thoại ba"><Input value={form.father_phone} onChange={(_, dataValue) => updateField('father_phone', dataValue.value)} /></Field>
            <Field label="Điện thoại mẹ"><Input value={form.mother_phone} onChange={(_, dataValue) => updateField('mother_phone', dataValue.value)} /></Field>
            <Field label="Điện thoại học sinh"><Input value={form.student_phone} onChange={(_, dataValue) => updateField('student_phone', dataValue.value)} /></Field>
            <Field label="Lớp">
              <Select value={form.class_id || ''} onChange={(event) => updateField('class_id', event.target.value)}>
                <option value="">Không có lớp</option>
                {classes.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
              </Select>
            </Field>
            <Field label="Trạng thái"><Select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="paused">Tạm nghỉ</option><option value="graduated">Đã tốt nghiệp</option></Select></Field>
          </DialogContent>
          <DialogActions><Button type="button" appearance="secondary" disabled={saving} onClick={() => closeStudentDialog()}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || !form.full_name.trim() || (editingStudent && !form.student_code.trim())}>{saving ? 'Đang lưu...' : editingStudent ? 'Lưu thay đổi' : 'Lưu học sinh'}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, details) => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <DialogSurface><DialogBody>
          <DialogTitle>Xóa hồ sơ học sinh?</DialogTitle>
          <DialogContent>
            {deleteError && <MessageBar intent="error"><MessageBarBody>{deleteError}</MessageBarBody></MessageBar>}
            <p className="delete-confirmation">Hồ sơ của <strong>{deleteTarget?.full_name}</strong> và các dữ liệu liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.</p>
          </DialogContent>
          <DialogActions><Button appearance="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button><Button className="danger-button" appearance="primary" disabled={deleting} onClick={deleteStudent}>{deleting ? 'Đang xóa...' : 'Xóa học sinh'}</Button></DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(_, details) => { if (!details.open) closeImportDialog(); }}>
        <DialogSurface className="student-import-dialog"><DialogBody>
          <DialogTitle>Nhập danh sách học sinh từ CSV</DialogTitle>
          <DialogContent className="student-import-content">
            {importResult ? (
              <div className="student-import-success">
                <strong>Đã nhập thành công {importResult.imported_count} học sinh</strong>
                <p>Mã học sinh đã được hệ thống tự động tạo từ {importResult.items[0]?.student_code} đến {importResult.items.at(-1)?.student_code}.</p>
              </div>
            ) : (
              <>
                <section className="student-import-guide">
                  <div><strong>1. Tải file mẫu</strong><span>File chỉ gồm: họ tên, điện thoại ba, điện thoại mẹ và điện thoại học sinh.</span></div>
                  <Button appearance="secondary" onClick={downloadStudentCsvTemplate}>Tải file CSV mẫu</Button>
                </section>
                <Field label="2. Chọn file CSV" hint="Tối đa 1000 học sinh và dung lượng 1 MB">
                  <input className="student-csv-input" type="file" accept=".csv,text/csv" onChange={selectCsvFile} />
                </Field>
                {importFileName && <div className="student-import-file"><span>File đã chọn</span><strong>{importFileName}</strong></div>}
                {importError && <MessageBar intent="error"><MessageBarBody>{importError}</MessageBarBody></MessageBar>}
                {importErrors.length > 0 && <MessageBar intent="error"><MessageBarBody><strong>Cần sửa {importErrors.length} lỗi trước khi nhập:</strong><ul className="student-import-errors">{importErrors.slice(0, 8).map((message) => <li key={message}>{message}</li>)}</ul>{importErrors.length > 8 && <span>Và {importErrors.length - 8} lỗi khác.</span>}</MessageBarBody></MessageBar>}
                {importRows.length > 0 && !importErrors.length && (
                  <section className="student-import-preview">
                    <div className="student-import-preview__heading"><div><strong>3. Kiểm tra dữ liệu</strong><span>{importRows.length} học sinh sẵn sàng được nhập</span></div><span>Hiển thị {Math.min(importRows.length, 8)} dòng đầu</span></div>
                    <div className="table-surface"><Table aria-label="Xem trước danh sách CSV"><TableHeader><TableRow><TableHeaderCell>Họ và tên</TableHeaderCell><TableHeaderCell>Điện thoại ba</TableHeaderCell><TableHeaderCell>Điện thoại mẹ</TableHeaderCell><TableHeaderCell>Điện thoại học sinh</TableHeaderCell></TableRow></TableHeader><TableBody>{importRows.slice(0, 8).map((row, index) => <TableRow key={`${row.full_name}-${index}`}><TableCell><strong>{row.full_name}</strong></TableCell><TableCell>{row.father_phone || 'Chưa có'}</TableCell><TableCell>{row.mother_phone || 'Chưa có'}</TableCell><TableCell>{row.student_phone || 'Chưa có'}</TableCell></TableRow>)}</TableBody></Table></div>
                  </section>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>{importResult ? <Button appearance="primary" onClick={() => closeImportDialog()}>Hoàn tất</Button> : <><Button appearance="secondary" disabled={importing} onClick={() => closeImportDialog()}>Hủy</Button><Button appearance="primary" disabled={importing || !importRows.length || Boolean(importErrors.length)} onClick={importStudents}>{importing ? 'Đang nhập...' : `Nhập ${importRows.length || 0} học sinh`}</Button></>}</DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </div>
  );
}
