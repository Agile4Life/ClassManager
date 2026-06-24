import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Checkbox, Field, Input, MessageBar, MessageBarBody, Select, Textarea,
} from '@fluentui/react-components';
import { Add24Regular, Copy24Regular, Delete24Regular, Print24Regular } from '@fluentui/react-icons';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import {
  buildParentNotification, createNotificationLine, findStudentsWithoutSubmission,
  getStudentNames, NOTIFICATION_TEMPLATES,
} from '../utils/parent-notification';

const allowedRoles = ['admin', 'staff', 'teacher'];

export default function ParentNotificationPage() {
  const { user } = useAuth();
  const nextLineId = useRef(2);
  const [classId, setClassId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [context, setContext] = useState({ students: [], assignments: [] });
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [lines, setLines] = useState([{ id: 1, ...createNotificationLine() }]);
  const [finalText, setFinalText] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: classes, loading: classesLoading, error: classesError, refresh } = usePageData(
    () => api.get('/classes?limit=100').then((response) => response.data.items),
    [user.role],
  );

  useEffect(() => {
    if (!classId) {
      setContext({ students: [], assignments: [] });
      setAssignmentId('');
      setContextError('');
      return undefined;
    }
    let active = true;
    setContextLoading(true);
    setContextError('');
    setAssignmentId('');
    setSubmissions([]);
    Promise.all([
      api.get(`/classes/${classId}/students`),
      api.get(`/classes/${classId}/assignments`),
    ])
      .then(([studentsResponse, assignmentsResponse]) => {
        if (!active) return;
        setContext({
          students: studentsResponse.data.filter((student) => student.enrollment_status === 'studying'),
          assignments: assignmentsResponse.data,
        });
        setLines([{ id: nextLineId.current++, ...createNotificationLine() }]);
      })
      .catch((requestError) => active && setContextError(requestError.message))
      .finally(() => active && setContextLoading(false));
    return () => { active = false; };
  }, [classId]);

  useEffect(() => {
    if (!assignmentId) {
      setSubmissions([]);
      return undefined;
    }
    let active = true;
    setSubmissionsLoading(true);
    setContextError('');
    api.get(`/assignments/${assignmentId}/submissions`)
      .then((response) => active && setSubmissions(response.data))
      .catch((requestError) => active && setContextError(requestError.message))
      .finally(() => active && setSubmissionsLoading(false));
    return () => { active = false; };
  }, [assignmentId]);

  const missingStudentIds = useMemo(
    () => (assignmentId ? findStudentsWithoutSubmission(context.students, submissions) : []),
    [assignmentId, context.students, submissions],
  );
  const generatedText = useMemo(
    () => buildParentNotification(lines, context.students),
    [lines, context.students],
  );

  useEffect(() => {
    setFinalText(generatedText);
    setCopied(false);
  }, [generatedText]);

  if (!allowedRoles.includes(user.role)) return <Navigate to="/reports" replace />;

  function updateLine(id, changes) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...changes } : line)));
  }

  function changeTemplate(line, templateId) {
    const template = NOTIFICATION_TEMPLATES.find((item) => item.id === templateId);
    updateLine(line.id, {
      templateId,
      content: template.content,
      audience: template.audience || 'students',
    });
  }

  function addLine(templateId = 'custom', studentIds = []) {
    setLines((current) => [
      ...current,
      { id: nextLineId.current++, ...createNotificationLine(templateId), studentIds },
    ]);
  }

  function addMissingStudents() {
    const existing = lines.find((line) => line.templateId === 'homework_missing' && line.audience === 'students');
    if (existing) {
      updateLine(existing.id, { studentIds: [...new Set([...existing.studentIds, ...missingStudentIds])] });
    } else {
      addLine('homework_missing', missingStudentIds);
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

  async function copyNotification() {
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
  }

  return (
    <div className="page-flow parent-notification-page">
      <PageHeader
        title="Tạo thông báo phụ huynh"
        description="Chọn học sinh và mẫu nhận xét. Hệ thống tự ghép tên theo đúng giọng văn đã thống nhất."
      />

      {classesLoading && <LoadingState rows={3} />}
      {classesError && <ErrorState message={classesError} onRetry={refresh} />}
      {classes && (
        <section className="notification-context" aria-label="Chọn dữ liệu lớp học">
          <Field label="Lớp học" required>
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">Chọn lớp học</option>
              {classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_name} ({item.class_code})</option>)}
            </Select>
          </Field>
          <Field label="Bài tập cần kiểm tra" hint="Không bắt buộc">
            <Select value={assignmentId} disabled={!classId || contextLoading} onChange={(event) => setAssignmentId(event.target.value)}>
              <option value="">Không đối chiếu bài tập</option>
              {context.assignments.map((item) => <option key={item.assignment_id} value={item.assignment_id}>{item.title}</option>)}
            </Select>
          </Field>
          <div className="notification-context__count">
            <span>Sĩ số đang học</span>
            <strong>{context.students.length}</strong>
          </div>
        </section>
      )}

      {contextLoading && <LoadingState rows={4} />}
      {contextError && <ErrorState message={contextError} />}

      {classId && !contextLoading && !contextError && (
        <>
          {submissionsLoading && <LoadingState rows={2} />}
          {assignmentId && !submissionsLoading && (
            <MessageBar intent={missingStudentIds.length ? 'warning' : 'success'}>
              <MessageBarBody>
                {missingStudentIds.length ? (
                  <div className="missing-homework-message">
                    <span><strong>{getStudentNames(missingStudentIds, context.students)}</strong> chưa có bài nộp hoặc đang được đánh dấu thiếu bài.</span>
                    <Button size="small" onClick={addMissingStudents}>Thêm vào thông báo</Button>
                  </div>
                ) : 'Tất cả học sinh trong lớp đã có bài nộp.'}
              </MessageBarBody>
            </MessageBar>
          )}

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
                          <Select value={line.templateId} onChange={(event) => changeTemplate(line, event.target.value)}>
                            {NOTIFICATION_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
                          </Select>
                        </Field>
                        <Field label="Đối tượng">
                          <Select value={line.audience} onChange={(event) => updateLine(line.id, { audience: event.target.value })}>
                            <option value="students">Học sinh được chọn</option>
                            <option value="class">Cả lớp</option>
                          </Select>
                        </Field>
                        {line.audience === 'students' && (
                          <Field className="notification-line__wide" label="Học sinh" required>
                            <div className="student-picker" role="group" aria-label={`Chọn học sinh cho dòng ${index + 1}`}>
                              <div className="student-picker__toolbar">
                                <span>Đã chọn <strong>{line.studentIds.length}</strong>/{context.students.length}</span>
                                <div>
                                  <Button
                                    appearance="subtle"
                                    size="small"
                                    disabled={!context.students.length || line.studentIds.length === context.students.length}
                                    onClick={() => updateLine(line.id, { studentIds: context.students.map((student) => String(student.student_id)) })}
                                  >
                                    Chọn tất cả
                                  </Button>
                                  <Button
                                    appearance="subtle"
                                    size="small"
                                    disabled={!line.studentIds.length}
                                    onClick={() => updateLine(line.id, { studentIds: [] })}
                                  >
                                    Bỏ chọn
                                  </Button>
                                </div>
                              </div>
                              <div className="student-picker__list">
                                {context.students.map((student) => {
                                  const studentId = String(student.student_id);
                                  return (
                                    <Checkbox
                                      key={studentId}
                                      checked={selectedStudentIds.has(studentId)}
                                      label={student.full_name}
                                      onChange={(_, data) => toggleStudent(line.id, studentId, data.checked === true)}
                                    />
                                  );
                                })}
                                {!context.students.length && <span className="student-picker__empty">Lớp chưa có học sinh đang học.</span>}
                              </div>
                            </div>
                          </Field>
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
              <div className="notification-preview__actions">
                <Button appearance="primary" icon={<Copy24Regular />} disabled={!finalText.trim()} onClick={copyNotification}>Sao chép</Button>
                <Button icon={<Print24Regular />} disabled={!finalText.trim()} onClick={() => window.print()}>In thông báo</Button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
