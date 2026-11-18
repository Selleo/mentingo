/** Narrows an optional entity id, failing with the entity name instead of continuing with undefined. */
export const requireId = (entity: { id?: string | null }, label: string): string => {
  if (!entity.id) throw new Error(`Expected ${label} to have an id`);
  return entity.id;
};
