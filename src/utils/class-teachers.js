function normalizeTeacherIds(value) {
  if (value === undefined) return undefined;
  const source = Array.isArray(value) ? value : [value];
  const ids = source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return [...new Set(ids)];
}

async function replaceClassTeachers(client, classId, teacherIds) {
  await client.query('delete from class_teachers where class_id = $1', [classId]);
  if (!teacherIds.length) return;
  const placeholders = teacherIds.map((_, index) => `($1, $${index + 2})`).join(', ');
  await client.query(
    `insert into class_teachers (class_id, teacher_id) values ${placeholders} on conflict do nothing`,
    [classId, ...teacherIds],
  );
}

async function getClassTeacherIds(client, classId) {
  const result = await client.query(
    `select distinct teacher_id
     from (
       select teacher_id from class_teachers where class_id = $1
       union all
       select teacher_id from classes where class_id = $1 and teacher_id is not null
     ) teachers
     order by teacher_id`,
    [classId],
  );
  return result.rows.map((row) => Number(row.teacher_id));
}

async function decorateClassesWithTeachers(rows) {
  if (!rows.length) return rows;
  const classIds = rows.map((row) => row.class_id);
  const result = await require('../config/db').query(
    `select ct.class_id,
            array_agg(t.teacher_id order by t.full_name) as teacher_ids,
            jsonb_agg(jsonb_build_object('teacher_id', t.teacher_id, 'full_name', t.full_name) order by t.full_name) as teachers
     from class_teachers ct
     join teachers t on t.teacher_id = ct.teacher_id
     where ct.class_id = any($1::bigint[])
     group by ct.class_id`,
    [classIds],
  );
  const byClass = new Map(result.rows.map((row) => [String(row.class_id), row]));
  return rows.map((row) => {
    const linked = byClass.get(String(row.class_id));
    if (!linked) {
      return {
        ...row,
        teacher_ids: row.teacher_id ? [row.teacher_id] : [],
        teachers: [],
      };
    }
    return {
      ...row,
      teacher_ids: linked.teacher_ids || [],
      teachers: linked.teachers || [],
    };
  });
}

module.exports = {
  normalizeTeacherIds,
  replaceClassTeachers,
  getClassTeacherIds,
  decorateClassesWithTeachers,
};
