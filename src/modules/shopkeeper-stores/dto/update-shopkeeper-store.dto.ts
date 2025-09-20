import { PartialType } from "@nestjs/mapped-types";
import { CreateShopkeeperStoreDto } from "./create-shopkeeper-store.dto";
import { IsOptional } from "class-validator";

export class UpdateShopkeeperStoreDto {
  @IsOptional()
  general?: {
    storeName?: string;
    tagline?: string;
    description?: string;
    logo?: string;
    favicon?: string;
    contactInfo?: {
      phone?: string;
      email?: string;
      address?: string;
      hours?: string;
      website?: string;
      instagramLink?: string;
    };
  };

  @IsOptional()
  slug: string;

  @IsOptional()
  design?: {
    theme?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    layout?: string;
    bannerImage?: string;
    showBanner?: boolean;
    bannerHeight?: string;
  };

  @IsOptional()
  features?: {
    showSearch?: boolean;
    showFilters?: boolean;
    showReviews?: boolean;
    showWishlist?: boolean;
    showQuickView?: boolean;
    showSocialMedia?: boolean;
    enableChat?: boolean;
    showNewsletter?: boolean;
  };

  @IsOptional()
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string;
    customCode?: string;
  };
}
