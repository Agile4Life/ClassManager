const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const pool = require('./config/db');
const asyncHandler = require('./utils/async-handler');
const { success } = require('./utils/response');
const authRoutes = require('./routes/auth.routes');
const { createResourceRouter } = require('./routes/resources.routes');
const classRoutes = require('./routes/class.routes');
const relationshipRoutes = require('./routes/relationship.routes');
const timetableRoutes = require('./routes/timetable.routes');
const sessionRoutes = require('./routes/session.routes');
const academicRoutes = require('./routes/academic.routes');
const reportRoutes = require('./routes/report.routes');
const financeRoutes = require('./routes/finance.routes');
const learningHistoryRoutes = require('./routes/learning-history.routes');
const accountRoutes = require('./routes/account.routes');
const studentRoutes = require('./routes/student.routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const requireAuth = require('./middlewares/auth.middleware');
const requireRole = require('./middlewares/role.middleware');
const { parseOrigins, isOriginAllowed } = require('./utils/cors');

const app = express();
const configuredOrigins = parseOrigins(process.env.CORS_ORIGIN);

app.disable('x-powered-by');
app.use(cors((req, callback) => callback(null, {
  origin(origin, originCallback) {
    if (isOriginAllowed({
      req,
      origin,
      configuredOrigins,
      nodeEnv: process.env.NODE_ENV,
    })) return originCallback(null, true);
    return originCallback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
})));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', asyncHandler(async (req, res) => {
  const result = await pool.query('select now() as database_time');
  return success(res, { status: 'ok', database_time: result.rows[0].database_time }, 'API is healthy');
}));

app.get('/api/admin/debug/class-schema', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const tables = await pool.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name in ('classes', 'class_teachers', 'class_schedule_teachers', 'teachers', 'subjects', 'rooms')
     order by table_name`,
  );
  const columns = await pool.query(
    `select table_name, column_name, is_nullable, data_type, column_default
     from information_schema.columns
     where table_schema = 'public'
       and table_name in ('classes', 'class_teachers', 'class_schedule_teachers', 'teachers', 'subjects', 'rooms')
     order by table_name, ordinal_position`,
  );
  const constraints = await pool.query(
    `select table_name, constraint_name, constraint_type
     from information_schema.table_constraints
     where table_schema = 'public'
       and table_name in ('classes', 'class_teachers', 'class_schedule_teachers', 'teachers', 'subjects', 'rooms')
     order by table_name, constraint_type, constraint_name`,
  );
  return success(res, {
    tables: tables.rows,
    columns: columns.rows,
    constraints: constraints.rows,
  }, 'Class schema debug fetched successfully');
}));

app.use('/api/auth', authRoutes);
app.use('/api', relationshipRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api', sessionRoutes);
app.use('/api', academicRoutes);
app.use('/api', reportRoutes);
app.use('/api', financeRoutes);
app.use('/api', learningHistoryRoutes);
app.use('/api/admin', accountRoutes);
app.use('/api/students', studentRoutes);

// Specialized class subpaths and generic /classes/:id routes have distinct
// path shapes. Keeping specialized routers first makes that intent explicit.
for (const resource of ['parents', 'teachers', 'subjects', 'rooms', 'classes']) {
  app.use(`/api/${resource}`, createResourceRouter(resource));
}

app.use('/api', notFound);

const frontendDist = path.resolve(__dirname, '../frontend/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
