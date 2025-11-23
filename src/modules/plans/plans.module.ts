import { Module } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { PlansController } from "./plans.controller";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { Plan, PlanSchema } from "./entities/plan.entity";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Plan.name, schema: PlanSchema }]),
  ],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
