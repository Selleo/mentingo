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
    const orderBy = jest.fn().mockResolvedValue(tasks);
    const where = jest.fn().mockReturnValue({ orderBy });
    const from = jest.fn().mockReturnValue({ where });
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where: updateWhere });
    const update = jest.fn().mockReturnValue({ set });
    const transaction = jest.fn(async (callback) => callback({ update }));
    const db = {
      select: jest.fn().mockReturnValue({ from }),
      transaction,
    };
    const repository: TodoTasksRepository = Reflect.construct(TodoTasksRepository, [db]);
    return { repository, set, transaction };
  };

  it("persists the validated order supplied by the service", async () => {
    const { repository, set, transaction } = createRepository();

    await repository.reorder(userId, {
      activeTaskIds: [activeTask.id],
      completedTaskIds: [completedTask.id],
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenNthCalledWith(1, {
      position: 0,
      updatedAt: expect.any(String),
    });
    expect(set).toHaveBeenNthCalledWith(2, {
      position: 0,
      updatedAt: expect.any(String),
    });
  });
});
