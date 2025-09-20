import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Order, OrderStatus } from "./entities/order.entity";
import { CreateOrderDto } from "./dto/create-order.dto";
import { Product } from "../products/entities/product.entity";
import { User } from "../users/schemas/user.schema";
import { Shopkeeper } from "../shopkeepers/schemas/shopkeeper.schema";
import { MailService } from "../roles/mail.service";
import axios from "axios";

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Shopkeeper.name)
    private readonly shopkeeperModel: Model<Shopkeeper>,
    private readonly mailService: MailService
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    try {
      await this.updateProductInventory(dto.items, "deduct");
      const order = new this.orderModel({
        ...dto,
        status: OrderStatus.Pending,
      });
      const savedOrder = await order.save();

      // Get shopkeeper details for WhatsApp
      const shopkeeper = await this.shopkeeperModel.findById(dto.shopkeeperId);
      if (shopkeeper?.whatsappNumber) {
        await this.sendWhatsAppToShopkeeper(
          shopkeeper.whatsappNumber,
          shopkeeper.name || shopkeeper.shopName,
          savedOrder.orderId,
          savedOrder.totalAmount,
          dto.items.length
        );
      }

      return savedOrder;
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to create order: " + error.message
      );
    }
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus
  ): Promise<Order> {
    try {
      console.log(
        `[DEBUG] Attempting to update order status for ID: ${orderId} to status: ${newStatus}`
      );
      const order = await this.orderModel
        .findById({ _id: orderId })
        .populate("userId")
        .populate("shopkeeperId");

      if (!order) {
        console.log(`[DEBUG] Order with ID ${orderId} not found.`);
        throw new NotFoundException("Order not found");
      }

      if (order.status === OrderStatus.Cancelled) {
        console.log(
          `[DEBUG] Order with ID ${orderId} is already cancelled. Cannot update.`
        );
        throw new BadRequestException(
          "Cannot change status of a cancelled order"
        );
      }

      order.status = newStatus;

      if (newStatus === OrderStatus.Cancelled) {
        await this.updateProductInventory(order.items, "restore");
      }

      await order.save();
      console.log(
        `[DEBUG] Order ${orderId} status successfully saved as ${newStatus}`
      );

      const user = order.userId as any;
      const shopkeeper = order.shopkeeperId as any;

      // Send email notification
      console.log(
        `[DEBUG] Checking if email notification can be sent. User email: ${user?.email}`
      );
      if (user?.email) {
        console.log("Mail");
        await this.mailService.sendOrderStatusEmail(
          user.name,
          user.email,
          order.orderId,
          newStatus !== OrderStatus.Cancelled,
          newStatus,
          order.totalAmount,
          shopkeeper.name || shopkeeper.shopName
        );
      }

      // Send WhatsApp notification
      console.log(
        `[DEBUG] Checking if WhatsApp notification can be sent. User phone: ${user?.whatsAppNumber}, Shopkeeper phone: ${shopkeeper?.whatsappNumber}`
      );
      if (user?.whatsAppNumber && shopkeeper?.whatsappNumber) {
        console.log("calledd");
        await this.sendWhatsAppToUser(
          user.whatsAppNumber, // Corrected casing
          user.name,
          order.orderId,
          newStatus !== OrderStatus.Cancelled,
          newStatus,
          shopkeeper.name || shopkeeper.shopName,
          shopkeeper.whatsappNumber // Corrected casing
        );
      }
      return order;
    } catch (error) {
      console.log(
        `[DEBUG] An error occurred in updateOrderStatus: ${error.message}`
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        "Failed to update order status: " + error.message
      );
    }
  }

  // Update product inventory
  private async updateProductInventory(
    items: any[],
    action: "deduct" | "restore"
  ) {
    for (const item of items) {
      const product = await this.productModel.findById(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      const subcategory = product.subcategories?.find(
        (sub: any) => sub.name === item.subcategoryName
      );
      if (!subcategory) {
        throw new NotFoundException(
          `Subcategory '${item.subcategoryName}' not found`
        );
      }

      const variant = subcategory.variants?.find(
        (v: any) => v.title === item.variantTitle
      );
      if (!variant) {
        throw new NotFoundException(`Variant '${item.variantTitle}' not found`);
      }

      const quantityChange =
        action === "deduct" ? -item.quantity : item.quantity;

      if (action === "deduct" && variant.inventory < item.quantity) {
        throw new InternalServerErrorException(
          `Insufficient stock for ${item.productName}. Available: ${variant.inventory}, Requested: ${item.quantity}`
        );
      }

      variant.inventory += quantityChange;

      const subcategoryIndex = product.subcategories.findIndex(
        (sub: any) => sub.name === item.subcategoryName
      );
      const variantIndex = subcategory.variants.findIndex(
        (v: any) => v.title === item.variantTitle
      );

      product.markModified(
        `subcategories.${subcategoryIndex}.variants.${variantIndex}.inventory`
      );
      await product.save();
    }
  }

  // WhatsApp to Shopkeeper (New Order)
  private async sendWhatsAppToShopkeeper(
    phone: string,
    shopkeeperName: string,
    orderId: string,
    amount: number,
    itemCount: number
  ) {
    const message = `🔔 New Order Alert!\n\nHi ${shopkeeperName},\n\nYou received a new order:\n📋 Order ID: ${orderId}\n💰 Amount: ₹${amount.toFixed(
      2
    )}\n📦 Items: ${itemCount}\n\nPlease confirm or reject the payment in your dashboard.\n\nThank you! 🙏`;
    await this.sendWhatsAppMessage(phone, message);
  }

  // WhatsApp to User (Order Status Update)
  private async sendWhatsAppToUser(
    phone: string,
    userName: string,
    orderId: string,
    accepted: boolean,
    status: string,
    shopkeeperName: string,
    shopkeeperPhone: string
  ) {
    const statusText = accepted ? "✅ Confirmed" : "❌ Rejected";
    const message = `${statusText} Order Update\n\nHi ${userName},\n\nYour order ${orderId} has been ${
      accepted ? "confirmed" : "rejected"
    } by ${shopkeeperName}.\n\n📋 Current Status: ${status.toUpperCase()}\n\n${
      accepted
        ? "Your order is being processed!"
        : "Please contact the shopkeeper for more details."
    }\n\nThank you! 🙏\n\nContact Shopkeeper: ${shopkeeperPhone}`;
    await this.sendWhatsAppMessage(phone, message);
  }

  // Generic WhatsApp sender using CallMeBot (Free)
  private async sendWhatsAppMessage(phone: string, message: string) {
    try {
      console.log(`[DEBUG] Attempting to send WhatsApp message to ${phone}`);
      const apiKey = process.env.CALLMEBOT_API_KEY;
      console.log(
        `[DEBUG] CALLMEBOT_API_KEY is: ${apiKey ? "Present" : "Not Present"}`
      );

      if (!apiKey) {
        throw new InternalServerErrorException(
          "WhatsApp API key not configured."
        );
      }
      const url = `https://api.callmebot.com/whatsapp.php`;
      const params = {
        phone: phone,
        text: encodeURIComponent(message),
        apikey: apiKey,
      };
      await axios.get(url, { params });
      console.log(`[DEBUG] WhatsApp message sent successfully to ${phone}`);
    } catch (error) {
      console.error(`[DEBUG] WhatsApp send error: ${error.message}`);
      throw error; // Re-throw to propagate the error
    }
  }

  // Professional Email for Order Status
  // private async sendOrderStatusEmail(
  //   email: string,
  //   userName: string,
  //   orderId: string,
  //   accepted: boolean,
  //   status: string,
  //   amount: number,
  //   shopkeeperName: string
  // ) {
  //   try {
  //     console.log(`[DEBUG] Attempting to send email to ${email}`);
  //     const subject = accepted
  //       ? "Order Confirmed - Payment Accepted"
  //       : "Order Rejected - Payment Declined";

  //     const emailData = {
  //       name: userName,
  //       email: email,
  //       orderId: orderId,
  //       status: status.toUpperCase(),
  //       accepted: accepted,
  //       amount: amount.toFixed(2),
  //       shopkeeperName: shopkeeperName,
  //       date: new Date().toLocaleString(),
  //     };

  //     console.log(emailData, "EmailData");

  //     const htmlContent = this.generateOrderStatusEmailTemplate(emailData);

  //     await this.mailService.sendMail({
  //       to: email,
  //       subject: subject,
  //       html: htmlContent,
  //     });
  //     console.log(`[DEBUG] Email sent successfully to ${email}`);
  //   } catch (error) {
  //     console.error(`[DEBUG] Email send error: ${error.message}`);
  //     throw error; // Re-throw to propagate the error
  //   }
  // }

  //   private generateOrderStatusEmailTemplate(data: any): string {
  //     const statusColor = data.accepted ? "#22c55e" : "#ef4444";
  //     // const statusIcon = data.accepted ? "✅" : "❌";

  //     return `
  // <!DOCTYPE html>
  // <html>
  // <head>
  //   <meta charset="utf-8" />
  //   <meta name="viewport" content="width=device-width, initial-scale=1" />
  //   <title>Order ${data.accepted ? "Confirmed" : "Rejected"}</title>
  // </head>
  // <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;">
  //   <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
  //     <div style="text-align: center; margin-bottom: 30px;">
  //       <h1 style="color: ${statusColor}; margin: 0;"> Order ${data.accepted ? "Confirmed" : "Rejected"}</h1>
  //       <p style="color: #666; margin: 10px 0;">Your order status has been updated</p>
  //     </div>

  //     <h2 style="color: #333;">Hello ${data.name},</h2>

  //     <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
  //       <h3 style="margin-top: 0; color: #333;">📋 Order Information</h3>
  //       <table style="width: 100%; border-collapse: collapse;">
  //         <tr><td style="padding: 8px 0; font-weight: bold;">Order ID:</td><td style="padding: 8px 0;">${data.orderId}</td></tr>
  //         <tr><td style="padding: 8px 0; font-weight: bold;">Status:</td><td style="padding: 8px 0; color: ${statusColor}; font-weight: bold;">${data.status}</td></tr>
  //         <tr><td style="padding: 8px 0; font-weight: bold;">Amount:</td><td style="padding: 8px 0;">₹${data.amount}</td></tr>
  //         <tr><td style="padding: 8px 0; font-weight: bold;">Merchant:</td><td style="padding: 8px 0;">${data.shopkeeperName}</td></tr>
  //         <tr><td style="padding: 8px 0; font-weight: bold;">Updated:</td><td style="padding: 8px 0;">${data.date}</td></tr>
  //       </table>
  //     </div>

  //     <div style="margin: 30px 0;">
  //       ${
  //         data.accepted
  //           ? `<p style="color: #22c55e; font-size: 16px;"><strong>Great news!</strong> Your payment has been accepted. Your order is now being processed.</p>
  //              <p>We will keep you updated about your order progress.</p>`
  //           : `<p style="color: #ef4444; font-size: 16px;"><strong>Order Rejected.</strong> The payment was not accepted.</p>
  //              <p>Please contact the merchant for more info or place a new order.</p>`
  //       }
  //     </div>

  //     <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
  //       <h4 style="margin-top: 0; color: #1976d2;">Need Help?</h4>
  //       <p>Contact your merchant directly for any questions.</p>
  //       <p><strong>Merchant:</strong> ${data.shopkeeperName}</p>
  //     </div>

  //     <div style="text-align: center; font-size: 12px; color: #999;">
  //       <p>This is an automated message. Please do not reply.</p>
  //       <p>© ${new Date().getFullYear()} Event SH</p>
  //     </div>
  //   </div>
  // </body>
  // </html>
  // `;
  //   }

  async getOrderById(orderId: string): Promise<Order> {
    try {
      const order = await this.orderModel
        .findOne({ _id: orderId })
        .populate("userId")
        .populate("shopkeeperId")
        .exec();

      if (!order) throw new NotFoundException("Order not found");
      return order;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        "Failed to get order: " + error.message
      );
    }
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new NotFoundException("Invalid userId");
      }
      return await this.orderModel
        .find({ userId })
        .populate("shopkeeperId")
        .exec();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        "Failed to get orders by user: " + error.message
      );
    }
  }

  async getOrdersByShopkeeperId(shopkeeperId: string): Promise<Order[]> {
    try {
      if (!Types.ObjectId.isValid(shopkeeperId)) {
        throw new NotFoundException("Invalid shopkeeperId");
      }
      return await this.orderModel
        .find({ shopkeeperId })
        .populate("userId")
        .exec();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        "Failed to get orders by shopkeeper: " + error.message
      );
    }
  }

  async listAll(): Promise<Order[]> {
    try {
      return await this.orderModel
        .find()
        .populate("userId")
        .populate("shopkeeperId")
        .exec();
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to list orders: " + error.message
      );
    }
  }

  async getCustomersWithOrderSummary(shopkeeperId: string) {
    try {
      const customersData = await this.orderModel.aggregate([
        { $match: { shopkeeperId } },
        { $sort: { userId: 1, createdAt: -1 } },

        // Add ObjectId field for lookup
        {
          $addFields: {
            userObjId: { $toObjectId: "$userId" },
          },
        },

        {
          $group: {
            _id: "$userId",
            orders: {
              $push: {
                orderId: "$orderId",
                createdAt: "$createdAt",
                totalAmount: "$totalAmount",
                items: "$items",
                status: "$status",
                orderType: "$orderType",
                deliveryAddress: "$deliveryAddress",
                pickupDate: "$pickupDate",
                pickupTime: "$pickupTime",
              },
            },
            orderCount: { $sum: 1 },
            totalSpent: { $sum: "$totalAmount" },
            userObjId: { $first: "$userObjId" }, // track converted ObjectId
          },
        },

        // Now lookup using converted ObjectId
        {
          $lookup: {
            from: "users",
            localField: "userObjId",
            foreignField: "_id",
            as: "user",
          },
        },

        { $addFields: { user: { $arrayElemAt: ["$user", 0] } } },

        {
          $addFields: {
            avgOrderValue: {
              $cond: [
                { $eq: ["$orderCount", 0] },
                0,
                { $divide: ["$totalSpent", "$orderCount"] },
              ],
            },
          },
        },

        {
          $project: {
            _id: 0,
            userId: "$_id",
            user: {
              userId: "$user._id",
              name: "$user.name",
              email: "$user.email",
              whatsapp: "$user.whatsAppNumber",
            },
            orders: 1,
            orderCount: 1,
            totalSpent: 1,
            avgOrderValue: 1,
          },
        },
      ]);

      return {
        message: "Customers with order summary retrieved successfully",
        data: customersData,
        customerCount: customersData.length,
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        "Failed to retrieve customers order summary"
      );
    }
  }

  async deleteOrder(orderId: string) {
    try {
      const order = await this.orderModel.findOne({ orderId: orderId });
      if (!order) {
        throw new NotFoundException("Order Not Found");
      }

      await this.orderModel.deleteOne({ orderId: orderId });
      return { message: "Order Deleted Successfully" };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
