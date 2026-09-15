const express = require('express');
const controller = require('../controllers/academic.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth);
router.get('/topics', requireRole('admin', 'staff', 'teacher', 'student'), controller.listTopics);
router.post('/topics', requireRole('admin', 'staff', 'teacher'), controller.createTopic);
router.put('/topics/:topicId', requireRole('admin', 'staff', 'teacher'), controller.updateTopic);
router.delete('/topics/:topicId', requireRole('admin', 'staff'), controller.deleteTopic);

router.get('/classes/:classId/assignments', requireRole('admin', 'staff', 'teacher', 'student'), controller.listClassAssignments);
router.post('/classes/:classId/assignments', requireRole('admin', 'staff', 'teacher'), controller.createAssignment);
router.get('/assignments/:assignmentId', requireRole('admin', 'staff', 'teacher', 'student'), controller.getAssignmentById);
router.put('/assignments/:assignmentId', requireRole('admin', 'staff', 'teacher'), controller.updateAssignment);
router.delete('/assignments/:assignmentId', requireRole('admin', 'staff', 'teacher'), controller.deleteAssignment);
router.get('/assignments/:assignmentId/questions', requireRole('admin', 'staff', 'teacher', 'student'), controller.listQuestions);
router.post('/assignments/:assignmentId/questions', requireRole('admin', 'staff', 'teacher'), controller.createQuestion);
router.put('/questions/:questionId', requireRole('admin', 'staff', 'teacher'), controller.updateQuestion);
router.delete('/questions/:questionId', requireRole('admin', 'staff', 'teacher'), controller.deleteQuestion);

router.get('/assignments/:assignmentId/submissions', requireRole('admin', 'staff', 'teacher'), controller.listSubmissions);
router.post('/assignments/:assignmentId/submissions', requireRole('admin', 'staff', 'teacher', 'student'), controller.createSubmission);
router.get('/students/:studentId/submissions', requireRole('admin', 'staff', 'teacher', 'student'), controller.listStudentSubmissions);
router.post('/submissions/:submissionId/answers', requireRole('admin', 'staff', 'teacher', 'student'), controller.saveAnswer);
router.put('/answers/:answerId', requireRole('admin', 'staff', 'teacher', 'student'), controller.updateAnswer);

module.exports = router;
