const express = require('express');
const controller = require('../controllers/session.controller');
const timetableController = require('../controllers/timetable.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
const teachingStaff = [requireAuth, requireRole('admin', 'staff', 'teacher')];
const attendanceStaff = [requireAuth, requireRole('admin', 'teacher')];
router.put('/sessions/:sessionId', ...teachingStaff, controller.updateSession);
router.delete('/sessions/:sessionId', ...teachingStaff, controller.deleteSession);
router.get('/sessions/:sessionId/attendance', ...attendanceStaff, controller.getAttendance);
router.post('/sessions/:sessionId/attendance', ...attendanceStaff, controller.saveAttendance);
router.put('/attendance/:attendanceId', ...attendanceStaff, controller.updateAttendance);
router.put('/schedules/:scheduleId', ...teachingStaff, timetableController.updateSchedule);
router.delete('/schedules/:scheduleId', ...teachingStaff, timetableController.deleteSchedule);

module.exports = router;
