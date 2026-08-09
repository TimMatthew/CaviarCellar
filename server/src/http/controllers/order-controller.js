import { checkoutService } from "../../services/usecase/checkout-service.js";
import { orderService } from "../../services/domain/order-service.js";
import { toOrderDto } from "../dto/order-dto.js";

export const orderController = {
  async create(req, res) {
    const result = await checkoutService.placeOrder(req.body);
    res.status(201).json(result);
  },

  async get(req, res) {
    const order = await orderService.getById(req.params.id);
    res.json(toOrderDto(order, order.items));
  },
};
