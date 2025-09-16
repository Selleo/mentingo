import { Html, Text } from "@react-email/components";

export type FinishedCourseEmailProps = {
  userName: string;
  courseName: string;
  completedAt: string;
  groupName?: string;
};

export const FinishedCourseEmail = ({
  userName,
  courseName,
  completedAt,
  groupName,
}: FinishedCourseEmailProps) => {
  return (
    <Html>
      <Text>
        <b>{userName}</b> finished the course <b>{courseName}</b>.
      </Text>
      <Text>Completed at: {completedAt}</Text>
      {groupName && <Text>Belongs to group: {groupName}</Text>}
    </Html>
  );
};

export default FinishedCourseEmail;
