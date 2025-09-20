import { Injectable } from "@nestjs/common";
import { CreateShopkeeperStoreDto } from "./dto/create-shopkeeper-store.dto";
import { InjectModel } from "@nestjs/mongoose/dist";
import { ShopfrontStore } from "./entities/shopkeeper-store.entity";
import { Model } from "mongoose";
import { UpdateShopkeeperStoreDto } from "./dto/update-shopkeeper-store.dto";
import slugify from "slugify/slugify";

@Injectable()
export class ShopkeeperStoresService {
  constructor(
    @InjectModel(ShopfrontStore.name)
    private shopkeeperStoreModel: Model<ShopfrontStore>
  ) {}

  async create(createShopkeeperStoreDto: CreateShopkeeperStoreDto) {
    try {
      const shopfrontStore = new this.shopkeeperStoreModel({
        shopkeeperId: createShopkeeperStoreDto.shopkeeperId,
        slug: createShopkeeperStoreDto.slug,
        settings: {
          general: {
            storeName: createShopkeeperStoreDto.general.storeName,
            tagline: createShopkeeperStoreDto.general.tagline,
            description: createShopkeeperStoreDto.general.description ?? "",
            logo: createShopkeeperStoreDto.general.logo ?? "",
            favicon: createShopkeeperStoreDto.general.favicon ?? "",
            contactInfo: {
              phone: createShopkeeperStoreDto.general.contactInfo.phone ?? "",
              email: createShopkeeperStoreDto.general.contactInfo.email ?? "",
              address:
                createShopkeeperStoreDto.general.contactInfo.address ?? "",
              hours: createShopkeeperStoreDto.general.contactInfo.hours ?? "",
              website:
                createShopkeeperStoreDto.general.contactInfo.website ?? "",
            },
          },
          design: {
            theme: createShopkeeperStoreDto.design.theme,
            primaryColor: createShopkeeperStoreDto.design.primaryColor,
            secondaryColor: createShopkeeperStoreDto.design.secondaryColor,
            fontFamily: createShopkeeperStoreDto.design.fontFamily,
            layout: createShopkeeperStoreDto.design.layout,
            bannerImage: createShopkeeperStoreDto.design.bannerImage ?? "",
            showBanner: createShopkeeperStoreDto.design.showBanner,
            bannerHeight: createShopkeeperStoreDto.design.bannerHeight,
          },
          features: {
            showSearch: createShopkeeperStoreDto.features.showSearch,
            showFilters: createShopkeeperStoreDto.features.showFilters,
            showReviews: createShopkeeperStoreDto.features.showReviews,
            showWishlist: createShopkeeperStoreDto.features.showWishlist,
            showSocialMedia: createShopkeeperStoreDto.features.showSocialMedia,
            enableChat: createShopkeeperStoreDto.features.enableChat,
            showNewsletter: createShopkeeperStoreDto.features.showNewsletter,
          },
          seo: {
            metaTitle: createShopkeeperStoreDto.seo.metaTitle,
            metaDescription: createShopkeeperStoreDto.seo.metaDescription ?? "",
            keywords: createShopkeeperStoreDto.seo.keywords ?? "",
            customCode: createShopkeeperStoreDto.seo.customCode ?? "",
          },
        },
      });

      const result = await shopfrontStore.save();

      console.log(result, "result");

      return {
        message: "Shopfront settings created successfully",
        data: result,
      };
    } catch (error) {
      console.error("Error creating shopfront settings:", error);
      throw error;
    }
  }

  findAll() {
    return `This action returns all shopkeeperStores`;
  }

  async findOneByShopName(shopName: string) {
    try {
      const shopfrontStore = await this.shopkeeperStoreModel.findOne({
        "settings.general.storeName": shopName,
      });
      if (!shopfrontStore) {
        return { message: "Shopfront store not found", data: null };
      }
      return { message: "Shopfront store found", data: shopfrontStore };
    } catch (error) {
      console.error("Error finding shopfront store by shopName:", error);
      throw error;
    }
  }

  async findBySlug(slug: string) {
    try {
      // Try to find by slug first
      console.log(slug);
      let store = await this.shopkeeperStoreModel
        .findOne({ slug: slug })
        .exec();

      console.log(store, "Store");
      if (store) {
        return store;
      }

      // If not found, iterate all stores to check generated slug matches
      const allStores = await this.shopkeeperStoreModel.find().exec();

      for (const s of allStores) {
        try {
          const genSlug = slugify(s.settings.general.storeName, {
            lower: true,
            strict: true,
          });
          console.log(genSlug, "genSlug");

          if (genSlug === slug) {
            // Save slug for faster future lookup
            s.slug = genSlug;
            try {
              await s.save();
            } catch (saveError) {
              console.error("Failed to save slug for store", s._id, saveError);
            }
            return s;
          }
        } catch (genSlugError) {
          console.error("Error generating slug for store", s._id, genSlugError);
        }
      }

      return { message: "Shopfront store found" };
    } catch (error) {
      console.error("Error in findBySlug:", error);
      return null;
    }
  }

  async findOneByShopkeeperId(shopkeeperId: string) {
    try {
      const shopfrontStore = await this.shopkeeperStoreModel
        .findOne({ shopkeeperId })
        .exec();
      if (!shopfrontStore) {
        return { message: "Shopfront store not found", data: null };
      }
      console.log(shopfrontStore, "Hello");
      return { message: "Shopfront store found", data: shopfrontStore };
    } catch (error) {
      console.error("Error finding shopfront store by shopkeeperId:", error);
      throw error;
    }
  }

