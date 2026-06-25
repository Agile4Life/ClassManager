const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { pick, buildUpdate } = require('../utils/query');
const { success } = require('../utils/response');
const { getPagination } = require('../utils/validation');

async function assertStudentFinanceAccess(user, studentId) {
  if (['admin', 'staff'].includes(user.role)) return;
  if (user.role === 'student' && String(user.student_id) === String(studentId)) return;
  if (user.role === 'parent') {
    const linked = await pool.query('select 1 from student_parents where parent_id = $1 and student_id = $2', [user.parent_id, studentId]);
    if (linked.rowCount) return;
  }
  throw new AppError(403, 'You do not have access to this student finance data');
}

async function assertActiveClass(classId) {
  if (!classId) return;
  const result = await pool.query(
    "select 1 from classes where class_id = $1 and status <> 'cancelled'",
    [classId],
  );
  if (!result.rowCount) throw new AppError(400, 'Class does not exist or has been deleted');
}

const INVOICE_SELECT = `
  select i.*, s.student_code, s.full_name as student_name, c.class_code, c.class_name,
         coalesce((select sum(p.amount) from payments p where p.invoice_id = i.invoice_id and p.status = 'paid'), 0) as paid_amount
  from invoices i join students s on s.student_id = i.student_id
  left join classes c on c.class_id = i.class_id and c.status <> 'cancelled'`;

const listInvoices = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const values = [];
  const conditions = [];
  for (const field of ['status', 'student_id', 'class_id', 'invoice_month', 'invoice_year']) {
    if (req.query[field] !== undefined) { values.push(req.query[field]); conditions.push(`i.${field} = $${values.length}`); }
  }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const countResult = await pool.query(`select count(*)::int as total from invoices i ${where}`, values);
  values.push(limit, offset);
  const result = await pool.query(
    `${INVOICE_SELECT} ${where} order by i.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return success(res, { items: result.rows, pagination: { page, limit, total: countResult.rows[0].total } }, 'Invoices fetched successfully');
});

const getInvoice = asyncHandler(async (req, res) => {
  const result = await pool.query(`${INVOICE_SELECT} where i.invoice_id = $1`, [req.params.invoiceId]);
  if (!result.rowCount) throw new AppError(404, 'Invoice not found');
  return success(res, result.rows[0], 'Invoice fetched successfully');
});

const createInvoice = asyncHandler(async (req, res) => {
  const { student_id: studentId, class_id: classId = null, invoice_month: month, invoice_year: year } = req.body;
  if (!studentId || !month || !year) throw new AppError(400, 'student_id, invoice_month and invoice_year are required');
  await assertActiveClass(classId);
  const total = Number(req.body.total_amount ?? 0);
  const discount = Number(req.body.discount_amount ?? 0);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(discount) || discount < 0 || discount > total) {
    throw new AppError(400, 'total_amount must be greater than zero and discount_amount must be valid');
  }
  const result = await pool.query(
    `insert into invoices (student_id, class_id, invoice_month, invoice_year, total_amount, discount_amount, final_amount, due_date, status, note)
     values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, 'unpaid'), $10) returning *`,
    [studentId, classId, month, year, total, discount, total - discount, req.body.due_date || null, req.body.status || null, req.body.note || null],
  );
  return success(res, result.rows[0], 'Invoice created successfully', 201);
});

const updateInvoice = asyncHandler(async (req, res) => {
  const current = await pool.query('select * from invoices where invoice_id = $1', [req.params.invoiceId]);
  if (!current.rowCount) throw new AppError(404, 'Invoice not found');
  const values = pick(req.body, ['student_id', 'class_id', 'invoice_month', 'invoice_year', 'total_amount', 'discount_amount', 'due_date', 'status', 'note']);
  if (values.class_id !== undefined) await assertActiveClass(values.class_id);
  if (values.total_amount !== undefined || values.discount_amount !== undefined) {
    const total = Number(values.total_amount ?? current.rows[0].total_amount);
    const discount = Number(values.discount_amount ?? current.rows[0].discount_amount);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(discount) || discount < 0 || discount > total) {
      throw new AppError(400, 'total_amount must be greater than zero and discount_amount must be valid');
    }
    values.final_amount = total - discount;
  }
  const result = await pool.query(buildUpdate('invoices', 'invoice_id', req.params.invoiceId, values));
  return success(res, result.rows[0], 'Invoice updated successfully');
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const invoice = await client.query('select invoice_id from invoices where invoice_id = $1 for update', [req.params.invoiceId]);
    if (!invoice.rowCount) throw new AppError(404, 'Invoice not found');
    const payments = await client.query('select 1 from payments where invoice_id = $1 limit 1', [req.params.invoiceId]);
    if (payments.rowCount) throw new AppError(409, 'Invoice with payment history cannot be deleted; cancel it instead');
    const result = await client.query('delete from invoices where invoice_id = $1 returning invoice_id', [req.params.invoiceId]);
    await client.query('commit');
    return success(res, result.rows[0], 'Invoice deleted successfully');
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally { client.release(); }
});

const getStudentInvoices = asyncHandler(async (req, res) => {
  await assertStudentFinanceAccess(req.user, req.params.studentId);
  const result = await pool.query(`${INVOICE_SELECT} where i.student_id = $1 order by i.invoice_year desc, i.invoice_month desc`, [req.params.studentId]);
  return success(res, result.rows, 'Student invoices fetched successfully');
});

const listPayments = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const values = [];
  const conditions = [];
  for (const field of ['invoice_id', 'student_id', 'class_id', 'status', 'payment_method']) {
    if (req.query[field] !== undefined) {
      values.push(req.query[field]);
      conditions.push(`p.${field} = $${values.length}`);
    }
  }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const countResult = await pool.query(`select count(*)::int as total from payments p ${where}`, values);
  values.push(limit, offset);
  const result = await pool.query(
    `select p.*, s.student_code, s.full_name as student_name, c.class_code, c.class_name
     from payments p join students s on s.student_id = p.student_id
     left join classes c on c.class_id = p.class_id and c.status <> 'cancelled' ${where}
     order by p.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return success(res, { items: result.rows, pagination: { page, limit, total: countResult.rows[0].total } }, 'Payments fetched successfully');
});

