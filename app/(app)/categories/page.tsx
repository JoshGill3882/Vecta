import { CategoriesView } from "@/src/components/categories/categories-view";
import { requireSession } from "@/src/lib/session";

export default async function CategoriesPage() {
  await requireSession();

  return <CategoriesView />;
}