  async update(
    shopkeeperId: string,
    updateShopkeeperDto: UpdateShopkeeperStoreDto,
    bannerImagePath?: string
  ) {
    try {
      const existingStore = await this.shopkeeperStoreModel
        .findOne({ shopkeeperId })
        .exec();

      if (!existingStore) {
        return {
          message: "Shopfront store not found",
          data: null,
        };
      }

      const updateData: any = {};

      // Update slug if provided
      if (typeof updateShopkeeperDto.slug === "string") {
        updateData.slug = updateShopkeeperDto.slug.toLowerCase();
      }

      // Update general settings if provided
      if (updateShopkeeperDto.general) {
        updateData["settings.general"] = {
          storeName:
            updateShopkeeperDto.general.storeName ??
            existingStore.settings.general.storeName,
          tagline:
            updateShopkeeperDto.general.tagline ??
            existingStore.settings.general.tagline,
          description:
            updateShopkeeperDto.general.description ??
            existingStore.settings.general.description,
          logo:
            updateShopkeeperDto.general.logo ??
            existingStore.settings.general.logo,
          favicon:
            updateShopkeeperDto.general.favicon ??
            existingStore.settings.general.favicon,
          contactInfo: {
            phone:
              updateShopkeeperDto.general.contactInfo?.phone ??
              existingStore.settings.general.contactInfo.phone,
            email:
              updateShopkeeperDto.general.contactInfo?.email ??
              existingStore.settings.general.contactInfo.email,
            address:
              updateShopkeeperDto.general.contactInfo?.address ??
              existingStore.settings.general.contactInfo.address,
            hours:
              updateShopkeeperDto.general.contactInfo?.hours ??
              existingStore.settings.general.contactInfo.hours,
            website:
              updateShopkeeperDto.general.contactInfo?.website ??
              existingStore.settings.general.contactInfo.website,
            instagramLink:
              updateShopkeeperDto.general.contactInfo?.instagramLink ??
              existingStore.settings.general.contactInfo.instagramLink,
          },
        };
      }

      // Update design settings if provided
      if (updateShopkeeperDto.design) {
        updateData["settings.design"] = {
          theme:
            updateShopkeeperDto.design.theme ??
            existingStore.settings.design.theme,
          primaryColor:
            updateShopkeeperDto.design.primaryColor ??
            existingStore.settings.design.primaryColor,
          secondaryColor:
            updateShopkeeperDto.design.secondaryColor ??
            existingStore.settings.design.secondaryColor,
          fontFamily:
            updateShopkeeperDto.design.fontFamily ??
            existingStore.settings.design.fontFamily,
          layout:
            updateShopkeeperDto.design.layout ??
            existingStore.settings.design.layout,
          bannerImage:
            bannerImagePath ??
            updateShopkeeperDto.design.bannerImage ??
            existingStore.settings.design.bannerImage,
          showBanner:
            updateShopkeeperDto.design.showBanner ??
            existingStore.settings.design.showBanner,
          bannerHeight:
            updateShopkeeperDto.design.bannerHeight ??
            existingStore.settings.design.bannerHeight,
        };
      }

      // Update features settings if provided
      if (updateShopkeeperDto.features) {
        updateData["settings.features"] = {
          showSearch:
            updateShopkeeperDto.features.showSearch ??
            existingStore.settings.features.showSearch,
          showFilters:
            updateShopkeeperDto.features.showFilters ??
            existingStore.settings.features.showFilters,
          showReviews:
            updateShopkeeperDto.features.showReviews ??
            existingStore.settings.features.showReviews,
          showWishlist:
            updateShopkeeperDto.features.showWishlist ??
            existingStore.settings.features.showWishlist,
          showSocialMedia:
            updateShopkeeperDto.features.showSocialMedia ??
            existingStore.settings.features.showSocialMedia,
          enableChat:
            updateShopkeeperDto.features.enableChat ??
            existingStore.settings.features.enableChat,
          showNewsletter:
            updateShopkeeperDto.features.showNewsletter ??
            existingStore.settings.features.showNewsletter,
        };
      }

      // Update SEO settings if provided
      if (updateShopkeeperDto.seo) {
        updateData["settings.seo"] = {
          metaTitle:
            updateShopkeeperDto.seo.metaTitle ??
            existingStore.settings.seo.metaTitle,
          metaDescription:
            updateShopkeeperDto.seo.metaDescription ??
            existingStore.settings.seo.metaDescription,
          keywords:
            updateShopkeeperDto.seo.keywords ??
            existingStore.settings.seo.keywords,
          customCode:
            updateShopkeeperDto.seo.customCode ??
            existingStore.settings.seo.customCode,
        };
      }

      // Perform the update
      const updatedStore = await this.shopkeeperStoreModel
        .findOneAndUpdate(
          { shopkeeperId },
          { $set: updateData },
          { new: true, runValidators: true }
        )
        .exec();

      return {
        message: "Shopfront store updated successfully",
        data: updatedStore,
      };
    } catch (error) {
      console.error("Error updating shopfront store:", error);
      throw error;
    }
  }

  remove(id: number) {
    return `This action removes a #${id} shopkeeperStore`;
  }
}
