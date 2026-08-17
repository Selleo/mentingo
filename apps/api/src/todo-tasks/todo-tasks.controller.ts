import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";

import {
  createTodoTaskSchema,
  reorderTodoTasksSchema,
  todoTaskListSchema,
  todoTaskSchema,
  updateTodoTaskSchema,
} from "./todo-tasks.schema";
import { TodoTasksService } from "./todo-tasks.service";
import { CreateTodoTaskBody, ReorderTodoTasksBody, UpdateTodoTaskBody } from "./todo-tasks.types";

@Controller("todo-tasks")
@UseGuards(PermissionsGuard)
@RequirePermission(PERMISSIONS.TODO_TASK_MANAGE_SELF)
export class TodoTasksController {
  constructor(private readonly service: TodoTasksService) {}

  @Get()
  @Validate({ response: baseResponse(todoTaskListSchema) })
  async list(@CurrentUser("userId") userId: UUIDType) {
    return new BaseResponse(await this.service.list(userId));
  }

  @Post()
  @Validate({
    request: [{ type: "body", schema: createTodoTaskSchema }],
    response: baseResponse(todoTaskSchema),
  })
  async create(@Body() body: CreateTodoTaskBody, @CurrentUser("userId") userId: UUIDType) {
    return new BaseResponse(await this.service.create(userId, body));
  }

  @Patch(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateTodoTaskSchema },
    ],
    response: baseResponse(todoTaskSchema),
  })
  async update(
    @Param("id") id: UUIDType,
    @Body() body: UpdateTodoTaskBody,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    return new BaseResponse(await this.service.update(userId, id, body));
  }

  @Delete(":id")
  @Validate({ request: [{ type: "param", name: "id", schema: UUIDSchema }] })
  async remove(@Param("id") id: UUIDType, @CurrentUser("userId") userId: UUIDType) {
    await this.service.remove(userId, id);
    return new BaseResponse({ deleted: true });
  }

  @Put("order")
  @Validate({
    request: [{ type: "body", schema: reorderTodoTasksSchema }],
    response: baseResponse(todoTaskListSchema),
  })
  async reorder(@Body() body: ReorderTodoTasksBody, @CurrentUser("userId") userId: UUIDType) {
    return new BaseResponse(await this.service.reorder(userId, body));
  }
}
