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
      console.log("Creating event with data:", createEventDto);

      const startDate = new Date(createEventDto.startDate);
      const endDate = createEventDto.endDate
        ? new Date(createEventDto.endDate)
        : new Date(createEventDto.startDate);

      let endTime: Date;
      if (createEventDto.endTime) {
        endTime = new Date(createEventDto.endTime);
      } else {
        endTime = new Date(endDate);
        endTime.setHours(23, 59, 59, 999);
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
        tags: createEventDto.tags || [],
        features: createEventDto.features || {
          food: false,
          parking: false,
          wifi: false,
          photography: false,
          security: false,
          accessibility: false,
        },
        ageRestriction: createEventDto.ageRestriction,
        dresscode: createEventDto.dresscode,
        specialInstructions: createEventDto.specialInstructions,
        refundPolicy: createEventDto.refundPolicy,
        termsAndConditions: createEventDto.termsAndConditions,
        setupTime: createEventDto.setupTime,
        breakdownTime: createEventDto.breakdownTime,
        socialMedia: createEventDto.socialMedia || {
          facebook: "",
          instagram: "",
          twitter: "",
          linkedin: "",
        },
        image: createEventDto.image,
        gallery: createEventDto.gallery || [],
        tableTemplates: createEventDto.tableTemplates || [],
        venueTables: createEventDto.venueTables || [],
        addOnItems: createEventDto.addOnItems || [],

        // IMPORTANT: venueConfig is now an ARRAY
        venueConfig:
          createEventDto.venueConfig && createEventDto.venueConfig.length > 0
            ? createEventDto.venueConfig
            : [
                {
                  venueConfigId: "venueConfig1",
                  width: 800,
                  height: 500,
                  scale: 0.75,
                  gridSize: 20,
                  showGrid: true,
                  hasMainStage: true,
                  totalRows: 3,
                },
              ],

        status: createEventDto.status || "draft",
        featured: createEventDto.featured || false,
      });

      const savedEvent = await event.save();
      console.log("Event created successfully:", savedEvent._id);
      return savedEvent;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  }

  async findAll(): Promise<Event[]> {
    try {
      const events = await this.eventModel
        .find()
        .populate("organizer")
        .sort({ createdAt: -1 })
        .exec();
      return events;
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Event> {
    try {
      const event = await this.eventModel
        .findById(id)
        .populate("organizer")
        .exec();

      if (!event) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return event;
    } catch (error) {
      console.error("Error finding event:", error);
      throw error;
    }
  }

  async findByOrganizer(
    organizerId: string
  ): Promise<{ events: Event[]; total: number }> {
    try {
      const [events, total] = await Promise.all([
        this.eventModel
          .find({ organizer: organizerId })
          .populate("organizer")
          .sort({ createdAt: -1 })
          .exec(),
        this.eventModel.countDocuments({ organizer: organizerId }).exec(),
      ]);

      return { events, total };
    } catch (error) {
      console.error("Error fetching organizer events:", error);
      throw error;
    }
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    try {
      console.log("Updating event:", id, updateEventDto);

      // Handle date conversions
      if (updateEventDto.startDate) {
        updateEventDto.startDate = new Date(updateEventDto.startDate) as any;
      }
      if (updateEventDto.endDate) {
        updateEventDto.endDate = new Date(updateEventDto.endDate) as any;
      } else if (updateEventDto.startDate) {
        updateEventDto.endDate = new Date(updateEventDto.startDate) as any;
      }

      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(id, updateEventDto, {
          new: true,
          runValidators: true,
        })
        .populate("organizer")
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      console.log("Event updated successfully:", updatedEvent._id);
      return updatedEvent;
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  }

  async remove(id: string): Promise<Event> {
    try {
      const deletedEvent = await this.eventModel
        .findByIdAndDelete(id)
        .populate("organizer")
        .exec();

      if (!deletedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      console.log("Event deleted successfully:", deletedEvent._id);
      return deletedEvent;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Event> {
    try {
      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .populate("organizer")
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return updatedEvent;
    } catch (error) {
      console.error("Error updating event status:", error);
      throw error;
    }
  }

  async searchEvents(query: string): Promise<Event[]> {
    try {
      const searchRegex = new RegExp(query, "i");

      const events = await this.eventModel
        .find({
          $or: [
            { title: { $regex: searchRegex } },
            { description: { $regex: searchRegex } },
            { category: { $regex: searchRegex } },
            { location: { $regex: searchRegex } },
            { tags: { $in: [searchRegex] } },
          ],
        })
        .populate("organizer")
        .sort({ createdAt: -1 })
        .exec();

      return events;
    } catch (error) {
      console.error("Error searching events:", error);
      throw error;
    }
  }
}