const createPayment = asyncHandler(async (req, res) => {
  const { invoice_id: invoiceId, amount, payment_method: method = 'cash' } = req.body;
  if (!invoiceId || !amount) throw new AppError(400, 'invoice_id and amount are required');
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new AppError(400, 'amount must be greater than zero');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const invoiceResult = await client.query('select * from invoices where invoice_id = $1 for update', [invoiceId]);
    if (!invoiceResult.rowCount) throw new AppError(404, 'Invoice not found');
    const invoice = invoiceResult.rows[0];
    if (invoice.status === 'cancelled') throw new AppError(409, 'Cannot pay a cancelled invoice');
    const paidResult = await client.query("select coalesce(sum(amount), 0) as paid from payments where invoice_id = $1 and status = 'paid'", [invoiceId]);
    const remaining = Number(invoice.final_amount) - Number(paidResult.rows[0].paid);
    if (numericAmount > remaining) throw new AppError(400, 'Payment amount exceeds the invoice balance');
    const result = await client.query(
      `insert into payments (invoice_id, student_id, class_id, amount, payment_date, payment_method, status, transaction_code, note)
       values ($1, $2, $3, $4, coalesce($5::date, current_date), $6, 'paid', $7, $8) returning *`,
      [invoiceId, invoice.student_id, invoice.class_id, numericAmount, req.body.payment_date || null,
        method, req.body.transaction_code || null, req.body.note || null],
    );
    const newStatus = remaining - numericAmount <= 0.005 ? 'paid' : 'partial';
    await client.query('update invoices set status = $1 where invoice_id = $2', [newStatus, invoiceId]);
    await client.query('commit');
    return success(res, result.rows[0], 'Payment recorded successfully', 201);
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally { client.release(); }
});

const getStudentPayments = asyncHandler(async (req, res) => {
  await assertStudentFinanceAccess(req.user, req.params.studentId);
  const result = await pool.query('select * from payments where student_id = $1 order by payment_date desc, payment_id desc', [req.params.studentId]);
  return success(res, result.rows, 'Student payments fetched successfully');
});

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, getStudentInvoices, listPayments, createPayment, getStudentPayments };
