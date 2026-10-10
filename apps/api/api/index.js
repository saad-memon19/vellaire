// Vercel function: the compiled Nest app (npm run build writes dist/) handles every request.
module.exports = require('../dist/serverless.js').handler;
