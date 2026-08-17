import { Module } from "@nestjs/common";

import { TodoTasksController } from "./todo-tasks.controller";
import { TodoTasksRepository } from "./todo-tasks.repository";
import { TodoTasksService } from "./todo-tasks.service";

@Module({
  controllers: [TodoTasksController],
  providers: [TodoTasksRepository, TodoTasksService],
  exports: [TodoTasksService],
})
export class TodoTasksModule {}
