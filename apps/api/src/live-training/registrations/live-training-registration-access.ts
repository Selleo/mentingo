import { LIVE_TRAINING_MEMBER_ROLES, LIVE_TRAINING_REGISTRATION_STATUSES } from "@repo/shared";
import { sql, type SQLWrapper } from "drizzle-orm";

import { liveTrainingMembers, liveTrainings } from "src/storage/schema";

/** Apply registration eligibility without changing access for legacy trainings. */
export function liveTrainingRegistrationCondition(
  trainingId: SQLWrapper | string,
  userId: SQLWrapper | string,
) {
  return sql`not exists (
    select 1 from ${liveTrainings} registration_training
    where registration_training.id = ${trainingId}
      and coalesce((registration_training.settings->>'registrationRequired')::boolean, false)
      and not exists (
        select 1 from ${liveTrainingMembers} registration_member
        where registration_member.live_training_id = registration_training.id
          and registration_member.user_id = ${userId}
          and registration_member.role = ${LIVE_TRAINING_MEMBER_ROLES.ATTENDEE}
          and registration_member.metadata->>'status' = ${LIVE_TRAINING_REGISTRATION_STATUSES.REGISTERED}
      )
  )`;
}
