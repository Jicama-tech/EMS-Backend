import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { StallsService } from "./stalls.service";
import { CreateStallDto } from "./dto/create-stall.dto";
import { SelectTablesAndAddOnsDto } from "./dto/tableSelect.dto";
import { UpdatePaymentStatusDto } from "./dto/paymentStatus.dto";
import { UpdateStatusDto } from "./dto/updateStatus.dto";
import { ConfirmPaymentDto } from "./dto/confirm-Payment.dto";
import { ScanQRDto } from "./dto/scan-qr.dto";
import { SendBulkInvitationDto } from "./dto/sendBulkInvitation.dto";

@Controller("stalls")
export class StallsController {
  constructor(private readonly stallsService: StallsService) {}

  /**
   * PHASE 1: Create initial stall request
   * POST /stalls/register-for-stall
   */
  @Post("register-for-stall")
  @HttpCode(HttpStatus.CREATED)
  async createStallRequest(@Body() createStallDto: CreateStallDto) {
    return await this.stallsService.createStallRequest(createStallDto);
  }

  /**
   * Check if shopkeeper has existing request for event
   * GET /stalls/check-request/:eventId/:shopkeeperId
   */
  @Get("check-request/:eventId/:shopkeeperId")
  async checkExistingRequest(
    @Param("eventId") eventId: string,
    @Param("shopkeeperId") shopkeeperId: string
  ) {
    return await this.stallsService.checkExistingRequest(eventId, shopkeeperId);
  }

  /**
   * PHASE 2: Select tables and add-ons
   * PATCH /stalls/:id/select-tables-and-addons
   */
  @Patch(":id/select-tables-and-addons")
  async selectTablesAndAddOns(
    @Param("id") id: string,
    @Body() selectDto: SelectTablesAndAddOnsDto
  ) {
    return await this.stallsService.selectTablesAndAddOns(id, selectDto);
  }

  /**
   * Get available tables for an event
   * GET /stalls/available-tables/:eventId
   */
  @Get("available-tables/:eventId")
  async getAvailableTables(@Param("eventId") eventId: string) {
    return await this.stallsService.getAvailableTables(eventId);
  }

  /**
   * PHASE 3: Confirm payment and generate QR
   * POST /stalls/confirm-payment
   */
  @Post("confirm-payment")
  @HttpCode(HttpStatus.OK)
  async confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDto) {
    return await this.stallsService.confirmPayment(
      confirmPaymentDto.stallId,
      confirmPaymentDto.notes
    );
  }

  /**
   * Scan QR code for check-in/check-out
   * POST /stalls/scan-qr
   */
  @Post("scan-qr")
  @HttpCode(HttpStatus.OK)
  async scanQR(@Body() scanQRDto: ScanQRDto) {
    return await this.stallsService.scanStallQR(scanQRDto.qrCodeData);
  }

  /**
   * Get stall attendance details
   * GET /stalls/:id/attendance
   */
  @Get(":id/attendance")
  async getAttendance(@Param("id") id: string) {
    return await this.stallsService.getStallAttendance(id);
  }

  /**
   * Update payment status
   * PATCH /stalls/:id/payment-status
   */
  @Patch(":id/payment-status")
  async updatePaymentStatus(
    @Param("id") id: string,
    @Body() updateDto: UpdatePaymentStatusDto
  ) {
    return await this.stallsService.updatePaymentStatus(id, updateDto);
  }

  /**
   * Update stall status (used by organizer)
   * PATCH /stalls/:id/status
   */
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() updateDto: UpdateStatusDto
  ) {
    return await this.stallsService.updateStatus(id, updateDto);
  }

  /**
   * Get all stalls with populated references
   * GET /stalls
   */
  @Get()
  async findAll() {
    return await this.stallsService.findAll();
  }

  /**
   * Get stalls by event ID
   * GET /stalls/event/:eventId
   */
  @Get("event/:eventId")
  async findByEvent(@Param("eventId") eventId: string) {
    return await this.stallsService.findByEventId(eventId);
  }

  /**
   * Get stalls by organizer ID
   * GET /stalls/organizer/:organizerId
   */
  @Get("organizer/:organizerId")
  async findByOrganizer(@Param("organizerId") organizerId: string) {
    return await this.stallsService.findByOrganizerId(organizerId);
  }

  /**
   * Get stalls by shopkeeper ID
   * GET /stalls/shopkeeper/:shopkeeperId
   */
  @Get("shopkeeper/:shopkeeperId")
  async findByShopkeeper(@Param("shopkeeperId") shopkeeperId: string) {
    return await this.stallsService.findByShopkeeperId(shopkeeperId);
  }

  /**
   * Get single stall by ID
   * GET /stalls/:id
   */
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return await this.stallsService.findOne(id);
  }

  /**
   * Delete stall registration
   * DELETE /stalls/:id
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    return await this.stallsService.remove(id);
  }

  /**
   * Send bulk invitations to shopkeepers
   * POST /stalls/send-bulk-invitations
   */
  @Post("send-bulk-invitations")
  @HttpCode(HttpStatus.OK)
  async sendBulkInvitations(@Body() bulkInvitationDto: SendBulkInvitationDto) {
    // Implement in service
    return {
      success: true,
      message: "Bulk invitations implementation",
    };
  }

  @Patch(":id/return-deposit")
  @HttpCode(HttpStatus.OK)
  async returnDeposit(@Param("id") id: string) {
    return await this.stallsService.returnedDeposit(id);
  }
}
