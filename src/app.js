const express = require('express');
const cors = require('cors');
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
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();
const configuredOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((origin) => origin.trim());

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', asyncHandler(async (req, res) => {
  const result = await pool.query('select now() as database_time');
  return success(res, { status: 'ok', database_time: result.rows[0].database_time }, 'API is healthy');
}));

app.use('/api/auth', authRoutes);
app.use('/api', relationshipRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api', sessionRoutes);
app.use('/api', academicRoutes);
app.use('/api', reportRoutes);
app.use('/api', financeRoutes);

// Specialized class subpaths and generic /classes/:id routes have distinct
// path shapes. Keeping specialized routers first makes that intent explicit.
for (const resource of ['students', 'parents', 'teachers', 'subjects', 'rooms', 'classes']) {
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
