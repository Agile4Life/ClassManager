const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { pick, buildInsert, buildUpdate, assertIdentifier } = require('../utils/query');
const { getPagination } = require('../utils/validation');
const { success } = require('../utils/response');

function createCrudController(config) {
  const {
    table,
    primaryKey,
    columns,
    required = [],
    searchColumns = [],
    filterColumns = [],
    orderBy = primaryKey,
  } = config;

  [table, primaryKey, orderBy, ...columns, ...searchColumns, ...filterColumns]
    .forEach((identifier) => assertIdentifier(identifier, 'CRUD configuration identifier'));

  async function assertRecordScope(req, id) {
    if (!config.scope) return;
    const values = [id];
    const conditions = [`${primaryKey} = $1`];
    config.scope(req, values, conditions);
    const result = await pool.query(
      `select 1 from ${table} where ${conditions.join(' and ')} limit 1`,
      values,
    );
    if (!result.rowCount) throw new AppError(404, 'Record not found');
  }

  const list = asyncHandler(async (req, res) => {
    const { limit, page, offset } = getPagination(req.query);
    const values = [];
    const conditions = [];

    if (req.query.search && searchColumns.length) {
      values.push(`%${req.query.search}%`);
      conditions.push(`(${searchColumns.map((column) => `${column} ilike $${values.length}`).join(' or ')})`);
    }
    for (const column of filterColumns) {
      if (req.query[column] !== undefined) {
        values.push(req.query[column]);
        conditions.push(`${column} = $${values.length}`);
      }
    }
    if (config.scope) config.scope(req, values, conditions);

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const countResult = await pool.query(`select count(*)::int as total from ${table} ${where}`, values);
    values.push(limit, offset);
    const result = await pool.query(
      `select * from ${table} ${where} order by ${orderBy} desc limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    return success(res, {
      items: result.rows,
      pagination: { page, limit, total: countResult.rows[0].total },
    }, `${table} fetched successfully`);
  });

  const getById = asyncHandler(async (req, res) => {
    const values = [req.params.id];
    const conditions = [`${primaryKey} = $1`];
    if (config.scope) config.scope(req, values, conditions);
    const result = await pool.query(`select * from ${table} where ${conditions.join(' and ')}`, values);
    if (!result.rowCount) throw new AppError(404, 'Record not found');
    return success(res, result.rows[0], 'Record fetched successfully');
  });

  const create = asyncHandler(async (req, res) => {
    for (const field of required) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        throw new AppError(400, `${field} is required`);
      }
    }
    if (config.validate) config.validate(req.body, 'create');
    const query = buildInsert(table, pick(req.body, columns));
    const result = await pool.query(query);
    return success(res, result.rows[0], 'Record created successfully', 201);
  });

  const update = asyncHandler(async (req, res) => {
    await assertRecordScope(req, req.params.id);
    if (config.validate) config.validate(req.body, 'update');
    const query = buildUpdate(table, primaryKey, req.params.id, pick(req.body, columns));
    const result = await pool.query(query);
    if (!result.rowCount) throw new AppError(404, 'Record not found');
    return success(res, result.rows[0], 'Record updated successfully');
  });

  const remove = asyncHandler(async (req, res) => {
    await assertRecordScope(req, req.params.id);
    const result = await pool.query(`delete from ${table} where ${primaryKey} = $1 returning ${primaryKey}`, [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Record not found');
    return success(res, result.rows[0], 'Record deleted successfully');
  });

  return { list, getById, create, update, remove };
}

module.exports = createCrudController;
