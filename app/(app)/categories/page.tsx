import { requireSession } from "@/src/lib/session";

import { CategoriesView } from "./categories-view";

export default async function CategoriesPage() {
  await requireSession();

  return <CategoriesView />;
}
