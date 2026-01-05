import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Order } from "../orders/entities/order.entity";
import { Product } from "../products/entities/product.entity";
import { User } from "../users/schemas/user.schema";
import { Shopkeeper } from "../shopkeepers/schemas/shopkeeper.schema";
import {
  ShopkeeperAnalyticsReportDto,
  ReportPeriod,
  DetailedOrderDto,
  OrderItemDetailDto,
  ProductPerformanceDto,
  VariantPerformanceDto,
  CustomerPerformanceDto,
  RevenueTrendDto,
  OrderTypeBreakdownDto,
  OrderStatusBreakdownDto,
  QuickSummaryDto,
  CategoryPerformanceDto,
} from "./dto/analytics-report.dto";
import * as moment from "moment-timezone";
import * as ExcelJS from "exceljs";

@Injectable()
export class ShopkeeperAnalyticsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Shopkeeper.name) private shopkeeperModel: Model<Shopkeeper>
  ) {}

  // ============= CURRENCY & DATE HELPERS =============

  private getCurrencyConfig(country: string): {
    symbol: string;
    code: string;
    locale: string;
  } {
    const currencyMap: Record<
      string,
      { symbol: string; code: string; locale: string }
    > = {
      IN: { symbol: "₹", code: "INR", locale: "en-IN" },
      SG: { symbol: "$", code: "SGD", locale: "en-SG" },
      US: { symbol: "$", code: "USD", locale: "en-US" },
      GB: { symbol: "£", code: "GBP", locale: "en-GB" },
      AU: { symbol: "$", code: "AUD", locale: "en-AU" },
    };

    return (
      currencyMap[country] || { symbol: "$", code: "USD", locale: "en-US" }
    );
  }

  private formatCurrency(amount: number, country: string): string {
    const config = this.getCurrencyConfig(country);
    return `${config.symbol}${amount.toLocaleString(config.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private getDateRange(period: ReportPeriod): { start: Date; end: Date } {
    const now = moment();
    let start: moment.Moment;
    let end: moment.Moment;

    switch (period) {
      case ReportPeriod.MONTHLY:
        start = now.clone().startOf("month");
        end = now.clone().endOf("month");
        break;

      case ReportPeriod.LASTMONTH:
        start = now.clone().subtract(1, "month").startOf("month");
        end = now.clone().subtract(1, "month").endOf("month");
        break;

      case ReportPeriod.QUARTERLY:
        // Current quarter: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec
        start = now.clone().startOf("quarter");
        end = now.clone().endOf("quarter");
        break;

      case ReportPeriod.LASTQUARTER:
        // Previous quarter: Dec-Feb, Mar-May, Jun-Aug, Sep-Nov
        start = now.clone().subtract(1, "quarter").startOf("quarter");
        end = now.clone().subtract(1, "quarter").endOf("quarter");
        break;

      case ReportPeriod.YEARLY:
        start = now.clone().startOf("year");
        end = now.clone().endOf("year");
        break;

      case ReportPeriod.LASTYEAR:
        start = now.clone().subtract(1, "year").startOf("year");
        end = now.clone().subtract(1, "year").endOf("year");
        break;

      default:
        // Default: Last 30 days
        start = now.clone().subtract(30, "days");
        end = now.clone();
        break;
    }

    console.log(start, now, "calling");

    return {
      start: start.toDate(),
      end: end.toDate(),
    };
  }

  // ============= MAIN REPORT GENERATOR =============

  async generateAnalyticsReport(
    shopkeeperId: string,
    period: ReportPeriod = ReportPeriod.MONTHLY
  ): Promise<ShopkeeperAnalyticsReportDto> {
    try {
      const shopkeeper = await this.shopkeeperModel
        .findById(shopkeeperId)
        .lean();

      if (!shopkeeper) {
        throw new NotFoundException("Shopkeeper not found");
      }

      const { start, end } = this.getDateRange(period);
      const currencyConfig = this.getCurrencyConfig(shopkeeper.country || "IN");

      // ✅ Filter orders by date range based on period
      const orders = await this.orderModel
        .find({
          shopkeeperId: shopkeeperId,
          status: { $nin: ["Cancelled", "cancelled"] },
          createdAt: {
            $gte: start,
            $lte: end,
          }, // ✅ Filter by date range
        })
        .populate("userId", "name email whatsAppNumber firstName lastName")
        .lean()
        .exec();

      const convertedOrders = orders.map((o) => this.convertDecimalToNumber(o));

      // Calculate basic metrics
      const totalRevenue = orders.reduce(
        (sum, o) => sum + (o.totalAmount || 0),
        0
      );

      const totalOrders = orders.length;

      const uniqueCustomers = new Set(
        orders.map((o) => o.userId).filter(Boolean)
      );

      const totalCustomers = uniqueCustomers.size;

      const totalItems = orders.reduce(
        (sum, o) => sum + (o.items?.length || 0),
        0
      );

      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const avgItemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;
      const repeatCustomerRate = this.calculateRepeatCustomerRate(orders);
      const conversionRate =
        totalCustomers > 0 ? (totalOrders / totalCustomers) * 100 : 0;

      // Build detailed analytics data
      const detailedOrders = this.buildDetailedOrders(orders);
      const { topProducts, bottomProducts } = await this.getProductPerformance(
        orders,
        totalRevenue
      );
      const { topCustomers, inactiveCustomers } = this.getCustomerPerformance(
        orders,
        end
      );

      // ✅ Pass period to getRevenueTrend for dynamic transformation
      const revenueTrend = this.getRevenueTrend(orders, start, end);

      const orderTypeBreakdown = this.getOrderTypeBreakdown(
        orders,
        totalRevenue
      );
      const orderStatusBreakdown = this.getOrderStatusBreakdown(
        orders,
        totalRevenue
      );
      const categoryPerformance = this.getCategoryPerformance(
        orders,
        totalRevenue
      );

      // ✅ SINGLE RETURN - Complete report object
      // ✅ reportData matches your DTO perfectly
      const reportData: ShopkeeperAnalyticsReportDto = {
        shopkeeperId,
        shopName: shopkeeper?.shopName || "Unknown Shop",
        country: shopkeeper?.country || "IN",
        currency: currencyConfig.code || "INR",
        currencySymbol: currencyConfig.symbol || "₹",
        period,
        startDate: start,
        endDate: end,
        generatedAt: new Date(),

        // Core metrics
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        totalCustomers,
        totalItems,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        avgItemsPerOrder: Math.round(avgItemsPerOrder * 100) / 100,
        repeatCustomerRate: Math.round(repeatCustomerRate * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,

        // Detailed data
        orders: detailedOrders,
        topProducts,
        bottomProducts,
        topCustomers,
        inactiveCustomers,
        revenueTrend,
        orderTypeBreakdown,
        orderStatusBreakdown,
        categoryPerformance,
      };

      const dailyData = await this.getRevenueTrend(orders, start, end);

      // Transform based on period
      if (period === "monthly") {
        reportData.revenueTrend = dailyData; // Keep daily format
      } else if (period === "quarterly") {
        reportData.revenueTrend = this.getLast3Months(dailyData);
      } else if (period === "yearly") {
        reportData.revenueTrend = this.getCurrentYearData(dailyData);
      } else if (period === "lastyear") {
        reportData.revenueTrend = this.getLastYearData(dailyData);
      }

      // ✅ Return wrapper object (NOT part of DTO)
      return reportData;
    } catch (error) {
      console.error("Error generating analytics report:", error);
    }
  }

  // ============= DETAILED ORDERS =============

  private buildDetailedOrders(orders: any[]): DetailedOrderDto[] {
    return orders
      .map((order) => ({
        orderId: order.orderId,
        createdAt: order.createdAt,
        customerName:
          order.userId?.name ||
          `${order.userId?.firstName || ""} ${order.userId?.lastName || ""}`.trim() ||
          "Guest",
        customerEmail: order.userId?.email,
        whatsappNumber: order.userId?.whatsAppNumber,
        totalPrice: Math.round((order.totalAmount || 0) * 100) / 100,
        orderType: order.orderType || "unknown",
        status: order.status || "Pending",
        items: (order.items || []).map((item) => ({
          productId: item.productId?.toString(),
          productName: item.productName,
          category: item.category || "Uncategorized",
          quantity: item.quantity || 0,
          price: Math.round((item.price || 0) * 100) / 100,
          total:
            Math.round((item.price || 0) * (item.quantity || 0) * 100) / 100,
          variantTitle: item.variantTitle || "Default",
          subcategoryName: item.subcategoryName || "N/A",
        })),
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  // ============= PRODUCT PERFORMANCE =============

  private async getProductPerformance(
    orders: any[],
    totalRevenue: number
  ): Promise<{
    topProducts: ProductPerformanceDto[];
    bottomProducts: ProductPerformanceDto[];
  }> {
    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        category: string;
        quantity: number;
        revenue: number;
        variants: Map<string, VariantPerformanceDto>;
      }
    >();

    let totalItemsProcessed = 0;
    let totalRevenueFromItems = 0;

    orders.forEach((order, orderIndex) => {
      (order.items || []).forEach((item, itemIndex) => {
        totalItemsProcessed++;

        const productId = item.productId?.toString();
        const itemQty = item.quantity || 0;
        const itemRevenue = (item.price || 0) * itemQty;
        totalRevenueFromItems += itemRevenue;

        if (!productId) {
          return;
        }

        let existing = productMap.get(productId);
        const currentCategory = item.category || "Uncategorized";

        if (!existing) {
          // First time - create with current category
          existing = {
            productId,
            productName: item.productName || "Unknown Product",
            category: currentCategory,
            quantity: 0,
            revenue: 0,
            variants: new Map(),
          };
          productMap.set(productId, existing);
        } else if (
          existing.category === "Uncategorized" &&
          currentCategory !== "Uncategorized"
        ) {
          // UPGRADE: If we had "Uncategorized" but now have real category
          existing.category = currentCategory;
        }

        // Update metrics
        existing.quantity += itemQty;
        existing.revenue += itemRevenue;

        // Track variants
        const variantKey = item.variantTitle || "Default";
        let variantData = existing.variants.get(variantKey);

        if (!variantData) {
          variantData = {
            variantTitle: variantKey,
            quantity: 0,
            revenue: 0,
            percentage: 0,
          };
          existing.variants.set(variantKey, variantData);
        }

        variantData.quantity += itemQty;
        variantData.revenue += itemRevenue;

        productMap.set(productId, existing);
      });
    });

    // Format results
    const allProducts = Array.from(productMap.values())
      .map((data, index) => {
        const variants = Array.from(data.variants.values()).map((v) => ({
          ...v,
          percentage: data.revenue > 0 ? (v.revenue / data.revenue) * 100 : 0,
        }));

        const productPercentage =
          totalRevenue > 0 ? (data.revenue / totalRevenueFromItems) * 100 : 0;
        const roundedRevenue = Math.round(data.revenue * 100) / 100;
        const avgPrice =
          data.quantity > 0
            ? Math.round((data.revenue / data.quantity) * 100) / 100
            : 0;

        const productData = {
          productId: data.productId,
          productName: data.productName,
          category: data.category,
          totalQuantity: data.quantity,
          totalRevenue: roundedRevenue,
          avgPrice,
          percentage: productPercentage,
          rank: index + 1,
          variants: variants.sort((a, b) => b.quantity - a.quantity),
        };

        return productData;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      topProducts: allProducts.slice(0, 10),
      bottomProducts: allProducts.slice(-5).reverse(),
    };
  }

  // ============= CUSTOMER PERFORMANCE =============

  private getCustomerPerformance(
    orders: any[],
    endDate: Date
  ): {
    topCustomers: CustomerPerformanceDto[];
    inactiveCustomers: CustomerPerformanceDto[];
  } {
    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        email?: string;
        whatsappNumber?: string;
        totalOrders: number;
        totalSpent: number;
        lastOrderDate: Date;
      }
    >();

    orders.forEach((order) => {
      const customerId = order.userId?._id?.toString();

      if (!customerId) return;

      const existing = customerMap.get(customerId) || {
        customerId,
        customerName:
          order.userId?.name ||
          `${order.userId?.firstName || ""} ${order.userId?.lastName || ""}`.trim() ||
          "Guest",
        email: order.userId?.email,
        whatsappNumber: order.userId?.whatsAppNumber,
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: new Date(0),
      };

      existing.totalOrders += 1;
      existing.totalSpent += order.totalAmount || 0;
      existing.lastOrderDate = new Date(
        Math.max(existing.lastOrderDate.getTime(), order.createdAt)
      );

      customerMap.set(customerId, existing);
    });

    const allCustomers = Array.from(customerMap.values())
      .map((data) => {
        const daysSince = Math.floor(
          (endDate.getTime() - data.lastOrderDate.getTime()) /
            (1000 * 3600 * 24)
        );

        return {
          customerId: data.customerId,
          customerName: data.customerName,
          email: data.email,
          whatsappNumber: data.whatsappNumber,
          totalOrders: data.totalOrders,
          totalSpent: Math.round(data.totalSpent * 100) / 100,
          avgOrderValue:
            data.totalOrders > 0
              ? Math.round((data.totalSpent / data.totalOrders) * 100) / 100
              : 0,
          lastOrderDate: data.lastOrderDate,
          daysSinceLastOrder: daysSince,
          orderFrequency: this.getOrderFrequency(data.totalOrders),
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const topCustomers = allCustomers.slice(0, 10);
    const inactiveCustomers = allCustomers
      .filter((c) => c.daysSinceLastOrder > 30)
      .slice(0, 10);

    return { topCustomers, inactiveCustomers };
  }

  private getOrderFrequency(totalOrders: number): "high" | "medium" | "low" {
    if (totalOrders >= 5) return "high";
    if (totalOrders >= 2) return "medium";
    return "low";
  }

  // ============= REVENUE TREND =============

  private getRevenueTrend(
    orders: any[],
    start: Date,
    end: Date
  ): RevenueTrendDto[] {
    const trendMap = new Map<string, { revenue: number; orders: number }>();

    // Initialize all dates in range
    let current = moment(start);

    while (current.isBefore(end) || current.isSame(end, "day")) {
      const dateKey = current.format("YYYY-MM-DD");
      trendMap.set(dateKey, { revenue: 0, orders: 0 });
      current.add(1, "day");
    }

    // Populate with actual data
    orders.forEach((order) => {
      const dateKey = moment(order.createdAt).format("YYYY-MM-DD");
      const existing = trendMap.get(dateKey);

      if (existing) {
        existing.revenue += order.totalAmount || 0;
        existing.orders += 1;
      }
    });

    return Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }));
  }

  // ============= ORDER TYPE BREAKDOWN =============

  private getOrderTypeBreakdown(
    orders: any[],
    totalRevenue: number
  ): OrderTypeBreakdownDto[] {
    const typeMap = new Map<string, { count: number; revenue: number }>();

    orders.forEach((order) => {
      const type = order.orderType || "Unknown";
      const existing = typeMap.get(type) || { count: 0, revenue: 0 };

      existing.count += 1;
      existing.revenue += order.totalAmount || 0;

      typeMap.set(type, existing);
    });

    return Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        percentage: orders.length > 0 ? (data.count / orders.length) * 100 : 0,
        revenue: Math.round(data.revenue * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ============= ORDER STATUS BREAKDOWN =============

  private getOrderStatusBreakdown(
    orders: any[],
    totalRevenue: number
  ): OrderStatusBreakdownDto[] {
    const statusMap = new Map<string, { count: number; revenue: number }>();

    orders.forEach((order) => {
      const status = order.status || "Unknown";
      const existing = statusMap.get(status) || { count: 0, revenue: 0 };

      existing.count += 1;
      existing.revenue += order.totalAmount || 0;

      statusMap.set(status, existing);
    });

    return Array.from(statusMap.entries())
      .map(([status, data]) => ({
        status,
        count: data.count,
        percentage: orders.length > 0 ? (data.count / orders.length) * 100 : 0,
        revenue: Math.round(data.revenue * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ============= CATEGORY PERFORMANCE =============

  private getCategoryPerformance(
    orders: any[],
    totalRevenue: number
  ): CategoryPerformanceDto[] {
    const categoryMap = new Map<
      string,
      { count: number; revenue: number; items: number }
    >();

    let sumRevenueFromItems = 0;
    let sumItems = 0;

    orders.forEach((order, orderIndex) => {
      (order.items || []).forEach((item, itemIndex) => {
        const category = item.category || "Uncategorized";
        const itemQty = item.quantity || 0;
        const itemRevenue = (item.price || 0) * itemQty;

        sumItems += itemQty;
        sumRevenueFromItems += itemRevenue;

        const existing = categoryMap.get(category) || {
          count: 0,
          revenue: 0,
          items: 0,
        };

        existing.items += itemQty;
        existing.revenue += itemRevenue;
        existing.count += 1;

        categoryMap.set(category, existing);
      });
    });

    const result = Array.from(categoryMap.entries())
      .map(([category, data]) => {
        const percentage =
          totalRevenue > 0 ? (data.revenue / sumRevenueFromItems) * 100 : 0;

        return {
          category,
          count: data.items,
          revenue: Math.round(data.revenue * 100) / 100,
          percentage,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return result;
  }

  // ============= REPEAT CUSTOMER RATE =============

  private calculateRepeatCustomerRate(orders: any[]): number {
    const customerOrderCount = new Map<string, number>();

    orders.forEach((order) => {
      const customerId = order.userId?._id?.toString();

      if (customerId) {
        customerOrderCount.set(
          customerId,
          (customerOrderCount.get(customerId) || 0) + 1
        );
      }
    });

    const repeatCustomers = Array.from(customerOrderCount.values()).filter(
      (count) => count > 1
    ).length;

    const totalCustomers = customerOrderCount.size;

    return totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
  }

  // ============= QUICK SUMMARY =============

  async getQuickSummary(shopkeeperId: string): Promise<QuickSummaryDto> {
    const report = await this.generateAnalyticsReport(
      shopkeeperId,
      ReportPeriod.MONTHLY
    );

    return {
      totalRevenue: report.totalRevenue,
      totalOrders: report.totalOrders,
      totalCustomers: report.totalCustomers,
      avgOrderValue: report.avgOrderValue,
      repeatCustomerRate: report.repeatCustomerRate,
      topProducts: report.topProducts.slice(0, 5),
      topCustomers: report.topCustomers.slice(0, 5),
      revenueTrend: report.revenueTrend,
    };
  }

  // Transform daily data to monthly data
  private transformDailyToMonthly(revenueTrend: any[]) {
    const monthlyData: { [key: string]: any } = {};

    revenueTrend.forEach((day) => {
      const date = new Date(day.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; // 2025-12
      const monthName = date.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      }); // Dec 2025

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          date: monthName,
          revenue: 0,
          orders: 0,
        };
      }

      monthlyData[monthKey].revenue += day.revenue;
      monthlyData[monthKey].orders += day.orders;
    });

    return Object.values(monthlyData).sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }

  // For "last 3 months" - return only last 3 months
  private getLast3Months(revenueTrend: any[]) {
    const monthlyData = this.transformDailyToMonthly(revenueTrend);
    return monthlyData.slice(-3); // Last 3 months
  }

  // For "current year" - group by month for current year
  private getCurrentYearData(revenueTrend: any[]) {
    const currentYear = new Date().getFullYear();
    const yearData: any[] = [];

    for (let month = 0; month < 12; month++) {
      const monthDate = new Date(currentYear, month, 1);
      const monthName = monthDate.toLocaleString("en-US", { month: "short" });
      yearData.push({
        date: monthName,
        revenue: 0,
        orders: 0,
      });
    }

    revenueTrend.forEach((day) => {
      const date = new Date(day.date);
      if (date.getFullYear() === currentYear) {
        const monthIndex = date.getMonth();
        yearData[monthIndex].revenue += day.revenue;
        yearData[monthIndex].orders += day.orders;
      }
    });

    return yearData;
  }

  // For "last year" - group by month for previous year
  private getLastYearData(revenueTrend: any[]) {
    const lastYear = new Date().getFullYear() - 1;
    const yearData: any[] = [];

    for (let month = 0; month < 12; month++) {
      const monthDate = new Date(lastYear, month, 1);
      const monthName = monthDate.toLocaleString("en-US", { month: "short" });
      yearData.push({
        date: monthName,
        revenue: 0,
        orders: 0,
      });
    }

    revenueTrend.forEach((day) => {
      const date = new Date(day.date);
      if (date.getFullYear() === lastYear) {
        const monthIndex = date.getMonth();
        yearData[monthIndex].revenue += day.revenue;
        yearData[monthIndex].orders += day.orders;
      }
    });

    return yearData;
  }

  // ============= EXCEL EXPORT =============

  async exportToExcel(
    shopkeeperId: string,
    period: ReportPeriod,
    res: any
  ): Promise<void> {
    const report = await this.generateAnalyticsReport(shopkeeperId, period);
    const workbook = new ExcelJS.Workbook();

    this.createSummarySheet(workbook, report);
    this.createOrdersSheet(workbook, report);
    this.createProductsSheet(workbook, report);
    this.createCustomersSheet(workbook, report);
    this.createChartsDataSheet(workbook, report);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Analytics-Report-${report.shopkeeperId}-${period}-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  private createSummarySheet(
    workbook: ExcelJS.Workbook,
    report: ShopkeeperAnalyticsReportDto
  ) {
    const sheet = workbook.addWorksheet("Summary");

    let row = 1;
    sheet.mergeCells(`A${row}:D${row}`);
    const titleCell = sheet.getCell(`A${row}`);
    titleCell.value = `${report.shopName} - Analytics Report`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    row += 2;

    sheet.getCell(`A${row}`).value = "Period:";
    sheet.getCell(`B${row}`).value = `${report.period.toUpperCase()} (${moment(
      report.startDate
    ).format("DD MMM YYYY")} - ${moment(report.endDate).format(
      "DD MMM YYYY"
    )})`;

    row += 2;

    const metrics = [
      { label: "Total Revenue", value: report.totalRevenue, formatted: true },
      { label: "Total Orders", value: report.totalOrders },
      { label: "Total Customers", value: report.totalCustomers },
      { label: "Total Items Sold", value: report.totalItems },
      {
        label: "Average Order Value",
        value: report.avgOrderValue,
        formatted: true,
      },
      { label: "Average Items per Order", value: report.avgItemsPerOrder },
      {
        label: "Repeat Customer Rate (%)",
        value: report.repeatCustomerRate,
      },
      { label: "Customer Conversion Rate (%)", value: report.conversionRate },
    ];

    metrics.forEach((metric) => {
      sheet.getCell(`A${row}`).value = metric.label;
      const valueCell = sheet.getCell(`B${row}`);

      valueCell.value = metric.formatted
        ? `${report.currencySymbol}${metric.value.toLocaleString()}`
        : metric.value;

      valueCell.font = { bold: true };
      row += 1;
    });

    sheet.columns = [{ width: 25 }, { width: 20 }];
  }

  private createOrdersSheet(
    workbook: ExcelJS.Workbook,
    report: ShopkeeperAnalyticsReportDto
  ) {
    const sheet = workbook.addWorksheet("Orders");

    const headers = [
      "Order ID",
      "Date",
      "Customer Name",
      "WhatsApp",
      "Email",
      "Type",
      "Status",
      "Total",
      "Items",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    report.orders.forEach((order) => {
      const itemsList = order.items
        .map((i) => `${i.productName} (${i.quantity}x)`)
        .join(", ");

      sheet.addRow([
        order.orderId,
        moment(order.createdAt).format("DD MMM YYYY HH:mm"),
        order.customerName,
        order.whatsappNumber || "-",
        order.customerEmail || "-",
        order.orderType,
        order.status,
        `${report.currencySymbol}${order.totalPrice.toLocaleString()}`,
        itemsList,
      ]);
    });

    sheet.columns = [
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 15 },
      { width: 20 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 30 },
    ];
  }

  private createProductsSheet(
    workbook: ExcelJS.Workbook,
    report: ShopkeeperAnalyticsReportDto
  ) {
    const sheet = workbook.addWorksheet("Products");

    const headers = [
      "Rank",
      "Product Name",
      "Category",
      "Quantity Sold",
      "Revenue",
      "% of Total",
      "Avg Price",
      "Top Variant",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    report.topProducts.forEach((product) => {
      const topVariant =
        product.variants && product.variants.length > 0
          ? `${product.variants[0].variantTitle} (${product.variants[0].quantity})`
          : "-";

      sheet.addRow([
        product.rank,
        product.productName,
        product.category,
        product.totalQuantity,
        `${report.currencySymbol}${product.totalRevenue.toLocaleString()}`,
        `${product.percentage.toFixed(2)}%`,
        `${report.currencySymbol}${product.avgPrice.toLocaleString()}`,
        topVariant,
      ]);
    });

    sheet.columns = [
      { width: 8 },
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 25 },
    ];
  }

  private createCustomersSheet(
    workbook: ExcelJS.Workbook,
    report: ShopkeeperAnalyticsReportDto
  ) {
    const sheet = workbook.addWorksheet("Customers");

    const headers = [
      "Customer Name",
      "Email",
      "WhatsApp",
      "Total Orders",
      "Total Spent",
      "Avg Order Value",
      "Last Order",
      "Days Since",
      "Frequency",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    report.topCustomers.forEach((customer) => {
      sheet.addRow([
        customer.customerName,
        customer.email || "-",
        customer.whatsappNumber || "-",
        customer.totalOrders,
        `${report.currencySymbol}${customer.totalSpent.toLocaleString()}`,
        `${report.currencySymbol}${customer.avgOrderValue.toLocaleString()}`,
        moment(customer.lastOrderDate).format("DD MMM YYYY"),
        customer.daysSinceLastOrder,
        customer.orderFrequency.toUpperCase(),
      ]);
    });

    sheet.columns = [
      { width: 20 },
      { width: 22 },
      { width: 15 },
      { width: 13 },
      { width: 15 },
      { width: 16 },
      { width: 15 },
      { width: 12 },
      { width: 10 },
    ];
  }

  private createChartsDataSheet(
    workbook: ExcelJS.Workbook,
    report: ShopkeeperAnalyticsReportDto
  ) {
    // Revenue Trend Sheet
    const trendSheet = workbook.addWorksheet("Revenue Trend");
    const trendHeaders = ["Date", "Revenue", "Orders"];
    const trendHeaderRow = trendSheet.addRow(trendHeaders);
    trendHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    trendHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF70AD47" },
    };

    report.revenueTrend.forEach((trend) => {
      trendSheet.addRow([
        trend.date,
        `${report.currencySymbol}${trend.revenue.toLocaleString()}`,
        trend.orders,
      ]);
    });

    trendSheet.columns = [{ width: 15 }, { width: 15 }, { width: 10 }];

    // Order Type Breakdown Sheet
    const typeSheet = workbook.addWorksheet("Order Types");
    const typeHeaders = ["Type", "Count", "Revenue", "% of Total"];
    const typeHeaderRow = typeSheet.addRow(typeHeaders);
    typeHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    typeHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC000" },
    };

    report.orderTypeBreakdown.forEach((type) => {
      typeSheet.addRow([
        type.type,
        type.count,
        `${report.currencySymbol}${type.revenue.toLocaleString()}`,
        `${type.percentage.toFixed(2)}%`,
      ]);
    });

    typeSheet.columns = [
      { width: 15 },
      { width: 10 },
      { width: 15 },
      { width: 12 },
    ];

    // Category Performance Sheet
    const categorySheet = workbook.addWorksheet("Categories");
    const categoryHeaders = ["Category", "Items Sold", "Revenue", "% of Total"];
    const categoryHeaderRow = categorySheet.addRow(categoryHeaders);
    categoryHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    categoryHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5B9BD5" },
    };

    report.categoryPerformance.forEach((cat) => {
      categorySheet.addRow([
        cat.category,
        cat.count,
        `${report.currencySymbol}${cat.revenue.toLocaleString()}`,
        `${cat.percentage.toFixed(2)}%`,
      ]);
    });

    categorySheet.columns = [
      { width: 20 },
      { width: 12 },
      { width: 15 },
      { width: 12 },
    ];
  }

  // ============= HELPER METHODS =============

  private convertDecimalToNumber(obj: any): any {
    if (obj?.constructor?.name === "Decimal128") {
      return obj.toNumber();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertDecimalToNumber(item));
    }

    if (obj && typeof obj === "object") {
      const converted = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.convertDecimalToNumber(value);
      }
      return converted;
    }

    return obj;
  }
}
