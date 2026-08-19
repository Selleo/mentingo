import { BadRequestException } from "@nestjs/common";

import { TodoTasksService } from "./todo-tasks.service";

import type { TodoTasksRepository } from "./todo-tasks.repository";

describe("TodoTasksService", () => {
  const task = {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Review dashboard",
    position: 0,
    completed: false,
    completedAt: null,
    createdAt: "2026-08-17T10:00:00.000Z",
    updatedAt: "2026-08-17T10:00:00.000Z",
  };
  const userId = "00000000-0000-0000-0000-000000000002";

  const createRepository = () => ({
    findAll: jest.fn().mockResolvedValue([task]),
    findById: jest.fn().mockResolvedValue(task),
    count: jest.fn().mockResolvedValue(1),
    countByCompletion: jest.fn().mockResolvedValue(1),
    create: jest.fn().mockResolvedValue(task),
    update: jest.fn().mockResolvedValue({
      ...task,
      completed: true,
      completedAt: "2026-08-17T11:00:00.000Z",
    }),
    remove: jest.fn().mockResolvedValue(true),
    reorder: jest.fn().mockResolvedValue([task]),
    compactPositions: jest.fn().mockResolvedValue(undefined),
  });

  it("returns repository response objects without remapping them", async () => {
    const repository = createRepository();
    const service = new TodoTasksService(repository as unknown as TodoTasksRepository);

    await expect(service.list(userId)).resolves.toEqual([task]);
  });

  it("trims titles and always passes the authenticated user to writes", async () => {
    const repository = createRepository();
    const service = new TodoTasksService(repository as unknown as TodoTasksRepository);

    await service.create(userId, { title: "  New task  " });
    await service.update(userId, task.id, { title: "  Renamed  ", completed: true });
    await service.remove(userId, task.id);
    await service.reorder(userId, { activeTaskIds: [task.id], completedTaskIds: [] });

    expect(repository.create).toHaveBeenCalledWith(userId, "New task", 1);
    expect(repository.update).toHaveBeenCalledWith(userId, task.id, {
      title: "Renamed",
      completedAt: expect.any(String),
      position: 1,
    });
    expect(repository.remove).toHaveBeenCalledWith(userId, task.id);
    expect(repository.reorder).toHaveBeenCalledWith(userId, {
      activeTaskIds: [task.id],
      completedTaskIds: [],
    });
  });

  it("rejects creation after the task limit is reached", async () => {
    const repository = createRepository();
    repository.count.mockResolvedValue(100);
    const service = new TodoTasksService(repository as unknown as TodoTasksRepository);

    await expect(service.create(userId, { title: "One too many" })).rejects.toThrow(
      new BadRequestException("todoTasks.limitReached"),
    );
    expect(repository.countByCompletion).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a reorder that moves an active task into the completed section", async () => {
    const repository = createRepository();
    const service = new TodoTasksService(repository as unknown as TodoTasksRepository);

    await expect(
      service.reorder(userId, { activeTaskIds: [], completedTaskIds: [task.id] }),
    ).rejects.toThrow(new BadRequestException("todoTasks.invalidOrder"));
    expect(repository.reorder).not.toHaveBeenCalled();
  });
});
