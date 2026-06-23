const express = require('express');
const controller = require('../controllers/finance.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

const router = express.Router();
router.use(requireAuth);
router.get('/invoices', requireRole('admin', 'staff'), controller.listInvoices);
router.get('/invoices/:invoiceId', requireRole('admin', 'staff'), controller.getInvoice);
router.post('/invoices', requireRole('admin', 'staff'), controller.createInvoice);
router.put('/invoices/:invoiceId', requireRole('admin', 'staff'), controller.updateInvoice);
router.delete('/invoices/:invoiceId', requireRole('admin', 'staff'), controller.deleteInvoice);
router.get('/students/:studentId/invoices', requireRole('admin', 'staff', 'student', 'parent'), controller.getStudentInvoices);
router.get('/payments', requireRole('admin', 'staff'), controller.listPayments);
router.post('/payments', requireRole('admin', 'staff'), controller.createPayment);
router.get('/students/:studentId/payments', requireRole('admin', 'staff', 'student', 'parent'), controller.getStudentPayments);

module.exports = router;
