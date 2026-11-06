import { useTranslations } from "next-intl";
import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { buttonClass, Pagination } from "@/components/ui/ui";
import {
  directoryHref,
  type DirectoryParams,
  type DirectoryFilter,
} from "@/lib/directory";

export function DirectoryControls({
  path,
  params,
  filters = [],
  placeholder,
}: {
  path: string;
  params: DirectoryParams;
  filters?: DirectoryFilter[];
  placeholder?: string;
}) {
  const t = useTranslations("common");
  return (
    <FilterPanel><form action={path} className="my-5 flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 text-xs text-[#6b6b6b]">
        {t("search")}
        <input
          name="search"
          className="ui-input mt-1"
          defaultValue={params.search}
          placeholder={placeholder ?? t("searchRecords")}
          maxLength={100}
        />
      </label>
      {filters.map((filter) => (
        <label
          key={filter.key}
          className="min-w-36 flex-1 text-xs text-[#6b6b6b]"
        >
          {filter.label}
          <select
            name={filter.key}
            className="ui-input mt-1"
            defaultValue={params[filter.key] || ""}
          >
            <option value="">{t("all")}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="text-xs text-[#6b6b6b]">
        {t("sort")}
        <select
          name="sort"
          className="ui-input mt-1"
          defaultValue={params.sort || "newest"}
        >
          <option value="newest">{t("newestFirst")}</option>
          <option value="oldest">{t("oldestFirst")}</option>
          <option value="name_asc">{t("nameAsc")}</option>
          <option value="name_desc">{t("nameDesc")}</option>
        </select>
      </label>
      <label className="text-xs text-[#6b6b6b]">
        {t("perPage")}
        <select
          name="pageSize"
          className="ui-input mt-1"
          defaultValue={params.pageSize || "25"}
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={buttonClass("primary")}>
        {t("apply")}
      </button>
      <Link href={path} className={buttonClass("secondary")}>
        {t("reset")}
      </Link>
    </form></FilterPanel>
  );
}

export function DirectoryPagination({
  path,
  params,
  page,
  pageSize,
  total,
  totalPages,
}: {
  path: string;
  params: DirectoryParams;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}) {
  const t = useTranslations("common");
  return (
    <div className="mt-5 border-t border-black/[0.06] pt-4">
      <p className="mb-3 text-sm text-[#8a8780]">
        {t("showingRecords", { from: total ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, total), total })}
      </p>
      <Pagination
        page={page}
        totalPages={totalPages}
        prevHref={directoryHref(path, params, Math.max(1, page - 1))}
        nextHref={directoryHref(path, params, Math.min(totalPages, page + 1))}
      />
    </div>
  );
}
