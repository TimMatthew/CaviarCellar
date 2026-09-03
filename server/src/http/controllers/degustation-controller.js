import { degustationService } from "../../services/domain/degustation-service.js";
import { toDegustationDto, toDegustationDtoList } from "../dto/degustation-dto.js";

export const degustationController = {
  async availability(req, res) {
    const days = await degustationService.availability(req.query);
    res.json({ from: req.query.from, to: req.query.to, days });
  },

  async create(req, res) {
    const booking = await degustationService.create(req.body);
    res.status(201).json(toDegustationDto(booking));
  },

  async list(req, res) {
    const rows = await degustationService.list(req.query);
    res.json(toDegustationDtoList(rows));
  },

  async get(req, res) {
    const booking = await degustationService.getById(req.params.id);
    res.json(toDegustationDto(booking));
  },
};
