// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop()
  email?: string;

  // Password is now optional since it won't be used for OAuth users
  @Prop({ required: false })
  password: string;

  @Prop()
  name: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ default: ["user"] })
  roles: string[];

  // Add these fields to store social login information
  @Prop()
  provider: string;

  @Prop()
  providerId: string;

  @Prop()
  whatsAppNumber?: string;

  @Prop()
  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
