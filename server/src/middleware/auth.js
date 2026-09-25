const jwt = require('jsonwebtoken');

const DEV_SECRET = 'dev-only-insecure-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;

// Anyone who knows the dev secret can forge admin tokens, so a production
// deploy that forgot to set a real one must fail loudly instead of running.
if (process.env.NODE_ENV === 'production' && (JWT_SECRET === DEV_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: '12h',
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Missing auth token' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient role' });
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };
