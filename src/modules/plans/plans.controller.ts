import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from "@nestjs/common";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";

@Controller("plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post("create-plan")
  create(@Body() createPlanDto: CreatePlanDto) {
    return this.plansService.create(createPlanDto);
  }

  @Get("get-plans")
  findAll(@Query("active") active?: string) {
    if (active === "true") {
      return this.plansService.findAllActive();
    }
    return this.plansService.findAll();
  }

  @Get("module/:moduleType")
  findByModule(@Param("moduleType") moduleType: string) {
    return this.plansService.findByModule(moduleType);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.plansService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updatePlanDto: UpdatePlanDto) {
    return this.plansService.update(id, updatePlanDto);
  }

  @Patch(":id/toggle-active")
  toggleActive(@Param("id") id: string) {
    return this.plansService.toggleActive(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.plansService.remove(id);
  }
}
