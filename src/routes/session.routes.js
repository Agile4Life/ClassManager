const express = require('express');
const controller = require('../controllers/session.controller');
const timetableController = require('../controllers/timetable.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
const teachingStaff = [requireAuth, requireRole('admin', 'staff', 'teacher')];
router.put('/sessions/:sessionId', ...teachingStaff, controller.updateSession);
router.delete('/sessions/:sessionId', ...teachingStaff, controller.deleteSession);
router.get('/sessions/:sessionId/attendance', ...teachingStaff, controller.getAttendance);
router.post('/sessions/:sessionId/attendance', ...teachingStaff, controller.saveAttendance);
router.put('/attendance/:attendanceId', ...teachingStaff, controller.updateAttendance);
router.put('/schedules/:scheduleId', ...teachingStaff, timetableController.updateSchedule);
router.delete('/schedules/:scheduleId', ...teachingStaff, timetableController.deleteSchedule);

module.exports = router;
