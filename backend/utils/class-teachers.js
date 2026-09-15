const pool = require('../config/db');

let schemaReadyPromise;
let schemaReady = false;

function normalizeTeacherIds(value) {
  if (value === undefined) return undefined;
  const source = Array.isArray(value) ? value : [value];
  const ids = source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return [...new Set(ids)];
}

async function runClassTeacherSchemaMigration(client) {
  await client.query('alter table classes alter column teacher_id drop not null');
  await client.query('alter table teachers add column if not exists is_deleted boolean not null default false');
  await client.query(
    `create table if not exists class_teachers (
       class_id bigint not null references classes(class_id) on delete cascade,
       teacher_id bigint not null references teachers(teacher_id) on delete cascade,
       primary key (class_id, teacher_id)
     )`,
  );
  await client.query(
    `create table if not exists class_schedule_teachers (
       schedule_id bigint not null references class_schedules(schedule_id) on delete cascade,
       teacher_id bigint not null references teachers(teacher_id) on delete cascade,
       primary key (schedule_id, teacher_id)
     )`,
  );
  await client.query('create index if not exists idx_class_teachers_teacher_id on class_teachers(teacher_id)');
  await client.query('create index if not exists idx_class_schedule_teachers_teacher_id on class_schedule_teachers(teacher_id)');
}

async function ensureClassTeacherSchema(client = pool) {
  if (schemaReady) return;
  if (client !== pool) {
    await runClassTeacherSchemaMigration(client);
    return;
  }
  if (!schemaReadyPromise) {
    schemaReadyPromise = runClassTeacherSchemaMigration(pool)
      .then(() => { schemaReady = true; })
      .catch((error) => {
        schemaReadyPromise = null;
        throw error;
      });
  }
  await schemaReadyPromise;
}

async function replaceClassTeachers(client, classId, teacherIds) {
  await client.query('delete from class_teachers where class_id = $1', [classId]);
  if (!teacherIds.length) return [];
  const placeholders = teacherIds.map((_, index) => `($1::bigint, $${index + 2}::bigint)`).join(', ');
  const result = await client.query(
    `insert into class_teachers (class_id, teacher_id)
     select input.class_id, input.teacher_id
     from (values ${placeholders}) as input(class_id, teacher_id)
     join teachers t on t.teacher_id = input.teacher_id and t.is_deleted = false
     on conflict do nothing
     returning teacher_id`,
    [classId, ...teacherIds],
  );
  return result.rows.map((row) => Number(row.teacher_id));
}

async function getClassTeacherIds(client, classId) {
  const result = await client.query(
    `select distinct teacher_id
     from (
       select ct.teacher_id
       from class_teachers ct
       join teachers t on t.teacher_id = ct.teacher_id and t.is_deleted = false
       where ct.class_id = $1
       union all
       select c.teacher_id
       from classes c
       join teachers t on t.teacher_id = c.teacher_id and t.is_deleted = false
       where c.class_id = $1 and c.teacher_id is not null
     ) teachers
     order by teacher_id`,
    [classId],
  );
  return result.rows.map((row) => Number(row.teacher_id));
}

async function decorateClassesWithTeachers(rows) {
  if (!rows.length) return rows;
  const classIds = rows.map((row) => row.class_id);
  const result = await pool.query(
    `select ct.class_id,
            array_agg(t.teacher_id order by t.full_name) as teacher_ids,
            jsonb_agg(jsonb_build_object('teacher_id', t.teacher_id, 'full_name', t.full_name) order by t.full_name) as teachers
     from class_teachers ct
     join teachers t on t.teacher_id = ct.teacher_id and t.is_deleted = false
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
  ensureClassTeacherSchema,
  replaceClassTeachers,
  getClassTeacherIds,
  decorateClassesWithTeachers,
};
