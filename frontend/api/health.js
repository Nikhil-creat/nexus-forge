'use strict';
const { pick } = require('./_ai.js');
module.exports = function health(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok', caps: pick() ? ['chat'] : [], time: Date.now() });
};
