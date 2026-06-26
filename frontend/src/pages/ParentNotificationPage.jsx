import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Textarea,
} from '../components/bootstrap-ui';
import {
  Add24Regular, Copy24Regular, Delete24Regular, Print24Regular, Search24Regular,
} from '../components/bootstrap-icons';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import {
  buildParentNotification, createNotificationLine,
  NOTIFICATION_TEMPLATES,
} from '../utils/parent-notification';

const allowedRoles = ['admin', 'staff', 'teacher'];
const CREATE_TEMPLATE_OPTION = '__create_notification_template__';
const initialTemplateForm = { content: '', audience: 'students' };

function getTemplateDisplayLabel(template) {
  const label = String(template.label || '').trim();
  if (label) return label;
  const content = String(template.content || '').trim().replace(/\s+/g, ' ');
  return content.length > 60 ? `${content.slice(0, 57)}...` : content;
}

function normalizeSavedTemplate(template) {
  return {
    id: `saved_template_${template.template_id}`,
    classId: template.class_id ? String(template.class_id) : '',
    label: getTemplateDisplayLabel(template),
    content: template.content,
    audience: template.audience || 'students',
    savedTemplateId: template.template_id,
  };
}

function normalizeSearchText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function compactStudentName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return parts.slice(-2).join(' ');
}

