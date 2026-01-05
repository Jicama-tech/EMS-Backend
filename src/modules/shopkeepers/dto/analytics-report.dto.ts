import { Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
  IsNotEmpty,
  Min,
  Max,
  IsBoolean,
} from "class-validator";

export enum ReportPeriod {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  LASTQUARTER = "lastquarter",
  LASTMONTH = "lastmonth",
  YEARLY = "yearly",
  LASTYEAR = "lastyear",
}

// ============= ORDER DETAILS DTO =============
export class OrderItemDetailDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsOptional()
  category: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  total: number;

  @IsString()
  @IsOptional()
  variantTitle?: string;

  @IsString()
  @IsOptional()
  subcategoryName?: string;
}

export class CategoryPerformanceDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @Min(0)
  count: number;

  @IsNumber()
  @Min(0)
  revenue: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

export class DetailedOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsString()
  @IsNotEmpty()
  orderType: string; // 'delivery' or 'pickup'

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDetailDto)
  items: OrderItemDetailDto[];
}

// ============= PRODUCT PERFORMANCE DTO =============
export class VariantPerformanceDto {
  @IsString()
  @IsNotEmpty()
  variantTitle: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  revenue: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

export class ProductPerformanceDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @Min(0)
  totalQuantity: number;

  @IsNumber()
  @Min(0)
  totalRevenue: number;

  @IsNumber()
  @Min(0)
  avgPrice: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;

  @IsNumber()
  @Min(1)
  rank: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantPerformanceDto)
  @IsOptional()
  variants?: VariantPerformanceDto[];
}

// ============= CUSTOMER PERFORMANCE DTO =============
export class CustomerPerformanceDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsNumber()
  @Min(0)
  totalOrders: number;

  @IsNumber()
  @Min(0)
  totalSpent: number;

  @IsNumber()
  @Min(0)
  avgOrderValue: number;

  @IsDate()
  @Type(() => Date)
  lastOrderDate: Date;

  @IsNumber()
  @Min(0)
  daysSinceLastOrder: number;

  @IsString()
  @IsEnum(["high", "medium", "low"])
  orderFrequency: "high" | "medium" | "low";
}

// ============= SUMMARY METRICS DTO =============
export class RevenueTrendDto {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @Min(0)
  revenue: number;

  @IsNumber()
  @Min(0)
  orders: number;
}

export class OrderTypeBreakdownDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @Min(0)
  count: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;

  @IsNumber()
  @Min(0)
  revenue: number;
}

export class OrderStatusBreakdownDto {
  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  @Min(0)
  count: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;

  @IsNumber()
  @Min(0)
  revenue: number;
}

// ============= COMPLETE REPORT DTO =============
export class ShopkeeperAnalyticsReportDto {
  @IsString()
  @IsNotEmpty()
  shopkeeperId: string;

  @IsString()
  @IsNotEmpty()
  shopName: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  currencySymbol: string;

  @IsEnum(ReportPeriod)
  period: ReportPeriod;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsDate()
  @Type(() => Date)
  generatedAt: Date;

  // === SUMMARY METRICS ===
  @IsNumber()
  @Min(0)
  totalRevenue: number;

  @IsNumber()
  @Min(0)
  totalOrders: number;

  @IsNumber()
  @Min(0)
  totalCustomers: number;

  @IsNumber()
  @Min(0)
  totalItems: number;

  @IsNumber()
  @Min(0)
  avgOrderValue: number;

  @IsNumber()
  @Min(0)
  avgItemsPerOrder: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  repeatCustomerRate: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  conversionRate: number;

  // === DETAILED DATA ===
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetailedOrderDto)
  orders: DetailedOrderDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPerformanceDto)
  topProducts: ProductPerformanceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPerformanceDto)
  bottomProducts: ProductPerformanceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerPerformanceDto)
  topCustomers: CustomerPerformanceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerPerformanceDto)
  inactiveCustomers: CustomerPerformanceDto[];

  // === CHART DATA ===
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RevenueTrendDto)
  revenueTrend: RevenueTrendDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderTypeBreakdownDto)
  orderTypeBreakdown: OrderTypeBreakdownDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderStatusBreakdownDto)
  orderStatusBreakdown: OrderStatusBreakdownDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryPerformanceDto)
  categoryPerformance: CategoryPerformanceDto[];
}

// ============= QUICK SUMMARY DTO =============
export class QuickSummaryDto {
  @IsNumber()
  @Min(0)
  totalRevenue: number;

  @IsNumber()
  @Min(0)
  totalOrders: number;

  @IsNumber()
  @Min(0)
  totalCustomers: number;

  @IsNumber()
  @Min(0)
  avgOrderValue: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  repeatCustomerRate: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPerformanceDto)
  topProducts: ProductPerformanceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerPerformanceDto)
  topCustomers: CustomerPerformanceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RevenueTrendDto)
  revenueTrend: RevenueTrendDto[];
}

// ============= EXPORT REQUEST DTO =============
export class ExportReportRequestDto {
  @IsEnum(ReportPeriod)
  @IsNotEmpty()
  period: ReportPeriod;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsEnum(["excel", "csv", "pdf"])
  @IsNotEmpty()
  format: "excel" | "csv" | "pdf";
}

// ============= RESPONSE WRAPPERS DTO =============
export class AnalyticsReportResponseDto {
  @IsBoolean()
  success: boolean;

  @IsString()
  @IsOptional()
  message?: string;

  @ValidateNested()
  @Type(() => ShopkeeperAnalyticsReportDto)
  data: ShopkeeperAnalyticsReportDto;

  @IsDate()
  @Type(() => Date)
  timestamp: Date;
}

export class AnalyticsQuickSummaryResponseDto {
  @IsBoolean()
  success: boolean;

  @ValidateNested()
  @Type(() => QuickSummaryDto)
  data: QuickSummaryDto;

  @IsDate()
  @Type(() => Date)
  timestamp: Date;
}

export class AnalyticsErrorResponseDto {
  @IsBoolean()
  success: boolean;

  @IsString()
  @IsNotEmpty()
  error: string;

  @IsDate()
  @Type(() => Date)
  timestamp: Date;
}
