const express = require('express');
const controller = require('../controllers/class.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
const managerOnly = [requireAuth, requireRole('admin', 'staff')];
router.post('/students/:studentId/parents/:parentId', ...managerOnly, controller.linkParent);
router.get('/students/:studentId/parents', ...managerOnly, controller.getStudentParents);
router.put('/enrollments/:id', ...managerOnly, controller.updateEnrollment);
router.delete('/enrollments/:id', ...managerOnly, controller.deleteEnrollment);

module.exports = router;
