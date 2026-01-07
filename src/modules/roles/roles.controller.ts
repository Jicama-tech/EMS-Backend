import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RoleService } from "../roles/roles.service";
import { AuthGuard } from "@nestjs/passport";

@Controller("role")
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post("check")
  @UseGuards(JwtAuthGuard)
  async checkRole(
    @Req() req: any,
    @Body() body: { role: "organizer" | "shopkeeper" }
  ) {
    try {
      const email = req.user.email;
      const name = req.user.name;
      return this.roleService.checkRoleAvailability(email, name, body.role);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post("register")
  @UseGuards(JwtAuthGuard)
  async registerRole(
    @Req() req,
    @Body() body: { password: string; role: "organizer" | "shopkeeper" }
  ) {
    const email = req.user.email;
    const name = req.user.name;
    return this.roleService.registerRole(name, email, body.password, body.role);
  }
}
