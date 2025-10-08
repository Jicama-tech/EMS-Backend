import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Event, EventDocument } from "./schemas/event.schema";
import { CreateEventDto } from "./dto/createEvent.dto";
import { UpdateEventDto } from "./dto/updateEvent.dto";

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    try {
      console.log(createEventDto, "Creating event");

      const startDate = new Date(createEventDto.startDate);

      // If no endDate, set to startDate
      const endDate = createEventDto.endDate
        ? new Date(createEventDto.endDate)
        : new Date(createEventDto.startDate);

      // Define endTime: if provided use it; else set to 12:00 AM (midnight) of endDate
      let endTime: Date;
      if (createEventDto.endTime) {
        endTime = new Date(createEventDto.endTime);
      } else {
        // Set endTime to midnight (00:00) of endDate
        endTime = new Date(endDate);
        endTime.setHours(24, 0, 0, 0); // 24:00 interpreted as midnight next day
        // Alternatively, to keep it precisely 00:00 of next day, you can do:
        // endTime.setHours(0, 0, 0, 0);
        // endTime.setDate(endTime.getDate() + 1);
      }

      const event = new this.eventModel({
        title: createEventDto.title,
        description: createEventDto.description,
        category: createEventDto.category,
        startDate,
        time: createEventDto.time,
        endDate,
        endTime,
        organizer: createEventDto.organizerId,
        location: createEventDto.location,
        address: createEventDto.address,
        ticketPrice: createEventDto.ticketPrice,
        totalTickets: createEventDto.totalTickets,
        visibility: createEventDto.visibility || "public",
        inviteLink: createEventDto.inviteLink,
        tags: createEventDto.tags,
        features: createEventDto.features,
        ageRestriction: createEventDto.ageRestriction,
        dresscode: createEventDto.dresscode,
        specialInstructions: createEventDto.specialInstructions,
        image: createEventDto.image,
        gallery: createEventDto.gallery,
        organizerDetails: createEventDto.organizer,
        socialMedia: createEventDto.socialMedia,
        refundPolicy: createEventDto.refundPolicy,
        termsAndConditions: createEventDto.termsAndConditions,
      });

      return await event.save();
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async list() {
    const events = await this.eventModel.find().populate("organizer");
    if (!events) {
      throw new NotFoundException("No Events Found");
    }

    return { message: "Events Found", data: events };
  }

  async findById(id: string) {
    const event = await this.eventModel
      .findById(id)
      .populate("organizer")
      .exec();
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    try {
      // Prepare update data
      const updateData: any = { ...updateEventDto };

      // Handle date updates if provided
      if (updateEventDto.startDate) {
        updateData.startDate = new Date(updateEventDto.startDate);
      }

      if (updateEventDto.endDate) {
        updateData.endDate = new Date(updateEventDto.endDate);
      } else if (updateEventDto.startDate) {
        // If no endDate provided but startDate is provided, set endDate to startDate
        updateData.endDate = new Date(updateEventDto.startDate);
      }

      // Handle endTime: if not provided, set to 12:00 AM (midnight) of endDate
      if (updateEventDto.endTime) {
        updateData.endTime = new Date(updateEventDto.endTime);
      } else {
        // Set endTime to midnight (00:00) of endDate (or startDate fallback)
        const endDateForTime = updateData.endDate || updateData.startDate;
        if (endDateForTime) {
          const newEndTime = new Date(endDateForTime);
          // Set hour 24 to represent midnight at end of day
          newEndTime.setHours(24, 0, 0, 0);
          updateData.endTime = newEndTime;
        }
      }

      // Handle organizerId conversion if provided
      if (updateEventDto.organizerId) {
        updateData.organizer = updateEventDto.organizerId;
        delete updateData.organizerId;
      }

      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(id, updateData, {
          new: true,
          runValidators: true,
        })
        .populate("organizer")
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return updatedEvent;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async remove(id: string) {
    const deletedEvent = await this.eventModel.findByIdAndDelete(id).exec();
    if (!deletedEvent) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return deletedEvent;
  }

  async findEventsByOrganizer(organizerId: string, page = 1, limit = 10) {
    try {
      const events = await this.eventModel
        .find({ organizer: organizerId })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec();

      if (events.length === 0) {
        throw new NotFoundException("No Events Found");
      }

      return { message: "Events Found", data: events };
    } catch (error) {
      throw error;
    }
  }

  async countEventsByOrganizer(organizerId: string) {
    return this.eventModel.countDocuments({ organizer: organizerId }).exec();
  }
}
