const express = require('express');
const controller = require('../controllers/account.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/accounts', controller.listAccounts);
router.post('/accounts', controller.createAccount);
router.put('/accounts/:userId', controller.updateAccount);
router.put('/accounts/:userId/password', controller.resetAccountPassword);
router.delete('/accounts/:userId', controller.deleteAccount);

module.exports = router;
