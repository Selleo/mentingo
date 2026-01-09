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

export const articleVariantClasses = {
  wrapper: "w-full py-10",
  layout:
    "[&>div]:flex [&>div]:flex-col [&>div]:space-y-8 [&>div]:leading-[1.9] [&>div]:text-neutral-900 [&>div]:tracking-tight",
  links: `
      [&_a]:font-semibold
      [&_a]:text-primary-700
      [&_a[download]]:inline-flex
      [&_a[download]]:items-center
      [&_a[download]]:gap-2
      [&_a[download]]:px-3
      [&_a[download]]:py-1.5
      [&_a[download]]:rounded-lg
      [&_a[download]]:border
      [&_a[download]]:border-primary-200
      [&_a[download]]:no-underline
      [&_a[download]]:text-sm
      [&_a[download]]:text-primary-800
      [&_a[download]]:shadow-sm
      [&_a[download]]:transition-colors
      [&_a[download]:hover]:bg-primary-50
      [&_a[download]:hover]:text-primary-900
      [&_a[download]::before]:content-['⬇']
      [&_a[download]::before]:text-[1.5rempx]
      [&_a[download]::before]:text-primary-800
    `,
};

export const newsVariantClasses = articleVariantClasses;
export const contentVariantClasses = defaultClasses;
