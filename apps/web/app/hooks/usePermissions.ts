import { castArray } from "lodash-es";

import { useCurrentUserSuspense } from "~/api/queries";
import {
  hasAnyPermission,
  matchesRequirement,
  type PermissionKey,
  type PermissionRequirement,
} from "~/common/permissions/permission.utils";

type PermissionInput = PermissionKey | PermissionKey[];

type UsePermissionsCriteria = {
  required?: PermissionInput;
  all?: PermissionKey[];
  none?: PermissionKey[];
};

export const usePermissions = (criteria: UsePermissionsCriteria = {}) => {
  const { data } = useCurrentUserSuspense();

  const permissions = data?.permissions ?? [];

  const required = castArray(criteria.required ?? []);
  const all = criteria.all ?? [];
  const none = criteria.none ?? [];

  const requirement: PermissionRequirement = {
    anyOf: required,
    allOf: all,
  };

  const hasNoForbiddenPermissions = none.length === 0 || !hasAnyPermission(permissions, none);

  return {
    hasAccess: matchesRequirement(permissions, requirement) && hasNoForbiddenPermissions,
    permissions,
  };
};
