import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  UseGuards,
  UploadedFiles,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { AuthGuard } from "@nestjs/passport";
import { extname } from "path";
import { diskStorage } from "multer";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import * as fs from "fs";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post("create-product")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FilesInterceptor("images", 3, {
      // Limit to 3 images maximum
      storage: diskStorage({
        destination: "./uploads/products",
        filename: (req, file, cb) => {
          // Unique file name with original extension
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Optional: filter by image mime types
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException("Only image files are allowed!"),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
        files: 3, // Maximum 3 files
      },
    })
  )
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("product") productJson: string,
    @Req() req: any
  ) {
    try {
      if (!productJson) {
        throw new BadRequestException("Product data missing");
      }

      const createProductDto = JSON.parse(productJson);

      // Limit files to 3 maximum
      const limitedFiles = files ? files.slice(0, 3) : [];

      // Map uploaded file paths
      const imagePaths = limitedFiles.map(
        (file) => `/uploads/products/${file.filename}`
      );

      createProductDto.images = imagePaths;
      createProductDto.shopkeeperId = req.user.userId; // Assign from JWT

      const result = await this.productsService.create(
        createProductDto,
        createProductDto.shopkeeperId
      );

      return {
        ...result,
        message: `Product created successfully with ${limitedFiles.length} image(s) (max 3 allowed)`,
      };
    } catch (error) {
      console.error("Create product error:", error);
      throw error;
    }
  }

  @Get("get-all-products")
  findAll() {
    try {
      return this.productsService.findAll();
    } catch (error) {
      console.log(error);
    }
  }

  @Get("shopkeeper-products")
  @UseGuards(AuthGuard("jwt"))
  async getShopkeeperProducts(@Req() req: any) {
    try {
      const shopkeeperId = req.user.userId;
      return this.productsService.getShopkeeperProducts(shopkeeperId);
    } catch (error) {
      console.log(error);
    }
  }

  @Get("shopkeeper-products/:id")
  async findProductsbyId(@Param("id") id: string) {
    try {
      return await this.productsService.getShopkeeperProducts(id);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get("get-product-details/:id")
  findOne(@Param("id") id: string) {
    try {
      return this.productsService.findOne(id);
    } catch (error) {
      console.log(error);
    }
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FilesInterceptor("images", 3, {
      // Limit to 3 images maximum
      storage: diskStorage({
        destination: "./uploads/products",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException("Only image files are allowed!"),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 3, // Maximum 3 files
      },
    })
  )
  async update(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("product") productJson: string,
    @Req() req: any
  ) {
    try {
      // Parse the DTO sent from the frontend
      const updateProductDto = JSON.parse(productJson);

      // Get the existing images array sent from the frontend (which might be empty or reordered)
      // This array is the source of truth for images the user wants to keep.
      const existingImages = updateProductDto.images || [];

      // Limit files to 3 maximum
      const limitedFiles = files ? files.slice(0, 3) : [];

      // Map uploaded file paths
      const newImagePaths = limitedFiles.map(
        (file) => `/uploads/products/${file.filename}`
      );

      // Combine the existing images (kept from the frontend) with the new images
      // But ensure total doesn't exceed 3
      const combinedImages = [...existingImages, ...newImagePaths];
      updateProductDto.images = combinedImages.slice(0, 3);

      const result = await this.productsService.update(id, updateProductDto);

      return {
        ...result,
        message: `Product updated successfully with ${updateProductDto.images.length} image(s) (max 3 allowed)`,
      };
    } catch (error) {
      console.error("Update product error:", error);
      throw error;
    }
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    try {
      return this.productsService.remove(id);
    } catch (error) {
      console.log(error);
    }
  }

  // Enhanced Excel Template Generation with Demo Data and Working Dropdowns
  @Get("excel/download-template")
  @UseGuards(AuthGuard("jwt"))
  async downloadExcelTemplate(@Req() req, @Res() res: Response) {
    try {
      const shopkeeperId = req.user.userId;
      const buffer =
        await this.productsService.generateExcelTemplate(shopkeeperId);

      const filename = `products-template-${shopkeeperId}-${Date.now()}.xlsx`;

      res.set({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length,
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error generating Excel template:", error);
      throw new HttpException(
        `Failed to generate Excel template: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Enhanced Excel Import with 3-image limit and proper error handling
  @Post("excel/import")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/temp",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `excel-import-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return cb(
            new BadRequestException("Only Excel files are allowed!"),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    })
  )
  async importFromExcel(@UploadedFile() file: Express.Multer.File, @Req() req) {
    try {
      if (!file) {
        throw new BadRequestException("Excel file is required");
      }

      const shopkeeperId = req.user.userId;
      const fileBuffer = fs.readFileSync(file.path);

      const result = await this.productsService.importFromExcel(
        fileBuffer,
        shopkeeperId
      );

      // Clean up temporary file
      fs.unlinkSync(file.path);

      return {
        success: true,
        message: `Excel import completed successfully. ${result.results.created} products created, ${result.results.updated} products updated, ${result.results.processedImages} images processed (max 3 per product).`,
        data: result.results,
      };
    } catch (error) {
      console.error("Error importing from Excel:", error);
      throw new HttpException(
        `Failed to import from Excel: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // Bulk upload images with 3-image limit per product
  @Post("bulk-upload-images")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FilesInterceptor("images", 50, {
      // Allow up to 50 total images for bulk upload
      storage: diskStorage({
        destination: "./uploads/products",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(
            null,
            `bulk-${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`
          );
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException("Only image files are allowed!"),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
      },
    })
  )
  async bulkUploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException("At least one image file is required");
      }

      const uploadedImages = files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/products/${file.filename}`,
        size: file.size,
      }));

      return {
        success: true,
        message: `${uploadedImages.length} images uploaded successfully. Remember: maximum 3 images per product.`,
        data: uploadedImages,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to upload images: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // Get product categories for dropdown
  @Get("meta/categories")
  async getCategories() {
    try {
      const categories = [
        "Apparel",
        "Drinkware",
        "Accessories",
        "Electronics",
        "Sports & Recreation",
        "Art & Crafts",
        "Food & Beverage",
        "Other",
      ];

      return {
        success: true,
        message: "Categories retrieved successfully",
        data: categories,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve categories: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Get product statuses for dropdown
  @Get("meta/statuses")
  async getStatuses() {
    try {
      const statuses = ["active", "draft", "archived"];

      return {
        success: true,
        message: "Statuses retrieved successfully",
        data: statuses,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve statuses: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Get track quantity options for dropdown
  @Get("meta/track-quantity-options")
  async getTrackQuantityOptions() {
    try {
      const options = ["Yes", "No"];

      return {
        success: true,
        message: "Track quantity options retrieved successfully",
        data: options,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve track quantity options: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Validate product data before save
  @Post("validate")
  @UseGuards(AuthGuard("jwt"))
  async validateProduct(@Body() productData: CreateProductDto) {
    try {
      const errors = [];
      const warnings = [];

      // Validate required fields
      if (!productData.name || productData.name.trim().length === 0) {
        errors.push("Product name is required");
      }

      if (!productData.price || productData.price <= 0) {
        errors.push("Product price must be greater than 0");
      }

      if (!productData.category) {
        errors.push("Product category is required");
      }

      // Validate images (max 3)
      if (productData.images && productData.images.length > 3) {
        warnings.push(
          `Only 3 images are allowed per product. ${productData.images.length} images provided.`
        );
      }

      // Validate subcategories and variants
      if (productData.subcategories && productData.subcategories.length > 0) {
        productData.subcategories.forEach((subcat, subcatIndex) => {
          if (!subcat.name || subcat.name.trim().length === 0) {
            errors.push(`Subcategory ${subcatIndex + 1} name is required`);
          }

          if (subcat.variants && subcat.variants.length > 0) {
            subcat.variants.forEach((variant, variantIndex) => {
              if (!variant.title || variant.title.trim().length === 0) {
                errors.push(
                  `Variant ${variantIndex + 1} in subcategory ${subcatIndex + 1} title is required`
                );
              }
              if (!variant.price || variant.price <= 0) {
                errors.push(
                  `Variant ${variantIndex + 1} in subcategory ${subcatIndex + 1} price must be greater than 0`
                );
              }
            });
          }
        });

        // If has subcategories, product-level inventory should be empty
        if (
          productData.trackQuantity !== undefined ||
          productData.inventory !== undefined
        ) {
          warnings.push(
            "Product has subcategories. Product-level inventory settings will be ignored."
          );
        }
      } else {
        // If no subcategories, product-level inventory is required
        if (
          productData.trackQuantity &&
          (!productData.inventory || productData.inventory < 0)
        ) {
          errors.push(
            "Product inventory is required when track quantity is enabled"
          );
        }
      }

      return {
        success: true,
        message: "Product validation completed",
        data: {
          isValid: errors.length === 0,
          errors,
          warnings,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to validate product: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
