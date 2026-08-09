import { checkoutService } from "../../services/usecase/checkout-service.js";
import { orderService } from "../../services/domain/order-service.js";
import { toOrderDto } from "../dto/order-dto.js";
import { toOrderDtoList } from "../dto/order-dto.js";

export const orderController = {
  async create(req, res) {
    const result = await checkoutService.placeOrder(req.body);
    res.status(201).json(result);
  },

    async list(req, res) {
    const { status, limit, offset } = req.query;
    const rows = await orderService.list({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(toOrderDtoList(rows));
  },

  async get(req, res) {
    const order = await orderService.getById(req.params.id);
    res.json(toOrderDto(order, order.items));
  },

  
};
