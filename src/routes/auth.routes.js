const express = require('express');
const controller = require('../controllers/auth.controller');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);
router.put('/me', requireAuth, controller.updateMe);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

module.exports = router;
