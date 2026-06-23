const express = require('express');
const controller = require('../controllers/report.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth);
router.get('/reports/student/:studentId', requireRole('admin', 'staff', 'teacher', 'student', 'parent'), controller.getStudentReports);
router.post('/reports', requireRole('admin', 'staff', 'teacher'), controller.createReport);
router.put('/reports/:reportId', requireRole('admin', 'staff', 'teacher'), controller.updateReport);
router.delete('/reports/:reportId', requireRole('admin', 'staff', 'teacher'), controller.deleteReport);
router.get('/reports/weak-topics', requireRole('admin', 'staff', 'teacher'), controller.getWeakTopics);
router.get('/reports/student/:studentId/weak-topics', requireRole('admin', 'staff', 'teacher', 'student', 'parent'), controller.getStudentWeakTopics);
router.get('/reports/student/:studentId/assignment-summary', requireRole('admin', 'staff', 'teacher', 'student', 'parent'), controller.getAssignmentSummary);
router.get('/reports/class/:classId/performance', requireRole('admin', 'staff', 'teacher'), controller.getClassPerformance);

module.exports = router;
