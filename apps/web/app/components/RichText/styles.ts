export const defaultClasses = {
  codeBlock: `
      [&_pre]:my-3
      [&_pre]:overflow-x-auto
      [&_pre]:rounded-md
      [&_pre]:bg-neutral-900
      [&_pre]:p-4
      [&_pre]:text-sm
      [&_pre]:text-neutral-100
      [&_pre_code]:bg-transparent
      [&_pre_code]:p-0
      [&_code:not(pre_code)]:rounded-sm
      [&_code:not(pre_code)]:border
      [&_code:not(pre_code)]:border-neutral-700
      [&_code:not(pre_code)]:bg-neutral-800
      [&_code:not(pre_code)]:px-1.5
      [&_code:not(pre_code)]:py-0.5
      [&_code:not(pre_code)]:font-mono
      [&_code:not(pre_code)]:text-[0.9em]
      [&_code:not(pre_code)]:text-neutral-100
      [&_code:not(pre_code)]:before:content-none
      [&_code:not(pre_code)]:after:content-none
    `,
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

export const contentVariantClasses = {
  wrapper: "",
  layout: "",
  links: "",
  ...defaultClasses,
};

export const newsVariantClasses = contentVariantClasses;
export const articleVariantClasses = contentVariantClasses;
