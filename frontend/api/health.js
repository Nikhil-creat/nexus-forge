'use strict';
const { pick } = require('./_ai.js');
const { store } = require('./_store.js');
module.exports = function health(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok', caps: (pick() ? ['chat', 'agent'] : []).concat(store() ? ['share'] : []), time: Date.now() });
};
