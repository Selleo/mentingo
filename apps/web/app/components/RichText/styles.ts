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

export const newsVariantClasses = {
  wrapper: "w-full py-10",
  layout:
    "[&>div]:flex [&>div]:flex-col [&>div]:space-y-8 [&>div]:leading-[1.9] [&>div]:text-neutral-900 [&>div]:tracking-tight [&>div>*]:mx-auto ",
  headings: `
      [&>div>h1]:text-[40px]
      [&>div>h1]:leading-[1.1]
      [&>div>h1]:font-bold
      [&>div>h1]:text-neutral-950

      [&>div>h2]:mt-10
      [&>div>h2]:text-[26px]
      [&>div>h2]:leading-tight
      [&>div>h2]:font-semibold
      [&>div>h2]:text-neutral-950

      [&>div>h3]:mt-8
      [&>div>h3]:text-xl
      [&>div>h3]:font-semibold
      [&>div>h3]:text-neutral-950
    `,
  paragraph: `
      [&>div>p]:mt-0
      [&>div>p]:text-[17px]
      [&>div>p]:leading-[1.95]
      [&>div>p]:text-neutral-800
      [&>div>p>strong]:text-neutral-950
      [&>div>p:first-of-type]:text-[18px]
    `,
  quotes:
    "[&>div blockquote]:rounded-2xl [&>div blockquote]:border-l-4 [&>div blockquote]:border-neutral-200 [&>div blockquote]:bg-neutral-50 [&>div blockquote]:px-6 [&>div blockquote]:py-4 [&>div blockquote]:text-neutral-800 [&>div blockquote>p]:m-0",
  ul: `
      [&>div>ul]:my-4
      [&>div>ul]:space-y-3
      [&>div>ul]:pl-6
      [&>div>ul>li]:leading-7
      [&>div>ul>li]:text-neutral-800
      [&>div>ul>li]:marker:text-neutral-400
      [&>div>ul>li>p]:inline
      [&>div>ul>li>strong]:text-neutral-950
    `,
  ol: `
      [&>div>ol]:my-4
      [&>div>ol]:space-y-3
      [&>div>ol]:pl-6
      [&>div>ol>li]:leading-7
      [&>div>ol>li]:text-neutral-800
      [&>div>ol>li]:marker:text-neutral-400
      [&>div>ol>li>p]:inline
      [&>div>ol>li>strong]:text-neutral-950
    `,
  images: `
      [&>div img]:my-8
      [&>div img]:w-full
      [&>div img]:rounded-[22px]
      [&>div img]:border
      [&>div img]:border-neutral-100
      [&>div img]:object-cover
      [&>div img]:shadow-[0px_14px_42px_rgba(0,0,0,0.08)]
    `,
  links: "[&>div a]:font-semibold [&>div a]:text-primary-700 [&>div a]:underline",
  hr: "[&>div hr]:my-12 [&>div hr]:border-neutral-200",
  code: `
      [&>div pre]:my-6
      [&>div pre]:rounded-2xl
      [&>div pre]:bg-neutral-900
      [&>div pre]:text-neutral-50
      [&>div pre]:p-5
      [&>div pre]:text-sm
      [&>div pre]:overflow-x-auto
    `,
};
