import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { InjectModel } from "@nestjs/mongoose/dist";
import { Product, ProductDocument } from "./entities/product.entity";
import { Model, Types } from "mongoose";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

@Injectable()
export class ProductsService {
  private readonly CATEGORIES = [
    "Apparel",
    "Drinkware",
    "Accessories",
    "Electronics",
    "Sports & Recreation",
    "Art & Crafts",
    "Food & Beverage",
    "Other",
  ];

  private readonly STATUSES = ["active", "draft", "archived"];

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>
  ) {}

  async create(
    createProductDto: CreateProductDto,
    shopkeeperId: string
  ): Promise<Product> {
    try {
      // Limit images to 3
      if (createProductDto.images && createProductDto.images.length > 3) {
        createProductDto.images = createProductDto.images.slice(0, 3);
      }

      const newProduct = new this.productModel({
        ...createProductDto,
        shopkeeperId,
      });
      return await newProduct.save();
    } catch (error) {
      console.error("Error creating product:", error);
      throw new HttpException(
        `Failed to create product: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async findAll(): Promise<Product[]> {
    try {
      return await this.productModel.find().exec();
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve products: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async findByShopkeeper(shopkeeperId: string): Promise<Product[]> {
    try {
      return await this.productModel.find({ shopkeeperId }).exec();
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve products for shopkeeper: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getShopkeeperProducts(shopkeeperId: string) {
    try {
      const shopkeeperObjectId = new Types.ObjectId(shopkeeperId);
      const products = await this.productModel.find({
        shopkeeperId: shopkeeperId,
      });
      if (!products) {
        throw new BadRequestException("No products found");
      }
      return { message: "Products found", data: products };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async findOne(id: string): Promise<Product> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid product ID");
      }

      const product = await this.productModel.findById(id).exec();
      if (!product) {
        throw new NotFoundException("Product not found");
      }
      return product;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new HttpException(
        `Failed to retrieve product: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto
  ): Promise<Product> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid product ID");
      }

      // Limit images to 3
      if (updateProductDto.images && updateProductDto.images.length > 3) {
        updateProductDto.images = updateProductDto.images.slice(0, 3);
      }

      const updatedProduct = await this.productModel
        .findByIdAndUpdate(id, updateProductDto, { new: true })
        .exec();

      if (!updatedProduct) {
        throw new NotFoundException("Product not found");
      }
      return updatedProduct;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new HttpException(
        `Failed to update product: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async remove(id: string): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid product ID");
      }

      const result = await this.productModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new NotFoundException("Product not found");
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete product: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async generateExcelTemplate(shopkeeperId: string): Promise<Buffer> {
    try {
      console.log(
        `🎯 Generating Excel template for shopkeeper: ${shopkeeperId}`
      );

      const products = await this.productModel.find({
        shopkeeperId: shopkeeperId,
      });

      const excelData = [];

      // Process existing products
      products.forEach((product) => {
        const images = (product.images || []).slice(0, 3);
        const imageData = {
          "Image 1": images[0] || "",
          "Image 2": images[1] || "",
          "Image 3": images[2] || "",
        };

        if (product.subcategories && product.subcategories.length > 0) {
          let isFirstRow = true;

          product.subcategories.forEach((subcat) => {
            if (subcat.variants && subcat.variants.length > 0) {
              subcat.variants.forEach((variant) => {
                excelData.push({
                  "Product ID": product._id?.toString() || "",
                  "Product Name": isFirstRow ? product.name || "" : "",
                  "Product Description": isFirstRow
                    ? product.description || ""
                    : "",
                  "Product Category": isFirstRow ? product.category || "" : "",
                  "Product Status": isFirstRow
                    ? product.status || "active"
                    : "",
                  "Product Price": isFirstRow ? product.price || 0 : "",
                  "Product SKU": isFirstRow ? product.sku || "" : "",
                  "Product Tags": isFirstRow
                    ? Array.isArray(product.tags)
                      ? product.tags.join(", ")
                      : ""
                    : "",
                  "Product Weight": isFirstRow ? product.weight || "" : "",
                  "Product Inventory": isFirstRow ? product.inventory || 0 : "",
                  "Product Track Quantity": isFirstRow
                    ? product.trackQuantity
                      ? "TRUE"
                      : "FALSE"
                    : "",
                  "Product Low Stock Threshold": isFirstRow
                    ? product.lowstockThreshold || 10
                    : "",
                  ...imageData,
                  "Subcategory Name": subcat.name || "",
                  "Subcategory Description": subcat.description || "",
                  "Variant Title": variant.title || "",
                  "Variant Price": variant.price || 0,
                  "Variant Compare At Price": variant.compareAtPrice || "",
                  "Variant SKU": variant.sku || "",
                  "Variant Barcode": variant.barcode || "",
                  "Variant Inventory": variant.inventory || 0,
                  "Variant Low Stock Threshold":
                    variant.lowstockThreshold || 10,
                  "Variant Track Quantity": variant.trackQuantity
                    ? "TRUE"
                    : "FALSE",
                  "Variant Options": variant.options
                    ? JSON.stringify(variant.options)
                    : "{}",
                });
                if (isFirstRow) {
                  imageData["Image 1"] = "";
                  imageData["Image 2"] = "";
                  imageData["Image 3"] = "";
                  isFirstRow = false;
                }
              });
            }
          });
        } else {
          // Product without subcategories - use product-level inventory
          excelData.push({
            "Product ID": product._id?.toString() || "",
            "Product Name": product.name || "",
            "Product Description": product.description || "",
            "Product Category": product.category || "",
            "Product Status": product.status || "active",
            "Product Price": product.price || 0,
            "Product SKU": product.sku || "",
            "Product Tags": Array.isArray(product.tags)
              ? product.tags.join(", ")
              : "",
            "Product Weight": product.weight || "",
            "Product Inventory": product.inventory || 0,
            "Product Track Quantity": product.trackQuantity ? "TRUE" : "FALSE",
            "Product Low Stock Threshold": product.lowstockThreshold || 10,
            ...imageData,
            "Subcategory Name": "",
            "Subcategory Description": "",
            "Variant Title": "",
            "Variant Price": 0,
            "Variant Compare At Price": "",
            "Variant SKU": "",
            "Variant Barcode": "",
            "Variant Inventory": 0,
            "Variant Low Stock Threshold": 10,
            "Variant Track Quantity": "TRUE",
            "Variant Options": "{}",
          });
        }
      });

      // Add demo product when no products exist
      if (products.length === 0) {
        // Demo product with 2 subcategories, each with 2 variants, 3 images
        const demoProduct = [
          // Row 1: Premium T-Shirt Collection - Size Small variants
          {
            "Product ID": "",
            "Product Name": "Premium T-Shirt Collection",
            "Product Description":
              "High-quality cotton t-shirts with modern design and comfortable fit",
            "Product Category": "Apparel",
            "Product Status": "active",
            "Product Price": 25.99,
            "Product SKU": "TSH-PREM-001",
            "Product Tags": "premium, cotton, comfortable, modern",
            "Product Weight": 200,
            "Product Inventory": 0,
            "Product Track Quantity": "FALSE",
            "Product Low Stock Threshold": 5,
            "Image 1": "https://drive.google.com/file/d/example1/view",
            "Image 2": "https://drive.google.com/file/d/example2/view",
            "Image 3": "https://drive.google.com/file/d/example3/view",
            "Subcategory Name": "Basic Colors",
            "Subcategory Description": "Essential solid color t-shirts",
            "Variant Title": "Small - Black",
            "Variant Price": 24.99,
            "Variant Compare At Price": 29.99,
            "Variant SKU": "TSH-PREM-S-BLK",
            "Variant Barcode": "123456789001",
            "Variant Inventory": 50,
            "Variant Low Stock Threshold": 10,
            "Variant Track Quantity": "TRUE",
            "Variant Options": JSON.stringify({
              size: "Small",
              color: "Black",
            }),
          },
          {
            "Product ID": "",
            "Product Name": "",
            "Product Description": "",
            "Product Category": "",
            "Product Status": "",
            "Product Price": "",
            "Product SKU": "",
            "Product Tags": "",
            "Product Weight": "",
            "Product Inventory": "",
            "Product Track Quantity": "",
            "Product Low Stock Threshold": "",
            "Image 1": "",
            "Image 2": "",
            "Image 3": "",
            "Subcategory Name": "",
            "Subcategory Description": "",
            "Variant Title": "Small - White",
            "Variant Price": 24.99,
            "Variant Compare At Price": 29.99,
            "Variant SKU": "TSH-PREM-S-WHT",
            "Variant Barcode": "123456789002",
            "Variant Inventory": 45,
            "Variant Low Stock Threshold": 10,
            "Variant Track Quantity": "TRUE",
            "Variant Options": JSON.stringify({
              size: "Small",
              color: "White",
            }),
          },
          // Premium Colors subcategory
          {
            "Product ID": "",
            "Product Name": "",
            "Product Description": "",
            "Product Category": "",
            "Product Status": "",
            "Product Price": "",
            "Product SKU": "",
            "Product Tags": "",
            "Product Weight": "",
            "Product Inventory": "",
            "Product Track Quantity": "",
            "Product Low Stock Threshold": "",
            "Image 1": "",
            "Image 2": "",
            "Image 3": "",
            "Subcategory Name": "Premium Colors",
            "Subcategory Description": "Special edition colors and patterns",
            "Variant Title": "Medium - Navy Blue",
            "Variant Price": 27.99,
            "Variant Compare At Price": 32.99,
            "Variant SKU": "TSH-PREM-M-NVY",
            "Variant Barcode": "123456789003",
            "Variant Inventory": 30,
            "Variant Low Stock Threshold": 8,
            "Variant Track Quantity": "TRUE",
            "Variant Options": JSON.stringify({
              size: "Medium",
              color: "Navy Blue",
            }),
          },
          {
            "Product ID": "",
            "Product Name": "",
            "Product Description": "",
            "Product Category": "",
            "Product Status": "",
            "Product Price": "",
            "Product SKU": "",
            "Product Tags": "",
            "Product Weight": "",
            "Product Inventory": "",
            "Product Track Quantity": "",
            "Product Low Stock Threshold": "",
            "Image 1": "",
            "Image 2": "",
            "Image 3": "",
            "Subcategory Name": "",
            "Subcategory Description": "",
            "Variant Title": "Large - Burgundy",
            "Variant Price": 27.99,
            "Variant Compare At Price": 32.99,
            "Variant SKU": "TSH-PREM-L-BUR",
            "Variant Barcode": "123456789004",
            "Variant Inventory": 25,
            "Variant Low Stock Threshold": 8,
            "Variant Track Quantity": "TRUE",
            "Variant Options": JSON.stringify({
              size: "Large",
              color: "Burgundy",
            }),
          },
        ];
        excelData.push(...demoProduct);
      }

      // Add empty rows for new products
      for (let i = 0; i < 20; i++) {
        excelData.push({
          "Product ID": "",
          "Product Name": "",
          "Product Description": "",
          "Product Category": "",
          "Product Status": "active",
          "Product Price": 0,
          "Product SKU": "",
          "Product Tags": "",
          "Product Weight": "",
          "Product Inventory": 0,
          "Product Track Quantity": "TRUE",
          "Product Low Stock Threshold": 10,
          "Image 1": "",
          "Image 2": "",
          "Image 3": "",
          "Subcategory Name": "",
          "Subcategory Description": "",
          "Variant Title": "",
          "Variant Price": 0,
          "Variant Compare At Price": "",
          "Variant SKU": "",
          "Variant Barcode": "",
          "Variant Inventory": 0,
          "Variant Low Stock Threshold": 10,
          "Variant Track Quantity": "TRUE",
          "Variant Options": "{}",
        });
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 25 }, // Product ID
        { wch: 30 }, // Product Name
        { wch: 40 }, // Product Description
        { wch: 15 }, // Product Category
        { wch: 12 }, // Product Status
        { wch: 12 }, // Product Price
        { wch: 20 }, // Product SKU
        { wch: 30 }, // Product Tags
        { wch: 10 }, // Product Weight
        { wch: 12 }, // Product Inventory
        { wch: 15 }, // Product Track Quantity
        { wch: 15 }, // Product Low Stock Threshold
        { wch: 50 }, // Image 1
        { wch: 50 }, // Image 2
        { wch: 50 }, // Image 3
        { wch: 20 }, // Subcategory Name
        { wch: 30 }, // Subcategory Description
        { wch: 20 }, // Variant Title
        { wch: 12 }, // Variant Price
        { wch: 12 }, // Variant Compare At Price
        { wch: 20 }, // Variant SKU
        { wch: 15 }, // Variant Barcode
        { wch: 12 }, // Variant Inventory
        { wch: 15 }, // Variant Low Stock Threshold
        { wch: 15 }, // Variant Track Quantity
        { wch: 30 }, // Variant Options
      ];
      worksheet["!cols"] = colWidths;

      // Create dropdown data sheets
      const categorySheet = XLSX.utils.aoa_to_sheet([
        ["Categories"],
        ...this.CATEGORIES.map((cat) => [cat]),
      ]);

      const statusSheet = XLSX.utils.aoa_to_sheet([
        ["Statuses"],
        ...this.STATUSES.map((status) => [status]),
      ]);

      const trackQuantitySheet = XLSX.utils.aoa_to_sheet([
        ["TrackQuantity"],
        ["TRUE"],
        ["FALSE"],
      ]);

      // Calculate merges for products
      const merges = this.calculateMerges(excelData);
      if (merges.length > 0) {
        worksheet["!merges"] = merges;
      }

      // Get the data range
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      const totalRows = range.e.r + 1;

      // Apply data validations with working dropdowns
      if (!worksheet["!dataValidation"]) {
        worksheet["!dataValidation"] = [];
      }

      // Add validations for each data row (starting from row 2)
      for (let row = 2; row <= totalRows; row++) {
        // Product Category validation (column D)
        worksheet["!dataValidation"].push({
          sqref: `D${row}`,
          type: "list",
          allowBlank: true,
          formula1: `Categories!$A$2:$A$${this.CATEGORIES.length + 1}`,
          showInputMessage: true,
          promptTitle: "Category Selection",
          prompt: "Please select a category from the dropdown list.",
          showErrorMessage: true,
          errorTitle: "Invalid Category",
          error: "Please select a valid category from the list.",
        });

        // Product Status validation (column E)
        worksheet["!dataValidation"].push({
          sqref: `E${row}`,
          type: "list",
          allowBlank: false,
          formula1: `Statuses!$A$2:$A$${this.STATUSES.length + 1}`,
          showInputMessage: true,
          promptTitle: "Status Selection",
          prompt: "Please select a status from the dropdown list.",
          showErrorMessage: true,
          errorTitle: "Invalid Status",
          error: "Please select a valid status from the list.",
        });

        // Product Track Quantity validation (column K)
        worksheet["!dataValidation"].push({
          sqref: `K${row}`,
          type: "list",
          allowBlank: false,
          formula1: "TrackQuantity!$A$2:$A$3",
          showInputMessage: true,
          promptTitle: "Track Quantity",
          prompt: "Select TRUE to track quantity, FALSE otherwise.",
          showErrorMessage: true,
          errorTitle: "Invalid Value",
          error: "Please select either TRUE or FALSE.",
        });

        // Variant Track Quantity validation (column Y)
        worksheet["!dataValidation"].push({
          sqref: `Y${row}`,
          type: "list",
          allowBlank: false,
          formula1: "TrackQuantity!$A$2:$A$3",
          showInputMessage: true,
          promptTitle: "Variant Track Quantity",
          prompt: "Select TRUE to track quantity, FALSE otherwise.",
          showErrorMessage: true,
          errorTitle: "Invalid Value",
          error: "Please select either TRUE or FALSE.",
        });
      }

      // Create enhanced instructions sheet
      const instructions = [
        ["🏪 PROFESSIONAL BULK PRODUCT IMPORT SYSTEM"],
        [""],
        ["📋 OVERVIEW"],
        [
          "This Excel template supports advanced bulk product import with merged cells",
        ],
        ["for professional organization and working dropdown validations."],
        ["✅ MAXIMUM 3 IMAGES PER PRODUCT"],
        ["✅ PRODUCT-LEVEL INVENTORY (when no variants)"],
        ["✅ VARIANT-LEVEL INVENTORY (when variants exist)"],
        ["✅ WORKING DROPDOWNS for Category, Status, Track Quantity"],
        [""],
        ["🔄 HOW IT WORKS"],
        ["• Products with 'Product ID' → UPDATED with new information"],
        ["• Products without 'Product ID' → CREATED as new products"],
        ["• Each row represents one variant of a product"],
        ["• Product information is merged across variant rows"],
        ["• If NO subcategories/variants: Use Product-level inventory fields"],
        [
          "• If subcategories/variants exist: Use Variant-level inventory fields",
        ],
        [""],
        ["📊 DEMO PRODUCT INCLUDED"],
        ["When no products exist, template includes demo:"],
        ["• Product: 'Premium T-Shirt Collection'"],
        ["• 2 Subcategories: 'Basic Colors', 'Premium Colors'"],
        ["• 4 Variants: 2 variants per subcategory"],
        ["• 3 Sample Images: Google Drive URL format"],
        ["• Complete inventory management example"],
        [""],
        ["✅ REQUIRED FIELDS"],
        ["• Product Name - Name of the product (merged for variants)"],
        ["• Product Category - MUST select from dropdown (Column D)"],
        ["• Product Status - MUST select from dropdown (Column E)"],
        ["• Product Price - Base price for the product"],
        ["• Product SKU - Unique identifier for product"],
        [""],
        ["📝 INVENTORY MANAGEMENT - TWO MODES"],
        [""],
        ["🏷️ MODE 1: PRODUCT-LEVEL (No Subcategories/Variants)"],
        ["Use these fields when product has no variants:"],
        ["• Product Inventory - Stock quantity"],
        ["• Product Track Quantity - TRUE/FALSE dropdown (Column K)"],
        ["• Product Low Stock Threshold - Minimum stock alert"],
        [""],
        ["🎯 MODE 2: VARIANT-LEVEL (With Subcategories/Variants)"],
        ["Use these fields when product has variants:"],
        ["• Subcategory Name - Group variants into subcategories"],
        ["• Variant Title - Name/description of the variant"],
        ["• Variant Price - Price for this specific variant"],
        ["• Variant SKU - Unique identifier for variant"],
        ["• Variant Inventory - Stock quantity for variant"],
        ["• Variant Track Quantity - TRUE/FALSE dropdown (Column Y)"],
        ["• Variant Low Stock Threshold - Minimum stock alert"],
        [""],
        ["🎯 DROPDOWN VALIDATIONS - FULLY WORKING"],
        ["Product Category Options (Column D):"],
        ...this.CATEGORIES.map((cat) => [`• ${cat}`]),
        [""],
        ["Product Status Options (Column E):"],
        ["• active - Visible to customers"],
        ["• draft - Hidden from customers"],
        ["• archived - Archived products"],
        [""],
        ["Track Quantity Options (Columns K & Y):"],
        ["• TRUE - System will track inventory"],
        ["• FALSE - No inventory tracking"],
        [""],
        ["🖼️ IMAGE HANDLING (MAX 3 PER PRODUCT)"],
        ["• EXACTLY 3 image columns: Image 1, Image 2, Image 3"],
        ["• Use Google Drive shareable links"],
        ["• Images are merged across product variants"],
        ["• Example: https://drive.google.com/file/d/ABC123/view"],
        ["• System automatically downloads and stores images"],
        ["• Supports: JPG, PNG, GIF, WebP formats"],
        [""],
        ["📦 MERGED CELLS STRUCTURE"],
        ["Product Information (Merged across variants):"],
        ["• Product ID, Name, Description, Category, Status"],
        ["• Product Price, SKU, Tags, Weight"],
        ["• Product Inventory, Track Quantity, Low Stock Threshold"],
        ["• Image 1, Image 2, Image 3"],
        [""],
        ["Variant Information (Individual rows):"],
        ["• Subcategory Name & Description"],
        ["• Variant Title, Price, SKU, Inventory"],
        ["• Variant Track Quantity, Options, Barcode"],
        [""],
        ["⚠️ IMPORTANT RULES"],
        ["• Do NOT modify column headers"],
        ["• Save as Excel (.xlsx) format only"],
        ["• Maximum file size: 10MB"],
        ["• MUST use dropdowns for Category, Status, and Track Quantity"],
        ["• Each variant needs a unique SKU"],
        ["• Use proper JSON format for variant options"],
        ["• MAXIMUM 3 images per product"],
        ["• Delete this Instructions sheet before uploading"],
        [""],
        ["📊 INVENTORY LOGIC"],
        ["🔄 If product has NO subcategories/variants:"],
        ["   → Use Product Inventory, Product Track Quantity fields"],
        ["   → Variant inventory fields are ignored"],
        [""],
        ["🔄 If product has subcategories/variants:"],
        ["   → Use Variant Inventory, Variant Track Quantity fields"],
        ["   → Product-level inventory fields are ignored"],
        ["   → Each variant manages its own stock"],
        [""],
        ["🎯 STOREFRONT BEHAVIOR"],
        ["• No variants: Shows product price & inventory"],
        ["• With variants: Shows variant prices & individual stocks"],
        ["• Stock tracking: Respects Track Quantity setting"],
        ["• Low stock alerts: Uses threshold values"],
        [""],
        ["📊 DEMO PRODUCT EXAMPLE (when no products exist)"],
        ["Premium T-Shirt Collection:"],
        ["├── Basic Colors (Subcategory)"],
        ["│   ├── Small - Black ($24.99, 50 in stock)"],
        ["│   └── Small - White ($24.99, 45 in stock)"],
        ["└── Premium Colors (Subcategory)"],
        ["    ├── Medium - Navy Blue ($27.99, 30 in stock)"],
        ["    └── Large - Burgundy ($27.99, 25 in stock)"],
        [""],
        ["🚀 READY TO IMPORT"],
        ["1. Fill in your product data using merged structure"],
        ["2. Use dropdown menus for Category, Status, Track Quantity"],
        ["3. Choose inventory mode: Product-level OR Variant-level"],
        ["4. Ensure maximum 3 images per product"],
        ["5. Save this file as .xlsx format"],
        ["6. Delete this Instructions sheet"],
        ["7. Upload using the 'Import Excel' button"],
      ];

      const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
      instructionsSheet["!cols"] = [{ wch: 85 }];

      // Add all sheets to workbook
      XLSX.utils.book_append_sheet(
        workbook,
        instructionsSheet,
        "📋 Instructions & Demo"
      );
      XLSX.utils.book_append_sheet(workbook, worksheet, "📊 Products Data");
      XLSX.utils.book_append_sheet(workbook, categorySheet, "Categories");
      XLSX.utils.book_append_sheet(workbook, statusSheet, "Statuses");
      XLSX.utils.book_append_sheet(
        workbook,
        trackQuantitySheet,
        "TrackQuantity"
      );

      // Generate buffer
      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
        compression: true,
        bookSST: false,
      });

      console.log(
        `✅ Excel template generated successfully (${buffer.length} bytes) with demo product, merged cells and working dropdowns`
      );
      return buffer;
    } catch (error) {
      console.error("❌ Error generating Excel template:", error);
      throw new HttpException(
        `Failed to generate Excel template: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private calculateMerges(data: any[]): any[] {
    const merges = [];
    let currentProductId = null;
    let mergeStart = 1; // Start from row 1 (0-indexed, so Excel row 2)

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const productId = row["Product ID"] || row["Product Name"];

      if (productId && productId !== currentProductId) {
        // End previous merge if needed
        if (currentProductId && i > mergeStart + 1) {
          this.addProductMerges(merges, mergeStart, i);
        }

        // Start new product merge
        currentProductId = productId;
        mergeStart = i + 1; // +1 because Excel is 1-indexed and we have header
      } else if (!productId && currentProductId) {
        // End merge for current product
        this.addProductMerges(merges, mergeStart, i);
        currentProductId = null;
      }
    }

    // Handle last product
    if (currentProductId && data.length > mergeStart) {
      this.addProductMerges(merges, mergeStart, data.length);
    }

    return merges;
  }

  private addProductMerges(merges: any[], startRow: number, endRow: number) {
    if (endRow - startRow <= 1) return; // No need to merge single rows

    // Product columns to merge: A through O (0-14)
    const productColumns = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

    productColumns.forEach((col) => {
      merges.push({
        s: { c: col, r: startRow },
        e: { c: col, r: endRow - 1 },
      });
    });
  }

  // Enhanced image download function
  private async downloadAndSaveImage(
    googleDriveUrl: string,
    productName: string,
    index: number
  ): Promise<string> {
    try {
      console.log(`📥 Downloading image ${index + 1} for "${productName}"`);

      let fileId: string;
      const patterns = [
        /\/d\/([a-zA-Z0-9-_]+)/, // Standard format
        /id=([a-zA-Z0-9-_]+)/, // Query parameter format
        /\/file\/d\/([a-zA-Z0-9-_]+)/, // Alternative format
      ];

      for (const pattern of patterns) {
        const match = googleDriveUrl.match(pattern);
        if (match) {
          fileId = match[1];
          break;
        }
      }

      if (!fileId) {
        console.warn(
          `⚠️ Could not extract file ID from URL: ${googleDriveUrl}`
        );
        return googleDriveUrl;
      }

      const downloadUrls = [
        `https://drive.google.com/uc?export=download&id=${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        `https://lh3.googleusercontent.com/d/${fileId}=w1000`,
      ];

      const uploadsDir = path.join(process.cwd(), "uploads", "products");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      let response;

      for (const url of downloadUrls) {
        try {
          response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 45000,
            maxRedirects: 5,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });
          break;
        } catch (err) {
          console.warn(`⚠️ Failed to download from ${url}, trying next...`);
          continue;
        }
      }

      if (!response || response.data.length < 1000) {
        throw new Error("Download failed or file too small");
      }

      let extension = "jpg";
      const contentType = response.headers["content-type"];
      if (contentType) {
        if (contentType.includes("png")) extension = "png";
        else if (contentType.includes("jpeg") || contentType.includes("jpg"))
          extension = "jpg";
        else if (contentType.includes("gif")) extension = "gif";
        else if (contentType.includes("webp")) extension = "webp";
      }

      const timestamp = Date.now();
      const cleanProductName = productName
        .replace(/[^a-zA-Z0-9]/g, "_")
        .toLowerCase()
        .substring(0, 15);
      const filename = `${cleanProductName}_${timestamp}_${index}.${extension}`;
      const filepath = path.join(uploadsDir, filename);

      fs.writeFileSync(filepath, response.data);
      console.log(
        `✅ Successfully saved image: ${filename} (${response.data.length} bytes)`
      );

      return `/uploads/products/${filename}`;
    } catch (error) {
      console.error(`❌ Error downloading image:`, {
        url: googleDriveUrl,
        error: error.message,
        productName,
        index,
      });
      return googleDriveUrl;
    }
  }

  // Enhanced Excel import with product-level inventory support
  async importFromExcel(buffer: Buffer, shopkeeperId: string): Promise<any> {
    try {
      console.log(`🚀 Starting Excel import for shopkeeper: ${shopkeeperId}`);

      const workbook = XLSX.read(buffer, { type: "buffer" });
      let worksheet =
        workbook.Sheets["📊 Products Data"] ||
        workbook.Sheets["Products Data"] ||
        workbook.Sheets["Products"] ||
        workbook.Sheets[workbook.SheetNames[0]];

      if (!worksheet) {
        throw new Error(
          'No valid product data sheet found. Please ensure your Excel file contains a "Products Data" sheet.'
        );
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        created: 0,
        updated: 0,
        errors: [],
        warnings: [],
        totalRows: jsonData.length,
        processedImages: 0,
        skippedRows: 0,
      };

      console.log(`📊 Processing ${jsonData.length} rows...`);

      // Group rows by Product ID/Name for batch processing
      const productGroups = new Map();

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const rowNumber = i + 2;

        try {
          if (
            !row["Product Name"] ||
            row["Product Name"].toString().trim() === ""
          ) {
            results.skippedRows++;
            continue;
          }

          const productKey =
            row["Product ID"] || row["Product Name"].toString().trim();
          if (!productGroups.has(productKey)) {
            productGroups.set(productKey, {
              productData: null,
              variants: [],
              rows: [],
            });
          }

          productGroups.get(productKey).rows.push({ row, rowNumber });
        } catch (error) {
          results.errors.push({
            row: rowNumber,
            error: `Error processing row: ${error.message}`,
            productName: row["Product Name"] || "Unknown",
          });
        }
      }

      // Process each product group
      for (const [productKey, group] of productGroups) {
        try {
          await this.processProductGroupWithInventory(
            productKey,
            group,
            results,
            shopkeeperId
          );
        } catch (error) {
          console.error(
            `❌ Error processing product group ${productKey}:`,
            error
          );
          results.errors.push({
            row: "Multiple",
            error: `Error processing product "${productKey}": ${error.message}`,
            productName: productKey,
          });
        }
      }

      const message = `🎉 Import completed! Created: ${results.created} products, Updated: ${results.updated} products, Processed Images: ${results.processedImages}, Errors: ${results.errors.length}, Warnings: ${results.warnings.length}`;

      console.log(`✅ Import summary: ${message}`);

      return {
        success: true,
        message,
        results,
      };
    } catch (error) {
      console.error("💥 Excel import failed:", error);
      throw new HttpException(
        `Import failed: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async processProductGroupWithInventory(
    productKey: string,
    group: any,
    results: any,
    shopkeeperId: string
  ) {
    const firstRow = group.rows[0].row;
    let processedImages = [];

    try {
      // Process images from 3 columns (limit to 3)
      const imageColumns = ["Image 1", "Image 2", "Image 3"];
      for (let imgIndex = 0; imgIndex < imageColumns.length; imgIndex++) {
        const imageUrl = firstRow[imageColumns[imgIndex]]?.toString().trim();
        if (imageUrl && imageUrl.length > 0) {
          if (imageUrl.includes("drive.google.com")) {
            try {
              const savedPath = await this.downloadAndSaveImage(
                imageUrl,
                firstRow["Product Name"],
                imgIndex
              );
              processedImages.push(savedPath);
              results.processedImages++;
            } catch (imgError) {
              results.warnings.push({
                productName: firstRow["Product Name"],
                warning: `Failed to download ${imageColumns[imgIndex]}: ${imgError.message}`,
              });
              processedImages.push(imageUrl);
            }
          } else {
            processedImages.push(imageUrl);
          }
        }
      }

      // Limit to 3 images
      processedImages = processedImages.slice(0, 3);

      // Validate required fields
      if (
        !firstRow["Product Category"] ||
        !this.CATEGORIES.includes(firstRow["Product Category"])
      ) {
        throw new Error(
          `Invalid category. Must be one of: ${this.CATEGORIES.join(", ")}`
        );
      }

      // Process tags
      const tags = firstRow["Product Tags"]
        ? firstRow["Product Tags"]
            .toString()
            .split(",")
            .map((tag: string) => tag.trim())
            .filter((tag) => tag.length > 0)
        : [];

      // Check if product has variants
      const hasVariants = group.rows.some(
        (rowData) =>
          rowData.row["Variant Title"] &&
          rowData.row["Variant Title"].toString().trim() !== ""
      );

      let processedSubcategories = [];
      let productInventory = 0;
      let productTrackQuantity = true;
      let productLowStockThreshold = 10;

      if (hasVariants) {
        // Process variants
        const subcategoryMap = new Map();

        group.rows.forEach((rowData, idx) => {
          const row = rowData.row;
          const rowNumber = rowData.rowNumber;

          try {
            if (
              !row["Variant Title"] ||
              row["Variant Title"].toString().trim() === ""
            ) {
              return;
            }

            const subcatName =
              row["Subcategory Name"]?.toString().trim() || "Default";

            if (!subcategoryMap.has(subcatName)) {
              subcategoryMap.set(subcatName, {
                id: Date.now() + idx,
                name: subcatName,
                description:
                  row["Subcategory Description"]?.toString() ||
                  `${subcatName} variants`,
                variants: [],
              });
            }

            const variantPrice = parseFloat(row["Variant Price"]);
            if (isNaN(variantPrice) || variantPrice < 0) {
              throw new Error(`Invalid variant price: ${row["Variant Price"]}`);
            }

            const inventory = parseInt(row["Variant Inventory"]) || 0;
            const trackQuantityStr = row["Variant Track Quantity"]
              ?.toString()
              .toUpperCase();
            const trackQuantity = trackQuantityStr === "TRUE";

            if (trackQuantityStr !== "TRUE" && trackQuantityStr !== "FALSE") {
              results.warnings.push({
                productName: firstRow["Product Name"],
                warning: `Invalid variant track quantity value "${row["Variant Track Quantity"]}" in row ${rowNumber}, defaulting to TRUE`,
              });
            }

            let variantOptions = {};
            if (
              row["Variant Options"] &&
              row["Variant Options"].toString().trim() !== "{}"
            ) {
              try {
                variantOptions = JSON.parse(row["Variant Options"].toString());
              } catch (e) {
                results.warnings.push({
                  productName: firstRow["Product Name"],
                  warning: `Invalid variant options JSON in row ${rowNumber}, using empty options`,
                });
              }
            }

            const subcategory = subcategoryMap.get(subcatName);
            subcategory.variants.push({
              id: Date.now() + idx + Math.random() * 1000,
              title: row["Variant Title"].toString().trim(),
              price: variantPrice,
              compareAtPrice: row["Variant Compare At Price"]
                ? parseFloat(row["Variant Compare At Price"])
                : null,
              sku:
                row["Variant SKU"]?.toString() ||
                `${firstRow["Product Name"].replace(/\s+/g, "-")}-${Date.now()}-${idx}`,
              barcode: row["Variant Barcode"]?.toString() || "",
              inventory: inventory,
              lowstockThreshold:
                parseInt(row["Variant Low Stock Threshold"]) || 10,
              trackQuantity: trackQuantity,
              options: variantOptions,
            });
          } catch (variantError) {
            results.errors.push({
              row: rowNumber,
              error: `Variant processing error: ${variantError.message}`,
              productName: firstRow["Product Name"],
            });
          }
        });

        processedSubcategories = Array.from(subcategoryMap.values()).filter(
          (subcat) => subcat.variants.length > 0
        );
      } else {
        // No variants - use product-level inventory
        productInventory = parseInt(firstRow["Product Inventory"]) || 0;
        const productTrackQuantityStr = firstRow["Product Track Quantity"]
          ?.toString()
          .toUpperCase();
        productTrackQuantity = productTrackQuantityStr !== "FALSE";
        productLowStockThreshold =
          parseInt(firstRow["Product Low Stock Threshold"]) || 10;

        if (
          productTrackQuantityStr !== "TRUE" &&
          productTrackQuantityStr !== "FALSE"
        ) {
          results.warnings.push({
            productName: firstRow["Product Name"],
            warning: `Invalid product track quantity value "${firstRow["Product Track Quantity"]}", defaulting to TRUE`,
          });
        }
      }

      let status =
        firstRow["Product Status"]?.toString().toLowerCase() || "active";
      if (!this.STATUSES.includes(status)) {
        status = "active";
        results.warnings.push({
          productName: firstRow["Product Name"],
          warning: `Invalid status "${firstRow["Product Status"]}", defaulting to "active"`,
        });
      }

      const productData = {
        name: firstRow["Product Name"].toString().trim(),
        description: firstRow["Product Description"]?.toString() || "",
        price: parseFloat(firstRow["Product Price"]) || 0,
        sku: firstRow["Product SKU"]?.toString() || `PROD-${Date.now()}`,
        barcode: firstRow["Product Barcode"]?.toString() || "",
        category: firstRow["Product Category"].toString(),
        status: status as "active" | "draft" | "archived",
        tags,
        images: processedImages, // Limited to 3 images
        subcategories: processedSubcategories,
        weight: firstRow["Product Weight"]
          ? parseFloat(firstRow["Product Weight"].toString())
          : null,
        // Product-level inventory (used when no variants)
        inventory: productInventory,
        trackQuantity: productTrackQuantity,
        lowstockThreshold: productLowStockThreshold,
        shopkeeperId,
      };

      if (
        firstRow["Product ID"] &&
        firstRow["Product ID"].toString().trim() !== ""
      ) {
        console.log(`🔄 Updating product: ${firstRow["Product ID"]}`);
        await this.update(
          firstRow["Product ID"].toString().trim(),
          productData
        );
        results.updated++;
      } else {
        console.log(`➕ Creating new product: ${firstRow["Product Name"]}`);
        await this.create(productData as CreateProductDto, shopkeeperId);
        results.created++;
      }
    } catch (error) {
      throw new Error(
        `Product "${firstRow["Product Name"]}" processing failed: ${error.message}`
      );
    }
  }
}
