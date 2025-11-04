import { IsString, IsArray, IsMongoId, ArrayNotEmpty } from "class-validator";
import { Types } from "mongoose";

export class SendBulkInvitationDto {
  @IsMongoId()
  eventId: Types.ObjectId;

  @IsMongoId()
  organizerId: Types.ObjectId;

  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  shopkeeperIds: Types.ObjectId[];
}
