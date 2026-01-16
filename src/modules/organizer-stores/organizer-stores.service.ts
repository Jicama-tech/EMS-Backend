import { Injectable } from "@nestjs/common";
import { CreateOrganizerStoreDto } from "./dto/create-organizer-store.dto";
import { UpdateOrganizerStoreDto } from "./dto/update-organizer-store.dto";
import { InjectModel } from "@nestjs/mongoose/dist";
import { Model } from "mongoose";
import slugify from "slugify/slugify";
import { OrganizerStore } from "./entities/organizer-store.entity";

@Injectable()
export class OrganizerStoresService {
  constructor(
    @InjectModel(OrganizerStore.name)
    private organizerStoreModel: Model<OrganizerStore>
  ) {}

  async create(createOrganizerStoreDto: CreateOrganizerStoreDto) {
    try {
      const shopfrontStore = new this.organizerStoreModel({
        organizerId: createOrganizerStoreDto.organizerId,
        slug: createOrganizerStoreDto.slug,
        settings: {
          general: {
            storeName: createOrganizerStoreDto.general.storeName,
            tagline: createOrganizerStoreDto.general.tagline,
            description: createOrganizerStoreDto.general.description ?? "",
            logo: createOrganizerStoreDto.general.logo ?? "",
            favicon: createOrganizerStoreDto.general.favicon ?? "",
            contactInfo: {
              phone: createOrganizerStoreDto.general.contactInfo.phone ?? "",
              email: createOrganizerStoreDto.general.contactInfo.email ?? "",
              address:
                createOrganizerStoreDto.general.contactInfo.address ?? "",
              hours: createOrganizerStoreDto.general.contactInfo.hours ?? "",
              website:
                createOrganizerStoreDto.general.contactInfo.website ?? "",
              instagramLink:
                createOrganizerStoreDto.general.contactInfo.instagramLink ?? "",
              facebookLink:
                createOrganizerStoreDto.general.contactInfo.facebookLink ?? "",
              twitterLink:
                createOrganizerStoreDto.general.contactInfo.twitterLink ?? "",
              tiktokLink:
                createOrganizerStoreDto.general.contactInfo.tiktokLink ?? "",
              showInstagram:
                createOrganizerStoreDto.general.contactInfo.showInstagram ??
                false,
              showFacebook:
                createOrganizerStoreDto.general.contactInfo.showFacebook ??
                false,
              showTwitter:
                createOrganizerStoreDto.general.contactInfo.showTwitter ??
                false,
              showTiktok:
                createOrganizerStoreDto.general.contactInfo.showTiktok ?? false,
            },
          },
          design: {
            theme: createOrganizerStoreDto.design.theme,
            primaryColor: createOrganizerStoreDto.design.primaryColor,
            secondaryColor: createOrganizerStoreDto.design.secondaryColor,
            fontFamily: createOrganizerStoreDto.design.fontFamily,
            layout: createOrganizerStoreDto.design.layout,
            bannerImage: createOrganizerStoreDto.design.bannerImage ?? "",
            showBanner: createOrganizerStoreDto.design.showBanner,
            bannerHeight: createOrganizerStoreDto.design.bannerHeight,
          },
          features: {
            showSearch: createOrganizerStoreDto.features.showSearch,
            showFilters: createOrganizerStoreDto.features.showFilters,
            showReviews: createOrganizerStoreDto.features.showReviews,
            showWishlist: createOrganizerStoreDto.features.showWishlist,
            showSocialMedia: createOrganizerStoreDto.features.showSocialMedia,
            enableChat: createOrganizerStoreDto.features.enableChat,
            showNewsletter: createOrganizerStoreDto.features.showNewsletter,
          },
          seo: {
            metaTitle: createOrganizerStoreDto.seo.metaTitle,
            metaDescription: createOrganizerStoreDto.seo.metaDescription ?? "",
            keywords: createOrganizerStoreDto.seo.keywords ?? "",
            customCode: createOrganizerStoreDto.seo.customCode ?? "",
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
      const shopfrontStore = await this.organizerStoreModel.findOne({
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
      let store = await this.organizerStoreModel.findOne({ slug: slug }).exec();

      console.log(store, "Store");
      if (store) {
        return store;
      }

      // If not found, iterate all stores to check generated slug matches
      const allStores = await this.organizerStoreModel.find().exec();

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

  async findOneByorganizerId(organizerId: string) {
    try {
      const shopfrontStore = await this.organizerStoreModel
        .findOne({ organizerId })
        .exec();
      if (!shopfrontStore) {
        return { message: "Shopfront store not found", data: null };
      }
      return { message: "Shopfront store found", data: shopfrontStore };
    } catch (error) {
      console.error("Error finding shopfront store by organizerId:", error);
      throw error;
    }
  }

  async update(
    organizerId: string,
    updateOrganizerDto: UpdateOrganizerStoreDto,
    bannerImagePath?: string,
    heroBannerImagePath?: string
  ) {
    try {
      const existingStore = await this.organizerStoreModel
        .findOne({ organizerId })
        .exec();

      if (!existingStore) {
        return {
          message: "Shopfront store not found",
          data: null,
        };
      }

      const updateData: any = {};

      // Update slug if provided
      if (typeof updateOrganizerDto.slug === "string") {
        updateData.slug = updateOrganizerDto.slug.toLowerCase();
      }

      // Update general settings if provided
      if (updateOrganizerDto.general) {
        updateData["settings.general"] = {
          storeName:
            updateOrganizerDto.general.storeName ??
            existingStore.settings.general.storeName,
          tagline:
            updateOrganizerDto.general.tagline ??
            existingStore.settings.general.tagline,
          description:
            updateOrganizerDto.general.description ??
            existingStore.settings.general.description,
          logo:
            updateOrganizerDto.general.logo ??
            existingStore.settings.general.logo,
          favicon:
            updateOrganizerDto.general.favicon ??
            existingStore.settings.general.favicon,
          contactInfo: {
            phone:
              updateOrganizerDto.general.contactInfo?.phone ??
              existingStore.settings.general.contactInfo.phone,
            email:
              updateOrganizerDto.general.contactInfo?.email ??
              existingStore.settings.general.contactInfo.email,
            address:
              updateOrganizerDto.general.contactInfo?.address ??
              existingStore.settings.general.contactInfo.address,
            hours:
              updateOrganizerDto.general.contactInfo?.hours ??
              existingStore.settings.general.contactInfo.hours,
            website:
              updateOrganizerDto.general.contactInfo?.website ??
              existingStore.settings.general.contactInfo.website,
            instagramLink:
              updateOrganizerDto.general.contactInfo?.instagramLink ??
              existingStore.settings.general.contactInfo.instagramLink,
            facebookLink:
              updateOrganizerDto.general.contactInfo?.facebookLink ??
              existingStore.settings.general.contactInfo.facebookLink,
            twitterLink:
              updateOrganizerDto.general.contactInfo?.twitterLink ??
              existingStore.settings.general.contactInfo.twitterLink,
            tiktokLink:
              updateOrganizerDto.general.contactInfo?.tiktokLink ??
              existingStore.settings.general.contactInfo.tiktokLink,
            showInstagram:
              updateOrganizerDto.general.contactInfo?.showInstagram ??
              existingStore.settings.general.contactInfo.showInstagram,
            showFacebook:
              updateOrganizerDto.general.contactInfo?.showFacebook ??
              existingStore.settings.general.contactInfo.showFacebook,
            showTwitter:
              updateOrganizerDto.general.contactInfo?.showTwitter ??
              existingStore.settings.general.contactInfo.showTwitter,
            showTiktok:
              updateOrganizerDto.general.contactInfo?.showTiktok ??
              existingStore.settings.general.contactInfo.showTiktok,
          },
        };
      }

      // Update design settings if provided
      if (updateOrganizerDto.design) {
        updateData["settings.design"] = {
          theme:
            updateOrganizerDto.design.theme ??
            existingStore.settings.design.theme,
          primaryColor:
            updateOrganizerDto.design.primaryColor ??
            existingStore.settings.design.primaryColor,
          secondaryColor:
            updateOrganizerDto.design.secondaryColor ??
            existingStore.settings.design.secondaryColor,
          fontFamily:
            updateOrganizerDto.design.fontFamily ??
            existingStore.settings.design.fontFamily,
          layout:
            updateOrganizerDto.design.layout ??
            existingStore.settings.design.layout,
          heroBannerImage:
            heroBannerImagePath ??
            updateOrganizerDto.design.heroBannerImage ??
            existingStore.settings.design.heroBannerImage,
          bannerImage:
            bannerImagePath ??
            updateOrganizerDto.design.bannerImage ??
            existingStore.settings.design.bannerImage,
          showBanner:
            updateOrganizerDto.design.showBanner ??
            existingStore.settings.design.showBanner,
          bannerHeight:
            updateOrganizerDto.design.bannerHeight ??
            existingStore.settings.design.bannerHeight,
        };
      }

      // Update features settings if provided
      if (updateOrganizerDto.features) {
        updateData["settings.features"] = {
          showSearch:
            updateOrganizerDto.features.showSearch ??
            existingStore.settings.features.showSearch,
          showFilters:
            updateOrganizerDto.features.showFilters ??
            existingStore.settings.features.showFilters,
          showReviews:
            updateOrganizerDto.features.showReviews ??
            existingStore.settings.features.showReviews,
          showWishlist:
            updateOrganizerDto.features.showWishlist ??
            existingStore.settings.features.showWishlist,
          showSocialMedia:
            updateOrganizerDto.features.showSocialMedia ??
            existingStore.settings.features.showSocialMedia,
          enableChat:
            updateOrganizerDto.features.enableChat ??
            existingStore.settings.features.enableChat,
          showNewsletter:
            updateOrganizerDto.features.showNewsletter ??
            existingStore.settings.features.showNewsletter,
        };
      }

      // Update SEO settings if provided
      if (updateOrganizerDto.seo) {
        updateData["settings.seo"] = {
          metaTitle:
            updateOrganizerDto.seo.metaTitle ??
            existingStore.settings.seo.metaTitle,
          metaDescription:
            updateOrganizerDto.seo.metaDescription ??
            existingStore.settings.seo.metaDescription,
          keywords:
            updateOrganizerDto.seo.keywords ??
            existingStore.settings.seo.keywords,
          customCode:
            updateOrganizerDto.seo.customCode ??
            existingStore.settings.seo.customCode,
        };
      }

      // Perform the update
      const updatedStore = await this.organizerStoreModel
        .findOneAndUpdate(
          { organizerId },
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
