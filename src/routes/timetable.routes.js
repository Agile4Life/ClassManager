const express = require('express');
const controller = require('../controllers/timetable.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth);
router.get('/', requireRole('admin', 'staff'), controller.getAll);
router.get('/class/:classId', requireRole('admin', 'staff', 'teacher'), controller.getByClass);
router.get('/teacher/:teacherId', requireRole('admin', 'staff', 'teacher'), controller.getByTeacher);
router.get('/student/:studentId', requireRole('admin', 'staff', 'student'), controller.getByStudent);
router.get('/parent/:parentId', requireRole('admin', 'staff', 'parent'), controller.getByParent);
router.get('/room/:roomId', requireRole('admin', 'staff', 'teacher'), controller.getByRoom);

module.exports = router;
