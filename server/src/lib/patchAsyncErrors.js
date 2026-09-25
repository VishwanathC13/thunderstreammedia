// Express 4 does not catch rejected promises returned from async route
// handlers — an unhandled rejection anywhere (a failed DB call, a failed
// email/payment/etc. provider call with no local try/catch) crashes the
// entire Node process, taking the server down for every user, not just
// the one request that failed.
//
// Rather than retrofitting try/catch into every handler in every route
// file, patch Router's registration methods once, here, so any handler
// that returns a promise gets `.catch(next)` attached automatically.
// Required at the very top of index.js, before any route file requires
// express — must patch before routers are constructed.
const express = require('express');

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function wrapHandler(fn) {
  if (typeof fn !== 'function' || fn.length > 3) return fn; // skip 4-arg error handlers
  return function wrapped(req, res, next) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

// Route-registration methods live on Router.prototype (mixed in by the
// `methods` package internally) — instances from express.Router() inherit
// from there, so patching the prototype covers every router in the app.
const proto = Object.getPrototypeOf(express.Router());
for (const method of METHODS) {
  const original = proto[method];
  proto[method] = function (...args) {
    return original.apply(this, args.map((a) => (typeof a === 'function' ? wrapHandler(a) : a)));
  };
}

module.exports = {};
