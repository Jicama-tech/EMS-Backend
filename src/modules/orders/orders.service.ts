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
import * as PDFKit from "pdfkit";
import { v4 as uuidv4 } from "uuid";
import { CreateUserDto } from "../users/dto/create-users.dto";
import { UsersService } from "../users/users.service";
import fontkit from "fontkit";
import * as fs from "fs";
import * as path from "path";

function asObjectId(id: string | Types.ObjectId): Types.ObjectId | string {
  // If already an ObjectId
  if (id instanceof Types.ObjectId) return id;
  // If valid string ObjectId
  if (typeof id === "string" && Types.ObjectId.isValid(id))
    return new Types.ObjectId(id);
  // Else keep as string
  return id;
}

@Injectable()
export class OrdersService {
  private printDataStore = new Map<string, any[]>();
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Shopkeeper.name)
    private readonly shopkeeperModel: Model<Shopkeeper>,
    private readonly mailService: MailService,
    private readonly usersService: UsersService
  ) {}

  private formatPriceByCountry(amount: number, countryCode: string): string {
    if (amount == null) return "0.00";

    const map: Record<
      string,
      { locale: string; currency: string; symbol?: string }
    > = {
      IN: { locale: "en-IN", currency: "INR", symbol: "₹" },
      SG: { locale: "en-SG", currency: "SGD", symbol: "S$" },
      US: { locale: "en-US", currency: "USD" },
      GB: { locale: "en-GB", currency: "GBP" },
    };

    const cfg = map[countryCode] || { locale: "en-US", currency: "USD" };

    const formatted = amount.toLocaleString(cfg.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (cfg.symbol) {
      return `${cfg.symbol}${formatted}`;
    }

    return amount.toLocaleString(cfg.locale, {
      style: "currency",
      currency: cfg.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    try {
      // Step 1. Find or create user by WhatsApp number
      let user = await this.userModel
        .findOne({ whatsAppNumber: dto.whatsAppNumber })
        .exec();

      if (!user) {
        // Create new user if none exists
        const createUserDto: CreateUserDto = {
          name: dto.fullName || "Guest User",
          email: null,
          password: null,
          provider: "whatsapp",
          providerId: null,
          whatsAppNumber: dto.whatsAppNumber,
        };

        user = await this.usersService.create(createUserDto);
      }

      // Step 2. Deduct inventory before creating order
      await this.updateProductInventory(dto.items, "deduct");

      // Step 3. Create order associated with the user
      const order = new this.orderModel({
        ...dto,
        userId: user._id.toString(),
        status: OrderStatus.Pending,
      });

      const savedOrder = await order.save();

      // Step 4. Send WhatsApp notification to shopkeeper
      // const shopkeeper = await this.shopkeeperModel.findById(dto.shopkeeperId);

      // if (shopkeeper?.whatsAppNumber) {
      //   await this.sendWhatsAppToShopkeeper(
      //     shopkeeper.whatsAppNumber,
      //     shopkeeper.name || shopkeeper.shopName,
      //     savedOrder.orderId,
      //     savedOrder.totalAmount,
      //     dto.items.length
      //   );
      // }

      return savedOrder;
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to create order: " + error.message
      );
    }
  }

  async generateReceipt(orderId: string): Promise<Buffer> {
    const order = await this.orderModel
      .findOne({ _id: orderId })
      .populate("userId")
      .populate("shopkeeperId")
      .exec();

    if (!order) throw new NotFoundException("Order not found");

    const user: any = order.userId;
    const shopkeeper: any = order.shopkeeperId;

    const customerDetail = await this.userModel.findOne({ _id: user._id });
    const shopkeeperDetail = await this.shopkeeperModel.findOne({
      _id: shopkeeper._id,
    });

    if (!shopkeeperDetail) throw new NotFoundException("Shopkeeper Not Found");
    if (!customerDetail) throw new NotFoundException("Customer Not Found");

    // Helper: format date/time similar to frontend
    const formatDate = (d: Date) =>
      new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    const formatTime = (d: Date) =>
      new Date(d).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });

    // Helper: currency formatting - FIXED to always return symbol
    const formatPriceByCountry = (amount: number, countryCode: string) => {
      if (amount == null) return "0.00";

      const map: Record<
        string,
        { locale: string; currency: string; symbol: string }
      > = {
        IN: { locale: "en-IN", currency: "INR", symbol: "₹" },
        SG: { locale: "en-SG", currency: "SGD", symbol: "S$" },
        US: { locale: "en-US", currency: "USD", symbol: "$" },
      };

      const cfg = map[countryCode] || map["US"];
      const formatted = amount.toLocaleString(cfg.locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Always return with symbol - NO OPTIONAL SYMBOL
      return `${cfg.symbol}${formatted}`;
    };

    const countryCode = shopkeeperDetail.country || "IN";

    // Delivery address one line (same as frontend)
    const deliveryAddressLine = order.deliveryAddress
      ? [
          order.deliveryAddress.street,
          order.deliveryAddress.city,
          order.deliveryAddress.state,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

    return new Promise((resolve, reject) => {
      try {
        const PDFDocument = (PDFKit as any).default || PDFKit;

        // ========== LOAD CUSTOM FONT WITH FONTKIT ==========
        const fontPath = path.join(
          __dirname,
          "../../../Fonts/NotoEmoji-Regular.ttf"
        );
        console.log(fontPath);
        const fontBuffer = fs.readFileSync(fontPath);

        // ========== CALCULATE DYNAMIC HEIGHT ==========
        let contentHeight = 0;

        // Shop info height
        contentHeight += 20;
        if (shopkeeperDetail.whatsappNumber) contentHeight += 12 + 3;
        if (shopkeeperDetail.businessEmail) contentHeight += 12 + 3;
        if (shopkeeperDetail.GSTNumber) contentHeight += 12 + 3;
        contentHeight += 15;

        // Order info height
        contentHeight += 13 + 12 + 12 + 15;

        // Customer info height
        contentHeight += 12 + 12;
        if (customerDetail.whatsAppNumber) contentHeight += 12 + 2;
        if (customerDetail.email) contentHeight += 12 + 2;
        if (order.orderType === "pickup") {
          contentHeight += 12 + 2;
          if (order.pickupDate || order.pickupTime) contentHeight += 12 + 2;
        } else if (order.orderType === "delivery") {
          contentHeight += 12 + 2;
          if (deliveryAddressLine) contentHeight += 12 + 2;
        }
        contentHeight += 15;

        // Items height
        contentHeight += 13;
        order.items.forEach((item: any) => {
          contentHeight += 12 + 2;
          if (item.subcategoryName) contentHeight += 11 + 2;
          contentHeight += 11 + 6;
        });
        contentHeight += 15;

        // Totals height
        if (shopkeeperDetail.taxPercentage) {
          contentHeight += 12 + 12 + 12 + 15;
        } else {
          contentHeight += 12 + 15;
        }

        // Payment info height
        contentHeight += 12 + 12 + 15;

        // Footer height
        contentHeight += 12 + 12;

        // Add padding
        contentHeight += 20;

        const finalHeight = Math.max(contentHeight, 400);

        // ========== CREATE PDF DOCUMENT WITH DYNAMIC HEIGHT ==========
        const doc = new PDFDocument({
          size: [227, finalHeight],
          margins: { top: 10, bottom: 10, left: 10, right: 10 },
        });

        // ========== REGISTER CUSTOM FONT ==========
        doc.registerFont("NotoEmoji", fontBuffer);

        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (error) => reject(error));

        // ========== SHOP INFO (header) ==========
        doc
          .fontSize(16)
          .font("NotoEmoji")
          .text(shopkeeperDetail.shopName || "Shop Name", { align: "center" });

        doc.fontSize(10).font("NotoEmoji");
        if (shopkeeperDetail.whatsappNumber) {
          doc.text(`Phone: ${shopkeeperDetail.whatsappNumber}`, {
            align: "center",
          });
        }
        if (shopkeeperDetail.businessEmail) {
          doc.text(`Email: ${shopkeeperDetail.businessEmail}`, {
            align: "center",
          });
        }
        if (shopkeeperDetail.GSTNumber) {
          doc.text(`GSTIN: ${shopkeeperDetail.GSTNumber}`, { align: "center" });
        }

        doc.moveDown(0.2);
        doc
          .fontSize(10)
          .text("---------------------------------------------------", {
            align: "center",
          });

        // ========== ORDER INFO ==========
        doc.moveDown(0.15);
        doc.fontSize(11).font("NotoEmoji");
        doc.text(
          `Order #: ${order.orderId?.slice(-6)?.toUpperCase() || "N/A"}`,
          { align: "left" }
        );
        doc.font("NotoEmoji").fontSize(10);
        doc.text(`Date: ${formatDate(order.createdAt)}`);
        doc.text(`Time: ${formatTime(order.createdAt)}`);

        doc.moveDown(0.2);
        doc
          .fontSize(10)
          .text("---------------------------------------------------", {
            align: "center",
          });

        // ========== CUSTOMER INFO ==========
        doc.moveDown(0.15);
        doc.font("NotoEmoji").fontSize(10).text("Customer:");
        doc.font("NotoEmoji").fontSize(10);
        doc.text(`Name: ${customerDetail.name}`);
        if (customerDetail.whatsAppNumber) {
          doc.text(`Phone: ${customerDetail.whatsAppNumber}`);
        }
        if (customerDetail.email) {
          doc.text(`Email: ${customerDetail.email}`);
        }

        // Pickup / Delivery (match frontend conditions)
        if (order.orderType === "pickup") {
          doc.text(`Order Type: Pickup`);
          if (order.pickupDate || order.pickupTime) {
            const pickDate = order.pickupDate
              ? formatDate(order.pickupDate)
              : "";
            doc.text(`PickUp: ${pickDate} ${order.pickupTime || ""}`.trim());
          }
        } else if (order.orderType === "delivery") {
          doc.text(`Order Type: Delivery`);
          if (deliveryAddressLine) {
            doc.text(`Delivery Address: ${deliveryAddressLine}`);
          }
        }

        doc.moveDown(0.2);
        doc
          .fontSize(10)
          .text("---------------------------------------------------", {
            align: "center",
          });

        // ========== ITEMS ==========
        doc.moveDown(0.15);
        doc.font("NotoEmoji").fontSize(11).text("Items:");
        doc.moveDown(0.1);

        let itemTotal = 0;

        order.items.forEach((item: any) => {
          const itemPrice = item.price * item.quantity;
          itemTotal += itemPrice;

          doc.font("NotoEmoji").fontSize(10);
          doc.text(item.productName);

          if (item.subcategoryName) {
            doc.font("NotoEmoji").fontSize(9);
            const variantLabel = item.variantTitle
              ? `, ${item.variantTitle}`
              : "";
            doc.text(`(${item.subcategoryName}${variantLabel})`);
          }

          doc.font("NotoEmoji").fontSize(9);
          const priceLine = `${item.quantity} x ${formatPriceByCountry(
            item.price,
            countryCode
          )} = ${formatPriceByCountry(itemPrice, countryCode)}`;
          doc.text(priceLine);
          doc.moveDown(0.15);
        });

        doc.moveDown(0.15);
        doc
          .fontSize(10)
          .text("---------------------------------------------------", {
            align: "center",
          });

        // ========== TOTALS (match frontend tax calc) ==========
        doc.moveDown(0.15);
        doc.font("NotoEmoji").fontSize(10);

        if (shopkeeperDetail.taxPercentage) {
          const taxPercent = shopkeeperDetail.taxPercentage;
          const taxAmount =
            (taxPercent * order.totalAmount) / (100 + taxPercent);

          doc.text(
            `Subtotal: ${formatPriceByCountry(itemTotal, countryCode)}`,
            { align: "right" }
          );
          doc.text(`Tax: ${formatPriceByCountry(taxAmount, countryCode)}`, {
            align: "right",
          });
        }

        doc.font("NotoEmoji").fontSize(11);
        doc.text(
          `Total: ${formatPriceByCountry(order.totalAmount, countryCode)}`,
          { align: "right" }
        );

        doc.moveDown(0.2);
        doc
          .fontSize(10)
          .text("---------------------------------------------------", {
            align: "center",
          });

        // ========== PAYMENT INFO ==========
        doc.moveDown(0.15);
        doc.font("NotoEmoji").fontSize(10);
        doc.text(`Payment: Online`);
        doc.text(`Status: ${order.status?.toUpperCase() || "PAID"}`);

        doc.moveDown(0.2);
        doc
          .fontSize(10)
          .text("---------------------------------------------------", {
            align: "center",
          });

        // ========== FOOTER ==========
        doc.moveDown(0.15);
        doc.fontSize(10).font("NotoEmoji");
        doc.text("Thank you for your order!", { align: "center" });
        doc.font("NotoEmoji");
        doc.text("Visit us again!", { align: "center" });

        doc.end();
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
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

      let receipt: Buffer | undefined;

      if (newStatus === "processing") {
        receipt = await this.generateReceipt(orderId);
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

      // Check if this is a product with subcategories and variants
      if (item.subcategoryName && item.variantTitle) {
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
          throw new NotFoundException(
            `Variant '${item.variantTitle}' not found`
          );
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
      }
      // Handle products without subcategories (simple products)
      else {
        // Check if product tracks inventory
        if (product.trackQuantity) {
          const quantityChange =
            action === "deduct" ? -item.quantity : item.quantity;

          if (action === "deduct" && product.inventory < item.quantity) {
            throw new InternalServerErrorException(
              `Insufficient stock for ${item.productName}. Available: ${product.inventory}, Requested: ${item.quantity}`
            );
          }

          product.inventory += quantityChange;
          product.markModified("inventory");
        }
      }

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
        .sort({ createdAt: -1 })
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

  async generatePrintReceipt(orderId: string): Promise<any[]> {
    const order = await this.orderModel
      .findOne({ _id: orderId })
      .populate("userId")
      .populate("shopkeeperId")
      .lean();

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const user = await this.userModel.findOne({ _id: order.userId });
    if (!user) {
      throw new NotFoundException("User Not Found");
    }
    const shopkeeper = await this.shopkeeperModel.findOne({
      _id: order.shopkeeperId,
    });

    const countryCode = shopkeeper.country || "IN";

    console.log(countryCode, "country code");

    if (!shopkeeper) {
      throw new NotFoundException("Shopkeeper Not Found");
    }

    const printData = [];

    // Header/Title
    printData.push({
      type: 0,
      content: "ORDER RECEIPT",
      bold: 1,
      align: 1, // center
      format: 2, // double Height + Width
    });

    printData.push({ type: 0, content: " ", bold: 0, align: 0 });

    printData.push({
      type: 0,
      content: `Order ID: ${order._id.toString().slice(-6).toUpperCase()}`,
      bold: 1,
      align: 0,
      format: 0,
    });

    printData.push({
      type: 0,
      content: `Customer: ${user.name}`,
      bold: 0,
      align: 0,
      format: 0,
    });

    if (user.email) {
      printData.push({
        type: 0,
        content: `Email: ${user.email}`,
        bold: 0,
        align: 0,
        format: 0,
      });
    }

    if (user.whatsAppNumber) {
      printData.push({
        type: 0,
        content: `WhatsApp: ${user.whatsAppNumber}`,
        bold: 0,
        align: 0,
        format: 0,
      });
    }

    printData.push({ type: 0, content: " ", bold: 0, align: 0 });

    printData.push({
      type: 0,
      content: "ITEMS:",
      bold: 1,
      align: 0,
      format: 0,
    });
    printData.push({
      type: 0,
      content: "--------------------------------",
      bold: 0,
      align: 0,
      format: 0,
    });

    order.items.forEach((item) => {
      printData.push({
        type: 0,
        content: item.productName,
        bold: 0,
        align: 0,
        format: 0,
      });

      if (item.variantTitle) {
        printData.push({
          type: 0,
          content: `Variant: ${item.variantTitle}`,
          bold: 0,
          align: 0,
          format: 4, // small text
        });
      }

      printData.push({
        type: 0,
        content: `Qty: ${item.quantity} x ${this.formatPriceByCountry(item.price, countryCode)} = ${this.formatPriceByCountry(item.quantity * item.price, countryCode)}`,
        bold: 0,
        align: 0,
        format: 0,
      });

      printData.push({ type: 0, content: " ", bold: 0, align: 0 });
    });

    printData.push({
      type: 0,
      content: "--------------------------------",
      bold: 0,
      align: 0,
      format: 0,
    });

    printData.push({
      type: 0,
      content: `TOTAL: ${this.formatPriceByCountry(order.totalAmount, countryCode)}`,
      bold: 1,
      align: 2, // right align
      format: 1, // double height
    });

    printData.push({ type: 0, content: " ", bold: 0, align: 0 });

    printData.push({
      type: 0,
      content: `Order Type: ${order.orderType.toUpperCase()}`,
      bold: 1,
      align: 0,
      format: 0,
    });

    if (order.orderType === "delivery" && order.deliveryAddress) {
      printData.push({
        type: 0,
        content: "Delivery Address:",
        bold: 0,
        align: 0,
        format: 0,
      });
      printData.push({
        type: 0,
        content: order.deliveryAddress.street,
        bold: 0,
        align: 0,
        format: 0,
      });
      printData.push({
        type: 0,
        content: `${order.deliveryAddress.city}, ${order.deliveryAddress.state}`,
        bold: 0,
        align: 0,
        format: 0,
      });

      if (order.deliveryAddress.instructions) {
        printData.push({
          type: 0,
          content: `Instructions: ${order.deliveryAddress.instructions}`,
          bold: 0,
          align: 0,
          format: 0,
        });
      }
    }

    if (order.orderType === "pickup" && order.pickupDate && order.pickupTime) {
      printData.push({
        type: 0,
        content: `Pickup Date: ${new Date(order.pickupDate).toLocaleDateString()}`,
        bold: 0,
        align: 0,
        format: 0,
      });
      printData.push({
        type: 0,
        content: `Pickup Time: ${order.pickupTime}`,
        bold: 0,
        align: 0,
        format: 0,
      });
    }

    printData.push({ type: 0, content: " ", bold: 0, align: 0 });

    printData.push({
      type: 0,
      content: `Order Date: ${new Date(order.createdAt).toLocaleDateString()}`,
      bold: 0,
      align: 1, // center
      format: 4, // small text
    });

    printData.push({
      type: 0,
      content: "Thank you for your business!",
      bold: 1,
      align: 1,
      format: 0,
    });

    return printData;
  }

  async createPrintData(orderId: string, printData: any[]): Promise<string> {
    try {
      const printId = uuidv4();

      // Store print data temporarily (you might want to use Redis in production)
      this.printDataStore.set(printId, printData);

      // Clean up after 1 hour
      setTimeout(() => {
        this.printDataStore.delete(printId);
      }, 3600000);

      return printId;
    } catch (error) {
      throw new InternalServerErrorException("Failed to store print data");
    }
  }

  async getPrintData(printId: string): Promise<any[] | null> {
    try {
      const printData = this.printDataStore.get(printId);
      return printData || null;
    } catch (error) {
      throw new InternalServerErrorException("Failed to retrieve print data");
    }
  }

  async getShopkeeperInfo(shopkeeperId: string): Promise<any> {
    try {
      if (!Types.ObjectId.isValid(shopkeeperId)) {
        throw new NotFoundException("Invalid shopkeeper ID");
      }

      const shopkeeper = await this.shopkeeperModel
        .findById(shopkeeperId)
        .lean();

      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper not found");
      }

      return {
        shopName: shopkeeper.shopName,
        name: shopkeeper.name,
        address: shopkeeper.address,
        phone: shopkeeper.whatsappNumber,
        businessEmail: shopkeeper.businessEmail,
        taxPercentage: shopkeeper.taxPercentage || 0,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException("Failed to get shopkeeper info");
    }
  }

  async generateThermalPrintData(orderId: string): Promise<any[]> {
    try {
      const order = await this.orderModel
        .findById(orderId)
        .populate("userId")
        .populate("shopkeeperId")
        .lean();

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      const user = await this.userModel.findById(order.userId).lean();
      const shopkeeper = await this.shopkeeperModel
        .findById(order.shopkeeperId)
        .lean();

      if (!user || !shopkeeper) {
        throw new NotFoundException("User or shopkeeper not found");
      }

      const printData: any[] = [];

      // Store Header
      printData.push({
        type: 0,
        content: shopkeeper.shopName || "Your Store",
        bold: 1,
        align: 1,
        format: 2,
      });

      // Store Info
      if (shopkeeper.address) {
        printData.push({
          type: 0,
          content: shopkeeper.address,
          bold: 0,
          align: 1,
          format: 4,
        });
      }

      if (shopkeeper.whatsappNumber) {
        printData.push({
          type: 0,
          content: `Tel: ${shopkeeper.whatsappNumber}`,
          bold: 0,
          align: 1,
          format: 4,
        });
      }

      // Separator line
      printData.push({
        type: 0,
        content: "================================",
        bold: 0,
        align: 1,
        format: 4,
      });

      // Receipt title
      printData.push({
        type: 0,
        content: "ORDER RECEIPT",
        bold: 1,
        align: 1,
        format: 3,
      });

      // Order details
      printData.push({
        type: 0,
        content: `Order #: ${order._id.toString().slice(-6).toUpperCase()}`,
        bold: 1,
        align: 0,
        format: 0,
      });

      printData.push({
        type: 0,
        content: `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
        bold: 0,
        align: 0,
        format: 0,
      });

      printData.push({
        type: 0,
        content: `Time: ${new Date(order.createdAt).toLocaleTimeString()}`,
        bold: 0,
        align: 0,
        format: 0,
      });

      // Customer info
      printData.push({
        type: 0,
        content: "--------------------------------",
        bold: 0,
        align: 0,
        format: 4,
      });

      printData.push({
        type: 0,
        content: `Customer: ${user.name}`,
        bold: 1,
        align: 0,
        format: 0,
      });

      printData.push({
        type: 0,
        content: `Email: ${user.email}`,
        bold: 0,
        align: 0,
        format: 4,
      });

      if (user.whatsAppNumber) {
        printData.push({
          type: 0,
          content: `Phone: ${user.whatsAppNumber}`,
          bold: 0,
          align: 0,
          format: 4,
        });
      }

      // Order type and delivery details
      printData.push({
        type: 0,
        content: `Type: ${order.orderType.toUpperCase()}`,
        bold: 1,
        align: 0,
        format: 0,
      });

      if (order.orderType === "delivery" && order.deliveryAddress) {
        printData.push({
          type: 0,
          content: "Delivery Address:",
          bold: 1,
          align: 0,
          format: 0,
        });

        printData.push({
          type: 0,
          content: order.deliveryAddress.street,
          bold: 0,
          align: 0,
          format: 4,
        });

        printData.push({
          type: 0,
          content: `${order.deliveryAddress.city}, ${order.deliveryAddress.state}`,
          bold: 0,
          align: 0,
          format: 4,
        });

        if (order.deliveryAddress.instructions) {
          printData.push({
            type: 0,
            content: `Notes: ${order.deliveryAddress.instructions}`,
            bold: 0,
            align: 0,
            format: 4,
          });
        }
      }

      if (order.orderType === "pickup" && order.pickupDate) {
        printData.push({
          type: 0,
          content: `Pickup Date: ${new Date(order.pickupDate).toLocaleDateString()}`,
          bold: 0,
          align: 0,
          format: 0,
        });

        if (order.pickupTime) {
          printData.push({
            type: 0,
            content: `Pickup Time: ${order.pickupTime}`,
            bold: 0,
            align: 0,
            format: 0,
          });
        }
      }

      // Items header
      printData.push({
        type: 0,
        content: "================================",
        bold: 0,
        align: 0,
        format: 4,
      });

      printData.push({
        type: 0,
        content: "ITEMS ORDERED",
        bold: 1,
        align: 1,
        format: 3,
      });

      printData.push({
        type: 0,
        content: "--------------------------------",
        bold: 0,
        align: 0,
        format: 4,
      });

      // Items list
      order.items.forEach((item: any) => {
        printData.push({
          type: 0,
          content: item.productName,
          bold: 1,
          align: 0,
          format: 0,
        });

        if (item.subcategoryName) {
          printData.push({
            type: 0,
            content: `Category: ${item.subcategoryName}`,
            bold: 0,
            align: 0,
            format: 4,
          });
        }

        if (item.variantTitle) {
          printData.push({
            type: 0,
            content: `Variant: ${item.variantTitle}`,
            bold: 0,
            align: 0,
            format: 4,
          });
        }

        printData.push({
          type: 0,
          content: `Qty: ${item.quantity} x $${item.price.toFixed(2)} = $${(item.quantity * item.price).toFixed(2)}`,
          bold: 0,
          align: 0,
          format: 0,
        });

        // Empty line between items
        printData.push({
          type: 0,
          content: " ",
          bold: 0,
          align: 0,
          format: 4,
        });
      });

      // Total section
      printData.push({
        type: 0,
        content: "================================",
        bold: 0,
        align: 0,
        format: 4,
      });

      const subtotal = order.items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.price,
        0
      );
      const tax = order.totalAmount - subtotal;

      printData.push({
        type: 0,
        content: `Subtotal: $${subtotal.toFixed(2)}`,
        bold: 0,
        align: 2,
        format: 0,
      });

      if (tax > 0) {
        printData.push({
          type: 0,
          content: `Tax: $${tax.toFixed(2)}`,
          bold: 0,
          align: 2,
          format: 0,
        });
      }

      printData.push({
        type: 0,
        content: `TOTAL: $${order.totalAmount.toFixed(2)}`,
        bold: 1,
        align: 2,
        format: 1,
      });

      // Status
      printData.push({
        type: 0,
        content: "--------------------------------",
        bold: 0,
        align: 0,
        format: 4,
      });

      printData.push({
        type: 0,
        content: `Status: ${order.status.toString().toUpperCase()}`,
        bold: 1,
        align: 1,
        format: 0,
      });

      // QR Code for order tracking (optional)
      printData.push({
        type: 3,
        value: `Order: ${order._id.toString().slice(-6).toUpperCase()}`,
        size: 40,
        align: 1,
      });

      // Footer
      printData.push({
        type: 0,
        content: " ",
        bold: 0,
        align: 0,
        format: 4,
      });

      printData.push({
        type: 0,
        content: "Thank you for your order!",
        bold: 1,
        align: 1,
        format: 0,
      });

      printData.push({
        type: 0,
        content: "Visit us again!",
        bold: 0,
        align: 1,
        format: 4,
      });

      return printData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        "Failed to generate thermal print data"
      );
    }
  }
}
