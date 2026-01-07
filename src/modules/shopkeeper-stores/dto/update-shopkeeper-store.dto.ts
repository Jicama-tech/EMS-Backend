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
      showInstagram?: boolean;
      showFacebook?: boolean;
      showTwitter?: boolean;
      showTiktok?: boolean;
      facebookLink?: string;
      twitterLink?: string;
      tiktokLink?: string;
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
    layout?: {
      header?: string;
      visibleAdvertismentBar?: boolean;
      advertiseText?: string;
      adBarBgcolor?: string;
      adBarTextColor?: string;
      allProducts?: string;
      visibleFeaturedProducts?: boolean;
      visibleQuickPicks?: boolean;
      featuredProducts?: string;
      quickPicks?: string;
      banner?: string;
      footer?: string;
    };
    heroBannerImage?: string;
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
