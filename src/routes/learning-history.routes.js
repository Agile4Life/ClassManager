const express = require('express');
const controller = require('../controllers/learning-history.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth);
router.get('/learning-history/notification-templates', requireRole('admin', 'staff', 'teacher'), controller.listTemplates);
router.post('/learning-history/notification-templates', requireRole('admin', 'staff', 'teacher'), controller.createTemplate);
router.post('/learning-history/events', requireRole('admin', 'staff', 'teacher'), controller.createEvents);
router.get('/learning-history', requireRole('admin', 'teacher'), controller.listEvents);
router.delete('/learning-history/:id', requireRole('admin'), controller.removeEvent);

module.exports = router;
