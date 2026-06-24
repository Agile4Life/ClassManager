export const NOTIFICATION_OPENING = 'Em xin thông báo:';

export const NOTIFICATION_CLOSING = `Xin quý PH nhắc nhở các em học các phương pháp và làm BTVN đầy đủ trước khi đến lớp.
Em xin cảm ơn.`;

export const NOTIFICATION_TEMPLATES = [
  { id: 'homework_incomplete', label: 'Chưa hoàn thành đủ BTVN', content: 'chưa hoàn thành đủ BTVN' },
  { id: 'homework_missing', label: 'Không nộp BTVN', content: 'không nộp BTVN' },
  { id: 'homework_careless', label: 'Làm BTVN sơ sài', content: 'làm BTVN sơ sài (không được một nửa số bài)' },
  { id: 'correct_and_complete', label: 'Sửa và bổ sung bài thiếu', content: 'sửa bài, bổ sung bài thiếu' },
  { id: 'review_even_power', label: 'Xem lại tìm x lũy thừa mũ chẵn', content: 'sửa bài sai, xem lại tìm x lũy thừa mũ chẵn' },
  { id: 'review_hdt_expansion', label: 'Học lại khai triển HĐT 1,2,3', content: 'sửa bài sai, học lại khai triển HĐT 1,2,3' },
  { id: 'review_product_equation', label: 'Xem lại phương trình tích', content: 'sửa bài, xem lại phương trình tích' },
  { id: 'watch_signs', label: 'Chú ý sai dấu', content: 'sửa bài, chú ý sai dấu' },
  { id: 'not_memorized_three_questions', label: 'Không thuộc bài (3 câu)', content: 'không thuộc bài (3 câu)' },
  {
    id: 'not_know_triangle_centers',
    label: 'Không thuộc trọng tâm, trực tâm, dãy tỉ số',
    content: 'không thuộc trọng tâm, trực tâm, tính chất dãy tỉ số bằng nhau',
  },
  { id: 'review_hdt_simplification', label: 'Xem lại rút gọn HĐT', content: 'xem lại rút gọn HĐT' },
  {
    id: 'not_know_ratio_property',
    label: 'Không thuộc tính chất dãy tỉ số bằng nhau',
    content: 'không thuộc tính chất dãy tỉ số bằng nhau',
  },
  {
    id: 'not_master_triangle_lines_and_hdt',
    label: 'Chưa thuộc đường trong tam giác, vuông góc, HĐT',
    content: 'chưa thuộc các loại đường trong tam giác, chứng minh vuông góc, chưa thu gọn được HĐT 1,2,3',
  },
  { id: 'not_know_hdt', label: 'Không thuộc HĐT 1,2,3', content: 'không thuộc HĐT 1,2,3' },
  { id: 'not_know_triangle_lines', label: 'Chưa thuộc các loại đường', content: 'chưa thuộc các loại đường' },
  {
    id: 'not_know_triangle_lines_perpendicular',
    label: 'Chưa thuộc các loại đường, chứng minh vuông góc',
    content: 'chưa thuộc các loại đường, chứng minh vuông góc',
  },
  { id: 'not_memorized', label: 'Chưa thuộc nội dung...', content: 'chưa thuộc nội dung' },
  { id: 'not_know', label: 'Không thuộc nội dung...', content: 'không thuộc nội dung' },
  { id: 'review_topic', label: 'Xem lại nội dung...', content: 'xem lại nội dung' },
  { id: 'not_simplify_hdt', label: 'Chưa thu gọn được HĐT 1,2,3', content: 'chưa thu gọn được HĐT 1,2,3' },
  { id: 'whole_class_review', label: 'Cả lớp sửa bài, ôn lại HĐT', content: 'sửa bài, ôn lại hằng đẳng thức', audience: 'class' },
  { id: 'custom', label: 'Nhận xét khác', content: '' },
];

export function createNotificationLine(templateId = 'homework_incomplete') {
  const template = NOTIFICATION_TEMPLATES.find((item) => item.id === templateId) || NOTIFICATION_TEMPLATES[0];
  return {
    templateId: template.id,
    audience: template.audience || 'students',
    studentIds: [],
    studentNote: '',
    content: template.content,
  };
}

export function getStudentNames(studentIds, students) {
  const selected = new Set(studentIds.map(String));
  return students
    .filter((student) => selected.has(String(student.student_id)))
    .map((student) => student.full_name)
    .join(', ');
}

export function buildNotificationLine(line, students) {
  const subject = line.audience === 'class' ? 'Cả lớp' : getStudentNames(line.studentIds, students);
  const content = line.content.trim();
  if (!subject || !content) return '';
  const note = line.studentNote.trim();
  return `-${subject}${note ? ` (${note})` : ''} ${content}`;
}

export function buildParentNotification(lines, students, opening = NOTIFICATION_OPENING, closing = NOTIFICATION_CLOSING) {
  const body = lines.map((line) => buildNotificationLine(line, students)).filter(Boolean);
  return [opening.trim(), ...body, closing.trim()].filter(Boolean).join('\n');
}

export function findStudentsWithoutSubmission(students, submissions) {
  const submissionByStudent = new Map(
    submissions.map((submission) => [String(submission.student_id), submission]),
  );
  return students
    .filter((student) => {
      const submission = submissionByStudent.get(String(student.student_id));
      return !submission || ['not_submitted', 'missing'].includes(submission.status);
    })
    .map((student) => String(student.student_id));
}
