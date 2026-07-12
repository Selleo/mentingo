import { Icon } from "~/components/Icon";

export function EmptyDashboard() {
  return (
    <section className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-primary-300 bg-white p-8 text-center">
      <Icon name="NoData" />

      <div className="max-w-md">
        <h2 className="body-lg-md text-neutral-950">Twoj Dashboard jest pusty</h2>

        <p className="mt-2 text-neutral-700">Dodaj kafelki aby sprawdzac postep</p>
      </div>
    </section>
  );
}
