import argon2 from "argon2";
import { withTransaction } from "../../db/withTransaction.js";
import { ConflictError } from "../../domain/errors.js";
import { adminRepo } from "../../reps/admin-repo.js";

export const adminService = {
  async register({ name, username, password }) {
    // Password hashing is CPU-intensive and does not need to hold a database
    // connection. Only the profile + admin identity writes are transactional.
    const passwordHash = await argon2.hash(password);
    try {
      return await withTransaction((tx) =>
        adminRepo.create({ name, username, passwordHash }, tx)
      );
    } catch (error) {
      if (error?.code === "23505") {
        throw new ConflictError("An administrator with this username already exists");
      }
      throw error;
    }
  },
};
