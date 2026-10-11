const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const { loginRateLimiter } = require("../middleware/authRateLimit");

test("login rate limiter returns a clean JSON 429 after repeated failures", async () => {
  const app = express();
  app.post("/login", loginRateLimiter, (req, res) => {
    res.status(401).json({ success: false, message: "Login failed." });
  });

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });

  try {
    const { port } = server.address();
    let response;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await fetch(`http://127.0.0.1:${port}/login`, {
        method: "POST",
      });
    }

    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Too many attempts. Please wait and try again.",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
