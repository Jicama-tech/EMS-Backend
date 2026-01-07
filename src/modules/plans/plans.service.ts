import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { Plan, PlanDocument } from "../plans/entities/plan.entity";

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private planModel: Model<PlanDocument>) {}

  async create(createPlanDto: CreatePlanDto): Promise<Plan> {
    try {
      const createdPlan = new this.planModel(createPlanDto);
      return await createdPlan.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException("Plan with this name already exists");
      }
      throw error;
    }
  }

  async findAll(): Promise<Plan[]> {
    return await this.planModel.find().exec();
  }

  async findAllActive(): Promise<Plan[]> {
    return await this.planModel.find({ isActive: true }).exec();
  }

  async findByModule(moduleType: string): Promise<Plan[]> {
    return await this.planModel
      .find({
        $or: [{ moduleType }, { moduleType: "Both" }],
        isActive: true,
      })
      .exec();
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.planModel.findById(id).exec();
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
  }

  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan> {
    const updatedPlan = await this.planModel
      .findByIdAndUpdate(id, updatePlanDto, { new: true })
      .exec();
    if (!updatedPlan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return updatedPlan;
  }

  async remove(id: string): Promise<void> {
    const result = await this.planModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
  }

  async toggleActive(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    plan.isActive = !plan.isActive;
    return await this.planModel
      .findByIdAndUpdate(id, plan, { new: true })
      .exec();
  }
}
