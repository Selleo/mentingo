export const defaultClasses = {
  ul: `
      [&>div>ul]:list-disc
      [&>div>ul]:pl-5
      [&>div>ul>li>p]:inline
      [&>div>ul>li>p]:text-neutral-900
      
      [&>div>*]:!my-1
      
      [&_ul]:list-disc
      [&_[contenteditable='true']>ul>li]:pl-0
      [&_[contenteditable='true']>ul>li_ul_li]:pl-4
      [&_[contenteditable='false']>ul>li]:pl-4
      [&_[contenteditable='false']>ul>li_ul_li]:pl-4
      [&_ul>li]:marker:text-neutral-400
      [&_ul>li>p]:inline
      [&_ul>li>p]:text-neutral-900
    `,
  ol: `
      [&>div>ol]:list-decimal
      [&>div>ol]:list-inside
      [&>div>ol>li>p]:inline
      [&>div>ol>li>ol]:pl-4
      [&_ol>li>ol]:pl-4
    `,
  taskList: "[&_[data-type='taskList']]:list-none [&_[data-type='taskList']]:pl-0",
};

export const lessonVariantClasses = {
  layout: "[&>div]:flex [&>div]:flex-col",
  h2: "[&>div>h2]:h6 [&>div>h2]:text-neutral-950",
  p: "[&>div>p]:body-base [&>div>p]:text-neutral-900",
  ul: "[&>div>ul>li>p]:body-base [&>div>ul>li>p]:text-neutral-900 [&>div>ul>li>p>strong]:text-neutral-950",
  ol: "[&>div>ol>li>p]:body-base [&>div>ol>li>p]:text-neutral-900 [&>div>ol>li>p>strong]:text-neutral-950",
};
