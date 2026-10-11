const JWT_SECRET = process.env.JWT_SECRET?.trim();

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is required. Set it in the backend environment before starting TIMAN."
  );
}

module.exports = {
  JWT_SECRET,
};
