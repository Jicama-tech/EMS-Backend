import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { ShopkeeperStoresService } from "./shopkeeper-stores.service";
import { CreateShopkeeperStoreDto } from "./dto/create-shopkeeper-store.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthGuard } from "@nestjs/passport";
import { UpdateShopkeeperStoreDto } from "./dto/update-shopkeeper-store.dto";
import { diskStorage } from "multer";
import * as path from "path";
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from "@nestjs/platform-express";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";

// Ensure uploads directory exists
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Multer storage configuration for banner uploads
const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads/banners";
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `banner-${uniqueSuffix}${ext}`);
  },
});

@Controller("shopkeeper-stores")
export class ShopkeeperStoresController {
  constructor(
    private readonly shopkeeperStoresService: ShopkeeperStoresService
  ) {}

  @Post("add-store-settings")
  @UseGuards(AuthGuard("jwt"))
  create(@Body() createShopkeeperStoreDto: CreateShopkeeperStoreDto) {
    try {
      console.log(createShopkeeperStoreDto, "createShopkeeperStoreDto");
      return this.shopkeeperStoresService.create(createShopkeeperStoreDto);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.shopkeeperStoresService.findAll();
  }

  @Get("shopkeeper-store-detail")
  @UseGuards(AuthGuard("jwt"))
  findOne(@Req() req: any) {
    try {
      const id = req.user.userId;
      return this.shopkeeperStoresService.findOneByShopkeeperId(id);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get("shopkeeper-store-detail/:id")
  async findById(@Param("id") id: string) {
    try {
      return await this.shopkeeperStoresService.findOneByShopkeeperId(id);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get("shopkeeper-stores-detail/:shopName")
  findOneById(@Param("shopName") shopName: string) {
    try {
      console.log(shopName);
      return this.shopkeeperStoresService.findBySlug(shopName);
    } catch (error) {
      throw error;
    }
  }

  @Patch("update-store-settings")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "bannerImage", maxCount: 1 },
        { name: "heroBannerImage", maxCount: 1 },
      ],
      {
        storage,
        fileFilter: (req, file, cb) => {
          if (file.mimetype.startsWith("image/")) {
            cb(null, true);
          } else {
            cb(new Error("Only image files allowed"), false);
          }
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      }
    )
  )
  async update(
    @Req() req: any,
    @UploadedFiles()
    files: {
      bannerImage?: Express.Multer.File[];
      heroBannerImage?: Express.Multer.File[];
    },
    @Body() updateShopkeeperStoreDto: UpdateShopkeeperStoreDto
  ) {
    try {
      const id = req.user.userId;

      console.log("Received body:", updateShopkeeperStoreDto);
      console.log("Received files:", files);

      // Parse JSON string fields from multipart body
      Object.keys(updateShopkeeperStoreDto).forEach((key) => {
        if (typeof updateShopkeeperStoreDto[key] === "string") {
          try {
            const parsed = JSON.parse(updateShopkeeperStoreDto[key]);
            (updateShopkeeperStoreDto as any)[key] = parsed;
          } catch (parseError) {
            console.log(`Could not parse ${key}:`, parseError);
            // Keep the original value if parsing fails
          }
        }
      });

      // Handle bannerImage (0 or 1 file)
      let bannerImagePath: string | undefined;
      if (files.bannerImage && files.bannerImage.length > 0) {
        bannerImagePath = `/uploads/banners/${files.bannerImage[0].filename}`;
        console.log("Banner image path:", bannerImagePath);
      }

      // Handle heroBannerImage (0 or 1 file)
      let heroBannerImagePath: string | undefined;
      if (files.heroBannerImage && files.heroBannerImage.length > 0) {
        heroBannerImagePath = `/uploads/banners/${files.heroBannerImage[0].filename}`;
        console.log("Hero banner image path:", heroBannerImagePath);
      }

      // Call service with parsed DTO and optional file paths
      return await this.shopkeeperStoresService.update(
        id,
        updateShopkeeperStoreDto,
        bannerImagePath, // undefined if no file
        heroBannerImagePath // undefined if no file
      );
    } catch (error) {
      console.log("Update error:", error);
      throw error;
    }
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.shopkeeperStoresService.remove(+id);
  }
}
