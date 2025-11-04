import { IsNotEmpty, IsString } from "class-validator";

export class ScanQRDto {
  @IsNotEmpty()
  @IsString()
  qrCodeData: string;
}
