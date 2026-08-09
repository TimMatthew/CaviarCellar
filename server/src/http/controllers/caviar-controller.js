import { caviarService } from "../../services/domain/caviar-service.js";
import { toCaviarDto, toCaviarDtoList } from "../dto/caviar-dto.js";

// Thin HTTP layer: read the (already validated) request, call one service
// method, map the result to a DTO, send. No business logic, no SQL. Errors are
// thrown by the service and caught by asyncHandler -> errorHandler.

export const caviarController = {
  async list(req, res) {
    const inStockOnly = req.query.inStock === "true";
    const rows = await caviarService.list({ inStockOnly });
    res.json(toCaviarDtoList(rows));
  },

  async get(req, res) {
    const row = await caviarService.getById(req.params.id);
    res.json(toCaviarDto(row));
  },

  async create(req, res) {
    const row = await caviarService.create(req.body);
    res.status(201).json(toCaviarDto(row));
  },

  async update(req, res) {
    const row = await caviarService.update(req.params.id, req.body);
    res.json(toCaviarDto(row));
  },

  async remove(req, res) {
    await caviarService.remove(req.params.id);
    res.status(204).end();
  },
};
