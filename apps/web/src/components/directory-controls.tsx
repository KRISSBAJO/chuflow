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
  placeholder = "Search records",
}: {
  path: string;
  params: DirectoryParams;
  filters?: DirectoryFilter[];
  placeholder?: string;
}) {
  return (
    <FilterPanel><form action={path} className="my-5 flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 text-xs text-[#6b6b6b]">
        Search
        <input
          name="search"
          className="ui-input mt-1"
          defaultValue={params.search}
          placeholder={placeholder}
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
            <option value="">All</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="text-xs text-[#6b6b6b]">
        Sort
        <select
          name="sort"
          className="ui-input mt-1"
          defaultValue={params.sort || "newest"}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </select>
      </label>
      <label className="text-xs text-[#6b6b6b]">
        Per page
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
        Apply
      </button>
      <Link href={path} className={buttonClass("secondary")}>
        Reset
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
  return (
    <div className="mt-5 border-t border-black/[0.06] pt-4">
      <p className="mb-3 text-sm text-[#8a8780]">
        Showing {total ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, total)} of {total} records
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
