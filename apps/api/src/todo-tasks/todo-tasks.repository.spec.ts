import { BadRequestException } from "@nestjs/common";

import { TodoTasksRepository } from "./todo-tasks.repository";

describe("TodoTasksRepository", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const activeTask = {
    id: "00000000-0000-0000-0000-000000000002",
    completedAt: null,
  };
  const completedTask = {
    id: "00000000-0000-0000-0000-000000000003",
    completedAt: "2026-08-17T10:00:00.000Z",
  };

  const createRepository = (tasks = [activeTask, completedTask]) => {
    const where = jest.fn().mockResolvedValue(tasks);
    const from = jest.fn().mockReturnValue({ where });
    const db = {
      select: jest.fn().mockReturnValue({ from }),
      transaction: jest.fn(),
    };
    return { repository: new TodoTasksRepository(db as never), db, where };
  };

  it("rejects an order that omits one of the user's tasks", async () => {
    const { repository, db } = createRepository();

    await expect(
      repository.reorder(userId, {
        activeTaskIds: [activeTask.id],
        completedTaskIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects moving tasks between active and completed sections", async () => {
    const { repository, db } = createRepository();

    await expect(
      repository.reorder(userId, {
        activeTaskIds: [],
        completedTaskIds: [activeTask.id, completedTask.id],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
