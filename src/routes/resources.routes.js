const express = require('express');
const createCrudController = require('../controllers/crud.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const { AppError } = require('../utils/errors');
const {
  decorateClassesWithTeachers,
  normalizeTeacherIds,
  replaceClassTeachers,
} = require('../utils/class-teachers');

const managers = ['admin', 'staff'];

function validateClass(body, mode) {
  if (mode === 'create' && body.max_students === undefined) body.max_students = 40;
  if (body.max_students !== undefined
      && (!Number.isInteger(Number(body.max_students)) || Number(body.max_students) <= 0)) {
    throw new AppError(400, 'max_students must be a positive integer');
  }
  if (body.tuition_fee !== undefined
      && (!Number.isFinite(Number(body.tuition_fee)) || Number(body.tuition_fee) < 0)) {
    throw new AppError(400, 'tuition_fee must be a non-negative number');
  }
}

function scopeStudents(req, values, conditions) {
}

function scopeClasses(req, values, conditions) {
  if (req.user.role === 'teacher') {
    values.push(req.user.teacher_id);
    conditions.push(`(teacher_id = $${values.length} or class_id in (
      select class_id from class_teachers where teacher_id = $${values.length}
    ))`);
  } else if (req.user.role === 'student') {
    values.push(req.user.student_id);
    conditions.push(`class_id in (select class_id from enrollments where student_id = $${values.length})`);
  } else if (req.user.role === 'parent') {
    values.push(req.user.parent_id);
    conditions.push(`class_id in (
      select e.class_id from enrollments e join student_parents sp on sp.student_id = e.student_id
      where sp.parent_id = $${values.length}
    )`);
  }
}

function hideCancelledClasses(req, values, conditions) {
  conditions.push("status <> 'cancelled'");
}

function hideDeletedTeachers(req, values, conditions) {
  conditions.push('is_deleted = false');
}

const resources = {
  parents: {
    table: 'parents', primaryKey: 'parent_id',
    columns: ['full_name', 'phone', 'email', 'address', 'occupation'],
    required: ['full_name', 'phone'], searchColumns: ['full_name', 'phone', 'email'],
    readRoles: managers, writeRoles: managers,
    afterUpdate: async (client, row) => {
      await client.query('update user_accounts set full_name = $1, phone = $2, email = $3 where parent_id = $4', [row.full_name, row.phone, row.email, row.parent_id]);
    },
  },
  teachers: {
    table: 'teachers', primaryKey: 'teacher_id',
    columns: ['teacher_code', 'full_name', 'phone', 'email', 'address', 'specialization', 'hourly_rate', 'status', 'note'],
    required: ['teacher_code', 'full_name'], searchColumns: ['teacher_code', 'full_name', 'email'], filterColumns: ['status'],
    autoCode: { column: 'teacher_code', prefix: 'T', digits: 3 },
    readRoles: ['admin', 'staff', 'teacher', 'student', 'parent'], writeRoles: managers,
    defaultScope: hideDeletedTeachers,
    softDelete: { column: 'is_deleted', value: true },
    afterUpdate: async (client, row) => {
      await client.query('update user_accounts set full_name = $1, phone = $2, email = $3 where teacher_id = $4', [row.full_name, row.phone, row.email, row.teacher_id]);
    },
    afterSoftDelete: async (client, row) => {
      await client.query(
        `update user_accounts
         set status = 'inactive', updated_at = now()
         where teacher_id = $1`,
        [row.teacher_id],
      );
      await client.query(
        `update user_sessions us
         set is_revoked = true, logout_at = now()
         from user_accounts ua
         where ua.user_id = us.user_id
           and ua.teacher_id = $1
           and us.is_revoked = false`,
        [row.teacher_id],
      );
    },
  },
  subjects: {
    table: 'subjects', primaryKey: 'subject_id',
    columns: ['subject_code', 'subject_name', 'description', 'status'],
    required: ['subject_code', 'subject_name'], searchColumns: ['subject_code', 'subject_name'], filterColumns: ['status'],
    autoCode: { column: 'subject_code', prefix: 'MH', digits: 3 },
    readRoles: ['admin', 'staff', 'teacher', 'student', 'parent'], writeRoles: managers,
  },
  rooms: {
    table: 'rooms', primaryKey: 'room_id',
    columns: ['room_name', 'capacity', 'location', 'status'],
    required: ['room_name', 'capacity'], searchColumns: ['room_name', 'location'], filterColumns: ['status'],
    readRoles: ['admin', 'staff', 'teacher'], writeRoles: managers,
  },
  classes: {
    table: 'classes', primaryKey: 'class_id',
    columns: ['class_code', 'class_name', 'subject_id', 'teacher_id', 'room_id', 'grade_level', 'max_students', 'tuition_fee', 'start_date', 'end_date', 'status', 'note'],
    required: ['class_code', 'class_name', 'subject_id'], searchColumns: ['class_code', 'class_name'], filterColumns: ['status', 'subject_id', 'teacher_id', 'grade_level'],
    autoCode: { column: 'class_code', prefix: 'C', digits: 3 },
    assignPrimaryKey: true,
    readRoles: ['admin', 'staff', 'teacher', 'student', 'parent'], writeRoles: managers,
    defaultScope: hideCancelledClasses,
    softDelete: { column: 'status', value: 'cancelled' },
    scope: scopeClasses,
    validate: validateClass,
    decorateList: decorateClassesWithTeachers,
    decorateItem: async (row) => (await decorateClassesWithTeachers([row]))[0],
    afterCreate: async (client, row, req) => {
      const teacherIds = normalizeTeacherIds(req.body.teacher_ids);
      if (teacherIds === undefined) {
        if (row.teacher_id) {
          const activeTeacherIds = await replaceClassTeachers(client, row.class_id, [Number(row.teacher_id)]);
          await client.query('update classes set teacher_id = $1 where class_id = $2', [activeTeacherIds[0] || null, row.class_id]);
        }
        return;
      }
      const activeTeacherIds = await replaceClassTeachers(client, row.class_id, teacherIds);
      if (!row.teacher_id && activeTeacherIds.length) {
        await client.query('update classes set teacher_id = $1 where class_id = $2', [activeTeacherIds[0], row.class_id]);
      }
    },
    afterUpdate: async (client, row, req) => {
      const teacherIds = normalizeTeacherIds(req.body.teacher_ids);
      if (teacherIds === undefined) return;
      const activeTeacherIds = await replaceClassTeachers(client, row.class_id, teacherIds);
      await client.query('update classes set teacher_id = $1 where class_id = $2', [activeTeacherIds[0] || null, row.class_id]);
      await client.query(
        `delete from class_schedule_teachers cst
         using class_schedules cs
         where cs.schedule_id = cst.schedule_id
           and cs.class_id = $1
           and not (cst.teacher_id = any($2::bigint[]))`,
        [row.class_id, teacherIds],
      );
    },
  },
};

function createResourceRouter(name) {
  const config = resources[name];
  const controller = createCrudController(config);
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', requireRole(...config.readRoles), controller.list);
  router.get('/:id', requireRole(...config.readRoles), controller.getById);
  router.post('/', requireRole(...(config.createRoles || config.writeRoles)), controller.create);
  router.put('/:id', requireRole(...(config.updateRoles || config.writeRoles)), controller.update);
  router.delete('/:id', requireRole(...(config.deleteRoles || config.writeRoles)), controller.remove);
  return router;
}

module.exports = { createResourceRouter };
