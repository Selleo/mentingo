import { TodoTasksService } from "./todo-tasks.service";

import type { TodoTasksRepository } from "./todo-tasks.repository";

describe("TodoTasksService", () => {
  const task = {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Review dashboard",
    position: 0,
    completedAt: null,
    createdAt: "2026-08-17T10:00:00.000Z",
    updatedAt: "2026-08-17T10:00:00.000Z",
    userId: "00000000-0000-0000-0000-000000000002",
    tenantId: "00000000-0000-0000-0000-000000000003",
  };

  const createRepository = () => ({
    findAll: jest.fn().mockResolvedValue([task]),
    create: jest.fn().mockResolvedValue(task),
    update: jest.fn().mockResolvedValue({ ...task, completedAt: "2026-08-17T11:00:00.000Z" }),
    remove: jest.fn().mockResolvedValue(undefined),
    reorder: jest.fn().mockResolvedValue([task]),
  });

  it("maps completion timestamp to the public completed flag", async () => {
    const repository = createRepository();
    const service = new TodoTasksService(repository as unknown as TodoTasksRepository);

    await expect(service.list(task.userId)).resolves.toEqual([
      {
        id: task.id,
        title: task.title,
        completed: false,
        completedAt: null,
        position: 0,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    ]);

    repository.findAll.mockResolvedValueOnce([
      { ...task, completedAt: "2026-08-17T11:00:00.000Z" },
    ]);
    await expect(service.list(task.userId)).resolves.toEqual([
      expect.objectContaining({ completed: true, completedAt: "2026-08-17T11:00:00.000Z" }),
    ]);
  });

  it("trims titles and always passes the authenticated user to writes", async () => {
    const repository = createRepository();
    const service = new TodoTasksService(repository as unknown as TodoTasksRepository);

    await service.create(task.userId, { title: "  New task  " });
    await service.update(task.userId, task.id, { title: "  Renamed  ", completed: true });
    await service.remove(task.userId, task.id);
    await service.reorder(task.userId, { activeTaskIds: [], completedTaskIds: [task.id] });

    expect(repository.create).toHaveBeenCalledWith(task.userId, "New task");
    expect(repository.update).toHaveBeenCalledWith(task.userId, task.id, {
      title: "Renamed",
      completed: true,
    });
    expect(repository.remove).toHaveBeenCalledWith(task.userId, task.id);
    expect(repository.reorder).toHaveBeenCalledWith(task.userId, {
      activeTaskIds: [],
      completedTaskIds: [task.id],
    });
  });
});
