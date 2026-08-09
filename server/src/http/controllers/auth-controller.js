import argon2 from "argon2";
import { adminRepo } from "../../reps/admin-repo.js";
import { signToken } from "../../lib/token.js";
import { UnauthorizedError } from "../../domain/errors.js";

export const authController = {
  // Admin login: verify the submitted password against the stored argon2 hash,
  // then issue a bearer token. The same generic message for unknown user and
  // wrong password avoids leaking which admins exist.
  async login(req, res) {
    const { username, password } = req.body;

    const admin = await adminRepo.findByUsername(username);
    if (!admin) throw new UnauthorizedError("Invalid credentials");

    const ok = await argon2.verify(admin.password_t, password);
    if (!ok) throw new UnauthorizedError("Invalid credentials");

    const token = signToken({ sub: Number(admin.prof_id), username: admin.username });
    res.json({
      token,
      admin: { id: Number(admin.prof_id), username: admin.username, name: admin.name_t },
    });
  },
};
