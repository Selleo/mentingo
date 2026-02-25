type SharedCourseReadonlyNoticeProps = {
  title: string;
  description: string;
};

export const SharedCourseReadonlyNotice = ({
  title,
  description,
}: SharedCourseReadonlyNoticeProps) => (
  <div className="flex w-full max-w-[744px] flex-col gap-y-1.5 bg-white p-8">
    <h5 className="h5 text-neutral-950">{title}</h5>
    <p className="body-base text-neutral-900">{description}</p>
  </div>
);
