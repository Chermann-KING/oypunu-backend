import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingService } from './services/messaging.service';
import { MessagingController } from './controllers/messaging.controller';
import { MessagingGateway } from './gateways/messaging.gateway';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService, MessagingGateway],
})
export class MessagingModule {}