function duplicateStudentName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts.at(-1)}`;
}

function StudentPicker({ students, displayNames, selectedStudentIds, onToggle, onSelectAll, onClear, labelledBy }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearchText(query);
  const visibleStudents = useMemo(
    () => students.filter((student) => normalizeSearchText(student.full_name).includes(normalizedQuery)),
    [normalizedQuery, students],
  );

  return (
    <div className="student-picker" role="group" aria-labelledby={labelledBy}>
      <div className="student-picker__toolbar">
        <div className="student-picker__summary" aria-live="polite">
          <span>Đã chọn</span>
          <strong>{selectedStudentIds.size}</strong>
          <span>/ {students.length} học sinh</span>
        </div>
        <div className="student-picker__actions">
          <Button
            appearance="subtle"
            size="small"
            disabled={!students.length || selectedStudentIds.size === students.length}
            onClick={onSelectAll}
          >
            Chọn tất cả
          </Button>
          <Button appearance="subtle" size="small" disabled={!selectedStudentIds.size} onClick={onClear}>
            Bỏ chọn
          </Button>
        </div>
      </div>

      <div className="student-picker__search">
        <Input
          type="search"
          value={query}
          contentBefore={<Search24Regular />}
          aria-label="Tìm học sinh theo tên"
          placeholder="Tìm theo tên học sinh..."
          onChange={(_, data) => setQuery(data.value)}
        />
        {query && <span className="student-picker__result-count">{visibleStudents.length} kết quả</span>}
      </div>

      <div className="student-picker__list">
        {visibleStudents.map((student) => {
          const studentId = String(student.student_id);
          const checked = selectedStudentIds.has(studentId);
          return (
            <Checkbox
              className={checked ? 'student-picker__option student-picker__option--selected' : 'student-picker__option'}
              key={studentId}
              checked={checked}
              label={displayNames.get(studentId) || student.full_name}
              onChange={(_, data) => onToggle(studentId, data.checked === true)}
            />
          );
        })}
        {!students.length && <span className="student-picker__empty">Lớp chưa có học sinh đang học.</span>}
        {!!students.length && !visibleStudents.length && (
          <span className="student-picker__empty">Không tìm thấy học sinh phù hợp.</span>
        )}
      </div>
    </div>
  );
}

export default function ParentNotificationPage() {
  const { user } = useAuth();
  const nextLineId = useRef(2);
  const [classId, setClassId] = useState('');
  const [context, setContext] = useState({ students: [] });
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const [lines, setLines] = useState([{ id: 1, ...createNotificationLine() }]);
  const [finalText, setFinalText] = useState('');
  const [copied, setCopied] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [historyMessage, setHistoryMessage] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateTargetLineId, setTemplateTargetLineId] = useState(null);
  const [templateForm, setTemplateForm] = useState(initialTemplateForm);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [createdTemplates, setCreatedTemplates] = useState([]);
  const lastSavedSignature = useRef('');

  const { data: classes, loading: classesLoading, error: classesError, refresh } = usePageData(
    () => api.get('/classes?limit=100').then((response) => response.data.items),
    [user.role],
  );
  const {
    data: savedTemplates,
    loading: templatesLoading,
    error: templatesError,
    refresh: refreshTemplates,
  } = usePageData(
    () => {
      if (!classId) return Promise.resolve([]);
      return api.get(`/learning-history/notification-templates?class_id=${classId}`).then((response) => response.data.map(normalizeSavedTemplate));
    },
    [user.role, classId],
  );

  const notificationTemplates = useMemo(() => {
    const customTemplate = NOTIFICATION_TEMPLATES.find((item) => item.id === 'custom');
    const savedById = new Map([...createdTemplates, ...(savedTemplates || [])].map((template) => [template.id, template]));
    return [
      ...savedById.values(),
      customTemplate,
    ].filter(Boolean);
  }, [createdTemplates, savedTemplates]);

  useEffect(() => {
    setCreatedTemplates([]);
    if (!classId) {
      setContext({ students: [] });
      setContextError('');
      return undefined;
    }
    let active = true;
    setContextLoading(true);
    setContextError('');
    api.get(`/classes/${classId}/students`)
      .then((studentsResponse) => {
        if (!active) return;
        setContext({
          students: studentsResponse.data.filter((student) => 
            student.enrollment_status === 'studying' && 
            student.is_deleted !== true && 
            student.status !== 'inactive'
          ),
        });
        setLines([{ id: nextLineId.current++, ...createNotificationLine() }]);
      })
      .catch((requestError) => active && setContextError(requestError.message))
      .finally(() => active && setContextLoading(false));
    return () => { active = false; };
  }, [classId]);

  const displayNames = useMemo(() => {
    const compactCounts = context.students.reduce((counts, student) => {
      const name = compactStudentName(student.full_name);
      counts.set(name, (counts.get(name) || 0) + 1);
      return counts;
    }, new Map());
    return new Map(context.students.map((student) => {
      const compactName = compactStudentName(student.full_name);
      return [
        String(student.student_id),
        compactCounts.get(compactName) > 1 ? duplicateStudentName(student.full_name) : compactName,
      ];
    }));
  }, [context.students]);

  const generatedText = useMemo(
    () => buildParentNotification(lines, context.students, displayNames),
    [lines, context.students, displayNames],
  );

  useEffect(() => {
    setFinalText(generatedText);
    setCopied(false);
  }, [generatedText]);

  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  function updateLine(id, changes) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...changes } : line)));
  }

  function createLineFromTemplate(templateId = 'custom') {
    const template = notificationTemplates.find((item) => item.id === templateId)
      || NOTIFICATION_TEMPLATES.find((item) => item.id === templateId)
      || NOTIFICATION_TEMPLATES.find((item) => item.id === 'custom')
      || NOTIFICATION_TEMPLATES[0];
    return {
      templateId: template.id,
      audience: template.audience || 'students',
      studentIds: [],
      studentNote: '',
      content: template.content,
    };
  }

  function openTemplateDialog(lineId = null) {
    setTemplateTargetLineId(lineId);
    setTemplateForm(initialTemplateForm);
    setTemplateError('');
    setTemplateDialogOpen(true);
  }

  function closeTemplateDialog() {
    if (templateSaving) return;
    setTemplateDialogOpen(false);
    setTemplateTargetLineId(null);
    setTemplateForm(initialTemplateForm);
    setTemplateError('');
  }

  function changeTemplate(line, templateId) {
    if (templateId === CREATE_TEMPLATE_OPTION) {
      openTemplateDialog(line.id);
      return;
    }
    const template = notificationTemplates.find((item) => item.id === templateId);
    if (!template) return;
    updateLine(line.id, {
      templateId,
      content: template.content,
      audience: template.audience || 'students',
    });
  }

  function addLine(templateId = 'custom', studentIds = []) {
    setLines((current) => [
      ...current,
      { id: nextLineId.current++, ...createLineFromTemplate(templateId), studentIds },
    ]);
  }

  async function saveTemplate(event) {
    event.preventDefault();
    const content = templateForm.content.trim();
    if (!classId) {
      setTemplateError('Vui lòng chọn lớp trước khi tạo mẫu nhận xét.');
      return;
    }
    if (!content) {
      setTemplateError('Vui lòng nhập nội dung mẫu.');
      return;
    }
    setTemplateSaving(true);
    setTemplateError('');
    try {
      const response = await api.post('/learning-history/notification-templates', {
        class_id: Number(classId),
        content,
        audience: templateForm.audience,
      });
      const savedTemplate = normalizeSavedTemplate(response.data);
      setCreatedTemplates((current) => [savedTemplate, ...current.filter((item) => item.id !== savedTemplate.id)]);
      if (templateTargetLineId) {
        updateLine(templateTargetLineId, {
          templateId: savedTemplate.id,
          content: savedTemplate.content,
          audience: savedTemplate.audience,
        });
      }
      refreshTemplates();
      setTemplateDialogOpen(false);
      setTemplateTargetLineId(null);
      setTemplateForm(initialTemplateForm);
      setTemplateError('');
    } catch (error) {
      setTemplateError(error.message || 'Không thể lưu mẫu nhận xét.');
    } finally {
      setTemplateSaving(false);
    }
  }

  function toggleStudent(lineId, studentId, checked) {
    setLines((current) => current.map((line) => {
      if (line.id !== lineId) return line;
      const selected = new Set(line.studentIds.map(String));
      if (checked) selected.add(String(studentId));
      else selected.delete(String(studentId));
      return { ...line, studentIds: [...selected] };
    }));
  }

  function getHistoryObservations() {
    return lines
      .filter((line) => line.audience === 'students' && line.studentIds.length && line.content.trim())
      .map((line) => ({
        template_id: line.templateId,
        category_label: notificationTemplates.find((item) => item.id === line.templateId)?.label || 'Nhận xét khác',
        detail: line.content.trim(),
        student_note: line.studentNote.trim() || null,
        student_ids: line.studentIds,
      }));
  }

  async function persistHistory() {
    const observations = getHistoryObservations();
    if (!observations.length) return { skipped: true };
    const signature = JSON.stringify({ classId, observations, finalText });
    if (signature === lastSavedSignature.current) return { alreadySaved: true };
    const response = await api.post('/learning-history/events', {
      class_id: Number(classId),
      notification_text: finalText,
      observations,
    });
    lastSavedSignature.current = signature;
    return response.data;
  }

  async function copyNotification() {
    setSavingHistory(true);
    setHistoryError('');
    setHistoryMessage('');
    try {
      const saved = await persistHistory();
      try {
        await navigator.clipboard.writeText(finalText);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = finalText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      if (!saved.skipped) {
        setHistoryMessage('Đã lưu các mục được đánh dấu vào quá trình học tập.');
      }
    } catch (error) {
      setHistoryError(error.message || 'Không thể lưu quá trình học tập.');
    } finally {
      setSavingHistory(false);
    }
  }

  async function printNotification() {
    setSavingHistory(true);
    setHistoryError('');
    setHistoryMessage('');
    try {
      const saved = await persistHistory();
      if (!saved.skipped) setHistoryMessage('Đã lưu các mục được đánh dấu vào quá trình học tập.');
      window.print();
    } catch (error) {
      setHistoryError(error.message || 'Không thể lưu quá trình học tập.');
    } finally {
      setSavingHistory(false);
    }
  }

  return (
    <div className="page-flow parent-notification-page">
      <PageHeader
        title="Tạo thông báo phụ huynh"
        description="Chọn học sinh và mẫu nhận xét. Hệ thống tự ghép tên theo đúng giọng văn đã thống nhất."
      />

      {classesLoading && <LoadingState rows={3} />}
      {classesError && <ErrorState message={classesError} onRetry={refresh} />}
      {templatesError && <ErrorState message={templatesError} onRetry={refreshTemplates} />}
      {classes && (
        <section className="notification-context" aria-label="Chọn dữ liệu lớp học">
          <Field label="Lớp học" required>
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">Chọn lớp học</option>
              {classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_name} ({item.class_code})</option>)}
            </Select>
          </Field>

          <div className="notification-context__count" role="status" aria-live="polite">
            <span>Sĩ số đang học</span>
            <div><strong>{context.students.length}</strong><small>học sinh</small></div>
          </div>
        </section>
      )}

      {contextLoading && <LoadingState rows={4} />}
      {contextError && <ErrorState message={contextError} />}

      {classId && !contextLoading && !contextError && (
        <>
          <div className="notification-workspace">
            <section className="notification-editor" aria-labelledby="notification-lines-title">
              <div className="notification-section-heading">
                <div><h2 id="notification-lines-title">Các dòng nhận xét</h2><p>Mỗi dòng có thể chọn nhiều học sinh. Học sinh cùng nhận xét sẽ được tự động gom tên.</p></div>
                <Button icon={<Add24Regular />} onClick={() => addLine()}>Thêm dòng</Button>
              </div>

              <div className="notification-lines">
                {lines.map((line, index) => {
                  const selectedStudentIds = new Set(line.studentIds.map(String));
                  return (
                    <article className="notification-line" key={line.id}>
                      <div className="notification-line__heading">
                        <strong>Dòng {index + 1}</strong>
                        <Button
                          appearance="subtle"
                          icon={<Delete24Regular />}
                          aria-label={`Xóa dòng ${index + 1}`}
                          disabled={lines.length === 1}
                          onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                        />
                      </div>
                      <div className="notification-line__grid">
                        <Field label="Mẫu nhận xét">
                          <Select value={line.templateId} disabled={templatesLoading} onChange={(event) => changeTemplate(line, event.target.value)}>
                            {notificationTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
                            <option value={CREATE_TEMPLATE_OPTION}>+ Tạo nhận xét mẫu mới...</option>
                          </Select>
                        </Field>
                        <Field label="Đối tượng">
                          <Select value={line.audience} onChange={(event) => updateLine(line.id, { audience: event.target.value })}>
                            <option value="students">Học sinh được chọn</option>
                            <option value="class">Cả lớp</option>
                          </Select>
                        </Field>
                        {line.audience === 'students' && (
                          <div className="form-field notification-line__wide">
                            <span className="form-label" id={`student-picker-label-${line.id}`}>
                              Học sinh<span className="required-mark" aria-hidden="true">*</span>
                            </span>
                            <StudentPicker
                              students={context.students}
                              displayNames={displayNames}
                              selectedStudentIds={selectedStudentIds}
                              labelledBy={`student-picker-label-${line.id}`}
                              onToggle={(studentId, checked) => toggleStudent(line.id, studentId, checked)}
                              onSelectAll={() => updateLine(line.id, { studentIds: context.students.map((student) => String(student.student_id)) })}
                              onClear={() => updateLine(line.id, { studentIds: [] })}
                            />
                          </div>
                        )}
                        <Field label="Ghi chú sau tên" hint="Ví dụ: quên tập">
                          <Input value={line.studentNote} onChange={(_, data) => updateLine(line.id, { studentNote: data.value })} />
                        </Field>
                        <Field className={line.audience === 'class' ? '' : 'notification-line__wide'} label="Nội dung sau tên" required>
                          <Textarea resize="vertical" value={line.content} onChange={(_, data) => updateLine(line.id, { content: data.value })} />
                        </Field>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="notification-preview" aria-labelledby="notification-preview-title">
              <div className="notification-section-heading">
                <div><h2 id="notification-preview-title">Bản xem trước</h2><p>Có thể sửa trực tiếp trước khi sao chép.</p></div>
              </div>
              <Textarea
                className="notification-preview__text"
                aria-label="Nội dung thông báo hoàn chỉnh"
                resize="vertical"
                value={finalText}
                onChange={(_, data) => { setFinalText(data.value); setCopied(false); }}
              />
              <pre className="notification-preview__print">{finalText}</pre>
              {copied && <MessageBar intent="success"><MessageBarBody>Đã sao chép thông báo.</MessageBarBody></MessageBar>}
              {historyMessage && <MessageBar intent="success"><MessageBarBody>{historyMessage}</MessageBarBody></MessageBar>}
              {historyError && <MessageBar intent="error"><MessageBarBody>{historyError}</MessageBarBody></MessageBar>}
              <p className="notification-history-hint">Khi nhấn lưu và sao chép, các học sinh được chọn sẽ tự động được ghi vào Quá trình học tập.</p>
              <div className="notification-preview__actions">
                <Button appearance="primary" icon={<Copy24Regular />} disabled={savingHistory || !finalText.trim()} onClick={copyNotification}>{savingHistory ? 'Đang lưu...' : 'Lưu và sao chép'}</Button>
              </div>
            </aside>
          </div>
        </>
      )}

      <Dialog open={templateDialogOpen} onOpenChange={(_, details) => { if (!details.open) closeTemplateDialog(); }}>
        <DialogSurface>
          <form onSubmit={saveTemplate}>
            <DialogBody>
              <DialogTitle>Tạo nhận xét mẫu mới</DialogTitle>
              <DialogContent className="notification-template-form">
                {templateError && <MessageBar intent="error"><MessageBarBody>{templateError}</MessageBarBody></MessageBar>}
                <Field label="Đối tượng mặc định">
                  <Select value={templateForm.audience} onChange={(event) => setTemplateForm((current) => ({ ...current, audience: event.target.value }))}>
                    <option value="students">Học sinh được chọn</option>
                    <option value="class">Cả lớp</option>
                  </Select>
                </Field>
                <Field label="Nội dung mẫu" required>
                  <Textarea
                    resize="vertical"
                    value={templateForm.content}
                    placeholder="Nhập phần nội dung sẽ đứng sau tên học sinh"
                    onChange={(_, data) => setTemplateForm((current) => ({ ...current, content: data.value }))}
                  />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" disabled={templateSaving} onClick={closeTemplateDialog}>Hủy</Button>
                <Button appearance="primary" type="submit" disabled={templateSaving || !templateForm.content.trim()}>
                  {templateSaving ? 'Đang lưu...' : 'Lưu mẫu'}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
