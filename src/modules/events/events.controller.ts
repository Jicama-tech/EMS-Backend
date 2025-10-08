import {
  Controller,
  Post,
  UseGuards,
  Body,
  UploadedFile,
  UseInterceptors,
  Req,
  Get,
  Query,
  Param,
  Put,
  Delete,
  ParseIntPipe,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { AuthGuard } from "@nestjs/passport";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/createEvent.dto";
import { UpdateEventDto } from "./dto/updateEvent.dto";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { Types } from "mongoose";

function fileName(req, file, cb) {
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  cb(null, filename);
}

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post("create-event")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileInterceptor("image", {
      storage: diskStorage({
        destination: "./uploads/events",
        filename: fileName,
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          cb(new Error("Only image files are allowed!"), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 3 * 1024 * 1024 },
    })
  )
  async create(
    @UploadedFile() image: Express.Multer.File,
    @Body() body: any,
    @Req() req: any
  ) {
    try {
      // Fix the mapping
      body.title = body.name || body.title;
      body.startDate = body.date || body.startDate;
      body.organizerId = req.user.sub || body.organizerId;

      // Parse JSON strings
      if (typeof body.tags === "string") body.tags = JSON.parse(body.tags);
      if (typeof body.features === "string")
        body.features = JSON.parse(body.features);
      if (typeof body.gallery === "string")
        body.gallery = JSON.parse(body.gallery);
      if (typeof body.organizer === "string")
        body.organizer = JSON.parse(body.organizer);
      if (typeof body.socialMedia === "string")
        body.socialMedia = JSON.parse(body.socialMedia);

      // Handle image
      if (image) {
        body.image = `/uploads/events/${image.filename}`;
      }

      return await this.eventsService.create(body);
    } catch (error) {
      throw error;
    }
  }

  @Get("get-events")
  async list() {
    return this.eventsService.list();
  }

  @Get("organizer/:organizerId")
  async getEventsByOrganizer(@Param("organizerId") organizerId: string) {
    return this.eventsService.findEventsByOrganizer(organizerId);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.eventsService.findById(id);
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileInterceptor("image", {
      storage: diskStorage({
        destination: "./uploads/events",
        filename: fileName,
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          cb(new Error("Only image files are allowed!"), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 3 * 1024 * 1024 },
    })
  )
  async update(
    @Param("id") id: string,
    @UploadedFile() image: Express.Multer.File,
    @Body() body: any,
    @Req() req: any
  ) {
    try {
      // Parse JSON strings if they exist
      if (typeof body.tags === "string") body.tags = JSON.parse(body.tags);
      if (typeof body.features === "string")
        body.features = JSON.parse(body.features);
      if (typeof body.gallery === "string")
        body.gallery = JSON.parse(body.gallery);
      if (typeof body.organizer === "string")
        body.organizer = JSON.parse(body.organizer);
      if (typeof body.socialMedia === "string")
        body.socialMedia = JSON.parse(body.socialMedia);

      // Handle new image upload
      if (image) {
        body.image = `/uploads/events/${image.filename}`;
      }

      // Ensure only the event owner can update
      const existingEvent = await this.eventsService.findById(id);
      const organizerId = new Types.ObjectId(req.user.userId);
      // if (existingEvent.organizer._id !== organizerId) {
      //   throw new Error("Unauthorized: You can only update your own events");
      // }

      return await this.eventsService.update(id, body);
    } catch (error) {
      throw error;
    }
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    try {
      // Ensure only the event owner can delete
      const existingEvent = await this.eventsService.findById(id);
      // if (existingEvent.organizer._id.toString() !== req.user.sub) {
      //   throw new Error("Unauthorized: You can only delete your own events");
      // }

      return this.eventsService.remove(id);
    } catch (error) {
      throw error;
    }
  }
}
