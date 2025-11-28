import { useState } from "react";

import { useBulkGroupCourseEnroll } from "~/api/mutations/admin/useBulkGroupCourseEnroll";
import { useGroupsQuery } from "~/api/queries/admin/useGroups";
import { useGroupsByCourseQuery } from "~/api/queries/admin/useGroupsByCourse";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { GetAllGroupsResponse } from "~/api/generated-api";

type CourseEnrollGroupsModalProps = {
  courseId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CourseEnrollGroupsModal = ({
  courseId,
  isOpen,
  onOpenChange,
}: CourseEnrollGroupsModalProps) => {
  const { data: groups } = useGroupsQuery();
  const { data: enrolledGroups } = useGroupsByCourseQuery(courseId);
  const [selectedGroup, setSelectedGroup] = useState<GetAllGroupsResponse["data"][number] | null>(
    null,
  );

  const { mutate: enrollToCourse } = useBulkGroupCourseEnroll(courseId);

  const enrolledGroupIds = new Set(enrolledGroups?.map((group) => group.id) || []);
  const availableGroups = groups?.filter((group) => !enrolledGroupIds.has(group.id));

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(availableGroups?.find((group) => group.id === groupId) ?? null);
  };

  const handleEnroll = () => {
    onOpenChange(false);
    if (!selectedGroup) return;
    enrollToCourse({
      groupIds: [selectedGroup.id],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>CourseEnrollGroupsModal</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-y-2">
          <Select onValueChange={handleGroupChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {availableGroups && availableGroups.length > 0 ? (
                availableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-groups" disabled>
                  No groups available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={handleEnroll}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
