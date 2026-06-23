const express = require('express');
const classController = require('../controllers/class.controller');
const timetable = require('../controllers/timetable.controller');
const sessions = require('../controllers/session.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth);
router.get('/:classId/students', requireRole('admin', 'staff', 'teacher'), classController.getClassStudents);
router.post('/:classId/enroll/:studentId', requireRole('admin', 'staff'), classController.enrollStudent);
router.post('/:classId/schedules', requireRole('admin', 'staff'), timetable.createSchedule);
router.post('/:classId/generate-sessions', requireRole('admin', 'staff'), timetable.generateSessions);
router.get('/:classId/sessions', requireRole('admin', 'staff', 'teacher'), sessions.listSessions);
router.post('/:classId/sessions', requireRole('admin', 'staff', 'teacher'), sessions.createSession);

module.exports = router;
