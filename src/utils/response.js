function success(res, data = null, message = 'Request completed successfully', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function failure(res, message = 'Something went wrong', status = 500, details) {
  const body = { success: false, message };
  if (details !== undefined && process.env.NODE_ENV !== 'production') body.details = details;
  return res.status(status).json(body);
}

module.exports = { success, failure };
