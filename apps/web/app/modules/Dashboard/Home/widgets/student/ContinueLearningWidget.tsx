import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

export default function ContinueLearningWIdget() {
  const progress = 64;

  return (
    <article className="flex h-full flex-col gap-4 bg-white px-4 py-2 rounded-md">
      <div>
        <h2 className="body-lg-md text-neutral-950">Kontynuuj naukę</h2>

        <p className="mt-1 text-sm text-neutral-700">Wróć do ostatnio rozpoczętego kursu.</p>
      </div>

      <div className="flex min-h-28 items-end rounded-lg bg-gradient-to-br from-primary-100 to-primary-300 p-4">
        <span className="rounded-md bg-white px-3 py-2 body-sm-md text-neutral-950">
          Komunikacja w zespole
        </span>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-neutral-700">Postęp kursu</span>
          <span className="font-medium text-neutral-950">{progress}%</span>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-primary-100"
          role="progressbar"
          aria-label="Postęp kursu"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full rounded-full bg-primary-600" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div>
        <p className="text-sm text-neutral-700">Następna lekcja</p>
        <p className="body-sm-md text-neutral-950">Jak udzielać konstruktywnego feedbacku</p>
      </div>

      <div className="mt-auto flex justify-end">
        <Button asChild>
          <Link to="/courses">Kontynuuj naukę</Link>
        </Button>
      </div>
    </article>
  );
}
