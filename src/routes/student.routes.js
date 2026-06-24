const express = require('express');
const controller = require('../controllers/student.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin', 'staff', 'teacher'), controller.list);
router.get('/:id', requireRole('admin', 'staff', 'teacher'), controller.getById);
router.post('/', requireRole('admin', 'staff', 'teacher'), controller.create);
router.put('/:id', requireRole('admin', 'staff', 'teacher'), controller.update);
router.delete('/:id', requireRole('admin', 'staff'), controller.remove);

router.post('/import', requireRole('admin', 'staff', 'teacher'), controller.importStudents);
router.post('/bulk-assign-class', requireRole('admin', 'staff', 'teacher'), controller.bulkAssignClass);

module.exports = router;
