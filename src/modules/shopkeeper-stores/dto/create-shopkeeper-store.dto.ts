import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateNested,
  IsMongoId,
  IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";

class ContactInfoDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() hours?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() instagramLink?: string;
  @IsOptional() @IsString() facebookLink?: string;
  @IsOptional() @IsString() twitterLink?: string;
  @IsOptional() @IsString() tiktokLink?: string;
  @IsOptional() @IsBoolean() showInstagram?: boolean;
  @IsOptional() @IsBoolean() showFacebook?: boolean;
  @IsOptional() @IsBoolean() showTwitter?: boolean;
  @IsOptional() @IsBoolean() showTiktok?: boolean;
}

class GeneralSettingsDto {
  @IsString() @IsNotEmpty() storeName: string;
  @IsString() @IsNotEmpty() tagline: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() favicon?: string;
  @ValidateNested() @Type(() => ContactInfoDto) contactInfo: ContactInfoDto;
}

class LayoutSettingsDto {
  @IsString() header: string;
  @IsString() allProducts: string;
  @IsBoolean() visibleFeaturedProducts: boolean;
  @IsBoolean() visibleAdvertismentBar?: boolean;
  @IsString() advertiseText?: string;
  @IsString() adBarBgcolor?: string;
  @IsString() adBarTextColor?: string;
  @IsBoolean() visibleQuickPicks: boolean;
  @IsString() featuredProducts: string;
  @IsString() quickPicks: string;
  @IsString() banner: string;
  @IsString() footer: string;
}

class DesignSettingsDto {
  @IsString() theme: string;
  @IsString() primaryColor: string;
  @IsString() secondaryColor: string;
  @IsString() fontFamily: string;
  @IsString() layout: LayoutSettingsDto;
  @IsOptional() @IsString() bannerImage?: string;
  @IsOptional() @IsString() heroBannerImage?: string;
  @IsBoolean() showBanner: boolean;
  @IsString() bannerHeight: string;
}

class FeaturesSettingsDto {
  @IsBoolean() showSearch: boolean;
  @IsBoolean() showFilters: boolean;
  @IsBoolean() showReviews: boolean;
  @IsBoolean() showWishlist: boolean;
  @IsBoolean() showSocialMedia: boolean;
  @IsBoolean() enableChat: boolean;
  @IsBoolean() showNewsletter: boolean;
}

class SeoSettingsDto {
  @IsString() @IsNotEmpty() metaTitle: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() @IsString() keywords?: string;
  @IsOptional() @IsString() customCode?: string;
}

export class CreateShopkeeperStoreDto {
  @IsString()
  shopkeeperId: string;

  @IsString()
  slug: string;

  @IsObject()
  @ValidateNested()
  @Type(() => GeneralSettingsDto)
  general: GeneralSettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => DesignSettingsDto)
  design: DesignSettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => FeaturesSettingsDto)
  features: FeaturesSettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SeoSettingsDto)
  seo: SeoSettingsDto;
}
