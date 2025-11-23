import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { EventsModule } from "./modules/events/events.module";
import { OrganizersModule } from "./modules/organizers/organizers.module";
import { ShopkeepersModule } from "./modules/shopkeepers/shopkeepers.module";
// import { UploadsModule } from "./modules/uploads/uploads.module";
import { AdminModule } from "./modules/admin/admin.module";
import { RolesModule } from "./modules/roles/roles.module";
import { MailModule } from "./modules/roles/mail.module";
import { ProductsModule } from "./modules/products/products.module";
import { OtpModule } from "./modules/otp/otp.module";
import { ShopkeeperStoresModule } from "./modules/shopkeeper-stores/shopkeeper-stores.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { StallsModule } from "./modules/stalls/stalls.module";
import { PlansModule } from "./modules/plans/plans.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailModule,
    MongooseModule.forRoot(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh_dev"
    ),
    AuthModule,
    UsersModule,
    OtpModule,
    ShopkeeperStoresModule,
    EventsModule,
    OrganizersModule,
    ShopkeepersModule,
    // UploadsModule,
    AdminModule,
    RolesModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    TicketsModule,
    StallsModule,
    PlansModule,
  ],
})
export class AppModule {}
