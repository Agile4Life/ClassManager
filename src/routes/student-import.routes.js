const express = require('express');
const controller = require('../controllers/student-import.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.post('/import', requireAuth, requireRole('admin', 'staff'), controller.importStudents);

module.exports = router;
